import * as fs from 'fs';
import * as path from 'path';

describe('board renderer recovery boundary', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-renderer.ts'), 'utf8');

  test('observes the controller readiness generation used after backend fallback', () => {
    const start = source.indexOf('function getBoardVisualControllerReady()');
    const end = source.indexOf('function claimBoardVisualWriter(', start);
    const readySource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(readySource).toContain("typeof controller.waitUntilReady === 'function'");
    expect(readySource).toContain('return controller.waitUntilReady();');
  });

  test('requires exact writer ownership before post-handoff cancellation', () => {
    const start = source.indexOf('async function cancelBoardVisualWriterAfterHandoff(');
    const end = source.indexOf('async function settleBoardVisualWriter(', start);
    const cancelSource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(cancelSource).toContain('controller.getActiveWriterToken() !== token');
    expect(cancelSource).toContain('return controller.cancelWriterAfterHandoff(token, checkpoint);');
  });

  test('requires exact writer and frame identity before entering recovery', () => {
    const start = source.indexOf('function enterBoardVisualRecovery(');
    const end = source.indexOf('function settleAutoBoardVisualWriter(', start);
    const recoverySource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(recoverySource).toContain('controller.getActiveWriterToken() !== token');
    expect(recoverySource).toContain("controller.getActiveFrameToken() !== String(token && token.frameToken || '')");
    expect(recoverySource).toContain('return controller.enterRecovery(token, error);');
  });
});
