function normalizeUrl(url = "") {
  return String(url || "").trim();
}

function tryParseUrl(url = "") {
  try {
    return new URL(normalizeUrl(url));
  } catch {
    return null;
  }
}

export function extractGoogleDriveFileId(url = "") {
  const value = normalizeUrl(url);
  if (!value) return "";

  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/thumbnail\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
    /docs\.google\.com\/(?:presentation|document|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/i,
    /docs\.google\.com\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
    /[?&]id=([a-zA-Z0-9_-]+)/i,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.googleusercontent\.com\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

export function detectGoogleResourceType(url = "") {
  const raw = normalizeUrl(url);
  const parsed = tryParseUrl(raw);
  if (!parsed) return "";
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (host.includes("docs.google.com")) {
    if (/\/presentation\/d\//i.test(path)) return "google-slides";
    if (/\/document\/d\//i.test(path)) return "google-doc";
    if (/\/spreadsheets\/d\//i.test(path)) return "google-sheet";
  }

  if (host.includes("drive.google.com") || host.includes("drive.googleusercontent.com") || host.includes("lh3.googleusercontent.com")) {
    return "drive-file";
  }

  return "";
}

export function isGoogleDriveFileUrl(url = "") {
  return !!extractGoogleDriveFileId(url);
}

export function isGooglePhotosShortUrl(url = "") {
  return /photos\.app\.goo\.gl/i.test(normalizeUrl(url));
}

export function convertGoogleDriveToDirectDownload(url = "") {
  const raw = normalizeUrl(url);
  const id = extractGoogleDriveFileId(raw);
  const type = detectGoogleResourceType(raw);
  if (!id) return raw;

  if (type === "google-slides") {
    return `https://docs.google.com/presentation/d/${id}/export/pptx`;
  }

  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export function convertGoogleDriveToDirectPdf(url = "") {
  const raw = normalizeUrl(url);
  const id = extractGoogleDriveFileId(raw);
  const type = detectGoogleResourceType(raw);
  if (!id) return raw;

  if (type === "google-slides") {
    return `https://docs.google.com/presentation/d/${id}/export/pdf`;
  }
  if (type === "google-doc") {
    return `https://docs.google.com/document/d/${id}/export?format=pdf`;
  }
  if (type === "google-sheet") {
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=pdf`;
  }

  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export function convertGoogleDriveToDirectPowerPoint(url = "") {
  const raw = normalizeUrl(url);
  const id = extractGoogleDriveFileId(raw);
  const type = detectGoogleResourceType(raw);
  if (!id) return raw;

  if (type === "google-slides") {
    return `https://docs.google.com/presentation/d/${id}/export/pptx`;
  }

  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export function convertGoogleDriveToDirectImage(url = "") {
  const raw = normalizeUrl(url);
  const id = extractGoogleDriveFileId(raw);
  if (!id) return raw;
  return `https://lh3.googleusercontent.com/d/${id}`;
}

export function convertDownloadUrlByType(url = "", linkType = "direct-download") {
  const raw = normalizeUrl(url);
  switch (String(linkType || "")) {
    case "keep":
    case "drive-folder":
      return raw;
    case "pdf":
      return convertGoogleDriveToDirectPdf(raw);
    case "powerpoint":
      return convertGoogleDriveToDirectPowerPoint(raw);
    case "direct-download":
    default:
      return convertGoogleDriveToDirectDownload(raw);
  }
}

export function convertDriveLinksInPayload(payload = {}) {
  return {
    ...payload,
    url: payload.url ? convertGoogleDriveToDirectDownload(payload.url) : payload.url,
    pdfUrl: payload.pdfUrl ? convertGoogleDriveToDirectPdf(payload.pdfUrl) : payload.pdfUrl,
    pptUrl: payload.pptUrl ? convertGoogleDriveToDirectPowerPoint(payload.pptUrl) : payload.pptUrl,
    imageUrl: payload.imageUrl ? convertGoogleDriveToDirectImage(payload.imageUrl) : payload.imageUrl,
    coverUrl: payload.coverUrl ? convertGoogleDriveToDirectImage(payload.coverUrl) : payload.coverUrl
  };
}
