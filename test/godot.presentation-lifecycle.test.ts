import { installEmbeddedBattle } from '../ui/battle/embedded-runtime';
import { createBattle } from '../game/battle';
import { mountBattle } from '../ui/battle/host';
import { JSDOM } from 'jsdom';
import { playPixiReincarnation } from '../ui/pixi/effects/reincarnation';
import { createPixiTimeline } from '../ui/pixi/timeline';

const config: any = { version: 1, battleId: 'lifecycle', seed: 319,
    players: { black: { controller: 'human', deckCardIds: [] }, white: { controller: 'human', deckCardIds: [] } } };

function runtime() {
    const dom = new JSDOM('<head></head><body></body>');
    const root: any = dom.window;
    let processing = false, settlementError: unknown = null, consumer: () => void = () => {};
    let visual: any = { ready: true, mode: 'idle', pendingFrameToken: null };
    let prngState: any;
    const turn = { setUIImpl: jest.fn(), cancelPendingResetGame: jest.fn(), resetGame: jest.fn(async ({ preparedBattle }: any) => {
        root.gameState = preparedBattle.gameState; root.cardState = preparedBattle.cardState; prngState = preparedBattle.prngState; return true;
    }) };
    const cpu = { setCpuUIImpl: jest.fn(), validateBattleCpuMemory: jest.fn(), restoreBattleCpuMemory: jest.fn(),
        exportBattleCpuMemory: jest.fn(() => ({})), processCpuTurn: jest.fn(), resetCpuTurnHandlerState: jest.fn() };
    const playback = { getVisualPlaybackSettlementError: () => settlementError, getProcessing: () => processing,
        getCardAnimating: () => false, getPlaybackActive: () => false, hasClaimedVisualPlayback: () => false,
        hasSelectionSettlementLock: () => false, hasPendingVisualPlayback: () => false, abortPlayback: jest.fn() };
    const renderer = { getBoardVisualController: () => ({ getSnapshot: () => visual }), destroyBoardVisualPageRuntime: jest.fn() };
    const modules: Record<string, any> = { 'game/turn-manager': turn, 'card-system': { installPreparedCardState: jest.fn(), getGamePrng: () => ({ getState: () => prngState }) },
        'ui/playback-state-manager': playback, 'ui/result-overlay': { setBattleResultConsumer: (value: () => void) => { consumer = value; } }, 'game/cpu-turn-handler': cpu, 'ui/board-renderer': renderer };
    root.require = (id: string) => { if (!modules[id]) throw new Error(`Unknown test dependency ${id}`); return modules[id]; };
    root.requestAnimationFrame = (callback: () => void) => setTimeout(callback, 1);
    root.cancelAnimationFrame = (id: any) => clearTimeout(id);
    const disposeWorkers = jest.fn(); installEmbeddedBattle(root, disposeWorkers);
    return { root, api: root.CardReversiBattle, turn, cpu, playback, renderer, disposeWorkers,
        busy: (value: boolean) => { processing = value; }, fail: () => { settlementError = new Error('failed frame'); },
        finish: () => consumer(), unavailable: () => { visual = { ...visual, mode: 'recovering' }; }, close: () => dom.window.close() };
}

async function drain(ms = 20) { await jest.advanceTimersByTimeAsync(ms); }
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test.each(['CPU thinking', 'presentation playback'])('save waits at an active %s boundary, then resumes once', async () => {
    const r = runtime();
    try {
        const start = r.api.start(config); await drain(); await start;
        r.busy(true); let resolved = 0;
        const saved = r.api.save().then((value: any) => { resolved++; return value; });
        await drain(200); expect(resolved).toBe(0);
        r.busy(false); await drain(); expect((await saved).config.battleId).toBe('lifecycle'); expect(resolved).toBe(1);
    } finally { r.api.dispose(); r.close(); }
});

