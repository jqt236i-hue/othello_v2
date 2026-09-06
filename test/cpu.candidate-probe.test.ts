import * as Probe from '../game/ai/cpu-candidate-probe';
function model(scores: number[], ids?: string[]) {
    return { meta: { inputDim: 80, baseInputDim: 80, cardActionIds: ids || [] },
        layers: [{ weights: scores.map(() => Array(80).fill(0)), bias: scores }], golden: scores };
}
const board = () => Array.from({ length: 8 }, () => Array(8).fill(0));
test('candidate color isolation and legal card mask, including holding', () => {
    Probe.configure({ schema: 'candidate_probe.v1', heads: { card: model([1, 3, 100], ['__no_card__', 'legal', 'illegal']) } }, 'white', ['card']);
    expect(Probe.chooseCard({ playerKey: 'black', board: board(), usableCardIds: ['legal'] })).toBeNull();
    expect(Probe.chooseCard({ playerKey: 'white', board: board(), usableCardIds: ['legal'] })).toEqual({ cardId: 'legal' });
    expect(Probe.chooseCard({ playerKey: 'white', board: board(), usableCardIds: [] })).toEqual({ cardId: null });
});
test('holes are rejected and only supplied legal coordinates can be selected', () => {
    const scores = Array(64).fill(0); scores[0] = 100; scores[10] = 2;
    Probe.configure({ schema: 'candidate_probe.v1', heads: { place: model(scores) } }, 'white', ['place']);
    const legal = [{ row: 1, col: 1 }, { row: 1, col: 2 }];
    expect(Probe.chooseCell('place', { playerKey: 'white', board: board() }, legal)).toEqual(legal[1]);
    const invalid = board(); invalid[0][0] = 2;
    expect(Probe.chooseCell('place', { playerKey: 'white', board: invalid }, legal)).toBeNull();
});
test('numerical parity is required before candidate activation', () => {
    const broken = model([1]); broken.golden = [2];
    expect(() => Probe.configure({ schema: 'candidate_probe.v1', heads: { value: broken } }, 'white', ['value'])).toThrow('parity');
    expect(Probe.active('white', 'place')).toBeFalsy();
    broken.golden = [];
    expect(() => Probe.configure({ schema: 'candidate_probe.v1', heads: { value: broken } }, 'white', ['value'])).toThrow('parity');
});
