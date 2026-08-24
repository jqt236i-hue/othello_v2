import * as crypto from 'crypto';
import * as path from 'path';
import type { AddressInfo } from 'net';

const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');
const MatchAuthority = require('../utils/match-authority');
const LocalMatchServer = require('./local-match-server');
const LocalMatchRuntime = require('./local-match-runtime');
const ROOT = path.resolve(process.cwd());
const CardRuntimeParityFixture = require(path.join(ROOT, 'test', 'fixtures', 'card-runtime-parity-fixture.js'));
const ExpectedParityFixture = require(path.join(ROOT, 'test', 'fixtures', 'card-runtime-parity-expected.v1.json'));
const ExpectedAuthorityFixture = require(path.join(ROOT, 'test', 'fixtures', 'card-runtime-authority-expected.v1.json'));
const OptionalPresentationExpected = require(path.join(ROOT, 'test', 'fixtures', 'card-runtime-optional-presentation-expected.v1.json'));
const SelfplayRunner = require('../src/engine/selfplay-runner');
const SelfplayExpected = require(path.join(ROOT, 'test', 'fixtures', 'card-runtime-selfplay-expected.v1.json'));
const CpuDecision = require('../game/cpu-decision');
const CpuExpected = require(path.join(ROOT, 'test', 'fixtures', 'card-runtime-cpu-expected.v1.json'));

const EXPECTED_DESCRIPTOR_SCHEMA_HASH = '2e905842becba7eabe082a7f95be2b326a4cfb5b6e0a59f450cda26fe549b4be';

function descriptorSchema(value: Record<string, unknown>) {
  return Reflect.ownKeys(value).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return {
      key: typeof key === 'symbol' ? key.toString() : key,
      kind: typeof value[key as keyof typeof value],
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      writable: 'writable' in descriptor ? descriptor.writable : null,
      hasGetter: typeof descriptor.get === 'function',
      hasSetter: typeof descriptor.set === 'function'
    };
  });
}

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertParityFixture(result: any, lane: string): void {
  const observed = {
    fixtureVersion: result.fixtureVersion,
    overallDigest: sha256(result),
    canonicalDigest: sha256(result.canonical),
    prngLedgerDigest: sha256(result.prng.ledger),
    resultDigest: sha256(result.results),
    pendingDigest: sha256(result.pendingBeforeCancel),
    scenarioDigest: sha256(result.scenarioCoverage),
    runtimeProjectionInventory: result.canonical.runtimeProjectionInventory,
    prng: result.prng.state,
    eventTypes: result.canonical.presentationEvents.map((event: any) => event.type),
    heavenOffers: result.results.heavenOffers,
    pending: result.pendingBeforeCancel
  };
  if (JSON.stringify(observed) !== JSON.stringify(ExpectedParityFixture)) {
    throw new Error(`${lane} fixed-seed fixture drift expected=${JSON.stringify(ExpectedParityFixture)} observed=${JSON.stringify(observed)}`);
  }
}

async function requestJson(baseUrl: string, method: string, route: string, body?: any): Promise<any> {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const payload = await response.json();
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error(`${method} ${route} failed status=${response.status} payload=${JSON.stringify(payload)}`);
  }
  return payload;
}

async function closeServer(server: any): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
  });
}

function projectAuthorityResult(result: any): any {
  const snapshot = result && result.snapshot;
  return {
    ok: result && result.ok,
    stateVersion: result && result.stateVersion,
    gameState: snapshot && snapshot.gameState,
    cardState: snapshot && snapshot.cardState,
    playbackEvents: result && result.playbackEvents,
    effectLogs: result && result.effectLogs,
    rejectedReason: result && result.rejectedReason
  };
}

