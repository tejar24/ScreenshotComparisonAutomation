chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Simple visible-area screenshot
  if (msg.action === "CAPTURE_SCREENSHOT") {
    const windowId = sender.tab && sender.tab.windowId;
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ screenshot: dataUrl });
    });

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
