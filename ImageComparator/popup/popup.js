const captureBtn = document.getElementById("capture");

// Storage helpers with fallbacks to localStorage / in-memory
async function getStoredCaptures() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
    return await new Promise((resolve) => {
      try {
        chrome.storage.local.get({ captures: [] }, (items) => resolve(items.captures || []));
      } catch (e) { resolve([]); }
    });
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem('captures');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    // Final fallback: in-memory array
    window.__captures_fallback = window.__captures_fallback || [];
    return window.__captures_fallback;
  }
}

async function setStoredCaptures(captures) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.set) {
    return await new Promise((resolve) => {
      try {
        chrome.storage.local.set({ captures }, () => resolve());
      } catch (e) { resolve(); }
    });
  }

  try {
    localStorage.setItem('captures', JSON.stringify(captures));
    return;
  } catch (e) {
    window.__captures_fallback = captures;
    return;
  }
}

captureBtn.addEventListener("click", async () => {
  try {
    captureBtn.disabled = true;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Collect metadata from the page immediately before capture.
    // This enhanced collector will scroll the target element into view,
    // wait briefly for SPA rendering, freeze scrolling, then return:
    // - boundingClientRect (viewport-relative)
    // - documentOffset (offsetParent-summed)
    // - nearestScrollables: array of ancestor scroll containers and their scrollTop/rect
    // - prevHtmlOverflow / prevBodyOverflow so popup can restore them
    const collectPageMetadata = async (tabId, scrollDelay = 250) => {
      try {
        return await new Promise((resolve) => {
          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: async (delay) => {
                try {
                  const prevHtmlOverflow = document.documentElement.style.overflow || '';
                  const prevBodyOverflow = document.body && document.body.style ? document.body.style.overflow || '' : '';

                  const devicePixelRatio = window.devicePixelRatio || 1;
                  const viewportWidth = window.innerWidth;
                  const viewportHeight = window.innerHeight;

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

                  // Choose representative element: prefer activeElement, else center element
                  let el = document.activeElement;
                  if (!el || el === document.body || el === document.documentElement) {
                    el = document.elementFromPoint(Math.floor(viewportWidth / 2), Math.floor(viewportHeight / 2));
                  }

                  if (el) {
                    try {
                      // Bring element into view for SPA/virtualized lists
                      try {
                        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
                      } catch (e) { /* ignore */ }
                    } catch (e) {}
                  }

                  // Allow SPA to render after scrolling
                  await new Promise((r) => setTimeout(r, delay || 250));

                  // Freeze scroll by setting overflow hidden to reduce layout shifts
                  try {
                    document.documentElement.style.overflow = 'hidden';
                    if (document.body && document.body.style) document.body.style.overflow = 'hidden';
                  } catch (e) { /* ignore */ }

                  const scrollX = window.scrollX;
                  const scrollY = window.scrollY;

                  // Re-evaluate element after scroll
                  if (!el || el === document.body || el === document.documentElement) {
                    el = document.elementFromPoint(Math.floor(viewportWidth / 2), Math.floor(viewportHeight / 2));
                  }

                  let elementData = null;
                  if (el) {
                    try {
                      const r = el.getBoundingClientRect();

                      // compute documentOffset via offsetParent chain
                      let docX = 0, docY = 0;
                      try {
                        let op = el;
                        while (op) {
                          docX += op.offsetLeft || 0;
                          docY += op.offsetTop || 0;
                          op = op.offsetParent;
                        }
                      } catch (e) {}

                      // find nearest scrollable ancestors
                      const scrollables = [];
                      try {
                        let p = el.parentElement;
                        while (p && p !== document.documentElement) {
                          const style = window.getComputedStyle(p);
                          const overflowY = style.overflowY;
                          const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight;
                          if (isScrollable) {
                            const rect = p.getBoundingClientRect();
                            scrollables.push({ selector: genSelector(p), scrollTop: p.scrollTop, scrollLeft: p.scrollLeft, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, clientWidth: p.clientWidth, clientHeight: p.clientHeight });
                          }
                          p = p.parentElement;
                        }
                      } catch (e) {}

                      elementData = {
                        tag: el.tagName,
                        selector: genSelector(el),
                        boundingClientRect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
                        absoluteX: Math.round(r.left + scrollX),
                        absoluteY: Math.round(r.top + scrollY),
                        documentOffset: { x: docX, y: docY },
                        width: Math.round(r.width),
                        height: Math.round(r.height),
                        innerText: (el.innerText || '').slice(0, 120),
                        inViewport: !(r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth),
                        scrollableAncestors: scrollables
                      };
                    } catch (e) {
                      elementData = null;
                    }
                  }

                  return { prevHtmlOverflow, prevBodyOverflow, scrollX, scrollY, viewportWidth, viewportHeight, devicePixelRatio, element: elementData };
                } catch (e) {
                  return null;
                }
              },
              args: [scrollDelay]
            },
            (results) => {
              const res = results && results[0] && results[0].result ? results[0].result : null;
              resolve(res);
            }
          );
        });
      } catch (e) {
        return null;
      }
    };

    const pageMeta = await collectPageMetadata(tab.id).catch(() => null);

    // Request background to capture visible tab, passing collected metadata if available.
    const shot = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "CAPTURE_SCREENSHOT", metadata: pageMeta }, (resp) => {
        resolve(resp);
      });
    });

    // Restore overflow styles if we modified them
    if (pageMeta && (pageMeta.prevHtmlOverflow !== undefined || pageMeta.prevBodyOverflow !== undefined)) {
      try {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (prevHtmlOverflow, prevBodyOverflow) => {
            try {
              document.documentElement.style.overflow = prevHtmlOverflow || '';
            } catch (e) {}
            try {
              if (document.body && document.body.style) document.body.style.overflow = prevBodyOverflow || '';
            } catch (e) {}
          },
          args: [pageMeta.prevHtmlOverflow, pageMeta.prevBodyOverflow]
        });
      } catch (e) {
        // ignore restore errors
      }
    }

    if (!shot || !shot.screenshot) {
      alert("Screenshot failed! Check console for errors.");
      console.error("Capture failed:", shot && shot.error);
      document.getElementById("capture").disabled = false;
      return;
    }

    const captureData = {
      timestamp: new Date().toISOString(),
      metadata: shot.metadata || pageMeta || {},
      screenshot: shot.screenshot,
    };

    // Store capture using storage helpers so we work even when chrome.storage is unavailable
    const captures = await getStoredCaptures();
    captures.push(captureData);
    await setStoredCaptures(captures);
    captureBtn.textContent = `Take Screenshot (${captures.length})`;
  } catch (err) {
    console.error(err);
    alert("Unexpected error: " + err.message);
  } finally {
    captureBtn.disabled = false;
  }
});

// Wire Download ZIP button to export all stored captures
document.getElementById("download-zip").addEventListener("click", async () => {
  try {
    const captures = await getStoredCaptures();
    if (!captures.length) {
      alert('No captures saved. Take some screenshots first.');
      return;
    }

    // Call exporter to create ZIP (or fallback)
    await exportAsZip(captures);

    // Clear stored captures after download
    await setStoredCaptures([]);
    captureBtn.textContent = 'Take Screenshot';
    alert('Download complete — stored captures cleared.');
  } catch (err) {
    console.error(err);
    alert('Failed to download captures: ' + err.message);
  }
});
