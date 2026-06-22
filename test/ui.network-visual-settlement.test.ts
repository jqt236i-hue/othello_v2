const { createVisualSettlementTracker } = require('../ui/network/visual-settlement');

describe('network visual settlement tracker', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('waits until the requested visualSeq is completed', async () => {
    const tracker = createVisualSettlementTracker();
    const waiter = tracker.waitForVisualSeq(20, { timeoutMs: 5000 });

    tracker.markVisualSeqCompleted(19);
    await Promise.resolve();

    let settled = false;
    waiter.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    tracker.markVisualSeqCompleted(20);

    await expect(waiter).resolves.toEqual({ ok: true, visualSeq: 20 });
  });

  test('resolves immediately for recently completed visualSeq', async () => {
    const tracker = createVisualSettlementTracker();
    tracker.markVisualSeqCompleted(20);

    await expect(tracker.waitForVisualSeq(20, { timeoutMs: 5000 })).resolves.toEqual({
      ok: true,
      visualSeq: 20
    });
  });

  test('completion clears timeout so a resolved waiter is not resolved again', async () => {
    jest.useFakeTimers();
    const tracker = createVisualSettlementTracker();
    const waiter = tracker.waitForVisualSeq(21, { timeoutMs: 20 });

    tracker.markVisualSeqCompleted(21);
    jest.advanceTimersByTime(25);

    await expect(waiter).resolves.toEqual({ ok: true, visualSeq: 21 });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('timeout resolves as an explicit settlement failure', async () => {
    jest.useFakeTimers();
    const tracker = createVisualSettlementTracker();
    const waiter = tracker.waitForVisualSeq(22, { timeoutMs: 20 });

    jest.advanceTimersByTime(20);

    await expect(waiter).resolves.toEqual({
      ok: false,
      visualSeq: 22,
      reason: 'timeout'
    });
    expect(jest.getTimerCount()).toBe(0);
  });
});
