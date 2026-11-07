export function normalizeHttpsOrLocalUrl(value = "", maxLength = 2000) {
  const raw = String(value ?? "").trim().slice(0, maxLength);
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin || url.protocol === "https:") return url.href;
  } catch {
    return "";
  }
  return "";
}
