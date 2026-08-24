import { createMatchWorkerGameRuntime } from '../workers/match-worker-game-runtime';

describe('match Worker game runtime composition', () => {
  test('validates and freezes the single command port', async () => {
    const applyCommandPublishToSnapshot = jest.fn(async () => ({ ok: true }));
    const runtime = createMatchWorkerGameRuntime({ applyCommandPublishToSnapshot });

    expect(Object.isFrozen(runtime)).toBe(true);
    await expect(runtime.applyCommandPublishToSnapshot(undefined, {}, 'black'))
      .resolves.toEqual({ ok: true });
    expect(applyCommandPublishToSnapshot).toHaveBeenCalledTimes(1);
  });

  test('rejects an incomplete port at construction time', () => {
    expect(() => createMatchWorkerGameRuntime({} as any)).toThrow(
      'match Worker game runtime requires applyCommandPublishToSnapshot'
    );
  });
});
