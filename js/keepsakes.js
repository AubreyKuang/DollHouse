// Furniture keeps its identity when moved. These records contain only saveable IDs.
function restoreKeepsakes(saved) {
  return {
    nextFurniture: saved?.nextFurniture || 1,
    corners: saved?.corners || {},
    pieces: saved?.pieces || [],
    traditions: saved?.traditions || {},
    project: saved?.project || null,
    readingGreetings: saved?.readingGreetings || null,
    bookRecommendations: Object.assign(Object.create(null), saved?.bookRecommendations),
  };
}

const KEEPSAKE_FINISHES = { rose: ['莓果粉', '#cf8e9e'], sage: ['鼠尾草绿', '#91ad93'], honey: ['蜂蜜木色', '#d5aa79'] };
const cornerDistance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const cornerRoom = f => roomOf({ tx: f.x, ty: f.y < 0 ? FLOOR_SPLIT : Math.max(f.y, WALL_ROWS) });
const readingRoomNames = { bed: '卧室', living: '客厅', bathroom: '浴室', upperBedroom: '二楼卧室', study: '书房' };
const quietStudy = f => studyQuietActive() && cornerRoom(f) === 'study';
const isWindowChair = f => f.id === 'chair' && G.furniture.some(w => w.id === 'window' &&
  cornerRoom(w) === cornerRoom(f) && Math.abs(w.x + 1 - f.x) <= 3);
const quietReading = f => quietStudy(f) || (f.soloReading === true && isWindowChair(f));

function cornerKind(f) {
  if (G.keepsakes.corners[f.key]?.kind) return G.keepsakes.corners[f.key].kind;
  if (f.id === 'teaTray') return 'tea';
  if (f.id === 'piano') return 'music';
  if (f.id === 'shelf') return 'read';
  if (isWindowChair(f)) return 'read';
  return null;
}

const CORNER_NAMES = { tea: '茶角', music: '练琴角', read: '阅读角' };
const cornerOwner = f => G.keepsakes.corners[f.key]?.owner;
const cornerRegular = (f, d) => G.keepsakes.corners[f.key]?.regulars?.includes(d.pid);

function greetPassingReader(walker, from) {
  const activity = walker.act;
  const leisureWalk = activity?.type === 'wander' || (activity?.furn &&
    !['sleep', 'toilet'].includes(activity.type) && !CARE_ACTIONS.includes(activity.type));
  const needs = walker.needs;
  if (walker.guest || !leisureWalk || needs.bladder < 20 || needs.hunger < 25 || needs.energy < 20) return;
  const greetings = G.keepsakes.readingGreetings;
  const greeted = greetings?.month === G.day && Array.isArray(greetings.people) ? greetings.people : [];
  if (greeted.includes(walker.pid)) return;
  const to = { x: walker.tx, y: walker.ty };
  if (cornerDistance(from, to) !== 1) return;
  const reader = G.dolls.find(d => {
    const chair = d.act?.furn;
    return d !== walker && !d.guest && d.state === 'act' && d.act.type === 'read' &&
      chair?.id === 'chair' && (!quietReading(chair) ||
        (chair.readingNotes && !quietStudy(chair) && !d.act.readingNote)) &&
      d.act.t > 1 && !greeted.includes(d.pid) &&
      roomOf(walker) === cornerRoom(chair) && cornerDistance(from, chair) <= 2 &&
      cornerDistance(to, chair) <= 2 && canSee(walker, d) && canDisturb(walker, d) &&
      !tensionBetween(walker, d) && (G.rel[relKey(walker, d)]?.f || 0) >= 25;
  });
  if (!reader) return;
  // A passerby asks once per month. A reader who declines can be approached by someone else.
  const people = [...greeted, walker.pid];
  G.keepsakes.readingGreetings = { month: G.day, people };
  if (quietReading(reader.act.furn)) {
    reader.act.readingNote = walker.pid;
    say(walker, '读完再聊？我就在附近。');
    return;
  }
  say(walker, '在看什么书？');
  if (isE(reader) || reader.needs.social < 85) {
    people.push(reader.pid);
    say(reader, '刚读到有意思的地方。');
    for (const d of [walker, reader]) d.needs.social = Math.min(100, d.needs.social + 6);
    addLog(`📖 ${walker.name}路过窗边，和${reader.name}聊了几句书。`);
    return;
  }
  if (!reader.act.declinedGreeting) {
    reader.act.declinedGreeting = true;
    reader.act.readingPause = 1;
    say(reader, '等我读完这一页。');
    addLog(`📖 ${reader.name}请路过的${walker.name}等一等，接着看书。`);
    return;
  }
  people.push(reader.pid);
  say(reader, '我想找个安静的位置。');
  addLog(`📖 ${reader.name}被路过的${walker.name}打断了，合上了书。`);
  const chair = reader.act.furn;
  endAct(reader);
  for (const other of G.furniture) {
    if (other === chair || !isWindowChair(other) || cornerRoom(other) === cornerRoom(chair)) continue;
    if (startAct(reader, { furn: other, type: 'read' })) break;
  }
}

