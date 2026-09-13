import { installFrozenPresentationSettlement } from '../scripts/cpu-lv10-frozen-presentation';

function fixture() {
    const state = { active: false, claimed: false, pending: false, selection: false,
        mode: 'idle', writer: null as any, settling: false };
    const controller = { getMode: () => state.mode, getActiveWriterToken: () => state.writer,
        isIdleSettlementPending: () => state.settling, waitForIdle: jest.fn().mockResolvedValue(undefined) };
    const playback = { getPlaybackActive: () => state.active, hasClaimedVisualPlayback: () => state.claimed,
        hasSelectionSettlementLock: () => state.selection, hasPendingVisualPlayback: () => state.pending };
    const root = window as any;
    root.require = (name: string) => name === 'ui/bootstrap' ? { getBoardVisualController: () => controller } : playback;
    root.gameState = { turnNumber: 82 }; root.cardState = { sentinel: 'unchanged' };
    root.isProcessing = false; root.isCardAnimating = false;
    root.__frozenLv9Oracle = { autoInFlight: false };
    delete root.__frozenPresentationFailure;
    installFrozenPresentationSettlement({ presentationTimeoutMs: 5000 });
    return { state, controller, root, wait: () => root.__waitForFrozenPresentation('turn') as Promise<void> };
}

let oldWindow: any;
beforeEach(() => {
    jest.useFakeTimers(); oldWindow = (globalThis as any).window;
    (globalThis as any).window = {};
});
afterEach(() => {
    jest.useRealTimers();
    if (oldWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = oldWindow;
});

test('false legacy flags cannot release a live writer or the queued following phase', async () => {
    const f = fixture(); f.state.writer = { id: 18 }; f.state.mode = 'playback';
    let returned = false;
    const waiting = f.wait().then(() => { returned = true; });
    await jest.advanceTimersByTimeAsync(100);
    expect(returned).toBe(false);
    f.state.writer = null; f.state.mode = 'idle'; f.state.pending = true;
    await jest.advanceTimersByTimeAsync(100);
    expect(returned).toBe(false);
    f.state.pending = false; f.state.claimed = true;
    await jest.advanceTimersByTimeAsync(100);
    expect(returned).toBe(false);
    f.state.claimed = false;
    await jest.advanceTimersByTimeAsync(10); await waiting;
    expect(f.controller.waitForIdle).toHaveBeenCalledTimes(1);
    expect(f.root.cardState).toEqual({ sentinel: 'unchanged' });
});

test('a stalled writer still fails at the unchanged five-second limit with contemporaneous evidence', async () => {
    const f = fixture(); f.state.writer = { id: 18 };
    const waiting = expect(f.wait()).rejects.toThrow('Frozen turn presentation did not settle');
    await jest.advanceTimersByTimeAsync(5000); await waiting;
    const samples = f.root.__frozenPresentationFailure.samples;
    expect(samples.length).toBeLessThanOrEqual(64);
    expect(samples.at(-1)).toMatchObject({ writer: { id: 18 }, processing: false, animating: false });
    expect(f.state.writer).toEqual({ id: 18 });
});

test('a failed final-frame settlement fails closed', async () => {
    const f = fixture(); f.controller.waitForIdle.mockRejectedValue(new Error('controller recovering'));
    await expect(f.wait()).rejects.toThrow('controller recovering');
});

test('a writer acquired while the final frame settles must also finish', async () => {
    const f = fixture(); let release!: () => void;
    f.controller.waitForIdle.mockImplementationOnce(() => new Promise<void>(r => { release = r; }));
    let returned = false; const waiting = f.wait().then(() => { returned = true; });
    f.state.writer = { id: 19 }; release();
    await jest.advanceTimersByTimeAsync(100); expect(returned).toBe(false);
    f.state.writer = null; await jest.advanceTimersByTimeAsync(10); await waiting;
});
