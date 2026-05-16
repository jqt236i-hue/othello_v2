/* eslint-env jest */
import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

declare const require: any;
const BoardOps: typeof import('../game/logic/board_ops.js') = require('../game/logic/board_ops.js');
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
  const cardState = CardLogic.createCardState(prng);
  cardState.debugNoDraw = true;
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState, prng };
}

function getStoneSalvationGodDef() {
  return (Shared.CARD_DEFS || []).find((card) => card && card.type === 'STONE_SALVATION_GOD');
}

function findMarker(cardState: any, type: string) {
  return (cardState.markers || []).find((marker: any) => marker && marker.data && marker.data.type === type);
}

describe('STONE_SALVATION_GOD（石救済神）', () => {
  test('catalog entry exists with correct id, type, and cost', () => {
    const def = getStoneSalvationGodDef();
    const catalogDef = (CardCatalog.cards || []).find((card: any) => card && card.type === 'STONE_SALVATION_GOD');
    expect(def).toBeTruthy();
    expect(def.id).toBe('stone_salvation_god_01');
    expect(def.name).toBe('救済神');
    expect(def.type).toBe('STONE_SALVATION_GOD');
    expect(Number(def.cost)).toBe(25);
    expect(catalogDef).toBeTruthy();
    expect(catalogDef.name_ja).toBe('救済神');
    expect(catalogDef.display_type_ja).toBe('繁栄');
    expect(VisualEffectsMap.PENDING_TYPE_TO_EFFECT_KEY.STONE_SALVATION_GOD).toBe('stoneSalvationGod');
    expect(VisualEffectsMap.SPECIAL_TYPE_TO_EFFECT_KEY.STONE_SALVATION_GOD).toBe('stoneSalvationGod');
    expect(VisualEffectsMap.STONE_VISUAL_EFFECTS.stoneSalvationGod.imagePathByOwner['1']).toContain('STONE_SALVATION_GOD-black.png');
    expect(VisualEffectsMap.STONE_VISUAL_EFFECTS.stoneSalvationGod.imagePathByOwner['-1']).toContain('STONE_SALVATION_GOD-white.png');
    expect(CardInteractionEffects.resolveCardEffectTags({ type: 'STONE_SALVATION_GOD' }).map((tag: any) => tag.label)).toEqual(['反転保護', '10ターン持続']);
  });

  test('next placed stone becomes a 10-turn flip-protected salvation god', () => {
    const def = getStoneSalvationGodDef();
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BLACK;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', def.id)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'STONE_SALVATION_GOD' });

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 2, [3, 3], prng);
    const marker = findMarker(cardState, 'STONE_SALVATION_GOD');

    expect(effects.stoneSalvationGodPlaced).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(marker).toMatchObject({ row: 3, col: 2, owner: 'black', data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 10 } });
    expect(Core.getFlipsWithContext(gameState, 3, 1, Shared.WHITE, CardLogic.getCardContext(cardState))).toEqual([]);
  });

  test('destroyed own stone queues a normal-stone revive for the owner turn start without reviving the salvation god itself', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BLACK;
    gameState.board[1][1] = Shared.BLACK;
    gameState.board[2][2] = Shared.WHITE;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'OBSERVER', remainingOwnerTurns: 3 } }
    );

    const destroyedOwn = BoardOps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'destroy_own', { randomSource: prng });
    const immediateReviveEvents = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(destroyedOwn.destroyed).toBe(true);
    expect(destroyedOwn.stoneSalvationGodReviveQueued).toBe(true);
    expect(gameState.board[1][1]).toBe(Shared.EMPTY);
    expect(gameState.board[0][1]).toBe(Shared.EMPTY);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toHaveLength(1);
    expect(immediateReviveEvents).toHaveLength(0);

    CardLogic.onTurnStart(cardState, 'black', gameState, prng);
    const reviveEvents = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(gameState.board[0][1]).toBe(Shared.BLACK);
    expect(reviveEvents).toHaveLength(1);
    expect(reviveEvents[0]).toMatchObject({ row: 0, col: 1, ownerAfter: 'black', cause: 'STONE_SALVATION_GOD', reason: 'stone_salvation_god_revive' });
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);

    const destroyedGod = BoardOps.destroyAt(cardState, gameState, 0, 0, 'TEST', 'destroy_god', { randomSource: prng });
    const reviveEventsAfterGodDestroy = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');

    expect(destroyedGod.destroyed).toBe(true);
    expect(destroyedGod.stoneSalvationGodRevived).toBeUndefined();
    expect(reviveEventsAfterGodDestroy).toHaveLength(1);
  });

  test('queued revive expires if the salvation god is gone before owner turn start', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BLACK;
    gameState.board[1][1] = Shared.BLACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 10 }
    });

    const destroyedOwn = BoardOps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'destroy_own', { randomSource: prng });
    expect(destroyedOwn.stoneSalvationGodReviveQueued).toBe(true);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toHaveLength(1);

    BoardOps.destroyAt(cardState, gameState, 0, 0, 'TEST', 'destroy_god', { randomSource: prng });
    CardLogic.onTurnStart(cardState, 'black', gameState, prng);

    const reviveEvents = cardState.presentationEvents.filter((event: any) => event && event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive');
    expect(reviveEvents).toHaveLength(0);
    expect(cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
  });

  test('turn-start pipeline plays queued salvation revive before continuous destruction effects', () => {
    const { cardState, gameState, prng } = createState([0]);
    gameState.board[0][0] = Shared.BLACK;
    gameState.board[1][1] = Shared.BLACK;
    gameState.board[7][7] = Shared.BLACK;
    gameState.board[7][6] = Shared.WHITE;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 7, col: 7, owner: 'black', data: { type: 'SNIPER', remainingOwnerTurns: 3 } }
    );

    BoardOps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'destroy_own', { randomSource: prng });
    const events: any[] = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);

    const visualEvents = (cardState.presentationEvents || []).filter((event: any) => (
      event &&
      (
        (event.type === 'SPAWN' && event.reason === 'stone_salvation_god_revive') ||
        (event.type === 'DESTROY' && event.cause === 'SNIPER_WILL')
      )
    ));

    expect(visualEvents.map((event: any) => event.type)).toEqual(['SPAWN', 'DESTROY']);
    expect(events.some((event: any) => event && event.type === 'stone_salvation_god_revived_start' && event.revivedCount === 1)).toBe(true);
  });

  test('duration decreases on owner turns only and expiry reverts to normal stone', () => {
    const { cardState, gameState } = createState([0]);
    gameState.board[2][2] = Shared.BLACK;
    cardState.markers.push({
      id: 3,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 2 }
    });

    CardLogic.onTurnStart(cardState, 'white', gameState);
    expect(findMarker(cardState, 'STONE_SALVATION_GOD').data.remainingOwnerTurns).toBe(2);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    expect(findMarker(cardState, 'STONE_SALVATION_GOD').data.remainingOwnerTurns).toBe(1);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    expect(findMarker(cardState, 'STONE_SALVATION_GOD')).toBeUndefined();
    expect(gameState.board[2][2]).toBe(Shared.BLACK);
    expect(cardState.presentationEvents.some((event: any) => event && event.type === 'STATUS_REMOVED' && event.reason === 'duration_end' && event.meta && event.meta.special === 'STONE_SALVATION_GOD')).toBe(true);
  });
});