function canDiscussReading(reader, other, chair) {
  return other.state === 'idle' && roomOf(other) === cornerRoom(chair) &&
    cornerDistance({ x: other.tx, y: other.ty }, chair) <= 3 && canSee(reader, other);
}

function hasTimeToDiscussReading(d) {
  const departure = leaveAbs(d), now = absNow();
  return (departure == null || now < departure - 10 || now >= departure + 180) &&
    d.needs.bladder >= 20 && d.needs.hunger >= 25 && d.needs.energy >= 20;
}

function finishReadingNote(reader, activity) {
  const chair = activity.furn;
  if (finishBookRecommendation(reader, chair)) return;
  if (!activity.readingNote || !chair.readingNotes || !quietReading(chair) || quietStudy(chair)) return;
  const writer = communityDoll(activity.readingNote);
  if (!writer || writer.guest || tensionBetween(reader, writer)) return;
  if (!canDiscussReading(reader, writer, chair)) {
    if (bookRecommendation(chair)) return;
    G.keepsakes.bookRecommendations[chair.key] = { from: reader.pid, to: writer.pid, until: G.day + 1 };
    say(reader, '把这一段推荐给你，下次来读吧。');
    addLog(`📖 ${reader.name}在窗边给${writer.name}留了一条荐书便条。`);
    return;
  }
  if (![reader, writer].every(hasTimeToDiscussReading)) return;
  for (const d of [reader, writer]) d.needs.social = Math.min(100, d.needs.social + 6);
  say(reader, '读完啦。刚好想跟你说说这一段。');
  say(writer, '我还在呢，慢慢说。');
  addLog(`📖 ${reader.name}读完了书，和留下便条的${writer.name}聊了几句。`);
}

function bookRecommendation(chair) {
  const note = G.keepsakes.bookRecommendations[chair.key];
  if (!Number.isInteger(note?.until) || note.until < G.day || note.from === note.to ||
      !communityDoll(note.from) || !communityDoll(note.to)) return null;
  return note;
}

const BOOK_SEAT_MINUTES = 60;
const BOOK_PUBLIC_READERS = 2;
const BOOK_PUBLIC_FUN = 4;
const BOOK_PICKED_FUN = 6;
const BOOK_PRIVATE_FUN = 8;
const BOOK_QUESTION_SOCIAL = 6, BOOK_QUESTION_FUN_COST = 2;
const BOOK_FOLLOWUP_SOCIAL = 4;
const BOOK_QUESTION = '这一段让你想起了什么？';
const BOOK_ANSWER = '想起了下雨时，我们也常在窗边坐一会儿。';
function publicBookReaders(note) {
  return Array.isArray(note?.readBy) ? note.readBy : null;
}

function canReadSharedBook(note, readers, reader) {
  return !reader.guest && reader.pid !== note.from && !readers.includes(reader.pid);
}

function pickedBookReader(note) {
  const readers = publicBookReaders(note);
  const reader = note?.nextReader && communityDoll(note.nextReader);
  return readers?.length === 1 && reader && canReadSharedBook(note, readers, reader) ? reader : null;
}

function pickNextBookReader(chair, pid) {
  if (!G.furniture.includes(chair) || !firstPublicBookReader(chair)) return false;
  const notes = G.keepsakes.bookRecommendations, note = notes[chair.key];
  const { nextReader, ...openNote } = note;
  const updated = pid ? { ...openNote, nextReader: pid } : openNote;
  if (pid && !pickedBookReader(updated)) return false;
  notes[chair.key] = updated;
  if (save()) return true;
  notes[chair.key] = note;
  return false;
}

