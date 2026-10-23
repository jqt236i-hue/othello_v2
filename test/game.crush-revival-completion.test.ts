import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import { BattleMatch } from '../game/battle/match';

const prng = { shuffle: (cards: any[]) => cards, random: () => 0 };
const cases = [
  { type: 'SUPER_BUOYANCY_WILL', cardId: 'super_buoyancy_01', field: 'superBuoyancyTarget', from: { row: 3, col: 3 }, to: { row: 0, col: 3 }, fallback: { row: 1, col: 3 } },
  { type: 'SUPER_GRAVITY_WILL', cardId: 'super_gravity_01', field: 'superGravityTarget', from: { row: 3, col: 3 }, to: { row: 7, col: 3 }, fallback: { row: 6, col: 3 } },
  { type: 'SUPER_ATTRACTION_WILL', cardId: 'super_attraction_01', field: 'superAttractionTarget', from: { row: 3, col: 3 }, to: { row: 0, col: 3 }, fallback: { row: 1, col: 3 } }
];

function createMatch(config: typeof cases[number], adjacent = false) {
  const cardState = CardLogic.createCardState(prng);
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.turnNumber = 8;
  const from = adjacent ? config.fallback : config.from;
  gameState.board[from.row][from.col] = Core.BLACK;
  gameState.board[config.to.row][config.to.col] = Core.WHITE;
  // A separate legal move verifies that selection resumes ordinary placement.
  gameState.board[5][0] = Core.BLACK;
  gameState.board[5][1] = Core.WHITE;
  cardState.markers = [{
    id: 1, createdSeq: 1, kind: 'specialStone', owner: 'white', ...config.to,
    data: { type: 'REGEN', ownerColor: Core.WHITE, regenRemaining: 3 }
  }];
  cardState.charge.black = 99;
  cardState.hands.black = [config.cardId];
  const match = new BattleMatch({ gameState, cardState, prngState: { seed: 1, calls: 0 } } as any);
  return { match, from };
}

function select(match: BattleMatch, config: typeof cases[number], from: { row: number; col: number }) {
  expect(match.apply({ type: 'use_card', useCardId: config.cardId, useCardHandIndex: 0, useCardOwnerKey: 'black' }).ok).toBe(true);
  const chargeAfterUse = match.snapshot().cardState.charge.black;
  if (config.type === 'SUPER_ATTRACTION_WILL') {
    expect(match.apply({ type: 'place', [config.field]: from }).ok).toBe(true);
  }
  const transition = match.apply({ type: 'place', [config.field]: config.type === 'SUPER_ATTRACTION_WILL' ? config.to : from });
  expect(transition.ok).toBe(true);
  expect(transition.events).toContainEqual(expect.objectContaining({
    type: config.type === 'SUPER_BUOYANCY_WILL' ? 'super_buoyancy_selected'
      : config.type === 'SUPER_GRAVITY_WILL' ? 'super_gravity_selected' : 'super_attraction_selected',
    applied: true
  }));
  const state = match.snapshot();
  expect(state.cardState.pendingEffectByPlayer.black).toBeNull();
  expect(state.cardState.hands.black).not.toContain(config.cardId);
  expect(state.cardState.charge.black).toBe(chargeAfterUse);
  expect(state.cardState.markers.find((m: any) => m.data?.type === 'REGEN')?.data.regenRemaining).toBe(2);
  expect(state.gameState.board[config.to.row][config.to.col]).toBe(Core.WHITE);
  expect(state.gameState.currentPlayer).toBe(Core.BLACK);
  expect(match.apply({ type: 'place', row: 5, col: 2 }).ok).toBe(true);
  expect(match.snapshot().gameState.currentPlayer).toBe(Core.WHITE);
  return state;
}

describe.each(cases)('$type collision revival completion', (config) => {
  test('moves to the farthest empty path cell after the endpoint revives, consuming the card once', () => {
    const { match, from } = createMatch(config);
    const state = select(match, config, from);
    expect(state.gameState.board[from.row][from.col]).toBe(Core.EMPTY);
    expect(state.gameState.board[config.fallback.row][config.fallback.col]).toBe(Core.BLACK);
  });

  test('completes without moving when every path cell remains occupied after revival', () => {
    const { match, from } = createMatch(config, true);
    const state = select(match, config, from);
    expect(state.gameState.board[from.row][from.col]).toBe(Core.BLACK);
  });
});

test('a shortened two-segment attraction reports only its actual path and waypoints', () => {
  const config = { ...cases[2], from: { row: 4, col: 4 }, to: { row: 1, col: 2 }, fallback: { row: 2, col: 2 } };
  const { match, from } = createMatch(config);
  expect(match.apply({ type: 'use_card', useCardId: config.cardId, useCardHandIndex: 0, useCardOwnerKey: 'black' }).ok).toBe(true);
  expect(match.apply({ type: 'place', superAttractionTarget: from }).ok).toBe(true);
  const transition = match.apply({ type: 'place', superAttractionTarget: config.to });
  const event: any = transition.events.find((e: any) => e.type === 'super_attraction_selected');
  expect(event.applied).toBe(true);
  expect(event.to).not.toEqual(config.to);
  expect(event.pathCells.at(-1)).toEqual(event.to);
  expect(event.waypoints.at(-1)).toEqual(event.to);
  expect(event.segments.at(-1).to).toEqual(event.to);
  expect(event.pathCells).not.toContainEqual(config.to);
});
