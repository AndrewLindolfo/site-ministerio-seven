import test from "node:test";
import assert from "node:assert/strict";
import { getYoutubeVideoId, normalizeYoutubeEmbedUrl } from "../assets/js/lib/youtube-url.js";

test("normaliza formatos HTTPS válidos do YouTube", () => {
  const id = "dQw4w9WgXcQ";
  assert.equal(getYoutubeVideoId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(getYoutubeVideoId(`https://youtu.be/${id}`), id);
  assert.equal(getYoutubeVideoId(`https://www.youtube.com/shorts/${id}`), id);
  assert.equal(normalizeYoutubeEmbedUrl(`https://youtu.be/${id}`), `https://www.youtube-nocookie.com/embed/${id}`);
});

test("rejeita hosts parecidos, HTTP e IDs inválidos", () => {
  assert.equal(getYoutubeVideoId("https://evilyoutube.com/watch?v=dQw4w9WgXcQ"), "");
  assert.equal(getYoutubeVideoId("http://youtube.com/watch?v=dQw4w9WgXcQ"), "");
  assert.equal(getYoutubeVideoId("https://youtube.com/watch?v=curto"), "");
  assert.equal(getYoutubeVideoId("javascript:alert(1)"), "");
});
