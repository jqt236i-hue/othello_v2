import { installFrozenShrinkActionPrng } from '../scripts/cpu-lv10-frozen-shrink-prng';
const Prng = require('../game/schema/prng');

let oldWindow: any;
beforeEach(() => { oldWindow = (globalThis as any).window; });
afterEach(() => {
    if (oldWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = oldWindow;
});

function fixture() {
    // Legacy state hydration can construct a second PRNG from the serialized
    // default source. Its draws must not bypass the live pipeline counter.
    const live = Prng.createPRNG(1968551290), copied = Prng.fromState(live.getState());
    const calls: any[] = [];
    const shrink: any = {};
    for (const name of ['applyBoardShrinkWill', 'applyBoardShrinkGod']) {
        shrink[name] = jest.fn((cs: any, gs: any, player: any, row: any, col: any, deps: any) => {
            calls.push({ cs, gs, player, row, col, deps });
            return { applied: true, draw: deps.random.random() };
        });
    }
    const root = { require: () => shrink, __frozenLv9Oracle: { canonicalAttempt: null as any } };
    (globalThis as any).window = root;
    installFrozenShrinkActionPrng();
    return { root, shrink, live, copied, calls };
}

test.each(['applyBoardShrinkWill', 'applyBoardShrinkGod'])('%s consumes the real canonical RNG and records the repair', name => {
    const f = fixture(), attempt = { shrinkActionPrngInjected: false };
    f.root.__frozenLv9Oracle.canonicalAttempt = attempt;
    const cs = { _boardOpsRandomSource: f.live }, gs = { board: [[0]] };
    const deps = { random: f.copied, preserved: true };
    const result = f.shrink[name](cs, gs, 'black', 1, 0, deps);
    expect(result.applied).toBe(true);
    expect(f.live.getState().calls).toBe(1);
    expect(f.copied.getState().calls).toBe(0);
    expect(attempt.shrinkActionPrngInjected).toBe(true);
    expect(f.calls[0]).toMatchObject({ cs, gs, player: 'black', row: 1, col: 0, deps: { preserved: true } });
    expect(deps.random).toBe(f.copied);
});

test('the original CPU hypothetical evaluations keep their original dependencies', () => {
    const f = fixture();
    const deps = { random: f.copied };
    f.shrink.applyBoardShrinkGod({ _boardOpsRandomSource: f.live }, {}, 'black', 0, 0, deps);
    expect(f.calls[0].deps).toBe(deps);
    expect(f.live.getState().calls).toBe(0);
    expect(f.copied.getState().calls).toBe(1);
});

test('missing action RNG is not replaced with a fabricated generator', () => {
    const f = fixture(), attempt = { shrinkActionPrngInjected: false };
    f.root.__frozenLv9Oracle.canonicalAttempt = attempt;
    const deps = { random: f.copied };
    f.shrink.applyBoardShrinkWill({}, {}, 'white', 0, 0, deps);
    expect(f.calls[0].deps).toBe(deps);
    expect(attempt.shrinkActionPrngInjected).toBe(false);
});
