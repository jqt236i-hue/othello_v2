import { installFrozenLv9Verification, verifyFrozenTransitionCoverage } from '../scripts/cpu-lv10-frozen-verification';
import { stableStringify } from '../shared/state-hash';

const clone = (value: any) => JSON.parse(JSON.stringify(value));
const state = (turn: number, calls = turn) => ({ gameState: { turnNumber: turn, currentPlayer: turn % 2 ? -1 : 1 },
    cardState: { chargeDeltaEvents: [], hands: { black: ['execution_01'], white: [] } }, prngState: { calls } });
const pass = { type: 'pass', autoNoActionPass: true, turnIndex: 45 };
const answer = (action: any, before: any, after: any) => ({ action, after, thinkingMs: 1,
    attempts: [{ player: 'black', action, before, after, ok: true, rngBefore: before.prngState,
        rngAfter: after.prngState, preparations: [] }], turnPlan: { turnNumber: before.gameState.turnNumber, index: 0, length: 1 } });

let oldWindow: any;
beforeEach(() => { oldWindow = (globalThis as any).window; });
afterEach(() => { if (oldWindow === undefined) delete (globalThis as any).window; else (globalThis as any).window = oldWindow; });

function fixture(initial = state(44)) {
    const root: any = { ...clone(initial), __lv10MatchAudit: { records: [] }, __lv10MatchStalled: jest.fn(async () => {}),
        __queryFrozenLv9: jest.fn(), __lv10CaptureDiagnostics: () => ({}) };
    let next: any, hooks: any;
    const rng = { getState: () => root.prngState };
    const snapshot = () => clone({ gameState: root.gameState, cardState: root.cardState, prngState: root.prngState });
    const pipeline = { applyTurnSafe: (_cs: any, _gs: any, player: string, action: any) => {
        const before = snapshot();
        Object.assign(root, clone(next));
        const after = snapshot();
        root.__lv10MatchAudit.records.push({ player, action: clone(action), before, after, ok: true });
        return { ok: true, gameState: root.gameState, cardState: root.cardState };
    } };
    root.require = (name: string) => ({
        'shared/presentation-queue': { clearPresentationQueues: () => {} },
        'shared/state-hash': { stableStringify },
        'game/turn/turn_pipeline': pipeline,
        'card-system': { getGamePrng: () => rng },
        'game/pass-handler': { setAutomaticPassGuard: jest.fn() },
        'game/cpu-turn-handler': { setCpuUIImpl: (value: any) => { hooks = value; } }
    } as any)[name];
    (globalThis as any).window = root;
    installFrozenLv9Verification({ frozenPlayer: 'black' });
    return { root, hooks, snapshot, apply: (action: any, after: any, player = 'black') => {
        next = after;
        return (pipeline.applyTurnSafe as any)(root.cardState, root.gameState, player, action, rng, {});
    } };
}

test('an automatic pass between callbacks consumes the frozen continuation before the next turn', async () => {
    const f = fixture(), first = state(44), destroyed = state(44), passed = state(45), nextTurn = state(46);
    destroyed.cardState.hands.black = [];
    const destroy = { type: 'destroy_hand_card', destroyCardId: 'execution_01', turnIndex: 45 };
    const place = { type: 'place', row: 2, col: 3, turnIndex: 47 };
    f.root.__queryFrozenLv9.mockResolvedValueOnce(answer(destroy, first, destroyed))
        .mockResolvedValueOnce(answer(pass, destroyed, passed)).mockResolvedValueOnce(answer(place, nextTurn, state(47)));
    await f.hooks.adviseComparisonOpponent();
    await f.hooks.applyComparisonOpponentPrelude(destroy);
    f.apply(destroy, destroyed);
    f.apply(pass, passed);
    f.apply({ type: 'place', row: 1, col: 2 }, nextTurn, 'white');
    await f.hooks.adviseComparisonOpponent();
    expect(f.root.__queryFrozenLv9.mock.calls.map((call: any[]) => call[0])).toEqual([first, destroyed, nextTurn]);
    expect(f.root.__lv10MatchAudit.oracleActionVerifications).toMatchObject([
        { recordIndex: 0, delivery: 'advised' }, { recordIndex: 1, delivery: 'automatic-pass' }
    ]);
    expect(f.root.__lv10MatchAudit.oracleVerificationErrors).toEqual([]);
});

test('collection verifies a final automatic pass even when there is no later CPU query', async () => {
    const f = fixture(), before = f.snapshot(), terminal = state(45);
    f.root.__queryFrozenLv9.mockResolvedValue(answer(pass, before, terminal));
    f.apply(pass, terminal);
    await f.root.__lv10FlushComparison();
    expect(f.root.__queryFrozenLv9).toHaveBeenCalledTimes(1);
    expect(f.root.__lv10MatchAudit.oracleActionVerifications).toMatchObject([{ recordIndex: 0, delivery: 'automatic-pass' }]);
});

