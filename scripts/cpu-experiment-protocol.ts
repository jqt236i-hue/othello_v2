import crypto = require('node:crypto');
import type { ProductionPolicySpec } from './run-production-selfplay';

export type ExperimentSpec = {
    label: string; mode: 'development' | 'acceptance'; out: string;
    paired: number; blackOnly: number; whiteOnly: number; concurrency: number;
    candidate: ProductionPolicySpec; opponent: ProductionPolicySpec;
    candidateProfile?: number | string; opponentProfile?: number | string;
    parityGateFile?: string;
    /** Development-only comparison on an already audited formal first-ten set. */
    developmentReplayOf?: { manifest: string; audit: string };
    /** Immutable union of whole completed audited trials, for controlled development comparisons. */
    developmentSet?: { path: string; sha256: string };
    acceptance?: 'lv11' | 'lv12' | 'lv13';
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

export const LV12_ACCEPTANCE = Object.freeze({
    ...LV11_ACCEPTANCE,
    version: '2026-09-14-lv12-30-games-25-wins-balanced-stop10-loss4',
    paired: 15, blackOnly: 0, whiteOnly: 0, games: 30, black: 15, white: 15,
    minimumWins: 25, earlyStopLosses: 4, concurrency: 4
});
export function experimentProtocol(spec: Pick<ExperimentSpec, 'acceptance'>) {
    if (spec.acceptance === 'lv13') return LV13_ACCEPTANCE;
    return spec.acceptance === 'lv12' ? LV12_ACCEPTANCE : LV11_ACCEPTANCE;
}

export const LV13_ACCEPTANCE = Object.freeze({
    ...LV11_ACCEPTANCE,
    version: '2026-09-15-lv13-30-games-25-wins-white20-black10-stop10-loss4',
    minimumWins: 25, earlyStopLosses: 4, concurrency: 4,
    firstTenWhite: 7, firstTenBlack: 3
});

export function makeExperimentSchedule(spec: ExperimentSpec, usedSeeds: ReadonlySet<number>, replaySchedule?: readonly ExperimentSlot[]) {
    const protocol = experimentProtocol(spec);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(spec.label)) throw new Error('Invalid experiment label');
    for (const key of ['paired', 'blackOnly', 'whiteOnly'] as const) {
        if (!Number.isInteger(spec[key]) || spec[key] < 0 || spec[key] > 500) throw new Error(`Invalid ${key} count`);
    }
    if (!['acceptance', 'development'].includes(spec.mode) || !Number.isInteger(spec.concurrency) || spec.concurrency < 1 || spec.concurrency > 8) {
        throw new Error('Invalid mode/concurrency');
    }
    if (spec.mode === 'acceptance' && (spec.paired !== protocol.paired
        || spec.blackOnly !== protocol.blackOnly || spec.whiteOnly !== protocol.whiteOnly)) {
        throw new Error(spec.acceptance === 'lv13' ? 'Lv13 acceptance requires 10 paired and 10 white-only conditions (30 games, 25 wins)'
            : spec.acceptance === 'lv12' ? 'Lv12 acceptance requires 15 paired conditions (30 games, 25 wins)'
            : 'Lv11 acceptance requires 10 paired plus 10 white-only conditions (30 games, 23 wins)');
    }
    if ((spec.acceptance === 'lv12' || spec.acceptance === 'lv13') && spec.concurrency > 4) throw new Error('Development and acceptance permit at most four games');
    if (spec.mode === 'acceptance' && spec.acceptance !== 'lv12' && spec.acceptance !== 'lv13' && spec.concurrency !== protocol.concurrency) {
        throw new Error('Lv11 acceptance requires four concurrent games');
    }
    if (spec.developmentReplayOf || spec.developmentSet || replaySchedule) {
        if (spec.mode !== 'development' || !['lv12', 'lv13'].includes(spec.acceptance || '')) throw new Error('Issued conditions may only be replayed in development');
        if (!!spec.developmentReplayOf === !!spec.developmentSet || !replaySchedule) throw new Error('Development replay requires audited source evidence');
        if (spec.developmentReplayOf && (spec.paired !== 5 || spec.blackOnly || spec.whiteOnly || replaySchedule.length !== 10)) throw new Error('Development replay uses all five first-ten pairs');
        if (spec.developmentSet && (!spec.paired || spec.blackOnly || spec.whiteOnly || replaySchedule.length !== spec.paired * 2)) throw new Error('Common development set requires every declared pair');
        const conditions: ExperimentCondition[] = [], schedule = replaySchedule.map(slot => ({ ...slot }));
        const seen = new Set<number>();
        for (let index = 0; index < schedule.length; index += 2) {
            const a = schedule[index], b = schedule[index + 1];
            if (!Number.isInteger(a.condition) || a.condition < 1 || seen.has(a.condition)
                || !Number.isInteger(a.seed) || a.seed < 0 || a.seed > 0xffffffff || !usedSeeds.has(a.seed)
                || conditions.some(condition => condition.seed === a.seed)
                || b.condition !== a.condition || b.seed !== a.seed
                || !['black', 'white'].includes(a.candidateColor) || !['black', 'white'].includes(b.candidateColor)
                || a.candidateColor === b.candidateColor
                || a.id !== `${a.condition}-${a.candidateColor}` || b.id !== `${b.condition}-${b.candidateColor}`) {
                throw new Error('Invalid or unissued development replay pair');
            }
            seen.add(a.condition); conditions.push({ id: a.condition, seed: a.seed, kind: 'paired' });
        }
        return { conditions, schedule };
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
    if (spec.acceptance === 'lv13' && spec.mode === 'acceptance') {
        const ordered = schedule.slice().sort((a,b) => orderKey(a).localeCompare(orderKey(b)));
        const first = [...ordered.filter(slot=>slot.candidateColor==='white').slice(0,7),
            ...ordered.filter(slot=>slot.candidateColor==='black').slice(0,3)]
            .sort((a,b)=>orderKey(a).localeCompare(orderKey(b)));
        schedule.splice(0,schedule.length,...first,...ordered.filter(slot=>!first.includes(slot)));
    } else if (spec.acceptance === 'lv12') {
        // Order whole condition pairs: the first ten are exactly five pairs.
        const pairKey = (slot: ExperimentSlot) => crypto.createHash('sha256').update(`${spec.label}/pair-order/${slot.condition}`).digest('hex');
        schedule.sort((a,b) => pairKey(a).localeCompare(pairKey(b)) || orderKey(a).localeCompare(orderKey(b)));
    } else schedule.sort((a, b) => orderKey(a).localeCompare(orderKey(b)));
    return { conditions, schedule };
}

export type ExperimentScore = { id: string; winner: 'black' | 'white' | 'draw'; initialSha256: string };

/** Audit launch history independently from the score tally. A later slot
 * must not overlap any unresolved member of the declared first-ten group. */
export function auditExperimentProcesses(spec: ExperimentSpec, schedule: ExperimentSlot[], history: readonly any[]) {
    const first = new Set(schedule.slice(0,10).map(slot => slot.id));
    const events: {time:number;delta:number}[] = [];
    const visited = new Set<string>();
    const firstLaunches: string[] = [];
    let recoveredInterruptions=0;
    let firstTenEnd = -Infinity;
    for (const entry of history) {
        if (!schedule.some(slot=>slot.id===entry.slot)) throw new Error('Unscheduled process');
        const start=Date.parse(entry.startedAt),end=Date.parse(entry.finishedAt);
        const recovered=entry.code===null&&entry.interruption?.kind==='process-loss'
            &&typeof entry.interruption.recoveryFile==='string'
            &&/^[a-f0-9]{64}$/.test(entry.interruption.checkpointSha256)
            &&/^[a-f0-9]{64}$/.test(entry.interruption.journalSha256);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end<start || (entry.code!==0&&!recovered)) throw new Error('Incomplete or failed process history');
        if(recovered)recoveredInterruptions++;
        events.push({time:start,delta:1},{time:end,delta:-1});
        if (first.has(entry.slot)) firstTenEnd=Math.max(firstTenEnd,end);
        if (!visited.has(entry.slot)) {firstLaunches.push(entry.slot);visited.add(entry.slot);}
    }
    if (JSON.stringify(firstLaunches)!==JSON.stringify(schedule.slice(0,firstLaunches.length).map(slot=>slot.id))) throw new Error('Process order differs from the declared schedule');
    let active=0,peak=0;
    for(const event of events.sort((a,b)=>a.time-b.time||a.delta-b.delta)){
        active+=event.delta;peak=Math.max(peak,active);
    }
    if(peak>spec.concurrency || peak>4) throw new Error('Concurrent game limit exceeded');
    if(spec.mode==='acceptance') for(const entry of history.filter(entry=>!first.has(entry.slot))){
        if([...first].some(id=>!visited.has(id)) || Date.parse(entry.startedAt)<firstTenEnd) throw new Error('Eleventh game started before first-ten barrier');
    }
    return {valid:true,peakConcurrentGames:peak,attempts:history.length,recoveredInterruptions,firstLaunches,
        firstTenFinishedAt:Number.isFinite(firstTenEnd)?new Date(firstTenEnd).toISOString():null};
}

