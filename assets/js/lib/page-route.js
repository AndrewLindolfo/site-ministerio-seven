export function getPageName(pathname = "") {
  const path = String(pathname || "").split(/[?#]/, 1)[0];
  const segment = path.split("/").filter(Boolean).pop() || "index";
  return decodeURIComponent(segment).toLowerCase().replace(/\.html$/, "");
}
