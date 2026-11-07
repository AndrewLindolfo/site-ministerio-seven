const ALLOWED_TAGS = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CODE", "DEL", "DIV", "EM", "H1", "H2", "H3",
  "H4", "H5", "H6", "HR", "I", "LI", "OL", "P", "PRE", "S", "SPAN", "STRONG",
  "SUB", "SUP", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "U", "UL"
]);

const ALLOWED_STYLES = new Set([
  "background-color", "color", "font-size", "font-style", "font-weight", "letter-spacing",
  "text-align", "text-decoration", "text-indent", "text-transform", "white-space"
]);

function sanitizeStyle(value = "") {
  return String(value)
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 1) return "";
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const styleValue = declaration.slice(separator + 1).trim();
      if (!ALLOWED_STYLES.has(property)) return "";
      if (/url\s*\(|expression\s*\(|javascript:|@import/i.test(styleValue)) return "";
      return `${property}: ${styleValue}`;
    })
    .filter(Boolean)
    .join("; ");
}

function sanitizeLink(value = "") {
  try {
    const url = new URL(String(value), window.location.origin);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function cleanElement(element) {
  const tag = element.tagName;
  if (!ALLOWED_TAGS.has(tag)) {
    if (["IFRAME", "LINK", "META", "OBJECT", "SCRIPT", "STYLE", "TEMPLATE"].includes(tag)) {
      element.remove();
      return;
    }
    element.replaceWith(...element.childNodes);
    return;
  }

  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    if (name === "style") {
      const style = sanitizeStyle(attribute.value);
      if (style) element.setAttribute("style", style);
      else element.removeAttribute(attribute.name);
      continue;
    }
    if (tag === "A" && name === "href") {
      const href = sanitizeLink(attribute.value);
      if (href) element.setAttribute("href", href);
      else element.removeAttribute(attribute.name);
      continue;
    }
    if (tag === "A" && ["target", "title"].includes(name)) continue;
    if (["colspan", "rowspan"].includes(name) && ["TD", "TH"].includes(tag)) continue;
    element.removeAttribute(attribute.name);
  }

  if (tag === "A" && element.getAttribute("target") === "_blank") {
    element.setAttribute("rel", "noopener noreferrer");
  } else if (tag === "A") {
    element.removeAttribute("target");
  }
}

export function sanitizeRichHtml(value = "") {
  const template = document.createElement("template");
  template.innerHTML = String(value ?? "");
  const elements = [...template.content.querySelectorAll("*")];
  elements.forEach(cleanElement);
  return template.innerHTML;
}
