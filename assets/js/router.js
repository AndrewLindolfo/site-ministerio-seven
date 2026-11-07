export function goTo(path) {
  window.location.href = path;
}

export function goToMusica(slug) {
  window.location.href = `./musica.html?slug=${encodeURIComponent(slug)}`;
}

export function goToCifra(slug) {
  window.location.href = `./cifra.html?slug=${encodeURIComponent(slug)}`;
}
