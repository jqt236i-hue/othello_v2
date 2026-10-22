import { clearsDynamicObstacle, findPath, type PathOptions } from '../browser-vite/forest-plaza/activities/pathing';
const base: PathOptions = { groundAt: () => 0, bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, radius: 0 };
describe('森の広場 A*', () => {
  test('活動帰路の余白重なりからは離れられるが、近づけない', () => {
    const from={x:0,z:0},other={x:0,z:1.5};
    expect(clearsDynamicObstacle(from,{x:0,z:-.05},other,1.75)).toBe(true);
    expect(clearsDynamicObstacle(from,{x:0,z:.05},other,1.75)).toBe(false);
    expect(clearsDynamicObstacle({x:0,z:-1},{x:0,z:0},other,1.75)).toBe(false);
    expect(clearsDynamicObstacle(from,{x:2,z:0},other,1.75)).toBe(true);
  });
  test('大きい閉領域もヒープの重複候補で破綻せず探索を終える', () => {
    expect(findPath({x:-4,z:0},{x:4,z:0},{...base,blocked:x=>Math.abs(x)<.25})).toBeNull();
  });
  test('敷石の外へ歩ける', () => { const p = findPath({x:0,z:0}, {x:4,z:4}, base); expect(p?.at(-1)).toEqual({x:4,y:0,z:4}); });
  test('家具と他キャラを迂回する', () => { const p = findPath({x:-2,z:0}, {x:2,z:0}, {...base, blocked:(x,z)=>Math.abs(x)<0.5 && Math.abs(z)<1}); expect(p).not.toBeNull(); expect(p!.some(n=>Math.abs(n.z)>=1)).toBe(true); });
  test('段差と到達不能を返す', () => { expect(findPath({x:-2,z:0},{x:2,z:0},{...base,groundAt:x=>x>0?1:0})).toBeNull(); });
  test('斜めの角抜けをしない', () => { const p=findPath({x:0,z:0},{x:.25,z:.25},{...base,groundAt:(x,z)=>(x===.25&&z===0)||(x===0&&z===.25)?null:0}); expect(p?.length).toBeGreaterThan(2); });
  test('半径と探索数の上限を守る', () => { expect(findPath({x:0,z:0},{x:4,z:4},{...base,maxVisited:1})).toBeNull(); expect(findPath({x:0,z:0},{x:5,z:0},{...base,radius:.3})).toBeNull(); });
  test('作業配列を再利用しても前回の障害・親経路を持ち越さない', () => {
    for(let i=0;i<30;i++) {
      const reverse=i%2===1,from={x:reverse?2:-2,z:0},to={x:reverse?-2:2,z:0};
      const p=findPath(from,to,{...base,blocked:(x,z)=>Math.abs(x)<.25&&Math.abs(z)<(i%3===0?6:1)});
      if(i%3===0)expect(p).toBeNull();else {expect(p?.[0]).toEqual({...from,y:0});expect(p?.at(-1)).toEqual({...to,y:0});}
    }
  });
  test('床判定からの再入と例外後も作業配列を安全に再利用する', () => {
    let nested=false;
    const groundAt=()=>{if(!nested){nested=true;expect(findPath({x:0,z:0},{x:1,z:0},base)).not.toBeNull();}return 0;};
    expect(findPath({x:-1,z:0},{x:1,z:0},{...base,groundAt})).not.toBeNull();
    expect(()=>findPath({x:0,z:0},{x:1,z:0},{...base,groundAt:()=>{throw Error('floor');}})).toThrow('floor');
    expect(findPath({x:0,z:0},{x:1,z:0},base)).not.toBeNull();
  });
  test('必要な格子だけを調べる', () => { const groundAt=jest.fn(()=>0); findPath({x:0,z:0},{x:.5,z:0},{...base,groundAt}); expect(groundAt.mock.calls.length).toBeLessThan(300); });
});
