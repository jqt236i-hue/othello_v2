import type { PlazaCharacter } from '../characters';
export interface AutoEvent {
  id: string;
  interval: number | readonly [number, number];
  probability?: number;
  maxConcurrent?: number;
  participants?: number;
  eligible?(character: PlazaCharacter): boolean;
  /** director が占有済み。false は開始失敗。終了時に finish() を必ず呼ぶ。 */
  start(characters: PlazaCharacter[], finish: () => void): boolean | void;
}
export class ActivityDirector {
  sleeping = false;
  private entries = new Map<AutoEvent, { remaining: number; runs: Set<() => void> }>();
  constructor(private visitors: ReadonlyMap<string, PlazaCharacter>, private random = Math.random) {}
  private delay(spec: AutoEvent): number {
    return typeof spec.interval === 'number' ? spec.interval : spec.interval[0] + this.random() * (spec.interval[1] - spec.interval[0]);
  }
  register(spec: AutoEvent): () => void {
    const entry = { remaining: this.delay(spec), runs: new Set<() => void>() };
    this.entries.set(spec, entry);
    return () => { for (const finish of [...entry.runs]) finish(); this.entries.delete(spec); };
  }
  update(dt: number): void {
    if (this.sleeping) return;
    for (const [spec, entry] of this.entries) {
      entry.remaining -= dt;
      if (entry.remaining > 0) continue;
      entry.remaining = this.delay(spec);
      if (entry.runs.size >= (spec.maxConcurrent ?? 1) || this.random() >= (spec.probability ?? 1)) continue;
      const pool = [...this.visitors.values()].filter(c => !c.isBusy && (!spec.eligible || spec.eligible(c)));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const count = spec.participants ?? 1;
      if (pool.length < count) continue;
      const selected = pool.slice(0, count), owner = {};
      const finish = () => { for (const c of selected) c.release(owner); entry.runs.delete(finish); };
      if (!selected.every(c => c.claim(owner, finish))) { finish(); continue; }
      entry.runs.add(finish);
      try { if (spec.start(selected, finish) === false) finish(); } catch (error) { finish(); console.warn('[forest-plaza] activity start', spec.id, error); }
    }
  }
  dispose(): void { for (const entry of this.entries.values()) for (const finish of [...entry.runs]) finish(); this.entries.clear(); }
}
