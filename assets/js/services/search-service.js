import { listMusicas } from "./musicas-service.js";
import { listCifras } from "./cifras-service.js";
import { listDownloads } from "./downloads-service.js";
import { listAlbuns } from "./albuns-service.js";

export async function searchSiteContent(term = "") {
  const query = String(term || "").trim().toLowerCase();
  if (!query) return [];

  const [musicas, cifras, downloads, albuns] = await Promise.all([
    listMusicas(true),
    listCifras(true),
    listDownloads(true),
    listAlbuns(true)
  ]);

  const inText = (text = "") => text.toLowerCase().includes(query);

  return [
    ...musicas.filter((i) => inText(i.title) || inText(i.subtitle)).map((i) => ({ type: "Música", label: i.title, href: `./musica.html?slug=${i.slug}` })),
    ...cifras.filter((i) => inText(i.title) || inText(i.subtitle)).map((i) => ({ type: "Cifra", label: i.title, href: `./cifra.html?slug=${i.slug}` })),
    ...downloads.filter((i) => inText(i.title) || inText(i.description)).map((i) => ({ type: "Download", label: i.title, href: "./downloads.html" })),
    ...albuns.filter((i) => inText(i.title) || inText(i.description)).map((i) => ({ type: "Álbum", label: i.title, href: "./fotos.html" })),
  ];
}
