import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { performance } from 'perf_hooks';
import { chromium, type Browser } from 'playwright';

import {
    createDesktopChromiumLaunchOptions,
    readDesktopGraphicsEnvironment,
    type DesktopGraphicsEnvironment
} from '../browser-performance-environment';

/**
 * Captures the bounded Lv6 tactical-safety work introduced by the lightweight
 * optimization plan. The Node lane compiles two in-memory variants of the
 * same built source, so its alternating measurements never make a production
 * choice. The browser lane deliberately invokes the bundled public function
 * through the Vite/Pixi runtime and records no board or hand data.
 */
export const REPORT_SCHEMA_VERSION = 'cpu_tactical_safety_context_measurement.v2';

const DEFAULT_WARMUP_ITERATIONS = 3;
const DEFAULT_CAPTURE_ITERATIONS = 15;
const TACTICAL_SAFETY_FIXTURE_SEED = 1;

type PlayerKey = 'black' | 'white';
type SafetyModule = {
    MAX_SAFETY_STEPS: number;
    tacticalPositionFeatures: (gameState: any, cardState: any, playerKey: PlayerKey) => any;
    avoidTacticalBlunder: (input: any) => any;
    shouldHoldTacticallyUnsafeCard: (input: any) => any;
};
type RuntimeModules = Readonly<{
    Cards: any;
    Core: any;
    Prng: any;
    Presentation: any;
    BoardOps: any;
}>;
type CounterSample = Readonly<{
    jsonStringifyCalls: number;
    sourceSignatureBuildCalls: number;
}>;
type CaseResult = Readonly<{
    id: string;
    durationMs: number;
    inputUnchanged: boolean;
    randomUnchanged: boolean;
    outcomeDigest: string;
    counters: CounterSample;
}>;
type BenchmarkCase = Readonly<{
    id: string;
    operation: 'avoidTacticalBlunder' | 'shouldHoldTacticallyUnsafeCard';
    createInput: (runtime: RuntimeModules) => any;
    invoke: (safety: SafetyModule, input: any) => any;
}>;
type NumericSummary = Readonly<{
    count: number;
    min: number | null;
    max: number | null;
    average: number | null;
    median: number | null;
    p95: number | null;
}>;
type BrowserRuntimeEvidence = Readonly<{
    lane: string | null;
    bootState: string | null;
    pixiBackendMounted: boolean;
    tacticalSafetyExportPresent: boolean;
}>;

const placementBoard = [
    [0, -1, 0, 0, 0, 0, -1, -1],
    [0, 0, -1, -1, -1, -1, -1, 1],
    [1, 1, 1, -1, -1, -1, 1, 1],
    [1, 1, 0, -1, -1, 1, 0, 1],
    [0, 1, 1, -1, -1, 1, 1, 0],
    [0, 0, 1, 1, -1, -1, 1, 0],
    [-1, -1, -1, 1, 1, 1, 1, 1],
    [0, 0, 0, 1, 1, 1, 1, 1]
];
const cardBoard = [
    [1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, -1, -1, 1, -1],
    [-1, 1, 1, 1, -1, -1, 1, -1],
    [-1, -1, -1, -1, 1, 1, 1, -1],
    [-1, -1, -1, 1, 1, 1, 1, -1],
    [-1, -1, 1, -1, -1, 1, 1, -1],
    [-1, -1, -1, -1, -1, 1, -1, -1],
    [1, -1, -1, -1, -1, -1, -1, -1]
];
const replyTrapBoard = [
    [1, 1, 1, 1, 1, 1, 0, -1],
    [1, 1, 1, -1, 1, 1, -1, -1],
    [0, 1, 1, -1, -1, -1, -1, -1],
    [1, 1, 1, 1, -1, -1, -1, -1],
    [1, 1, -1, -1, 1, 1, -1, -1],
    [1, 1, -1, -1, 1, -1, -1, -1],
    [1, 1, 1, 1, 1, 1, -1, -1],
    [0, -1, 1, 1, 1, 1, 1, -1]
];

function round(value: number | null): number | null {
    return value === null ? null : Math.round(value * 1000) / 1000;
}

function summarize(values: readonly number[]): NumericSummary {
    const sorted = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
    if (!sorted.length) {
        return Object.freeze({ count: 0, min: null, max: null, average: null, median: null, p95: null });
    }
    const percentile = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
    return Object.freeze({
        count: sorted.length,
        min: round(sorted[0]),
        max: round(sorted[sorted.length - 1]),
        average: round(sorted.reduce((total, value) => total + value, 0) / sorted.length),
        median: round(percentile(0.5)),
        p95: round(percentile(0.95))
    });
}