async function runBuiltLocalAuthorityScenario(): Promise<any> {
  const seed = 17;
  const directRuntime = LocalMatchRuntime.createRuntime({ seed });
  const initialSnapshot = JSON.parse(JSON.stringify(directRuntime.getSnapshot()));
  const initialVersion = Number(directRuntime.getRoom().stateVersion || 0);
  const playerValue = Number(initialSnapshot.gameState.currentPlayer);
  const playerKey = playerValue === Core.WHITE ? 'white' : 'black';
  const legalMoves = Core.getLegalMoves(initialSnapshot.gameState, playerValue);
  if (!Array.isArray(legalMoves) || legalMoves.length === 0) throw new Error('fixed local authority has no opening move');
  const move = legalMoves[0];
  const body = {
    seatKey: playerKey,
    playerKey,
    actionType: 'place',
    operationId: 'card_runtime_dist_probe_1',
    baseVersion: initialVersion,
    actor: playerKey,
    params: { row: move.row, col: move.col },
    turnIndex: Number(initialSnapshot.cardState.turnIndex || 1),
    action: { type: 'place', playerKey, row: move.row, col: move.col, turnIndex: Number(initialSnapshot.cardState.turnIndex || 1) }
  };
  const directResult = directRuntime.applyCommand(body);
  if (!directResult || directResult.ok !== true) throw new Error(`fixed direct local runtime rejected: ${JSON.stringify(directResult)}`);

  const server = LocalMatchServer.createLocalMatchServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let roomId = '';
  let blackToken = '';
  let whiteToken = '';
  try {
    const created = await requestJson(baseUrl, 'POST', '/api/match/create', { playerName: 'dist-black' });
    roomId = String(created.roomId || '');
    blackToken = String(created.seatToken || '');
    const joined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId, playerName: 'dist-white' });
    whiteToken = String(joined.seatToken || '');
    const patched = LocalMatchServer.patchRoomSnapshotForTests(roomId, (room: any) => {
      room.seed = seed;
      room.snapshot = JSON.parse(JSON.stringify(initialSnapshot));
      room.snapshot.stateVersion = initialVersion;
      room.stateVersion = initialVersion;
      room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
      room.lastAcceptedOperationBySeat = { black: null, white: null };
      room.acceptedOperationHistoryBySeat = { black: [], white: [] };
      room.roomBoardConfig = initialSnapshot.gameState.boardConfig || null;
    });
    if (!patched) throw new Error('failed to patch built local authority with fixed snapshot');
    const seatToken = playerKey === 'white' ? whiteToken : blackToken;
    const published = await requestJson(baseUrl, 'POST', '/api/match/publish', {
      ...body,
      roomId,
      seatToken
    });
    const directProjection = projectAuthorityResult(directResult);
    const httpProjection = projectAuthorityResult(published);
    if (sha256(directProjection) !== sha256(httpProjection)) {
      throw new Error(`built local authority exact parity drift direct=${sha256(directProjection)} http=${sha256(httpProjection)}`);
    }
    return {
      seed,
      stateVersionBefore: initialVersion,
      stateVersionAfter: Number(published.stateVersion || 0),
      playerKey,
      placedCell: published.snapshot.gameState.board[move.row][move.col],
      exactProjectionDigest: sha256(httpProjection),
      eventTypes: Array.isArray(published.playbackEvents)
        ? published.playbackEvents.map((event: any) => event && event.type).filter(Boolean)
        : []
    };
  } finally {
    try {
      if (roomId && whiteToken) {
        await requestJson(baseUrl, 'POST', '/api/match/leave', { roomId, seatKey: 'white', seatToken: whiteToken });
      }
      if (roomId && blackToken) {
        await requestJson(baseUrl, 'POST', '/api/match/leave', { roomId, seatKey: 'black', seatToken: blackToken });
      }
    } catch (error) {
      console.warn(`[card-runtime-dist-parity] cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    }
    LocalMatchServer.resetRoomsForTests();
    await closeServer(server);
  }
}

async function main(): Promise<void> {
  const schema = descriptorSchema(CardLogic);
  const schemaHash = sha256(schema);
  if (schema.length !== 289 || schemaHash !== EXPECTED_DESCRIPTOR_SCHEMA_HASH) {
    throw new Error(`built CardLogic facade drift keys=${schema.length} schemaHash=${schemaHash}`);
  }
  const legacyWrapper = require(path.join(ROOT, 'game', 'logic', 'cards.js'));
  if (legacyWrapper !== CardLogic) throw new Error('built legacy wrapper does not preserve CardLogic object identity');
  const fixedFixture = CardRuntimeParityFixture.run(CardLogic);
  assertParityFixture(fixedFixture, 'built-dist/direct-and-legacy-wrapper');
  const optionalPresentationProbe = CardRuntimeParityFixture.runOptionalPresentationProbe(CardLogic);
  if (sha256(optionalPresentationProbe) !== OptionalPresentationExpected.nodeWorkerDigest) {
    throw new Error(`built Node optional presentation branch drift: ${sha256(optionalPresentationProbe)}`);
  }
  const smallSelfplay = CardRuntimeParityFixture.runSmallSelfplayProbe(SelfplayRunner);
  if (sha256(smallSelfplay) !== SelfplayExpected.digest) {
    throw new Error(`built small-selfplay fixture drift: ${sha256(smallSelfplay)}`);
  }
  const originalWarn = console.warn;
  let cpuDecision;
  try {
    console.warn = () => undefined;
    cpuDecision = CardRuntimeParityFixture.runCpuDecisionProbe(CpuDecision, CardLogic);
  } finally {
    console.warn = originalWarn;
  }
  if (sha256(cpuDecision) !== CpuExpected.digest) {
    throw new Error(`built CPU decision fixture drift: ${sha256(cpuDecision)}`);
  }
  const localAuthority = await runBuiltLocalAuthorityScenario();
  if (JSON.stringify(localAuthority) !== JSON.stringify(ExpectedAuthorityFixture)) {
    throw new Error(`built local authority baseline drift expected=${JSON.stringify(ExpectedAuthorityFixture)} observed=${JSON.stringify(localAuthority)}`);
  }
  if (localAuthority.stateVersionAfter !== localAuthority.stateVersionBefore + 1) {
    throw new Error(`built local authority version drift: ${JSON.stringify(localAuthority)}`);
  }
  console.log(JSON.stringify({
    facadeKeys: schema.length,
    facadeSchemaHash: schemaHash,
    fixedFixtureDigest: sha256(fixedFixture),
    smallSelfplayDigest: sha256(smallSelfplay),
    cpuDecisionDigest: sha256(cpuDecision),
    legacyWrapperIdentity: legacyWrapper === CardLogic,
    localAuthority
  }));
}

main().catch((error) => {
  console.error(`[card-runtime-dist-parity] ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
