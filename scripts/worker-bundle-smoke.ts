import { spawn, spawnSync, type ChildProcessByStdio } from 'child_process';
import * as fs from 'fs';
import { createServer } from 'net';
import * as os from 'os';
import * as path from 'path';
import type { Readable } from 'stream';
import { pathToFileURL } from 'url';

const ROOT = fs.existsSync(path.join(process.cwd(), 'wrangler.toml'))
    ? process.cwd()
    : path.resolve(__dirname, '..', '..');
const STARTUP_TIMEOUT_MS = 60000;
const BUNDLE_TIMEOUT_MS = 60000;
const BUNDLED_SCENARIO_TIMEOUT_MS = 30000;

type SmokeProcess = ChildProcessByStdio<null, Readable, Readable>;

interface JsonResponse {
    ok: boolean;
    status: number;
    data: any;
}

function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertTrue(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

function runNpx(args: string[]): ReturnType<typeof spawnSync> {
    const isWindows = process.platform === 'win32';
    return spawnSync(
        isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npx',
        isWindows ? ['/d', '/s', '/c', 'npx', ...args] : args,
        {
            cwd: ROOT,
            env: process.env,
            encoding: 'utf8',
            timeout: BUNDLE_TIMEOUT_MS
        }
    );
}

function describeSpawnFailure(result: ReturnType<typeof spawnSync>): string {
    if (result.error) return `${result.error.name}: ${result.error.message}`;
    if (result.signal) return `terminated by ${result.signal}`;
    return String(result.stderr || result.stdout || '').trim() || `exit status ${String(result.status)}`;
}

function findBundledWorkerFile(directory: string): string {
    const candidates: string[] = [];
    const visit = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const absolutePath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                visit(absolutePath);
            } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.map.js')) {
                candidates.push(absolutePath);
            }
        }
    };
    visit(directory);
    const expected = candidates.find((candidate) => path.basename(candidate) === 'match-worker.js');
    assertTrue(expected || candidates.length === 1, `Wrangler bundle を特定できませんでした: ${candidates.join(', ')}`);
    return expected || candidates[0];
}