function sha256(value: string | Buffer): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalFixtureValue(value: any): any {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number') {
        if (Number.isFinite(value)) return value;
        return { $number: String(value) };
    }
    if (Array.isArray(value)) return value.map(canonicalFixtureValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value).sort().flatMap((key) => value[key] === undefined ? [] : [[key, canonicalFixtureValue(value[key])]])
        );
    }
    throw new Error(`fixture contains a non-serializable ${typeof value}`);
}

export function stableFixtureJson(value: unknown): string {
    return JSON.stringify(canonicalFixtureValue(value));
}

export function buildTacticalSafetyFixtureManifest(cases: readonly Readonly<{
    id: string;
    operation: string;
    randomSeed: number;
    input: unknown;
}>[]): Readonly<Record<string, unknown>> {
    return Object.freeze({
        schemaVersion: 'tactical-safety-fixture.v2',
        cases: cases.map((fixture) => Object.freeze({
            id: fixture.id,
            operation: fixture.operation,
            randomSeed: fixture.randomSeed,
            input: fixture.input
        }))
    });
}

export function digestTacticalSafetyFixtureManifest(manifest: unknown): string {
    return sha256(stableFixtureJson(manifest));
}

function sourceCommit(rootDir: string): string | null {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim() || null;
    } catch (_error) {
        return null;
    }
}

function createRuntimeModules(): RuntimeModules {
    const Cards = require('../../game/logic/cards');
    const Core = require('../../game/logic/core');
    const Prng = require('../../game/schema/prng');
    const Presentation = require('../../game/logic/presentation');
    const BoardOps = require('../../game/logic/board_ops');
    Presentation.setPresentationRuntime({ emitPresentationEvent: BoardOps.emitPresentationEvent });
    return Object.freeze({ Cards, Core, Prng, Presentation, BoardOps });
}

function setupSafety(runtime: RuntimeModules, board: number[][], flip = false) {
    const rng = runtime.Prng.createPRNG(TACTICAL_SAFETY_FIXTURE_SEED);
    const cardState = runtime.Cards.createCardState(rng);
    const gameState = runtime.Core.createGameState();
    gameState.board = board.map((row) => row.map((value) => flip ? -value : value));
    gameState.currentPlayer = flip ? 1 : -1;
    gameState.turnNumber = board === cardBoard ? 59 : 43;
    const playerKey: PlayerKey = flip ? 'black' : 'white';
    cardState.hands = { black: [], white: [] };
    cardState.charge[playerKey] = 99;
    cardState.lastTurnStartedFor = playerKey;
    return { gameState, cardState, playerKey, level: 6, rng };
}

function point(value: any): any {
    if (!value || !Number.isInteger(value.row) || !Number.isInteger(value.col)) return null;
    return value.directionKey ? { row: value.row, col: value.col, directionKey: value.directionKey } : { row: value.row, col: value.col };
}

function normalizedOutcome(result: any): Record<string, unknown> {
    return {
        changed: result?.changed === true,
        hold: result?.hold === true,
        reason: typeof result?.reason === 'string' ? result.reason : null,
        steps: Number.isFinite(result?.steps) ? Number(result.steps) : null,
        selected: point(result?.selected),
        witness: point(result?.witness)
    };
}

function snapshotInputValue(input: any, rng: any): Readonly<Record<string, unknown>> {
    return Object.freeze({
        gameState: input.gameState,
        cardState: input.cardState,
        playerKey: input.playerKey,
        level: input.level,
        selected: point(input.selected),
        candidates: Array.isArray(input.candidates) ? input.candidates.map(point) : null,
        cardId: input.cardId || null,
        pendingType: input.pendingType || null,
        forceUseCard: input.forceUseCard === true,
        randomState: typeof rng?.getState === 'function' ? rng.getState() : null
    });
}

function snapshotInput(input: any, rng: any): string {
    return JSON.stringify(snapshotInputValue(input, rng));
}

