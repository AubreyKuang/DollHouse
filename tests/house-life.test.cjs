const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(auto) {
  const elements = {
    dailyPaper:{},
    paperAuto:{checked:auto},
    paperText:{},
    paperCopy:{},
    paperDialog:{open:false,showModal(){this.open=true;}}
  };
  const G = {
    day:17,paper:[],daily:{},dayRelations:{'a|b':70},
    rel:{'a|b':{f:55}},log:[{d:17,text:'团子弹了钢琴'},{d:16,text:'旧闻'}],
    dolls:[{pid:'a',name:'阿懒'},{pid:'b',name:'团子'}]
  };
  const context = vm.createContext({
    G,document:{getElementById:id=>elements[id]}
  });
  for (const script of ['calendar', 'house-life']) vm.runInContext(fs.readFileSync(path.join(__dirname,`../js/${script}.js`),'utf8'),context);
  return {G,elements,context};
}

test('monthly paper uses current-month counts and relations and opens by default', () => {
  const {G,elements,context}=load(true);
  context.countHouseActivity('study','阿懒');
  context.countHouseActivity('study','阿懒');
  context.finishHouseMonth();
  assert.equal(G.paper.length,1);
  assert.equal(elements.paperDialog.open,true);
  assert.match(elements.dailyPaper.textContent,/月报 · 1/);
  assert.match(elements.paperText.textContent,/2 年 5 月/);
  assert.match(elements.paperText.textContent,/书桌　阿懒 · 2 次/);
  assert.match(elements.paperText.textContent,/阿懒与团子：友好 -15/);
  assert.doesNotMatch(elements.paperText.textContent,/旧闻/);
  assert.equal(Object.keys(G.daily).length,0);
});

test('opting out keeps generating reports and the permanent button can read all retained issues', () => {
  const {G,elements,context}=load(false);
  for(let i=0;i<32;i++){G.day++;context.finishHouseMonth();}
  assert.equal(elements.paperDialog.open,false);
  assert.equal(G.paper.length,30);
  context.showHousePaper();
  assert.equal(elements.paperDialog.open,true);
  assert.match(elements.paperText.textContent,/5 年 1 月/);
  assert.match(elements.paperText.textContent,/2 年 8 月/);
  assert.doesNotMatch(elements.paperText.textContent,/2 年 7 月/);
});
