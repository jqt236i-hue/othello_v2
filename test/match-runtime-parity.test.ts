import * as http from 'http';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as MatchAuthority from '../utils/match-authority.js';
import * as LocalMatchRuntime from '../scripts/local-match-runtime';
import * as PendingTargetSelector from '../game/turn-handlers/pending-target-selector';
import CardCatalog = require('../cards/catalog.json');
import { createLocalMatchServer, resetRoomsForTests, patchRoomSnapshotForTests } from '../scripts/local-match-server.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requestJson(port, method, path, payload?) {
  return new Promise<any>((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            data: raw ? JSON.parse(raw) : {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(JSON.stringify(payload));
    req.end();
  });
}

async function listen(server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return (server.address() as any).port;
}

async function closeServer(server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function normalizePlayerKey(value) {
  return MatchAuthority.normalizePlayerKey(value, 'black');
}

function pickFirstLegalAction(snapshot) {
  const player = Number(snapshot.gameState.currentPlayer);
  const playerKey = player === -1 ? 'white' : 'black';
  const legalMoves = Core.getLegalMoves(snapshot.gameState, player);
  if (!Array.isArray(legalMoves) || legalMoves.length === 0) {
    throw new Error(`NO_LEGAL_MOVES:${playerKey}`);
  }
  const move = legalMoves[0];
  return {
    type: 'place',
    playerKey,
    row: move.row,
    col: move.col,
    turnIndex: Number(snapshot.cardState.turnIndex) || 0
  };
}

function buildPublishBody({ snapshot, stateVersion, action, operationId }) {
  const playerKey = normalizePlayerKey(action.playerKey);
  return {
    seatKey: playerKey,
    playerKey,
    baseVersion: Number(stateVersion),
    operationId,
    actionType: action.type,
    actor: playerKey,
    params: { row: action.row, col: action.col },
    turnIndex: action.turnIndex,
    action
  };
}

function createCardUseRuntime(cardId, seed = 31) {
  const runtime = LocalMatchRuntime.createRuntime({ seed });
  const snapshot = runtime.getRoom().snapshot;
  snapshot.cardState.hands.black = [cardId];
  snapshot.cardState.hands.white = [];
  snapshot.cardState.deck.black = [];
  snapshot.cardState.deck.white = [];
  snapshot.cardState.discard = [];
  snapshot.cardState.charge.black = 99;
  snapshot.cardState.charge.white = 99;
  snapshot.cardState.debugNoDraw = true;
  snapshot.cardState.selectedCardId = cardId;
  snapshot.cardState.selectedCardOwnerKey = 'black';
  snapshot.gameState.currentPlayer = Core.BLACK;
  runtime.getRoom().stateVersion = 0;
  snapshot.stateVersion = 0;
  runtime.getRoom().authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(snapshot);
  return runtime;
}

function buildUseCardBody({ runtime, cardId, operationId }) {
  const snapshot = runtime.getSnapshot();
  const turnIndex = Number(snapshot.cardState && snapshot.cardState.turnIndex) || 0;
  return {
    seatKey: 'black',
    playerKey: 'black',
    baseVersion: runtime.getRoom().stateVersion,
    operationId,
    actionType: 'use_card',
    actor: 'black',
    params: {
      useCardId: cardId,
      useCardOwnerKey: 'black'
    },
    turnIndex,
    action: {
      type: 'use_card',
      playerKey: 'black',
      useCardId: cardId,
      useCardOwnerKey: 'black',
      turnIndex
    }
  };
}

function clonePendingSelectionState(pending) {
  if (!pending || typeof pending !== 'object') return null;
  const out: any = {
    type: pending.type,
    stage: typeof pending.stage === 'string' ? pending.stage : 'selectTarget'
  };
  if (typeof pending.cardId === 'string' && pending.cardId) out.cardId = pending.cardId;
  if (Number.isInteger(pending.sourceHandIndex)) out.sourceHandIndex = pending.sourceHandIndex;
  if (typeof pending.pendingEffectId === 'string' && pending.pendingEffectId) out.pendingEffectId = pending.pendingEffectId;
  if (pending.firstTarget) out.firstTarget = clone(pending.firstTarget);
  if (Array.isArray(pending.selectedTargets)) out.selectedTargets = clone(pending.selectedTargets);
  if (Number.isFinite(Number(pending.selectedCount))) out.selectedCount = Number(pending.selectedCount);
  if (Number.isFinite(Number(pending.maxSelections))) out.maxSelections = Number(pending.maxSelections);
  return out;
}

function pickFirstTarget(fnName) {
  return (gameState, cardState, playerKey) => {
    const fn = (CardLogic as any)[fnName];
    if (typeof fn !== 'function') return null;
    const targets = fn(cardState, gameState, playerKey);
    return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
  };
}

function buildPendingSelectorContext(snapshot, playerKey, pending) {
  return {
    gameState: snapshot.gameState,
    cardState: snapshot.cardState,
    playerKey,
    pending,
    cardLogic: CardLogic,
    getLegalMovesForAction: (gameState, _cardState, key) => Core.getLegalMoves(gameState, key === 'white' ? Core.WHITE : Core.BLACK),
    buildCardDecisionContext: () => null,
    selectors: {
      chooseSwapTarget: pickFirstTarget('getSwapTargets'),
      choosePositionSwapTarget: pickFirstTarget('getPositionSwapTargets'),
      chooseDestroyTarget: pickFirstTarget('getDestroyTargets'),
      chooseStrongWindTarget: pickFirstTarget('getStrongWindTargets'),
      chooseSuperBuoyancyTarget: pickFirstTarget('getSuperBuoyancyTargets'),
      chooseSuperGravityTarget: pickFirstTarget('getSuperGravityTargets'),
      chooseTemptTarget: pickFirstTarget('getTemptWillTargets'),
      chooseCaptureTarget: pickFirstTarget('getCaptureWillTargets'),
      chooseTimeBombTarget: pickFirstTarget('getTimeBombTargets'),
      chooseGuardTarget: pickFirstTarget('getGuardTargets'),
      chooseLivingWillTarget: pickFirstTarget('getLivingWillTargets'),
      chooseBoardExpansionTarget: pending && pending.type === 'BOARD_EXPANSION_GOD'
        ? pickFirstTarget('getBoardExpansionGodTargets')
        : pickFirstTarget('getBoardExpansionTargets'),
      chooseBoardShrinkTarget: pending && pending.type === 'BOARD_SHRINK_GOD'
        ? pickFirstTarget('getBoardShrinkGodTargets')
        : pickFirstTarget('getBoardShrinkTargets'),
      chooseBlockadeTarget: pickFirstTarget('getBlockadeTargets'),
      chooseMeteorTarget: pickFirstTarget('getMeteorTargets'),
      chooseFreezeTarget: pickFirstTarget('getFreezeTargets'),
      chooseSeedTarget: pickFirstTarget('getSeedTargets'),
      chooseTrapTarget: pickFirstTarget('getTrapTargets'),
      chooseCloneTarget: pickFirstTarget('getCloneTargets'),
      chooseHyperactiveInheritTarget: pickFirstTarget('getHyperactiveInheritTargets'),
      chooseTeleportTarget: pickFirstTarget('getTeleportTargets'),
      chooseCellTeleportTarget: pickFirstTarget('getCellTeleportTargets'),
      chooseExtendLifeTarget: pickFirstTarget('getExtendLifeTargets'),
      chooseCorrosionTarget: pickFirstTarget('getCorrosionTargets')
    }
  };
}

function buildPendingFollowupBody({ runtime, action, pending, operationId }) {
  const snapshot = runtime.getSnapshot();
  const turnIndex = Number(snapshot.cardState && snapshot.cardState.turnIndex) || 0;
  const pendingSelectionState = clonePendingSelectionState(pending);
  const normalizedAction = Object.assign({}, action, {
    playerKey: 'black',
    player: 'black',
    pendingSelectionState,
    turnIndex
  });
  if (pending && pending.cardId) {
    normalizedAction.useCardId = pending.cardId;
    normalizedAction.useCardOwnerKey = 'black';
  }
  const params = Object.assign({}, normalizedAction);
  delete params.type;
  delete params.playerKey;
  delete params.actionId;
  delete params.turnIndex;
  return {
    seatKey: 'black',
    playerKey: 'black',
    baseVersion: runtime.getRoom().stateVersion,
    operationId,
    actionType: normalizedAction.type || 'place',
    actor: 'black',
    params,
    turnIndex,
    action: normalizedAction
  };
}

function normalizePublicSnapshotForParity(snapshot) {
  const shot = clone(snapshot);
  delete shot.updatedAt;
  delete shot.stateVersion;
  if (shot._meta) {
    delete shot._meta.projectedSnapshotHash;
  }
  return shot;
}

function normalizePlaybackSummary(events) {
  return (Array.isArray(events) ? events : []).map((event) => ({
    type: event && event.type ? event.type : null,
    phase: Number.isFinite(Number(event && event.phase)) ? Number(event.phase) : null,
    rawType: event && event.rawType ? event.rawType : null,
    targets: Array.isArray(event && event.targets)
      ? event.targets.map((target) => ({
        r: Number.isInteger(target.r) ? target.r : null,
        row: Number.isInteger(target.row) ? target.row : null,
        col: Number.isInteger(target.col) ? target.col : null,
        player: target.player || null,
        owner: target.owner || null,
        ownerBefore: target.ownerBefore || null,
        ownerAfter: target.ownerAfter || null
      }))
      : []
  }));
}

function classifyNetworkFailurePattern(cardType) {
  const type = String(cardType || '').trim().toUpperCase();
  if ([
    'DESTROY_ONE_STONE',
    'SWAP_WITH_ENEMY',
    'CONDEMN_WILL',
    'HEAVEN_BLESSING',
    'BOARD_EXPANSION_GOD',
    'BOARD_SHRINK_GOD'
  ].includes(type)) return 'pending selection';
  if (['METEOR_WILL', 'BOARD_SHRINK_WILL', 'BOARD_SHRINK_GOD', 'TRAP_WILL'].includes(type)) return 'placement effect';
  if (['GLUTTONOUS_WILL', 'DESTROY_DRAGON_WILL', 'LIGHTNING_WILL'].includes(type)) return 'turn-start/random effect';
  if (['REVEAL_HAND_WILL', 'CONDEMN_WILL'].includes(type)) return 'hidden information / projection';
  return 'catalog command parity';
}

function getPendingEffectId(snapshot, playerKey = 'black') {
  const pending = snapshot
    && snapshot.cardState
    && snapshot.cardState.pendingEffectByPlayer
    && snapshot.cardState.pendingEffectByPlayer[playerKey];
  return pending && pending.pendingEffectId ? String(pending.pendingEffectId) : null;
}

function pushParityMismatch(mismatches, card, field, details = {}) {
  mismatches.push(Object.assign({
    pattern: classifyNetworkFailurePattern(card && card.type),
    cardId: card && card.id,
    type: card && card.type,
    field
  }, details));
}

async function createPatchedServerRoom(snapshot, stateVersion, seed = 17) {
  const server = createLocalMatchServer();
  const port = await listen(server);
  const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'black' });
  expect(created.status).toBe(200);
  const joined = await requestJson(port, 'POST', '/api/match/join', {
    roomId: created.data.roomId,
    playerName: 'white'
  });
  expect(joined.status).toBe(200);
  const patched = patchRoomSnapshotForTests(created.data.roomId, (room) => {
    room.seed = seed;
    room.snapshot = clone(snapshot);
    room.snapshot.stateVersion = stateVersion;
    room.stateVersion = stateVersion;
    room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    room.lastAcceptedOperationBySeat = { black: null, white: null };
    room.acceptedOperationHistoryBySeat = { black: [], white: [] };
    room.roomBoardConfig = snapshot && snapshot.gameState ? snapshot.gameState.boardConfig || null : null;
  });
  expect(patched).toBe(true);
  return {
    server,
    port,
    roomId: created.data.roomId,
    blackToken: created.data.seatToken,
    whiteToken: joined.data.seatToken
  };
}

