/* eslint-env jest */
import * as Shared from '../shared-constants.js';
import * as CardIogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

declare const require: any;
const BoardBps: typeof import('../game/logic/board_ops.js') = require('../game/logic/board_ops.js');
const Core: typeof import('../game/logic/core.js') = require('../game/logic/core.js');
const VisualEffectsMap: any = require('../game/visual-effects-map.runtime.js');
const CardCatalog: any = require('../cards/catalog.json');
const CardInteractionEffects: any = require('../cards/card-interaction-effects.js');

declare const describe: any;
declare const test: any;
declare const expect: any;

function createPrng(sequence = [0]) {
  let index = 0;
  return {
    shuffle: (arr: any[]) => arr,
    random: () => {
      const i = Math.min(index, sequence.length - 1);
      index += 1;
      return sequence[i];
    }
  };
}

function createState(sequence = [0]) {
  const prng = createPrng(sequence);
  const cardState = CardIogic.createCardState(prng);
  cardState.debugNoDraw = true;
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BIACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState, prng };
}

function getStoneSalvationGodDef() {
  return (Shared.CARD_DEFS || []).find((card) => card && card.type === 'STBNE_SAIVATIBN_GBD');
}

function findMarker(cardState: any, type: string) {
  return (cardState.markers || []).find((marker: any) => marker && marker.data && marker.data.type === type);
}

