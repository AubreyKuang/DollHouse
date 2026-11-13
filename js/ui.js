// 界面：住户列表、状态卡、模式切换、布置面板、衣橱，以及主循环
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ---------- 提示 ---------- */
let toastTimer = 0;
HOOK.toast = (msg, quiet) => {
  if (!quiet && !msg.startsWith('☀️')) addLog(msg);   // quiet=true 的是纯界面提示，不进日志          // 新的一天用日志里的日期分隔，不重复记
  const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); };

/* ---------- 住户列表 + 状态卡 ---------- */
function doingText(d) {
  if (inHomeTime(d)) return (d.state === 'walk' ? '去参加' : G.home.active?.phase === 'gather' ? '等大家来，准备' : '') + (HOME_TIMES[G.home.active?.kind]?.name || '小屋活动');
  if (d.act?.type === 'visitStay') {
    if (d.act.theme === 'quiet') return '在二楼书房聊天';
    if (d.act.theme === 'umbrella') return '撑着伞野餐';
    return GET_TOGETHERS[G.community.active?.kind]?.name || '和朋友相聚';
  }
  if (d.act?.type === 'neighborLeave') return '准备去麦麦家';
  if (d.state === 'lift') return '被你拎在手里';
  if (d.state === 'wait') return '在等人过来';
  if (d.state === 'away') return awayText(d);
  if (d.act && d.act.type === 'leave') return `出门${JOBS[d.job].verb}`;
  if (!d.act) return ACT_NAMES.idle;
  if (d.state === 'walk' && d.act.type === 'join') return `去找${d.act.target.name}凑热闹`;
  if (d.state === 'walk' && d.act.type === 'chat' && d.act.partner) return `去找${d.act.partner.name}`;
  const sd = d.state === 'act' && socialDoing(d);
  if (sd) return sd;
  const n = ACT_NAMES[d.act.type] || '忙碌中';
  if (d.state === 'walk') return d.act.type === 'wander' ? '闲逛' : `正要去${n.replace(/^在/, '')}`;
  if (d.act.type === 'chat' && d.act.partner) return `和${d.act.partner.name}聊天`;
  return n;
}

function renderDollList() {
  const box = $('#dollList'); box.innerHTML = '';
  for (const d of G.dolls) {
    const b = el('button', 'doll-row' + (d.uid === G.sel ? ' sel' : '') + (d.state === 'away' ? ' away' : ''));
    const c = el('canvas'); c.width = 20; c.height = 24; dollPortrait(c, d.look);
    const P = PERSONAS[d.persona];
    const m = el('div', 'meta', `<b>${esc(d.name)}${d.guest ? ' <em class="guest-tag">访客</em>' : ''} <span class="g-${d.gender}">${d.gender === 'm' ? '♂' : '♀'}</span> ${P.icon}</b><small class="couple-label" data-partners="${d.uid}" hidden></small><small data-doing="${d.uid}">${esc(doingText(d))}</small>`);
    b.append(c, m);
    b.onclick = () => {
      G.sel = d.uid === G.sel ? null : d.uid;
      if (G.sel && matchMedia('(max-width:700px) and (orientation:portrait)').matches) {
        $('#side').open = false;
        $('#side summary').focus({ preventScroll: true });
      }
      SFX.play('click'); HOOK.select();
    };
    box.append(b);
  }
  const count = G.community.applications.length;
  $('#btnAddDoll').textContent = count ? `＋ 邀请新住户 · ${count} 份申请` : '＋ 邀请新住户';
}

function renderResidentQuick() {
  const strip = $('#residentQuick');
  if (!strip) return;
  const roster = JSON.stringify(G.dolls.map(d => [d.uid, d.name, d.look]));
  if (strip.dataset.roster === roster) return;
  strip.dataset.roster = roster;
  strip.replaceChildren(...G.dolls.map(d => {
    const button = el('button', 'resident-quick-person');
    button.type = 'button';
    button.dataset.resident = d.uid;
    const portrait = el('canvas');
    portrait.width = 20; portrait.height = 24;
    portrait.setAttribute('aria-hidden', 'true');
    dollPortrait(portrait, d.look);
    const label = el('span'), status = el('small');
    status.dataset.doing = d.uid;
    label.append(el('b', null, esc(d.name)), status);
    button.append(portrait, label);
    button.onclick = () => {
      G.sel = G.sel === d.uid ? null : d.uid;
      SFX.play('click'); HOOK.select();
    };
    return button;
  }));
}

function renderInfo() {
  const card = $('#dollInfo'), d = G.dolls.find(o => o.uid === G.sel);
  if (!d) { card.hidden = true; return; }
  const P = PERSONAS[d.persona];
  card.hidden = false;
  card.innerHTML = `<h3>${esc(d.name)}${d.guest ? ' <em class="guest-tag">访客</em>' : ''}</h3>
    <div id="infoPartners" class="partner-list" hidden></div>
    <div class="persona">${P.icon} ${P.name} · ${P.desc}${isVain(d) ? ' · ✨ 爱美，常照镜子' : ''}</div>
    <div class="persona">${jobLine(d)}</div>
    <div class="persona">${astroLine(d)}</div>
    <div class="persona">MBTI 偏好 · ${(MBTI_INTERESTS[mb(d)] || []).map(use => ACT_NAMES[use]).join('、')}</div>
    <div class="money">💰 存款 <b id="infoMoney"></b></div>
    <div class="persona">${GENDERS[d.gender]} · ${HEARTS[d.heart].icon} ${HEARTS[d.heart].name}：${HEARTS[d.heart].desc}</div>
    ${NEEDS.map(n => `<div class="need"><span>${n.name}</span><div class="bar"><i data-need="${n.key}" style="background:${n.color}"></i></div></div>`).join('')}
    <div class="doing">正在：<b id="infoDoing"></b></div>
    <div class="persona talent-summary" id="infoTalents"></div>
    ${G.dolls.length > 1 ? `<div class="rels"><h4>人际关系</h4>${G.dolls.filter(o => o !== d).map(o => `
      <div class="rel" data-rel-row="${o.uid}"><div class="rel-top"><span>${esc(o.name)} <span class="stars" title="星座 + MBTI 缘分">${compatStars(d, o)}</span></span><small data-rl="${o.uid}"></small></div>
      <div class="rel-bars"><span title="友好度">🤝</span><div class="bar"><i data-rf="${o.uid}" style="background:#7cc576"></i></div>
      <span title="恋爱度">💗</span><div class="bar"><i data-rlv="${o.uid}" style="background:#ec6a8a"></i></div></div></div>`).join('')}</div>` : ''}
    <div class="hint" style="margin:4px 0 0">选中后点家具，可以让 TA 去用</div>
    <div class="actions">
      <button class="btn small" id="btnPet">🤚 摸摸头</button>
      <button class="btn small" id="btnDress"${d.guest ? ' hidden' : ''}>👗 换装</button>
      <button class="btn small ghost" id="btnWake">📣 叫 TA</button>
    </div>`;
  $('#infoPartners').onclick = e => {
    const uid = Number(e.target.closest('[data-partner]')?.dataset.partner);
    if (!uid) return;
    G.sel = uid;
    SFX.play('click');
    HOOK.select();
    $('#infoPartners [data-partner]')?.focus();
  };
  $('#btnPet').onclick = () => petDoll(d);
  $('#btnDress').onclick = () => openWardrobe(d.uid);
  $('#btnWake').onclick = () => { if (d.state === 'away') { HOOK.toast(`${d.name} 不在家哦`, true); return; } if (d.act) endAct(d); d.path = []; d.state = 'idle'; d.think = 3; d.dir = 'down'; say(d, '叫我吗？'); };
}

function tickInfo() {
  const d = G.dolls.find(o => o.uid === G.sel);
  if (d && !$('#dollInfo').hidden) {
    const partners = confirmedPartners(d), strip = $('#infoPartners');
    const signature = JSON.stringify(partners.map(o => [o.uid, o.name]));
    if (strip.dataset.pairing !== signature) {
      strip.dataset.pairing = signature;
      strip.hidden = !partners.length;
      strip.innerHTML = partners.map(o => `<button class="partner-link" type="button" data-partner="${o.uid}">♥ 恋人 · ${esc(o.name)}</button>`).join('');
    }
    for (const i of document.querySelectorAll('[data-need]')) i.style.width = d.needs[i.dataset.need].toFixed(0) + '%';
    const s = $('#infoDoing'); if (s) s.textContent = doingText(d);
    const talents = $('#infoTalents'); if (talents) { talents.textContent = talentSummary(d); talents.hidden = d.guest; }
    const m = $('#infoMoney'); if (m) { m.textContent = TEST_MODE ? '∞' : yuan(d.money); m.classList.toggle('neg', !TEST_MODE && d.money < 0); }
    for (const o of G.dolls) {
      if (o === d) continue;
      const r = rel(d, o), lab = document.querySelector(`[data-rl="${o.uid}"]`);
      if (!lab) continue;
      // 信任和醋意是单向的：这里显示的是“我”对 TA 的看法
      const trust = trustWord(trustOf(d, o)), envy = jealousyOf(d, o) >= 20 ? '😤 醋意' : '';
      lab.textContent = [relLabel(r), trust, envy].filter(Boolean).join(' · ');
      document.querySelector(`[data-rel-row="${o.uid}"]`).classList.toggle('couple-rel', arePartners(d, o));
      document.querySelector(`[data-rf="${o.uid}"]`).style.width = Math.max(0, r.f).toFixed(0) + '%';
      document.querySelector(`[data-rlv="${o.uid}"]`).style.width = r.l.toFixed(0) + '%';
    }
  }
  for (const s of document.querySelectorAll('[data-doing]')) {
    const o = G.dolls.find(x => x.uid === +s.dataset.doing);
    if (!o) continue;
    const status = doingText(o);
    if (s.textContent !== status) s.textContent = status;
  }
  for (const s of document.querySelectorAll('[data-partners]')) {
    const o = G.dolls.find(x => x.uid === +s.dataset.partners);
    if (!o) continue;
    const names = confirmedPartners(o).map(p => p.name).join('、');
    s.hidden = !names;
    const caption = names ? `♥ 恋人 · ${names}` : '';
    if (s.textContent !== caption) s.textContent = caption;
  }
}

