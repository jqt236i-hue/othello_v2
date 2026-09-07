import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
// Match browser DI so event sequence metadata also participates in exact replay.
require('../game/logic/presentation').setPresentationRuntime({
    emitPresentationEvent: require('../game/logic/board_ops').emitPresentationEvent
});
const Engine = require('./cpu-counterfactual-engine');
const Pipeline = require('../game/turn/turn_pipeline');
const Prng = require('../game/schema/prng');
const Othello = require('../game/ai/othello-onnx-runtime');

export function partitionPositions(records: any[], shards: number, shard: number) {
    if (!Number.isSafeInteger(shards) || shards < 1 || shards > 4 || !Number.isSafeInteger(shard) || shard < 0 || shard >= shards)
        throw new Error('Invalid shard limits');
    return [...records.entries()].filter(([id]) => id % shards === shard);
}

async function main() {
    const argv = process.argv.slice(2);
    const get = (key: string, fallback = '') => argv.includes(key) ? argv[argv.indexOf(key) + 1] : fallback;
    const input = get('--input'), output = get('--out');
    const count = Number(get('--positions', '100'));
    const shards = Number(get('--shards', '1')), shard = Number(get('--shard', '0'));
    const onlyIds = get('--only-ids') ? get('--only-ids').split(',').map(Number) : null;
    if (onlyIds && (new Set(onlyIds).size !== onlyIds.length || onlyIds.some(id => !Number.isSafeInteger(id) || id < 0 || id >= count)))
        throw new Error('Invalid position IDs');
    partitionPositions([], shards, shard);
    if (!input || !output || !Number.isSafeInteger(count) || count < 1 || count > 100) throw new Error('Specify input, fresh output, and 1–100 positions');
    if (fs.existsSync(output)) throw new Error('Refusing to overwrite audit report');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const captures = fs.readdirSync(input).filter(name => /^capture-\d+\.json$/.test(name)).sort()
        .map(name => ({ path: path.join(input, name), data: JSON.parse(fs.readFileSync(path.join(input, name), 'utf8')) }));
    if (!captures.length) throw new Error('No captures');
    const manifest = captures[0].data.baselineFiles;
    const unchanged = () => manifest.every((file: any) => createHash('sha256').update(fs.readFileSync(file.source)).digest('hex') === file.sha256);
    if (!unchanged()) throw new Error('Baseline model changed');
    const report: any = { schema: 'cpu_improvement_audit.v1', startedAt: new Date().toISOString(), promotionAllowed: false,
        sourceCode: ['scripts/cpu-counterfactual-engine.ts', 'scripts/run-cpu-improvement-audit.ts', 'game/logic/cards-runtime-factory.ts']
            .map(file => ({ path: file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') })),
        method: 'full-rule paired rollouts with current Othello model and shared card/target policy; not a complete browser CPU strength test',
        limitations: ['Two discovery scenarios and two independent confirmation scenarios per selected candidate.',
            'Hidden cards sampled from the public Lv6 recipe; discard-owner history and deck-cost history are not reconstructed.',
            'Continuation uses current Othello placement plus shared card/target policy, not the complete browser CPU. No estimated result proves strength.',
            'Only four root actions survive immediate-effect pruning; this is not exhaustive search.'],
        source: captures.map(item => ({ path: item.path, sha256: createHash('sha256').update(fs.readFileSync(item.path)).digest('hex') })),
        baselineFiles: manifest, replay: { transitions: 0, browserDecisionMatches: 0, nativeTransitions: 0, nativeMismatches: [] },
        modelReplay: { total: 0, matched: 0, mismatches: [] }, positions: [] };
    const records: any[] = [];
    for (const capture of captures) {
        if (!capture.data.valid || !capture.data.baselineUnchanged) throw new Error('Capture invalid');
        for (const [index, record] of capture.data.audit.records.entries()) {
            if (!record.replayMatched || record.liveStateUnchanged !== true) throw new Error('Browser transition replay failed');
            report.replay.transitions++;
            const rng = Prng.fromState(record.before.prngState);
            const replay = Pipeline.applyTurnSafe(Engine.clone(record.before.cardState), Engine.clone(record.before.gameState),
                record.player, Engine.clone(record.action), rng, Engine.clone(record.options));
            const actual = Engine.clone({ gameState: replay.gameState, cardState: replay.cardState, prngState: rng.getState(),
                ok: replay.ok, rejectedReason: replay.rejectedReason });
            if (Engine.canonical(actual) === Engine.canonical(record.after)) report.replay.nativeTransitions++;
            else report.replay.nativeMismatches.push({ seed: capture.data.seed, index });
            if (record.after.ok && ['place', 'use_card', 'pass'].includes(record.action.type))
                records.push({ ...record, sourceSeed: capture.data.seed, sourceIndex: index, sourceWinner: capture.data.result.winner });
        }
        for (const decision of capture.data.audit.decisions) {
            if (!decision.replayMatched || !decision.stateUnchanged) throw new Error('Browser decision replay failed');
            report.replay.browserDecisionMatches++;
        }
    }
    const ort = require('onnxruntime-web');
    ort.env.wasm.numThreads = 1;
    Othello.configure({ ...captures[0].data.runtimeStatus.othello, ortApi: ort });
    if (!await Othello.loadFromUrl(path.resolve('data/models/othello/policy-value.onnx'), path.resolve('data/models/othello/policy-value.onnx.meta.json'),
        async (url: string) => { const bytes = fs.readFileSync(url); return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), json: async () => JSON.parse(bytes.toString()) }; }))
        throw new Error('Current placement model failed to load');
    for (const capture of captures) for (const [index, decision] of capture.data.audit.decisions.entries()) {
        if (!decision.inputs) continue;
        const actual = await Othello.chooseMove(...Engine.clone(decision.inputs));
        report.modelReplay.total++;
        if (actual?.row === decision.selected?.row && actual?.col === decision.selected?.col) report.modelReplay.matched++;
        else report.modelReplay.mismatches.push({ seed: capture.data.seed, index, expected: decision.selected, actual });
    }
    // Fail closed before counterfactual search if either implementation fails parity.
    if (report.replay.nativeMismatches.length || report.modelReplay.mismatches.length) {
        report.stopReason = 'replay_mismatch';
        fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' });
        throw new Error('Parity failed; counterfactual search not run');
    }
    const budget = { steps: 0, maxSteps: Math.floor(240000 / shards), deadline: Date.now() + 600000 };
    report.limits = { maxPositions: count, maxSteps: budget.maxSteps, maxWallMs: 600000, maxActionsPerRollout: 160, maxRootActions: 4 };
    // Round-robin by game, decision kind and color; quantiles retain early and late play.
    const buckets = new Map<string, any[]>();
    for (const record of records) {
        const kind = record.before.cardState.pendingEffectByPlayer[record.player]?.stage === 'selectTarget' ? 'target' : record.action.type;
        const key = `${record.sourceSeed}:${record.player}:${kind}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(record);
    }
    const queues = [...buckets.values()].map(items => {
        const order: any[] = [];
        // Alternating ends avoids spending the whole budget on opening positions.
        while (items.length) { order.push(items.pop()); if (items.length) order.push(items.shift()); }
        return order;
    });
    const selected: any[] = [];
    while (selected.length < count && queues.some(queue => queue.length)) for (const queue of queues) {
        if (queue.length && selected.length < count) selected.push(queue.shift());
    }
    const partition = partitionPositions(selected, shards, shard).filter(([id]) => !onlyIds || onlyIds.includes(id));
    report.onlyIds = onlyIds;
    report.shard = { index: shard, count: shards, totalPositions: count, positions: partition.length };
    for (const [id, record] of partition) {
        try {
            const result = await Engine.auditPosition(record, id, budget);
            report.positions.push({ ...result, sourceSeed: record.sourceSeed, sourceIndex: record.sourceIndex, sourceWinner: record.sourceWinner });
        } catch (error: any) { report.stopReason = error.message; break; }
        console.log(`[audit] shard=${shard} ${report.positions.length}/${partition.length} steps=${budget.steps} promising=${report.positions.filter((item: any) => item.promisingInIndependentScenarios).length}`);
        fs.writeFileSync(output + '.progress.json', JSON.stringify({ completed: report.positions.length, requested: partition.length, steps: budget.steps }));
        fs.writeFileSync(output + '.partial.json', JSON.stringify({ ...report, steps: budget.steps }));
    }
    report.finishedAt = new Date().toISOString();
    report.steps = budget.steps;
    report.baselineUnchanged = unchanged();
    report.complete = selected.length === count && report.positions.length === partition.length && report.baselineUnchanged;
    const trials = report.positions.flatMap((item: any) => [...item.trials.flat(), ...item.confirmation.flat()]);
    report.summary = { positions: report.positions.length, candidates: report.positions.reduce((sum: number, item: any) => sum + item.actions.length, 0),
        terminalRollouts: trials.filter((item: any) => item.terminal).length, incompleteRollouts: trials.filter((item: any) => !item.terminal).length,
        promisingInIndependentScenarios: report.positions.filter((item: any) => item.promisingInIndependentScenarios).length,
        improvementProvenAgainstCurrentCpu: false, trainingStarted: false, promotionAllowed: false };
    fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(report.summary));
    if (!report.complete) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
