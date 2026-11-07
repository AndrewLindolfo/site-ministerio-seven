export function incrementView(pageType, slug = "") {
  try {
    const key = `seven_views_${pageType}_${slug}`;
    const current = Number(localStorage.getItem(key) || "0");
    localStorage.setItem(key, String(current + 1));
  } catch (error) {
    console.warn("Não foi possível salvar estatística local.", error);
  }
}

export function getLocalViews(pageType, slug = "") {
  try {
    return Number(localStorage.getItem(`seven_views_${pageType}_${slug}`) || "0");
  } catch {
    return 0;
  }
}