function assertSpecialStoneRegistryUsesStaticWorkerRequires(bundleFile: string): void {
    const source = fs.readFileSync(bundleFile, 'utf8');
    const segmentStart = source.indexOf('function isUsableEvasionStatus');
    const segmentEnd = source.indexOf('module.exports = SpecialStoneRegistry', segmentStart);
    assertTrue(segmentStart >= 0 && segmentEnd > segmentStart, 'bundled SpecialStoneRegistry compatibility segment was not found');
    const registrySegment = source.slice(segmentStart, segmentEnd);
    assertTrue(
        registrySegment.includes('EvasionStatus = require_evasion_status()')
        && registrySegment.includes('ManifestStoneRegistry = require_manifest_stone_registry()')
        && registrySegment.includes('require_special_stone_registry_static()'),
        'bundled SpecialStoneRegistry dependencies are not statically resolved'
    );
    assertTrue(
        !registrySegment.includes('tryLoadOptionalModule')
        && !/\b__require\s*\(/.test(registrySegment),
        'bundled SpecialStoneRegistry compatibility path contains a dynamic require'
    );
}

function runBundledAuthorityScenarios(bundleModuleUrl: string): any {
    const runner = [
        "import { createRequire } from 'module';",
        "import path from 'path';",
        "globalThis.self = globalThis;",
        "delete globalThis.require;",
        "if (typeof globalThis.require !== 'undefined') throw new Error('bundle runner unexpectedly exposes global require');",
        "const bundleUrl = process.argv[1];",
        "const root = process.argv[2];",
        "const bundled = await import(bundleUrl);",
        "const bundledCardUtils = globalThis.CardUtils;",
        "if (!bundledCardUtils || typeof bundledCardUtils.addChargeWithDelta !== 'function') {",
        "  throw new Error('bundled CardUtils.addChargeWithDelta is unavailable');",
        "}",
        "const bundledChargeState = { charge: { black: 0, white: 0 } };",
        "const bundledChargeResult = bundledCardUtils.addChargeWithDelta(",
        "  bundledChargeState, 'black', 5, 'worker_bundle_smoke'",
        ");",
        "const rootRequire = createRequire(import.meta.url);",
        "const MatchRoomDurableObject = bundled.MatchRoomDurableObjectV3 || bundled.MatchRoomDurableObject;",
        "if (typeof MatchRoomDurableObject !== 'function') throw new Error('bundled Durable Object export is unavailable');",
        "const Core = rootRequire(path.resolve(root, 'game/logic/core.js'));",
        "const CardLogic = rootRequire(path.resolve(root, 'game/logic/cards.js'));",
        "const TurnPipelinePhases = rootRequire(path.resolve(root, 'game/turn/turn_pipeline_phases.js'));",
        "const SeededPRNG = rootRequire(path.resolve(root, 'game/schema/prng.js'));",
        "const storage = new Map();",
        "const durableObject = new MatchRoomDurableObject({ storage: {",
        "  get: async (key) => storage.get(key),",
        "  put: async (key, value) => storage.set(key, value),",
        "  delete: async (key) => storage.delete(key),",
        "  setAlarm: async () => {},",
        "  deleteAlarm: async () => {}",
        "} });",
        "durableObject.broadcastSnapshot = async () => {};",
        "const prng = SeededPRNG.createPRNG(31);",
        "const gameState = Core.createGameState();",
        "const cardState = CardLogic.createCardState(prng);",
        "TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
        "cardState.hands.black = [];",
        "cardState._handCopyIdsByPlayer.black = [];",
        "cardState.cardCostOverridesByCopyId = {};",
        "cardState.cardCostModifiersByCopyId = {};",
        "cardState.charge.black = 9;",
        "cardState.pendingEffectByPlayer.black = null;",
        "cardState.hasUsedCardThisTurnByPlayer.black = false;",
        "CardLogic.addCardToHand(cardState, 'black', 'poison_will_01');",
        "const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
        "  roomId: 'BNDL', playerName: 'bundle黒', seed: 31, networkAutoEnabled: true,",
        "  snapshot: { gameState, cardState }",
        "});",
        "const created = await createResponse.json();",
        "if (!createResponse.ok || created.ok !== true) throw new Error(`bundled create failed status=${createResponse.status}`);",
        "const turnIndex = created.snapshot.cardState.turnIndex;",
        "const publishResponse = await durableObject.handlePublish({",
        "  roomId: created.roomId,",
        "  seatKey: 'black', playerKey: 'black', seatToken: created.seatToken,",
        "  baseVersion: created.stateVersion, operationId: 'op_bundle_poison_auto_1',",
        "  actionType: 'auto_turn', actor: 'black', turnIndex,",
        "  action: {",
        "    type: 'auto_turn',",
        "    preferredActionType: 'use_card',",
        "    preferredAction: { type: 'use_card', playerKey: 'black', useCardId: 'poison_will_01', turnIndex }",
        "  }",
        "});",
        "const published = await publishResponse.json();",
        "const continuationStorage = new Map();",
        "const continuationDurableObject = new MatchRoomDurableObject({ storage: {",
        "  get: async (key) => continuationStorage.get(key),",
        "  put: async (key, value) => continuationStorage.set(key, value),",
        "  delete: async (key) => continuationStorage.delete(key),",
        "  setAlarm: async () => {},",
        "  deleteAlarm: async () => {}",
        "} });",
        "continuationDurableObject.broadcastSnapshot = async () => {};",
        "const continuationPrng = SeededPRNG.createPRNG(32);",
        "const continuationGameState = Core.createGameState();",
        "const continuationCardState = CardLogic.createCardState(continuationPrng);",
        "TurnPipelinePhases.applyTurnStartPhase(",
        "  CardLogic, Core, continuationCardState, continuationGameState, 'black', [], continuationPrng",
        ");",
        "continuationGameState.currentPlayer = 1;",
        "continuationGameState.consecutivePasses = 0;",
        "continuationGameState.resultShown = false;",
        "continuationCardState.lastTurnStartedFor = 'black';",
        "continuationCardState._activeTurnPlayer = 'black';",
        "continuationCardState.pendingEffectByPlayer.black = null;",
        "continuationCardState.extraPlaceRemainingByPlayer.black = 1;",
        "continuationCardState.infinitePlaceActiveByPlayer.black = false;",
        "continuationCardState.multiPlaceSourceTypeByPlayer.black = 'DOUBLE_PLACE';",
        "continuationCardState.hands.black = [];",
        "continuationCardState._handCopyIdsByPlayer.black = [];",
        "continuationCardState.discard = [];",
        "CardLogic.addCardToHand(continuationCardState, 'black', 'work_01');",
        "continuationCardState.charge.black = 99;",
        "continuationCardState.hasUsedCardThisTurnByPlayer.black = true;",
        "continuationCardState.lastUsedCardByPlayer.black = 'double_01';",
        "const continuationCreateResponse = await continuationDurableObject.handleInternalCreate(",
        "  new URL('https://room/internal/create'),",
        "  {",
        "    roomId: 'BND2', playerName: 'bundle継続黒', seed: 32, networkAutoEnabled: true,",
        "    snapshot: { gameState: continuationGameState, cardState: continuationCardState }",
        "  }",
        ");",
        "const continuationCreated = await continuationCreateResponse.json();",
        "if (!continuationCreateResponse.ok || continuationCreated.ok !== true) {",
        "  throw new Error(`bundled continuation create failed status=${continuationCreateResponse.status}`);",
        "}",
        "const continuationTurnIndex = continuationCreated.snapshot.cardState.turnIndex;",
        "const continuationPublishResponse = await continuationDurableObject.handlePublish({",
        "  roomId: continuationCreated.roomId,",
        "  seatKey: 'black', playerKey: 'black', seatToken: continuationCreated.seatToken,",
        "  baseVersion: continuationCreated.stateVersion, operationId: 'op_bundle_double_continuation_1',",
        "  actionType: 'auto_turn', actor: 'black', turnIndex: continuationTurnIndex,",
        "  action: {",
        "    type: 'auto_turn',",
        "    preferredActionType: 'use_card',",
        "    preferredAction: {",
        "      type: 'use_card', playerKey: 'black', useCardId: 'work_01',",
        "      useCardOwnerKey: 'black', useCardHandIndex: 0, turnIndex: continuationTurnIndex",
        "    }",
        "  }",
        "});",
        "const continuationPublished = await continuationPublishResponse.json();",
        "const failureStorage = new Map();",
        "let failurePutCount = 0;",
        "let failureBroadcastCount = 0;",
        "let failureRuntimeInvocations = 0;",
        "const makeRuntimeUnavailable = () => {",
        "  const error = new Error('injected bundled card runtime failure');",
        "  Object.defineProperties(error, {",
        "    name: { value: 'CardRuntimeUnavailableError', configurable: true },",
        "    code: { value: 'runtime_unavailable', enumerable: true },",
        "    capability: { value: 'targeting.targetResolver', enumerable: true },",
        "    cohort: { value: 'targeting', enumerable: true },",
        "    [Symbol.for('card-reversi.card-runtime-unavailable.v1')]: {",
        "      value: 'card-runtime-unavailable:v1', enumerable: false, configurable: false, writable: false",
        "    }",
        "  });",
        "  return error;",
        "};",
        "const failureDurableObject = new MatchRoomDurableObject({ storage: {",
        "  get: async (key) => failureStorage.get(key),",
        "  put: async (key, value) => { failurePutCount += 1; failureStorage.set(key, value); },",
        "  delete: async (key) => failureStorage.delete(key),",
        "  setAlarm: async () => {},",
        "  deleteAlarm: async () => {}",
        "} }, null, Object.freeze({",
        "  applyCommandPublishToSnapshot: async () => {",
        "    failureRuntimeInvocations += 1;",
        "    throw makeRuntimeUnavailable();",
        "  }",
        "}));",
        "failureDurableObject.broadcastSnapshot = async () => { failureBroadcastCount += 1; };",
        "const failurePrng = SeededPRNG.createPRNG(33);",
        "const failureGameState = Core.createGameState();",
        "const failureCardState = CardLogic.createCardState(failurePrng);",
        "TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, failureCardState, failureGameState, 'black', [], failurePrng);",
        "const failureCreateResponse = await failureDurableObject.handleInternalCreate(",
        "  new URL('https://room/internal/create'),",
        "  { roomId: 'BNDF', playerName: 'bundle失敗黒', seed: 33, snapshot: { gameState: failureGameState, cardState: failureCardState } }",
        ");",
        "const failureCreated = await failureCreateResponse.json();",
        "if (!failureCreateResponse.ok || failureCreated.ok !== true) throw new Error('bundled failure room create failed');",
        "const failureRoomBefore = JSON.stringify(failureDurableObject.room);",
        "const failureStorageBefore = JSON.stringify([...failureStorage.entries()]);",
        "const failurePutCountBefore = failurePutCount;",
        "const failureBroadcastCountBefore = failureBroadcastCount;",
        "const failurePublishResponse = await failureDurableObject.handlePublish({",
        "  roomId: failureCreated.roomId,",
        "  seatKey: 'black', playerKey: 'black', seatToken: failureCreated.seatToken,",
        "  baseVersion: failureCreated.stateVersion, operationId: 'op_bundle_runtime_unavailable_1',",
        "  actionType: 'pass', actor: 'black', turnIndex: failureCreated.snapshot.cardState.turnIndex,",
        "  action: { type: 'pass', playerKey: 'black', forcePass: true, reason: 'smoke' }",
        "});",
        "const failurePublished = await failurePublishResponse.json();",
        "const failureEvidence = {",
        "  status: failurePublishResponse.status,",
        "  payload: failurePublished,",
        "  runtimeInvocations: failureRuntimeInvocations,",
        "  roomUnchanged: JSON.stringify(failureDurableObject.room) === failureRoomBefore,",
        "  storageUnchanged: JSON.stringify([...failureStorage.entries()]) === failureStorageBefore,",
        "  putCountUnchanged: failurePutCount === failurePutCountBefore,",
        "  broadcastCountUnchanged: failureBroadcastCount === failureBroadcastCountBefore",
        "};",
        "process.stdout.write(JSON.stringify({",
        "  cardUtilsCharge: { result: bundledChargeResult, state: bundledChargeState },",
        "  poison: { status: publishResponse.status, payload: published },",
        "  doublePlace: { status: continuationPublishResponse.status, payload: continuationPublished },",
        "  runtimeUnavailable: failureEvidence",
        "}));"
    ].join('\n');
    const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', runner, bundleModuleUrl, ROOT],
        {
            cwd: ROOT,
            env: process.env,
            encoding: 'utf8',
            timeout: BUNDLED_SCENARIO_TIMEOUT_MS
        }
    );
    assertTrue(
        result.status === 0,
        `bundled authority scenario runner failed\n${describeSpawnFailure(result)}`
    );
    return JSON.parse(String(result.stdout || '{}'));
}

