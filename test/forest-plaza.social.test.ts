import { compactSocialPath, chatAxisSign, chatPairAllowed, fleeCandidates, routeLength, TAG_SPEED, tagCatchDistance, tagShouldEnd } from '../browser-vite/forest-plaza/activities/socialRules';

describe('森の広場 会話とおにごっこの規則', () => {
  test('会話は近い二体だけ、両方の40秒待機終了後に選ぶ', () => {
    expect(chatPairAllowed({x:0,z:0},{x:6,z:0},40,60,60)).toBe(true);
    expect(chatPairAllowed({x:0,z:0},{x:6.01,z:0},0,0,60)).toBe(false);
    expect(chatPairAllowed({x:0,z:0},{x:1,z:0},61,0,60)).toBe(false);
    expect(chatPairAllowed({x:0,z:0},{x:1,z:0},0,61,60)).toBe(false);
  });
  test('走行の直線区間を整理し、家具を避ける角と段差を残す', () => {
    const path=[{x:0,y:0,z:0},{x:.25,y:0,z:0},{x:.5,y:0,z:0},{x:.5,y:0,z:.25}];
    expect(compactSocialPath(path)).toEqual([path[0],path[2],path[3]]);
    const hill=[{x:0,y:0,z:0},{x:.25,y:.2,z:0},{x:.5,y:0,z:0}];
    expect(compactSocialPath(hill)).toEqual(hill);
  });
  test('画面上の並びを選んでもキャラ同士を横切らせない', () => {
    expect(chatAxisSign({x:-1,z:0},{x:-2,z:-2},{x:1,z:-2})).toBe(-1);
    expect(chatAxisSign({x:1,z:0},{x:-2,z:-2},{x:1,z:-2})).toBe(1);
  });
  test('直線距離でなく迂回距離を制限する', () => {
    expect(routeLength([{x:0,z:0},{x:3,z:0},{x:3,z:4}])).toBe(7);
    expect(routeLength([])).toBe(0);
  });
  test.each([[40,0,1,0,0],[0,20,1,0,0],[0,0,16,0,0],[0,0,1,2,0],[0,0,1,0,2]])('終了条件 %s/%s/%s/%s/%s', (elapsed,idle,distance,a,b) => {
    expect(tagShouldEnd(elapsed,idle,distance,a,b)).toBe(true);
  });
  test('一回ずつの捕獲では続き、速度は身長によらない', () => {
    expect(tagShouldEnd(39,19,15.9,1,1)).toBe(false);
    expect(TAG_SPEED).toBeGreaterThan(2.3); expect(TAG_SPEED).toBeLessThan(4.4);
    expect(tagCatchDistance(.25,.3,false)).toBe(1.2);
    expect(tagCatchDistance(.9,.3,true)).toBe(1.5);
    expect(tagCatchDistance(3,.3,true)).toBe(1.5);
  });
  test('逃げ候補はプレイヤーから離れる方を優先し、行き止まりの回避方向も持つ', () => {
    const points = fleeCandidates({x:1,z:0},{x:0,z:0});
    expect(points[0]).toEqual({x:5,z:0});
    expect(points.some(p => p.x < 1)).toBe(true);
    expect(points.length).toBeLessThanOrEqual(16);
  });
});
