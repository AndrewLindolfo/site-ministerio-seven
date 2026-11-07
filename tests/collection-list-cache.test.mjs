import test from "node:test";
import assert from "node:assert/strict";
import { createCollectionListCache } from "../assets/js/lib/collection-list-cache.js";

function installStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("deduplica carregamentos concorrentes e preserva listas vazias", async () => {
  installStorage();
  const cache = createCollectionListCache("teste", 60_000);
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return [];
  };
  const [first, second] = await Promise.all([
    cache.load("active", loader),
    cache.load("active", loader)
  ]);
  assert.deepEqual(first, []);
  assert.deepEqual(second, []);
  assert.equal(calls, 1);
  await cache.load("active", loader);
  assert.equal(calls, 1);
});

test("mantém caches público e administrativo separados", async () => {
  installStorage();
  const cache = createCollectionListCache("teste", 60_000);
  assert.deepEqual(await cache.load("active", async () => [{ id: "publico" }]), [{ id: "publico" }]);
  assert.deepEqual(await cache.load("all", async () => [{ id: "admin" }]), [{ id: "admin" }]);
  cache.clear();
  assert.deepEqual(await cache.load("active", async () => [{ id: "novo" }]), [{ id: "novo" }]);
});
