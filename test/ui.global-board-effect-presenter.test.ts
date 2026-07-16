import { JSDOM } from 'jsdom';

type ScopedTimerRegistry = {
  setTimeout(fn: () => void, ms: number, scope?: unknown): ReturnType<typeof setTimeout>;
  clearTimeout(id: ReturnType<typeof setTimeout>): void;
  clearScope(scope: unknown): void;
  clearAll(): void;
  pendingCount(): number;
};

function createScopedTimerRegistry(): ScopedTimerRegistry {
  const idsByScope = new Map<unknown, Set<ReturnType<typeof setTimeout>>>();
  const allIds = new Set<ReturnType<typeof setTimeout>>();

  const forget = (id: ReturnType<typeof setTimeout>) => {
    allIds.delete(id);
    for (const ids of idsByScope.values()) ids.delete(id);
  };

  return {
    setTimeout(fn, ms, scope) {
      let id: ReturnType<typeof setTimeout>;
      id = setTimeout(() => {
        forget(id);
        fn();
      }, ms);
      allIds.add(id);
      if (scope !== undefined && scope !== null) {
        const ids = idsByScope.get(scope) || new Set<ReturnType<typeof setTimeout>>();
        ids.add(id);
        idsByScope.set(scope, ids);
      }
      return id;
    },
    clearTimeout(id) {
      clearTimeout(id);
      forget(id);
    },
    clearScope(scope) {
      const ids = idsByScope.get(scope);
      if (!ids) return;
      for (const id of Array.from(ids)) {
        clearTimeout(id);
        forget(id);
      }
      idsByScope.delete(scope);
    },
    clearAll() {
      for (const id of Array.from(allIds)) {
        clearTimeout(id);
        forget(id);
      }
      idsByScope.clear();
    },
    pendingCount() {
      return allIds.size;
    }
  };
}

