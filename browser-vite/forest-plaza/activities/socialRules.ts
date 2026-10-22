/** 会話・おにごっこの描画に依存しない距離/状態規則。 */
export interface SocialPoint { x: number; z: number }
export const socialDistance = (a: SocialPoint, b: SocialPoint): number => Math.hypot(a.x - b.x, a.z - b.z);
export function routeLength(path: readonly SocialPoint[]): number {
  return path.slice(1).reduce((sum, p, i) => sum + socialDistance(path[i], p), 0);
}
export function chatPairAllowed(a: SocialPoint, b: SocialPoint, readyA: number, readyB: number, now: number): boolean {
  return readyA <= now && readyB <= now && socialDistance(a, b) <= 6;
}
/** 同一直線上の格子点だけ間引く。角は残し、短い格子ごとの停止で走行が遅くなるのを防ぐ。 */
export function compactSocialPath<T extends SocialPoint & {y: number}>(path: readonly T[]): T[] {
  const result: T[] = [];
  for (const point of path) {
    while (result.length >= 2) {
      const a = result[result.length - 2], b = result[result.length - 1];
      const abx = b.x - a.x, abz = b.z - a.z, bcx = point.x - b.x, bcz = point.z - b.z;
      const length = socialDistance(a, point), fraction = length ? socialDistance(a, b) / length : 0;
      if (Math.abs(abx * bcz - abz * bcx) > 0.0001 || abx * bcx + abz * bcz <= 0 || Math.abs(b.y - (a.y + (point.y - a.y) * fraction)) > 0.025) break;
      result.pop();
    }
    result.push(point);
  }
  return result;
}
/** 会話の立ち位置を入れ替えず、互いの体を横切る経路を避ける。 */
export function chatAxisSign(axis: SocialPoint, a: SocialPoint, b: SocialPoint): 1 | -1 {
  return axis.x * (b.x - a.x) + axis.z * (b.z - a.z) < 0 ? -1 : 1;
}
export type TagPhase = 'approach' | 'invite' | 'flee' | 'chase' | 'caught' | 'satisfied';
export function tagShouldEnd(elapsed: number, idle: number, distance: number, playerCatches: number, characterCatches: number): boolean {
  return elapsed >= 40 || idle >= 20 || distance >= 16 || playerCatches >= 2 || characterCatches >= 2;
}
/** 全員同じ実速度。プレイヤー歩行2.3m/sより速く、走行4.4m/sより遅い。 */
export const TAG_SPEED = 3.35;
/** 大柄でも物理衝突の手前で捕獲できる、中心距離の下限。 */
export function tagCatchDistance(radius: number, playerRadius: number, chasing: boolean): number {
  // 0.25m格子の丸め誤差も吸収。どの模型でも判定を1.5mより広げない。
  return Math.min(1.5, Math.max(chasing ? 1 : 1.2, radius + playerRadius + 0.3));
}
export function fleeCandidates(character: SocialPoint, player: SocialPoint): SocialPoint[] {
  const angle = Math.atan2(character.z - player.z, character.x - player.x);
  return [0, 0.65, -0.65, 1.3, -1.3, Math.PI / 2, -Math.PI / 2, Math.PI].flatMap(turn =>
    [4, 2.5].map(distance => ({ x: character.x + Math.cos(angle + turn) * distance, z: character.z + Math.sin(angle + turn) * distance })));
}
