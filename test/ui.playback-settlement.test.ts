import {
  assertPlaybackSettlementResult,
  createPlaybackSettlementResult
} from '../ui/playback-settlement';

describe('typed playback settlement contract', () => {
  test.each(['finalize', 'already-aborted-ack'] as const)(
    'creates one immutable %s finalizer for a run',
    (mode) => {
      const finalize = jest.fn();
      const result = createPlaybackSettlementResult({ runId: 4, mode, finalize });

      expect(Object.isFrozen(result)).toBe(true);
      expect(assertPlaybackSettlementResult(result)).toBe(result);
      expect(result).toMatchObject({
        kind: 'deferred-finalization',
        runId: 4,
        mode
      });
      expect(result.finalize()).toBe(true);
      expect(result.finalize()).toBe(false);
      expect(finalize).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    undefined,
    {},
    { kind: 'deferred-finalization', runId: 0, mode: 'finalize', finalize: () => true },
    { kind: 'deferred-finalization', runId: 1, mode: 'unknown', finalize: () => true }
  ])('rejects malformed settlement result %#', (value) => {
    expect(() => assertPlaybackSettlementResult(value)).toThrow(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'playback_settlement_result_invalid'
    }));
  });

  test('keeps a throwing finalizer retryable until it succeeds', () => {
    const finalize = jest.fn()
      .mockImplementationOnce(() => { throw new Error('temporary manager failure'); })
      .mockReturnValueOnce(true);
    const result = createPlaybackSettlementResult({ runId: 9, mode: 'finalize', finalize });

    expect(() => result.finalize()).toThrow(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'playback_settlement_finalize_failed'
    }));
    expect(result.finalize()).toBe(true);
    expect(result.finalize()).toBe(false);
    expect(finalize).toHaveBeenCalledTimes(2);
  });

  test('consumes a run-mismatched finalizer rejection without reporting success', () => {
    const finalize = jest.fn(() => false);
    const result = createPlaybackSettlementResult({ runId: 10, mode: 'finalize', finalize });

    expect(result.finalize()).toBe(false);
    expect(result.finalize()).toBe(false);
    expect(finalize).toHaveBeenCalledTimes(1);
  });
});
