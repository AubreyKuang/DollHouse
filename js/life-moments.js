// Small milestones grow out of completed activities, not opening a menu.
const TALENTS = {
  cooking: { name: '做饭', icon: '🍳', uses: ['cook'], furniture: ['stove'],
    discoveries: ['软软的煎蛋', '一锅暖胃炖菜', '一桌拿手家常菜'] },
  music: { name: '音乐', icon: '🎹', uses: ['piano', 'strum'], furniture: ['piano', 'ukulele'],
    discoveries: ['连贯的小旋律', '自己的小变奏', '给室友伴奏'] },
  craft: { name: '手作', icon: '🧵', uses: ['craft', 'knit', 'repair'], furniture: ['craftBench', 'knitting', 'toolbox'],
    discoveries: ['整齐的小针脚', '布袋上的绣花', '教别人做手作'] },
};
const TALENT_STEPS = [0, 18, 54, 108];
const TALENT_NAMES = ['刚开始尝试', '渐渐上手', '有了拿手活', '可以带着别人做'];
const LESSON_SKILLS = { learnCooking: 'cooking', learnMusic: 'music', learnCraft: 'craft' };
Object.assign(HOME_TIMES, {
  birthday: { name: '一起过生日', icon: '🎂', title: '原来你们都记得', furniture: ['table'], cost: 20,
    hint: '生日月围桌许愿。内向的寿星喜欢轻声祝福，外向的寿星会拉大家一起拍手；开场使用家庭基金 ¥20。', need: { fun: 24, social: 22 } },
  learnCooking: { name: '教我一道菜', icon: '🍳', title: '这道菜，是你教我的', furniture: ['stove'], cost: 15,
    hint: '选一位想学的人和更熟练的室友，在灶台旁边做边学；材料使用家庭基金 ¥15。', need: { hunger: 20, fun: 12, social: 16 } },
  learnMusic: { name: '陪我练一小段', icon: '🎹', title: '终于跟上你的拍子', furniture: ['piano', 'ukulele'], cost: 0,
    hint: '选一位想学的人和更熟练的室友。弹错也没关系，对方会放慢一点。', need: { fun: 18, social: 18 } },
  learnCraft: { name: '一起学手作', icon: '🧵', title: '有人陪着，慢慢就会了', furniture: ['craftBench', 'knitting', 'toolbox'], cost: 0,
    hint: '选一位想学的人和更熟练的室友。一起练针脚、打结和收边。', need: { fun: 18, social: 18 } },
});