function countStringifies<T>(callback: () => T): Readonly<{ value: T; counters: CounterSample }> {
    const original = JSON.stringify;
    let jsonStringifyCalls = 0;
    let sourceSignatureBuildCalls = 0;
    (JSON as any).stringify = (...args: any[]) => {
        jsonStringifyCalls += 1;
        const stack = new Error().stack || '';
        if (stack.includes('buildSourceSignature')) sourceSignatureBuildCalls += 1;
        return (original as any).apply(JSON, args);
    };
    try {
        return Object.freeze({
            value: callback(),
            counters: Object.freeze({ jsonStringifyCalls, sourceSignatureBuildCalls })
        });
    } finally {
        (JSON as any).stringify = original;
    }
}

function createBenchmarkCases(): readonly BenchmarkCase[] {
    const placement = (id: string, flip: boolean): BenchmarkCase => Object.freeze({
        id,
        operation: 'avoidTacticalBlunder',
        createInput: (runtime) => {
            const input: any = setupSafety(runtime, placementBoard, flip);
            input.candidates = runtime.Core.getLegalMoves(input.gameState, input.gameState.currentPlayer);
            input.selected = input.candidates.find((move: any) => move.row === 1 && move.col === 1);
            if (!input.selected) throw new Error(`${id}: selected placement is unavailable`);
            return input;
        },
        invoke: (safety, input) => safety.avoidTacticalBlunder(input)
    });
    const goldHold = (id: string, flip: boolean): BenchmarkCase => Object.freeze({
        id,
        operation: 'shouldHoldTacticallyUnsafeCard',
        createInput: (runtime) => {
            const input: any = setupSafety(runtime, cardBoard, flip);
            input.cardId = 'gold_stone';
            input.cardState.hands[input.playerKey] = [input.cardId];
            return input;
        },
        invoke: (safety, input) => safety.shouldHoldTacticallyUnsafeCard(input)
    });
    const rejectReplyTrap = (id: string, flip: boolean): BenchmarkCase => Object.freeze({
        id,
        operation: 'avoidTacticalBlunder',
        createInput: (runtime) => {
            const input: any = setupSafety(runtime, replyTrapBoard, flip);
            input.candidates = runtime.Core.getLegalMoves(input.gameState, input.gameState.currentPlayer);
            input.selected = input.candidates.find((move: any) => move.row === 0 && move.col === 6);
            if (!input.selected) throw new Error(`${id}: selected reply-trap placement is unavailable`);
            return input;
        },
        invoke: (safety, input) => safety.avoidTacticalBlunder(input)
    });
    return Object.freeze([
        placement('placement-corner-white', false),
        placement('placement-corner-black', true),
        goldHold('gold-hold-white', false),
        goldHold('gold-hold-black', true),
        rejectReplyTrap('reply-trap-white', false),
        rejectReplyTrap('reply-trap-black', true)
    ]);
}

function buildNodeFixtureManifest(cases: readonly BenchmarkCase[], runtime: RuntimeModules): Readonly<Record<string, unknown>> {
    return buildTacticalSafetyFixtureManifest(cases.map((benchmark) => {
        const input = benchmark.createInput(runtime);
        return Object.freeze({
            id: benchmark.id,
            operation: benchmark.operation,
            randomSeed: TACTICAL_SAFETY_FIXTURE_SEED,
            input: JSON.parse(snapshotInput(input, input.rng))
        });
    }));
}

function runCase(benchmark: BenchmarkCase, safety: SafetyModule, runtime: RuntimeModules): CaseResult {
    const input = benchmark.createInput(runtime);
    const before = snapshotInput(input, input.rng);
    const randomBefore = typeof input.rng?.getState === 'function' ? input.rng.getState() : null;
    const startedAt = performance.now();
    const result = benchmark.invoke(safety, input);
    const durationMs = performance.now() - startedAt;
    const after = snapshotInput(input, input.rng);
    const randomAfter = typeof input.rng?.getState === 'function' ? input.rng.getState() : null;
    const countedInput = benchmark.createInput(runtime);
    const countedBefore = snapshotInput(countedInput, countedInput.rng);
    const countedRandomBefore = typeof countedInput.rng?.getState === 'function' ? countedInput.rng.getState() : null;
    const counted = countStringifies(() => benchmark.invoke(safety, countedInput));
    const countedAfter = snapshotInput(countedInput, countedInput.rng);
    const countedRandomAfter = typeof countedInput.rng?.getState === 'function' ? countedInput.rng.getState() : null;
    const outcomeDigest = sha256(JSON.stringify(normalizedOutcome(result)));
    if (outcomeDigest !== sha256(JSON.stringify(normalizedOutcome(counted.value)))) {
        throw new Error(`${benchmark.id}: counting pass changed the tactical-safety result`);
    }
    return Object.freeze({
        id: benchmark.id,
        durationMs,
        inputUnchanged: before === after && countedBefore === countedAfter,
        randomUnchanged: JSON.stringify(randomBefore) === JSON.stringify(randomAfter)
            && JSON.stringify(countedRandomBefore) === JSON.stringify(countedRandomAfter),
        outcomeDigest,
        counters: counted.counters
    });
}