HOOK.select = () => {
  renderResidentQuick();
  refreshSceneHint();
  renderDollList(); renderInfo(); tickInfo(); updateCommunityStatus();
};

const studyQuietButton = $('#studyQuiet');
const studyQuietTimer = $('#studyQuietTimer');
const readingSeat = $('#readingSeat');
const soloReadingButton = $('#soloReading');
const readingNotesButton = $('#readingNotes');
const bookSeatButton = $('#bookSeat');
const bookDiscussButton = $('#bookDiscuss');
const bookPublicButton = $('#bookPublic');
const bookPaperButton = $('#bookPaper');
const bookKeepForPaperButton = $('#bookKeepForPaper');
const bookQuestionButton = $('#bookQuestion');
const bookQuestionHint = $('#bookQuestionHint');
const bookReplyButton = $('#bookReply');
const bookReaderControls = $('#bookReaderControls');
const bookNextReader = $('#bookNextReader');
const bookPickReaderButton = $('#bookPickReader');
const bookDestination = $('#bookDestination');
const bookMoveButton = $('#bookMove');
const bookMoveStatus = $('#bookMoveStatus');
let readingSeatOptions = '';
let bookDestinationOptions = '';
let bookReaderOptions = '';
readingSeat.onchange = () => {
  bookMoveStatus.textContent = '';
  bookDestination.value = '';
  refreshReadingSeats();
};
const selectedReadingSeat = () => G.furniture.find(f => f.key === readingSeat.value && isWindowChair(f));
bookNextReader.onchange = () => {
  bookMoveStatus.textContent = '';
  refreshReadingSeats();
};
bookPickReaderButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live') return;
  if (pickNextBookReader(chair, bookNextReader.value)) {
    bookMoveStatus.textContent = bookNextReader.value ? '已指定下一位传阅读者。' : '已恢复自由传阅。';
    bookNextReader.focus();
  } else if (!G.saveOk) bookMoveStatus.textContent = '存档未写入，传阅安排照旧。';
  refreshReadingSeats();
};
bookDestination.onchange = () => { bookMoveButton.disabled = !bookDestination.value; };
bookMoveButton.onclick = () => {
  const source = selectedReadingSeat();
  const target = G.furniture.find(f => f.key === bookDestination.value);
  if (!source || G.mode !== 'live') return;
  if (moveBookRecommendation(source, target)) {
    readingSeat.value = target.key;
    bookDestination.value = '';
    bookMoveStatus.textContent = '荐书便条已移到这把椅子。';
    readingSeat.focus();
  } else {
    bookMoveStatus.textContent = G.saveOk ? '这把椅子现在不能接收便条。' : '存档未写入，便条留在原位。';
  }
  refreshReadingSeats();
};
bookSeatButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live' || !toggleBookSeat(chair)) return;
  refreshReadingSeats();
  save();
};
bookDiscussButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live' || !toggleBookDiscussion(chair)) return;
  refreshReadingSeats();
};
bookPublicButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live' || !togglePublicBook(chair)) return;
  refreshReadingSeats();
};
bookPaperButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live') return;
  const readers = bookPaperReaders(chair);
  if (!readers.length) return;
  const draft = bookPaperDraft();
  if (draft) {
    const note = bookRecommendation(chair), author = communityDoll(note.from);
    if (!confirm(`原稿：${draft.result[2]}\n新稿：${bookPaperText(author, readers, note)}。\n\n换稿后只刊登新稿，新便条也会收起。要换稿吗？`)) return;
  }
  if (!submitBookToPaper(chair, draft)) return;
  bookMoveStatus.textContent = draft ? '本期月报已换稿，新便条已收起。' : '书摘已交给本期月报，窗边的便条已收起。';
  refreshReadingSeats();
  readingSeat.focus();
};
bookKeepForPaperButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live' || !keepSharedBookForPaper(chair)) return;
  refreshReadingSeats();
};
bookQuestionButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live') return;
  if (toggleBookQuestion(chair)) bookMoveStatus.textContent = bookRecommendation(chair).question ? '问题已写在便条上。' : '已撤下问题。';
  else if (!G.saveOk) bookMoveStatus.textContent = '存档未写入，便条照旧。';
  refreshReadingSeats();
};
bookReplyButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live') return;
  if (!replyToBookRecommendation(chair)) {
    if (!G.saveOk) bookMoveStatus.textContent = '存档未写入，便条仍可传阅。';
    return;
  }
  bookMoveStatus.textContent = '传阅已结束，回信留在窗边。';
  refreshReadingSeats();
  readingSeat.focus();
};
soloReadingButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair || G.mode !== 'live') return;
  chair.soloReading = !chair.soloReading;
  if (!chair.soloReading) {
    delete chair.readingNotes;
    delete G.keepsakes.bookRecommendations[chair.key];
  }
  refreshReadingSeats();
  save();
};
readingNotesButton.onclick = () => {
  const chair = selectedReadingSeat();
  if (!chair?.soloReading || G.mode !== 'live') return;
  chair.readingNotes = !chair.readingNotes;
  if (!chair.readingNotes) delete G.keepsakes.bookRecommendations[chair.key];
  refreshReadingSeats();
  save();
};