test('an automatic pass while advice is in flight is matched to that answer without consuming twice', async () => {
    const f = fixture(), before = f.snapshot(), after = state(45);
    let resolve!: (value: any) => void;
    f.root.__queryFrozenLv9.mockImplementation(() => new Promise(done => { resolve = done; }));
    const request = f.hooks.adviseComparisonOpponent();
    for (let i = 0; i < 5 && !resolve; i++) await Promise.resolve();
    expect(resolve).toBeDefined();
    f.apply(pass, after);
    resolve(answer(pass, before, after));
    await expect(request).resolves.toMatchObject({ action: null });
    await f.root.__lv10FlushComparison();
    expect(f.root.__queryFrozenLv9).toHaveBeenCalledTimes(1);
    expect(f.root.__lv10MatchAudit.oracleActionVerifications).toHaveLength(1);
});

test.each(['state', 'rng', 'action', 'preparation', 'retry'])('automatic pass rejects mismatched %s', async kind => {
    const f = fixture(), before = f.snapshot(), after = state(45), expected: any = answer(pass, before, after);
    if (kind === 'state') expected.after = { ...clone(after), gameState: { ...after.gameState, turnNumber: 47 } };
    if (kind === 'rng') expected.after = { ...clone(after), prngState: { calls: 999 } };
    if (kind === 'action') expected.action = { type: 'place', row: 1, col: 2, turnIndex: 45 };
    if (kind === 'preparation') expected.attempts[0].preparations = [{ kind: 'clearPendingEffect' }];
    if (kind === 'retry') expected.attempts.unshift({ ...expected.attempts[0], ok: false });
    f.root.__queryFrozenLv9.mockResolvedValue(expected);
    f.apply(pass, after);
    await expect(f.root.__lv10FlushComparison()).rejects.toThrow('automatic_pass_mismatch');
    expect(f.root.__lv10MatchAudit.oracleActionVerifications).toEqual([]);
    expect(f.root.__lv10MatchStalled).toHaveBeenCalled();
});

test('an unadvised non-pass cannot be accepted as frozen CPU behavior', () => {
    const f = fixture();
    expect(() => f.apply({ type: 'place', row: 2, col: 3 }, state(45))).toThrow('unadvised_frozen_action');
});

test('FATE-controlled actions are attributed to the controlling CPU, not the stone color', async () => {
    const initial: any = state(44);
    initial.cardState.fateWillControllerByTurnOwner = { black: 'white' };
    const f = fixture(initial);
    f.apply({ type: 'place', row: 2, col: 3 }, state(45));
    await f.root.__lv10FlushComparison();
    expect(f.root.__queryFrozenLv9).not.toHaveBeenCalled();
    expect(f.root.__lv10MatchAudit.oracleActionVerifications).toEqual([]);
});

test('a frozen CPU controlling the other color still requires full verification', async () => {
    const initial: any = state(45);
    initial.cardState.fateWillControllerByTurnOwner = { white: 'black' };
    const f = fixture(initial), action = { type: 'place', row: 2, col: 3 }, next = state(46);
    const expected = answer(action, initial, next);
    expected.attempts[0].player = 'white';
    f.root.__queryFrozenLv9.mockResolvedValue(expected);
    await f.hooks.adviseComparisonOpponent();
    f.apply(action, next, 'white');
    await f.root.__lv10FlushComparison();
    expect(f.root.__lv10MatchAudit.oracleActionVerifications).toMatchObject([{ recordIndex: 0, delivery: 'advised' }]);
});

test.each(['valid', 'missing', 'duplicate', 'changed-rng'])('saved coverage is independently rechecked: %s', kind => {
    const before = state(44), after = state(45);
    const audit: any = { records: [{ ok: true, player: 'black', action: pass, before, after }],
        frozenOpponent: { answers: [answer(pass, before, after)] },
        oracleActionVerifications: [{ recordIndex: 0, oracleAnswerIndex: 0, delivery: 'automatic-pass' }] };
    if (kind === 'missing') audit.oracleActionVerifications = [];
    if (kind === 'duplicate') audit.oracleActionVerifications.push(audit.oracleActionVerifications[0]);
    if (kind === 'changed-rng') audit.frozenOpponent.answers[0].after = { ...after, prngState: { calls: 999 } };
    if (kind === 'valid') expect(() => verifyFrozenTransitionCoverage(audit, 'black')).not.toThrow();
    else expect(() => verifyFrozenTransitionCoverage(audit, 'black')).toThrow(/frozen transition coverage/);
});