function firstPublicBookReader(chair) {
  const readers = publicBookReaders(bookRecommendation(chair));
  return chair.readingNotes && isWindowChair(chair) && !chair.users.length && readers?.length === 1
    ? communityDoll(readers[0]) : null;
}

function keepSharedBookForPaper(chair) {
  if (!G.furniture.includes(chair) || !firstPublicBookReader(chair)) return false;
  const notes = G.keepsakes.bookRecommendations, note = notes[chair.key];
  notes[chair.key] = { ...note, keepForPaper: !note.keepForPaper };
  if (save()) return true;
  notes[chair.key] = note;
  return false;
}

function toggleBookQuestion(chair) {
  if (!G.furniture.includes(chair) || !firstPublicBookReader(chair)) return false;
  const notes = G.keepsakes.bookRecommendations, note = notes[chair.key];
  notes[chair.key] = { ...note, question: !note.question };
  if (save()) return true;
  notes[chair.key] = note;
  return false;
}

function bookPaperReaders(chair) {
  if (!chair.readingNotes || !isWindowChair(chair) || chair.users.length) return [];
  const note = bookRecommendation(chair), readers = publicBookReaders(note);
  if (!readers?.length || readers.length > BOOK_PUBLIC_READERS ||
      (readers.length === BOOK_PUBLIC_READERS && !note.keepForPaper)) return [];
  return readers.map(communityDoll).filter(d => d && !d.guest);
}

function bookFollowupReaders(chair) {
  const note = bookRecommendation(chair);
  if (!note?.question || note.followup || publicBookReaders(note)?.length !== BOOK_PUBLIC_READERS) return [];
  return bookPaperReaders(chair);
}

function canTalkAboutBook(chair, readers) {
  const [first, second] = readers;
  return readers.length === BOOK_PUBLIC_READERS && !quietStudy(chair) &&
    canDiscussReading(first, second, chair) && canDiscussReading(second, first, chair) &&
    readers.every(hasTimeToDiscussReading) && !tensionBetween(first, second);
}

function talkAboutBook(chair) {
  if (!G.furniture.includes(chair)) return false;
  const readers = bookFollowupReaders(chair);
  if (!canTalkAboutBook(chair, readers)) return false;
  const [first, second] = readers, note = bookRecommendation(chair);
  const social = readers.map(d => d.needs.social), log = G.log.slice();
  const room = cornerRoom(chair);
  note.followup = true;
  note.followupRoom = room;
  for (const d of readers) d.needs.social = Math.min(100, d.needs.social + BOOK_FOLLOWUP_SOCIAL);
  addLog(`📖 ${first.name}和${second.name}在窗边聊起了便条上的答复。`);
  if (!save()) {
    delete note.followup;
    delete note.followupRoom;
    readers.forEach((d, i) => { d.needs.social = social[i]; });
    G.log = log;
    HOOK.logged();
    return false;
  }
  say(first, '原来你也想到了窗边的雨。');
  say(second, '下次下雨，再一起坐一会儿吧。');
  return true;
}

function replyToBookRecommendation(chair) {
  const reader = firstPublicBookReader(chair);
  if (!reader || !G.furniture.includes(chair)) return false;
  const notes = G.keepsakes.bookRecommendations, note = notes[chair.key];
  notes[chair.key] = { from: reader.pid, to: note.from, until: note.until, reply: true };
  if (save()) return true;
  notes[chair.key] = note;
  return false;
}

function bookReadingRoom(note, reader) {
  const room = note.readRooms?.[reader.pid];
  return Object.hasOwn(readingRoomNames, room) ? readingRoomNames[room] : '';
}

function bookPaperText(author, readers, note) {
  const rooms = readers.map(d => bookReadingRoom(note, d));
  if (rooms.length === 2 && rooms.every(Boolean) && rooms[0] !== rooms[1]) {
    return `${author.name}推荐的书摘从${rooms[0]}传到${rooms[1]}，${readers.map(d => d.name).join('和')}先后读完`;
  }
  return `${readers.map(d => d.name).join('和')}读完了${author.name}推荐的书摘`;
}