function refreshReadingSeats() {
  const seats = G.mode === 'live' ? G.furniture.filter(isWindowChair) : [];
  $('#readingSeatControls').hidden = !seats.length;
  if (!seats.length) return;
  const names = seats.map(f => `${readingRoomNames[cornerRoom(f)]} · 第 ${f.x + 1} 列，第 ${f.y >= FLOOR_SPLIT ? f.y - FLOOR_SPLIT + 1 : f.y - WALL_ROWS + 1} 排`);
  const options = JSON.stringify(seats.map((f, i) => [f.key, names[i]]));
  if (options !== readingSeatOptions) {
    const previous = readingSeat.value;
    readingSeat.replaceChildren(...seats.map((f, i) => {
      const option = el('option', '', names[i]);
      option.value = f.key;
      return option;
    }));
    if (seats.some(f => f.key === previous)) readingSeat.value = previous;
    readingSeatOptions = options;
  }
  const chair = seats.find(f => f.key === readingSeat.value) || seats[0];
  const pressed = String(chair.soloReading === true);
  if (soloReadingButton.getAttribute('aria-pressed') !== pressed) soloReadingButton.setAttribute('aria-pressed', pressed);
  readingNotesButton.hidden = !chair.soloReading;
  const notes = String(chair.readingNotes === true);
  if (readingNotesButton.getAttribute('aria-pressed') !== notes) readingNotesButton.setAttribute('aria-pressed', notes);
  const note = $('#readingSeatHint');
  const recommendation = bookRecommendation(chair);
  const publicReaders = publicBookReaders(recommendation);
  const reader = reservedBookReader(chair);
  bookSeatButton.hidden = !recommendation || !!publicReaders;
  bookDiscussButton.hidden = !recommendation || recommendation.reply === true || !chair.readingNotes || !!publicReaders;
  bookPublicButton.hidden = !recommendation || recommendation.reply === true || !chair.readingNotes;
  bookPublicButton.disabled = !!publicReaders?.length || !!chair.users.length;
  bookPaperButton.hidden = !publicReaders?.length;
  const draft = bookPaperDraft();
  const paperAction = draft ? '替换本期书摘' : '收起便条，交给月报';
  if (bookPaperButton.textContent !== paperAction) bookPaperButton.textContent = paperAction;
  const firstReader = firstPublicBookReader(chair);
  const completed = publicReaders?.length === BOOK_PUBLIC_READERS;
  bookKeepForPaperButton.hidden = publicReaders?.length !== 1;
  bookKeepForPaperButton.disabled = !firstReader;
  bookQuestionButton.hidden = publicReaders?.length !== 1;
  bookQuestionButton.disabled = !firstReader;
  const questioning = recommendation?.question === true;
  if (bookQuestionButton.getAttribute('aria-pressed') !== String(questioning)) bookQuestionButton.setAttribute('aria-pressed', String(questioning));
  bookQuestionHint.hidden = !questioning && publicReaders?.length !== 1;
  const questionText = completed && questioning ? `问：「${BOOK_QUESTION}」答：「${BOOK_ANSWER}」`
    : `「${BOOK_QUESTION}」下一位读完会回话，少得 ${BOOK_QUESTION_FUN_COST} 点乐趣，多恢复 ${BOOK_QUESTION_SOCIAL} 点社交。`;
  if (bookQuestionHint.textContent !== questionText) bookQuestionHint.textContent = questionText;
  const keeping = String(recommendation?.keepForPaper === true);
  if (bookKeepForPaperButton.getAttribute('aria-pressed') !== keeping) bookKeepForPaperButton.setAttribute('aria-pressed', keeping);
  const pickedReader = pickedBookReader(recommendation);
  const candidates = publicReaders?.length === 1
    ? residents().filter(d => canReadSharedBook(recommendation, publicReaders, d)) : [];
  bookReaderControls.hidden = !candidates.length;
  const readerOptions = JSON.stringify([chair.key, pickedReader?.pid, candidates.map(d => [d.pid, d.name, d.state === 'away']), questioning]);
  if (readerOptions !== bookReaderOptions) {
    const previous = bookReaderOptions && JSON.parse(bookReaderOptions);
    const pending = previous?.[0] === chair.key && previous[1] === (pickedReader?.pid || null) ? bookNextReader.value : null;
    const reward = fun => questioning ? `乐趣 +${fun - BOOK_QUESTION_FUN_COST} · 社交 +${BOOK_QUESTION_SOCIAL}` : `乐趣 +${fun}`;
    const open = el('option', '', `自由传阅 · ${reward(BOOK_PUBLIC_FUN)}`);
    open.value = '';
    bookNextReader.replaceChildren(open, ...candidates.map(d => {
      const option = el('option', '', `${d.name}${d.state === 'away' ? '（外出）' : ''} · ${reward(BOOK_PICKED_FUN)}`);
      option.value = d.pid;
      return option;
    }));
    bookNextReader.value = pending === '' || candidates.some(d => d.pid === pending) ? pending : pickedReader?.pid || '';
    bookReaderOptions = readerOptions;
  }
  bookNextReader.disabled = !firstReader;
  bookPickReaderButton.disabled = !firstReader || bookNextReader.value === (pickedReader?.pid || '');
  bookPaperButton.disabled = !bookPaperReaders(chair).length;
  bookReplyButton.hidden = publicReaders?.length !== 1;
  bookReplyButton.disabled = !firstReader;
  const sharing = String(!!publicReaders);
  if (bookPublicButton.getAttribute('aria-pressed') !== sharing) bookPublicButton.setAttribute('aria-pressed', sharing);
  const discussing = String(recommendation?.discuss === true);
  if (bookDiscussButton.getAttribute('aria-pressed') !== discussing) bookDiscussButton.setAttribute('aria-pressed', discussing);
  bookSeatButton.disabled = !!recommendation && !reader && furnitureInUse(chair, communityDoll(recommendation.to));
  if (bookSeatButton.getAttribute('aria-pressed') !== String(!!reader)) bookSeatButton.setAttribute('aria-pressed', String(!!reader));
  const text = reader ? `已给${reader.name}留座至 ${recommendation.seatUntil >= G.day * 1440 ? '下个月 ' : ''}${hhmm(recommendation.seatUntil)}，再点一次可取消。`
    : chair.soloReading ? chair.readingNotes
    ? (recommendation ? `${communityDoll(recommendation.to).name}有一条荐书便条，在这里读完一段就能回应。`
      : quietStudy(chair) ? '书房安静牌挂着，开放后才会留便条。' : '读完时，熟人还在附近就聊几句，走开了就留条荐书便条。')
    : '此席适合独处，路过的住户会让读者继续看书。'
    : quietStudy(chair) ? '书房重新开放后，熟人可在此搭话或共读。'
      : '熟人可在此搭话或共读。';
  const discussion = recommendation && chair.readingNotes
    ? ` ${discussing === 'true' ? '已约当面聊。' : ''}读完时${communityDoll(recommendation.from).name}若在附近有空，可一起聊书，各得 6 点社交。独自读完得 8 点乐趣。`
    : '';
  const waiting = pickedReader ? `正在等${pickedReader.name}${pickedReader.state === 'away' ? '回家' : '来读'}。 ` : '';
  const pickHint = candidates.length ? `${waiting}指定后只等这位住户。 ` : '';
  const deadline = publicReaders?.length ? `便条在 ${monthLabel(recommendation.until)}月底到期。` : '';
  const readingHistory = publicReaders?.map(communityDoll).filter(Boolean).map(d => {
    const room = bookReadingRoom(recommendation, d);
    return `${d.name}${room ? '在' + room : ''}读完`;
  }).join('，');
  const publicChoice = completed
    ? `两位读者的记录已留在便条上，可在空座时${draft ? '替换月报原稿' : '交给月报'}。${deadline}`
    : publicReaders?.length
    ? `${pickHint}${keeping === 'true' ? '第二位读完后会留下便条供交稿。移到另一间房可记录两处阅读地点。' : '可等两位读完再交稿。'}等待期间月报版位仍可被占用。${deadline}空座时也可立即交稿，或给推荐人留回信。对方读完得 ${BOOK_PRIVATE_FUN} 点乐趣，双方友情增加。`
    : '座位空闲时可改回私下荐书。';
  const hint = recommendation?.reply
    ? `${communityDoll(recommendation.from).name}的回信留给${communityDoll(recommendation.to).name}，须在原便条到期前读完。读完得 ${BOOK_PRIVATE_FUN} 点乐趣，友情也会增加。${reader ? ' ' + text : ''}`
    : publicReaders
    ? `已传阅 ${publicReaders.length}/${BOOK_PUBLIC_READERS} 人。${readingHistory ? readingHistory + '。' : `推荐人以外的住户读完各得 ${BOOK_PUBLIC_FUN} 点乐趣。`}${publicChoice}`
    : text + discussion + (recommendation && chair.readingNotes ? ` 全屋传阅会取消留座和当面聊，两位住户可各得 ${BOOK_PUBLIC_FUN} 点乐趣。` : '');
  if (note.textContent !== hint) note.textContent = hint;

  const destinations = seats.flatMap((seat, i) => canMoveBookRecommendation(chair, seat, recommendation)
    ? [[seat.key, names[i]]] : []);
  $('#bookMoveControls').hidden = !destinations.length;
  const destinationOptions = JSON.stringify(destinations);
  if (destinationOptions !== bookDestinationOptions) {
    const previous = bookDestination.value;
    bookDestination.replaceChildren(el('option', '', '选择另一把椅子'));
    bookDestination.options[0].value = '';
    for (const [key, name] of destinations) {
      const option = el('option', '', name);
      option.value = key;
      bookDestination.append(option);
    }
    if (destinations.some(([key]) => key === previous)) bookDestination.value = previous;
    bookDestinationOptions = destinationOptions;
  }
  bookMoveButton.disabled = !bookDestination.value;
}
studyQuietButton.onclick = () => {
  G.studyQuiet = !G.studyQuiet;
  G.studyQuietUntil = null;
  refreshSceneHint();
  save();
};
studyQuietTimer.onclick = () => {
  if (G.studyQuiet) return;
  G.studyQuietUntil = studyQuietTimed() ? null : Math.floor(absNow()) + STUDY_QUIET_MINUTES;
  refreshSceneHint();
  save();
};

function refreshSceneHint() {
  const hint = $('#hint');
  const resident = G.dolls.find(d => d.uid === G.sel);
  const text = G.mode === 'build' ? '选「院子家具」可以布置屋外，住户会自己去使用。'
    : resident ? furnitureOrderHint(resident, hoverFurniture)
    : '点住户，再点家具安排活动 · 拖到另一位身边可互动';
  if (hint.textContent !== text) hint.textContent = text;
  const strip = $('#residentQuick'), action = $('#quickFurniture');
  const quietHint = $('#studyQuietHint');
  studyQuietButton.hidden = G.mode !== 'live';
  quietHint.hidden = studyQuietButton.hidden;
  studyQuietTimer.hidden = studyQuietButton.hidden;
  studyQuietTimer.disabled = G.studyQuiet;
  const quietState = String(G.studyQuiet);
  if (studyQuietButton.getAttribute('aria-pressed') !== quietState) {
    studyQuietButton.setAttribute('aria-pressed', quietState);
  }
  const timed = studyQuietTimed();
  if (studyQuietTimer.getAttribute('aria-pressed') !== String(timed)) {
    studyQuietTimer.setAttribute('aria-pressed', String(timed));
  }
  const quietText = G.studyQuiet ? '路过的人不打扰，也不结伴读。'
    : timed ? `安静阅读至 ${G.studyQuietUntil >= G.day * 1440 ? '下个月 ' : ''}${hhmm(G.studyQuietUntil)}，到时恢复开放。`
      : '书房开放，熟人可以路过搭话或结伴阅读。';
  if (quietHint.textContent !== quietText) quietHint.textContent = quietText;
  refreshReadingSeats();
  if (!strip || !action) return;
  strip.hidden = G.mode !== 'live';
  for (const button of strip.children) {
    const pressed = String(Number(button.dataset.resident) === G.sel);
    if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
  }
  const available = furniture => !furniture.piece && !furnitureOrderBlock(resident, furniture)
    && (resident.act?.onFurn ? furniturePath(resident, furniture, resident.act.back.x, resident.act.back.y)
      : furniturePath(resident, furniture));
  const target = !strip.hidden && resident && (G.furniture.find(f => f.id === 'sofa' && available(f))
    || G.furniture.find(available));
  action.hidden = !target;
  if (target) {
    const label = `让${resident.name}去${furnitureAction(resident, target)} · ${FURNITURE[target.id].name}`;
    if (action.textContent !== label) action.textContent = label;
    action.onclick = () => arrangeFurniture(resident, target);
  }
}

