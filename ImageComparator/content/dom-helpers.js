function generateUniqueSelector(el) {
  if (!el) return null;
  if (el.id) return `#${el.id}`;

  let path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className) {
      const classes = el.className.split(" ").filter(Boolean);
      if (classes.length) selector += "." + classes.join(".");
    }

    const parent = el.parentNode;
    if (parent) {
      const siblings = [...parent.children];
      const index = siblings.indexOf(el);
      selector += `:nth-child(${index + 1})`;
    }

    path.unshift(selector);
    el = parent;
  }
  return path.join(" > ");
}
