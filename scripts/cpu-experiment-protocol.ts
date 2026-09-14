import crypto = require('node:crypto');
import type { ProductionPolicySpec } from './run-production-selfplay';

export type ExperimentSpec = {
    label: string; mode: 'development' | 'acceptance'; out: string;
    paired: number; blackOnly: number; whiteOnly: number; concurrency: number;
    candidate: ProductionPolicySpec; opponent: ProductionPolicySpec;
    candidateProfile?: number | string; opponentProfile?: number | string;
    parityGateFile?: string;
    maxDecisions?: number; timeoutMs?: number;
};
export type ExperimentCondition = { id: number; seed: number; kind: 'paired' | 'black' | 'white' };
export type ExperimentSlot = { id: string; condition: number; seed: number; candidateColor: 'black' | 'white' };

export const LV11_ACCEPTANCE = Object.freeze({
    version: '2026-09-14-user-lv11-30-games-23-wins-stop10-parallel4', paired: 10, blackOnly: 0, whiteOnly: 10,
    games: 30, black: 10, white: 20, minimumWins: 23,
    concurrency: 4, earlyStopGames: 10, earlyStopLosses: 5,
    winRateDefinition: 'candidate victories / all 30 games; draws are not victories',
    scoreRateDefinition: '(victories + 0.5 * draws) / all games',
    confidenceInterval: 'not calculated; not an additional adoption criterion',
    correspondence: 'Each paired condition uses the identical initial board, black/white shuffled decks and gameplay PRNG. Only the policy assigned to each seat is exchanged.'
});

export function makeExperimentSchedule(spec: ExperimentSpec, usedSeeds: ReadonlySet<number>) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(spec.label)) throw new Error('Invalid experiment label');
    for (const key of ['paired', 'blackOnly', 'whiteOnly'] as const) {
        if (!Number.isInteger(spec[key]) || spec[key] < 0 || spec[key] > 500) throw new Error(`Invalid ${key} count`);
    }
    if (!['acceptance', 'development'].includes(spec.mode) || !Number.isInteger(spec.concurrency) || spec.concurrency < 1 || spec.concurrency > 8) {
        throw new Error('Invalid mode/concurrency');
    }
    if (spec.mode === 'acceptance' && (spec.paired !== LV11_ACCEPTANCE.paired
        || spec.blackOnly !== LV11_ACCEPTANCE.blackOnly || spec.whiteOnly !== LV11_ACCEPTANCE.whiteOnly)) {
        throw new Error('Lv11 acceptance requires 10 paired plus 10 white-only conditions (30 games, 23 wins)');
    }
    if (spec.mode === 'acceptance' && spec.concurrency !== LV11_ACCEPTANCE.concurrency) {
        throw new Error('Lv11 acceptance requires four concurrent games');
    }
    const conditions: ExperimentCondition[] = [], schedule: ExperimentSlot[] = [];
    for (const [key, kind] of [['paired', 'paired'], ['blackOnly', 'black'], ['whiteOnly', 'white']] as const) {
        for (let i = 0; i < spec[key]; i++) {
            const id = conditions.length + 1;
            const seed = crypto.createHash('sha256').update(`production-cpu-condition.v1/${spec.label}/${id}`).digest().readUInt32LE(0);
            if (usedSeeds.has(seed) || conditions.some(condition => condition.seed === seed)) throw new Error(`Condition seed already issued: ${seed}`);
            conditions.push({ id, seed, kind });
            for (const candidateColor of kind === 'paired' ? ['black', 'white'] as const : [kind]) {
                schedule.push({ id: `${id}-${candidateColor}`, condition: id, seed, candidateColor });
            }
        }
    }
    if (!schedule.length) throw new Error('Experiment must contain games');
    // Fixed hash ordering interleaves the color mix without consuming game RNG.
    const orderKey = (slot: ExperimentSlot) => crypto.createHash('sha256').update(`${spec.label}/order/${slot.id}`).digest('hex');
    schedule.sort((a, b) => orderKey(a).localeCompare(orderKey(b)));
    return { conditions, schedule };
}

export type ExperimentScore = { id: string; winner: 'black' | 'white' | 'draw'; initialSha256: string };