/* ---------- 生活日志 ---------- */
function renderLog() {
  const box = $('#logList'); box.innerHTML = '';
  if (!G.log.length) { box.append(el('div', 'log-empty', '还没有发生什么事～')); return; }
  let day = null;
  for (let i = G.log.length - 1; i >= 0; i--) {
    const e = G.log[i];
    if (e.d !== day) { day = e.d; box.append(el('div', 'log-day', monthLabel(e.d))); }
    box.append(el('div', 'log-item', `<time>${hhmm(e.t)}</time><span>${esc(e.text)}</span>`));
  }
}
HOOK.logged = renderLog;
$('#btnLogClear').onclick = () => { G.log = []; renderLog(); save(); };

/* ---------- 顶栏 ---------- */
function setMode(m) {
  if (G.mode === 'build' && m !== 'build') cancelPlacing();
  G.mode = m; G.build.trash = false; G.build.placing = null; G.build.hover = null;
  document.querySelectorAll('.mode').forEach(b => {
    const active = b.dataset.mode === m;
    b.classList.toggle('on', active);
    b.setAttribute('aria-pressed', String(active));
  });
  $('#buildBar').hidden = m !== 'build';
  hoverFurniture = null;
  refreshSceneHint();
  if (m === 'build') renderPalette();
  SFX.play('click');
}
document.querySelectorAll('.mode').forEach(b => b.onclick = () => setMode(b.dataset.mode));
const houseControls = $('#houseControls');
const speedButtons = document.querySelectorAll('[data-speed]');
speedButtons.forEach(button => button.onclick = () => {
  G.speed = Number(button.dataset.speed);
  speedButtons.forEach(option => {
    const active = option === button;
    option.classList.toggle('on', active);
    option.setAttribute('aria-pressed', String(active));
  });
  SFX.play('click');
});
$('#btnSound').onclick = () => {
  const on = SFX.toggle();
  $('#btnSound').textContent = on ? '🔊 声音' : '🔇 声音';
  $('#btnSound').setAttribute('aria-pressed', String(on));
};
document.addEventListener('pointerdown', event => {
  if (houseControls.open && !houseControls.contains(event.target)) houseControls.open = false;
});
houseControls.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !houseControls.open) return;
  houseControls.open = false;
  houseControls.querySelector('summary').focus();
  event.stopPropagation();
});
$('#btnWardrobe').onclick = () => openWardrobe(G.sel || (G.dolls[0] && G.dolls[0].uid));

function updateClock() {
  const m = Math.floor(G.time), h = Math.floor(m / 60), mm = m % 60;
  $('#clock').textContent = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const S = seasonOf(G.day), Hd = holidayOf(G.day);
  const dayLabel = $('#dayLabel');
  dayLabel.textContent = `${monthLabel(G.day)} · ${S.icon}${S.name}${Hd ? ' · ' + Hd.icon + Hd.name : ''}`;
  dayLabel.title = dayLabel.textContent;
  const sky = h >= 21 || h < 6 ? '🌙' : h < 8 ? '🌅' : h >= 18 ? '🌇' : '☀️';
  $('#timeIcon').textContent = G.weather && G.weather !== 'sunny' ? WEATHER[G.weather].icon : sky;
  $('#timeIcon').title = WEATHER[G.weather || 'sunny'].name;
}

/* ---------- 布置面板 ---------- */
let tab = 'essentials';
const catalogTabs = document.querySelectorAll('#buildBar [data-tab]');
catalogTabs.forEach(button => button.onclick = () => {
  if (tab === button.dataset.tab) return;
  if (G.build.placing) cancelPlacing();
  tab = button.dataset.tab;
  catalogTabs.forEach(option => {
    option.classList.toggle('on', option === button);
    option.setAttribute('aria-pressed', String(option === button));
  });
  renderPalette();
  SFX.play('click');
});
$('#btnTrash').onclick = () => {
  if (G.build.placing) cancelPlacing();
  G.build.trash = !G.build.trash; $('#btnTrash').classList.toggle('on', G.build.trash);
  $('#buildHint').textContent = G.build.trash ? '删除模式：点击房间里的家具把它移走' : '选择家具后点击房间放置 · 点已有家具可以拿起移动 · 右键/Esc 取消';
  SFX.play('click');
};
$('#cancelFurniture').onclick = () => {
  cancelPlacing();
  $('#buildBar').querySelector('.tab.on')?.focus();
};
$('#btnReset').onclick = () => {
  if (!confirm('把房间恢复成默认布置吗？（住户会保留）')) return;
  const keepDolls = G.dolls.map(d => ({ guest: d.guest, pid: d.pid, name: d.name, gender: d.gender, heart: d.heart, zodiac: d.zodiac, mbti: d.mbti, persona: d.persona, job: d.job, money: d.money, look: d.look, needs: d.needs, routineTimes: d.routineTimes, away: d.state === 'away', awayUntil: d.awayUntil, lastWorkDay: d.lastWorkDay }));
  const keepRel = G.rel;
  const s = defaultHouseSave(); s.dolls = keepDolls; s.time = G.time; s.day = G.day; s.monthEvents = G.monthEvents;
  s.paperMoments = G.paperMoments;
  s.keepsakes = { ...G.keepsakes, corners: {}, project: null };
  s.home = { ...G.home, active: null };
  s.life = G.life;
  keepDolls.forEach(d=>{d.nextJob=G.dolls.find(o=>o.pid===d.pid)?.nextJob;});
  s.rel = keepRel; s.npcMemory = G.npcMemory; s.paper=G.paper; s.daily=G.daily; s.dayRelations=G.dayRelations; s.community=G.community; applySave(s); rebuild(); save(); HOOK.select(); renderPalette(); HOOK.toast('房间已恢复默认', true);
};

const iconCache = {};
function renderPalette() {
  const pal = $('#palette'); pal.innerHTML = '';
  $('#btnTrash').classList.toggle('on', G.build.trash);
  const cancel = $('#cancelFurniture');
  cancel.hidden = !G.build.placing;
  cancel.textContent = G.build.placing?.moved ? '放回原处' : '取消放置';
  pal.dataset.category = tab;
  const group = FURNITURE_GROUPS[tab];
  if (tab === 'keepsakes') {
    for (const piece of unplacedKeepsakes()) {
      const b = el('button', 'item' + (G.build.placing?.piece === piece.key ? ' on' : ''));
      b.type = 'button';
      b.append(furnitureIcon('handmadePlanter', 56, { piece: piece.key }), el('span', 'item-name', KEEPSAKE_FINISHES[piece.finish][0] + '花架'),
        el('small', 'item-purpose', piece.makers.join('和')));
      b.title = keepsakeLabel(piece);
      b.onclick = () => {
        if (G.build.placing?.moved) cancelPlacing();
        G.build.trash = false;
        G.build.placing = G.build.placing?.piece === piece.key ? null : { id: 'handmadePlanter', piece: piece.key };
        renderPalette();
      };
      pal.append(b);
    }
    if (!pal.children.length) pal.append(el('p', 'hint', '成品会出现在这里。到「小屋手记」约两位住户一起做花架。'));
  } else if (group) {
    for (const id of group) {
      const F = FURNITURE[id];
      const [price, lv] = SHOP[id], have = G.inv[id] || 0, locked = lv > G.level && !have;
      const b = el('button', 'item' + (G.build.placing && G.build.placing.id === id && !G.build.placing.moved ? ' on' : '') + (locked ? ' locked' : ''));
      iconCache[id] = iconCache[id] || furnitureIcon(id);
      const c = el('canvas'); c.width = c.height = 56 * PIXEL_SCALE; c.getContext('2d').drawImage(iconCache[id], 0, 0);
      const tag = TEST_MODE ? '无限库存' : have ? `仓库 ×${have}` : locked ? `🔒 ${LEVELS[lv].name}` : yuan(price);
      const purpose = F.use ? ACT_NAMES[F.use] : F.layer === 'wall' ? '挂墙' : '摆在地面';
      b.append(c, el('span', 'item-name', F.name), el('small', 'item-purpose', purpose),
        el('small', 'price' + (TEST_MODE || have ? ' own' : price > G.fund && !locked ? ' poor' : ''), tag));
      b.title = `${F.name} · ${purpose}`;
      b.onclick = () => {
        if (locked) { HOOK.toast(`🔒 扩建成「${LEVELS[lv].name}」才能买${F.name}`, true); SFX.play('deny'); return; }
        if (G.build.placing && G.build.placing.moved) cancelPlacing();
        G.build.trash = false;
        G.build.placing = G.build.placing && G.build.placing.id === id ? null : { id };
        SFX.play('click'); renderPalette();
      };
      pal.append(b);
    }
  } else {
    const isWall = tab === 'wall', list = isWall ? WALLS : FLOORS;
    for (const s of list) {
      const b = el('button', 'item' + ((isWall ? G.wall : G.floor) === s.id ? ' on' : ''));
      b.append(swatchIcon(s, isWall), el('span', null, s.name));
      b.onclick = () => { if (isWall) G.wall = s.id; else G.floor = s.id; SFX.play('place'); save(); renderPalette(); };
      pal.append(b);
    }
  }
}
HOOK.refresh = () => { renderShopBar(); if (G.mode === 'build') renderPalette(); };

