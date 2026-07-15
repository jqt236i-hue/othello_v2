export interface ObjectPoolOptions<T> {
  readonly create: () => T;
  readonly reset: (value: T) => void;
  readonly destroy?: (value: T) => void;
  readonly maxRetained?: number;
}

export interface ObjectPoolDiagnostics {
  readonly created: number;
  readonly acquired: number;
  readonly available: number;
  readonly destroyed: number;
  readonly poolDestroyed: boolean;
}

export interface ObjectPool<T> {
  acquire(): T;
  release(value: T): boolean;
  clear(): void;
  destroy(): void;
  getDiagnostics(): ObjectPoolDiagnostics;
}

function normalizeMaxRetained(value: unknown): number {
  if (typeof value === 'undefined') return Number.POSITIVE_INFINITY;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('ObjectPool maxRetained must be non-negative');
  return Math.trunc(numeric);
}

export function createObjectPool<T>(options: ObjectPoolOptions<T>): ObjectPool<T> {
  if (!options || typeof options.create !== 'function' || typeof options.reset !== 'function') {
    throw new Error('ObjectPool requires create and reset functions');
  }
  const maxRetained = normalizeMaxRetained(options.maxRetained);
  const available: T[] = [];
  const acquired = new Set<T>();
  const owned = new Set<T>();
  let createdCount = 0;
  let destroyedCount = 0;
  let poolDestroyed = false;

  function destroyValue(value: T): void {
    if (!owned.delete(value)) return;
    acquired.delete(value);
    const availableIndex = available.indexOf(value);
    if (availableIndex >= 0) available.splice(availableIndex, 1);
    if (typeof options.destroy === 'function') options.destroy(value);
    destroyedCount += 1;
  }

  function acquire(): T {
    if (poolDestroyed) throw new Error('ObjectPool is destroyed');
    const value = available.length ? available.pop()! : options.create();
    if (!owned.has(value)) {
      owned.add(value);
      createdCount += 1;
    }
    if (acquired.has(value)) throw new Error('ObjectPool acquired the same value twice');
    acquired.add(value);
    return value;
  }

  function release(value: T): boolean {
    if (!owned.has(value) || !acquired.delete(value)) return false;
    try {
      options.reset(value);
    } catch (error) {
      destroyValue(value);
      throw error;
    }
    if (poolDestroyed || available.length >= maxRetained) {
      destroyValue(value);
      return true;
    }
    available.push(value);
    return true;
  }

  function clear(): void {
    for (const value of available.slice()) destroyValue(value);
  }

  function destroy(): void {
    if (poolDestroyed) return;
    poolDestroyed = true;
    for (const value of Array.from(owned)) destroyValue(value);
  }

  function getDiagnostics(): ObjectPoolDiagnostics {
    return Object.freeze({
      created: createdCount,
      acquired: acquired.size,
      available: available.length,
      destroyed: destroyedCount,
      poolDestroyed
    });
  }

  return Object.freeze({ acquire, release, clear, destroy, getDiagnostics });
}
