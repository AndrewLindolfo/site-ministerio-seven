import test from "node:test";
import assert from "node:assert/strict";
import { encodeFirestoreValue, decodeFirestoreValue } from "../assets/js/lib/firestore-backup-codec.js";

test("preserva timestamps do Firestore no backup e na restauração", () => {
  const timestamp = { seconds: 1_700_000_000, nanoseconds: 123_000_000, toDate() {} };
  const encoded = encodeFirestoreValue({ createdAt: timestamp, nested: [timestamp] });
  const decoded = decodeFirestoreValue(encoded, (seconds, nanoseconds) => ({ kind: "timestamp", seconds, nanoseconds }));
  assert.deepEqual(decoded.createdAt, { kind: "timestamp", seconds: 1_700_000_000, nanoseconds: 123_000_000 });
  assert.deepEqual(decoded.nested[0], decoded.createdAt);
});

test("não converte objetos comuns que apenas imitam parcialmente o marcador", () => {
  const ordinary = { __sevenFirestoreType: "timestamp", seconds: 10, nanoseconds: 20, label: "não converter" };
  const decoded = decodeFirestoreValue(ordinary, () => { throw new Error("não deveria converter"); });
  assert.equal(decoded.label, "não converter");
});

test("restaura timestamps de backups antigos da versão 2", () => {
  const decoded = decodeFirestoreValue(
    { seconds: 1_700_000_000, nanoseconds: 456_000_000 },
    (seconds, nanoseconds) => ({ kind: "legacy-timestamp", seconds, nanoseconds })
  );
  assert.deepEqual(decoded, {
    kind: "legacy-timestamp",
    seconds: 1_700_000_000,
    nanoseconds: 456_000_000
  });
});