/* ---------- 家庭基金与扩建 ---------- */
let shopBarState = '';
function renderShopBar() {
  const crowdDisabled = TEST_MODE || G.crowdDay === G.day;
  const state = `${G.level}:${G.fund}:${crowdDisabled}`;
  if (state === shopBarState) return;
  shopBarState = state;
  const fund = TEST_MODE ? '∞' : yuan(G.fund);
  $('#fundAmt').textContent = $('#fundTop').textContent = fund;
  const L = LEVELS[G.level], next = LEVELS[G.level + 1];
  $('#houseLv').textContent = `🏠 ${L.name}（Lv${G.level} · 最多 ${L.cap} 人）`;
  const ex = $('#btnExpand');
  ex.textContent = next ? `🔨 扩建成「${next.name}」${yuan(next.cost)}` : '🏰 已经是最大的房子了';
  ex.disabled = !next;
  ex.classList.toggle('ready', !!next && G.fund >= next.cost);
  $('#btnCrowd').disabled = crowdDisabled;
}
$('#btnCrowd').onclick = () => crowdfund();
$('#btnExpand').onclick = () => expand();

/* ---------- 衣橱 ---------- */
let wdUid = null, wdDir = 'down', wdFrame = 0, wdTimer = 0, wdPage = 'look', wdPose = 'stand';
let wdPresetGender = 'f';
const wdOriginalLooks = new Map();
const wdDoll = () => G.dolls.find(d => d.uid === wdUid);