test.each(['CPU thinking', 'presentation playback'])('exit during %s rejects pending saves and cancels each resource once', async () => {
    const r = runtime();
    try {
        const start = r.api.start(config); await drain(); await start;
        r.busy(true);
        const outcome = r.api.finished;
        const save = r.api.save().catch((error: Error) => error.message);
        await drain(); r.api.dispose(); r.api.dispose();
        expect(await save).toBe('Battle disposed'); expect(await outcome).toEqual({ kind: 'cancelled' });
        r.busy(false); r.finish(); await drain(200);
        expect(r.api.status).toBe('disposed');
        for (const cancel of [r.turn.cancelPendingResetGame, r.cpu.resetCpuTurnHandlerState, r.playback.abortPlayback, r.renderer.destroyBoardVisualPageRuntime, r.disposeWorkers]) expect(cancel).toHaveBeenCalledTimes(1);
        await expect(r.api.save()).rejects.toThrow('not ready');
        await expect(r.api.start(config)).rejects.toThrow('already been used');
    } finally { r.close(); }
});

test('pending target survives save/restore without repeated turn start, and exit stays cancellation', async () => {
    const headless = createBattle({ ...config, players: { black: { controller: 'human', deckCardIds: ['destroy_01'], initialCharge: 30 }, white: { controller: 'human', deckCardIds: [] } } });
    headless.startTurn(); const position = headless.exportSave(); position.position.gameState.turnNumber = 6;
    const { restoreBattle } = require('../game/battle'); const active = restoreBattle(position);
    expect(active.apply({ type: 'use_card', useCardId: 'destroy_01', useCardHandIndex: 0, useCardOwnerKey: 'black' }).ok).toBe(true);
    const pending = active.exportSave(), r = runtime();
    try {
        const start = r.api.start(pending); await drain(); await start;
        const saving = r.api.save(); await drain(); const saved = await saving;
        expect(saved.position).toEqual(pending.position);
        expect(saved.position.cardState.pendingEffectByPlayer.black.type).toBe('DESTROY_ONE_STONE');
        expect(r.turn.resetGame).toHaveBeenCalledWith(expect.objectContaining({ restoreBattle: true, resumeTurnStart: false }));
        r.api.dispose(); expect(await r.api.finished).toEqual({ kind: 'cancelled' });
    } finally { r.close(); }
});

test('normal completion waits for presentation and duplicate notifications preserve one stable result', async () => {
    const terminal = createBattle({ ...config, initialLayout: { stones: Array.from({ length: 64 }, (_, i) => ({ row: Math.floor(i / 8), col: i % 8, owner: 1 })) } });
    terminal.startTurn(); terminal.apply({ type: 'pass' }); terminal.startTurn(); terminal.apply({ type: 'pass' });
    const r = runtime();
    try {
        const start = r.api.start(config); await drain(); await start;
        const terminalPosition = terminal.snapshot();
        r.root.gameState = terminalPosition.gameState; r.root.cardState = terminalPosition.cardState;
        r.busy(true); let notices = 0; void r.api.finished.then(() => { notices++; });
        r.finish(); r.finish(); await drain(200); expect(notices).toBe(0);
        r.busy(false); await drain();
        const result = await r.api.finished;
        expect(notices).toBe(1);
        expect(result).toMatchObject({ kind: 'finished', resultId: 'lifecycle:result', result: { winner: 'black' } });
        r.finish(); r.finish(); r.api.dispose(); await drain(); expect(await r.api.finished).toEqual(result);
    } finally { r.close(); }
});

test('failed renderer is an error outcome, never a win; disposed mounting cannot revive itself', async () => {
    const r = runtime();
    try {
        r.unavailable(); const failed = r.api.start(config).catch((error: Error) => error.message); await drain();
        expect(await failed).toBe('Battle renderer is unavailable'); expect(await r.api.finished).toMatchObject({ kind: 'error' });
        await expect(r.api.save()).rejects.toThrow('not ready');
    } finally { r.api.dispose(); r.close(); }
    const next = runtime();
    try {
        next.busy(true); const start = next.api.start(config).catch((error: Error) => error.message); await drain(); next.api.dispose();
        expect(await start).toBe('Battle disposed'); await drain(); expect(next.api.status).toBe('disposed');
        expect(next.turn.resetGame).not.toHaveBeenCalled();
    } finally { next.close(); }
});

