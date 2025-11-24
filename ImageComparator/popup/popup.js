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

    // Get last clicked element coords from content script
    const coords = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: "GET_COORDS" }, (resp) => {
        resolve(resp);
      });
    });

    // Request background to capture visible tab
    const shot = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "CAPTURE_SCREENSHOT" }, (resp) => {
        resolve(resp);
      });
    });

    if (!shot || !shot.screenshot) {
      alert("Screenshot failed! Check console for errors.");
      console.error("Capture failed:", shot && shot.error);
      document.getElementById("capture").disabled = false;
      return;
    }

    const captureData = {
      timestamp: new Date().toISOString(),
      metadata: coords,
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
