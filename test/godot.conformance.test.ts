import { assertCoverage, compareOutputs, CONFORMANCE_SCHEMA, deterministicVectors,
    jsonDifferences, loadConformance, replayCase } from '../scripts/godot-conformance';
import TimeStop = require('../game/logic/cards-internal/ribo-time-stop');

const baseline = loadConformance();

test('every adopted card and required boundary replays full states, events and results against immutable portable goldens', () => {
    const cases = baseline.cases.map(replayCase);
    assertCoverage(baseline.cases, cases);
    expect(compareOutputs(baseline.expected, { schema: CONFORMANCE_SCHEMA, cases })).toEqual([]);
    expect(deterministicVectors()).toEqual(baseline.vectors);
});

test('foreign results report the case, step and JSON path rather than only a hash', () => {
    const reference = { schema: CONFORMANCE_SCHEMA, cases: [{ id: 'example', steps: [{ state: { board: [[1, -1]] }, result: null }] }] };
    const actual = JSON.parse(JSON.stringify(reference)); actual.cases[0].steps[0].state.board[0][1] = 1;
    expect(compareOutputs(reference, actual)).toEqual([{ caseId: 'example', step: 0, path: '/steps/0/state/board/0/1', expected: -1, actual: 1 }]);
    actual.cases[0].steps[0].result = undefined;
    expect(compareOutputs(reference, actual).some(item => item.path === '/steps/0/result')).toBe(true);
});

test('comparison rejects missing, unknown, duplicated cases, incomplete steps and unsupported schemas', () => {
    const expected = { schema: CONFORMANCE_SCHEMA, cases: [{ id: 'one', steps: [{ ok: true }] }] };
    expect(compareOutputs(expected, { ...expected, cases: [] })).toHaveLength(1);
    expect(compareOutputs(expected, { ...expected, cases: [...expected.cases, { id: 'unknown', steps: [] }] })).toHaveLength(1);
    expect(() => compareOutputs(expected, { ...expected, cases: [...expected.cases, ...expected.cases] })).toThrow('Duplicate');
    expect(compareOutputs(expected, { ...expected, cases: [{ id: 'one', steps: [] }] }).length).toBeGreaterThan(0);
    expect(() => compareOutputs(expected, { ...expected, schema: 'godot-conformance.v2' })).toThrow('schema');
    expect(() => assertCoverage(baseline.cases.filter(item => item.id !== 'card/reincarnation_will_01/basic'), baseline.expected.cases.filter((item: any) => item.id !== 'card/reincarnation_will_01/basic'))).toThrow('Missing card coverage');
});

test('JSON comparison preserves ordering and null/absent while ignoring object member order', () => {
    expect(jsonDifferences({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
    expect(jsonDifferences([1, 2], [2, 1])).toHaveLength(2);
    expect(jsonDifferences({ value: null }, {})).toHaveLength(1);
    expect(jsonDifferences([], {})).toHaveLength(1);
});

test('semantic gates prevent blessing broken rejection or early terminal behavior through snapshot regeneration', () => {
    const corrupted = JSON.parse(JSON.stringify(baseline.expected.cases));
    corrupted.find((item: any) => item.id === 'card/chest_01/rejected').steps[0].ok = true;
    expect(() => assertCoverage(baseline.cases, corrupted)).toThrow();
    const missingFusion = JSON.parse(JSON.stringify(baseline.expected.cases));
    missingFusion.find((item: any) => item.id === 'interaction/four-element-fusion').steps.forEach((step: any) => {
        step.state.cardState.markers = step.state.cardState.markers.filter((marker: any) => marker.data?.type !== 'SHINRA_BANSHO_GOD');
    });
    expect(() => assertCoverage(baseline.cases, missingFusion)).toThrow('fuse');
});

test('portable lifecycle cases detect missing consecutive-turn execution independently of the golden', () => {
    const noConsecutiveTurns = jest.spyOn(TimeStop, 'consumeTimeStopConsecutiveTurn').mockImplementation(() => false as any);
    try {
        const cases = baseline.cases.map(replayCase);
        const differences = compareOutputs(baseline.expected, { schema: CONFORMANCE_SCHEMA, cases });
        for (const cardId of ['time_stop_god_01', 'time_stop_deity_01']) {
            expect(differences.some(item => item.caseId === `lifecycle/${cardId}/activation-to-handoff`
                && item.path.endsWith('/currentPlayer'))).toBe(true);
        }
        // This must still fail if somebody were to record the broken output as
        // a replacement golden: expectations come from the rule, not snapshots.
        expect(() => assertCoverage(baseline.cases, cases)).toThrow(/Time-stop|reserved turn|Handoff/);
    } finally { noConsecutiveTurns.mockRestore(); }
});

test('time-stop rule assertions reject an extra reserved action and premature round advancement', () => {
    for (const cardId of ['time_stop_god_01', 'time_stop_deity_01']) {
        const wrongReservation = JSON.parse(JSON.stringify(baseline.expected.cases));
        wrongReservation.find((item: any) => item.id === `lifecycle/${cardId}/activation-to-handoff`)
            .steps[4].state.cardState.timeStopConsecutiveTurnsRemainingByPlayer.black++;
        expect(() => assertCoverage(baseline.cases, wrongReservation)).toThrow('Activation must include exactly');
        const wrongRound = JSON.parse(JSON.stringify(baseline.expected.cases));
        wrongRound.find((item: any) => item.id === `lifecycle/${cardId}/activation-to-handoff`)
            .steps[5].state.gameState.roundNumber++;
        expect(() => assertCoverage(baseline.cases, wrongRound)).toThrow('must not advance round');
    }
});

test('delayed-effect rule assertions cannot bless missing infection, explosion or sprouting', () => {
    for (const [cardId, row, col, value, message] of [
        ['zombie_will_01', 3, 4, -1, 'infection must change'],
        ['bomb_01', 3, 3, 1, 'Time bomb must destroy'],
        ['seed_01', 2, 2, 0, 'Seed must sprout']
    ] as const) {
        const missingEffect = JSON.parse(JSON.stringify(baseline.expected.cases));
        missingEffect.find((item: any) => item.id === `lifecycle/${cardId}/delayed-activation`)
            .steps[2].state.gameState.board[row][col] = value;
        expect(() => assertCoverage(baseline.cases, missingEffect)).toThrow(message);
    }
});
