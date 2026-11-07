export function renderDestaques() {
  const grid = document.getElementById("destaques-grid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="destaque-box"><strong>#1</strong><p>Ele é Exaltado</p></div>
    <div class="destaque-box"><strong>#2</strong><p>Bondade de Deus</p></div>
    <div class="destaque-box"><strong>#3</strong><p>Santo Espírito</p></div>
    <div class="destaque-box"><strong>#4</strong><p>Tu És Fiel</p></div>
    <div class="destaque-box"><strong>#5</strong><p>Graça Sublime</p></div>
  `;
}