/** Always use the declared first ten slots, never the first ten finishers. */
export function experimentEarlyStop(schedule: ExperimentSlot[], scores: ExperimentScore[], protocol = LV11_ACCEPTANCE as ReturnType<typeof experimentProtocol>) {
    const first = schedule.slice(0, protocol.earlyStopGames);
    const byId = new Map(scores.map(score => [score.id, score]));
    if (byId.size !== scores.length) throw new Error('Duplicate early-stop result');
    const known = first.filter(slot => byId.has(slot.id));
    const losses = known.filter(slot => {
        const winner = byId.get(slot.id)!.winner;
        if (!['black', 'white', 'draw'].includes(winner)) throw new Error('Invalid early-stop winner');
        return winner !== 'draw' && winner !== slot.candidateColor;
    }).length;
    const ready = first.length === protocol.earlyStopGames && known.length === first.length;
    return { slots: first.map(slot => slot.id), completed: known.length, losses, ready,
        stop: ready && losses >= protocol.earlyStopLosses };
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
    const protocol = experimentProtocol(spec);
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
    const gateSchedule = spec.paired === protocol.paired && spec.blackOnly === protocol.blackOnly && spec.whiteOnly === protocol.whiteOnly
        && conditions.length === protocol.paired + protocol.whiteOnly
        && conditions.filter(condition => condition.kind === 'paired').length === protocol.paired
        && conditions.filter(condition => condition.kind === 'white').length === protocol.whiteOnly
        && schedule.length === protocol.games && black.scheduled === protocol.black && white.scheduled === protocol.white
        && (spec.acceptance !== 'lv12' || (schedule.slice(0,10).filter(slot => slot.candidateColor === 'black').length === 5
            && new Set(schedule.slice(0,10).map(slot => slot.condition)).size === 5))
        && (spec.acceptance !== 'lv13' || schedule.slice(0,10).filter(slot=>slot.candidateColor==='white').length===7);
    const earlyStop = experimentEarlyStop(schedule, scores, protocol);
    return { complete, ...all, black, white, earlyStop,
        meetsWinGate: spec.mode === 'acceptance' && (spec.acceptance === 'lv12' || spec.acceptance === 'lv13' ? spec.concurrency <= 4 : spec.concurrency === protocol.concurrency)
            && gateSchedule && complete && !earlyStop.stop && all.wins >= protocol.minimumWins,
        note: complete ? 'All scheduled games complete' : 'Incomplete experiment; fractions use scheduled slots and are not final evidence' };
}
