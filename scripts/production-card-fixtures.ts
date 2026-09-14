import { createProductionPosition, ProductionMatch, productionStateKey, type ProductionPosition, type ProductionTransition } from '../src/engine/production-match';
import { enumerateLv10Actions, type Lv10Player } from '../game/ai/cpu-lv10-position';
import Shared = require('../shared-constants');
const Cards: any = require('../game/logic/cards');

export type ProductionCardFixture = {
    id: string; cardId: string; name: string; player: Lv10Player;
    initial: ProductionPosition; transitions: ProductionTransition[];
    markers: string[]; pendingTypes: string[]; used: boolean; completedCardTurn: boolean;
};

/** Construct rule-valid regression positions, not a competing game simulator.
 * A fixture's explicitly supplied history makes restricted cards usable; the
 * ordinary card checks, target enumeration and transition pipeline still run. */
export function createProductionCardFixture(cardId: string, player: Lv10Player, fusion = false): ProductionPosition {
    const state = createProductionPosition(914071, { black: 10, white: 10 });
    const cs = state.cardState, gs = state.gameState, sign = player === 'black' ? 1 : -1;
    const opponent = player === 'black' ? 'white' : 'black';
    gs.currentPlayer = sign; gs.turnNumber = 24;
    gs.board = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) =>
        row >= 1 && row <= 6 && col >= 1 && col <= 6 ? ((row + col) % 3 ? sign : -sign) : 0));
    cs.turnIndex = 24; cs.lastTurnStartedFor = player;
    cs.hands[player] = [cardId]; cs.hands[opponent] = ['udr_01', 'destroy_01', 'guard_01'];
    cs.numberCellCollectedTotalByPlayer = { black: 48, white: 48 };
    cs.prevOpponentTurnDestroyedStonesByPlayer = {
        [player]: [{ row: 0, col: 1, owner: player, wasSpecial: false }, { row: 0, col: 2, owner: opponent, wasSpecial: false }],
        [opponent]: []
    };
    if (cardId === 'equality_will_01') cs.charge[player] = 0;
    if (cardId === 'last_resort_01') {
        gs.board = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) =>
            row >= 3 && row <= 5 && col >= 3 && col <= 5 ? -sign : 0));
        gs.board[0][0] = sign;
    } else {
        for (const [row, col, owner, type] of [
            [2, 2, player, 'BREEDING'], [3, 3, opponent, 'PROTECTED'], [4, 4, player, 'WORK']
        ] as const) {
            gs.board[row][col] = owner === 'black' ? 1 : -1;
            Cards.addMarker(cs, 'specialStone', row, col, owner, { type, remainingOwnerTurns: 6 });
        }
    }
    if (cardId === 'causal_replay_01') {
        Cards.addMarker(cs, 'specialStone', 0, 0, player, { type: 'METEOR_HOLE', permanent: true });
    }
    if (fusion) {
        for (const [type, col] of [['WATER', 0], ['GRASS', 2], ['LIGHTNING', 4]] as const) {
            gs.board[7][col] = sign;
            Cards.addMarker(cs, 'specialStone', 7, col, player, { type, remainingOwnerTurns: 6 });
        }
    }
    cs.stoneIdMap = gs.board.map((row: number[], r: number) => row.map((value: number, c: number) => value ? 1 + r * 8 + c : 0));
    cs._nextStoneId = 65;
    Cards.ensureCardCopyState(cs);
    return state;
}

export function traceProductionCardFixture(cardId: string, player: Lv10Player, fusion = false): ProductionCardFixture {
    const initial = createProductionCardFixture(cardId, player, fusion), transitions: ProductionTransition[] = [];
    const markerTypes = new Set<string>(), pendingTypes = new Set<string>();
    const match = new ProductionMatch(initial, transition => transitions.push(transition));
    const collect = () => {
        const cs = match.snapshot().cardState;
        for (const marker of cs.markers || []) if (marker.data?.type) markerTypes.add(marker.data.type);
        for (const pending of Object.values(cs.pendingEffectByPlayer || {}) as any[]) if (pending?.type) pendingTypes.add(pending.type);
    };
    const action = enumerateLv10Actions(initial).find(action => action.useCardId === cardId);
    if (!action) throw new Error(`Card fixture is not usable: ${cardId}/${player}`);
    if (!match.apply(action).ok) throw new Error(`Card fixture use rejected: ${cardId}/${player}`);
    collect();
    let completedCardTurn = false, boundaries = 0;
    for (let i = 0; i < 120 && !match.terminal; i++) {
        const before = match.snapshot();
        if (before.gameState.turnNumber > initial.gameState.turnNumber || match.owner !== player) completedCardTurn = true;
        if (before.cardState.lastTurnStartedFor !== match.owner) {
            match.startTurn(); boundaries++; collect();
            if (boundaries >= 14) break;
            if (match.terminal) break;
        }
        const current = match.snapshot();
        // Selection fixtures choose the first progressing canonical target.
        // Rejected trials occur on isolated copies and remain explicit errors
        // when no target works; they never turn into a different real action.
        const choices = enumerateLv10Actions(current, { allowCards: false });
        let progressing: any = null;
        for (const choice of choices) {
            const trial = new ProductionMatch(current), result = trial.apply(choice);
            if (result.ok && productionStateKey(trial.snapshot()) !== productionStateKey(current)) { progressing = choice; break; }
        }
        if (!progressing) throw new Error(`No progressing continuation: ${cardId}/${player}/${JSON.stringify(current.cardState.pendingEffectByPlayer)}`);
        if (!match.apply(progressing).ok) throw new Error('Fixture continuation changed legality');
        collect();
    }
    if (match.terminal) completedCardTurn = true;
    if (!completedCardTurn) throw new Error(`Card turn did not finish: ${cardId}/${player}`);
    if (fusion && !markerTypes.has('SHINRA_BANSHO_GOD')) throw new Error('Expected canonical four-element fusion did not occur');
    return { id: `${cardId}/${player}${fusion ? '/fusion' : ''}`, cardId, player, name: Cards.getCardDef(cardId).name,
        initial, transitions, markers: [...markerTypes], pendingTypes: [...pendingTypes], used: true, completedCardTurn };
}

export function productionFixtureCardIds(): string[] {
    return (Shared.CARD_DEFS as any[]).filter(card => card.enabled !== false ||
        ['triple_chain_01', 'quad_chain_01', 'infinite_chain_01', 'triple_01', 'quad_01', 'infinite_01'].includes(card.id)).map(card => card.id);
}
