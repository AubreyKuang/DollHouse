// Portable saves are inspected before applying; the previous home remains recoverable.
const HOME_IMPORT_BACKUP = SAVE_KEY + ':before-import';
const HOME_FILE_LIMIT = 5 * 1024 * 1024;
function homeChecksum(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}
function exportHomeSave() {
  const data = JSON.parse(JSON.stringify({ ...houseSaveData(), saveVersion: SaveManager.version }));
  return JSON.stringify({ game: 'DollHouse', format: 1, mode: TEST_MODE ? 'test' : 'normal',
    checksum: homeChecksum(JSON.stringify(data)), data }, null, 2);
}
function validatePortableHome(data) {
  if (!data || typeof data !== 'object' || !validHouseSave(data)) throw Error('这份文件里没有完整的小屋。');
  let nodes = 0;
  function inspect(value, depth = 0) {
    if (++nodes > 150000 || depth > 40) throw Error('这份存档内容异常复杂，无法恢复。');
    if (typeof value === 'number' && !Number.isFinite(value)) throw Error('存档里的数值已损坏。');
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('这份存档包含不支持的字段。');
      inspect(item, depth + 1);
    }
  }
  inspect(data);
  const list = (v, max) => Array.isArray(v) && v.length <= max;
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!Number.isInteger(data.day) || data.day < 1 || !Number.isFinite(data.time) || data.time < 0 || data.time >= 1440 ||
      !Number.isInteger(data.level) || !LEVELS[data.level] || !Number.isFinite(data.fund) ||
      !list(data.dolls, 16) || !data.dolls.length || !list(data.furniture, 1000)) throw Error('日期、住户或房屋数据不完整。');
  const ids = new Set();
  for (const d of data.dolls) {
    if (!d || typeof d.pid !== 'string' || !d.pid || ids.has(d.pid) || typeof d.name !== 'string' || !d.name.trim() ||
        !Object.hasOwn(PERSONAS, d.persona) || !Object.hasOwn(JOBS, d.job) || !object(d.look) || !object(d.needs) ||
        !Number.isFinite(d.money)) throw Error('有一位住户的数据不完整。');
    ids.add(d.pid);
    for (const key of ['energy', 'hunger', 'fun', 'social', 'bladder']) {
      if (!Number.isFinite(d.needs[key]) || d.needs[key] < 0 || d.needs[key] > 100) throw Error('住户的状态数值不正确。');
    }
  }
  for (const f of data.furniture) if (!f || !Object.hasOwn(FURNITURE, f.id) || !Number.isInteger(f.x) ||
    !Number.isInteger(f.y) || f.x < 0 || f.x >= 24 || f.y < UPPER_WALL || f.y >= YARD_END) throw Error('有一件家具的数据不完整。');
  for (const key of ['rel', 'trust', 'jealousy', 'inv']) if (data[key] !== undefined && !object(data[key])) throw Error('人际关系或仓库数据损坏了。');
  for (const key of ['log', 'paper', 'paperMoments']) if (data[key] !== undefined && !list(data[key], 1000)) throw Error('日志或月报数据损坏了。');
  if (data.home) {
    if (!list(data.home.album, 120) || !list(data.home.wishes, 8)) throw Error('小屋相册数据不完整。');
    for (const memory of data.home.album) if (!object(memory) || typeof memory.text !== 'string' || typeof memory.title !== 'string' ||
      !Number.isInteger(memory.month) || !list(memory.people, 16) || memory.people.some(p => !object(p?.look) || typeof p.name !== 'string')) throw Error('有一张回忆卡的数据不完整。');
    for (const wish of data.home.wishes) if (!object(wish) || typeof wish.pid !== 'string' || typeof wish.text !== 'string' ||
      !Object.hasOwn(HOME_TIMES, wish.kind)) throw Error('住户的心愿数据不完整。');
    const active = data.home.active;
    if (active && (!Object.hasOwn(HOME_TIMES, active.kind) || !list(active.people, 4) || active.people.some(p => typeof p !== 'string') ||
      typeof active.anchor !== 'string' || !Number.isFinite(active.deadline))) throw Error('正在进行的活动数据不完整。');
  }
  if (data.community && (!object(data.community) || !list(data.community.friends, 1000) || !list(data.community.applications, 1000))) throw Error('访客资料不完整。');
  if (data.keepsakes && (!object(data.keepsakes) || !list(data.keepsakes.pieces, 1000) || !object(data.keepsakes.corners) || !object(data.keepsakes.traditions))) throw Error('手作与小角落资料不完整。');
  if (data.life) {
    const life=data.life;
    if (!object(life.people) || Object.keys(life.people).length>64 || !list(life.birthdays,32) || !list(life.inquiries,8) || !list(life.birthdayInvites,16) ||
      !Number.isFinite(life.nextInvite) || !Number.isInteger(life.lastLessonMonth)) throw Error('生活里程碑资料不完整。');
    for(const skills of Object.values(life.people)) {
      if(!object(skills)) throw Error('本领记录不完整。');
      for(const [key,s] of Object.entries(skills)) if(!Object.hasOwn(TALENTS,key) || !object(s) || !Number.isFinite(s.xp) || s.xp<0 || s.xp>108 ||
        !Number.isInteger(s.month) || !Number.isFinite(s.earned) || s.earned<0 || s.earned>18) throw Error('本领记录不完整。');
    }
    if(life.birthdays.some(b=>!object(b)||typeof b.pid!=='string'||!Number.isInteger(b.year)||b.year<1)||
      life.birthdayInvites.some(b=>!object(b)||typeof b.pid!=='string'||!Number.isInteger(b.month))||
      life.inquiries.some(q=>!object(q)||typeof q.pid!=='string'||!Object.hasOwn(TALENTS,q.skill)||!Number.isInteger(q.month)||!Number.isFinite(q.after))) throw Error('生日或请教记录不完整。');
  }
  if(data.home?.active && (data.home.active.kind==='birthday'||LESSON_SKILLS[data.home.active.kind])) {
    const a=data.home.active,detail=a.detail;
    if(!object(detail) || (a.kind==='birthday' ? typeof detail.honoree!=='string'||!a.people.includes(detail.honoree)||!Number.isInteger(detail.year)
      : detail.skill!==LESSON_SKILLS[a.kind]||typeof detail.learner!=='string'||typeof detail.teacher!=='string'||detail.learner===detail.teacher||
        !a.people.includes(detail.learner)||!a.people.includes(detail.teacher))) throw Error('活动主角资料不完整。');
  }
  if (data.npcMemory) {
    if (!object(data.npcMemory.people) || !object(data.npcMemory.events)) throw Error('住户的记忆资料不完整。');
    for (const memory of Object.values(data.npcMemory.people)) if (!list(memory.short, 1000) || !list(memory.long, 1000)) throw Error('住户的记忆资料不完整。');
  }
  return data;
}
function readPortableHome(raw) {
  if (typeof raw !== 'string' || raw.length > HOME_FILE_LIMIT) throw Error('请选择小于 5 MB 的小屋备份文件。');
  let file;
  try { file = JSON.parse(raw); } catch { throw Error('这不是可以读取的 JSON 存档文件。'); }
  if (file?.game !== 'DollHouse' || file.format !== 1) throw Error('请选择由「下载存档备份」保存的小屋文件。');
  if (file.mode !== (TEST_MODE ? 'test' : 'normal')) throw Error(TEST_MODE ? '这是正式版的小屋，请到正式版恢复。' : '这是测试模式的小屋，请到测试模式恢复。');
  if (file.data?.saveVersion > SaveManager.version) throw Error('这份备份来自更新的版本，请先刷新游戏。');
  if (file.checksum !== homeChecksum(JSON.stringify(file.data))) throw Error('文件似乎不完整或被改过，当前小屋没有变化。');
  return validatePortableHome(migrateHouseSave(file.data, file.data.saveVersion || 1));
}
function importPortableHome(data, undo = false) {
  validatePortableHome(data);
  const previous = JSON.parse(JSON.stringify(houseSaveData()));
  let previousRaw, previousSnapshots, restoredSnapshots;
  // A failed backup must abort before any in-memory state changes.
  try {
    previousRaw = localStorage.getItem(SAVE_KEY);
    previousSnapshots = localStorage.getItem(SAVE_KEY + ':snapshots') || '[]';
    restoredSnapshots = localStorage.getItem(HOME_IMPORT_BACKUP + ':snapshots') || '[]';
    if (!undo) {
      localStorage.setItem(HOME_IMPORT_BACKUP, exportHomeSave());
      localStorage.setItem(HOME_IMPORT_BACKUP + ':snapshots', previousSnapshots);
    }
  } catch { throw Error('无法保留当前进度，恢复已取消。请先下载一份备份。'); }
  try {
    applySave(JSON.parse(JSON.stringify(data))); rebuild();
    G.paperPending = false; lastSavedAt = Date.now();
    if (!save()) throw Error('浏览器没有保存成功。');
    localStorage.setItem(SAVE_KEY + ':snapshots', undo ? restoredSnapshots : '[]');
    if (!undo) snapshotHouseMonth();
  } catch (error) {
    applySave(previous); rebuild();
    try {
      if (previousRaw !== null) localStorage.setItem(SAVE_KEY, previousRaw);
      localStorage.setItem(SAVE_KEY + ':snapshots', previousSnapshots);
    } catch { /* Export remains available if storage itself has stopped accepting writes. */ }
    throw Error('恢复没有完成，已回到原来的小屋。' + error.message);
  }
  return true;
}
