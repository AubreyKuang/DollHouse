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
    G,WEEKDAYS:['周一','周二','周三','周四','周五','周六','周日'],
    weekday:day=>(day-1)%7,document:{getElementById:id=>elements[id]}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/house-life.js'),'utf8'),context);
  return {G,elements,context};
}

test('daily paper uses current-day counts and relations and opens by default', () => {
  const {G,elements,context}=load(true);
  context.countHouseDay('study','阿懒');
  context.countHouseDay('study','阿懒');
  context.finishHouseDay();
  assert.equal(G.paper.length,1);
  assert.equal(elements.paperDialog.open,true);
  assert.match(elements.dailyPaper.textContent,/日报 · 1/);
  assert.match(elements.paperText.textContent,/第 17 天 · 周三/);
  assert.match(elements.paperText.textContent,/书桌　阿懒 · 2 次/);
  assert.match(elements.paperText.textContent,/阿懒与团子：友好 -15/);
  assert.doesNotMatch(elements.paperText.textContent,/旧闻/);
  assert.equal(Object.keys(G.daily).length,0);
});

test('opting out keeps generating reports and the permanent button can read all retained issues', () => {
  const {G,elements,context}=load(false);
  for(let i=0;i<32;i++){G.day++;context.finishHouseDay();}
  assert.equal(elements.paperDialog.open,false);
  assert.equal(G.paper.length,30);
  context.showHousePaper();
  assert.equal(elements.paperDialog.open,true);
  assert.match(elements.paperText.textContent,/第 49 天/);
  assert.match(elements.paperText.textContent,/第 20 天/);
  assert.doesNotMatch(elements.paperText.textContent,/第 19 天/);
});