function transformSafetySource(source: string, variant: 'baseline' | 'candidate'): string {
    const baseline = 'const b = Board.createBoardContext(gameState, cardState), sign =';
    const candidate = 'const b = Board.prepareBoardForSearch(Board.createBoardContext(gameState, cardState)), sign =';
    const replacement = variant === 'candidate' ? candidate : baseline;
    if (source.includes(baseline)) return source.replace(baseline, replacement);
    if (source.includes(candidate)) return source.replace(candidate, replacement);
    throw new Error('Could not locate tacticalPositionFeatures BoardContext expression in built source');
}

function loadSafetyVariant(rootDir: string, variant: 'baseline' | 'candidate'): SafetyModule {
    const sourcePath = path.join(rootDir, 'dist', 'game', 'ai', 'cpu-tactical-safety.js');
    const source = transformSafetySource(fs.readFileSync(sourcePath, 'utf8'), variant);
    const NodeModule: any = require('module');
    const filename = path.join(path.dirname(sourcePath), `cpu-tactical-safety.${variant}.measurement.js`);
    const instance = new NodeModule(filename, module);
    instance.filename = filename;
    instance.paths = NodeModule._nodeModulePaths(path.dirname(filename));
    instance._compile(source, filename);
    return instance.exports as SafetyModule;
}

function summarizeCaseResults(results: readonly CaseResult[]): Record<string, unknown> {
    const byCase = new Map<string, CaseResult[]>();
    for (const result of results) {
        const entries = byCase.get(result.id) || [];
        entries.push(result);
        byCase.set(result.id, entries);
    }
    return Object.fromEntries(Array.from(byCase.entries()).map(([id, entries]) => [id, Object.freeze({
        durationMs: summarize(entries.map((entry) => entry.durationMs)),
        jsonStringifyCalls: summarize(entries.map((entry) => entry.counters.jsonStringifyCalls)),
        sourceSignatureBuildCalls: summarize(entries.map((entry) => entry.counters.sourceSignatureBuildCalls)),
        inputUnchanged: entries.every((entry) => entry.inputUnchanged),
        randomUnchanged: entries.every((entry) => entry.randomUnchanged),
        outcomeDigests: Array.from(new Set(entries.map((entry) => entry.outcomeDigest))).sort()
    })]));
}

function percentageImprovement(before: NumericSummary, after: NumericSummary): number | null {
    if (!Number.isFinite(before.median) || !Number.isFinite(after.median) || Number(before.median) <= 0) return null;
    return round((Number(before.median) - Number(after.median)) / Number(before.median) * 100);
}

