/* Where the house is saved.
   In-app WebViews (the TapTap H5 host among them) may lack localStorage, or keep it
   and then refuse every write. Each store is trusted only after a probe value is
   written and read back unchanged:

     tap.setStorageSync → localStorage → this visit only

   The house is loaded synchronously at startup and saved every few seconds, so the
   store must answer synchronously; IndexedDB is not used. Every store looks like
   localStorage (getItem / setItem / removeItem), which is what SaveManager expects.
   A browser keeps the real localStorage object, so a second tab still sees the save
   change underneath it. */
const HouseStorage = (() => {
  const PROBE = 'dollhouse-probe', MIGRATED = 'dollhouse-migrated';
  // TapTap allows 1MB per key and 10MB in all. 200k UTF-16 units stay under 1MB in UTF-8.
  const CHUNK = 200000;
  // Everything the game keeps, in both the normal and the test house.
  const KEYS = ['pixel-dollhouse-v1', 'pixel-dollhouse-test-v1'].flatMap(key =>
    ['', ':backup', ':snapshots', ':before-import', ':before-import:snapshots'].map(suffix => key + suffix))
    .concat(['house-offline', 'house-test-offline', 'house-paper-auto', 'house-test-paper-auto']);
  const quiet = fn => { try { return fn(); } catch { return null; } };
  const token = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function tapKV() {
    const tap = globalThis.tap;
    if (typeof tap?.setStorageSync !== 'function' || typeof tap.getStorageSync !== 'function') return null;
    return {
      get(key) { const value = tap.getStorageSync(key); return value === '' || value === undefined || value === null ? null : String(value); },
      set(key, value) { tap.setStorageSync(key, value); },
      remove(key) { if (typeof tap.removeStorageSync === 'function') tap.removeStorageSync(key); else tap.setStorageSync(key, ''); },
    };
  }
  function works(kv) {
    if (!kv) return false;
    try {
      const value = '屋' + token();
      kv.set(PROBE, value); const back = kv.get(PROBE); kv.remove(PROBE);
      return back === value;
    } catch { return false; }
  }

  // Long values span several keys. A new copy's chunks land before its manifest, so a
  // torn write keeps the old copy; a failed write throws, as a full localStorage would.
  function chunkedStorage(kv) {
    const cache = new Map();
    const manifest = head => {
      const meta = quiet(() => JSON.parse(head));
      return meta && typeof meta.chunks === 'string' && Number.isInteger(meta.n) ? meta : null;
    };
    const drop = (key, meta) => { for (let i = 0; i < meta.n; i++) quiet(() => kv.remove(key + '#' + meta.chunks + ':' + i)); };
    function read(key) {
      const head = kv.get(key);
      if (head === null) return null;
      const meta = manifest(head);
      if (!meta) return head;
      let value = '';
      for (let i = 0; i < meta.n; i++) {
        const part = kv.get(key + '#' + meta.chunks + ':' + i);
        if (part === null) return null; // A lost chunk: SaveManager falls back to :backup.
        value += part;
      }
      return value;
    }
    function pieces(value) {
      const out = [];
      for (let start = 0; start < value.length;) {
        let end = Math.min(value.length, start + CHUNK);
        // Never split a surrogate pair (emoji in the log): a lone half would not survive UTF-8.
        const code = value.charCodeAt(end - 1);
        if (end < value.length && code >= 0xd800 && code <= 0xdbff) end--;
        out.push(value.slice(start, end)); start = end;
      }
      return out;
    }
    return {
      getItem(key) {
        key = String(key);
        if (!cache.has(key)) cache.set(key, read(key));
        return cache.get(key);
      },
      setItem(key, value) {
        key = String(key); value = String(value);
        if (cache.has(key) && cache.get(key) === value) return;
        const prior = manifest(kv.get(key)), meta = { chunks: token(), n: 0 }, parts = pieces(value);
        try {
          for (const part of parts) kv.set(key + '#' + meta.chunks + ':' + meta.n++, part);
          kv.set(key, JSON.stringify(meta));
        } catch (error) {
          drop(key, meta);
          throw error;
        }
        if (prior) drop(key, prior);
        cache.set(key, value);
      },
      removeItem(key) {
        key = String(key);
        const prior = manifest(kv.get(key));
        kv.remove(key);
        if (prior) drop(key, prior);
        cache.set(key, null);
      },
    };
  }

  function localStore() {
    const ls = quiet(() => globalThis.localStorage);
    if (!ls || typeof ls.setItem !== 'function' || typeof ls.getItem !== 'function') return null;
    const kv = { get: key => ls.getItem(key) ?? null, set: (key, value) => { ls.setItem(key, value); },
      remove: key => { if (typeof ls.removeItem === 'function') ls.removeItem(key); } };
    return works(kv) ? ls : null;
  }
  function memoryStore() {
    const data = new Map();
    return {
      getItem: key => data.has(String(key)) ? data.get(String(key)) : null,
      setItem: (key, value) => { data.set(String(key), String(value)); },
      removeItem: key => { data.delete(String(key)); },
    };
  }

  function pick() {
    const tap = quiet(tapKV);
    if (works(tap)) {
      const storage = chunkedStorage(tap);
      // A house a browser visit left behind comes along once.
      if (quiet(() => tap.get(MIGRATED)) === null) {
        const local = quiet(localStore);
        for (const key of KEYS) {
          const old = local && quiet(() => local.getItem(key));
          if (old && storage.getItem(key) === null) quiet(() => storage.setItem(key, old));
        }
        quiet(() => tap.set(MIGRATED, '1'));
      }
      return { kind: 'tap', storage };
    }
    const local = quiet(localStore);
    if (local) return { kind: 'local', storage: local };
    return { kind: 'memory', storage: memoryStore() };
  }

  const chosen = pick();
  if (chosen.kind === 'memory') quiet(() => console.warn('No storage reads back: the house is kept for this visit only'));
  return { kind: chosen.kind, storage: chosen.storage, CHUNK };
})();
