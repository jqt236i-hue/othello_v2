export interface PathPoint { x: number; y: number; z: number }
export interface PathOptions {
  groundAt(x: number, z: number): number | null;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  radius?: number;
  blocked?(x: number, z: number): boolean;
  step?: number;
  maxStep?: number;
  maxVisited?: number;
}
/** 必要な格子だけ評価する A*。斜めの角抜けを許さず、到達不能なら null。 */
export function findPath(from: { x: number; z: number }, to: { x: number; z: number }, options: PathOptions): PathPoint[] | null {
  const step = options.step ?? 0.25;
  const radius = options.radius ?? 0.3;
  const maxStep = options.maxStep ?? 0.4;
  const cache = new Map<string, number | null>();
  const key = (x: number, z: number) => `${x},${z}`;
  const height = (x: number, z: number): number | null => {
    const k = key(x, z);
    if (cache.has(k)) return cache.get(k)!;
    const wx = x * step, wz = z * step, b = options.bounds;
    let result: number | null = null;
    if (wx - radius >= b.minX && wx + radius <= b.maxX && wz - radius >= b.minZ && wz + radius <= b.maxZ && !options.blocked?.(wx, wz)) {
      result = options.groundAt(wx, wz);
      for (const [dx, dz] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
        const y = options.groundAt(wx + dx, wz + dz);
        if (y === null || result === null || Math.abs(y - result) > maxStep) { result = null; break; }
      }
    }
    cache.set(k, result);
    return result;
  };
  const sx = Math.round(from.x / step), sz = Math.round(from.z / step);
  const tx = Math.round(to.x / step), tz = Math.round(to.z / step);
  if (height(sx, sz) === null || height(tx, tz) === null) return null;
  interface Node { x: number; z: number; g: number; f: number; parent?: Node }
  const start: Node = { x: sx, z: sz, g: 0, f: Math.hypot(tx - sx, tz - sz) };
  const open: Node[] = [start], best = new Map<string, number>([[key(sx, sz), 0]]);
  const closed = new Set<string>();
  while (open.length && closed.size < (options.maxVisited ?? 14000)) {
    let index = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[index].f) index = i;
    const current = open.splice(index, 1)[0], ck = key(current.x, current.z);
    if (closed.has(ck)) continue;
    if (current.x === tx && current.z === tz) {
      const path: PathPoint[] = [];
      for (let n: Node | undefined = current; n; n = n.parent) path.push({ x: n.x * step, y: height(n.x, n.z)!, z: n.z * step });
      return path.reverse();
    }
    closed.add(ck);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const x = current.x + dx, z = current.z + dz, k = key(x, z), y = height(x, z);
      if (closed.has(k) || y === null || Math.abs(y - height(current.x, current.z)!) > maxStep) continue;
      if (dx && dz) {
        const sides = [height(current.x + dx, current.z), height(current.x, current.z + dz)];
        if (sides.some(side => side === null || Math.abs(side - height(current.x, current.z)!) > maxStep || Math.abs(side - y) > maxStep)) continue;
      }
      const g = current.g + Math.hypot(dx, dz);
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      open.push({ x, z, g, f: g + Math.hypot(tx - x, tz - z), parent: current });
    }
  }
  return null;
}
export interface PlazaPathing {
  find(from: { x: number; z: number }, to: { x: number; z: number }, self?: import('../characters').PlazaCharacter): PathPoint[] | null;
  groundAt(x: number, z: number): number | null;
}
