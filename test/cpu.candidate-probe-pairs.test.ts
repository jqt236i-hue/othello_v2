import { summarizePairs } from '../scripts/benchmark-candidate-probe';

const pair = () => ['black', 'white'].map(color => ({
    head: 'target', color, status: 'completed', validSimulation: true,
    exercised: true, initialStateHash: 'same', score: 1
}));

test('only completed, exercised, matching initial states count as a pair', () => {
    expect(summarizePairs(pair())[0]).toMatchObject({ eligible: true, score: 2 });
    const different = pair(); different[1].initialStateHash = 'different';
    expect(summarizePairs(different)[0]).toMatchObject({ eligible: false, score: null });
    const unused = pair(); unused[1].exercised = false;
    expect(summarizePairs(unused)[0].eligible).toBe(false);
    const failed = pair(); failed[1].validSimulation = false;
    expect(summarizePairs(failed)[0].eligible).toBe(false);
    expect(summarizePairs(pair().slice(0, 1))[0].eligible).toBe(false);
});
