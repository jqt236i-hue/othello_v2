import Pools = require('../ui/pixi/pools');

describe('Pixi retained object pool', () => {
  test('reuses released objects after reset and reports steady-state counts', () => {
    let nextId = 1;
    const reset = jest.fn((value: any) => { value.visible = false; });
    const destroy = jest.fn();
    const pool = Pools.createObjectPool({
      create: () => ({ id: nextId++, visible: true }),
      reset,
      destroy
    });

    const first = pool.acquire();
    expect(pool.release(first)).toBe(true);
    const reused = pool.acquire();

    expect(reused).toBe(first);
    expect(reused.visible).toBe(false);
    expect(pool.getDiagnostics()).toEqual({
      created: 1, acquired: 1, available: 0, destroyed: 0, poolDestroyed: false
    });
    expect(pool.release({ id: 99 } as any)).toBe(false);
  });

  test('bounds retained objects and destroys overflow instead of leaking', () => {
    const destroy = jest.fn();
    const pool = Pools.createObjectPool({
      create: () => ({}),
      reset: () => undefined,
      destroy,
      maxRetained: 1
    });
    const first = pool.acquire();
    const second = pool.acquire();
    pool.release(first);
    pool.release(second);

    expect(pool.getDiagnostics()).toMatchObject({ created: 2, acquired: 0, available: 1, destroyed: 1 });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test('destroy releases available and in-use objects exactly once', () => {
    const destroy = jest.fn();
    const pool = Pools.createObjectPool({
      create: () => ({}),
      reset: () => undefined,
      destroy
    });
    const active = pool.acquire();
    const idle = pool.acquire();
    pool.release(idle);

    pool.destroy();
    pool.destroy();

    expect(destroy).toHaveBeenCalledTimes(2);
    expect(pool.release(active)).toBe(false);
    expect(pool.getDiagnostics()).toEqual({
      created: 2, acquired: 0, available: 0, destroyed: 2, poolDestroyed: true
    });
    expect(() => pool.acquire()).toThrow('destroyed');
  });

  test('reset failure destroys the broken object before propagating', () => {
    const destroy = jest.fn();
    const pool = Pools.createObjectPool({
      create: () => ({}),
      reset: () => { throw new Error('reset-failed'); },
      destroy
    });
    const value = pool.acquire();

    expect(() => pool.release(value)).toThrow('reset-failed');
    expect(destroy).toHaveBeenCalledWith(value);
    expect(pool.getDiagnostics()).toMatchObject({ acquired: 0, available: 0, destroyed: 1 });
  });
});