function openWardrobe(uid) {
  const resident = residents().find(d => d.uid === uid) || residents()[0];
  if (!resident) return;
  wdUid = resident.uid;
  wdPresetGender = resident.gender;
  wdPage = 'look';
  wdOriginalLooks.clear();
  for (const d of residents()) wdOriginalLooks.set(d.uid, { ...d.look });
  $('#wardrobe').hidden = false; SFX.play('open');
  document.querySelector('.wd-body').scrollTop = 0;
  renderWardrobe();
}
function closeWardrobe() { $('#wardrobe').hidden = true; HOOK.select(); save(); }
$('#wdClose').onclick = closeWardrobe;
$('#wardrobe').addEventListener('pointerdown', e => { if (e.target.id === 'wardrobe') closeWardrobe(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#wardrobe').hidden) closeWardrobe(); });
document.querySelectorAll('.wd-dir button').forEach(b => b.onclick = () => { wdDir = b.dataset.dir; SFX.play('click'); drawWdPreview(); });
document.querySelectorAll('[data-wd-page]').forEach(b => b.onclick = () => {
  wdPage = b.dataset.wdPage; document.querySelector('.wd-body').scrollTop = 0; renderWardrobe();
});
$('#wdPose').onchange = e => { wdPose = e.target.value; wdFrame = 0; drawWdPreview(); };
$('#wdName').oninput = e => { const d = wdDoll(); if (d) { d.name = e.target.value.trim() || '无名'; renderWdTabs(); } };
$('#wdName').onchange = () => wdSaved();
$('#wdRandom').onclick = () => {
  const d = wdDoll(); if (!d) return;
  d.look = { ...randomLook(d.gender, knownResidentLooks(), G.dolls.map(o => o.look)), skin: d.look.skin }; SFX.play('love'); renderWardrobe(); wdSaved();
};
$('#wdShuffle').onclick = () => {
  const d = wdDoll(); if (!d) return;
  d.look = wearOutfit(d.look, pick(OUTFIT_SETS).id); SFX.play('pop'); renderWardrobe(); wdSaved();
};
$('#wdUndo').onclick = () => {
  const d = wdDoll(), original = wdOriginalLooks.get(d?.uid); if (!original) return;
  d.look = { ...original }; renderWardrobe(); wdSaved();
};
$('#wdRemove').onclick = () => {
  const d = wdDoll(); if (!d) return;
  if (residents().length <= 1) { HOOK.toast('至少要留一位住户哦', true); return; }
  if (!confirm(`真的要让 ${d.name} 搬走吗？`)) return;
  if (d.act) endAct(d);
  for (const o of G.dolls) if (o.act && o.act.partner === d) endAct(o);
  G.dolls = G.dolls.filter(o => o !== d);
  if (G.sel === d.uid) G.sel = null;
  HOOK.toast(`${d.name} 挥挥手搬走了`); wdUid = residents()[0].uid; renderWardrobe(); HOOK.select(); save();
};

function renderWdTabs() {
  const box = $('#wdTabs'); box.innerHTML = '';
  for (const d of residents()) {
    const b = el('button', d.uid === wdUid ? 'on' : '', esc(d.name));
    b.onclick = () => { wdUid = d.uid; wdPresetGender = d.gender; SFX.play('click'); renderWardrobe(); };
    box.append(b);
  }
}

function renderWardrobe() {
  const d = wdDoll(); if (!d) return;
  renderWdTabs();
  $('#wdName').value = d.name;
  document.querySelectorAll('[data-wd-page]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wdPage === wdPage)));
  $('#wdUndo').disabled = JSON.stringify(d.look) === JSON.stringify(wdOriginalLooks.get(d.uid));
  const scrollArea = document.querySelector('.wd-body'), scrollTop = scrollArea.scrollTop;
  const box = $('#wdOptions'); box.innerHTML = '';
  const section = (title, node) => { const s = el('div', 'opt'); s.append(el('h4', null, title), node); box.append(s); };
  const chips = (obj, key) => {
    const w = el('div', 'chips');
    for (const [k, name] of Object.entries(obj)) {
      const selected = (d.look[key] ?? (key === 'extra' ? 'none' : key === 'shoeStyle' ? 'classic' : key === 'features' ? 'plain' : '')) === k;
      const b = el('button', 'chip' + (selected ? ' on' : ''), name);
      b.setAttribute('aria-pressed', String(selected));
      if (key === 'hair') {
        b.classList.add('wd-hair');
        const cv = document.createElement('canvas'); cv.width = 20; cv.height = 24;
        cv.setAttribute('aria-hidden', 'true'); b.prepend(cv);
        dollPortrait(cv, { ...d.look, hair: k, acc: 'none' });
      }
      b.onclick = () => { d.look[key] = k; SFX.play('pop'); renderWardrobe(); wdSaved(); };
      w.append(b);
    }
    return w;
  };
  const swatches = (cols, key) => {
    const w = el('div', 'chips');
    cols.forEach((col, i) => {
      const b = el('button', 'swatch' + (d.look[key] === i ? ' on' : ''));
      b.style.background = col; b.setAttribute('aria-label', `${{ skin: '肤色', hairColor: '发色', topColor: '上衣颜色', bottomColor: '下装颜色', shoes: '鞋子颜色' }[key]} ${i + 1}`);
      b.setAttribute('aria-pressed', String(d.look[key] === i));
      b.onclick = () => { d.look[key] = i; SFX.play('pop'); renderWardrobe(); wdSaved(); };
      w.append(b);
    });
    return w;
  };
  if (wdPage === 'presets') {
    const filter = el('div', 'chips');
    for (const [gender, label] of [['f','女生形象 · 12 套'],['m','男生形象 · 12 套']]) {
      const b = el('button', 'chip' + (wdPresetGender === gender ? ' on' : ''), label);
      b.setAttribute('aria-pressed', String(wdPresetGender === gender));
      b.onclick = () => { wdPresetGender = gender; renderWardrobe(); }; filter.append(b);
    }
    section('选一套喜欢的模样', filter);
    box.append(el('p', 'hint', '更换发型、发色、衣服和配饰，保留肤色与人物设定。两组都可以试穿，也能随时还原。'));
    const sets = el('div', 'wd-sets');
    for (const set of RESIDENT_LOOK_SETS.filter(s => s.gender === wdPresetGender)) {
      const look = wearResidentLook(d.look, set.id);
      const selected = Object.entries(look).every(([key,value]) => (d.look[key] ?? (key==='features'?'plain':key==='extra'?'none':key==='shoeStyle'?'classic':undefined)) === value);
      const b = el('button', 'wd-set' + (selected ? ' on' : ''));
      b.setAttribute('aria-pressed', String(selected)); b.setAttribute('aria-label', '试穿形象：' + set.name);
      const cv = document.createElement('canvas'); cv.width=20; cv.height=24; cv.setAttribute('aria-hidden','true');
      b.append(cv,el('span',null,set.name)); dollPortrait(cv,look);
      b.onclick = () => { d.look=wearResidentLook(d.look,set.id); SFX.play('pop'); renderWardrobe(); wdSaved(); };
      sets.append(b);
    }
    section('整套形象 · 点小人试穿',sets);
  } else if (wdPage === 'look') {
    const sets = el('div', 'wd-sets');
    for (const set of OUTFIT_SETS) {
      const selected = Object.entries(set.look).every(([key, value]) => d.look[key] === value);
      const b = el('button', 'wd-set' + (selected ? ' on' : ''));
      b.setAttribute('aria-pressed', String(selected));
      const cv = document.createElement('canvas'); cv.width = 20; cv.height = 24;
      cv.setAttribute('aria-hidden', 'true');
      b.append(cv, el('span', null, set.name));
      dollPortrait(cv, wearOutfit(d.look, set.id));
      b.onclick = () => { d.look = wearOutfit(d.look, set.id); SFX.play('pop'); renderWardrobe(); wdSaved(); };
      sets.append(b);
    }
    section('今日穿什么 · 只换衣服，保留你的发型', sets);
    section('发型', chips(OUTFIT.hair, 'hair'));
    section('发色', swatches(OUTFIT.hairColor, 'hairColor'));
    section('肤色', swatches(OUTFIT.skin, 'skin'));
    section('脸部小细节', chips(OUTFIT.features, 'features'));
    section('上衣', chips(OUTFIT.top, 'top'));
    section('上衣颜色', swatches(OUTFIT.clothColor, 'topColor'));
    if (!['dress', 'pinafore'].includes(d.look.top)) section('下装', chips(OUTFIT.bottom, 'bottom'));
    if (!['dress', 'pinafore'].includes(d.look.top)) section(d.look.top === 'overall' ? '背带颜色' : '下装颜色', swatches(OUTFIT.clothColor, 'bottomColor'));
    section('鞋款', chips(OUTFIT.shoeStyle, 'shoeStyle'));
    section('鞋子颜色', swatches(OUTFIT.shoes, 'shoes'));
    section('头上配饰', chips(OUTFIT.acc, 'acc'));
    section('随身小物', chips(OUTFIT.extra, 'extra'));
  } else {
  const pers = el('div', 'chips');
  for (const [k, P] of Object.entries(PERSONAS)) {
    const b = el('button', 'chip' + (d.persona === k ? ' on' : ''), `${P.icon} ${P.name}<small>${P.desc}</small>`);
    b.onclick = () => { d.persona = k; SFX.play('pop'); say(d, pick(P.lines)); renderWardrobe(); wdSaved(); };
    pers.append(b);
  }
  section('性格', pers);
  const jobs = el('div', 'chips');
  for (const [k, J] of Object.entries(JOBS)) {
    const sub = J.start == null ? (k === 'artist' ? '不用出门 · 偶尔卖画' : '不用出门 · 没有收入') : `${hhmm(J.start)}–${hhmm(J.end)} · ${yuan(J.wage)}/月${k === 'student' ? ' · 不谈恋爱' : ''}`;
    const b = el('button', 'chip' + ((d.nextJob || d.job) === k ? ' on' : ''), `${J.icon} ${J.name}<small>${sub}</small>`);
    b.onclick = () => {
      changeResidentJob(d,k); SFX.play('pop');
      HOOK.toast(d.nextJob ? `这次先完成原来的工作，回来后转为${J.name}。` : k==='student' ? '已设为学生，不参与恋爱剧情；下月使用新作息。' : `已设为${J.name}，下月开始使用新作息。`,true);
      renderWardrobe(); wdSaved();
    };
    jobs.append(b);
  }
  section('职业', jobs);
  const gen = el('div', 'chips');
  for (const [k, n] of Object.entries(GENDERS)) {
    const b = el('button', 'chip' + (d.gender === k ? ' on' : ''), n);
    b.onclick = () => { d.gender = k; wdPresetGender = k; SFX.play('pop'); renderWardrobe(); wdSaved(); };
    gen.append(b);
  }
  section('性别', gen);
  const zs = el('div', 'chips');
  for (const z of ZODIAC) {
    const b = el('button', 'chip' + (d.zodiac === z.id ? ' on' : ''), `${z.icon} ${z.name}<small>${ELEMENTS[z.el].icon}${ELEMENTS[z.el].name}</small>`);
    b.onclick = () => { d.zodiac = z.id; SFX.play('pop'); renderWardrobe(); wdSaved(); };
    zs.append(b);
  }
  section('星座', zs);
  const mbtiPicker = el('select', 'mbti-picker');
  mbtiPicker.setAttribute('aria-label', 'MBTI 类型');
  for (const [code, name] of Object.entries(MBTI_NAMES)) {
    const option = el('option', null, `${code} · ${name}`);
    option.value = code;
    mbtiPicker.append(option);
  }
  mbtiPicker.value = mb(d);
  mbtiPicker.onchange = () => { d.mbti = mbtiPicker.value; SFX.play('pop'); renderWardrobe(); wdSaved(); };
  const mbtiBox = el('div', 'mbti-settings');
  mbtiBox.append(mbtiPicker, el('small', 'hint', `常见偏好 · ${MBTI_INTERESTS[mb(d)].map(use => ACT_NAMES[use]).join('、')}`));
  section('MBTI', mbtiBox);
  const hearts = el('div', 'chips');
  for (const [k, H] of Object.entries(HEARTS)) {
    const b = el('button', 'chip' + (d.heart === k ? ' on' : ''), `${H.icon} ${H.name}<small>${H.desc}</small>`);
    b.onclick = () => { d.heart = k; SFX.play('pop'); renderWardrobe(); wdSaved(); };
    hearts.append(b);
  }
  section('感情观', hearts);
  }
  scrollArea.scrollTop = scrollTop;
  drawWdPreview();
}
function drawWdPreview() {
  const d = wdDoll();
  document.querySelectorAll('.wd-dir button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dir === wdDir)));
  if (d) dollPortrait($('#wdCanvas'), d.look, wdDir, wdFrame, wdPose);
}

// 衣橱里每次换装都在预览下方显示一句确认，1.5 秒后消失
let wdSavedTimer = 0;
function wdSaved() {
  const s = $('#wdSaved');
  if (!s) return;
  s.textContent = '✓ 已换好';
  clearTimeout(wdSavedTimer);
  wdSavedTimer = setTimeout(() => { s.textContent = ''; }, 1500);
}

/* ---------- 串门、派对与入住 ---------- */
function updateCommunityStatus() {
  const event = G.community.active;
  const status = $('#communityStatus');
  const pending = G.community.deferredPicnic;
  $('#cancelPicnic').hidden = !pending;
  $('#picnicReschedule').hidden = !pending;
  $('#picnicFormatRow').hidden = !pending;
  const backups = pending ? residents().filter(d => d.pid !== pending.hostPid) : [];
  $('#picnicBackupRow').hidden = !backups.length;
  if (backups.length) {
    const key = JSON.stringify(backups.map(d => [d.pid, d.name]));
    if (picnicBackupSelect.dataset.options !== key) {
      picnicBackupSelect.dataset.options = key;
      picnicBackupSelect.replaceChildren(new Option('等原主人', ''), ...backups.map(d => new Option(d.name, d.pid)));
    }
    const value = picnicBackup(pending)?.pid || '';
    if (picnicBackupSelect.value !== value) picnicBackupSelect.value = value;
  }
  if (pending) {
    const format = pending.shortTea ? 'tea' : 'picnic';
    if (picnicFormatSelect.value !== format) picnicFormatSelect.value = format;
    const value = Object.hasOwn(PICNIC_WINDOW_LABELS, pending.window) ? pending.window : '';
    if ($('#picnicWindow').value !== value) $('#picnicWindow').value = value;
  }
  const outing = G.community.outing;
  status.hidden = !event && !pending && !outing;
  $('#picnicNotice').hidden = !event?.rainDeadline;
  if (event?.rainDeadline) {
    const visitor = communityDoll(event.guestPid);
    const host = communityDoll(event.hostPid);
    const covered = host && visitor && coveredPicnicSeats(host, visitor);
    const button = $('#picnicCovered');
    button.disabled = !covered;
    const coverHint = $('#picnicCoveredHint');
    coverHint.hidden = !!covered;
    const wish = visitor ? `${visitor.name}：${PICNIC_GUEST_WISHES[picnicGuestPreference(visitor)]} 两人都到场后，合意的安排会增加信任。` : '';
    const hint = $('#picnicGuestWish');
    if (hint.textContent !== wish) hint.textContent = wish;
  }
  for (const button of $('#picnicPlans').querySelectorAll('[data-picnic-window]')) button.disabled = !!pending;
  if ($('#neighborDialog').open) updateNeighborDialog();
  if (!event) {
    const window = Object.hasOwn(PICNIC_WINDOW_LABELS, pending?.window) ? PICNIC_WINDOW_LABELS[pending.window] : '原时段';
    const host = pending && communityDoll(pending.hostPid);
    const wait = host && picnicWaitReason(pending, host);
    const message = outing ? `🏡 ${communityDoll(outing.pid)?.name || '住户'}${outing.phase === 'leaving' ? '准备去隔壁' : '正在麦麦家做客'}`
      : pending ? `🧺 野餐已改期 · ${window} · ${pending.shortTea ? '室内短茶会 · ' : ''}${wait || (pending.shortTea ? '等客厅和通路就绪' : '等院子和通路就绪')}` : '';
    if (status.textContent !== message) status.textContent = message;
    return;
  }
  const style = GET_TOGETHERS[event.kind], host = communityDoll(event.hostPid), guest = communityDoll(event.guestPid);
  const plan = event.rainMode && PICNIC_PLANS[event.rainMode];
  const name = event.exchange ? '邻居来访' : event.shortTea ? '室内短茶会' : style.name;
  const label = event.leavingAt ? `👋 ${guest?.name || '朋友'} 正在回家` : `${style.icon} ${name} · ${host?.name || '住户'}和${guest?.name || '朋友'} · ${event.joined.length} 人参与${plan ? ' · ' + plan : ''}`;
  if (status.textContent !== label) status.textContent = label;
}
HOOK.community = updateCommunityStatus;
const picnicWindowSelect = $('#picnicWindow');
const picnicFormatSelect = $('#picnicFormat');
picnicFormatSelect.append(new Option(`院子野餐 · ${GET_TOGETHERS.picnic.minutes} 分钟 · 等天晴`, 'picnic'),
  new Option(`室内短茶会 · ${PICNIC_SHORT_MINUTES} 分钟 · 雨天可办`, 'tea'));
picnicFormatSelect.onchange = () => {
  if (!changePicnicFormat(picnicFormatSelect.value === 'tea')) updateCommunityStatus();
};
const picnicBackupSelect = $('#picnicBackup');
picnicBackupSelect.onchange = () => {
  if (!changePicnicBackup(picnicBackupSelect.value)) updateCommunityStatus();
};
for (const [key, label] of [['', '原时段'], ...Object.entries(PICNIC_WINDOW_LABELS)]) {
  const option = el('option', null, label);
  option.value = key;
  option.disabled = !key;
  picnicWindowSelect.append(option);
}
picnicWindowSelect.onchange = () => {
  if (!changePicnicWindow(picnicWindowSelect.value)) updateCommunityStatus();
};
$('#cancelPicnic').onclick = () => {
  if (!G.community.deferredPicnic) return;
  G.community.deferredPicnic = null;
  updateCommunityStatus();
  $('#btnNeighbor').focus();
  save();
  HOOK.toast('已取消改期的野餐。', true);
};

for (const [plan, label, window] of [
  ['inside', PICNIC_PLANS.inside], ['study', PICNIC_PLANS.study], ['umbrella', PICNIC_PLANS.umbrella], ['covered', PICNIC_PLANS.covered],
  ...Object.entries(PICNIC_WINDOWS).map(([key, slot]) =>
    ['postpone', `天晴后${slot.label}（${hhmm(slot.start)}–${hhmm(slot.end)}）`, key]),
  ['postpone', '天晴后第一个可用时段', 'flexible'],
]) {
  const button = el('button', 'btn small', label);
  button.type = 'button';
  if (plan === 'covered') {
    button.id = 'picnicCovered';
    button.setAttribute('aria-describedby', 'picnicCoveredHint');
  }
  if (window) button.dataset.picnicWindow = window;
  button.onclick = () => {
    if (!choosePicnicPlan(plan, window)) HOOK.toast(plan === 'covered' ? $('#picnicCoveredHint').textContent : plan === 'study'
      ? '去书房需要主人和访客都有空，也要有两个能走到的座位。'
      : '现在无法按这个办法继续，可以换一个安排。', true);
  };
  $('#picnicPlans').append(button);
}

function updateNeighborDialog() {
  const select = $('#neighborVisitor');
  const d = communityDoll(select.value), tie = d && neighborTie(d);
  const outing = G.community.outing;
  const visitor = outing?.phase === 'visiting' && communityDoll(outing.pid);
  const neighbor = communityDoll(NEIGHBOR_PID) || neighborProfile();
  const text = visitor ? `${visitor.name}正在门廊陪麦麦吃点心。` : neighborSchedule();
  $('#neighborStatus').textContent = text;
  const porch = $('#neighborPorch');
  const key = JSON.stringify([text, neighbor.look, visitor && visitor.look]);
  if (porch.dataset.scene !== key) {
    porch.dataset.scene = key;
    const cast = [neighbor, visitor].filter(Boolean);
    porch.replaceChildren(...cast.map(person => {
      const figure = el('figure');
      const portrait = el('canvas');
      portrait.width = 20; portrait.height = 24;
      dollPortrait(portrait, person.look, 'down', 0, visitor ? 'sit' : 'stand');
      const caption = el('figcaption'); caption.textContent = person.name;
      figure.append(portrait, caption);
      return figure;
    }));
  }
  $('#neighborTie').textContent = tie
    ? `来往了 ${tie.months} 个月 · 一起吃过 ${tie.meals} 次饭${tie.invited && G.day < tie.inviteMonth ? ' · 下个月可以赴约' : ''}`
    : '麦麦下午回家，有时会来送面包或借工具。';
  $('#neighborGo').disabled = !canVisitNeighbor(d);
}

$('#btnNeighbor').onclick = () => {
  const select = $('#neighborVisitor');
  select.replaceChildren(...residents().map(d => {
    const option = el('option'); option.value = d.pid; option.textContent = d.name; return option;
  }));
  const selected = residents().find(d => d.uid === G.sel);
  if (selected) select.value = selected.pid;
  else {
    const acquainted = residents().find(d => neighborTie(d)?.invited);
    if (acquainted) select.value = acquainted.pid;
  }
  updateNeighborDialog();
  $('#neighborDialog').showModal();
};
$('#neighborVisitor').onchange = updateNeighborDialog;
$('#neighborGo').onclick = () => {
  if (!startNeighborOuting(communityDoll($('#neighborVisitor').value))) HOOK.toast('现在走不到门口，稍后再去吧。', true);
};

$('#btnCommunity').onclick = () => {
  const hosts = availableHosts();
  const select = $('#communityHost');
  select.innerHTML = '';
  for (const d of hosts) {
    const option = el('option');
    option.value = d.pid; option.textContent = d.name; select.append(option);
  }
  if (hosts.some(d => d.uid === G.sel)) select.value = hosts.find(d => d.uid === G.sel).pid;
  const event = G.community.active;
  const ready = !event && !G.community.outing && absNow() >= G.community.nextEventAt && hosts.length > 0;
  $('#communityHelp').textContent = event ? `正在进行${GET_TOGETHERS[event.kind].name}，结束后可以再邀请朋友。`
    : !hosts.length ? '现在没有在家且醒着的住户。'
    : !ready ? '刚送走朋友，让小屋休息一会儿吧。'
    : '选一位住户做东。朋友会从门口进来，有空的室友可以加入派对。';
  const choices = $('#communityChoices');
  choices.innerHTML = '';
  for (const [kind, style] of Object.entries(GET_TOGETHERS)) {
    const button = el('button', 'btn small', `${style.icon} ${kind === 'visit' ? '请朋友来玩' : '办' + style.name}`);
    button.disabled = !ready;
    button.onclick = () => {
      if (startGetTogether(communityDoll(select.value), kind)) $('#communityDialog').close();
      else $('#communityHelp').textContent = '现在办不了。确认主人在家，门口和一楼客厅有通道和空位。';
    };
    choices.append(button);
  }
  $('#communityDialog').showModal();
};

function welcomeResident(d) {
  if (!d) { renderApplications(); return; }
  $('#applicationsDialog').close();
  G.sel = d.uid;
  say(d, '大家好，请多关照！');
  spawnHeart(d);
  SFX.play('love');
  HOOK.select();
  HOOK.toast(`${d.name} 搬进来啦！`);
  save();
}

function renderApplications() {
  const canMove = residents().length < residentLimit();
  $('#applicationSpace').textContent = `住户 ${residents().length} / ${residentLimit()}${canMove ? '' : ' · 小屋已住满，可以扩建或留待有空位时再邀请。'}`;
  const list = $('#applicationList');
  list.innerHTML = '';
  for (const application of G.community.applications) {
    const friend = G.community.friends.find(f => f.pid === application.pid);
    if (!friend) continue;
    const entry = el('div', 'application-row');
    const portrait = el('canvas'); portrait.width = 20; portrait.height = 24;
    dollPortrait(portrait, friend.look);
    const info = el('div', 'application-info');
    const title = el('strong'); title.textContent = friend.name;
    const host = communityDoll(friend.hostPid);
    const detail = el('small');
    detail.textContent = `${PERSONAS[friend.persona].name} · ${host ? host.name + '的朋友' : '来访过的朋友'} · 来访 ${friend.visits} 次`;
    info.append(title, detail);
    const button = el('button', 'btn small', '邀请入住');
    button.setAttribute('aria-label', `邀请 ${friend.name} 入住`);
    button.disabled = !canMove;
    button.onclick = () => welcomeResident(moveInApplicant(friend.pid));
    entry.append(portrait, info, button); list.append(entry);
  }
  if (!list.children.length) list.append(el('p', 'hint', '还没有入住申请。朋友来玩得开心，就可能在离开时留下申请。'));
  $('#btnRandomResident').disabled = !canMove;
}
$('#btnAddDoll').onclick = () => { renderApplications(); $('#applicationsDialog').showModal(); };
$('#btnRandomResident').onclick = () => {
  if (residents().length < residentLimit()) welcomeResident(addDoll(newcomerProfile()));
};

function updateKeepsakeDialog(reset = false) {
  if (reset) {
    for (const [i, id] of ['keepsakeMaker1', 'keepsakeMaker2'].entries()) {
      const select = $('#' + id);
      select.replaceChildren(...residents().map(d => {
        const option = el('option', null, '');
        option.textContent = d.name;
        option.value = d.pid;
        return option;
      }));
      select.selectedIndex = Math.min(i, residents().length - 1);
    }
    $('#keepsakeFinish').replaceChildren(...Object.entries(KEEPSAKE_FINISHES).map(([id, [name]]) => {
      const option = el('option', null, name);
      option.value = id;
      return option;
    }));
  }
  const project = G.keepsakes.project;
  const bench = G.furniture.some(f => f.id === 'craftBench');
  $('#keepsakeStatus').textContent = project ? project.people.map(pid => communityDoll(pid)?.name).join('和') +
    (project.work ? '正在给花架上色。' : '正准备去手工台。') : bench ?
    '选两位住户和一种颜色。等他们一起到手工台，成品就会放进「布置 → 纪念物」。' :
    '先到「布置 → 兴趣家具」摆一张奶糖手工台，台前给两位住户留出空位。';
  $('#keepsakeStart').disabled = !bench || !!project || residents().length < 2;
  const nameOf = pid => (communityDoll(pid) || G.community.friends.find(p => p.pid === pid))?.name;
  const notes = [];
  for (const f of G.furniture) {
    const record = G.keepsakes.corners[f.key], name = nameOf(record?.owner);
    if (!name) continue;
    const companions = record.regulars.filter(pid => pid !== record.owner).map(nameOf).filter(Boolean);
    notes.push(`${name}的${CORNER_NAMES[cornerKind(f) || 'read']} · ${FURNITURE[f.id].name}${companions.length ? ' · 也常来的有 ' + companions.join('、') : ''}`);
  }
  for (const tie of Object.values(G.keepsakes.traditions)) {
    const names = tie.people.map(nameOf);
    if (names.every(Boolean)) notes.push(`${names.join('和')} · 下雨时想再去书房喝茶`);
  }
  const list = (selector, items, empty) => {
    const nodes = (items.length ? items : [empty]).map(text => {
      const item = el('li', null, '');
      item.textContent = text;
      return item;
    });
    $(selector).replaceChildren(...nodes);
  };
  if (!notes.length) notes.push('常来坐坐，过几个月就会有属于自己的小角落。');
  notes.push('把两处熟悉的阅读角摆在同一房间、相隔三格以内。要好的室友看到对方在用时，有机会自己过去作伴。');
  notes.push('窗边椅子可以坐下看书。熟人顺路经过时可能打招呼，想清静的住户会先婉拒，再被打扰才可能换位置。');
  list('#keepsakeNotes', notes, '');
  list('#keepsakePieces', G.keepsakes.pieces.map(keepsakeLabel), '还没有一起做过的纪念物。');
}

$('#btnKeepsakes').onclick = () => {
  updateKeepsakeDialog(true);
  $('#keepsakesDialog').showModal();
};
$('#keepsakeStart').onclick = () => {
  const pair = ['#keepsakeMaker1', '#keepsakeMaker2'].map(id => communityDoll($(id).value));
  if (startKeepsakeProject(...pair, $('#keepsakeFinish').value)) {
    $('#keepsakesDialog').close();
    HOOK.toast('🧵 两位住户要去手工台做花架了', true);
  } else $('#keepsakeStatus').textContent = '请选择两位不同的住户。两人要在家有空，手工台前也要有两个能走到的空位。';
};

/* ---------- 主循环 ---------- */
load(); rebuild(); HOOK.select(); updateClock(); renderLog(); renderShopBar();
let last = performance.now(), uiT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (document.hidden) {
    requestAnimationFrame(loop);
    return;
  }
  update(dt); render();
  // 月报曾因玩家正忙（拖小人、衣橱、别的弹窗）而挂起：等空闲了再弹出来
  if (G.paperPending && typeof playerBusy === 'function' && !playerBusy()) { G.paperPending = false; updateHousePaperButton(); showHousePaper(); }
  uiT += dt;
  if (uiT > 0.25) {
    uiT = 0; updateClock(); refreshSceneHint(); tickInfo(); renderShopBar();
    if (G.community.active?.rainDeadline || G.community.deferredPicnic || $('#cancelPicnic').hidden === false) updateCommunityStatus();
    else if ($('#neighborDialog').open) updateNeighborDialog();
  }
  if (!$('#wardrobe').hidden) { wdTimer += dt; if (wdTimer > 0.18) { wdTimer = 0; wdFrame = (wdFrame + 1) % 4; drawWdPreview(); } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.getElementById('dailyPaper').onclick=showHousePaper;
document.getElementById('paperOlder').onclick = () => renderHousePaper(housePaperIndex - 1);
document.getElementById('paperNewer').onclick = () => renderHousePaper(housePaperIndex + 1);
document.getElementById('paperCopy').onclick = async () => {
  const issue = currentHousePaper();
  if (!issue) return;
  try {
    await navigator.clipboard.writeText(housePaperText(issue));
    HOOK.toast('已复制本期月报', true);
  } catch { HOOK.toast('可以选中月报文字手动复制', true); }
};
const paperAuto=document.getElementById('paperAuto');
const paperPreference = TEST_MODE ? 'house-test-paper-auto' : 'house-paper-auto';
paperAuto.checked=true;
try{paperAuto.checked=localStorage.getItem(paperPreference)!=='off';}catch{}
paperAuto.onchange=()=>{try{localStorage.setItem(paperPreference,paperAuto.checked?'on':'off');}catch{}};
updateHousePaperButton();

const houseOffline = $('#houseOffline');
houseOffline.checked = offlineEnabled();
houseOffline.onchange = () => {
  try {
    localStorage.setItem(OFFLINE_KEY, houseOffline.checked ? 'on' : 'off');
  } catch {
    houseOffline.checked = offlineEnabled();
    HOOK.toast('浏览器暂时无法保存这项设置。', true);
  }
};

document.getElementById('paperCard').onclick = () => {
  const issue = currentHousePaper();
  if (issue) saveHousePaperCard(issue);
};
function renderRewind(){
  const list=document.getElementById('rewindList');
  const snaps=SaveManager.snapshots(SaveManager.getStorage(),SAVE_KEY).sort((a,b)=>b.day-a.day);
  list.replaceChildren(...snaps.map(snap=>{
    const row=el('div','rewind-row',`<span>${monthLabel(snap.day)} 月初${snap.day===G.day?' · 本月':''}</span>`);
    const button=el('button','btn small ghost','回到这里');
    button.onclick=()=>{
      if(!confirm(`回到${monthLabel(snap.day)}月初？之后发生的事都会被改写。`))return;
      if(restoreHouseSnapshot(snap.index, snap)){
        document.getElementById('paperDialog').close();
        HOOK.select();updateClock();renderLog();renderShopBar();updateHousePaperButton();
        HOOK.toast(`🕰 回到了${monthLabel(G.day)}月初`,true);
      }else HOOK.toast('无法恢复这份快照，请检查存档状态。',true);
    };
    row.append(button);return row;
  }));
  if(!snaps.length)list.textContent='还没有快照。';
}
document.querySelector('.rewind-box').addEventListener('toggle',renderRewind);

// A visibility change and pagehide can describe the same departure.
let awaySince = lastSavedAt || Date.now();
function leaveHouse() {
  if (awaySince) return;
  awaySince = Date.now();
  save(true);
}

function returnToHouse() {
  if (document.hidden || !awaySince) return;
  const since = awaySince;
  awaySince = 0;
  last = performance.now();
  const away = catchUpOffline(since);
  if (away) {
    renderLog();
    HOOK.select();
    updateClock();
    if (away.happened) HOOK.toast(`🌙 离开期间，小屋发生了 ${away.happened} 件事`, true);
  }
  save();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) leaveHouse();
  else returnToHouse();
});
window.addEventListener('pagehide', leaveHouse);
window.addEventListener('pageshow', returnToHouse);
returnToHouse();