describe('global board effect presenter settlement', () => {
  let dom: JSDOM;
  let animationCancels: jest.Mock[];

  const rectFor = (row: number, col: number) => {
    const size = 64;
    const left = col * size;
    const top = row * size;
    return {
      left,
      top,
      right: left + size,
      bottom: top + size,
      width: size,
      height: size
    };
  };

  function installNeverSettlingAnimations() {
    const never = new Promise<void>(() => undefined);
    (dom.window.Element.prototype as any).animate = jest.fn(() => {
      const cancel = jest.fn();
      animationCancels.push(cancel);
      return { finished: never, cancel };
    });
  }
  async function flushMicrotasks() {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  }


  function createDeps(
    timer: ScopedTimerRegistry,
    scope: unknown,
    suppressTargetImpact = false,
    abortSignal?: AbortSignal
  ) {
    return {
      isNoAnim: () => false,
      getCellClientRect: rectFor,
      sleep: (ms: number) => new Promise<void>((resolve) => {
        timer.setTimeout(resolve, ms, scope);
      }),
      timer: () => timer,
      playbackScope: scope,
      abortSignal,
      random: () => 0.5,
      suppressTargetImpact,
      documentRef: document
    };
  }

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    animationCancels = [];
    installNeverSettlingAnimations();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    try { dom.window.close(); } catch (_error) { /* cleanup */ }
    delete (global as any).window;
    delete (global as any).document;
  });

  test.each(['clearScope', 'clearAll'] as const)(
    '%s cannot strand source animation settlement or overlays',
    async (resetKind) => {
      const timer = createScopedTimerRegistry();
      const scope = Symbol('playback');
      const abortController = new AbortController();
      const presenter = require('../ui/presentation/global-board-effect-presenter');
      const promise = presenter.presentDestroySourceAnimation({
        target: {
          r: 2,
          col: 2,
          sourceRow: 1,
          sourceCol: 1,
          ownerBefore: 'white',
          cause: 'SNIPER_WILL',
          reason: 'sniper_shot:test'
        }
      }, createDeps(timer, scope, false, abortController.signal));

      expect(document.querySelector('.transient-overlay-batch')).not.toBeNull();
      if (resetKind === 'clearScope') timer.clearScope(scope);
      else timer.clearAll();
      abortController.abort();

      await expect(promise).resolves.toBeUndefined();

      expect(timer.pendingCount()).toBe(0);
      expect(document.body.childElementCount).toBe(0);
      expect(animationCancels).toHaveLength(1);
      expect(animationCancels[0]).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    {
      label: 'dragon breath',
      cause: 'DESTROY_DRAGON_WILL',
      reason: 'destroy_dragon_breath:abort',
      expectedAnimations: 3
    },
    {
      label: 'meteor black beam',
      cause: 'METEOR_GOD',
      reason: 'meteor_god_cell_destroy:abort',
      expectedAnimations: 5
    },
    {
      label: 'lightning strike',
      cause: 'ULTIMATE_DESTROY_GOD',
      reason: 'udg_destroyed:abort',
      expectedAnimations: 8
    }
  ])(
    '$label settles and releases DOM/WAAPI leases on abort without advancing timers',
    async ({ cause, reason, expectedAnimations }) => {
      const baselineTimerCount = jest.getTimerCount();
      const timer = createScopedTimerRegistry();
      const scope = Symbol('special-destroy-playback');
      const abortController = new AbortController();
      const presenter = require('../ui/presentation/global-board-effect-presenter');
      const promise = presenter.presentDestroySourceAnimation({
        target: {
          r: 2,
          col: 2,
          sourceRow: 1,
          sourceCol: 1,
          ownerBefore: 'white',
          cause,
          reason
        }
      }, createDeps(timer, scope, false, abortController.signal));

      expect(document.querySelector('.transient-overlay-batch')).not.toBeNull();
      expect(animationCancels).toHaveLength(expectedAnimations);

      timer.clearScope(scope);
      abortController.abort();
      await expect(promise).resolves.toBeUndefined();

      expect(timer.pendingCount()).toBe(0);
      expect(jest.getTimerCount()).toBe(baselineTimerCount);
      expect(document.body.childElementCount).toBe(0);
      for (const cancel of animationCancels) expect(cancel).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    {
      label: 'dragon breath',
      cause: 'DESTROY_DRAGON_WILL',
      reason: 'destroy_dragon_breath:deadline',
      expectedAnimations: 3
    },
    {
      label: 'meteor black beam',
      cause: 'METEOR_GOD',
      reason: 'meteor_god_cell_destroy:deadline',
      expectedAnimations: 5
    }
  ])(
    '$label preserves its deadline when every WAAPI animation finishes immediately',
    async ({ cause, reason, expectedAnimations }) => {
      const timer = createScopedTimerRegistry();
      const scope = Symbol('deadline-playback');
      (dom.window.Element.prototype as any).animate = jest.fn(() => {
        const cancel = jest.fn();
        animationCancels.push(cancel);
        return { finished: Promise.resolve(), cancel };
      });
      const presenter = require('../ui/presentation/global-board-effect-presenter');
      let settled = false;
      const promise = presenter.presentDestroySourceAnimation({
        target: {
          r: 2,
          col: 2,
          sourceRow: 1,
          sourceCol: 1,
          ownerBefore: 'white',
          cause,
          reason
        }
      }, createDeps(timer, scope)).then(() => {
        settled = true;
      });

      expect(animationCancels).toHaveLength(expectedAnimations);
      await flushMicrotasks();
      expect(settled).toBe(false);
      expect(document.querySelector('.transient-overlay-batch')).not.toBeNull();

      jest.advanceTimersByTime(399);
      await flushMicrotasks();
      expect(settled).toBe(false);
      expect(document.querySelector('.transient-overlay-batch')).not.toBeNull();

      jest.advanceTimersByTime(1);
      await expect(promise).resolves.toBeUndefined();
      expect(timer.pendingCount()).toBe(0);
      expect(document.body.childElementCount).toBe(0);
      for (const cancel of animationCancels) expect(cancel).toHaveBeenCalledTimes(1);
    }
  );

  test('lightning strike settles before its deadline only after every WAAPI animation finishes', async () => {
    const timer = createScopedTimerRegistry();
    const scope = Symbol('udg-animation-playback');
    const finishedResolvers: Array<() => void> = [];
    (dom.window.Element.prototype as any).animate = jest.fn(() => {
      let resolveFinished!: () => void;
      const finished = new Promise<void>((resolve) => {
        resolveFinished = resolve;
      });
      const cancel = jest.fn();
      animationCancels.push(cancel);
      finishedResolvers.push(resolveFinished);
      return { finished, cancel };
    });
    const presenter = require('../ui/presentation/global-board-effect-presenter');
    let settled = false;
    const promise = presenter.presentDestroySourceAnimation({
      target: {
        r: 2,
        col: 2,
        sourceRow: 1,
        sourceCol: 1,
        ownerBefore: 'white',
        cause: 'ULTIMATE_DESTROY_GOD',
        reason: 'udg_destroyed:finished'
      }
    }, createDeps(timer, scope)).then(() => {
      settled = true;
    });

    expect(finishedResolvers).toHaveLength(8);
    for (const resolveFinished of finishedResolvers.slice(0, -1)) resolveFinished();
    await flushMicrotasks();
    expect(settled).toBe(false);
    expect(document.querySelector('.transient-overlay-batch')).not.toBeNull();

    finishedResolvers[finishedResolvers.length - 1]();
    await expect(promise).resolves.toBeUndefined();
    expect(settled).toBe(true);
    expect(timer.pendingCount()).toBe(0);
    expect(document.body.childElementCount).toBe(0);
    for (const cancel of animationCancels) expect(cancel).toHaveBeenCalledTimes(1);
  });

  test('animation cancellation rejection resolves the prelude gate and cleans up', async () => {
    const timer = createScopedTimerRegistry();
    const scope = Symbol('playback');
    const cancel = jest.fn();
    animationCancels.push(cancel);
    (dom.window.Element.prototype as any).animate = jest.fn(() => ({
      finished: Promise.reject(new Error('animation cancelled')),
      cancel
    }));
    const presenter = require('../ui/presentation/global-board-effect-presenter');

    await expect(presenter.presentDestroySourceAnimation({
      target: {
        r: 2,
        col: 2,
        sourceRow: 1,
        sourceCol: 1,
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot:cancelled'
      }
    }, createDeps(timer, scope))).resolves.toBeUndefined();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(document.body.childElementCount).toBe(0);
    expect(timer.pendingCount()).toBe(0);
  });

  test('source animation failures reject the prelude gate after cleanup', async () => {
    const timer = createScopedTimerRegistry();
    const scope = Symbol('playback');
    (dom.window.Element.prototype as any).animate = jest.fn(() => {
      throw new Error('source animation failed');
    });
    const presenter = require('../ui/presentation/global-board-effect-presenter');

    await expect(presenter.presentDestroySourceAnimation({
      target: {
        r: 2,
        col: 2,
        sourceRow: 1,
        sourceCol: 1,
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot:error'
      }
    }, createDeps(timer, scope))).rejects.toThrow('source animation failed');

    expect(document.body.childElementCount).toBe(0);
    expect(timer.pendingCount()).toBe(0);
  });

  test.each([
    { suppressTargetImpact: false, expectedChildren: 3 },
    { suppressTargetImpact: true, expectedChildren: 2 }
  ])(
    'keeps DOM target impact exclusive when suppressTargetImpact=$suppressTargetImpact',
    async ({ suppressTargetImpact, expectedChildren }) => {
      const timer = createScopedTimerRegistry();
      const scope = Symbol('playback');
      const presenter = require('../ui/presentation/global-board-effect-presenter');
      const promise = presenter.presentDestroySourceAnimation({
        target: {
          r: 2,
          col: 2,
          sourceRow: 1,
          sourceCol: 1,
          cause: 'DESTROY_DRAGON_WILL',
          reason: 'destroy_dragon_breath:test'
        }
      }, createDeps(timer, scope, suppressTargetImpact));

      const batch = document.querySelector('.transient-overlay-batch');
      expect(batch?.firstElementChild?.childElementCount).toBe(expectedChildren);

      jest.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
      expect(document.body.childElementCount).toBe(0);
    }
  );

  test('zombie source decoration remains global and settles after scoped timer reset', async () => {
    const timer = createScopedTimerRegistry();
    const scope = Symbol('zombie-playback');
    const abortController = new AbortController();
    const presenter = require('../ui/presentation/global-board-effect-presenter');
    const promise = presenter.presentZombieBiteSourceAnimation({
      target: {
        r: 2,
        col: 3,
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        meta: { sourceRow: 2, sourceCol: 1 }
      }
    }, createDeps(timer, scope, false, abortController.signal));

    expect(document.querySelector('.zombie-bite-global-overlay')).not.toBeNull();
    expect(document.querySelector('.zombie-bite-shadow')).not.toBeNull();
    expect(document.querySelectorAll('.zombie-bite-fang')).toHaveLength(2);
    expect(document.querySelector('.cell, .disc')).toBeNull();

    timer.clearScope(scope);
    abortController.abort();
    await expect(promise).resolves.toBeUndefined();
    expect(document.body.childElementCount).toBe(0);
    expect(timer.pendingCount()).toBe(0);
  });
});
