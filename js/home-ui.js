let homeKind = 'supper', homeOnlyFavorites = false, pendingHomeImport = null;
function homeCast(people, small = false) {
  const cast = el('div', small ? 'home-mini-cast' : 'home-memory-cast');
  for (const d of people) {
    const figure = el('figure'), c = paperPortrait(d), name = el('figcaption');
    name.textContent = d.name; c.setAttribute('aria-hidden', 'true');
    figure.append(c, name); cast.append(figure);
  }
  return cast;
}
function showHomePage(page) {
  const album = page === 'album';
  $('#homeTodayPanel').hidden = album; $('#homeAlbumPanel').hidden = !album;
  for (const [id, selected] of [['homeToday', !album], ['homeAlbum', album]]) {
    $('#' + id).classList.toggle('on', selected);
    $('#' + id).setAttribute('aria-pressed', String(selected));
  }
  if (album) renderHomeAlbum();
}
function renderHomeWishes() {
  ensureHomeWishes();
  $('#homeOccasions').replaceChildren(...residents().filter(d=>birthdayOf(d)===monthOf(G.day)).map(d=>{
    const card=el('div','home-occasion'), text=el('span');
    text.textContent=birthdayDone(d) ? `🎂 ${d.name}的生日，这个月已经一起许过愿了。` : `🎂 本月是${d.name}的生日。${!isE(d)?'TA 更喜欢安静的祝福。':'一起热热闹闹地许个愿吧。'}`;
    card.append(homeCast([d],true),text);
    if(!birthdayDone(d)) { const button=el('button','btn small ghost','陪 TA 过生日');
      button.onclick=()=>{homeKind='birthday';renderHomeInvitation(d.pid,true)};card.append(button); }
    return card;
  }));
  $('#homeWishes').replaceChildren(...G.home.wishes.slice(-4).map(w => {
    const d = communityDoll(w.pid), card = el('article', 'home-wish' + (w.done ? ' fulfilled' : ''));
    const body = el('div'), title = el('small'), quote = el('p');
    title.textContent = w.done ? `${d.name} · 已经一起做过啦` : `${d.name}悄悄惦记着`;
    quote.textContent = `“${w.text}”`;
    body.append(title, quote);
    if (!w.done) {
      const button = el('button', 'btn small ghost', '就做这件事');
      button.onclick = () => { homeKind = w.kind; renderHomeInvitation(d.pid); };
      body.append(button);
    }
    card.append(homeCast([d], true), body); return card;
  }));
}
function selectedHomePeople() { return [...document.querySelectorAll('#homePeople input:checked')].map(n => n.value); }
function updateHomePlan() {
  const pids = selectedHomePeople();
  const reason = G.home.active ? '大家已经在活动中，关上手记就能看他们慢慢聚过来。' : prepareHomeTime(homeKind, pids, $('#homeFocus').value).reason;
  $('#homePlanStatus').textContent = reason || `约好 ${pids.length} 个人${HOME_TIMES[homeKind].name}。${HOME_TIMES[homeKind].cost && !TEST_MODE ? `开场时使用家庭基金 ¥${HOME_TIMES[homeKind].cost}。` : '不用花钱。'}`;
  $('#homeStart').disabled = !!reason;
}
function renderHomeInvitation(ownerPid, reset = false) {
  $('#homeKinds').replaceChildren(...Object.entries(HOME_TIMES).map(([key, theme]) => {
    const button = el('button', 'btn small' + (key === homeKind ? ' on' : ' ghost'));
    button.textContent = `${theme.icon} ${theme.name}`;
    button.setAttribute('aria-pressed', String(key === homeKind));
    button.onclick = () => { homeKind = key; renderHomeInvitation(undefined,true); };
    return button;
  }));
  $('#homeKindHint').textContent = HOME_TIMES[homeKind].hint;
  const special=homeKind==='birthday'||!!LESSON_SKILLS[homeKind], focus=$('#homeFocus');
  $('#homeFocusLabel').hidden=!special;
  $('#homeFocusCaption').textContent=homeKind==='birthday'?'为谁过生日？':'这次谁来学？';
  const candidates=special?lifeFocusCandidates(homeKind):[], oldFocus=focus.value;
  focus.replaceChildren(...candidates.map(d=>{const o=el('option');o.value=d.pid;o.textContent=d.name;return o}));
  focus.value=special?(candidates.find(d=>d.pid===ownerPid)?.pid||(!reset&&candidates.find(d=>d.pid===oldFocus)?.pid)||candidates[0]?.pid||''):'';
  if(special&&!candidates.length){const o=el('option');o.value='';o.textContent='本月暂时没有待庆祝的生日';focus.append(o);}
  focus.onchange=()=>renderHomeInvitation(focus.value,true);
  const previous = new Set(selectedHomePeople());
  const owner = communityDoll(special?focus.value:ownerPid);
  const available = residents().filter(d => !homeAvailability(d, homeKind));
  const skill=LESSON_SKILLS[homeKind];
  const recommended = owner ? [owner, ...available.filter(d => d !== owner && !tensionBetween(owner, d) &&
    (!skill || (talentLevel(d,skill)>=1 && talentRecord(d,skill).xp>talentRecord(owner,skill).xp)))].slice(0, 2)
    : available.slice(0, 2);
  const chosen = reset || ownerPid || !previous.size ? new Set(recommended.map(d => d.pid)) : previous;
  $('#homePeople').replaceChildren(...residents().map(d => {
    const label = el('label'), check = el('input'), body = el('span'), reason = homeAvailability(d, homeKind);
    check.type = 'checkbox'; check.value = d.pid; check.checked = chosen.has(d.pid) && !reason;
    check.disabled = !!reason; check.onchange = updateHomePlan;
    body.textContent = d.name + (reason ? ` · ${reason}` : skill ? ` · ${TALENT_NAMES[talentLevel(d,skill)]}` : ` · ${PERSONAS[d.persona].name}`);
    label.append(check, paperPortrait(d), body); return label;
  }));
  updateHomePlan();
}
function renderHomeAlbum() {
  const memories = G.home.album.filter(m => !homeOnlyFavorites || m.favorite).slice().reverse();
  const nodes = memories.map(memory => {
    const card = el('article', 'home-memory'), date = el('small'), title = el('h3'), body = el('p');
    date.textContent = `${monthLabel(memory.month)} · ${WEATHER[memory.weather]?.name || '在家'}`;
    title.textContent = memory.title; body.textContent = memory.text;
    const actions = el('div', 'home-memory-actions');
    const star = el('button', 'btn small ghost', memory.favorite ? '♥ 已珍藏' : '♡ 珍藏');
    star.setAttribute('aria-pressed', String(memory.favorite));
    star.onclick = () => {
      if (!memory.favorite && G.home.album.filter(m => m.favorite).length >= 60) {
        HOOK.toast('已经珍藏了 60 个时刻。可以下载纪念卡，或先取消一个珍藏。', true); return;
      }
      memory.favorite = !memory.favorite; save(); renderHomeAlbum();
    };
    const download = el('button', 'btn small ghost', '保存纪念卡');
    download.onclick = () => saveHousePaperCard({ title: '我们的小屋', month: monthLabel(memory.month), stories: [
      { label: memory.title, text: memory.text, icon: HOME_TIMES[memory.kind]?.icon || '🏡', people: memory.people }
    ] });
    actions.append(star, download);
    card.append(date, homeCast(memory.people), title, body, actions);
    return card;
  });
  if (!nodes.length) {
    const empty = el('div', 'home-album-empty');
    empty.append(homeCast(residents().slice(0, 4)));
    const text = el('p'); text.textContent = homeOnlyFavorites ? '喜欢的时刻，点一下「珍藏」就会留在这里。' : '相册的第一页，还在等我们一起写。';
    const sub = el('small'); sub.textContent = '一起吃饭、讲故事、做手作，回忆会带着当时的小人模样留在这里。';
    empty.append(text, sub); nodes.push(empty);
  }
  $('#homeMemories').replaceChildren(...nodes);
}
function updateHomeNow() {
  const active = G.home.active;
  $('#homeNow').hidden = !active;
  if (!active) return;
  const theme = HOME_TIMES[active.kind];
  $('#homeNowText').textContent = `${theme.icon} ${active.phase === 'gather' ? '正在等大家过来' : theme.name + '，慢慢来'}`;
  $('#homeNowCast').replaceChildren(homeCast(active.people.map(communityDoll).filter(Boolean), true));
}
HOOK.home = updateHomeNow;
$('#btnHome').onclick = () => {
  renderHomeWishes(); renderHomeInvitation(); showHomePage('today'); $('#homeDialog').showModal();
};
$('#homeToday').onclick = () => showHomePage('today');
$('#homeAlbum').onclick = () => showHomePage('album');
$('#homeFavorites').onclick = () => {
  homeOnlyFavorites = !homeOnlyFavorites;
  $('#homeFavorites').setAttribute('aria-pressed', String(homeOnlyFavorites)); renderHomeAlbum();
};
$('#homeStart').onclick = () => {
  const reason = startHomeTime(homeKind, selectedHomePeople(), $('#homeFocus').value);
  if (reason) { $('#homePlanStatus').textContent = reason; return; }
  $('#homeDialog').close(); HOOK.toast('约好啦，大家正走过来。', true);
};
$('#homeStop').onclick = () => cancelHomeTime();

