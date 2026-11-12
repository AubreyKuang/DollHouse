/* Shared snapshot storage. The primary key remains readable by older builds. */
const SaveManager = (() => {
  const version = 1;
  function decode(raw, valid) {
    try {
      const data = JSON.parse(raw);
      if (!data || (data.saveVersion != null && data.saveVersion !== version) || !valid(data)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function load(storage, key, valid) {
    try {
      return decode(storage.getItem(key), valid) || decode(storage.getItem(key + ':backup'), valid);
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

  return { load, save };
})();
