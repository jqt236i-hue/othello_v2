export const FOODS = [
  { name: 'りんご', icon: '🍎' }, { name: 'パン', icon: '🥖' },
  { name: 'おにぎり', icon: '🍙' }, { name: 'クッキー', icon: '🍪' },
] as const;
export function favoriteFood(id: string): number {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) % FOODS.length;
}