function verifyBundledAuthorityScenarios(): void {
    const bundleDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'card-reversi-worker-bundle-smoke-'));
    try {
        const bundled = runNpx(['wrangler', 'deploy', '--dry-run', '--outdir', bundleDirectory]);
        assertTrue(
            bundled.status === 0,
            `Wrangler dry-run bundle failed\n${describeSpawnFailure(bundled)}`
        );
        const bundleFile = findBundledWorkerFile(bundleDirectory);
        assertSpecialStoneRegistryUsesStaticWorkerRequires(bundleFile);
        console.log('[worker-bundle-smoke] bundled SpecialStoneRegistry static resolution passed');
        const moduleFile = path.join(bundleDirectory, 'match-worker.bundle-smoke.mjs');
        fs.copyFileSync(bundleFile, moduleFile);
        const result = runBundledAuthorityScenarios(pathToFileURL(moduleFile).href);
        const cardUtilsCharge = result && result.cardUtilsCharge;
        const chargeResult = cardUtilsCharge && cardUtilsCharge.result;
        const chargeState = cardUtilsCharge && cardUtilsCharge.state;
        assertTrue(
            chargeResult
            && chargeResult.changed === true
            && chargeResult.before === 0
            && chargeResult.after === 5
            && chargeResult.delta === 5
            && chargeState
            && chargeState.charge
            && chargeState.charge.black === 5
            && Array.isArray(chargeState.chargeDeltaEvents)
            && chargeState.chargeDeltaEvents.length === 1
            && chargeState.chargeDeltaEvents[0].player === 'black'
            && chargeState.chargeDeltaEvents[0].delta === 5,
            `bundled CardUtils charge update failed: ${JSON.stringify(cardUtilsCharge)}`
        );
        console.log('[worker-bundle-smoke] bundled CardUtils charge update passed');

        const poison = result && result.poison;
        const pending = poison
            && poison.payload
            && poison.payload.snapshot
            && poison.payload.snapshot.cardState
            && poison.payload.snapshot.cardState.pendingEffectByPlayer
            && poison.payload.snapshot.cardState.pendingEffectByPlayer.black;
        assertTrue(
            poison && poison.status === 200 && poison.payload && poison.payload.ok === true,
            `bundled poison AUTO failed status=${poison && poison.status} body=${JSON.stringify(poison && poison.payload)}`
        );
        assertTrue(
            pending && pending.type === 'POISON_WILL' && pending.stage === 'selectTarget',
            `bundled poison AUTO did not enter POISON_WILL selection: ${JSON.stringify(pending)}`
        );
        console.log('[worker-bundle-smoke] bundled poison AUTO passed');

        const doublePlace = result && result.doublePlace;
        const doublePlaceSnapshot = doublePlace && doublePlace.payload && doublePlace.payload.snapshot;
        const doublePlaceGameState = doublePlaceSnapshot && doublePlaceSnapshot.gameState;
        const doublePlaceCardState = doublePlaceSnapshot && doublePlaceSnapshot.cardState;
        assertTrue(
            doublePlace && doublePlace.status === 200 && doublePlace.payload && doublePlace.payload.ok === true,
            `bundled DOUBLE_PLACE continuation failed status=${doublePlace && doublePlace.status} body=${JSON.stringify(doublePlace && doublePlace.payload)}`
        );
        assertTrue(
            doublePlaceGameState
            && Array.isArray(doublePlaceGameState.board)
            && doublePlaceGameState.board[2]
            && doublePlaceGameState.board[2][3] === 1,
            'bundled DOUBLE_PLACE continuation did not place the expected stone'
        );
        assertTrue(
            doublePlaceCardState
            && Array.isArray(doublePlaceCardState.hands && doublePlaceCardState.hands.black)
            && doublePlaceCardState.hands.black.length === 1
            && doublePlaceCardState.hands.black[0] === 'work_01'
            && Array.isArray(doublePlaceCardState.discard)
            && doublePlaceCardState.discard.length === 0,
            `bundled DOUBLE_PLACE continuation consumed the preferred card: ${JSON.stringify({
                hand: doublePlaceCardState && doublePlaceCardState.hands && doublePlaceCardState.hands.black,
                discard: doublePlaceCardState && doublePlaceCardState.discard
            })}`
        );
        assertTrue(
            doublePlaceCardState
            && doublePlaceCardState.extraPlaceRemainingByPlayer
            && doublePlaceCardState.extraPlaceRemainingByPlayer.black === 0
            && doublePlaceCardState.multiPlaceSourceTypeByPlayer
            && doublePlaceCardState.multiPlaceSourceTypeByPlayer.black === null,
            `bundled DOUBLE_PLACE continuation did not settle: ${JSON.stringify({
                remaining: doublePlaceCardState
                    && doublePlaceCardState.extraPlaceRemainingByPlayer
                    && doublePlaceCardState.extraPlaceRemainingByPlayer.black,
                sourceType: doublePlaceCardState
                    && doublePlaceCardState.multiPlaceSourceTypeByPlayer
                    && doublePlaceCardState.multiPlaceSourceTypeByPlayer.black
            })}`
        );
        assertTrue(
            doublePlaceGameState && doublePlaceGameState.currentPlayer === -1,
            `bundled DOUBLE_PLACE continuation did not hand off to white: ${String(doublePlaceGameState && doublePlaceGameState.currentPlayer)}`
        );
        console.log('[worker-bundle-smoke] bundled DOUBLE_PLACE continuation passed');

        const runtimeUnavailable = result && result.runtimeUnavailable;
        assertTrue(
            runtimeUnavailable
            && runtimeUnavailable.status === 409
            && runtimeUnavailable.payload
            && runtimeUnavailable.payload.ok === false
            && runtimeUnavailable.payload.rejectedReason === 'RUNTIME_UNAVAILABLE'
            && runtimeUnavailable.runtimeInvocations === 1
            && runtimeUnavailable.roomUnchanged === true
            && runtimeUnavailable.storageUnchanged === true
            && runtimeUnavailable.putCountUnchanged === true
            && runtimeUnavailable.broadcastCountUnchanged === true,
            `bundled runtime-unavailable atomicity failed: ${JSON.stringify(runtimeUnavailable)}`
        );
        console.log('[worker-bundle-smoke] bundled runtime-unavailable atomicity passed');
    } finally {
        fs.rmSync(bundleDirectory, { recursive: true, force: true });
    }
}

