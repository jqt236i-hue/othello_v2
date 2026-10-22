import { ActivityDirector } from '../browser-vite/forest-plaza/activities/director';
import type { PlazaCharacter } from '../browser-vite/forest-plaza/characters';
function character(): PlazaCharacter { let owner: unknown = null; return {get isBusy(){return owner!==null;}, claim(value: unknown){if(owner!==null)return false;owner=value;return true;},release(value:unknown){if(owner===value)owner=null;}} as PlazaCharacter; }
describe('森の広場 director',()=>{
 test('間隔・同時数・占有を守り終了で解放する',()=>{
  const c=character(), d=new ActivityDirector(new Map([['a',c]]),()=>0); let end=()=>{}; const start=jest.fn((_chars,finish)=>{end=finish;});
  d.register({id:'piano',interval:10,start});d.update(9);expect(start).not.toHaveBeenCalled();d.update(1);expect(start).toHaveBeenCalledTimes(1);expect(c.isBusy).toBe(true);d.update(20);expect(start).toHaveBeenCalledTimes(1);end();expect(c.isBusy).toBe(false);d.update(10);expect(start).toHaveBeenCalledTimes(2);d.dispose();expect(c.isBusy).toBe(false);
 });
 test('寝ている間と人数不足では始めない',()=>{const c=character(),d=new ActivityDirector(new Map([['a',c]]),()=>0),start=jest.fn();d.register({id:'chat',interval:1,participants:2,start});d.update(10);expect(start).not.toHaveBeenCalled();d.register({id:'tag',interval:1,start});d.sleeping=true;d.update(100);expect(start).not.toHaveBeenCalled();d.sleeping=false;d.update(1);expect(start).toHaveBeenCalledTimes(1);d.dispose();});
 test('同じキャラを他の活動が使わず、最大2組を守る',()=>{const chars=new Map(Array.from({length:6},(_,i)=>[String(i),character()]));const d=new ActivityDirector(chars,()=>0);const start=jest.fn();d.register({id:'chat',interval:1,participants:2,maxConcurrent:2,start});d.update(1);d.update(1);d.update(1);expect(start).toHaveBeenCalledTimes(2);const a=start.mock.calls[0][0] as PlazaCharacter[],b=start.mock.calls[1][0] as PlazaCharacter[];expect(a.some(c=>b.includes(c))).toBe(false);d.dispose();expect([...chars.values()].some(c=>c.isBusy)).toBe(false);});
 test('失敗と登録解除で占有が残らない',()=>{const c=character(),d=new ActivityDirector(new Map([['a',c]]),()=>0);const off=d.register({id:'a',interval:1,start:()=>false});d.update(1);expect(c.isBusy).toBe(false);off();d.dispose();});
});