function writeReport(outputPath: string, report: unknown): void {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function detectLiveVariant(source: string): 'baseline' | 'candidate' | 'unknown' {
    if (source.includes('Board.prepareBoardForSearch(Board.createBoardContext(gameState, cardState))')) return 'candidate';
    if (source.includes('Board.createBoardContext(gameState, cardState)')) return 'baseline';
    return 'unknown';
}

function runNodeMeasurement(rootDir: string, warmupIterations: number, captureIterations: number): Record<string, unknown> {
    const runtime = createRuntimeModules();
    const cases = createBenchmarkCases();
    const fixtureManifest = buildNodeFixtureManifest(cases, runtime);
    const variants = Object.freeze({
        baseline: loadSafetyVariant(rootDir, 'baseline'),
        candidate: loadSafetyVariant(rootDir, 'candidate')
    });
    const samples: Record<'baseline' | 'candidate', CaseResult[]> = { baseline: [], candidate: [] };
    const orders: string[][] = [];
    const runRound = (variant: 'baseline' | 'candidate', capture: boolean) => {
        for (const benchmark of cases) {
            const result = runCase(benchmark, variants[variant], runtime);
            if (capture) samples[variant].push(result);
        }
    };
    for (let index = 0; index < warmupIterations + captureIterations; index += 1) {
        const order: Array<'baseline' | 'candidate'> = index % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline'];
        orders.push(order.slice());
        const capture = index >= warmupIterations;
        for (const variant of order) runRound(variant, capture);
    }
    const summaries = Object.freeze({
        baseline: summarizeCaseResults(samples.baseline),
        candidate: summarizeCaseResults(samples.candidate)
    }) as Record<'baseline' | 'candidate', Record<string, any>>;
    const equivalence = cases.map((benchmark) => {
        const baseline = summaries.baseline[benchmark.id];
        const candidate = summaries.candidate[benchmark.id];
        const outcomesMatch = JSON.stringify(baseline.outcomeDigests) === JSON.stringify(candidate.outcomeDigests);
        if (!outcomesMatch || !baseline.inputUnchanged || !candidate.inputUnchanged || !baseline.randomUnchanged || !candidate.randomUnchanged) {
            throw new Error(`${benchmark.id}: variant equivalence or input immutability check failed`);
        }
        return Object.freeze({
            id: benchmark.id,
            outcomesMatch,
            inputUnchanged: true,
            randomUnchanged: true,
            medianImprovementPercent: percentageImprovement(baseline.durationMs, candidate.durationMs),
            medianSignatureBuildReduction: Number(baseline.sourceSignatureBuildCalls.median) - Number(candidate.sourceSignatureBuildCalls.median)
        });
    });
    const sourcePath = path.join(rootDir, 'dist', 'game', 'ai', 'cpu-tactical-safety.js');
    return Object.freeze({
        schemaVersion: REPORT_SCHEMA_VERSION,
        lane: 'node-in-memory-variant-comparison',
        generatedAt: new Date().toISOString(),
        sourceCommit: sourceCommit(rootDir),
        nodeVersion: process.version,
        processId: process.pid,
        liveSourceVariant: detectLiveVariant(fs.readFileSync(sourcePath, 'utf8')),
        builtSourceSha256: sha256(fs.readFileSync(sourcePath)),
        fixtureDigest: digestTacticalSafetyFixtureManifest(fixtureManifest),
        warmupIterations,
        captureIterations,
        alternatingOrders: orders,
        variants: summaries,
        equivalence
    });
}

function contentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    return ({
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.ico': 'image/x-icon',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.wasm': 'application/wasm',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
        '.woff2': 'font/woff2'
    } as Record<string, string>)[extension] || 'application/octet-stream';
}

function createStaticServer(rootDir: string): http.Server {
    return http.createServer((request, response) => {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        let pathname: string;
        try {
            pathname = decodeURIComponent(requestUrl.pathname || '/');
        } catch (_error) {
            response.writeHead(400).end('invalid path');
            return;
        }
        const requestedPath = pathname === '/' ? '/vite-dist/index.vite.html' : pathname;
        const filePath = path.resolve(rootDir, `.${requestedPath}`);
        const allowedPrefix = `${path.resolve(rootDir)}${path.sep}`;
        if (filePath !== path.resolve(rootDir) && !filePath.startsWith(allowedPrefix)) {
            response.writeHead(403).end('forbidden');
            return;
        }
        try {
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) throw new Error('not a file');
            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Type': contentType(filePath)
            });
            fs.createReadStream(filePath).pipe(response);
        } catch (_error) {
            response.writeHead(404).end('not found');
        }
    });
}

function listen(server: http.Server): Promise<string> {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('static server did not expose a TCP address'));
                return;
            }
            resolve(`http://127.0.0.1:${address.port}`);
        });
    });
}

function closeServer(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function browserArtifactSha256(rootDir: string): string {
    const directory = path.join(rootDir, 'vite-dist');
    const paths: string[] = [];
    const visit = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const next = path.join(current, entry.name);
            if (entry.isDirectory()) visit(next);
            else if (entry.isFile()) paths.push(next);
        }
    };
    visit(directory);
    const hash = crypto.createHash('sha256');
    for (const filePath of paths.sort()) {
        hash.update(path.relative(rootDir, filePath).replace(/\\/g, '/'));
        hash.update('\0');
        hash.update(fs.readFileSync(filePath));
        hash.update('\0');
    }
    return hash.digest('hex');
}