function submitBookToPaper(chair, replacing, includeConversation = true, nextIssue = false) {
  const readers = bookPaperReaders(chair);
  const month = G.day + (nextIssue ? 1 : 0);
  if (!readers.length || (nextIssue && readers.length !== BOOK_PUBLIC_READERS) ||
      !G.furniture.includes(chair) || bookPaperDraft(month) !== replacing) return false;
  const notes = G.keepsakes.bookRecommendations, note = notes[chair.key];
  const author = communityDoll(note.from);
  const people = [author, ...readers];
  const moment = {
    ids: people.map(d => d.pid), month,
    people: people.map(d => ({ name: d.name, look: { ...d.look } })),
    steps: [`${author.name}把读过的书留在窗边。`, ...readers.map(d => {
      const room = bookReadingRoom(note, d);
      return `${d.name}${room ? '在' + room : ''}读完了这段书摘。`;
    }), ...(includeConversation && note.question && readers.length === BOOK_PUBLIC_READERS
      ? [`${readers[0].name}问：「${BOOK_QUESTION}」`, `${readers[1].name}答：「${BOOK_ANSWER}」`] : []),
    ...(includeConversation && note.followup && readers.length === BOOK_PUBLIC_READERS
      ? [`${readers[0].name}和${readers[1].name}在${Object.hasOwn(readingRoomNames, note.followupRoom) ? readingRoomNames[note.followupRoom] + '的' : ''}窗边聊起了这句答复。`] : []),
    nextIssue ? '你收起了便条，把书摘留给了下一期月报。' : '你收起了便条，把书摘留给了月报。'],
    result: [BOOK_PAPER_LABEL, '📖', `${bookPaperText(author, readers, note)}，这段阅读被收进了月报。`, 77],
  };
  const previous = G.paperMoments;
  G.paperMoments = replacing ? previous.map(draft => draft === replacing ? moment : draft) : [...previous, moment];
  delete notes[chair.key];
  if (save()) return true;
  notes[chair.key] = note;
  G.paperMoments = previous;
  return false;
}

function togglePublicBook(chair) {
  const note = bookRecommendation(chair);
  const readers = publicBookReaders(note);
  if (!note || note.reply || !chair.readingNotes || !isWindowChair(chair) || readers?.length || chair.users.length) return false;
  const notes = G.keepsakes.bookRecommendations;
  const { readBy, seatUntil, discuss, ...base } = note;
  notes[chair.key] = readers ? base : { ...base, readBy: [] };
  if (save()) return true;
  notes[chair.key] = note;
  return false;
}

function reservedBookReader(chair) {
  if (!chair.readingNotes || !isWindowChair(chair)) return null;
  const note = bookRecommendation(chair);
  return !publicBookReaders(note) && Number.isInteger(note?.seatUntil) && note.seatUntil > absNow() ? communityDoll(note.to) : null;
}

function toggleBookSeat(chair) {
  const note = bookRecommendation(chair);
  if (!note || publicBookReaders(note) || !chair.readingNotes || !isWindowChair(chair)) return false;
  if (reservedBookReader(chair)) delete note.seatUntil;
  else {
    if (furnitureInUse(chair, communityDoll(note.to))) return false;
    note.seatUntil = Math.min(Math.floor(absNow()) + BOOK_SEAT_MINUTES, note.until * 1440);
  }
  return true;
}

function canMoveBookRecommendation(source, target, note) {
  if (!note || source === target || !source.readingNotes || !isWindowChair(source) ||
      !target?.readingNotes || !isWindowChair(target) || bookRecommendation(target)) return false;
  const reader = communityDoll(note.to);
  return publicBookReaders(note) ? !source.users.length && !furnitureInUse(target) :
    !source.users.includes(reader) && !furnitureInUse(target, reader);
}

function moveBookRecommendation(source, target) {
  if (!G.furniture.includes(source) || !G.furniture.includes(target)) return false;
  const note = bookRecommendation(source);
  if (!canMoveBookRecommendation(source, target, note)) return false;
  const recommendations = G.keepsakes.bookRecommendations;
  const previous = recommendations[target.key];
  recommendations[target.key] = note;
  delete recommendations[source.key];
  if (save()) return true;
  recommendations[source.key] = note;
  if (previous === undefined) delete recommendations[target.key];
  else recommendations[target.key] = previous;
  return false;
}