/** Always use the declared first ten slots, never the first ten finishers. */
export function experimentEarlyStop(schedule: ExperimentSlot[], scores: ExperimentScore[]) {
    const first = schedule.slice(0, LV11_ACCEPTANCE.earlyStopGames);
    const byId = new Map(scores.map(score => [score.id, score]));
    if (byId.size !== scores.length) throw new Error('Duplicate early-stop result');
    const known = first.filter(slot => byId.has(slot.id));
    const losses = known.filter(slot => {
        const winner = byId.get(slot.id)!.winner;
        if (!['black', 'white', 'draw'].includes(winner)) throw new Error('Invalid early-stop winner');
        return winner !== 'draw' && winner !== slot.candidateColor;
    }).length;
    const ready = first.length === LV11_ACCEPTANCE.earlyStopGames && known.length === first.length;
    return { slots: first.map(slot => slot.id), completed: known.length, losses, ready,
        stop: ready && losses >= LV11_ACCEPTANCE.earlyStopLosses };
}

/** The gate is a barrier: no eleventh slot is launched while any of the
 * declared first ten is unresolved. Run callbacks also handle saved attempts. */
export async function runExperimentSchedule(spec: ExperimentSpec, schedule: ExperimentSlot[],
    run: (slot: ExperimentSlot) => Promise<void>, stopped: () => boolean,
    checkGate: () => boolean | Promise<boolean>) {
    const stages = spec.mode === 'acceptance'
        ? [schedule.slice(0, LV11_ACCEPTANCE.earlyStopGames), schedule.slice(LV11_ACCEPTANCE.earlyStopGames)] : [schedule];
    for (let stage = 0; stage < stages.length; stage++) {
        let index = 0, failed = false;
        const batch = stages[stage];
        const workers = await Promise.allSettled(Array.from({ length: spec.concurrency }, async () => {
            while (index < batch.length && !failed && !stopped()) {
                const slot = batch[index++];
                try { await run(slot); } catch (error) { failed = true; throw error; }
            }
        }));
        const errors = workers.filter(result => result.status === 'rejected') as PromiseRejectedResult[];
        if (errors.length) throw new Error(errors.map(result => String(result.reason)).join('\n'));
        if (stopped()) return;
        if (spec.mode === 'acceptance' && stage === 0 && !await checkGate()) return;
    }
}
export function summarizeExperiment(spec: ExperimentSpec, conditions: ExperimentCondition[], schedule: ExperimentSlot[], scores: ExperimentScore[]) {
    const byId = new Map<string, ExperimentScore>();
    for (const score of scores) {
        if (byId.has(score.id) || !schedule.some(slot => slot.id === score.id) || !['black', 'white', 'draw'].includes(score.winner)) {
            throw new Error('Invalid, unscheduled or duplicate game result');
        }
        byId.set(score.id, score);
    }
    for (const condition of conditions.filter(condition => condition.kind === 'paired')) {
        const black = byId.get(`${condition.id}-black`), white = byId.get(`${condition.id}-white`);
        if (black && white && black.initialSha256 !== white.initialSha256) throw new Error('Paired initial states differ');
    }
    const tally = (slots: ExperimentSlot[]) => {
        const known = slots.filter(slot => byId.has(slot.id));
        const wins = known.filter(slot => byId.get(slot.id)!.winner === slot.candidateColor).length;
        const draws = known.filter(slot => byId.get(slot.id)!.winner === 'draw').length;
        return { scheduled: slots.length, completed: known.length, wins, draws, losses: known.length - wins - draws,
            winRate: slots.length ? wins / slots.length : null, scoreRate: slots.length ? (wins + .5 * draws) / slots.length : null };
    };
    const all = tally(schedule), black = tally(schedule.filter(slot => slot.candidateColor === 'black')),
        white = tally(schedule.filter(slot => slot.candidateColor === 'white'));
    const complete = scores.length === schedule.length;
    const gateSchedule = spec.paired === LV11_ACCEPTANCE.paired && spec.blackOnly === LV11_ACCEPTANCE.blackOnly && spec.whiteOnly === LV11_ACCEPTANCE.whiteOnly
        && conditions.length === LV11_ACCEPTANCE.paired + LV11_ACCEPTANCE.whiteOnly
        && conditions.filter(condition => condition.kind === 'paired').length === LV11_ACCEPTANCE.paired
        && conditions.filter(condition => condition.kind === 'white').length === LV11_ACCEPTANCE.whiteOnly
        && schedule.length === LV11_ACCEPTANCE.games && black.scheduled === LV11_ACCEPTANCE.black && white.scheduled === LV11_ACCEPTANCE.white;
    const earlyStop = experimentEarlyStop(schedule, scores);
    return { complete, ...all, black, white, earlyStop,
        meetsWinGate: spec.mode === 'acceptance' && spec.concurrency === LV11_ACCEPTANCE.concurrency
            && gateSchedule && complete && !earlyStop.stop && all.wins >= LV11_ACCEPTANCE.minimumWins,
        note: complete ? 'All scheduled games complete' : 'Incomplete experiment; fractions use scheduled slots and are not final evidence' };
}
