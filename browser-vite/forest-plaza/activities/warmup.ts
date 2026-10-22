/** 描画後に少量ずつ静的データを準備する。1項目は不可分、終了後/破棄後は何もしない。 */
export function createBudgetedWarmup<T>(items: Iterable<T>, visit: (item: T) => void, now: () => number = () => performance.now()) {
  const iterator = items[Symbol.iterator]();
  let stopped = false, done = false, processed = 0, startedAt: number | null = null, finishedAt: number | null = null, workMs = 0, maxSliceMs = 0;
  return {
    tick(budgetMs: number): void {
      if (stopped || done || budgetMs <= 0) return;
      const start = now(); startedAt ??= start;
      while (now() - start < budgetMs) {
        const next = iterator.next();
        if (next.done) { done = true; finishedAt = now(); break; }
        visit(next.value); processed++;
      }
      const elapsed = now() - start; workMs += elapsed; maxSliceMs = Math.max(maxSliceMs, elapsed);
    },
    stop(): void { stopped = true; iterator.return?.(); },
    status: () => ({ stopped, done, processed, startedAt, finishedAt, workMs, maxSliceMs, elapsedMs: startedAt === null ? 0 : (finishedAt ?? now()) - startedAt }),
  };
}
