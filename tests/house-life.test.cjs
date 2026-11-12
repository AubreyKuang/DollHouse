const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(auto) {
  const node = () => ({
    children: [], textContent: '', setAttribute() {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; }
  });
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  getElementById('paperAuto').checked = auto;
  Object.assign(getElementById('paperDialog'), { open: false, showModal() { this.open = true; } });
  const G = {
    day: 17, paper: [], daily: {}, dayRelations: {},
    rel: {}, log: [],
    dolls: [{ pid: 'a', name: '阿懒', look: { hairColor: 1 } }, { pid: 'b', name: '团子', look: { hairColor: 2 } }]
  };
  const context = vm.createContext({
    G, document: { getElementById, createElement: node }, dollPortrait() {}
  });
  for (const script of ['calendar', 'house-life', 'paper-card']) vm.runInContext(fs.readFileSync(path.join(__dirname, `../js/${script}.js`), 'utf8'), context);
  return { G, getElementById, context };
}

test('monthly paper selects three distinct stories, prioritizes drama and keeps portrait snapshots', () => {
  const { G, getElementById, context } = load(true);
  G.log = [
    { d: 16, text: '阿懒的生日' },
    { d: 17, text: '💰 团子领到工资' },
    { d: 17, text: '🎉 团子邀请阿懒参加派对了' },
    { d: 17, text: '💔 阿懒和团子分手了' },
    { d: 17, text: '💢 阿懒和团子闹翻了' },
    { d: 17, text: '📮 小桃留下入住申请' },
    { d: 17, text: '♟ 团子和阿懒下了一局棋' },
  ];
  context.countHouseActivity('study', '阿懒');
  context.finishHouseMonth();
  assert.equal(getElementById('paperDialog').open, true);
  assert.equal(getElementById('paperText').children.length, 3);
  const issue = G.paper[0];
  assert.equal(issue.month, '2 年 5 月');
  assert.equal(issue.stories[0].text, '阿懒和团子分手了');
  assert.equal(issue.stories[0].people.length, 2);
  assert.equal(getElementById('paperText').children[0].children[0].children.length, 2);
  G.dolls[0].look.hairColor = 4;
  assert.equal(issue.stories[0].people[0].look.hairColor, 1);
  const text = context.housePaperText(issue);
  assert.match(text, /入住申请/);
  assert.match(text, /派对/);
  assert.doesNotMatch(text, /工资|闹翻|生日|书桌|棋/);
  assert.equal(Object.keys(G.daily).length, 0);
});

test('the archive opens one issue at a time, including legacy reports', () => {
  const { G, getElementById, context } = load(false);
  for (let i = 0; i < 29; i++) { G.day++; context.finishHouseMonth(); }
  G.paper.unshift('第 13 天 · 周六\n头条　阿懒和团子分手了\n工资　阿懒 · 2 次');
  assert.equal(getElementById('paperDialog').open, false);
  assert.equal(G.paper.length, 30);
  context.showHousePaper();
  assert.equal(getElementById('paperDialog').open, true);
  assert.equal(getElementById('paperNewer').disabled, true);
  assert.equal(getElementById('paperText').children.length, 1);
  context.renderHousePaper(0);
  assert.equal(getElementById('paperOlder').disabled, true);
  assert.equal(getElementById('paperMonth').textContent, '2 年 1 月');
  assert.match(context.housePaperText(context.currentHousePaper()), /阿懒和团子分手了/);
  assert.doesNotMatch(context.housePaperText(context.currentHousePaper()), /工资/);
});
