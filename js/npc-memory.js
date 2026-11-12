// Deterministic NPC memory. Store the ledger with the game's save data.
const NPCMemory = (() => {
  const SHORT_LIMIT = 32;
  const LONG_LIMIT = 50;
  const WEIGHTS = { emotion: .35, relationship: .2, impact: .25, novelty: .1, goal: .1 };
  const ledgers = new WeakMap();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const empty = () => ({ short: [], long: [], life: [] });

  function ledger(world) {
    return world.npcMemory ||= { version: 1, sequence: 0, events: {}, people: {} };
  }

  function index(data, person) {
    if (!ledgers.has(data)) ledgers.set(data, new Map());
    const people = ledgers.get(data);
    if (!people.has(person)) {
      const bySubject = new Map();
      const memory = Object.hasOwn(data.people, person) ? data.people[person] : empty();
      for (const entry of [...memory.short, ...memory.long]) {
        if (!bySubject.has(entry.subject)) bySubject.set(entry.subject, []);
        bySubject.get(entry.subject).push(entry);
      }
      people.set(person, bySubject);
    }
    return people.get(person);
  }

  function promote(memory, entry) {
    memory.long.push(entry);
    memory.long.sort((a, b) => b.importance - a.importance || b.sequence - a.sequence);
    memory.long.length = Math.min(LONG_LIMIT, memory.long.length);
    memory.life = memory.long.slice(0, 8).map(({ sources, interpretation }) => ({
      sources, interpretation
    }));
  }

  function remember(data, event, view) {
    const person = String(view.person);
    if (!Object.hasOwn(data.people, person)) {
      Object.defineProperty(data.people, person, { value: empty(), enumerable: true });
    }
    const memory = data.people[person];
    const subject = String(view.subject);
    const related = index(data, person).get(subject) || [];
    const confidence = clamp(view.confidence ?? 1, 0, 1);
    const signals = {
      emotion: Math.abs(view.emotion) * 100,
      relationship: view.relationship ?? 50,
      impact: view.impact ?? 50,
      novelty: related.some(entry => entry.type === event.type) ? 15 : 90,
      goal: view.goal ?? 50
    };
    const importance = Math.round(Object.entries(WEIGHTS).reduce(
      (total, [key, weight]) => total + clamp(signals[key], 0, 100) * weight, 0));
    if (importance < 25) return;
    const entry = {
      sources: [event.id], sequence: event.sequence, time: event.time,
      type: event.type, subject, interpretation: view.interpretation,
      emotion: view.emotion, confidence, importance, channel: view.channel || 'participant'
    };
    if (importance >= 72) {
      promote(memory, entry);
    } else {
      memory.short.push(entry);
      const similar = memory.short.filter(item =>
        item.subject === subject && item.type === event.type &&
        Math.sign(item.emotion) === Math.sign(entry.emotion));
      if (similar.length >= 3) {
        const merged = {
          ...entry, sources: similar.flatMap(item => item.sources),
          importance: Math.max(60, ...similar.map(item => item.importance)),
          emotion: similar.reduce((sum, item) => sum + item.emotion, 0) / similar.length,
          confidence: Math.min(...similar.map(item => item.confidence)),
          interpretation: entry.interpretation,
          occurrences: similar.length
        };
        memory.short = memory.short.filter(item => !similar.includes(item));
        promote(memory, merged);
      }
      while (memory.short.length > SHORT_LIMIT) {
        memory.short.sort((a, b) => a.importance - b.importance || a.sequence - b.sequence);
        const oldest = memory.short.shift();
        if (oldest.importance >= 62) promote(memory, oldest);
      }
    }
    ledgers.get(data).delete(person);
  }

  function record(world, facts, views) {
    const data = ledger(world);
    const sequence = facts.sequence ?? data.sequence + 1;
    // Events arrive in order. The watermark also rejects duplicates after compaction.
    if (sequence <= data.sequence) return null;
    if (sequence !== data.sequence + 1) throw new Error('NPC memory event sequence gap');
    const event = { ...facts, id: `event-${sequence}`, sequence };
    data.sequence = sequence;
    data.events[event.id] = event;
    const observers = new Set();
    for (const view of views) {
      const person = String(view.person);
      if (observers.has(person)) continue;
      observers.add(person);
      remember(data, event, view);
    }
    // Keep all retained memory sources and the most recent objective events.
    if (sequence % 64 === 0) {
      const retained = new Set(Object.values(data.people).flatMap(memory =>
        [...memory.short, ...memory.long].flatMap(entry => entry.sources)));
      for (const [id, source] of Object.entries(data.events)) {
        if (source.sequence <= sequence - 64 && !retained.has(id)) delete data.events[id];
      }
    }
    return event;
  }

  function influence(world, person, subject) {
    if (!world.npcMemory) return 0;
    const entries = index(world.npcMemory, String(person)).get(String(subject)) || [];
    return clamp(entries.reduce((total, entry) =>
      total + entry.emotion * entry.confidence * entry.importance / 100 *
        (entry.importance >= 60 ? 2 : 1), 0), -4, 4);
  }

  function recall(world, person) {
    const memory = world.npcMemory?.people[String(person)];
    return memory ? [...memory.short, ...memory.long].sort((a, b) => b.sequence - a.sequence) : [];
  }

  return { record, influence, recall };
})();
