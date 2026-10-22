export const FOODS = [
  { name: '反転りんご', icon: '🍎' }, { name: '執行パン', icon: '🥖' },
  { name: '観測おにぎり', icon: '🍙' }, { name: '理論クッキー', icon: '🍪' },
] as const;
export function favoriteFood(id: string): number {
  // catalogのCPU_LV2も同じモチーフとして扱う。それ以外のIDのハッシュは従来のまま。
  switch (id.toLowerCase()) {
    case 'observer': return 2;
    case 'executor': return 1;
    case 'theory': return 3;
    case 'cpu_lv2': return 0;
  }
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) % FOODS.length;
}
