import { createBudgetedWarmup } from '../browser-vite/forest-plaza/activities/warmup';
import { createStaticPathHeights, findPath, type PathOptions } from '../browser-vite/forest-plaza/activities/pathing';

describe('森の広場 静的床の予熱', () => {
  test('1フレームの予算で分散し、完了後は余分な仕事をしない', () => {
    let clock=0; const visited:number[]=[];
    const work=createBudgetedWarmup([1,2,3,4,5], n=>{visited.push(n);clock+=1;},()=>clock);
    work.tick(2);expect(visited).toEqual([1,2]);expect(work.status().done).toBe(false);
    work.tick(2);expect(visited).toEqual([1,2,3,4]);work.tick(2);
    expect(work.status()).toMatchObject({done:true,processed:5,workMs:5,maxSliceMs:2});
    work.tick(10);expect(visited).toHaveLength(5);
  });
  test('予熱中の退出はiteratorを閉じ、その後に床を調べない', () => {
    let clock=0,closed=false;
    function* items(){try{yield 1;yield 2;yield 3;}finally{closed=true;}}
    const visit=jest.fn(()=>{clock++});const work=createBudgetedWarmup(items(),visit,()=>clock);
    work.tick(1);work.stop();work.stop();work.tick(100);
    expect(closed).toBe(true);expect(visit).toHaveBeenCalledTimes(1);expect(work.status().stopped).toBe(true);
  });
  test('半径別の静的高さは再利用し、動的障害はキャッシュしない', () => {
    const groundAt=jest.fn(()=>0),bounds={minX:-3,maxX:3,minZ:-3,maxZ:3};
    const cache=createStaticPathHeights(groundAt,bounds),height=cache.forRadius(.3);
    expect(height(0,0)).toBe(0);const n=groundAt.mock.calls.length;
    expect(cache.forRadius(.3)).toBe(height);height(0,0);expect(groundAt).toHaveBeenCalledTimes(n);
    const options:PathOptions={groundAt,bounds,radius:.3,staticHeightAt:height};
    const open=findPath({x:-2,z:0},{x:2,z:0},options)!;
    const blocked=findPath({x:-2,z:0},{x:2,z:0},{...options,blocked:(x,z)=>Math.abs(x)<.5&&Math.abs(z)<1})!;
    expect(open.some(p=>p.z!==0)).toBe(false);expect(blocked.some(p=>Math.abs(p.z)>=1)).toBe(true);
    expect(cache.forRadius(.6)).not.toBe(height);expect(cache.size).toBe(2);
  });
  test('事前計算と従来の半径・段差・家具・範囲判定が一致する', () => {
    const bounds={minX:-2,maxX:2,minZ:-2,maxZ:2};
    const groundAt=(x:number,z:number)=>x>.5&&z>.5?null:x< -1?.7:0;
    const cache=createStaticPathHeights(groundAt,bounds);
    for(const radius of [0,.3,.72])for(const goal of [{x:1,z:0},{x:1,z:1},{x:2,z:0},{x:-1.5,z:0}]){
      const options={groundAt,bounds,radius};
      expect(findPath({x:0,z:0},goal,{...options,staticHeightAt:cache.forRadius(radius)})).toEqual(findPath({x:0,z:0},goal,options));
    }
  });
});
