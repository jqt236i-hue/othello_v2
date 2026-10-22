import * as fs from 'fs';
import * as path from 'path';
import { lineKeyFor, pickLine, preloadLines } from '../browser-vite/forest-plaza/lines';
import { PLAZA_LINE_LOADERS } from '../browser-vite/forest-plaza/lines-index';
const folder=path.resolve(__dirname,'../browser-vite/forest-plaza/lines-data');
const legacy={greet:12,pet:16,petMore:12,idle:12};
const added=['sleepIn','sleep','wake','eat','eatFavorite','play','listen','pianoPlay','chatOpen','chatReply'];
const untiered=['pianoPlay','chatOpen','chatReply'];
const addedCounts:Record<string,number>={sleepIn:6,sleep:6,wake:6,eat:6,eatFavorite:6,play:6,listen:6,pianoPlay:12,chatOpen:20,chatReply:20};
describe('森の広場 セリフJSON',()=>{
 for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.json'))) test(file,()=>{
  const set=JSON.parse(fs.readFileSync(path.join(folder,file),'utf8'));
  for(const [key,count] of Object.entries(legacy)) {expect(set[key]).toHaveLength(6);set[key].forEach((tier:string[],i:number)=>{expect(tier).toHaveLength(key==='petMore'&&i===0?0:count);for(const line of tier){expect(typeof line).toBe('string');expect(line.trim().length).toBeGreaterThan(0);expect(line).not.toMatch(/[\r\n{}]/);}});}
  for(const key of added) {expect(set[key]).toBeDefined();expect(set[key]).toHaveLength(untiered.includes(key)?1:6);for(const tier of set[key]){expect(Array.isArray(tier)).toBe(true);expect(tier).toHaveLength(addedCounts[key]);for(const line of tier){expect(typeof line).toBe('string');expect(line.trim().length).toBeGreaterThan(0);expect(line).not.toMatch(/[\r\n]/);const tokens=line.match(/\{[^}]+\}/g)??[];for(const token of tokens)expect(key==='eat'||key==='eatFavorite'?['{food}']:key==='chatOpen'||key==='chatReply'?['{partner}']:[]).toContain(token);}}}
 });
 test('catalog の全キャラに loader がある',()=>{const catalog=JSON.parse(fs.readFileSync(path.resolve(folder,'../../../assets/forest-plaza/catalog.json'),'utf8'));for(const c of catalog.characters)expect(PLAZA_LINE_LOADERS[lineKeyFor(c.id)]).toBeDefined();});
 test('段階なしは常に先頭を使い、未置換候補を除外する',async()=>{
  (PLAZA_LINE_LOADERS as Record<string, () => Promise<{default:unknown}>>).foundation_fixture=async()=>({default:{greet:[['a']],pet:[['p']],petMore:[[]],idle:[['i']],chatOpen:[['先頭 {partner}','変数なし'],['選ばない']],eat:[['{food}だけ']]}});
  await preloadLines('foundation_fixture');
  for(let i=0;i<10;i++){expect(pickLine('foundation_fixture','chatOpen',5,{partner:'相手'})).toMatch(/^(先頭 相手|変数なし)$/);expect(pickLine('foundation_fixture','chatOpen',5)).toBe('変数なし');}
  expect(pickLine('foundation_fixture','eat',0,{food:'パン'})).toBe('パンだけ');expect(pickLine('foundation_fixture','eat',0)).not.toMatch(/\{/);
 });
 test('フォールバックを使える',async()=>{await preloadLines('work-stone');for(let i=0;i<30;i++){expect(pickLine('work-stone','chatOpen',5)).not.toMatch(/\{/);expect(pickLine('work-stone','eat',5,{food:'りんご'})).not.toMatch(/\{/);}expect(pickLine('missing','sleep')).toBeTruthy();});
});