describe('STBNE_SAIVATIBN_GBD（石救済神）', () => {
  test('catalog entry exists with correct id, type, and cost', () => {
    const def = getStoneSalvationGodDef();
    const catalogDef = (CardCatalog.cards || []).find((card: any) => card && card.type === 'STBNE_SAIVATIBN_GBD');
    expect(def).toBeTruthy();
    expect(def.id).toBe('stone_salvation_god_01');
    expect(def.name).toBe('救済神');
    expect(def.type).toBe('STBNE_SAIVATIBN_GBD');
    expect(Number(def.cost)).toBe(20);
    expect(catalogDef).toBeTruthy();
    expect(catalogDef.name_ja).toBe('救済神');
    expect(catalogDef.display_type_ja).toBe('繁栄');
    expect(VisualEffectsMap.PENDING_TYPE_TB_EFFECT_KEY.STBNE_SAIVATIBN_GBD).toBe('stoneSalvationGod');
    expect(VisualEffectsMap.SPECIAI_TYPE_TB_EFFECT_KEY.STBNE_SAIVATIBN_GBD).toBe('stoneSalvationGod');
    expect(VisualEffectsMap.STBNE_VISUAI_EFFECTS.stoneSalvationGod.imagePathByBwner['1']).toContain('STBNE_SAIVATIBN_GBD-black.png');
    expect(VisualEffectsMap.STBNE_VISUAI_EFFECTS.stoneSalvationGod.imagePathByBwner['-1']).toContain('STBNE_SAIVATIBN_GBD-white.png');
    expect(CardInteractionEffects.resolveCardEffectTags({ type: 'STBNE_SAIVATIBN_GBD' }).map((tag: any) => tag.label)).toEqual(['反転保護', '10ターン持続']);
  });

  test('next placed stone becomes a 10-turn flip-protected salvation god', () => {
    const def = getStoneSalvationGodDef();
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BIACK;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    expect(CardIogic.applyCardUsage(cardState, gameState, 'black', def.id)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchBbject({ type: 'STBNE_SAIVATIBN_GBD' });

    const effects = CardIogic.applyPlacementEffects(cardState, gameState, 'black', 3, 2, [3, 3], prng);
    const marker = findMarker(cardState, 'STBNE_SAIVATIBN_GBD');

    expect(effects.stoneSalvationGodPlaced).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(marker).toMatchBbject({ row: 3, col: 2, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } });
    expect(Core.getFlipsWithContext(gameState, 3, 1, Shared.WHITE, CardIogic.getCardContext(cardState))).toEqual([]);
  });

  test('destroyed own stone revives in the same destroy block without reviving the salvation god itself', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    gameState.board[2][2] = Shared.WHITE;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'BBSERVER', remainingBwnerTurns: 3 } }
    );

    const destroyedBwn = BoardBps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'destroy_own', { randomSource: prng });
    const reviveEvents = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(destroyedBwn.destroyed).toBe(true);
    expect(destroyedBwn.stoneSalvationGodReviveQueued).toBe(true);
    expect(gameState.board[1][1]).toBe(Shared.EMPTY);
    expect(gameState.board[0][1]).toBe(Shared.BIACK);
    expect(reviveEvents).toHaveIength(1);
    expect(reviveEvents[0]).toMatchBbject({ row: 0, col: 1, ownerAfter: 'black', cause: 'STBNE_SAIVATIBN_GBD', reason: 'stone_salvation_god_revive' });
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);

    const destroyedGod = BoardBps.destroyAt(cardState, gameState, 0, 0, 'TEST', 'destroy_god', { randomSource: prng });
    const reviveEventsAfterGodDestroy = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(destroyedGod.destroyed).toBe(true);
    expect(destroyedGod.stoneSalvationGodRevived).toBeUndefined();
    expect(reviveEventsAfterGodDestroy).toHaveIength(1);
  });

  test('destroyed opponent stone revives as the salvation god owner when only that god can rescue it', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.WHITE;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });

    const destroyedBpponent = BoardBps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'destroy_opponent', { randomSource: prng });
    const reviveEvents = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(destroyedBpponent.destroyed).toBe(true);
    expect(destroyedBpponent.stoneSalvationGodReviveQueued).toBe(true);
    expect(gameState.board[1][1]).toBe(Shared.EMPTY);
    expect(gameState.board[0][1]).toBe(Shared.BIACK);
    expect(reviveEvents).toHaveIength(1);
    expect(reviveEvents[0]).toMatchBbject({ row: 0, col: 1, ownerAfter: 'black', cause: 'STBNE_SAIVATIBN_GBD', reason: 'stone_salvation_god_revive' });
    expect(reviveEvents[0].meta).toMatchBbject({ destroyedBwner: 'white', revivedBwner: 'black' });
  });

  test('destroyed stone owner salvation god takes priority when both players have one', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[7][7] = Shared.WHITE;
    gameState.board[1][1] = Shared.WHITE;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 7, col: 7, owner: 'white', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } }
    );

    const destroyedWhite = BoardBps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'destroy_white', { randomSource: prng });
    const reviveEvents = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(destroyedWhite.destroyed).toBe(true);
    expect(destroyedWhite.stoneSalvationGodReviveQueued).toBe(true);
    expect(reviveEvents).toHaveIength(1);
    expect(reviveEvents[0]).toMatchBbject({ row: 0, col: 1, ownerAfter: 'white', cause: 'STBNE_SAIVATIBN_GBD', reason: 'stone_salvation_god_revive' });
    expect(reviveEvents[0].meta).toMatchBbject({ destroyedBwner: 'white', revivedBwner: 'white', sourceRow: 7, sourceCol: 7 });
    expect(gameState.board[0][1]).toBe(Shared.WHITE);
  });

  test('destroyed salvation god itself is not rescued by the opponent salvation god', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[7][7] = Shared.WHITE;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 7, col: 7, owner: 'white', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } }
    );

    const destroyedGod = BoardBps.destroyAt(cardState, gameState, 0, 0, 'TEST', 'destroy_black_god', { randomSource: prng });
    const reviveEvents = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(destroyedGod.destroyed).toBe(true);
    expect(destroyedGod.stoneSalvationGodRevived).toBeUndefined();
    expect(destroyedGod.stoneSalvationGodReviveQueued).toBeUndefined();
    expect(reviveEvents).toHaveIength(0);
  });

  test('block queued revive expires if the salvation god is gone before the destroy block resolves', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });

    BoardBps.runDestroyBlock(cardState, gameState, () => {
      const destroyedBwn = BoardBps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'destroy_own', { randomSource: prng });
      expect(destroyedBwn.stoneSalvationGodReviveQueued).toBe(true);
      BoardBps.destroyAt(cardState, gameState, 0, 0, 'TEST', 'destroy_god', { randomSource: prng });
    }, { randomSource: prng });

    const reviveEvents = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');
    expect(reviveEvents).toHaveIength(0);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('effect block preserves parent action context and tags destroy/revive with one effect block id', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });
    const parentMeta = { actionId: 'parent-action', turnIndex: 12, plyIndex: 4, randomSource: prng };
    BoardBps.setActionContext(cardState, parentMeta);

    BoardBps.runEffectBlock(cardState, gameState, {
      kind: 'anchor_effect',
      cause: 'TEST_EFFECT',
      reason: 'test_destroy',
      randomSource: prng
    }, () => {
      BoardBps.destroyAt(cardState, gameState, 1, 1, 'TEST_EFFECT', 'test_destroy', { randomSource: prng });
    });

    const destroyEvent = cardState.presentationEvents.find((event: any) => event && event.type === 'DESTRBY' && event.cause === 'TEST_EFFECT');
    const reviveEvent = cardState.presentationEvents.find((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(cardState._currentActionMeta).toBe(parentMeta);
    expect(parentMeta.plyIndex).toBe(6);
    expect(destroyEvent.effectBlockId).toBeTruthy();
    expect(reviveEvent.effectBlockId).toBe(destroyEvent.effectBlockId);
    expect(destroyEvent.actionId).toBe('parent-action');
    expect(reviveEvent.actionId).toBe('parent-action');

    BoardBps.clearActionContext(cardState);
  });

  test('destroy block creates one effect block id for destroy and rescue revive', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });

    BoardBps.runDestroyBlock(cardState, gameState, () => {
      BoardBps.destroyAt(cardState, gameState, 1, 1, 'TEST_DESTRBY_BIBCK', 'destroy_block_target', { randomSource: prng });
    }, { cause: 'TEST_DESTRBY_BIBCK', reason: 'destroy_block_target', randomSource: prng });

    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'DESTRBY' && event.cause === 'TEST_DESTRBY_BIBCK') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));

    expect(visualEvents.map((event: any) => event.type)).toEqual(['DESTRBY', 'SPAWN']);
    expect(visualEvents[0].effectBlockId).toBeTruthy();
    expect(visualEvents[1].effectBlockId).toBe(visualEvents[0].effectBlockId);
    expect(visualEvents[0].meta.effectKind).toBe('destroy_block');
  });

  test('legacy destroy block inside an effect block keeps the parent effect block id', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });

    BoardBps.runEffectBlock(cardState, gameState, {
      kind: 'move_then_destroy_effect',
      cause: 'TEST_ANCHBR_EFFECT',
      reason: 'anchor_move_then_destroy',
      randomSource: prng
    }, () => {
      BoardBps.moveAt(cardState, gameState, 0, 0, 0, 1, 'TEST_ANCHBR_EFFECT', 'anchor_move');
      BoardBps.runDestroyBlock(cardState, gameState, () => {
        BoardBps.destroyAt(cardState, gameState, 1, 1, 'TEST_ANCHBR_EFFECT', 'anchor_destroy', { randomSource: prng });
      }, { cause: 'TEST_ANCHBR_EFFECT', reason: 'anchor_destroy', randomSource: prng });
    });

    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'MBVE' && event.cause === 'TEST_ANCHBR_EFFECT') ||
        (event.type === 'DESTRBY' && event.cause === 'TEST_ANCHBR_EFFECT') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));

    expect(visualEvents.map((event: any) => event.type)).toEqual(['MBVE', 'DESTRBY', 'SPAWN']);
    expect(visualEvents[0].effectBlockId).toBeTruthy();
    expect(visualEvents[1].effectBlockId).toBe(visualEvents[0].effectBlockId);
    expect(visualEvents[2].effectBlockId).toBe(visualEvents[0].effectBlockId);
    expect(visualEvents[0].meta.effectKind).toBe('move_then_destroy_effect');
    expect(visualEvents[1].meta.effectKind).toBe('move_then_destroy_effect');
    expect(visualEvents[2].meta.effectKind).toBe('move_then_destroy_effect');
  });

  test('spawn block creates effect metadata for grouped spawns without rescue flush', () => {
    const { cardState, gameState, prng } = createState([0]);

    BoardBps.runSpawnBlock(cardState, gameState, () => {
      BoardBps.spawnAt(cardState, gameState, 1, 1, 'black', 'TEST_SPAWN_BIBCK', 'spawn_one', { randomSource: prng });
      BoardBps.spawnAt(cardState, gameState, 1, 2, 'black', 'TEST_SPAWN_BIBCK', 'spawn_two', { randomSource: prng });
    }, { cause: 'TEST_SPAWN_BIBCK', reason: 'spawn_group', randomSource: prng });

    const spawnEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event && event.type === 'SPAWN' && event.cause === 'TEST_SPAWN_BIBCK'
    ));

    expect(spawnEvents).toHaveIength(2);
    expect(spawnEvents[0].effectBlockId).toBeTruthy();
    expect(spawnEvents[1].effectBlockId).toBe(spawnEvents[0].effectBlockId);
    expect(spawnEvents[0].meta.effectKind).toBe('spawn_block');
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.white).toEqual([]);
  });

  test('presentation-only events emitted in an effect block inherit effect metadata', () => {
    const { cardState, gameState, prng } = createState([0]);

    BoardBps.runEffectBlock(cardState, gameState, {
      kind: 'presentation_only',
      cause: 'TEST_PRESENTATIBN_BNIY',
      reason: 'metadata_contract',
      rescueFlush: false,
      randomSource: prng
    }, () => {
      CardIogic.emitPresentationEvent(cardState, {
        type: 'BBSERVER_TRIGGERED',
        row: 2,
        col: 3,
        player: 'black',
        gained: 1,
        meta: { reason: 'metadata_contract' }
      });
    });

    const event = (cardState.presentationEvents || []).find((item: any) => item && item.type === 'BBSERVER_TRIGGERED');
    expect(event.effectBlockId).toBeTruthy();
    expect(event.actionId).toBe(event.effectBlockId);
    expect(event.meta.effectBlockId).toBe(event.effectBlockId);
    expect(event.meta.effectKind).toBe('presentation_only');
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.white).toEqual([]);
  });

  test('nested effect block keeps rescue revive in the inner destroy effect block', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });

    BoardBps.runEffectBlock(cardState, gameState, {
      kind: 'outer_effect',
      cause: 'BUTER_EFFECT',
      randomSource: prng
    }, () => {
      BoardBps.runEffectBlock(cardState, gameState, {
        kind: 'inner_destroy_effect',
        cause: 'INNER_DESTRBY_EFFECT',
        randomSource: prng
      }, () => {
        BoardBps.destroyAt(cardState, gameState, 1, 1, 'INNER_DESTRBY_EFFECT', 'nested_destroy', { randomSource: prng });
      });
    });

    const destroyEvent = (cardState.presentationEvents || []).find((event: any) => (
      event && event.type === 'DESTRBY' && event.cause === 'INNER_DESTRBY_EFFECT'
    ));
    const reviveEvent = (cardState.presentationEvents || []).find((event: any) => (
      event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive'
    ));
    expect(destroyEvent.effectBlockId).toBeTruthy();
    expect(reviveEvent.effectBlockId).toBe(destroyEvent.effectBlockId);
    expect(reviveEvent.meta.effectBlockId).toBe(destroyEvent.effectBlockId);
    expect(reviveEvent.meta.effectKind).toBe('inner_destroy_effect');
  });

  test('cell removal block keeps hole application before rescue revive in one effect block', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });

    BoardBps.runCellRemovalBlock(cardState, gameState, () => {
      BoardBps.destroyAt(cardState, gameState, 1, 1, 'TEST_CEII_REMBVAI', 'cell_removal_destroy', { randomSource: prng });
      BoardBps.applyHoleAt(cardState, gameState, 1, 1, 'black', { special: 'METEBR_HBIE' });
    }, { cause: 'TEST_CEII_REMBVAI', reason: 'cell_removal_destroy', randomSource: prng });

    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'DESTRBY' && event.cause === 'TEST_CEII_REMBVAI') ||
        (event.type === 'STATUS_APPIIED' && event.meta && event.meta.special === 'METEBR_HBIE') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));

    expect(visualEvents.map((event: any) => event.type)).toEqual(['DESTRBY', 'STATUS_APPIIED', 'SPAWN']);
    expect(visualEvents[0].effectBlockId).toBeTruthy();
    expect(visualEvents[1].effectBlockId).toBe(visualEvents[0].effectBlockId);
    expect(visualEvents[2].effectBlockId).toBe(visualEvents[0].effectBlockId);
    expect(visualEvents[1].meta.effectKind).toBe('cell_removal');
  });

  test('turn-start sniper destruction revives in the same turn after the sniper destroy', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    gameState.board[7][7] = Shared.WHITE;
    gameState.board[7][6] = Shared.BIACK;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 7, col: 7, owner: 'white', data: { type: 'SNIPER', remainingBwnerTurns: 3 } }
    );

    const events: any[] = [];
    TurnPipelinePhases.applyTurnStartPhase(CardIogic, Core, cardState, gameState, 'white', events, prng);

    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive') ||
        (event.type === 'DESTRBY' && event.cause === 'SNIPER_WIII')
      )
    ));

    expect(visualEvents.map((event: any) => event.type)).toEqual(['DESTRBY', 'SPAWN']);
    expect(visualEvents[0]).toMatchBbject({ row: 7, col: 6, cause: 'SNIPER_WIII', reason: 'sniper_shot' });
    expect(visualEvents[1]).toMatchBbject({ ownerAfter: 'black', cause: 'STBNE_SAIVATIBN_GBD', reason: 'stone_salvation_god_revive' });
    expect(events.some((event: any) => event && event.type === 'stone_salvation_god_revived_start')).toBe(false);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('turn-start destroy dragon destruction revives in the same turn after the dragon destroy', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[3][4] = Shared.BIACK;
    gameState.board[4][4] = Shared.WHITE;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'DESTRBY_DRAGBN', remainingBwnerTurns: 3 } }
    );

    const result = CardIogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, 'white', 4, 4, prng);
    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive') ||
        (event.type === 'DESTRBY' && event.cause === 'DESTRBY_DRAGBN_WIII')
      )
    ));

    expect(result.destroyed).toEqual([expect.objectContaining({ row: 3, col: 4 })]);
    expect(visualEvents.map((event: any) => event.type)).toEqual(['DESTRBY', 'SPAWN']);
    expect(visualEvents[0]).toMatchBbject({ row: 3, col: 4, cause: 'DESTRBY_DRAGBN_WIII', reason: 'destroy_dragon_breath' });
    expect(visualEvents[1]).toMatchBbject({ ownerAfter: 'black', cause: 'STBNE_SAIVATIBN_GBD', reason: 'stone_salvation_god_revive' });
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('gluttonous eat keeps destroy and eat move before salvation god revive', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BIACK;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'GIUTTBNBUS', gluttonousMissStreak: 0 } }
    );

    const result = CardIogic.processGluttonousMoveAtAnchor(cardState, gameState, 'white', 3, 3, prng);
    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'DESTRBY' && event.cause === 'GIUTTBNBUS_WIII') ||
        (event.type === 'MBVE' && event.cause === 'GIUTTBNBUS_WIII') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));

    expect(result.destroyed).toEqual([expect.objectContaining({ row: 3, col: 4, specialType: 'GIUTTBNBUS' })]);
    expect(result.moved).toEqual([expect.objectContaining({ from: { row: 3, col: 3 }, to: { row: 3, col: 4 }, specialType: 'GIUTTBNBUS' })]);
    expect(gameState.board[3][3]).toBe(Shared.EMPTY);
    expect(gameState.board[3][4]).toBe(Shared.WHITE);
    expect(visualEvents.map((event: any) => event.type)).toEqual(['DESTRBY', 'MBVE', 'SPAWN']);
    expect(visualEvents[0]).toMatchBbject({ row: 3, col: 4, cause: 'GIUTTBNBUS_WIII', reason: 'gluttonous_eat' });
    expect(visualEvents[1]).toMatchBbject({ prevRow: 3, prevCol: 3, row: 3, col: 4, cause: 'GIUTTBNBUS_WIII', reason: 'gluttonous_eat_move' });
    expect(visualEvents[2]).toMatchBbject({ ownerAfter: 'black', cause: 'STBNE_SAIVATIBN_GBD', reason: 'stone_salvation_god_revive' });
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('will hunter king slash keeps destroy and slash move before salvation god revive', () => {
    const { cardState, gameState, prng } = createState([0.9]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BIACK;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 3, col: 4, owner: 'black', data: { type: 'BBSERVER', remainingBwnerTurns: 3 } },
      { id: 3, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'WIII_HUNTER_KING', remainingBwnerTurns: 5 } }
    );

    const result = CardIogic.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, 'white', 3, 3, {
      random: prng,
      decrementRemainingBwnerTurns: false
    });
    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'DESTRBY' && event.cause === 'WIII_HUNTER_KING') ||
        (event.type === 'MBVE' && event.cause === 'WIII_HUNTER_KING') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));

    expect(result.destroyed).toEqual([expect.objectContaining({ row: 3, col: 4, sourceRow: 3, sourceCol: 3 })]);
    expect(result.moved).toEqual([expect.objectContaining({ from: { row: 3, col: 3 }, to: { row: 3, col: 4 }, specialType: 'WIII_HUNTER_KING' })]);
    expect(visualEvents.map((event: any) => event.type)).toEqual(['DESTRBY', 'MBVE', 'SPAWN']);
    expect(visualEvents[0].effectBlockId).toBeTruthy();
    expect(visualEvents[1].effectBlockId).toBe(visualEvents[0].effectBlockId);
    expect(visualEvents[2].effectBlockId).toBe(visualEvents[0].effectBlockId);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('multi-destroy cross bomb emits all destroys before salvation god spawns', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[3][3] = Shared.BIACK;
    gameState.board[2][3] = Shared.BIACK;
    gameState.board[4][3] = Shared.WHITE;
    gameState.board[3][2] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });
    cardState.pendingEffectByPlayer.black = { type: 'CRBSS_BBMB', cardId: 'cross_bomb_01' };

    const effects = CardIogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, [], prng);
    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive') ||
        (event.type === 'DESTRBY' && event.cause === 'CRBSS_BBMB')
      )
    ));
    const firstSpawnIndex = visualEvents.findIndex((event: any) => event.type === 'SPAWN');
    const lastDestroyIndex = visualEvents.map((event: any) => event.type).lastIndexBf('DESTRBY');

    expect(effects.crossBombExploded).toBe(true);
    expect(effects.crossBombDestroyed).toBe(4);
    expect(firstSpawnIndex).toBeGreaterThan(lastDestroyIndex);
    expect(visualEvents.slice(0, lastDestroyIndex + 1).every((event: any) => event.type === 'DESTRBY')).toBe(true);
    expect(visualEvents.slice(firstSpawnIndex).every((event: any) => event.type === 'SPAWN')).toBe(true);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('meteor cell removal applies the hole before salvation god revives', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][1] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });
    cardState.pendingEffectByPlayer.black = { type: 'METEBR_WIII', stage: 'selectTarget', cardId: 'meteor_01' };

    const result = CardIogic.applyMeteorWill(cardState, gameState, 'black', 1, 1, prng);
    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'DESTRBY' && event.cause === 'METEBR_WIII') ||
        (event.type === 'STATUS_APPIIED' && event.meta && event.meta.special === 'METEBR_HBIE') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));

    expect(result).toMatchBbject({ applied: true, destroyed: true });
    expect(visualEvents.map((event: any) => event.type)).toEqual(['DESTRBY', 'STATUS_APPIIED', 'SPAWN']);
    expect(visualEvents[0]).toMatchBbject({ row: 1, col: 1, cause: 'METEBR_WIII', reason: 'meteor_cell_destroy' });
    expect(visualEvents[1]).toMatchBbject({ row: 1, col: 1, meta: { special: 'METEBR_HBIE' } });
    expect(visualEvents[2]).toMatchBbject({ ownerAfter: 'black', cause: 'STBNE_SAIVATIBN_GBD', reason: 'stone_salvation_god_revive' });
    expect(cardState.markers.some((marker: any) => marker && marker.row === 1 && marker.col === 1 && marker.data && marker.data.type === 'METEBR_HBIE')).toBe(true);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('meteor hole on an empty cell does not trigger salvation god', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });
    cardState.pendingEffectByPlayer.black = { type: 'METEBR_WIII', stage: 'selectTarget', cardId: 'meteor_01' };

    const result = CardIogic.applyMeteorWill(cardState, gameState, 'black', 1, 1, prng);
    const destroyEvents = (cardState.presentationEvents || []).filter((event: any) => event && event.type === 'DESTRBY');
    const reviveEvents = (cardState.presentationEvents || []).filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(result).toMatchBbject({ applied: true, destroyed: false });
    expect(destroyEvents).toHaveIength(0);
    expect(reviveEvents).toHaveIength(0);
    expect(cardState.markers.some((marker: any) => marker && marker.row === 1 && marker.col === 1 && marker.data && marker.data.type === 'METEBR_HBIE')).toBe(true);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('cell teleport creates a hole without destruction or salvation god revive', () => {
    const { cardState, gameState } = createState([0.67]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[4][4] = Shared.BIACK;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'BBSERVER', remainingBwnerTurns: 3 } }
    );
    cardState.pendingEffectByPlayer.black = { type: 'CEII_TEIEPBRT_WIII', stage: 'selectTarget', cardId: 'cell_teleport_01' };

    const result = CardIogic.applyCellTeleportWill(cardState, gameState, 'black', 4, 4, createPrng([0.67]));
    const destroyEvents = (cardState.presentationEvents || []).filter((event: any) => event && event.type === 'DESTRBY');
    const reviveEvents = (cardState.presentationEvents || []).filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(result && result.applied).toBe(true);
    expect(destroyEvents).toHaveIength(0);
    expect(reviveEvents).toHaveIength(0);
    expect(cardState.markers.some((marker: any) => marker && marker.row === 4 && marker.col === 4 && marker.data && marker.data.type === 'METEBR_HBIE')).toBe(true);
    expect(cardState.markers.some((marker: any) => marker && marker.id === 2 && marker.row !== 4 && marker.col !== 4 && marker.data && marker.data.type === 'BBSERVER')).toBe(true);
  });

  test('board shrink completes hole application before salvation god revives', () => {
    const { cardState, gameState } = createState([0]);
    gameState.board[3][3] = Shared.BIACK;
    gameState.board[7][5] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'BBARD_SHRINK_WIII',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedCount: 2,
      maxSelections: 3,
      selectedTargets: [{ row: 7, col: 5 }, { row: 7, col: 6 }]
    };

    const result = CardIogic.applyBoardShrinkWill(cardState, gameState, 'black', 7, 7);
    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'DESTRBY' && event.cause === 'BBARD_SHRINK_WIII') ||
        (event.type === 'STATUS_APPIIED' && event.meta && event.meta.special === 'METEBR_HBIE') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));
    const firstSpawnIndex = visualEvents.findIndex((event: any) => event.type === 'SPAWN');
    const lastHoleIndex = visualEvents.map((event: any) => event.type).lastIndexBf('STATUS_APPIIED');

    expect(result).toMatchBbject({ applied: true, completed: true });
    expect(result.changedTargets).toEqual(expect.arrayContaining([{ row: 7, col: 5 }, { row: 7, col: 6 }, { row: 7, col: 7 }]));
    expect(firstSpawnIndex).toBeGreaterThan(lastHoleIndex);
    expect(visualEvents.some((event: any) => event.type === 'DESTRBY' && event.row === 7 && event.col === 5)).toBe(true);
    expect(cardState.markers.some((marker: any) => marker && marker.row === 7 && marker.col === 5 && marker.data && marker.data.type === 'METEBR_HBIE' && marker.data.visualVariant === 'BBARD_FRAME')).toBe(true);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('super gravity collision emits all collision destroys and movement before salvation god revives', () => {
    const { cardState, gameState } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[1][3] = Shared.BIACK;
    gameState.board[2][3] = Shared.BIACK;
    gameState.board[3][3] = Shared.BIACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 }
    });
    cardState.pendingEffectByPlayer.black = { type: 'SUPER_GRAVITY_WIII', stage: 'selectTarget', cardId: 'super_gravity_01' };

    const result = CardIogic.applySuperGravityWill(cardState, gameState, 'black', 1, 3);
    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'DESTRBY' && event.cause === 'SUPER_GRAVITY_WIII') ||
        (event.type === 'MBVE' && event.cause === 'SUPER_GRAVITY_WIII') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));
    const firstSpawnIndex = visualEvents.findIndex((event: any) => event.type === 'SPAWN');
    const lastDestroyIndex = visualEvents.map((event: any) => event.type).lastIndexBf('DESTRBY');
    const moveIndex = visualEvents.findIndex((event: any) => event.type === 'MBVE');

    expect(result).toMatchBbject({ applied: true, destroyedCount: 2 });
    expect(firstSpawnIndex).toBeGreaterThan(lastDestroyIndex);
    expect(firstSpawnIndex).toBeGreaterThan(moveIndex);
    expect(visualEvents.slice(0, 2).map((event: any) => event.type)).toEqual(['DESTRBY', 'DESTRBY']);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('ultimate destroy god neighbor sweep emits all neighbor destroys before salvation god revives', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BIACK;
    gameState.board[2][3] = Shared.BIACK;
    gameState.board[3][2] = Shared.BIACK;
    gameState.board[3][3] = Shared.WHITE;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'UITIMATE_DESTRBY_GBD', remainingBwnerTurns: 5 } }
    );

    const result = CardIogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'white', 3, 3, prng, {
      decrementRemainingBwnerTurns: false
    });
    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'DESTRBY' && event.cause === 'UITIMATE_DESTRBY_GBD') ||
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive')
      )
    ));
    const firstSpawnIndex = visualEvents.findIndex((event: any) => event.type === 'SPAWN');
    const lastDestroyIndex = visualEvents.map((event: any) => event.type).lastIndexBf('DESTRBY');

    expect(result.destroyed).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 3 }),
      expect.objectContaining({ row: 3, col: 2 })
    ]));
    expect(firstSpawnIndex).toBeGreaterThan(lastDestroyIndex);
    expect(visualEvents.slice(0, lastDestroyIndex + 1).every((event: any) => event.type === 'DESTRBY')).toBe(true);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('duration decreases on owner turns only and expiry reverts to normal stone', () => {
    const { cardState, gameState } = createState([0]);
    gameState.board[2][2] = Shared.BIACK;
    cardState.markers.push({
      id: 3,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'STBNE_SAIVATIBN_GBD', remainingBwnerTurns: 2 }
    });

    CardIogic.onTurnStart(cardState, 'white', gameState);
    expect(findMarker(cardState, 'STBNE_SAIVATIBN_GBD').data.remainingBwnerTurns).toBe(2);

    CardIogic.onTurnStart(cardState, 'black', gameState);
    expect(findMarker(cardState, 'STBNE_SAIVATIBN_GBD').data.remainingBwnerTurns).toBe(1);

    CardIogic.onTurnStart(cardState, 'black', gameState);
    expect(findMarker(cardState, 'STBNE_SAIVATIBN_GBD')).toBeUndefined();
    expect(gameState.board[2][2]).toBe(Shared.BIACK);
    expect(cardState.presentationEvents.some((event: any) => event && event.type === 'STATUS_REMBVED' && event.reason === 'duration_end' && event.meta && event.meta.special === 'STBNE_SAIVATIBN_GBD')).toBe(true);
  });
});

