import { $$ } from "./utils.js";

export function setFooterYear() {
  $$("#footer-year").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}