async function runBrowserMeasurement(
    rootDir: string,
    warmupIterations: number,
    captureIterations: number
): Promise<Record<string, unknown>> {
    const server = createStaticServer(rootDir);
    let browser: Browser | null = null;
    let graphics: DesktopGraphicsEnvironment | null = null;
    const artifactHashBefore = browserArtifactSha256(rootDir);
    try {
        const baseUrl = await listen(server);
        browser = await chromium.launch(createDesktopChromiumLaunchOptions());
        graphics = await readDesktopGraphicsEnvironment(browser);
        const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
        await context.addInitScript(() => {
            Object.defineProperty(window, '__BOARD_VISUAL_TEST__', { value: true, configurable: true });
        });
        const page = await context.newPage();
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await page.goto(`${baseUrl}/vite-dist/index.vite.html?perf=1&boardRenderer=pixi&eagerCpuPolicy=1`, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000
        });
        await page.waitForFunction(() => {
            const root = window as any;
            return String(root.__CARD_REVERSI_BROWSER_LANE__ || '') === 'vite'
                && document.documentElement.getAttribute('data-browser-boot-state') === 'ready'
                && typeof root.__require === 'function'
                && root.__boardVisualDebug
                && typeof root.__boardVisualDebug.waitForIdle === 'function';
        }, undefined, { timeout: 30_000 });
        await page.evaluate(async () => {
            await (window as any).__boardVisualDebug.waitForIdle();
        });
        const captured = await page.evaluate(async ({ warmup, samples }) => {
            const root = window as any;
            const fixtureSeed = 1;
            const placement = [
                [0, -1, 0, 0, 0, 0, -1, -1], [0, 0, -1, -1, -1, -1, -1, 1],
                [1, 1, 1, -1, -1, -1, 1, 1], [1, 1, 0, -1, -1, 1, 0, 1],
                [0, 1, 1, -1, -1, 1, 1, 0], [0, 0, 1, 1, -1, -1, 1, 0],
                [-1, -1, -1, 1, 1, 1, 1, 1], [0, 0, 0, 1, 1, 1, 1, 1]
            ];
            const cards = root.__require('game/logic/cards');
            const core = root.__require('game/logic/core');
            const prng = root.__require('game/schema/prng');
            const safety = root.__require('game/ai/cpu-tactical-safety');
            const presentation = root.__require('game/logic/presentation');
            const boardOps = root.__require('game/logic/board_ops');
            if (!cards || !core || !prng || !safety || typeof safety.avoidTacticalBlunder !== 'function') {
                throw new Error('tactical safety runtime modules are unavailable');
            }
            presentation?.setPresentationRuntime?.({ emitPresentationEvent: boardOps?.emitPresentationEvent });
            const setup = (flip: boolean) => {
                const rng = prng.createPRNG(fixtureSeed);
                const cardState = cards.createCardState(rng);
                const gameState = core.createGameState();
                gameState.board = placement.map((row: number[]) => row.map((value: number) => flip ? -value : value));
                gameState.currentPlayer = flip ? 1 : -1;
                gameState.turnNumber = 43;
                const playerKey = flip ? 'black' : 'white';
                cardState.hands = { black: [], white: [] };
                cardState.charge[playerKey] = 99;
                cardState.lastTurnStartedFor = playerKey;
                const candidates = core.getLegalMoves(gameState, gameState.currentPlayer);
                const selected = candidates.find((move: any) => move.row === 1 && move.col === 1);
                if (!selected) throw new Error('browser fixture selected placement is unavailable');
                return { gameState, cardState, playerKey, level: 6, rng, candidates, selected };
            };
            const point = (value: any) => {
                if (!value || !Number.isInteger(value.row) || !Number.isInteger(value.col)) return null;
                return value.directionKey
                    ? { row: value.row, col: value.col, directionKey: value.directionKey }
                    : { row: value.row, col: value.col };
            };
            const snapshot = (input: any) => ({
                gameState: input.gameState,
                cardState: input.cardState,
                playerKey: input.playerKey,
                level: input.level,
                selected: point(input.selected),
                candidates: Array.isArray(input.candidates) ? input.candidates.map(point) : null,
                cardId: input.cardId || null,
                pendingType: input.pendingType || null,
                forceUseCard: input.forceUseCard === true,
                randomState: typeof input.rng?.getState === 'function' ? input.rng.getState() : null
            });
            const canonical = (value: any): any => {
                if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
                if (typeof value === 'number') return Number.isFinite(value) ? value : { $number: String(value) };
                if (Array.isArray(value)) return value.map(canonical);
                if (value && typeof value === 'object') {
                    return Object.fromEntries(Object.keys(value).sort().flatMap((key) => (
                        value[key] === undefined ? [] : [[key, canonical(value[key])]]
                    )));
                }
                throw new Error(`browser fixture contains a non-serializable ${typeof value}`);
            };
            const hashText = async (value: string) => {
                const bytes = new TextEncoder().encode(value);
                const digest = await crypto.subtle.digest('SHA-256', bytes);
                return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
            };
            const hash = async (value: any) => hashText(JSON.stringify(value));
            const fixtureDigest = await hashText(JSON.stringify(canonical({
                schemaVersion: 'tactical-safety-fixture.v2',
                cases: [false, true].map((flip) => {
                    const input = setup(flip);
                    return {
                        id: flip ? 'placement-corner-black' : 'placement-corner-white',
                        operation: 'avoidTacticalBlunder',
                        randomSeed: fixtureSeed,
                        input: JSON.parse(JSON.stringify(snapshot(input)))
                    };
                })
            })));
            const samplesByCase: Record<string, any[]> = { 'placement-corner-white': [], 'placement-corner-black': [] };
            const outputDigests: Record<string, Set<string>> = {
                'placement-corner-white': new Set<string>(),
                'placement-corner-black': new Set<string>()
            };
            for (let iteration = 0; iteration < warmup + samples; iteration += 1) {
                for (const flip of [false, true]) {
                    const id = flip ? 'placement-corner-black' : 'placement-corner-white';
                    const input = setup(flip);
                    const before = JSON.stringify(snapshot(input));
                    const startedAt = window.performance.now();
                    const result = safety.avoidTacticalBlunder(input);
                    const durationMs = window.performance.now() - startedAt;
                    const after = JSON.stringify(snapshot(input));
                    const countedInput = setup(flip);
                    const countedBefore = JSON.stringify(snapshot(countedInput));
                    const originalStringify = JSON.stringify;
                    let jsonStringifyCalls = 0;
                    let sourceSignatureBuildCalls = 0;
                    (JSON as any).stringify = (...args: any[]) => {
                        jsonStringifyCalls += 1;
                        if ((new Error().stack || '').includes('buildSourceSignature')) sourceSignatureBuildCalls += 1;
                        return (originalStringify as any).apply(JSON, args);
                    };
                    let countedResult: any;
                    try {
                        countedResult = safety.avoidTacticalBlunder(countedInput);
                    } finally {
                        (JSON as any).stringify = originalStringify;
                    }
                    const countedAfter = JSON.stringify(snapshot(countedInput));
                    const normalized = {
                        changed: result?.changed === true,
                        reason: typeof result?.reason === 'string' ? result.reason : null,
                        steps: Number.isFinite(result?.steps) ? Number(result.steps) : null,
                        selected: result?.selected ? { row: result.selected.row, col: result.selected.col } : null,
                        witness: result?.witness ? { row: result.witness.row, col: result.witness.col } : null
                    };
                    const countedNormalized = {
                        changed: countedResult?.changed === true,
                        reason: typeof countedResult?.reason === 'string' ? countedResult.reason : null,
                        steps: Number.isFinite(countedResult?.steps) ? Number(countedResult.steps) : null,
                        selected: countedResult?.selected ? { row: countedResult.selected.row, col: countedResult.selected.col } : null,
                        witness: countedResult?.witness ? { row: countedResult.witness.row, col: countedResult.witness.col } : null
                    };
                    const outcomeDigest = await hash(normalized);
                    if (JSON.stringify(normalized) !== JSON.stringify(countedNormalized)) {
                        throw new Error(`${id}: browser counting pass changed the tactical-safety result`);
                    }
                    outputDigests[id].add(outcomeDigest);
                    if (iteration >= warmup) {
                        samplesByCase[id].push({
                            durationMs,
                            jsonStringifyCalls,
                            sourceSignatureBuildCalls,
                            inputUnchanged: before === after && countedBefore === countedAfter,
                            outcomeDigest
                        });
                    }
                }
            }
            const diagnostics = root.__boardVisualDebug?.getBackendDiagnostics?.() || {};
            return {
                fixtureDigest,
                samplesByCase,
                outputDigests: Object.fromEntries(Object.entries(outputDigests).map(([id, values]) => [id, Array.from(values).sort()])),
                evidence: {
                    lane: String(root.__CARD_REVERSI_BROWSER_LANE__ || '') || null,
                    bootState: document.documentElement.getAttribute('data-browser-boot-state'),
                    pixiBackendMounted: document.querySelectorAll('#board canvas').length > 0,
                    tacticalSafetyExportPresent: typeof safety.avoidTacticalBlunder === 'function'
                }
            };
        }, { warmup: warmupIterations, samples: captureIterations });
        await context.close();
        if (consoleErrors.length || pageErrors.length) {
            const details = [...consoleErrors, ...pageErrors]
                .map((message) => String(message || '').replace(/\s+/g, ' ').trim().slice(0, 240))
                .filter(Boolean)
                .slice(0, 8);
            throw new Error(
                `browser emitted ${consoleErrors.length} console errors and ${pageErrors.length} page errors`
                + (details.length ? `: ${JSON.stringify(details)}` : '')
            );
        }
        const summaries = Object.fromEntries(Object.entries(captured.samplesByCase).map(([id, entries]) => {
            const typed = entries as Array<{ durationMs: number; jsonStringifyCalls: number; sourceSignatureBuildCalls: number; inputUnchanged: boolean }>;
            if (!typed.every((entry) => entry.inputUnchanged)) throw new Error(`${id}: browser input mutation detected`);
            return [id, Object.freeze({
                durationMs: summarize(typed.map((entry) => entry.durationMs)),
                jsonStringifyCalls: summarize(typed.map((entry) => entry.jsonStringifyCalls)),
                sourceSignatureBuildCalls: summarize(typed.map((entry) => entry.sourceSignatureBuildCalls)),
                inputUnchanged: true,
                outcomeDigests: captured.outputDigests[id]
            })];
        }));
        if (!(captured.evidence as BrowserRuntimeEvidence).pixiBackendMounted) {
            throw new Error('Vite/Pixi tactical-safety measurement did not mount a board canvas');
        }
        return Object.freeze({
            schemaVersion: REPORT_SCHEMA_VERSION,
            lane: 'browser-vite-pixi-live-source',
            generatedAt: new Date().toISOString(),
            sourceCommit: sourceCommit(rootDir),
            browserArtifactSha256: artifactHashBefore,
            warmupIterations,
            captureIterations,
            fixtureDigest: captured.fixtureDigest,
            graphics,
            runtimeEvidence: captured.evidence as BrowserRuntimeEvidence,
            cases: summaries
        });
    } finally {
        if (browser) await browser.close();
        await closeServer(server);
    }
}

