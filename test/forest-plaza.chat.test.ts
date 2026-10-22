jest.mock('../browser-vite/forest-plaza/lines', () => ({pickLine: (_id:string, scene:string, _hearts:number, vars:Record<string,string>) => `${scene}:${vars.partner}`}));
import { createChatActivity } from '../browser-vite/forest-plaza/activities/chat';
import type { ActivityContext } from '../browser-vite/forest-plaza/activities/types';
import type { AutoEvent } from '../browser-vite/forest-plaza/activities/director';
import type { PlazaCharacter } from '../browser-vite/forest-plaza/characters';
class Point {
  constructor(public x=0,public y=0,public z=0){}
  clone(){return new Point(this.x,this.y,this.z)}
  add(p:Point){this.x+=p.x;this.y+=p.y;this.z+=p.z;return this}
  sub(p:Point){this.x-=p.x;this.y-=p.y;this.z-=p.z;return this}
  set(x:number,y:number,z:number){this.x=x;this.y=y;this.z=z;return this}
  setY(y:number){this.y=y;return this}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}
  normalize(){return this.multiplyScalar(1/(Math.sqrt(this.lengthSq())||1))}
  multiplyScalar(n:number){this.x*=n;this.y*=n;this.z*=n;return this}
  addScaledVector(p:Point,n:number){return this.add(p.clone().multiplyScalar(n))}
}
function setup(){
  let spec!:AutoEvent;
  const chars=[-1,1].map((x,i)=>({info:{id:String(i),label:i?'大きい子':'小さい子'},radius:i?.6:.25,height:i?1.85:.4675,position:new Point(x,0,-2),isBusy:true,setPose:jest.fn(),lookAt:jest.fn(),stopPath:jest.fn(),walkPath:jest.fn((_path,_speed,done)=>done(true))})) as unknown as PlazaCharacter[];
  const finish=jest.fn(()=>chars.forEach(c=>Object.assign(c,{isBusy:false})));
  const ctx={visitors:new Map(chars.map(c=>[c.info.id,c])),player:{position:new Point(0,0,1)},camera:{position:new Point(0,1,1)},walkArea:{randomPoint:()=>({x:0,y:-2})},pathing:{find:(from:Point,to:Point)=>[from,to]},director:{sleeping:false,register(s:AutoEvent){spec=s;return jest.fn()}},sayText:jest.fn(),spawnHearts:jest.fn()} as unknown as ActivityContext;
  const activity=createChatActivity(ctx);
  return {chars,ctx,finish,activity,get spec(){return spec},start(){return spec.start(chars,finish)}};
}
describe('森の広場 会話の寿命',()=>{
  test.each(['sleep','pet','removed','dispose'] as const)('会話中の%sで双方を一度だけ解放する',kind=>{
    const s=setup();expect(s.start()).toBe(true);s.activity.update(.05);
    if(kind==='sleep'){s.ctx.director.sleeping=true;s.activity.update(.05)}
    if(kind==='pet')s.activity.onCharacterTouched!(s.chars[0],'pet');
    if(kind==='removed')s.activity.onCharacterRemoved!(s.chars[0]);
    if(kind==='dispose')s.activity.dispose();
    s.activity.dispose();expect(s.finish).toHaveBeenCalledTimes(1);expect(s.chars.every(c=>!c.isBusy)).toBe(true);
    for(const c of s.chars){expect(s.ctx.sayText).toHaveBeenCalledWith(c,'',0);expect(c.lookAt).toHaveBeenLastCalledWith(null)}
  });
  test('最初の発言者と相手名・交互発言・自然解散・終了後40秒待機',()=>{
    const random=jest.spyOn(Math,'random').mockReturnValue(0);try{
      const s=setup();s.start();for(let i=0;i<220;i++)s.activity.update(.05);
      const calls=(s.ctx.sayText as jest.Mock).mock.calls.filter(([,text])=>text);
      expect(calls.map(([c])=>c.info.id)).toEqual(['0','1','0','1']);
      expect(calls[0][1]).toBe('chatOpen:大きい子');expect(calls[1][1]).toBe('chatReply:小さい子');
      expect(calls.every(([, ,ms])=>ms>=2400&&ms<=3200)).toBe(true);expect(s.finish).toHaveBeenCalledTimes(1);
      expect(s.spec.eligible!(s.chars[0])).toBe(false);s.activity.update(40);expect(s.spec.eligible!(s.chars[0])).toBe(true);
    }finally{random.mockRestore()}
  });
  test('経路なしなら歩かせず占有を解放する',()=>{const s=setup();s.ctx.pathing.find=()=>null;expect(s.start()).toBe(false);expect(s.finish).toHaveBeenCalledTimes(1);expect(s.chars[0].walkPath).not.toHaveBeenCalled()});
});