function showHomeSaveStatus() {
  const status = SaveManager.status(SaveManager.getStorage(), SAVE_KEY);
  $('#saveState').textContent = status === 'newer' ? '此进度由新版游戏保存，请打开新版继续。'
    : status === 'conflict' ? '另一标签页已更新进度。本页已暂停保存。可先下载备份，再刷新读取最新进度。'
    : G.saveOk === false ? '⚠ 这次没有存入浏览器。请下载备份，避免进度丢失。'
    : `✓ ${monthLabel(G.day)} · ${residents().length} 位住户 · ${TEST_MODE ? '测试小屋' : '正式小屋'}`;
  try { $('#saveUndo').hidden = !localStorage.getItem(HOME_IMPORT_BACKUP); } catch { $('#saveUndo').hidden = true; }
}
function downloadHomeFile(text, filename) {
  const blob = new Blob([text], { type: 'application/json' }), url = URL.createObjectURL(blob), a = el('a');
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function refreshImportedHome() {
  pendingHomeImport = null; $('#savePreview').hidden = true; $('#saveFile').value = '';
  HOOK.select(); updateClock(); renderLog(); renderShopBar(); updateHousePaperButton();
  updateHomeNow(); showHomeSaveStatus();
  awaySince = 0; // Importing an old file never adds the time since it was exported.
}
$('#btnSaveHome').onclick = () => {
  save();
  showHomeSaveStatus();
  $('#saveFeedback').textContent = '';
  const controls = $('#houseControls');
  if (controls.open) {
    controls.open = false;
    controls.querySelector('summary').focus();
  }
  $('#saveDialog').showModal();
};
$('#saveExport').onclick = () => {
  downloadHomeFile(exportHomeSave(), `DollHouse-${TEST_MODE ? 'test-' : ''}${G.day}.json`);
  $('#saveFeedback').textContent = '备份已准备好，请在浏览器下载中保留这份文件。';
};
document.querySelector('label[for="saveFile"]').onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#saveFile').click(); }
};
$('#saveFile').onchange = async () => {
  const file = $('#saveFile').files[0]; pendingHomeImport = null; $('#savePreview').hidden = true;
  if (!file) return;
  try {
    if (file.size > HOME_FILE_LIMIT) throw Error('备份文件不能超过 5 MB。');
    pendingHomeImport = readPortableHome(await file.text());
    $('#savePreviewText').textContent = `准备恢复：${monthLabel(pendingHomeImport.day)}，${pendingHomeImport.dolls.filter(d => !d.guest).map(d => d.name).join('、')}的小屋。当前进度会先保留一份。`;
    $('#savePreview').hidden = false; $('#saveFeedback').textContent = '';
  } catch (error) { $('#saveFeedback').textContent = error.message; }
};
$('#saveImportCancel').onclick = () => { pendingHomeImport = null; $('#savePreview').hidden = true; $('#saveFile').value = ''; };
$('#saveImport').onclick = () => {
  if (!pendingHomeImport) return;
  try { importPortableHome(pendingHomeImport); refreshImportedHome(); $('#saveFeedback').textContent = '小屋恢复好了。需要时可以撤销这次导入。'; }
  catch (error) { $('#saveFeedback').textContent = error.message; }
};
$('#saveUndo').onclick = () => {
  if (!confirm('回到上次导入前的小屋？导入后发生的事将不再保留。')) return;
  try {
    const previous = readPortableHome(localStorage.getItem(HOME_IMPORT_BACKUP), true);
    importPortableHome(previous, true); refreshImportedHome(); $('#saveFeedback').textContent = '已经回到导入前的小屋。';
  } catch (error) { $('#saveFeedback').textContent = error.message; }
};
HOOK.saved = success => {
  $('#btnSaveHome').textContent = success ? '💾 存档备份与恢复' : '⚠️ 保存失败，下载备份';
  $('#btnSaveHome').classList.toggle('save-error', !success);
  if ($('#saveDialog').open) showHomeSaveStatus();
};
ensureHomeWishes(); updateHomeNow();
