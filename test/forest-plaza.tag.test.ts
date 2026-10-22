// 描画エンジンなしで経路・状態遷移を検証する最小ベクトル。
class Vector {
  constructor(public x=0,public y=0,public z=0) {}
  clone(){return new Vector(this.x,this.y,this.z)}
  copy(p:Vector){this.x=p.x;this.y=p.y;this.z=p.z;return this}
  add(p:Vector){this.x+=p.x;this.y+=p.y;this.z+=p.z;return this}
  sub(p:Vector){this.x-=p.x;this.y-=p.y;this.z-=p.z;return this}
  setY(y:number){this.y=y;return this}
  multiplyScalar(n:number){this.x*=n;this.y*=n;this.z*=n;return this}
  normalize(){return this.multiplyScalar(1/(Math.hypot(this.x,this.y,this.z)||1))}
  applyAxisAngle(_axis:Vector,angle:number){const x=this.x;this.x=x*Math.cos(angle)+this.z*Math.sin(angle);this.z=this.z*Math.cos(angle)-x*Math.sin(angle);return this}
}
const THREE={Vector3:Vector,Group:class {up=new Vector(0,1,0)}};
import { createTagActivity } from '../browser-vite/forest-plaza/activities/tag';
import type { ActivityContext } from '../browser-vite/forest-plaza/activities/types';
import type { AutoEvent } from '../browser-vite/forest-plaza/activities/director';
import type { PlazaCharacter } from '../browser-vite/forest-plaza/characters';

function setup() {
  let spec!: AutoEvent;
  const c = {info:{id:'small',label:'小さい子'},radius:.25,root:new THREE.Group(),position:new THREE.Vector3(-1,0,-1),isBusy:true,stopPath:jest.fn(),walkPath:jest.fn(),lookAt:jest.fn(),setPose:jest.fn()} as unknown as PlazaCharacter;
  const finish=jest.fn(()=>{Object.assign(c,{isBusy:false})});
  const ctx={player:{position:new THREE.Vector3(0,0,0),radius:.3,isFixed:false},visitors:new Map([['small',c]]),director:{sleeping:false,register(s:AutoEvent){spec=s;return jest.fn()}},hand:{current:null},hearts:()=>1,pathing:{find:(from:Vector,to:Vector)=>[{x:from.x,y:0,z:from.z},{x:to.x,y:0,z:to.z}]},say:jest.fn(),sayText:jest.fn(),spawnHearts:jest.fn(),addAffection:jest.fn()} as unknown as ActivityContext;
  const activity=createTagActivity(ctx);
  return {ctx,c,finish,activity,get spec(){return spec},start(){return spec.start([c],finish)}};
}
describe('森の広場 おにごっこの寿命と役交代',()=>{
  test('手持ち・睡眠・遠方・仲良し度で誘いを制限する',()=>{
    const s=setup();expect(s.spec.eligible!(s.c)).toBe(true);
    Object.assign(s.ctx.hand,{current:{}});expect(s.spec.eligible!(s.c)).toBe(false);
    Object.assign(s.ctx.hand,{current:null});s.ctx.player.position.x=10;expect(s.spec.eligible!(s.c)).toBe(false);
    s.ctx.director.sleeping=true;expect(s.start()).toBe(false);expect(s.finish).toHaveBeenCalledTimes(1);
  });
  test('接近先は通常mainのプレイヤー余白と格子丸めの外に置く',()=>{
    const s=setup();
    s.ctx.pathing.find=jest.fn((from,to)=>{
      const x=Math.round(to.x*4)/4,z=Math.round(to.z*4)/4;
      if(Math.hypot(x-s.ctx.player.position.x,z-s.ctx.player.position.z)<s.c.radius+s.ctx.player.radius+.3)return null;
      return [{x:from.x,y:0,z:from.z},{x,y:0,z}];
    });
    expect(s.start()).toBe(true);
    expect(s.c.walkPath).toHaveBeenCalled();
    s.activity.dispose();
  });
  test('誘いから捕獲を消費し、追跡・再捕獲を経て満足し+3する',()=>{
    const s=setup();expect(s.start()).toBe(true);s.activity.update(.05);s.activity.update(3);s.activity.update(.05);
    s.ctx.player.position.copy(s.c.position).add(new THREE.Vector3(0,0,1.1));
    expect(s.activity.onCharacterTouched!(s.c,'tap')).toBe(true);
    s.activity.update(1.5);s.activity.update(.05);
    expect(s.ctx.addAffection).not.toHaveBeenCalled();
    // キャラに捕まる→逃げる役へ戻る。
    s.ctx.player.position.copy(s.c.position).add(new THREE.Vector3(0,0,.9));s.activity.update(.05);s.activity.update(1.6);
    expect(s.activity.onCharacterTouched!(s.c,'tap')).toBe(true);
    expect(s.ctx.addAffection).toHaveBeenCalledWith(s.c,3);s.activity.update(3);
    expect(s.finish).toHaveBeenCalledTimes(1);s.activity.dispose();expect(s.finish).toHaveBeenCalledTimes(1);
  });
  test.each(['pet','remove','dispose','away','idle'] as const)('割込み/帰還/破棄/離脱/放置を片付ける: %s',kind=>{
    const s=setup();s.start();s.activity.update(.05);s.activity.update(3);
    if(kind==='pet')s.activity.onCharacterTouched!(s.c,'pet');
    if(kind==='remove')s.activity.onCharacterRemoved!(s.c);
    if(kind==='dispose'){s.activity.dispose();s.activity.dispose()}
    if(kind==='away'){s.ctx.player.position.x=20;s.activity.update(.1)}
    if(kind==='idle')s.activity.update(21);
    expect(s.finish).toHaveBeenCalledTimes(1);expect(s.ctx.addAffection).not.toHaveBeenCalled();expect(s.c.isBusy).toBe(false);
  });
});
