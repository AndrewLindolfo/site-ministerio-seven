import test from "node:test";
import assert from "node:assert/strict";
import {
  formatHideAfterDuration,
  getProgramacaoHideAt,
  isProgramacaoVisibleAt,
  parseHideAfterMinutes,
  serializeHideAfterDuration,
  splitHideAfterDuration
} from "../assets/js/modules/programacao-schedule.js";

test("calcula ocultação como duração após o início", () => {
  const twoHours = getProgramacaoHideAt({ date: "2026-11-14", time: "10:00", hideAfter: "duration:120" });
  const fourHours = getProgramacaoHideAt({ date: "2026-11-14", time: "10:00", hideAfter: "duration:240" });

  assert.equal(twoHours.getHours(), 12);
  assert.equal(twoHours.getMinutes(), 0);
  assert.equal(fourHours.getHours(), 14);
  assert.equal(fourHours.getMinutes(), 0);
});

test("aceita combinação de horas e minutos", () => {
  const value = serializeHideAfterDuration("2", "30");
  assert.equal(value, "duration:150");
  assert.equal(parseHideAfterMinutes(value), 150);
  assert.deepEqual(splitHideAfterDuration(value), { hours: 2, minutes: 30 });
  assert.equal(formatHideAfterDuration(value), "2h 30min");
});

test("mantém compatibilidade com valores HH:MM já salvos", () => {
  assert.equal(parseHideAfterMinutes("02:15"), 135);
  const hideAt = getProgramacaoHideAt({ date: "2026-11-14", time: "10:00", hideAfter: "02:15" });
  assert.equal(hideAt.getHours(), 12);
  assert.equal(hideAt.getMinutes(), 15);
});

test("sem duração, oculta no horário de início", () => {
  const item = { date: "2026-11-14", time: "10:00", hideAfter: "" };
  const start = new Date(2026, 10, 14, 10, 0, 0, 0).getTime();
  assert.equal(isProgramacaoVisibleAt(item, start - 1), true);
  assert.equal(isProgramacaoVisibleAt(item, start + 1), false);
});

test("permanece visível entre o início e o fim da duração", () => {
  const item = { date: "2026-11-14", time: "10:00", hideAfter: "duration:120" };
  assert.equal(isProgramacaoVisibleAt(item, new Date(2026, 10, 14, 11, 59).getTime()), true);
  assert.equal(isProgramacaoVisibleAt(item, new Date(2026, 10, 14, 12, 1).getTime()), false);
});