function restoreLifeMoments(saved) {
  const people = {};
  for (const [pid, skills] of Object.entries(saved?.people || {})) {
    if (!skills || typeof skills !== 'object' || ['__proto__', 'constructor', 'prototype'].includes(pid)) continue;
    people[pid] = {};
    for (const key of Object.keys(TALENTS)) {
      const s = skills[key];
      if (s && typeof s === 'object') people[pid][key] = {
        xp: Math.max(0, Math.min(108, Number(s.xp) || 0)), month: Math.max(0, Number(s.month) || 0),
        earned: Math.max(0, Math.min(18, Number(s.earned) || 0)),
      };
    }
  }
  return { people, birthdays: Array.isArray(saved?.birthdays) ? saved.birthdays.filter(b =>
    typeof b?.pid === 'string' && Number.isInteger(b.year) && b.year > 0).slice(-32) : [],
    inquiries: Array.isArray(saved?.inquiries) ? saved.inquiries.filter(q => q && typeof q.pid === 'string' &&
      Object.hasOwn(TALENTS,q.skill) && Number.isInteger(q.month) && Number.isFinite(q.after)).slice(-8) : [],
    birthdayInvites: Array.isArray(saved?.birthdayInvites) ? saved.birthdayInvites.filter(b=>typeof b?.pid==='string'&&Number.isInteger(b.month)).slice(-16) : [],
    lastLessonMonth: Number.isInteger(saved?.lastLessonMonth) ? saved.lastLessonMonth : 0,
    nextInvite: Number.isFinite(saved?.nextInvite) ? saved.nextInvite : 0 };
}
function talentRecord(d, skill) {
  const skills = G.life.people[d.pid] ||= {};
  if (!skills[skill]) {
    const seed = JOBS[d.job]?.talent === skill ? 18 : skill === 'cooking' ? (d.job === 'baker' ? 18 : d.persona === 'foodie' || d.job === 'barista' ? 6 : 0)
      : skill === 'music' && d.persona === 'nerd' ? 18 : skill === 'craft' && d.persona === 'maker' ? 18 : 0;
    skills[skill] = { xp: seed, month: G.day, earned: 0 };
  }
  return skills[skill];
}
const talentLevel = (d, skill) => TALENT_STEPS.filter(n => talentRecord(d, skill).xp >= n).length - 1;
const birthdayDone = d => G.life.birthdays.some(b => b.pid === d.pid && b.year === yearOf(G.day));
function gainTalent(d, skill, amount, teacher) {
  if (d.guest) return;
  const record = talentRecord(d, skill), before = talentLevel(d, skill), theme = TALENTS[skill];
  if (record.month !== G.day) { record.month = G.day; record.earned = 0; }
  const gain = Math.max(0, Math.min(amount, 18 - record.earned, 108 - record.xp));
  record.earned += gain; record.xp += gain;
  const after = talentLevel(d, skill);
  if (after <= before) return;
  const discovery = theme.discoveries[after - 1];
  const text = `${d.name}${teacher ? `在${teacher.name}的陪伴下，` : '慢慢练出了'}${teacher ? '学会了' : ''}「${discovery}」。`;
  say(d, `这次做到了！${discovery}。`, 4); d.happy = 5;
  d.needs.fun = Math.min(100, d.needs.fun + 8);
  addHomeMemory('growth', '家里多了一个拿手活', text, teacher ? [d, teacher] : [d], `talent:${d.pid}:${skill}:${after}`);
  NPCMemory.record(G, { type: 'small-milestone', time: absNow(), participants: teacher ? [d.pid, teacher.pid] : [d.pid], outcome: skill },
    [{ person: d.pid, subject: teacher?.pid || d.pid, emotion: .8, impact: 80, interpretation: text }]);
  addLog(`${theme.icon} ${text}`);
}
function finishTalentPractice(d, action) {
  if (!action.furn || !G.furniture.includes(action.furn) || (action.practiceTime || 0) < 3) return;
  const skill = Object.keys(TALENTS).find(key => TALENTS[key].uses.includes(action.type));
  if (!skill) return;
  gainTalent(d, skill, 6);
  const level = talentLevel(d, skill);
  if (level < 2 && G.life.lastLessonMonth !== G.day && Math.random() < .35 &&
      !G.life.inquiries.some(q => q.pid === d.pid))
    G.life.inquiries.push({ pid: d.pid, skill, month: G.day, after: absNow()+30 });
  if (skill === 'cooking') d.needs.hunger = Math.min(100, d.needs.hunger + level * 3);
  else d.needs.fun = Math.min(100, d.needs.fun + level * 2);
  if (skill === 'music') for (const listener of residents()) {
    if (listener.act?.type === 'join' && listener.act.target === d && listener.state === 'act' && canSee(d, listener))
      listener.needs.fun = Math.min(100, listener.needs.fun + level * 3);
  }
}
function tryLifeLesson(d) {
  if (d.guest || G.home.active || G.community.active || G.keepsakes.project || G.life.lastLessonMonth === G.day ||
      G.time < 8*60 || G.time > 20*60 || d.needs.energy < 35 || d.needs.hunger < 25) return false;
  const inquiry = G.life.inquiries.find(q => q.pid === d.pid && q.after <= absNow() && q.month >= G.day-1);
  if (!inquiry) return false;
  inquiry.after = absNow()+45;
  const teacher = residents().filter(o => o !== d && availableForHouseChat(o) && !homeAvailability(o,'stories') &&
    !tensionBetween(d,o) && rel(d,o).f >= 30 && canSee(d,o) && talentLevel(o,inquiry.skill)>=1 &&
    talentRecord(o,inquiry.skill).xp > talentRecord(d,inquiry.skill).xp)
    .sort((a,b)=>rel(d,b).f-rel(d,a).f)[0];
  if (!teacher) return false;
  const kind = Object.keys(LESSON_SKILLS).find(key=>LESSON_SKILLS[key]===inquiry.skill);
  if (startHomeTime(kind,[d.pid,teacher.pid],d.pid)) return false;
  G.life.lastLessonMonth = G.day;
  G.life.inquiries = G.life.inquiries.filter(q=>q!==inquiry);
  say(d,`刚才那一步没太会，可以教教我吗？`,3.5);
  save(); return true;
}
function lifeFocusCandidates(kind) {
  if (kind === 'birthday') return residents().filter(d => birthdayOf(d) === monthOf(G.day) && !birthdayDone(d));
  return residents();
}
function lifeTimePlan(kind, group, focusPid) {
  if (kind === 'birthday') {
    const honoree = focusPid ? group.find(d => d.pid === focusPid) : group.find(d => lifeFocusCandidates(kind).includes(d));
    if (!honoree || birthdayOf(honoree) !== monthOf(G.day)) return { reason: '选上本月过生日的住户，再邀请愿意陪 TA 的人。' };
    if (birthdayDone(honoree)) return { reason: `${honoree.name}今年已经一起许过愿啦。` };
    if (group.some(d=>d!==honoree&&rel(d,honoree).f<0)) return { reason: '有位室友现在不太愿意参加，先让彼此留一点空间。' };
    return { honoree: honoree.pid, year: yearOf(G.day), quiet: !isE(honoree) || ['nerd', 'lazy'].includes(honoree.persona) };
  }
  const skill = LESSON_SKILLS[kind];
  if (!skill) return {};
  if (group.length !== 2) return { reason: '一位想学的人、一位教 TA 的室友，先选两个人。' };
  const learner = group.find(d => d.pid === focusPid) || (focusPid ? null : group.slice().sort((a,b) => talentRecord(a,skill).xp - talentRecord(b,skill).xp)[0]);
  if (!learner) return { reason: '把想学的住户也选进这次活动里。' };
  const teacher = group.find(d => d !== learner);
  if (talentLevel(teacher,skill) < 1 || talentRecord(teacher,skill).xp <= talentRecord(learner,skill).xp)
    return { reason: `需要一位更熟练的室友。先实际${skill === 'cooking' ? '做几次饭' : skill === 'music' ? '弹几次琴' : '做几次手作'}，就能慢慢上手。` };
  if (rel(learner,teacher).f < 0) return { reason: '两个人现在不太愿意一起练，换一位室友吧。' };
  return { skill, learner: learner.pid, teacher: teacher.pid };
}
function lifeTimeValid(a, group) {
  const detail = a.detail || {};
  if (a.kind === 'birthday') {
    const honoree=group.find(d=>d.pid===detail.honoree);
    return !!honoree && group.every(d=>d===honoree||rel(d,honoree).f>=0) && !G.life.birthdays.some(b=>b.pid===detail.honoree&&b.year===detail.year);
  }
  if (LESSON_SKILLS[a.kind]) return group.length === 2 && group.some(d => d.pid === detail.learner) && group.some(d => d.pid === detail.teacher) && rel(group[0],group[1]).f >= 0;
  return true;
}
function lifeTimeLine(a, d, round) {
  const detail = a.detail || {};
  if (a.kind === 'birthday') {
    const honoree = communityDoll(detail.honoree);
    if (d === honoree) return round ? (detail.quiet ? '原来你们都记得。谢谢你们。' : '许好愿啦！明年也想和你们一起。')
      : detail.quiet ? '不用唱得很大声……这样就很好。' : '等一下，我要认真许个愿！';
    if (round) return detail.quiet ? '慢慢许愿，我们都在呢。' : '一、二、三，吹蜡烛啦！';
    return d.persona === 'foodie' ? `给${honoree.name}留了最大的一块。` : d.persona === 'maker' ? '这张小卡片是我亲手做的。'
      : d.persona === 'lazy' ? '我没忘，特意没有去睡午觉。' : `${honoree.name}，生日快乐。很高兴和你住在一起。`;
  }
  const skill = detail.skill;
  if (!skill) return null;
  const teaching = d.pid === detail.teacher;
  const lines = {
    cooking: teaching ? ['锅别太急，先把火调小一点。', '对，就是这个香味。下次你来掌勺。'] : ['我总怕翻坏……你帮我看一下。', '这回没有糊！下次做给你吃。'],
    music: teaching ? ['先跟我弹这几个音，慢一点。', '错一拍也没事，我们从这里接上。'] : ['刚才又弹错了……我再来一遍。', '跟上了！原来这里要轻一点。'],
    craft: teaching ? ['线别拉太紧，我把这一步做慢一点。', '这一针比刚才整齐多了。'] : ['这里总打结，能再教我一次吗？', '好了！这次我想自己收尾。'],
  };
  if (round === 0 && teaching && d.persona === 'lazy') return '我坐着慢慢教，你别着急。';
  return lines[skill][round];
}
function finishLifeTime(a, group) {
  const detail = a.detail;
  if (a.kind === 'birthday') {
    const honoree = group.find(d => d.pid === detail.honoree), others = group.filter(d => d !== honoree);
    G.life.birthdays.push({ pid: honoree.pid, year: detail.year });
    G.life.birthdays = G.life.birthdays.slice(-32);
    honoree.happy = 6;
    return { title: detail.quiet ? '轻声说一句生日快乐' : '大家都陪我许了愿',
      text: `${others.map(d=>d.name).join('、')}陪${honoree.name}过了生日，${detail.quiet ? '没有起哄，只轻声送上祝福' : '一起拍手、吹灭了蜡烛'}。原来大家都记得。` };
  }
  if (!detail?.skill) return null;
  const learner = group.find(d => d.pid === detail.learner), teacher = group.find(d => d.pid === detail.teacher);
  gainTalent(learner, detail.skill, 10, teacher);
  return { title: HOME_TIMES[a.kind].title,
    text: `${teacher.name}陪${learner.name}一起学${TALENTS[detail.skill].name}，${detail.skill === 'cooking' ? '从怕翻坏到亲手做完了一小份' : detail.skill === 'music' ? '弹错的地方又慢慢试了一遍' : '终于把总打结的那一步做好了'}。` };
}
function tickLifeMoments() {
  G.life.inquiries = G.life.inquiries.filter(q=>q.month >= G.day-1 && residents().some(d=>d.pid===q.pid)).slice(-8);
  for (const pid of Object.keys(G.life.people)) if (!residents().some(d=>d.pid===pid)) delete G.life.people[pid];
  if (G.home.active || G.community.active || G.community.outing || G.keepsakes.project ||
      G.time < 17*60 || G.time > 20*60 || absNow() < G.life.nextInvite || G.mode !== 'live') return;
  G.life.nextInvite = absNow() + 45;
  for (const honoree of lifeFocusCandidates('birthday')) {
    if (G.life.birthdayInvites.some(b=>b.pid===honoree.pid&&b.month===G.day)) continue;
    if (!availableForHouseChat(honoree) || homeAvailability(honoree,'birthday')) continue;
    const friends = residents().filter(d => d !== honoree && availableForHouseChat(d) && !homeAvailability(d,'birthday') &&
      !tensionBetween(honoree,d) && (rel(honoree,d).f >= 35 || arePartners(honoree,d)))
      .sort((a,b) => rel(honoree,b).f-rel(honoree,a).f);
    const group = [honoree];
    for (const d of friends) if (group.length < (isE(honoree) && !['nerd','lazy'].includes(honoree.persona) ? 4 : 2) &&
      group.every(o => !tensionBetween(o,d))) group.push(d);
    if (group.length >= 2 && !startHomeTime('birthday',group.map(d=>d.pid),honoree.pid)) {
      G.life.birthdayInvites=G.life.birthdayInvites.filter(b=>b.month>=G.day-1);
      G.life.birthdayInvites.push({pid:honoree.pid,month:G.day});save();
      HOOK.toast(`${friends[0].name}给${honoree.name}准备了一个小小的生日。`, true); break;
    }
  }
}
function talentSummary(d) {
  if (d.guest) return '';
  return Object.entries(TALENTS).map(([key,t]) => {
    const level = talentLevel(d,key);
    return `${t.icon} ${t.name} · ${level ? t.discoveries[level-1] : TALENT_NAMES[0]}`;
  }).join('　/　');
}
function drawLifeTime(c, f, x, y) {
  const a = G.home?.active;
  if (!a || a.anchor !== f.key || a.phase !== 'sharing') return;
  if (a.kind === 'birthday') {
    R(c,x+7,y+3,19,2,'#fff8e8'); R(c,x+9,y-3,15,6,'#d9989e');
    R(c,x+9,y-4,15,2,'#fff0d6'); R(c,x+11,y-2,2,2,'#f4c2b6'); R(c,x+20,y-2,2,2,'#f4c2b6');
    R(c,x+15,y-8,2,4,'#a7c8b5');
    if (a.elapsed < 10) R(c,x+15,y-11+Math.floor(G.t*3)%2,2,3,'#f8cf76');
    else if (a.elapsed < 13) R(c,x+16,y-12,1,2,'#f6ecd8');
    R(c,x+2,y+1,4,4,'#fff0d6'); R(c,x+3,y+2,2,1,'#ba838b');
  } else if (a.detail?.skill === 'cooking') {
    const steam=Math.floor(G.t*2)%3;
    R(c,x+6,y-7-steam,1,3,'#f6ecd8');R(c,x+10,y-10+steam,1,2,'#f6ecd8');
    R(c,x+5,y-1,7,2,'#b88769');R(c,x+6,y-3,5,2,'#f0d3a6');
  } else if (a.detail?.skill === 'music') {
    R(c,x+7,y-14,1,5,'#b17c87'); R(c,x+5,y-10,3,2,'#b17c87'); R(c,x+8,y-14,3,1,'#b17c87');
  } else if (a.detail?.skill === 'craft') {
    R(c,x+4,y+1,9,5,'#dba3ac'); R(c,x+5,y+2,7,1,'#f4d7be'); R(c,x+6,y,1,7,'#f5e4c8');
  }
}
