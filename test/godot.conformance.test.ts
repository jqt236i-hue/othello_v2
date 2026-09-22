import { assertCoverage, compareOutputs, CONFORMANCE_SCHEMA, deterministicVectors,
    jsonDifferences, loadConformance, replayCase } from '../scripts/godot-conformance';

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
