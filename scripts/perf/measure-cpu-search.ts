#!/usr/bin/env node
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

/** Node-only Lv10/11/12 search timing with an outcome identity digest.
 * A root is any directory holding a built `dist/`; the search modules are
 * loaded from there so a frozen baseline copy and the working tree can be
 * compared under the same fixtures, seeds and clocks. */

export const CPU_SEARCH_REPORT_SCHEMA = 'cpu-search-benchmark.v1';
export const CPU_SEARCH_LEVELS = Object.freeze([10, 11, 12] as const);
export const CPU_SEARCH_OBSERVATION_FIXTURES = Object.freeze([
    'cpu-lv11-capture-risk',
    'cpu-lv11-sparse-endgame',
    'cpu-lv12-budget-slice',
    'cpu-lv12-chance-continuation',
    'cpu-lv12-free-placement',
    'cpu-lv12-opening-card-unlock',
    'cpu-lv12-opening-reuse',
    'cpu-lv12-sparse-card-threat'
]);
export const CPU_SEARCH_PRODUCTION_POSITIONS = Object.freeze([
    { id: 'production-914081-turn8', seed: 914081, player: 'black', turnNumber: 8, hand: ['udr_01', 'perma_01'] }
]);

type Clock = 'node' | 'production';
type Fixture = { id: string; observation: any; publicRecipes?: any; excludedActions?: any[] };

