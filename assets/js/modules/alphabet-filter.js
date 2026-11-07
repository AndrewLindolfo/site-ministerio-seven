function normalizeInitialLetter(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  const first = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

export function filterByTerm(items = [], term = "") {
  const normalizedTerm = String(term || "").trim().toLowerCase();
  if (!normalizedTerm) return items;
  return items.filter((item) =>
    String(item.titulo || item.title || "")
      .toLowerCase()
      .includes(normalizedTerm)
  );
}

export function renderAlphabetList(containerId, items = [], emptyMessage = "Nenhum item encontrado.") {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<p>${emptyMessage}</p>`;
    return;
  }

  const grouped = items.reduce((acc, item) => {
    const letter = normalizeInitialLetter(item.titulo || item.title || "");
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(item);
    return acc;
  }, {});

  const letters = Object.keys(grouped).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b, "pt-BR");
  });

  container.innerHTML = letters.map((letter) => `
    <section class="alphabet-group">
      <h2 class="alphabet-letter">${letter}</h2>
      ${grouped[letter]
        .sort((a, b) =>
          String(a.titulo || a.title || "").localeCompare(String(b.titulo || b.title || ""), "pt-BR")
        )
        .map((item) => `
          <div class="music-list-item">
            <a href="${item.href}">${item.titulo || item.title || ""}</a>
          </div>
        `).join("")}
    </section>
  `).join("");
}