async function findFreePort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    assertTrue(address && typeof address === 'object' && Number(address.port) > 0, 'worker bundle smoke port の取得に失敗しました');
    return Number(address.port);
}

function stopProcessTree(child: SmokeProcess): void {
    if (!child || !child.pid || child.killed) return;
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        return;
    }
    try {
        process.kill(-child.pid, 'SIGTERM');
    } catch {
        child.kill('SIGTERM');
    }
}

function startWorker(port: number): { child: SmokeProcess; output: () => string } {
    const isWindows = process.platform === 'win32';
    const wranglerArgs = ['wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port)];
    const child = spawn(
        isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npx',
        isWindows ? ['/d', '/s', '/c', 'npx', ...wranglerArgs] : wranglerArgs,
        {
            cwd: ROOT,
            detached: !isWindows,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        }
    );
    let output = '';
    const append = (chunk: Buffer | string) => {
        output = `${output}${chunk.toString()}`.slice(-12000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    return { child, output: () => output };
}

async function requestJson(baseUrl: string, method: string, route: string, body?: unknown): Promise<JsonResponse> {
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return {
        ok: response.ok,
        status: response.status,
        data: await response.json().catch(() => ({}))
    };
}

async function waitForWorker(baseUrl: string, child: SmokeProcess, output: () => string): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
        if (child.exitCode !== null) {
            throw new Error(`local Worker exited before ready (code=${child.exitCode})\n${output()}`);
        }
        try {
            const response = await requestJson(baseUrl, 'GET', '/api/match/list');
            if (response.ok) return;
        } catch {
            // The Worker is still starting.
        }
        await wait(250);
    }
    throw new Error(`local Worker did not become ready within ${STARTUP_TIMEOUT_MS}ms\n${output()}`);
}

async function leaveRoom(baseUrl: string, roomId: string, seatKey: string, seatToken: string): Promise<void> {
    const response = await requestJson(baseUrl, 'POST', '/api/match/leave', { roomId, seatKey, seatToken });
    assertTrue(response.ok && response.data && response.data.ok === true, `leave(${seatKey}) failed status=${response.status}`);
}

async function main(): Promise<void> {
    verifyBundledAuthorityScenarios();

    const port = await findFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const runtime = startWorker(port);
    let black: any = null;
    let white: any = null;

    console.log(`[worker-bundle-smoke] starting ${baseUrl}`);
    try {
        await waitForWorker(baseUrl, runtime.child, runtime.output);

        const created = await requestJson(baseUrl, 'POST', '/api/match/create', { playerName: 'bundle黒' });
        assertTrue(created.ok && created.data && created.data.ok === true, `create failed status=${created.status} body=${JSON.stringify(created.data)}`);
        black = created.data;
        assertTrue(black.seatKey === 'black' && black.roomId && black.seatToken, 'create response lacks black seat credentials');

        const joined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId: black.roomId, playerName: 'bundle白' });
        assertTrue(joined.ok && joined.data && joined.data.ok === true, `join failed status=${joined.status} body=${JSON.stringify(joined.data)}`);
        white = joined.data;
        assertTrue(white.seatKey === 'white' && white.seatToken, 'join response lacks white seat credentials');

        const state = await requestJson(
            baseUrl,
            'GET',
            `/api/match/state?roomId=${encodeURIComponent(black.roomId)}&seatKey=black&seatToken=${encodeURIComponent(black.seatToken)}`
        );
        assertTrue(state.ok && state.data && state.data.ok === true, `state failed status=${state.status}`);

        await leaveRoom(baseUrl, black.roomId, 'white', white.seatToken);
        await leaveRoom(baseUrl, black.roomId, 'black', black.seatToken);
        white = null;
        black = null;
        console.log('[worker-bundle-smoke] create/join/state/leave passed');
    } finally {
        if (white && black) {
            await requestJson(baseUrl, 'POST', '/api/match/leave', {
                roomId: black.roomId,
                seatKey: 'white',
                seatToken: white.seatToken
            }).catch(() => undefined);
        }
        if (black) {
            await requestJson(baseUrl, 'POST', '/api/match/leave', {
                roomId: black.roomId,
                seatKey: 'black',
                seatToken: black.seatToken
            }).catch(() => undefined);
        }
        stopProcessTree(runtime.child);
    }
}

main().catch((error) => {
    console.error(`[worker-bundle-smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
