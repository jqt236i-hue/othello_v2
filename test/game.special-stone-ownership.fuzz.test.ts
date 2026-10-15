import { BattleMatch } from '../game/battle/match';
import { createInitialBattlePosition } from '../game/battle/initial';
import * as Position from '../game/ai/cpu-lv10-position';
import * as DeckSpec from '../shared/deck-spec';
import * as Registry from '../shared/special-stone-registry';
import * as Shared from '../shared-constants.js';

// Deterministic random self-play over the production pipeline. After every turn start and every
// accepted action, each true special-stone body must sit on a stone of its owner's colour. Random
// play is the only practical way to reach the ownership-change paths (evasion captures,
// destroy-triggered revivals, recaptured placements, breeding flips, ...) that corrupted this before.

const SEEDS = Array.from({ length: 8 }, (_, i) => 1000 + i);
const MAX_TRANSITIONS = 300;

function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildDeck(rand: () => number) {
  const pool = DeckSpec.getEnabledCardIds().slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return ['zombie_will_01', 'zombie_will_01', 'regen_01', 'afterimage_will_01'].concat(pool);
}

function cellValue(state: any, row: number, col: number) {
  const board = state.gameState.board;
  if (row >= 0 && row < board.length && col >= 0 && col < board[0].length) return board[row][col];
  const cells = state.gameState.boardExpansion && state.gameState.boardExpansion.cells;
  const hit = Array.isArray(cells) ? cells.find((c: any) => c.row === row && c.col === col) : null;
  return hit ? hit.owner : null;
}

function findInconsistentBodies(state: any) {
  const out: any[] = [];
  for (const m of state.cardState.markers || []) {
    if (!m || m.kind !== 'specialStone' || !m.data) continue;
    if (m.owner !== 'black' && m.owner !== 'white') continue;
    if (Registry.classifySpecialStoneRuleClass(m.data.type, m.data) !== 'true_special_stone') continue;
    const expected = m.owner === 'black' ? Shared.BLACK : Shared.WHITE;
    const actual = cellValue(state, m.row, m.col);
    if (actual !== expected) out.push({ type: m.data.type, owner: m.owner, row: m.row, col: m.col, cell: actual, data: m.data });
  }
  return out;
}

function playRandomGame(seed: number) {
  const rand = mulberry32(seed * 7919 + 17);
  const match = new BattleMatch(createInitialBattlePosition(seed, {
    initialDeckCardIdsByPlayer: { black: buildDeck(rand), white: buildDeck(rand) },
    initialChargeByPlayer: { black: 60, white: 60 },
    chargeGainMultiplierByPlayer: { black: 3, white: 3 }
  }));
  let transitions = 0;
  let rejected = 0;
  while (!match.terminal && transitions < MAX_TRANSITIONS) {
    const before = match.snapshot();
    let transition;
    if (before.cardState.lastTurnStartedFor !== match.owner) {
      transition = match.startTurn();
    } else {
      let actions = Position.enumerateLv10Actions(before, { allowCards: true, cardUnlockTurn: 0 });
      if (!actions.length) {
        const cancel = Position.lv10CancellationAction(before);
        actions = cancel ? [cancel] : [{ type: 'pass' }];
      }
      const cardUses = actions.filter((a: any) => a.type === 'use_card');
      const action = cardUses.length && rand() < 0.6
        ? cardUses[Math.floor(rand() * cardUses.length)]
        : actions[Math.floor(rand() * actions.length)];
      transition = match.apply(action, { skipTurnStart: true }, match.controller);
      if (!transition.ok) {
        rejected += 1;
        if (rejected > 20) break;
        continue;
      }
      rejected = 0;
    }
    transitions += 1;
    const problems = findInconsistentBodies(transition.after);
    if (problems.length) {
      return { seed, transitions, kind: transition.kind, player: transition.player, action: transition.action || null, events: transition.events.map((e: any) => e.type), problems };
    }
  }
  return null;
}

describe('special-stone ownership stays consistent under random play', () => {
  test.each(SEEDS)('seed %i keeps every special-stone body on a stone of its owner colour', (seed) => {
    expect(playRandomGame(seed)).toBeNull();
  }, 60000);
});