type CliOptions = Readonly<{
    runtime: 'node' | 'browser';
    outputPath: string;
    warmupIterations: number;
    captureIterations: number;
}>;

export function parseArgs(argv: readonly string[]): CliOptions {
    let runtime: 'node' | 'browser' = 'node';
    let outputPath = path.join('artifacts', 'cpu-tactical-safety', 'latest.json');
    let warmupIterations = DEFAULT_WARMUP_ITERATIONS;
    let captureIterations = DEFAULT_CAPTURE_ITERATIONS;
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--runtime' && argv[index + 1]) {
            const value = String(argv[++index]);
            if (value !== 'node' && value !== 'browser') throw new Error(`invalid runtime: ${value}`);
            runtime = value;
        } else if (argument === '--output' && argv[index + 1]) {
            outputPath = String(argv[++index]);
        } else if (argument === '--warmup' && argv[index + 1]) {
            warmupIterations = Number(argv[++index]);
        } else if (argument === '--samples' && argv[index + 1]) {
            captureIterations = Number(argv[++index]);
        } else {
            throw new Error(`unknown argument: ${argument}`);
        }
    }
    if (!Number.isInteger(warmupIterations) || warmupIterations < 0 || warmupIterations > 50) {
        throw new Error('warmup must be an integer between 0 and 50');
    }
    if (!Number.isInteger(captureIterations) || captureIterations < 5 || captureIterations > 100) {
        throw new Error('samples must be an integer between 5 and 100');
    }
    return Object.freeze({ runtime, outputPath, warmupIterations, captureIterations });
}

async function runCli(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const rootDir = process.cwd();
    const outputPath = path.resolve(rootDir, options.outputPath);
    const report = options.runtime === 'node'
        ? runNodeMeasurement(rootDir, options.warmupIterations, options.captureIterations)
        : await runBrowserMeasurement(rootDir, options.warmupIterations, options.captureIterations);
    writeReport(outputPath, report);
    process.stdout.write(`[perf] wrote ${path.relative(rootDir, outputPath)}\n`);
}

if (require.main === module) {
    runCli().catch((error) => {
        console.error(error && error.stack ? error.stack : String(error));
        process.exitCode = 1;
    });
}
