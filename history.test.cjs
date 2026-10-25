const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
class Element {
  constructor(){this.children=[];this.listeners={};this.classList={add(){}};this.attrs={};this.style={};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(name,value){this.attrs[name]=value;}
  append(child){this.children.push(child);}
  replaceChildren(){this.children=[];}
  contains(){return false;}
}
const elements=new Map(),storage=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const context={console,Date,Math,Map,JSON,Number,String,Blob,URL,setTimeout,globalThis:{},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{querySelector:get,createElement:()=>new Element(),activeElement:null}};
vm.createContext(context);vm.runInContext(readFileSync('history.js','utf8')+'\nglobalThis.tracker=HistoryTracker;',context);
const tracker=context.globalThis.tracker;
const start=new Date(2026,0,10,23,50).getTime(),end=new Date(2026,0,11,0,10).getTime();
tracker.record('midnight',start,end,'focus');
tracker.record('midnight',start,end,'focus');
let saved=JSON.parse(storage.get('leise-history-v1'));
assert.equal(saved.length,1,'checkpoints do not duplicate segments');
// Navigate the calendar to the recorded month and inspect daily accessible details.
const now=new Date(), monthDistance=(now.getFullYear()-2026)*12+now.getMonth();
for(let i=0;i<Math.abs(monthDistance);i++)get(monthDistance>=0?'#previous-month':'#next-month').listeners.click();
const days=get('#calendar-days').children.filter(day=>day.attrs['aria-label']);
assert.match(days[9].attrs['aria-label'],/0,17 Std\. Lernen/,'before midnight');
assert.match(days[10].attrs['aria-label'],/0,17 Std\. Lernen/,'after midnight');
tracker.record('pause',end,end+5*60000,'short');
saved=JSON.parse(storage.get('leise-history-v1'));
assert.equal(saved.length,2);
assert.equal(saved[1].mode,'short');
async function checkImport(){
  const file={size:100,text:async()=>JSON.stringify({version:1,records:saved})};
  const target={files:[file],value:'backup.json'};
  await get('#history-file').listeners.change({target});
  await get('#history-file').listeners.change({target});
  assert.equal(JSON.parse(storage.get('leise-history-v1')).length,2,'reimport is idempotent');
  const before=storage.get('leise-history-v1');
  target.files=[{size:100,text:async()=>JSON.stringify({version:1,records:[{id:'bad',mode:'focus',start:0,end:-1}]})}];
  await get('#history-file').listeners.change({target});
  assert.equal(storage.get('leise-history-v1'),before,'invalid backup preserves history');
  context.document.querySelectorAll=()=>[];
  context.document.addEventListener=()=>{};
  context.window={addEventListener(){}};
  context.setInterval=()=>{};
  vm.runInContext(readFileSync('app.js','utf8'),context);
  vm.runInContext(`start();segmentStart-=60000;deadline-=60000;selectMode('short');`,context);
  assert.equal(JSON.parse(storage.get('leise-history-v1')).length,3,'mode switch saves partial study');
  vm.runInContext(`start();segmentStart-=30000;deadline-=30000;document.querySelector('#start').listeners.click();`,context);
  const result=JSON.parse(storage.get('leise-history-v1'));
  assert.equal(result.length,4,'pause saves partial break');
  assert.equal(result[3].mode,'short');
  for(const rounds of [1,2,3,12]) {
    get('#rounds').value=rounds;get('#rounds').listeners.change();
    vm.runInContext(`cycleCompleted=0;selectMode('focus');`,context);
    for(let i=0;i<rounds;i++){
      vm.runInContext('advance(true)',context);
      assert.equal(vm.runInContext('mode',context),i===rounds-1?'long':'short');
      assert.equal(get('#dots').children.length,rounds);
      if(i<rounds-1)vm.runInContext('advance(true)',context);
    }
    vm.runInContext('advance(true)',context);
    assert.equal(vm.runInContext('cycleCompleted',context),0);
  }
  get('#rounds').value=0;get('#rounds').listeners.change();
  assert.equal(vm.runInContext('settings.rounds',context),12,'invalid rounds rejected');
  assert.equal(JSON.parse(storage.get('tishe-settings')).rounds,12,'rounds persist');
  vm.runInContext('start()',context);get('#rounds').value=2;get('#rounds').listeners.change();
  assert.equal(vm.runInContext('running',context),true,'changing rounds preserves running timer');
  console.log('PASS: persistence, midnight splitting, import deduplication, invalid backups, partial study and break tracking.');
}
checkImport().catch(error=>{console.error(error);process.exitCode=1;});
