const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com"
]);

export function getYoutubeVideoId(value = "") {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    let id = "";

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (YOUTUBE_HOSTS.has(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else if (/^\/(embed|shorts)\//.test(url.pathname)) id = url.pathname.split("/")[2] || "";
    }

    return VIDEO_ID_PATTERN.test(id) ? id : "";
  } catch {
    return "";
  }
}

export function normalizeYoutubeEmbedUrl(value = "") {
  const id = getYoutubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
}
