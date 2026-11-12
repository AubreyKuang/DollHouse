/* Shared snapshot storage. The primary key remains readable by older builds.
   v2: older saves are migrated instead of rejected, and a few dated snapshots are kept for rewinding. */
const SaveManager = (() => {
  const version = 2;
  const SNAPSHOTS = 4;
  function decode(raw, valid, migrate) {
    try {
      let data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      const from = data.saveVersion ?? 1;
      if (from > version) return null;
      if (from < version && migrate) data = migrate(data, from);
      if (!data || !valid(data)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function load(storage, key, valid, migrate) {
    try {
      return decode(storage.getItem(key), valid, migrate) || decode(storage.getItem(key + ':backup'), valid, migrate);
    } catch {
      return null;
    }
  }

  function save(storage, key, data, valid) {
    try {
      const next = JSON.stringify({ ...data, saveVersion: version });
      if (!decode(next, valid)) return false;
      const previous = storage.getItem(key);
      if (previous === next) return true;
      if (decode(previous, valid)) storage.setItem(key + ':backup', previous);
      storage.setItem(key, next);
      return true;
    } catch {
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
  function restore(storage, key, index, valid, migrate) {
    const entry = readSnapshots(storage, key)[index];
    return entry ? decode(entry.raw, valid, migrate) : null;
  }

  return { load, save, snapshot, snapshots, restore, version };
})();