function toggleBookDiscussion(chair) {
  const note = bookRecommendation(chair);
  if (!note || note.reply || publicBookReaders(note) || !chair.readingNotes || !isWindowChair(chair)) return false;
  const previous = note.discuss;
  if (previous === true) delete note.discuss;
  else note.discuss = true;
  if (save()) return true;
  if (previous === undefined) delete note.discuss;
  else note.discuss = previous;
  return false;
}

function finishBookRecommendation(reader, chair) {
  const note = bookRecommendation(chair);
  if (!note || reader.guest || !chair.readingNotes || !isWindowChair(chair)) return false;
  const readers = publicBookReaders(note);
  if (readers) {
    const picked = pickedBookReader(note);
    if (!canReadSharedBook(note, readers, reader) || readers.length >= BOOK_PUBLIC_READERS || (picked && picked !== reader)) return false;
    const answered = note.question === true && readers.length === 1;
    readers.push(reader.pid);
    note.readRooms = { ...note.readRooms, [reader.pid]: cornerRoom(chair) };
    if (readers.length === BOOK_PUBLIC_READERS && !note.keepForPaper) delete G.keepsakes.bookRecommendations[chair.key];
    reader.needs.fun = Math.min(100, reader.needs.fun + (picked ? BOOK_PICKED_FUN : BOOK_PUBLIC_FUN) -
      (answered ? BOOK_QUESTION_FUN_COST : 0));
    if (answered) reader.needs.social = Math.min(100, reader.needs.social + BOOK_QUESTION_SOCIAL);
    say(reader, answered ? BOOK_ANSWER : '这一段也值得推荐。');
    addLog(answered ? `📖 ${reader.name}读完了窗边的书摘，给上位读者留了答复：「${BOOK_ANSWER}」`
      : `📖 ${reader.name}读完了窗边传阅的书摘。`);
    return true;
  }
  if (note.to !== reader.pid) return false;
  const author = communityDoll(note.from);
  if (tensionBetween(author, reader)) return false;
  delete G.keepsakes.bookRecommendations[chair.key];
  bump(reader, author, 2);
  if (note.reply) {
    reader.needs.fun = Math.min(100, reader.needs.fun + BOOK_PRIVATE_FUN);
    say(reader, '原来这一段也让你想起了我。');
    addLog(`📖 ${reader.name}在窗边读到了${author.name}的荐书回信。`);
    return true;
  }
  if (note.discuss === true && !quietStudy(chair) && canDiscussReading(reader, author, chair) &&
      [reader, author].every(hasTimeToDiscussReading)) {
    for (const d of [reader, author]) d.needs.social = Math.min(100, d.needs.social + 6);
    say(reader, '我读完你推荐的那一段了。');
    say(author, '来聊聊你读到的吧。');
    addLog(`📖 ${reader.name}读完荐书，和${author.name}在窗边聊了几句。`);
    return true;
  }
  reader.needs.fun = Math.min(100, reader.needs.fun + BOOK_PRIVATE_FUN);
  say(reader, '原来你想推荐的是这一段。');
  addLog(`📖 ${reader.name}读完了${author.name}推荐的那一段。`);
  return true;
}

function readingNeighbor(d, f) {
  if (d.guest || quietReading(f) || !cornerRegular(f, d) || cornerKind(f) !== 'read') return;
  return G.dolls.find(o => {
    const other = o.act?.furn;
    return o !== d && !o.guest && o.state === 'act' && other && other !== f && !quietReading(other) &&
      cornerRegular(other, o) && cornerKind(other) === 'read' &&
      cornerRoom(other) === cornerRoom(f) && cornerDistance(other, f) <= 3 &&
      canSee(d, o) && canDisturb(d, o) && !tensionBetween(d, o) && (G.rel[relKey(d, o)]?.f || 0) >= 25;
  });
}

