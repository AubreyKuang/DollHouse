/* Shared snapshot storage. The primary key remains readable by older builds.
   v2: older saves are migrated instead of rejected, and a few dated snapshots are kept for rewinding. */
const SaveManager = (() => {
  const version = 2;
  const SNAPSHOTS = 4;
  const observed = new Map();

  function getStorage() {
    try { return globalThis.localStorage; } catch { return null; }
  }

  function versionOf(raw) {
    try { return JSON.parse(raw)?.saveVersion ?? 1; } catch { return 1; }
  }

  function track(storage, key, refresh = false) {
    const raw = storage.getItem(key) ?? null;
    if (refresh || !observed.has(key)) observed.set(key, { raw, content: null, newer: versionOf(raw) > version });
    return { raw, entry: observed.get(key) };
  }

  function status(storage, key) {
    try {
      const { raw, entry } = track(storage, key);
      if (raw === entry.raw ? entry.newer : versionOf(raw) > version) return 'newer';
      return raw === entry.raw ? 'ready' : 'conflict';
    } catch {
      return 'unavailable';
    }
  }

  function contentOf(data) {
    return JSON.stringify({ ...data, saveVersion: version, savedAt: undefined });
  }
  function decode(raw, valid, migrate) {
    try {
      let data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      const from = data.saveVersion ?? 1;
      if (!Number.isInteger(from) || from < 1 || from > version) return null;
      if (from < version && migrate) data = migrate(data, from);
      if (!data || !valid(data)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function load(storage, key, valid, migrate, refresh = false) {
    try {
      const { raw, entry } = track(storage, key, refresh);
      if (raw === entry.raw ? entry.newer : versionOf(raw) > version) return null;
      return decode(raw, valid, migrate) || decode(storage.getItem(key + ':backup'), valid, migrate);
    } catch {
      return null;
    }
  }

  function save(storage, key, data, valid, { touch = false, alongside = [] } = {}) {
    const changed = [];
    try {
      const { raw: previous, entry } = track(storage, key);
      if (previous !== entry.raw || entry.newer) return false;
      const content = contentOf(data);
      const decoded = entry.content === null ? decode(previous, valid) : null;
      if (decoded) entry.content = contentOf(decoded);
      if (!touch && !alongside.length && content === entry.content) return true;
      const next = Number.isFinite(data.savedAt)
        ? content.slice(0, -1) + ',"savedAt":' + data.savedAt + '}'
        : content;
      if (!decode(next, valid)) return false;
      if (previous === next && !alongside.length) return true;

      const writes = [...alongside];
      if (entry.content !== null && content !== entry.content) writes.push([key + ':backup', previous]);
      for (const [name, value] of writes) {
        const old = storage.getItem(name) ?? null;
        if (old === value) continue;
        storage.setItem(name, value);
        changed.push([name, old, value]);
      }
      if ((storage.getItem(key) ?? null) !== previous) throw Error('Save changed in another tab');
      storage.setItem(key, next);
      observed.set(key, { raw: next, content, newer: false });
      return true;
    } catch {
      for (const [name, old, written] of changed.reverse()) {
        try {
          if (storage.getItem(name) !== written) continue;
          if (old === null) storage.removeItem(name);
          else storage.setItem(name, old);
        } catch { /* The primary save is still unchanged. */ }
      }
      return false;
    }
  }

  function readSnapshots(storage, key) {
    try {
      const list = JSON.parse(storage.getItem(key + ':snapshots') || '[]');
      return Array.isArray(list) ? list.filter(entry => entry && typeof entry.raw === 'string') : [];
    } catch {
      return [];
    }
  }
  // Keep one snapshot per label. Oldest go first when storage is full.
  function snapshot(storage, key, data, valid, meta = {}) {
    if (status(storage, key) !== 'ready') return false;
    const raw = JSON.stringify({ ...data, saveVersion: version });
    if (!decode(raw, valid)) return false;
    let list = readSnapshots(storage, key).filter(entry => entry.label !== meta.label);
    list.push({ ...meta, savedAt: Date.now(), raw });
    list = list.slice(-SNAPSHOTS);
    while (list.length) {
      try {
        storage.setItem(key + ':snapshots', JSON.stringify(list));
        return true;
      } catch {
        list.shift();
      }
    }
    return false;
  }
  function snapshots(storage, key) {
    return readSnapshots(storage, key).map(({ raw, ...meta }, index) => ({ ...meta, index }));
  }
  function restore(storage, key, index, valid, migrate, expected) {
    const list = readSnapshots(storage, key);
    const entry = expected
      ? list.find(item => item.label === expected.label && item.savedAt === expected.savedAt)
      : list[index];
    return entry ? decode(entry.raw, valid, migrate) : null;
  }

  return { getStorage, load, save, snapshot, snapshots, restore, decode, status, version };
})();
