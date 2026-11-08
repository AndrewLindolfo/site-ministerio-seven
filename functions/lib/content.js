function clean(value = "", maxLength = 300) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalize(value = "") {
  return clean(value, 180).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function escapeHtml(value = "") {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function lyricToHtml(value = "") {
  return String(value || "").replace(/\r\n?/g, "\n").split(/\n{2,}/).map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`).join("");
}

function mapLrclibRecord(record = {}, includeContent = false) {
  const mapped = {
    id: `lrclib:${record.id}`,
    title: clean(record.trackName || record.name, 150),
    artist: clean(record.artistName, 150),
    version: clean(record.albumName, 150),
    source: "LRCLIB",
    sourceUrl: `https://lrclib.net/api/get/${encodeURIComponent(record.id)}`
  };
  if (includeContent) mapped.contentHtml = lyricToHtml(record.plainLyrics || "");
  return mapped;
}

function mapYoutubeItem(item = {}) {
  const videoId = clean(item.id?.videoId, 20);
  return {
    id: `youtube:${videoId}`,
    title: clean(item.snippet?.title, 200),
    channel: clean(item.snippet?.channelTitle, 150),
    platform: "YouTube",
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ""
  };
}

module.exports = { clean, normalize, escapeHtml, lyricToHtml, mapLrclibRecord, mapYoutubeItem };
