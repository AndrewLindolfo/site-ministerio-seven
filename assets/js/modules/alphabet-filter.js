function normalizeInitialLetter(value = "") {
  const first = normalizeSearchText(value).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

export function normalizeSearchText(value = "") {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeInternalHref(value = "") {
  try {
    const url = new URL(String(value || ""), window.location.origin);
    if (url.origin !== window.location.origin) return "#";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "#";
  }
}

export function filterByTerm(items = [], term = "") {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return items;
  return items.filter((item) => normalizeSearchText(item.titulo || item.title).includes(normalizedTerm));
}

export function renderAlphabetList(containerId, items = [], emptyMessage = "Nenhum item encontrado.") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();

  if (!items.length) {
    const message = document.createElement("p");
    message.textContent = emptyMessage;
    container.appendChild(message);
    return;
  }

  const grouped = items.reduce((groups, item) => {
    const letter = normalizeInitialLetter(item.titulo || item.title);
    (groups[letter] ||= []).push(item);
    return groups;
  }, {});

  const letters = Object.keys(grouped).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b, "pt-BR");
  });

  for (const letter of letters) {
    const section = document.createElement("section");
    section.className = "alphabet-group";
    const heading = document.createElement("h2");
    heading.className = "alphabet-letter";
    heading.textContent = letter;
    section.appendChild(heading);

    grouped[letter]
      .sort((a, b) => String(a.titulo || a.title || "").localeCompare(String(b.titulo || b.title || ""), "pt-BR"))
      .forEach((item) => {
        const row = document.createElement("div");
        row.className = "music-list-item";
        const link = document.createElement("a");
        link.href = normalizeInternalHref(item.href);
        link.textContent = item.titulo || item.title || "Sem título";
        row.appendChild(link);
        section.appendChild(row);
      });

    container.appendChild(section);
  }
}
