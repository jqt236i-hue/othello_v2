import { findPath, type PathOptions } from '../browser-vite/forest-plaza/activities/pathing';
const base: PathOptions = { groundAt: () => 0, bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, radius: 0 };
describe('森の広場 A*', () => {
  test('敷石の外へ歩ける', () => { const p = findPath({x:0,z:0}, {x:4,z:4}, base); expect(p?.at(-1)).toEqual({x:4,y:0,z:4}); });
  test('家具と他キャラを迂回する', () => { const p = findPath({x:-2,z:0}, {x:2,z:0}, {...base, blocked:(x,z)=>Math.abs(x)<0.5 && Math.abs(z)<1}); expect(p).not.toBeNull(); expect(p!.some(n=>Math.abs(n.z)>=1)).toBe(true); });
  test('段差と到達不能を返す', () => { expect(findPath({x:-2,z:0},{x:2,z:0},{...base,groundAt:x=>x>0?1:0})).toBeNull(); });
  test('斜めの角抜けをしない', () => { const p=findPath({x:0,z:0},{x:.25,z:.25},{...base,groundAt:(x,z)=>(x===.25&&z===0)||(x===0&&z===.25)?null:0}); expect(p?.length).toBeGreaterThan(2); });
  test('半径と探索数の上限を守る', () => { expect(findPath({x:0,z:0},{x:4,z:4},{...base,maxVisited:1})).toBeNull(); expect(findPath({x:0,z:0},{x:5,z:0},{...base,radius:.3})).toBeNull(); });
  test('必要な格子だけを調べる', () => { const groundAt=jest.fn(()=>0); findPath({x:0,z:0},{x:.5,z:0},{...base,groundAt}); expect(groundAt.mock.calls.length).toBeLessThan(300); });
});