function readingCornerBonus(d, f) {
  const note = f.readingNotes && isWindowChair(f) && bookRecommendation(f);
  const readers = publicBookReaders(note);
  if (readers && readers.length < BOOK_PUBLIC_READERS && canReadSharedBook(note, readers, d)) {
    const picked = pickedBookReader(note);
    if (!picked || picked === d) return 12;
  }
  if (!readers && note?.to === d.pid) return 24;
  if (quietReading(f) && !isE(d) && d.needs.social >= 85 && cornerKind(f) === 'read') return 12;
  return d.needs.social < 65 && readingNeighbor(d, f) ? 24 : 0;
}

function noteCornerUse(d, f) {
  const kind = cornerKind(f);
  if (!kind || d.guest) return;
  const record = G.keepsakes.corners[f.key] ||= { kind, visits: {}, regulars: [] };
  const last = record.visits[d.pid];
  const companion = kind === 'tea' ? f.users.find(other => other !== d && other.state === 'act' && cornerRegular(f, other)) :
    kind === 'read' && readingNeighbor(d, f);
  const otherCorner = kind === 'read' && companion ? G.keepsakes.corners[companion.act.furn.key] : null;
  if (companion && cornerRegular(f, d) && record.sharedMonth !== G.day && otherCorner?.sharedMonth !== G.day) {
    record.sharedMonth = G.day;
    if (otherCorner) {
      otherCorner.sharedMonth = G.day;
      d.needs.social = Math.min(100, d.needs.social + 8);
      companion.needs.social = Math.min(100, companion.needs.social + 8);
    }
    bump(d, companion, 3);
    addLog(`🫖 ${d.name}和${companion.name}又在老地方一起${kind === 'tea' ? '喝茶' : '看书'}。`);
  }
  if (last?.month === G.day) return;
  const months = (last?.months || 0) + 1;
  record.visits[d.pid] = { month: G.day, months };
  if (months < 2 || record.regulars.includes(d.pid)) return;
  record.regulars.push(d.pid);
  if (!record.owner || !communityDoll(record.owner)) {
    record.owner = d.pid;
    addLog(`📖 ${d.name}有了自己的${CORNER_NAMES[kind]}，下次还想来这里。`);
  } else {
    const owner = communityDoll(record.owner);
    if (owner) addLog(`🫖 ${d.name}也常来${owner.name}的${CORNER_NAMES[kind]}，两人习惯给彼此留个位置。`);
  }
}

function drawCornerMark(c, f, x, y) {
  const owner = cornerOwner(f);
  if (!owner || !communityDoll(owner)) return;
  if (f.id === 'piano') {
    bevel(c, x + 20, y - 10, 6, 5, '#f1d7a5', '#937481');
    detail(c, x + 21, y - 8, 3.5, .5, '#b48388');
  } else if (f.id === 'teaTray') {
    bevel(c, x + 4, y - 3, 5, 4, '#f1d7b1', '#9d7780');
    if (G.keepsakes.corners[f.key].regulars.length > 1) detail(c, x + 3, y - 1.5, 1, 1, '#a5847d');
  } else if (f.id === 'chair' || f.id === 'shelf') {
    const bx = x + (f.id === 'chair' ? 4 : 24), by = y + (f.id === 'chair' ? 2 : 3);
    bevel(c, bx, by, 6, 4, '#ca8a9b', '#795661');
    detail(c, bx + 1, by + 2, 4, .5, '#f2d3aa');
  }
}

function pairRoutes(a, b, tiles) {
  const routes = d => tiles.map(tile => ({ tile, path: findPath(d.tx, d.ty, [tile]) })).filter(r => r.path);
  let best = null;
  for (const left of routes(a)) for (const right of routes(b)) {
    if (left.tile === right.tile || cornerDistance(left.tile, right.tile) !== 1) continue;
    const cost = left.path.length + right.path.length;
    if (!best || cost < best.cost) best = { cost, routes: [left.path, right.path] };
  }
  return best?.routes;
}

function sendKeepsakePair(pair, routes, type, key) {
  for (const [i, d] of pair.entries()) {
    if (d.act) endAct(d);
    d.path = routes[i];
    d.act = { type, keepsakeKey: key };
    d.state = d.path.length ? 'walk' : 'arrive';
  }
}

function readyForKeepsake(d) {
  return d && d.state !== 'away' && d.state !== 'lift' && !takingStairs(d) && !takingYardPath(d) &&
    !lying(d) && d.needs.energy >= 25 && d.needs.bladder >= 18 && !['homeTime', 'leave', 'neighborLeave', 'visitLeave', 'makeKeepsake', 'rainTea'].includes(d.act?.type);
}

