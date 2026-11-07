export function createCollectionListCache(baseKey, ttlMs) {
  const memory = new Map();
  const pending = new Map();

  function storageKey(scope) {
    return `${baseKey}_${scope}`;
  }

  function read(scope) {
    const inMemory = memory.get(scope);
    if (inMemory && Date.now() - inMemory.savedAt <= ttlMs) return inMemory.items;
    try {
      const raw = localStorage.getItem(storageKey(scope));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.items) || Date.now() - Number(parsed.savedAt || 0) > ttlMs) return null;
      memory.set(scope, parsed);
      return parsed.items;
    } catch {
      return null;
    }
  }

  function write(scope, items) {
    const entry = { savedAt: Date.now(), items };
    memory.set(scope, entry);
    try {
      localStorage.setItem(storageKey(scope), JSON.stringify(entry));
    } catch {}
  }

  async function load(scope, loader, bypass = false) {
    if (!bypass) {
      const cached = read(scope);
      if (cached) return cached;
    }
    const requestKey = `${scope}:${bypass ? "fresh" : "cached"}`;
    if (!pending.has(requestKey)) {
      pending.set(requestKey, Promise.resolve()
        .then(loader)
        .then((items) => {
          write(scope, items);
          return items;
        })
        .finally(() => pending.delete(requestKey)));
    }
    return pending.get(requestKey);
  }

  function clear() {
    memory.clear();
    try {
      localStorage.removeItem(baseKey);
      localStorage.removeItem(storageKey("active"));
      localStorage.removeItem(storageKey("all"));
    } catch {}
  }

  return { load, clear };
}
