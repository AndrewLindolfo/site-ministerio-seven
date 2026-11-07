import { $, $$ } from "./utils.js";

export function setFooterYear() {
  $$("#footer-year").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

export function showLoading() {
  const loading = $("#global-loading");
  if (loading) loading.classList.remove("hidden");
}

export function hideLoading() {
  const loading = $("#global-loading");
  if (loading) loading.classList.add("hidden");
}

export function showToast(message = "Ação concluída.") {
  window.alert(message);
}

export function confirmAction(message = "Tem certeza?") {
  return window.confirm(message);
}