function startKeepsakeProject(a, b, finish) {
  if (G.keepsakes.project || !a || !b || a === b || a.guest || b.guest ||
      !Object.hasOwn(KEEPSAKE_FINISHES, finish) || ![a, b].every(readyForKeepsake)) return false;
  const bench = G.furniture.find(f => f.id === 'craftBench' && !homeFurnitureReserved(f) && f.users.every(d => d === a || d === b) &&
    pairRoutes(a, b, approachTiles(f)));
  if (!bench) return false;
  G.keepsakes.project = { people: [a.pid, b.pid], finish, bench: bench.key, expires: absNow() + 240, work: 0 };
  tickKeepsakes(0);
  save();
  return true;
}

function finishKeepsake(project, pair) {
  const names = pair.map(d => d.name);
  G.keepsakes.pieces.push({ key: 'piece-' + G.keepsakes.nextFurniture++, finish: project.finish,
    makers: names, month: G.day });
  const text = `${names.join('和')}一起做成了${KEEPSAKE_FINISHES[project.finish][0]}花架。`;
  rememberKeepsakePair(pair, 'shared-craft', text);
  addLog(`🪴 ${text}成品已收进布置里的纪念物。`);
  G.keepsakes.project = null;
  pair.forEach(endAct);
  HOOK.refresh();
  save();
}

function rememberKeepsakePair(pair, type, text) {
  const [a, b] = pair;
  bump(a, b, 5);
  addTrust(a, b, 3);
  addTrust(b, a, 3);
  NPCMemory.record(G, { type, time: absNow(), participants: [a.pid, b.pid], outcome: 'shared' },
    pair.map((d, i) => ({ person: d.pid, subject: pair[1 - i].pid, emotion: .7, impact: 70, interpretation: text })));
}

function arriveKeepsake(d) {
  const work = d.act.type === 'makeKeepsake';
  d.state = 'act';
  d.act.t = 60;
  d.act.gain = { fun: 8, social: 10 };
  d.dir = 'up';
  say(d, work ? ({
    maker: '我来把木边磨圆。', stylist: '这里再添一点颜色。', genki: '我已经想好放什么花了！',
    tidy: '我把螺丝都排好了。', nerd: '我量一量，两边得一样高。',
  })[d.persona] || '我来扶住这边。' : '给你留了一杯热茶。');
}

function noteRainTradition(a, b) {
  const key = relKey(a, b);
  G.keepsakes.traditions[key] ||= { people: [a.pid, b.pid], first: G.day, last: G.day };
}

function startRainTea(key, pair) {
  const tiles = [];
  for (const f of G.furniture) {
    if (!['teaTray', 'chair', 'shelf'].includes(f.id) || cornerRoom(f) !== 'study') continue;
    tiles.push(...approachTiles(f));
  }
  const backup = [];
  for (let y = FLOOR_SPLIT; y < ROWS; y++) for (let x = BX; x < COLS; x++) backup.push({ x, y });
  const open = candidates => [...new Map(candidates.map(tile => [`${tile.x},${tile.y}`, tile])).values()]
    .filter(tile => tile.x >= BX && tile.y >= FLOOR_SPLIT && tile.y < ROWS && free(tile.x, tile.y) &&
      !isDoorTile(tile.x, tile.y) && !(tile.x === stairsColumn() && tile.y === UPPER_LANDING));
  const routes = pairRoutes(...pair, open(tiles)) || pairRoutes(...pair, open(backup));
  if (!routes) return false;
  sendKeepsakePair(pair, routes, 'rainTea', key);
  return true;
}

