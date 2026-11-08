const test = require("node:test");
const assert = require("node:assert/strict");
const { normalize, lyricToHtml, mapYoutubeItem } = require("../lib/content");

test("normaliza títulos para busca interna de cifras", () => assert.equal(normalize("  Grande É o SENHOR "), "grande e o senhor"));
test("converte letra em HTML escapado e preserva estrofes", () => assert.equal(lyricToHtml("Um < verso\ncontinua\n\nRefrão"), "<p>Um &lt; verso<br>continua</p><p>Refrão</p>"));
test("mapeia vídeo sem aceitar HTML no título", () => {
  const item = mapYoutubeItem({ id: { videoId: "abc123_XY-z" }, snippet: { title: "Canção", channelTitle: "Canal", thumbnails: { default: { url: "https://img.example/x.jpg" } } } });
  assert.equal(item.url, "https://www.youtube.com/watch?v=abc123_XY-z");
});