test('save timeout rejects instead of inventing a settled snapshot, and playback failure reports error', async () => {
    const r = runtime();
    try {
        const start = r.api.start(config); await drain(); await start;
        r.busy(true); const timeout = r.api.save().catch((error: Error) => error.message);
        await drain(120050); expect(await timeout).toBe('Battle boundary timed out');
        r.busy(false); r.fail(); r.finish(); await drain();
        expect(await r.api.finished).toEqual({ kind: 'error', message: 'Battle presentation failed' });
    } finally { r.api.dispose(); r.close(); }
});

test.each(['roulette', 'confirmation'])('cancelled reincarnation %s releases its effect and cannot leak into the next scene', async (phase) => {
    const interrupted = new Error('scene exited'); let runs = 0;
    const projection: any = { acquireEffect: jest.fn(() => ({ id: 9 })), releaseEffect: jest.fn(), setProjectedStone: jest.fn(), updateEffect: jest.fn(),
        timeline: { run: jest.fn(async (options: any) => { runs++; options.onStart?.(); if (runs === (phase === 'roulette' ? 1 : 2)) throw interrupted; }) } };
    await expect(playPixiReincarnation({ type: 'theory_incarnation_spawn_roulette', targets: [] } as any,
        { row: 3, col: 4, owner: 'black', before: { color: 1, special: 'GHOST' }, after: { color: 1, special: 'WORK' }, previewStates: [] }, projection)).rejects.toBe(interrupted);
    expect(projection.releaseEffect).toHaveBeenCalledTimes(1); expect(projection.releaseEffect).toHaveBeenCalledWith({ id: 9 });
    expect(projection.timeline.run).toHaveBeenCalledTimes(phase === 'roulette' ? 1 : 2);
});

test('reincarnation catches up to the soundtrack clock after capped slow-frame deltas', async () => {
    let listener: (delta: number) => void = () => {};
    const clock = { subscribe: (callback: (delta: number) => void) => { listener = callback; return () => {}; }, start: () => {}, stop: () => {} };
    const timeline = createPixiTimeline({ clock, render: jest.fn() });
    const types: string[] = [];
    const projection: any = { timeline, acquireEffect: () => ({ id: 1 }), releaseEffect: jest.fn(), updateEffect: jest.fn(),
        setProjectedStone: (_row: number, _col: number, visual: any) => types.push(visual.stone.specialType) };
    const playback = playPixiReincarnation({ type: 'theory_incarnation_spawn_roulette', targets: [] } as any,
        { row: 3, col: 4, owner: 'black', before: { color: 1, special: 'GHOST' }, after: { color: 1, special: 'WORK' },
            previewStates: [{ color: 1, special: 'DRAGON' }, { color: 1, special: 'SNIPER' }] }, projection);
    await drain(2499); listener(100); expect(types).not.toContain('WORK');
    await drain(1); listener(100); await Promise.resolve();
    expect(types[types.length - 1]).toBe('WORK');
    expect(projection.releaseEffect).not.toHaveBeenCalled();
    await drain(1800); listener(100); await playback;
    expect(projection.releaseEffect).toHaveBeenCalledTimes(1);
    expect(timeline.getDiagnostics()).toMatchObject({ activeRunCount: 0, completedRunCount: 2, tickerRunning: false });
});

test('host owns one document; early exit removes it, clears delayed ready work and permits a clean rematch', async () => {
    const dom = new JSDOM('<main></main>', { url: 'http://localhost/' });
    try {
        const container = dom.window.document.querySelector('main')!;
        const first = mountBattle(container, '/game/index.html', config);
        expect(() => mountBattle(container, '/game/index.html', config)).toThrow('already mounted');
        const oldDocument = container.querySelector('iframe'); first.dispose(); first.dispose();
        expect(container.children).toHaveLength(0); expect(await first.finished).toEqual({ kind: 'cancelled' });
        await expect(first.ready).rejects.toThrow('disposed'); await drain(500);
        const second = mountBattle(container, '/game/index.html', { ...config, battleId: 'rematch' });
        expect(container.querySelector('iframe')).not.toBe(oldDocument); second.dispose();
        await expect(second.ready).rejects.toThrow('disposed'); expect(await second.finished).toEqual({ kind: 'cancelled' });
    } finally { dom.window.close(); }
});