export function stableJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
    if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
    const entries = Object.keys(value as Record<string, unknown>).sort()
        .filter((key) => (value as any)[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${stableJson((value as any)[key])}`);
    return `{${entries.join(',')}}`;
}

export const sha256 = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');

/** Everything the search returns except wall-clock time. */
export function searchOutcomeDigest(result: any): string {
    const { elapsedMs: _elapsed, ...outcome } = result || {};
    return sha256(stableJson(outcome));
}

function median(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function p95(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)];
}

export function loadCpuSearchFixtures(repoRoot: string, distRoot: string): Fixture[] {
    const fixtures: Fixture[] = CPU_SEARCH_OBSERVATION_FIXTURES.map((id) => {
        const data = JSON.parse(fs.readFileSync(path.join(repoRoot, 'test/fixtures', `${id}.json`), 'utf8'));
        return { id, observation: data.observation, publicRecipes: data.publicRecipes, excludedActions: data.excludedActions || undefined };
    });
    const { createProductionPosition } = require(path.join(distRoot, 'src/engine/production-match'));
    const { observeLv10Position } = require(path.join(distRoot, 'game/ai/cpu-lv10-observation'));
    for (const spec of CPU_SEARCH_PRODUCTION_POSITIONS) {
        const state = createProductionPosition(spec.seed, { black: 10, white: 10 });
        state.gameState.turnNumber = spec.turnNumber;
        state.cardState.hands[spec.player] = spec.hand.slice();
        fixtures.push({ id: spec.id, observation: observeLv10Position(state, spec.player) });
    }
    return fixtures;
}

export function fixtureDigest(fixtures: Fixture[]): string {
    return sha256(stableJson(fixtures.map((fixture) => ({
        id: fixture.id, observation: fixture.observation, publicRecipes: fixture.publicRecipes || null,
        excludedActions: fixture.excludedActions || null
    }))));
}

function loadSearch(distRoot: string, level: number) {
    const module = require(path.join(distRoot, `game/ai/cpu-lv${level}-search`));
    const search = module[`searchLv${level}`];
    if (typeof search !== 'function') throw new Error(`searchLv${level} unavailable in ${distRoot}`);
    return search as (observation: any, options: any) => any;
}

export function measureCpuSearch(options: {
    root: string; repoRoot?: string; runs?: number; warmup?: number;
    clocks?: Clock[]; levels?: number[]; fixtureIds?: string[];
}) {
    const root = path.resolve(options.root), repoRoot = path.resolve(options.repoRoot || process.cwd());
    const distRoot = path.join(root, 'dist');
    const runs = options.runs ?? 5, warmup = options.warmup ?? 1;
    const clocks = options.clocks || ['node', 'production'];
    const levels = options.levels || CPU_SEARCH_LEVELS.slice();
    const allFixtures = loadCpuSearchFixtures(repoRoot, distRoot);
    const fixtures = options.fixtureIds ? allFixtures.filter((fixture) => options.fixtureIds!.includes(fixture.id)) : allFixtures;
    const moduleHashes = Object.fromEntries(levels.flatMap((level) => ['search', 'evaluation'].map((kind) => {
        const file = path.join(distRoot, `game/ai/cpu-lv${level}-${kind}.js`);
        return [`cpu-lv${level}-${kind}.js`, fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null];
    })));
    const rows: any[] = [];
    for (const clock of clocks) for (const level of levels) {
        const search = loadSearch(distRoot, level);
        for (const fixture of fixtures) {
            const digests = new Set<string>(), elapsed: number[] = [];
            let sample: any = null, mutated = false;
            for (let iteration = 0; iteration < warmup + runs; iteration++) {
                const observation = JSON.parse(JSON.stringify(fixture.observation));
                const before = JSON.stringify(observation);
                const searchOptions: any = {
                    ...(fixture.publicRecipes ? { publicRecipes: fixture.publicRecipes } : {}),
                    ...(fixture.excludedActions ? { excludedActions: fixture.excludedActions } : {}),
                    ...(clock === 'production' ? { now: () => performance.now() } : {})
                };
                const started = performance.now();
                const result = search(observation, searchOptions);
                const wallMs = performance.now() - started;
                if (JSON.stringify(observation) !== before) mutated = true;
                if (iteration < warmup) continue;
                elapsed.push(wallMs);
                digests.add(searchOutcomeDigest(result));
                sample = result;
            }
            rows.push({
                clock, level, fixture: fixture.id,
                outcomeDigest: digests.size === 1 ? [...digests][0] : null,
                deterministic: digests.size === 1, mutatedInput: mutated,
                stopped: sample?.stopped ?? null, transitions: sample?.transitions ?? null, value: sample?.value ?? null,
                evaluationCalls: sample?.evaluationCalls ?? null, evaluatedCandidates: sample?.evaluatedCandidates ?? null,
                actionKey: sample?.action ? stableJson(sample.action) : null,
                wallMs: { median: median(elapsed), p95: p95(elapsed), min: Math.min(...elapsed), samples: elapsed }
            });
        }
    }
    return {
        schema: CPU_SEARCH_REPORT_SCHEMA, root, node: process.version, platform: `${process.platform}-${process.arch}`,
        runs, warmup, clocks, levels, fixtureDigest: fixtureDigest(fixtures), fixtureIds: fixtures.map((fixture) => fixture.id),
        moduleHashes, generatedAt: new Date().toISOString(), rows
    };
}

/** Pairs rows by clock/level/fixture. Identity is required before timing counts. */
export function compareCpuSearchReports(baseline: any, candidate: any) {
    if (baseline.fixtureDigest !== candidate.fixtureDigest) throw new Error('Fixture digest differs');
    const key = (row: any) => `${row.clock}/${row.level}/${row.fixture}`;
    const byKey = new Map(baseline.rows.map((row: any) => [key(row), row]));
    const pairs = candidate.rows.map((row: any) => {
        const base: any = byKey.get(key(row));
        if (!base) throw new Error(`Missing baseline row ${key(row)}`);
        const identical = !!base.outcomeDigest && base.outcomeDigest === row.outcomeDigest && !row.mutatedInput && !base.mutatedInput;
        return {
            key: key(row), identical, stopped: [base.stopped, row.stopped],
            baselineMedianMs: base.wallMs.median, candidateMedianMs: row.wallMs.median,
            ratio: row.wallMs.median / base.wallMs.median
        };
    });
    const summarize = (filter: (pair: any) => boolean) => {
        const selected = pairs.filter(filter);
        const base = selected.reduce((sum: number, pair: any) => sum + pair.baselineMedianMs, 0);
        const cand = selected.reduce((sum: number, pair: any) => sum + pair.candidateMedianMs, 0);
        return { rows: selected.length, baselineMs: base, candidateMs: cand, change: base ? cand / base - 1 : null };
    };
    const levels = [...new Set(candidate.rows.map((row: any) => `${row.clock}/${row.level}`))] as string[];
    return {
        schema: 'cpu-search-comparison.v1', fixtureDigest: candidate.fixtureDigest,
        allIdentical: pairs.every((pair: any) => pair.identical),
        byLevel: Object.fromEntries(levels.map((prefix) => [prefix, summarize((pair: any) => pair.key.startsWith(prefix + '/'))])),
        pairs
    };
}

function parseArgs(argv: string[]) {
    const args: any = { root: process.cwd() };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i], next = () => argv[++i];
        if (arg === '--root') args.root = next();
        else if (arg === '--runs') args.runs = Number(next());
        else if (arg === '--warmup') args.warmup = Number(next());
        else if (arg === '--clock') args.clocks = next().split(',');
        else if (arg === '--levels') args.levels = next().split(',').map(Number);
        else if (arg === '--fixtures') args.fixtureIds = next().split(',');
        else if (arg === '--output') args.output = next();
        else if (arg === '--compare') { args.compare = [next(), next()]; }
        else throw new Error(`Unknown argument ${arg}`);
    }
    return args;
}

if (require.main === module) {
    try {
        const args = parseArgs(process.argv.slice(2));
        const report = args.compare
            ? compareCpuSearchReports(...(args.compare.map((file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))) as [any, any]))
            : measureCpuSearch(args);
        const text = JSON.stringify(report, null, 2);
        if (args.output) {
            fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
            fs.writeFileSync(args.output, text);
        }
        const brief = args.compare ? { allIdentical: (report as any).allIdentical, byLevel: (report as any).byLevel }
            : { fixtureDigest: (report as any).fixtureDigest, rows: (report as any).rows.map((row: any) =>
                `${row.clock} lv${row.level} ${row.fixture} ${row.stopped} t=${row.transitions} med=${row.wallMs.median.toFixed(1)}ms det=${row.deterministic}`) };
        console.log(JSON.stringify(brief, null, 2));
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
}