function tickKeepsakes(dt) {
  const k = G.keepsakes;
  const project = k.project;
  if (project) {
    const pair = project.people.map(communityDoll);
    const bench = G.furniture.find(f => f.key === project.bench);
    const assigned = d => d?.act?.type === 'makeKeepsake' && d.act.keepsakeKey === project.bench;
    if (!bench || pair.some(d => !d) || absNow() >= project.expires) {
      pair.filter(assigned).forEach(endAct);
      k.project = null;
      addLog('🪵 手工暂时搁下了，有空可以再约。');
      save();
    } else if (pair.every(assigned)) {
      if (pair.every(d => d.state === 'act')) {
        project.work += dt;
        if (project.work >= 5) finishKeepsake(project, pair);
      }
    } else {
      pair.filter(assigned).forEach(endAct);
      if (pair.every(readyForKeepsake) && bench.users.every(d => pair.includes(d))) {
        const routes = pairRoutes(...pair, approachTiles(bench));
        if (routes) sendKeepsakePair(pair, routes, 'makeKeepsake', bench.key);
      }
    }
  }

  // Once a rain-day ritual has begun, finish it only if both actually reach the study.
  for (const [key, tie] of Object.entries(k.traditions)) {
    const pair = tie.people.map(communityDoll);
    const assigned = d => d?.act?.type === 'rainTea' && d.act.keepsakeKey === key;
    if (pair.every(assigned)) {
      if (!pair.every(d => d.state === 'act')) continue;
      tie.last = G.day;
      const text = `又下雨了，${pair[0].name}给${pair[1].name}在二楼留了一杯茶，两人又在书房坐到了一起。`;
      rememberKeepsakePair(pair, 'rain-tea-tradition', text);
      addLog(`🫖 ${text}`);
      for (const d of pair) {
        d.act.t = 5;
        d.act.keepsakeKey = null;
      }
      save();
      continue;
    }
    pair.filter(assigned).forEach(endAct);
    if (tie.last >= G.day || G.weather !== 'rain' || G.time < 13 * 60 || G.time >= 20 * 60) continue;
    if (pair.every(readyForKeepsake) && !G.community.outing && !G.community.active?.leavingAt && !G.community.active?.rainDeadline) {
      if (G.community.active && G.community.active.guestPid !== pair.find(d => d.guest)?.pid) continue;
      startRainTea(key, pair);
    } else if (!G.community.active && !G.community.outing && tie.invited !== G.day) {
      const host = pair.find(d => d && !d.guest && readyForKeepsake(d));
      const friend = G.community.friends.find(f => tie.people.includes(f.pid) && !communityDoll(f.pid));
      if (host && friend && startGetTogether(host, 'visit', { friend })) {
        tie.invited = G.day;
        save();
      }
    }
  }
}

function keepsakeLabel(piece) {
  return `${KEEPSAKE_FINISHES[piece.finish][0]}花架 · ${piece.makers.join('和')}一起做 · ${monthLabel(piece.month)}`;
}

function keepsakePiece(key) { return G.keepsakes.pieces.find(p => p.key === key); }
function unplacedKeepsakes() {
  const inRoom = new Set(G.furniture.map(f => f.piece));
  if (G.build.placing?.moved) inRoom.add(G.build.placing.piece);
  return G.keepsakes.pieces.filter(p => !inRoom.has(p.key));
}

FURNITURE.handmadePlanter = { name: '手作花架', w: 1, h: 1, fixed: true };
TALL.handmadePlanter = 10;
DRAW.handmadePlanter = (c, x, y, f) => {
  const finish = KEEPSAKE_FINISHES[keepsakePiece(f?.piece)?.finish] || KEEPSAKE_FINISHES.honey;

  for (const px of [x + 2, x + 12]) R(c, px, y - 1, 2, 15, '#785247');
  for (const [i, row] of [-3, 6].entries()) {
    bevel(c, x + 1, y + row + 4, 14, 4, finish[1], '#795b5c');
    bevel(c, x + 4 + i * 2, y + row, 6, 5, i ? '#d9a68a' : '#e5cbae', '#94716f');
    R(c, x + 6 + i * 2, y + row - 4, 1, 5, '#689071');
    R(c, x + 4 + i * 2, y + row - 5, 5, 2, i ? '#e5a7ac' : '#f3d68e');
    detail(c, x + 6 + i * 2, y + row - 4.5, 1, .5, '#fff0c8');
  }
};

FURNITURE.teaTray.cap = 2;
ACT_NAMES.makeKeepsake = '一起做花架';
ACT_NAMES.rainTea = '在书房喝雨天茶';
ACT_LINES.makeKeepsake = ['漆快干了，再等一会儿。'];
ACT_LINES.rainTea = ['雨声和上次一样。'];
