import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import assert = require('node:assert/strict');
import { createBattle } from '../game/battle';
import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import { searchLv10, LV10_SEARCH_CONFIG } from '../game/ai/cpu-lv10-search';
import { searchLv11, LV11_SEARCH_CONFIG } from '../game/ai/cpu-lv11-search';
import { searchLv12, LV12_SEARCH_CONFIG } from '../game/ai/cpu-lv12-search';
import { searchLv13, LV13_SEARCH_CONFIG } from '../game/ai/cpu-lv13-search';
import { sampleLv10Position, applyLv10Action, lv10PlacementMoves } from '../game/ai/cpu-lv10-position';
import { extractLv12ValueFeatures, LV12_VALUE_FEATURE_NAMES } from '../game/ai/cpu-lv12-evaluation';
import { LV12_VALUE_WEIGHTS } from '../game/ai/cpu-lv12-model';
import Profiles = require('../shared/cpu-opponent-profiles');
import Startup = require('../shared/cpu-opponent-startup-options');
import Board = require('../shared/shared-board-utils');
import Othello = require('../game/ai/othello-onnx-runtime');
import Policy = require('../game/ai/policy-onnx-runtime');
const CorePolicy = require('../game/ai/cpu-policy-core');
const Prng = require('../game/schema/prng');
const sha256 = (value: Buffer | string) => crypto.createHash('sha256').update(value).digest('hex');

