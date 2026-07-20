import { createBoardVisualInvalidationAccumulator } from '../ui/board-visual/invalidation-accumulator';

describe('board visual invalidation accumulator', () => {
  test('merges requests for one writer and clears only after successful settlement', () => {
    const accumulator = createBoardVisualInvalidationAccumulator();
    const writer = Object.freeze({ id: 1 });

    accumulator.mark(writer, 'render-request');
    accumulator.mark(writer, 'render-request');
    accumulator.mark(writer, 'recovery');
    accumulator.recordFinalFrameBuild(writer);
    accumulator.recordFinalFrameSubmit(writer);

    expect(accumulator.getDiagnostics()).toEqual({
      requestCount: 3,
      mergeCount: 2,
      finalFrameBuildCount: 1,
      finalFrameSubmitCount: 1,
      discardedWriterCount: 0,
      pending: true,
      pendingGeneration: 1,
      pendingReasons: ['recovery', 'render-request']
    });

    accumulator.settle(writer);
    expect(accumulator.getDiagnostics()).toMatchObject({ pending: false, pendingReasons: [] });
  });

  test('rebinds a synthetic writer without counting it as discarded work', () => {
    const accumulator = createBoardVisualInvalidationAccumulator();
    const synthetic = Object.freeze({ id: 1 });
    const adopted = Object.freeze({ id: 2 });

    accumulator.mark(synthetic, 'auto-writer-claim');
    accumulator.rebind(synthetic, adopted);
    accumulator.recordFinalFrameBuild(adopted);
    accumulator.recordFinalFrameSubmit(adopted);
    accumulator.settle(adopted);

    expect(accumulator.getDiagnostics()).toMatchObject({
      requestCount: 1,
      finalFrameBuildCount: 1,
      finalFrameSubmitCount: 1,
      discardedWriterCount: 0,
      pending: false
    });
  });

  test('keeps a failed writer pending and rejects mismatched settlement', () => {
    const accumulator = createBoardVisualInvalidationAccumulator();
    const writer = Object.freeze({ id: 1 });
    const other = Object.freeze({ id: 2 });

    accumulator.mark(writer);
    accumulator.recordFinalFrameBuild(writer);

    expect(() => accumulator.settle(other)).toThrow('writer mismatch');
    expect(accumulator.getDiagnostics().pending).toBe(true);
  });
});
