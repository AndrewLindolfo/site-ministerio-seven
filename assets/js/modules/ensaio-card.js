const linkSeguro = (href) => {
  if (!href) return '#';
  return String(href).replace(/"/g, '&quot;');
};

export function renderEnsaioCard(ensaio) {
  const musicas = Array.isArray(ensaio?.musicas) ? ensaio.musicas : [];
  if (!musicas.length) return '';
  const titulo = String(ensaio?.titulo || 'Ensaio').trim();
  const itens = musicas.map((musica, idx) => {
    const tituloMusica = String(musica?.titulo || 'Música').trim();
    const letraHref = musica?.slug ? `musica.html?slug=${encodeURIComponent(musica.slug)}` : '#';
    const cifraHref = musica?.cifraSlug ? `cifra.html?slug=${encodeURIComponent(musica.cifraSlug)}${musica.instrumento ? `&instrumento=${encodeURIComponent(musica.instrumento)}` : ''}` : '';
    return `<li class="programacao-card__item"><span class="programacao-card__song-index">${idx+1}.</span><span class="programacao-card__song-title">${tituloMusica}</span><span class="programacao-card__actions"><a class="programacao-card__action" href="${linkSeguro(letraHref)}">Vocal</a>${cifraHref ? `<a class="programacao-card__action" href="${linkSeguro(cifraHref)}">Banda</a>` : `<span class="programacao-card__action is-disabled" aria-disabled="true">Em breve</span>`}</span></li>`;
  }).join('');
  return `<article class="programacao-card home-ensaio-card"><div class="programacao-card__header"><div><p class="programacao-card__eyebrow">Ensaio</p><h3 class="programacao-card__title">${titulo}</h3></div></div><ol class="programacao-card__list">${itens}</ol></article>`;
}
