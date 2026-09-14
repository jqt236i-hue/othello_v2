import { makeExperimentSchedule, summarizeExperiment, experimentEarlyStop, runExperimentSchedule, type ExperimentSpec, type ExperimentScore } from '../scripts/cpu-experiment-protocol';

const policy = { root: '.', module: 'game/ai/cpu-lv10-search', search: 'searchLv10', config: 'LV10_SEARCH_CONFIG' };
const spec: ExperimentSpec = { label: 'protocol-fixture', mode: 'acceptance', out: '.', paired: 10, blackOnly: 0, whiteOnly: 10,
    concurrency: 4, candidate: policy, opponent: policy };

test('the fixed acceptance schedule contains 10 paired and 10 white-only conditions', () => {
    const result = makeExperimentSchedule(spec, new Set());
    expect(result.conditions).toHaveLength(20); expect(result.schedule).toHaveLength(30);
    expect(result.schedule.filter(slot => slot.candidateColor === 'black')).toHaveLength(10);
    expect(result.schedule.filter(slot => slot.candidateColor === 'white')).toHaveLength(20);
    expect(result).toEqual(makeExperimentSchedule(spec, new Set()));
    expect(() => makeExperimentSchedule(spec, new Set([result.conditions[4].seed]))).toThrow('already issued');
    expect(() => makeExperimentSchedule({ ...spec, paired: 15, whiteOnly: 0 }, new Set())).toThrow('10 paired');
    expect(() => makeExperimentSchedule({ ...spec, paired: 30, whiteOnly: 40 }, new Set())).toThrow('10 paired');
    expect(() => makeExperimentSchedule({ ...spec, concurrency: 1 }, new Set())).toThrow('four concurrent');
});

test('first-ten rejection uses declared order and does not count draws as losses', () => {
    const { conditions, schedule } = makeExperimentSchedule(spec, new Set());
    const scores: ExperimentScore[] = schedule.map((slot, index) => ({ id: slot.id, initialSha256: String(slot.seed),
        winner: index < 5 ? (slot.candidateColor === 'black' ? 'white' as const : 'black' as const) : slot.candidateColor }));
    expect(experimentEarlyStop(schedule, scores.slice(0, 9)).ready).toBe(false);
    expect(experimentEarlyStop(schedule, scores.slice(0, 10).reverse())).toMatchObject({ ready: true, stop: true, losses: 5 });
    expect(experimentEarlyStop(schedule, scores.slice(10, 20))).toMatchObject({ ready: false, stop: false });
    // Even 25 wins cannot legitimize bypassing the mandatory first-ten stop.
    expect(summarizeExperiment(spec, conditions, schedule, scores).meetsWinGate).toBe(false);
    scores[4].winner = 'draw';
    expect(experimentEarlyStop(schedule, scores.slice(0, 10))).toMatchObject({ ready: true, stop: false, losses: 4 });
});

test.each([true, false])('four-worker scheduling waits for the declared first ten before gate, continue=%s', async proceed => {
    const { schedule } = makeExperimentSchedule(spec, new Set());
    const started: string[] = [], finished: string[] = [];
    let running = 0, peak = 0, gateCalls = 0;
    await runExperimentSchedule(spec, schedule, async slot => {
        started.push(slot.id); running++; peak = Math.max(peak, running);
        // Complete in a deliberately different order.
        await new Promise(resolve => setTimeout(resolve, slot.id === schedule[0].id ? 20 : 1));
        finished.push(slot.id); running--;
    }, () => false, () => {
        gateCalls++;
        expect(running).toBe(0);
        expect(started).toEqual(schedule.slice(0, 10).map(slot => slot.id));
        expect(new Set(finished)).toEqual(new Set(started));
        return proceed;
    });
    expect(peak).toBe(4); expect(gateCalls).toBe(1);
    expect(started).toEqual(schedule.slice(0, proceed ? 30 : 10).map(slot => slot.id));
});

test('failed worker prevents further launches and waits for its peers to settle', async () => {
    const { schedule } = makeExperimentSchedule(spec, new Set());
    let running = 0, launches = 0, gateCalled = false;
    await expect(runExperimentSchedule(spec, schedule, async slot => {
        launches++; running++;
        try {
            if (slot.id === schedule[0].id) throw new Error('fixture failure');
            await new Promise(resolve => setTimeout(resolve, 5));
        } finally { running--; }
    }, () => false, () => { gateCalled = true; return true; })).rejects.toThrow('fixture failure');
    expect(launches).toBeLessThanOrEqual(4); expect(running).toBe(0); expect(gateCalled).toBe(false);
});

test.each([22, 23])('the whole-30-game win gate counts %s wins with remaining draws correctly', wins => {
    const { conditions, schedule } = makeExperimentSchedule(spec, new Set());
    const scores = schedule.map((slot, index) => ({ id: slot.id,
        winner: index < wins ? slot.candidateColor : 'draw' as const, initialSha256: String(slot.seed) }));
    const result = summarizeExperiment(spec, conditions, schedule, scores);
    expect(result.winRate).toBe(wins / 30);
    expect(result.scoreRate).toBe((wins + (30 - wins) / 2) / 30);
    expect(result.meetsWinGate).toBe(wins >= 23);
    expect(summarizeExperiment(spec, conditions, schedule, scores.slice(0, 29)).meetsWinGate).toBe(false);
    expect(summarizeExperiment(spec, conditions, schedule, scores.slice(0, 23)).meetsWinGate).toBe(false);
    expect(summarizeExperiment({ ...spec, mode: 'development' }, conditions, schedule, scores).meetsWinGate).toBe(false);
});

test('withdrawn 100-game results cannot satisfy the current acceptance gate', () => {
    const oldSpec: ExperimentSpec = { ...spec, mode: 'development', paired: 30, whiteOnly: 40 };
    const { conditions, schedule } = makeExperimentSchedule(oldSpec, new Set());
    const scores = schedule.map(slot => ({ id: slot.id, winner: slot.candidateColor, initialSha256: String(slot.seed) }));
    expect(summarizeExperiment({ ...oldSpec, mode: 'acceptance' }, conditions, schedule, scores).meetsWinGate).toBe(false);
});

test('duplicate results and mismatched paired starting states cannot establish a win gate', () => {
    const { conditions, schedule } = makeExperimentSchedule(spec, new Set());
    const scores = schedule.map(slot => ({ id: slot.id, winner: slot.candidateColor, initialSha256: String(slot.seed) }));
    expect(() => summarizeExperiment(spec, conditions, schedule, [...scores, scores[0]])).toThrow('duplicate');
    scores.find(score => score.id === '1-white')!.initialSha256 = 'different';
    expect(() => summarizeExperiment(spec, conditions, schedule, scores)).toThrow('initial states differ');
});
