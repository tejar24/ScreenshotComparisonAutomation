chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Simple visible-area screenshot
  if (msg.action === "CAPTURE_SCREENSHOT") {
    const tab = sender.tab;
    const windowId = tab && tab.windowId;

    // If caller passed metadata, trust it and include in response
    if (msg && msg.metadata) {
      chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({ screenshot: dataUrl, metadata: msg.metadata });
      });
      return true;
    }

    // Otherwise attempt to collect metadata from the page, with fallbacks
    try {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const devicePixelRatio = window.devicePixelRatio || 1;
            let el = document.activeElement;
            if (!el || el === document.body || el === document.documentElement) {
              el = document.elementFromPoint(Math.floor(viewportWidth / 2), Math.floor(viewportHeight / 2));
            }
            let elementData = null;
            if (el) {
              try {
                const r = el.getBoundingClientRect();
                const genSelector = (element) => {
                  if (!element) return null;
                  if (element.id) return `#${element.id}`;
                  const path = [];
                  let e = element;
                  while (e && e.nodeType === Node.ELEMENT_NODE) {
                    let selector = e.nodeName.toLowerCase();
                    if (e.className) {
                      const classes = String(e.className).split(/\s+/).filter(Boolean);
                      if (classes.length) selector += '.' + classes.join('.');
                    }
                    const parent = e.parentNode;
                    if (parent) {
                      const siblings = Array.from(parent.children || []);
                      const idx = siblings.indexOf(e);
                      selector += `:nth-child(${idx + 1})`;
                    }
                    path.unshift(selector);
                    e = parent;
                  }
                  return path.join(' > ');
                };
                elementData = {
                  tag: el.tagName,
                  selector: genSelector(el),
                  absoluteX: Math.round(r.left + scrollX),
                  absoluteY: Math.round(r.top + scrollY),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                  innerText: (el.innerText || '').slice(0, 120),
                };
              } catch (e) {
                elementData = null;
              }
            }
            return { scrollX, scrollY, viewportWidth, viewportHeight, devicePixelRatio, element: elementData };
          } catch (e) {
            return null;
          }
        }
      }, (results) => {
        const coordsResp = results && results[0] && results[0].result ? results[0].result : null;
        if (!coordsResp) {
          // Fallback to content script message (if present)
          try {
            chrome.tabs.sendMessage(tab.id, { action: 'GET_COORDS' }, (fallbackResp) => {
              chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ error: chrome.runtime.lastError.message });
                  return;
                }
                sendResponse({ screenshot: dataUrl, metadata: fallbackResp || null });
              });
            });
            return;
          } catch (e) {
            // ignore and continue to capture without metadata
          }
        }
        chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          sendResponse({ screenshot: dataUrl, metadata: coordsResp || null });
        });
      });
    } catch (ex) {
      // If scripting.executeScript throws (permission or other), fallback to content script
      try {
        chrome.tabs.sendMessage(tab.id, { action: 'GET_COORDS' }, (fallbackResp) => {
          chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
              return;
            }
            sendResponse({ screenshot: dataUrl, metadata: fallbackResp || null });
          });
        });
      } catch (e) {
        // Final fallback: capture without metadata
        chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          sendResponse({ screenshot: dataUrl, metadata: null });
        });
      }
    }

    return true; // keep channel open for async sendResponse
  }

  // Full-page screenshot (optional, triggered with CAPTURE_FULL_SCREENSHOT)
  if (msg.action === "CAPTURE_FULL_SCREENSHOT") {
    const tabId = sender.tab.id;

    // Execute content script to get page dimensions
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        totalWidth: document.documentElement.scrollWidth,
        totalHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      })
    }, async (results) => {
      const { totalWidth, totalHeight, viewportWidth, viewportHeight } = results[0].result;
      const images = [];

      for (let y = 0; y < totalHeight; y += viewportHeight) {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (scrollY) => window.scrollTo(0, scrollY),
          args: [y]
        });
        // Wait for scroll to settle
        await new Promise(r => setTimeout(r, 250));

        const dataUrl = await new Promise((resolve) => {
          chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, resolve);
        });
        images.push({ dataUrl, y });
      }

      // Send all captured images back to popup
      sendResponse({ images, totalWidth, totalHeight, viewportWidth, viewportHeight });
    });

    return true; // Keep channel open
  }
});
