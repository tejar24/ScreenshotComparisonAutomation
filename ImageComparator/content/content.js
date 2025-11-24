let lastClickedElement = null;

// Capture clicked element for coordinates
document.addEventListener(
  "click",
  (e) => {
    lastClickedElement = e.target;
  },
  true
);

// Listen for popup request
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "GET_COORDS") {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let elementData = null;

    if (lastClickedElement) {
      const rect = lastClickedElement.getBoundingClientRect();
      elementData = {
        tag: lastClickedElement.tagName,
        selector: generateUniqueSelector(lastClickedElement),
        absoluteX: rect.left + scrollX,
        absoluteY: rect.top + scrollY,
        width: rect.width,
        height: rect.height,
        innerText: lastClickedElement.innerText?.slice(0, 120),
      };
    }

    sendResponse({
      scrollX,
      scrollY,
      viewportWidth,
      viewportHeight,
      element: elementData,
    });
  }

  return true;
});