describe('local match runtime parity', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('catalog closed-world input contains one unique card type per card id', () => {
    const cards = Array.isArray((CardCatalog as any).cards) ? (CardCatalog as any).cards : [];
    const ids = new Set(cards.map((card) => card.id));
    const types = new Set(cards.map((card) => card.type));
    expect(cards).toHaveLength(87);
    expect(ids.size).toBe(cards.length);
    expect(types.size).toBe(cards.length);
  });

  test('place command result matches local match server public projection and playback summary', async () => {
    const runtime = LocalMatchRuntime.createRuntime({ seed: 17 });
    const initialSnapshot = runtime.getSnapshot();
    const initialVersion = runtime.getRoom().stateVersion;
    const action = pickFirstLegalAction(initialSnapshot);
    const body = buildPublishBody({
      snapshot: initialSnapshot,
      stateVersion: initialVersion,
      action,
      operationId: 'op_local_runtime_place_1'
    });

    const localResult = runtime.applyCommand(body);
    expect(localResult.ok).toBe(true);

    const room = await createPatchedServerRoom(initialSnapshot, initialVersion, 17);
    try {
      const seatToken = action.playerKey === 'white' ? room.whiteToken : room.blackToken;
      const serverResult = await requestJson(room.port, 'POST', '/api/match/publish', {
        ...body,
        roomId: room.roomId,
        seatToken
      });
      expect(serverResult.status).toBe(200);
      expect(serverResult.data.ok).toBe(true);
      expect(serverResult.data.stateVersion).toBe(localResult.stateVersion);

      const localPublic = MatchAuthority.buildPublicSnapshot(runtime.getRoom(), action.playerKey);
      expect(normalizePublicSnapshotForParity(serverResult.data.snapshot))
        .toEqual(normalizePublicSnapshotForParity(localPublic));
      expect(normalizePlaybackSummary(serverResult.data.playbackEvents))
        .toEqual(normalizePlaybackSummary(localResult.playbackEvents));
      expect(serverResult.data.effectLogs).toEqual(localResult.effectLogs);
    } finally {
      await closeServer(room.server);
    }
  });

  test('version rejection and idempotent replay follow the network publish contract shape', () => {
    const runtime = LocalMatchRuntime.createRuntime({ seed: 19 });
    const snapshot = runtime.getSnapshot();
    const action = pickFirstLegalAction(snapshot);
    const staleBody = buildPublishBody({
      snapshot,
      stateVersion: runtime.getRoom().stateVersion + 1,
      action,
      operationId: 'op_local_runtime_version_1'
    });
    const rejected = runtime.applyCommand(staleBody);
    expect(rejected.ok).toBe(false);
    expect(rejected.rejectedReason).toBe('VERSION_BEHIND');
    expect(rejected.publishMeta).toEqual(expect.objectContaining({
      kind: 'rejected',
      operationId: 'op_local_runtime_version_1',
      rejectedReason: 'VERSION_BEHIND'
    }));

    const acceptedBody = buildPublishBody({
      snapshot,
      stateVersion: runtime.getRoom().stateVersion,
      action,
      operationId: 'op_local_runtime_replay_1'
    });
    const first = runtime.applyCommand(acceptedBody);
    const second = runtime.applyCommand(acceptedBody);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.idempotentReplay).toBe(true);
    expect(second.stateVersion).toBe(first.stateVersion);
    expect(second.publishMeta).toEqual(expect.objectContaining({
      kind: 'idempotent_replay',
      operationId: 'op_local_runtime_replay_1'
    }));
  });

  test('accepted runtime commands clear transient charge deltas before the next command', () => {
    const runtime = LocalMatchRuntime.createRuntime({ seed: 23 });
    const firstSnapshot = runtime.getSnapshot();
    const firstAction = pickFirstLegalAction(firstSnapshot);
    const first = runtime.applyCommand(buildPublishBody({
      snapshot: firstSnapshot,
      stateVersion: runtime.getRoom().stateVersion,
      action: firstAction,
      operationId: 'op_local_runtime_charge_first'
    }));
    expect(first.ok).toBe(true);
    expect(first.snapshot.cardState.chargeDeltaEvents.length).toBeGreaterThan(0);

    const passSnapshot = runtime.getSnapshot();
    passSnapshot.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK));
    passSnapshot.gameState.currentPlayer = Core.WHITE;
    passSnapshot.gameState.consecutivePasses = 0;
    passSnapshot.cardState.pendingEffectByPlayer.white = null;
    passSnapshot.cardState.selectedCardId = null;
    passSnapshot.cardState.selectedCardOwnerKey = null;
    passSnapshot.cardState.debugNoDraw = true;

    const pass = runtime.applyCommand({
      seatKey: 'white',
      playerKey: 'white',
      baseVersion: runtime.getRoom().stateVersion,
      operationId: 'op_local_runtime_charge_pass',
      actionType: 'pass',
      actor: 'white',
      params: {},
      turnIndex: Number(passSnapshot.cardState.turnIndex) || 0,
      action: {
        type: 'pass',
        playerKey: 'white',
        turnIndex: Number(passSnapshot.cardState.turnIndex) || 0
      }
    });

    expect(pass.ok).toBe(true);
    expect(pass.snapshot.cardState.chargeDeltaEvents).toEqual([]);
    expect(runtime.getSnapshot().cardState.chargeDeltaEvents).toEqual([]);
  });

  test('all catalog card-use commands match local match server acceptance and public projection', async () => {
    const cards = Array.isArray((CardCatalog as any).cards) ? (CardCatalog as any).cards : [];
    const mismatches: any[] = [];

    for (const card of cards) {
      const runtime = createCardUseRuntime(card.id, 31);
      const initialSnapshot = runtime.getSnapshot();
      const initialVersion = runtime.getRoom().stateVersion;
      const body = buildUseCardBody({
        runtime,
        cardId: card.id,
        operationId: `op_card_use_${card.id}`
      });
      const localResult = runtime.applyCommand(body);
      const room = await createPatchedServerRoom(initialSnapshot, initialVersion, 31);
      try {
        const serverResult = await requestJson(room.port, 'POST', '/api/match/publish', {
          ...body,
          roomId: room.roomId,
          seatToken: room.blackToken
        });
        const serverOk = serverResult.status === 200 && serverResult.data && serverResult.data.ok === true;
        if (serverOk !== (localResult.ok === true)) {
          pushParityMismatch(mismatches, card, 'ok', {
            stateVersion: initialVersion,
            pendingEffectId: getPendingEffectId(initialSnapshot),
            local: localResult.ok,
            serverStatus: serverResult.status,
            serverOk
          });
          continue;
        }
        if (!serverOk) {
          const serverReason = serverResult.data && serverResult.data.rejectedReason;
          if (serverReason !== localResult.rejectedReason) {
            pushParityMismatch(mismatches, card, 'rejectedReason', {
              stateVersion: initialVersion,
              pendingEffectId: getPendingEffectId(initialSnapshot),
              local: localResult.rejectedReason,
              server: serverReason
            });
          }
          continue;
        }

        const localPublic = MatchAuthority.buildPublicSnapshot(runtime.getRoom(), 'black');
        const serverSnapshot = normalizePublicSnapshotForParity(serverResult.data.snapshot);
        const localSnapshot = normalizePublicSnapshotForParity(localPublic);
        if (JSON.stringify(serverSnapshot) !== JSON.stringify(localSnapshot)) {
          pushParityMismatch(mismatches, card, 'snapshot', {
            stateVersion: serverResult.data.stateVersion,
            pendingEffectId: getPendingEffectId(serverResult.data.snapshot)
          });
        }
        const serverPlayback = normalizePlaybackSummary(serverResult.data.playbackEvents);
        const localPlayback = normalizePlaybackSummary(localResult.playbackEvents);
        if (JSON.stringify(serverPlayback) !== JSON.stringify(localPlayback)) {
          pushParityMismatch(mismatches, card, 'playback', {
            stateVersion: serverResult.data.stateVersion,
            pendingEffectId: getPendingEffectId(serverResult.data.snapshot)
          });
        }
        if (JSON.stringify(serverResult.data.effectLogs || []) !== JSON.stringify(localResult.effectLogs || [])) {
          pushParityMismatch(mismatches, card, 'effectLogs', {
            stateVersion: serverResult.data.stateVersion,
            pendingEffectId: getPendingEffectId(serverResult.data.snapshot)
          });
        }
      } finally {
        await closeServer(room.server);
      }
    }

    expect(mismatches).toEqual([]);
  }, 120000);

  test('pending card follow-up commands match local match server public projection and playback summary', async () => {
    const cards = Array.isArray((CardCatalog as any).cards) ? (CardCatalog as any).cards : [];
    const mismatches: any[] = [];
    const coveredPendingTypes = new Set<string>();

    for (const card of cards) {
      const runtime = createCardUseRuntime(card.id, 37);
      if (card.type === 'CONDEMN_WILL') {
        runtime.getRoom().snapshot.cardState.hands.white = ['silver_stone', 'gold_stone'];
      }
      const initialSnapshot = runtime.getSnapshot();
      const initialVersion = runtime.getRoom().stateVersion;
      const useBody = buildUseCardBody({
        runtime,
        cardId: card.id,
        operationId: `op_pending_use_${card.id}`
      });
      const localUseResult = runtime.applyCommand(useBody);
      if (!localUseResult.ok) continue;
      const pending = runtime.getSnapshot().cardState.pendingEffectByPlayer.black;
      if (!pending || !pending.type) continue;

      const followupAction = pending.type === 'HEAVEN_BLESSING'
        ? { type: 'place', heavenBlessingCardId: pending.offers[0] }
        : (pending.type === 'CONDEMN_WILL'
          ? { type: 'place', condemnTargetIndex: pending.offers[0].handIndex }
          : PendingTargetSelector.buildPendingSelectionAction(
            buildPendingSelectorContext(runtime.getSnapshot(), 'black', pending)
          ));
      if (!followupAction || followupAction.type === 'cancel_card') continue;

      const followupBody = buildPendingFollowupBody({
        runtime,
        action: followupAction,
        pending,
        operationId: `op_pending_follow_${card.id}`
      });
      const localFollowResult = runtime.applyCommand(followupBody);

      const room = await createPatchedServerRoom(initialSnapshot, initialVersion, 37);
      try {
        const serverUseResult = await requestJson(room.port, 'POST', '/api/match/publish', {
          ...useBody,
          roomId: room.roomId,
          seatToken: room.blackToken
        });
        expect(serverUseResult.status).toBe(200);
        const serverFollowResult = await requestJson(room.port, 'POST', '/api/match/publish', {
          ...followupBody,
          roomId: room.roomId,
          seatToken: room.blackToken,
          baseVersion: serverUseResult.data.stateVersion
        });

        const serverOk = serverFollowResult.status === 200 && serverFollowResult.data && serverFollowResult.data.ok === true;
        if (serverOk !== (localFollowResult.ok === true)) {
          pushParityMismatch(mismatches, card, 'ok', {
            pendingType: pending.type,
            stateVersion: runtime.getRoom().stateVersion,
            pendingEffectId: pending.pendingEffectId || null,
            local: localFollowResult.ok,
            serverStatus: serverFollowResult.status,
            serverOk
          });
          continue;
        }
        if (!serverOk) continue;
        coveredPendingTypes.add(String(pending.type));

        const localPublic = MatchAuthority.buildPublicSnapshot(runtime.getRoom(), 'black');
        const serverSnapshot = normalizePublicSnapshotForParity(serverFollowResult.data.snapshot);
        const localSnapshot = normalizePublicSnapshotForParity(localPublic);
        if (JSON.stringify(serverSnapshot) !== JSON.stringify(localSnapshot)) {
          pushParityMismatch(mismatches, card, 'snapshot', {
            pendingType: pending.type,
            stateVersion: serverFollowResult.data.stateVersion,
            pendingEffectId: pending.pendingEffectId || null
          });
        }
        const serverPlayback = normalizePlaybackSummary(serverFollowResult.data.playbackEvents);
        const localPlayback = normalizePlaybackSummary(localFollowResult.playbackEvents);
        if (JSON.stringify(serverPlayback) !== JSON.stringify(localPlayback)) {
          pushParityMismatch(mismatches, card, 'playback', {
            pendingType: pending.type,
            stateVersion: serverFollowResult.data.stateVersion,
            pendingEffectId: pending.pendingEffectId || null
          });
        }
        if (JSON.stringify(serverFollowResult.data.effectLogs || []) !== JSON.stringify(localFollowResult.effectLogs || [])) {
          pushParityMismatch(mismatches, card, 'effectLogs', {
            pendingType: pending.type,
            stateVersion: serverFollowResult.data.stateVersion,
            pendingEffectId: pending.pendingEffectId || null
          });
        }
      } finally {
        await closeServer(room.server);
      }
    }

    expect(mismatches).toEqual([]);
    expect(Array.from(coveredPendingTypes).sort()).toEqual(expect.arrayContaining([
      'CONDEMN_WILL',
      'BOARD_EXPANSION_GOD',
      'BOARD_SHRINK_GOD'
    ]));
    expect(coveredPendingTypes.size).toBeGreaterThanOrEqual(8);
  }, 120000);
});