export function cpuBenchmarkCases(root = process.cwd()) {
    const battle = createBattle({ version: 1, battleId: 'godot-cpu-opening', seed: 319,
        players: { black: { controller: 'human', deckCardIds: [] }, white: { controller: 'human', deckCardIds: [] } } });
    battle.startTurn();
    const opening = observeLv10Position(battle.snapshot(), 'black'); battle.dispose();
    return [{ id: 'opening', observation: opening }, ...[
        'cpu-lv11-sparse-endgame', 'cpu-lv12-free-placement'
    ].map(id => ({ id, ...JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures', id + '.json'), 'utf8')) }))];
}

export function runCpuSearchBenchmarks(root = process.cwd(), timed = false, transitions = 128) {
    if (!Number.isInteger(transitions) || transitions < 1 || transitions > 4096) throw new Error('transitions must be 1..4096');
    const records: any[] = [];
    for (const fixture of cpuBenchmarkCases(root)) {
        const before = JSON.stringify(fixture.observation);
        for (const [level, search, config] of [[10, searchLv10, LV10_SEARCH_CONFIG], [11, searchLv11, LV11_SEARCH_CONFIG], [12, searchLv12, LV12_SEARCH_CONFIG], [13, searchLv13, LV13_SEARCH_CONFIG]] as const) {
            const options = { maxTransitions: transitions, publicRecipes: fixture.publicRecipes,
                ...(timed ? { now: () => performance.now(), maxMs: 100 } : {}) };
            const started = performance.now(), result = search(fixture.observation, options);
            const wallMs = performance.now() - started;
            if (!timed) assert.deepEqual(search(fixture.observation, options), result, `${fixture.id} Lv${level} changed with fixed work`);
            assert.equal(JSON.stringify(fixture.observation), before, 'CPU mutated public input');
            const sampled = sampleLv10Position(fixture.observation, config.scenarioSeeds[0], fixture.publicRecipes);
            if (result.action) assert.equal(applyLv10Action(sampled, result.action).ok, true, 'CPU selected illegal action');
            assert.ok(result.transitions <= Math.min(transitions, config.maxTransitions));
            records.push({ id: fixture.id, level, observation: fixture.observation, publicRecipes: fixture.publicRecipes || null,
                config, limit: { transitions, milliseconds: timed ? 100 : null }, result, ...(timed ? { wallMs } : {}),
                lv12Features: extractLv12ValueFeatures(sampled, fixture.observation.player) });
        }
    }
    // This is the common cheap selector seam, not a claim to run each profile's whole browser turn.
    const opening = cpuBenchmarkCases(root)[0].observation;
    const position = sampleLv10Position(opening, 100901), moves = lv10PlacementMoves(position, 'black');
    const board = Board.createBoardContext(position.gameState, position.cardState);
    const cheapSelectors = [1, 2, 3, 4, 5, 6].map(level => {
        const rng = Prng.createPRNG(914001);
        const selected = CorePolicy.chooseMove(moves, level, rng, null, { board, playerValue: 1, level, enableHeuristic: true });
        assert.ok(moves.some((m: any) => m.row === selected?.row && m.col === selected?.col));
        return { level, rngSeed: 914001, rngAfter: rng.getState(), selected };
    });
    return { schema: 'godot-cpu-search.v1', mode: timed ? 'wall-clock' : 'fixed-transitions', records, cheapSelectors,
        profiles: Profiles.getCpuOpponentProfiles().map(profile => ({ ...profile,
            blackStartup: { ...Startup.getCpuOpponentStartupOptions(profile.id, 'black') }, whiteStartup: { ...Startup.getCpuOpponentStartupOptions(profile.id, 'white') } })),
        lv12Model: { featureNames: LV12_VALUE_FEATURE_NAMES, weights: LV12_VALUE_WEIGHTS } };
}

/** Execute the shipped feature encoders and output selection against real, pinned WASM models. */
export async function runCpuModelBenchmarks(root = process.cwd()) {
    const ort = require('onnxruntime-web'); ort.env.wasm.numThreads = 1;
    const observation = cpuBenchmarkCases(root)[0].observation;
    const position = sampleLv10Position(observation, 100901);
    const moves = lv10PlacementMoves(position, 'black');
    const context = { board: position.gameState.board, playerKey: 'black', level: 6, legalMovesCount: moves.length,
        ownCharge: position.cardState.charge.black, oppCharge: position.cardState.charge.white,
        handCardIds: position.cardState.hands.black, usableCardIds: [], ownDeckCount: 0, initialDeckSize: 0 };
    const records: any[] = [];
    for (const [id, runtime, model] of [['othello', Othello, 'data/models/othello/policy-value.onnx'], ['card-policy', Policy, 'data/models/policy-net.onnx']] as const) {
        const modelFile = path.join(root, model), metaFile = modelFile + '.meta.json';
        if (!fs.existsSync(modelFile) || !fs.existsSync(metaFile)) throw new Error(`MODEL_MISSING: ${model}; inference was not performed`);
        const bytes = fs.readFileSync(modelFile), metaBytes = fs.readFileSync(metaFile), meta = JSON.parse(metaBytes.toString());
        const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
        const runs: any[] = [];
        const executor = {
            createSession: async () => ({ sessionKey: id, inputNames: session.inputNames, outputNames: session.outputNames, meta }),
            runSession: async (options: any) => {
                const outputs = await session.run({ [options.inputName]: new ort.Tensor('float32', options.data, options.dims) });
                runs.push({ inputName: options.inputName, dims: options.dims, input: Array.from(options.data),
                    outputs: Object.fromEntries(Object.entries(outputs).map(([key, value]: [string, any]) => [key, { dims: value.dims, type: value.type, data: Array.from(value.data) }])) });
                return outputs;
            }, releaseSession: async () => true
        };
        runtime.clearModel();
        runtime.configure({ enabled: true, minLevel: 6, inferenceExecutor: executor, enableWebGpuExecution: false });
        try {
            assert.equal(await runtime.loadFromUrl(model, model + '.meta.json', undefined), true, 'Model initialization failed');
            const selected = await runtime.chooseMove(moves, context);
            assert.ok(selected, 'Model silently fell back'); assert.ok(runs.length > 0, 'No inference performed');
            assert.ok(moves.some((m: any) => m.row === selected.row && m.col === selected.col));
            for (const run of runs) for (const output of Object.values(run.outputs) as any[]) assert.ok(output.data.every(Number.isFinite));
            records.push({ id, model, modelSha256: sha256(bytes), metaSha256: sha256(metaBytes), meta,
                context, candidates: moves, selected, inference: 'success', runs });
        } finally { runtime.clearModel(); runtime.configure({ inferenceExecutor: null }); await session.release(); }
    }
    return { schema: 'godot-cpu-models.v1', provider: 'wasm', threads: 1, records };
}

export function compareCpuData(expected: any, actual: any, tolerance = 0): string[] {
    const differences: string[] = [];
    const visit = (a: any, b: any, pointer: string) => {
        if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
            if (Math.abs(a - b) > tolerance * Math.max(1, Math.abs(a))) differences.push(pointer); return;
        }
        if (a === b) return;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) { differences.push(pointer); return; }
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys) {
            const p = pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
            if (!Object.prototype.hasOwnProperty.call(a, key) || !Object.prototype.hasOwnProperty.call(b, key)) differences.push(p);
            else visit(a[key], b[key], p);
        }
        if (Array.isArray(a) && a.length !== b.length) differences.push(pointer + '/length');
    };
    visit(expected, actual, ''); return differences;
}

/** Only floating point tensor outputs may vary across ONNX providers; decisions, inputs and model identities are exact. */
export function compareCpuModelData(expected: any, actual: any): string[] {
    const resolve = (value: any, pointer: string) => pointer.split('/').slice(1).reduce((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], value);
    return compareCpuData(expected, actual).filter(pointer => {
        if (!/^\/records\/\d+\/runs\/\d+\/outputs\/[^/]+\/data\/\d+$/.test(pointer)) return true;
        const a = resolve(expected, pointer), b = resolve(actual, pointer);
        return typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)
            || Math.abs(a - b) > 1e-5 * Math.max(1, Math.abs(a));
    });
}

async function main() {
    const [command = 'check', file] = process.argv.slice(2);
    const golden = path.resolve('test/fixtures/godot-cpu-search.json');
    if (command === 'compare' || command === 'compare-models') {
        if (!file) throw new Error('compare requires an actual JSON file');
        const reference = command === 'compare' ? golden : path.resolve('test/fixtures/godot-cpu-models.json');
        const compare = command === 'compare' ? compareCpuData : compareCpuModelData;
        const differences = compare(JSON.parse(fs.readFileSync(reference, 'utf8')), JSON.parse(fs.readFileSync(file, 'utf8')));
        if (differences.length) throw new Error(differences.slice(0, 30).join('\n')); console.log('CPU fixed-work comparison passed'); return;
    }
    if (!['check', 'generate', 'timed', 'models'].includes(command)) throw new Error('Expected check|generate|timed|models|compare|compare-models');
    const report = command === 'models' ? await runCpuModelBenchmarks() : runCpuSearchBenchmarks(process.cwd(), command === 'timed');
    if (command === 'check') {
        assert.deepEqual(report, JSON.parse(fs.readFileSync(golden, 'utf8'))); console.log('CPU fixed-work golden and repeatability passed');
    } else {
        if (!file) throw new Error('Explicit new output JSON path required');
        fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
        console.log(`CPU ${command}: ${file}`);
    }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
