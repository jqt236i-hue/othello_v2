import { canReward, nearestAvailable, outsidePlaza, stepBall, type BallState } from '../browser-vite/forest-plaza/activities/ballPhysics';
import { favoriteFood } from '../browser-vite/forest-plaza/activities/foodLogic';
import { heldPropPose } from '../browser-vite/forest-plaza/activities/heldPropPose';
const ground = (p:{x:number;y:number;z:number},d:{x:number;y:number;z:number},distance:number) => {
  if(d.y>=0)return null;
  const t=(.16-p.y)/d.y;return t>=0&&t<=distance?{distance:t,normal:{x:0,y:1,z:0}}:null;
};
describe('森の広場 ごはんとボール',()=>{
  test('一人称の持ち物だけ55%にし、三人称の実寸を変えない',()=>{
    for(const touch of [false,true])for(const ball of [false,true]) {
      expect(heldPropPose('first',touch,ball).scale).toBe(.55);
      expect(heldPropPose('third',touch,ball)).toEqual({scale:1,x:.14,y:ball?-.08:-.05,z:-.10});
      expect(heldPropPose('first',touch,ball).z).toBeGreaterThan(-.10);
    }
  });
  test('好物はIDごとに固定され4種類に分かれる',()=>{
    const ids=['trap_stone','observer','gold_stone','fire_will','water_will','zombie'];
    for(const id of ids){expect(favoriteFood(id)).toBe(favoriteFood(id));expect(favoriteFood(id)).toBeGreaterThanOrEqual(0);expect(favoriteFood(id)).toBeLessThan(4);}
    expect(new Set(ids.map(favoriteFood)).size).toBeGreaterThan(1);
  });
  test('重力による放物線',()=>{
    const s:BallState={position:{x:0,y:2,z:0},velocity:{x:4,y:3,z:0}};
    stepBall(s,.2,()=>null);expect(s.position.x).toBeCloseTo(.8);expect(s.position.y).toBeGreaterThan(2);expect(s.velocity.y).toBeCloseTo(1.04);
  });
  test('地面ではずんで摩擦で止まる',()=>{
    const s:BallState={position:{x:0,y:.3,z:0},velocity:{x:3,y:-2,z:1}};
    for(let i=0;i<12;i++)stepBall(s,1/120,ground);
    expect(s.velocity.y).toBeGreaterThan(0);
    for(let i=0;i<1200;i++)stepBall(s,1/120,ground);
    expect(s.position.y).toBeGreaterThanOrEqual(.159);expect(s.position.y).toBeLessThan(.18);
    expect(Math.hypot(s.velocity.x,s.velocity.z)).toBe(0);
  });
  test('高速でも壁を通り抜けず反射する',()=>{
    const s:BallState={position:{x:0,y:1,z:0},velocity:{x:40,y:0,z:0}};
    stepBall(s,.1,(p,d,dist)=>{const t=(.84-p.x)/d.x;return d.x>0&&t>=0&&t<=dist?{distance:t,normal:{x:-1,y:0,z:0}}:null;});
    expect(s.velocity.x).toBeLessThan(0);expect(s.position.x).toBeLessThan(.85);
  });
  test('範囲外と落下を検出する',()=>{
    expect(outsidePlaza({x:0,y:1,z:-3})).toBe(false);expect(outsidePlaza({x:14,y:1,z:-3})).toBe(true);expect(outsidePlaza({x:0,y:-4,z:-3})).toBe(true);
  });
  test('空いているキャラだけ近い順に最大2体選ぶ',()=>{
    const chars=[{isBusy:false,position:{x:4,z:0}},{isBusy:true,position:{x:0,z:0}},{isBusy:false,position:{x:2,z:0}},{isBusy:false,position:{x:1,z:0}}];
    expect(nearestAvailable(chars,{x:0,z:0})).toEqual([chars[3],chars[2]]);
    expect(nearestAvailable(chars,{x:0,z:0},0)).toEqual([]);
  });
  test('仲良し度はキャラごと5秒あける',()=>{expect(canReward(0,undefined)).toBe(true);expect(canReward(4.99,0)).toBe(false);expect(canReward(5,0)).toBe(true);});
});
