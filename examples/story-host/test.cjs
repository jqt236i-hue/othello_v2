const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createStorage}=require('./storage.cjs');
const initial=()=>({version:1,chapter:0,rewards:0,attempt:0,settledIds:[],battle:null});
test('progress and result receipt commit together, survive fresh runtime and recover backup',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'story-save-'));try{
 const port=createStorage(dir);await port.save(initial());
 const next={...initial(),chapter:1,rewards:1,settledIds:['gate-1:result']};await port.save(next);
 assert.deepEqual(await createStorage(dir).load(),next);
 await fs.writeFile(path.join(dir,'b.json'),'interrupted');assert.deepEqual(await createStorage(dir).load(),initial());
 await createStorage(dir).save(next);assert.deepEqual(await createStorage(dir).load(),next);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('future progress versions cannot fall back or be overwritten',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'story-future-'));try{
 const port=createStorage(dir);await port.save(initial());await port.save({...initial(),chapter:1});
 const data=JSON.stringify({...initial(),version:2,chapter:50});
 const future=JSON.stringify({data,sha256:require('node:crypto').createHash('sha256').update(data).digest('hex')});
 await fs.writeFile(path.join(dir,'b.json'),future);
 await assert.rejects(port.load(),{code:'STORY_SAVE_INCOMPATIBLE'});
 await assert.rejects(port.save(initial()),{code:'STORY_SAVE_INCOMPATIBLE'});
 assert.equal(await fs.readFile(path.join(dir,'b.json'),'utf8'),future);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
async function storyHarness(load){
 const source=await fs.readFile(path.join(__dirname,'story.ts'),'utf8');
 const code=require('typescript').transpileModule(source,{compilerOptions:{target:99,module:99}}).outputText.replace(/^import .*;\r?\n/gm,'').replace(/^export \{\};?\s*$/gm,'');
 const elements=new Map(),writes=[],finished=deferred();let disposed=0,mounts=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',onclick:null});return elements.get(id)};
 const checkpoint={config:{battleId:'gate-1'}};
 const context={document:{getElementById:element,documentElement:{dataset:{}}},window:{storyStorage:{load:()=>load,save:async value=>writes.push(structuredClone(value))}},
  crypto:require('node:crypto').webcrypto,Uint32Array,Error,
  mountBattle:()=>{mounts++;return {ready:Promise.resolve(),finished:finished.promise,save:async()=>checkpoint,dispose:()=>disposed++}}};
 const ready=require('node:vm').runInNewContext(`(async()=>{${code}})()`,context);
 return {element,writes,finished,ready,disposed:()=>disposed,mounts:()=>mounts};
}
test('start cannot overwrite progress while the initial load is pending and double clicks cannot create two battles',async()=>{
 const load=deferred(),h=await storyHarness(load.promise);
 assert.equal(h.element('start').disabled,true);
 await h.element('start').onclick();assert.equal(h.writes.length,0);
 load.resolve({...initial(),chapter:10,rewards:10,attempt:10});await h.ready;
 await Promise.all([h.element('start').onclick(),h.element('start').onclick()]);
 assert.equal(h.mounts(),1);assert.equal(h.writes[0].chapter,10);assert.equal(h.writes[0].rewards,10);assert.equal(h.writes[0].attempt,11);
});
test('runtime failure returns to conversation with the last committed checkpoint available',async()=>{
 const h=await storyHarness(Promise.resolve(initial()));await h.ready;await h.element('start').onclick();
 const writesBefore=h.writes.length;
 h.finished.resolve({kind:'error',message:'playback failed'});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.disposed(),1);assert.equal(h.element('scene').hidden,false);assert.equal(h.element('resume').hidden,false);
 assert.match(h.element('error').textContent,/最後に保存した状態/);assert.equal(h.writes.length,writesBefore);
});
test('reopening an already received result does not repeat chapter or reward updates',async()=>{
 const checkpoint={config:{battleId:'gate-1'}};
 const h=await storyHarness(Promise.resolve({...initial(),chapter:1,rewards:1,settledIds:['gate-1:result'],battle:checkpoint}));
 await h.ready;await h.element('resume').onclick();
 h.finished.resolve({kind:'finished',resultId:'gate-1:result',result:{winner:'black'}});
 await new Promise(resolve=>setImmediate(resolve));
 const saved=h.writes.at(-1);assert.equal(saved.chapter,1);assert.equal(saved.rewards,1);assert.equal(saved.battle,null);
 assert.equal(h.element('scene').hidden,false);
});
