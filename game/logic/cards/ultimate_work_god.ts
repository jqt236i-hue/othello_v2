import { BLACK, WHITE } from '../../../shared-constants';
import type { CardState, GameState, PlayerKey } from '../../../src/types';
import RandomSourceModule = require('../cards-internal/random-source');

const SPECIAL_TYPE = 'ULTIMATE_WORK_GOD';
const INCOME_AMOUNT = 5;
const MAX_SELF_DESTRUCT_CHANCE_PERCENT = 100;

type UltimateWorkGodDeps = {
    BoardOps?: {
        getCellValue?: (gameState: GameState, row: number, col: number, cardState: CardState | null) => any;
        destroyAt?: (
            cardState: CardState,
            gameState: GameState,
            row: number,
            col: number,
            cause: string,
            reason: string,
            meta?: any
        ) => any;
        emitPresentationEvent?: (cardState: CardState, event: any) => void;
    };
    addChargeWithTotal?: (cardState: CardState, playerKey: PlayerKey, amount: number, meta?: any) => number;
    randomSource?: any;
};

function normalizeChancePercent(value: any): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(MAX_SELF_DESTRUCT_CHANCE_PERCENT, Math.trunc(numeric)));
}

function getMarkerAt(cardState: CardState, playerKey: PlayerKey, row: number, col: number): any | null {
    const markers = cardState && Array.isArray((cardState as any).markers)
        ? (cardState as any).markers
        : [];
    return markers.find((marker: any) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.owner === playerKey &&
        marker.row === row &&
        marker.col === col &&
        String(marker.data && marker.data.type || '').toUpperCase() === SPECIAL_TYPE
    )) || null;
}

function isOwnerStone(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps: UltimateWorkGodDeps
): boolean {
    const getCellValue = deps.BoardOps && typeof deps.BoardOps.getCellValue === 'function'
        ? deps.BoardOps.getCellValue
        : null;
    if (!getCellValue) return false;
    const expected = playerKey === 'black' ? BLACK : WHITE;
    return getCellValue(gameState, row, col, cardState) === expected;
}

function emitIncomePresentation(
    cardState: CardState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    gained: number,
    chancePercent: number,
    deps: UltimateWorkGodDeps
): void {
    const emit = deps.BoardOps && typeof deps.BoardOps.emitPresentationEvent === 'function'
        ? deps.BoardOps.emitPresentationEvent
        : null;
    if (!emit || gained <= 0) return;
    emit(cardState, {
        type: 'ULTIMATE_WORK_GOD_INCOME',
        player: playerKey,
        row,
        col,
        gained,
        selfDestructChancePercent: chancePercent,
        meta: {
            owner: playerKey,
            special: SPECIAL_TYPE,
            scenario: 'income',
            sourceType: 'ultimate_work_god_income',
            gained,
            selfDestructChancePercent: chancePercent
        }
    });
}

function processUltimateWorkGodAtTurnStartAnchor(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps: UltimateWorkGodDeps = {}
): any {
    const marker = getMarkerAt(cardState, playerKey, row, col);
    if (!marker) return { processed: false, reason: 'marker_not_found', row, col };
    if (!isOwnerStone(cardState, gameState, playerKey, row, col, deps)) {
        return { processed: false, reason: 'anchor_lost', row, col };
    }

    if (!marker.data || typeof marker.data !== 'object') marker.data = {};
    const chancePercent = Math.min(
        MAX_SELF_DESTRUCT_CHANCE_PERCENT,
        normalizeChancePercent(marker.data.selfDestructChancePercent) + 1
    );
    marker.data.type = SPECIAL_TYPE;
    marker.data.ownerColor = playerKey;
    marker.data.selfDestructChancePercent = chancePercent;

    const randomSource = RandomSourceModule.resolveRandomSource(
        deps.randomSource,
        null,
        'CardUltimateWorkGod.processUltimateWorkGodAtTurnStartAnchor'
    );
    const roll = RandomSourceModule.readRandomUnit(
        randomSource,
        null,
        'CardUltimateWorkGod.processUltimateWorkGodAtTurnStartAnchor'
    );
    const selfDestructTriggered = (roll * 100) < chancePercent;

    if (selfDestructTriggered) {
        const destroyAt = deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function'
            ? deps.BoardOps.destroyAt
            : null;
        if (!destroyAt) {
            throw new Error('CardUltimateWorkGod requires BoardOps.destroyAt.');
        }
        const destroyResult = destroyAt(
            cardState,
            gameState,
            row,
            col,
            SPECIAL_TYPE,
            'ultimate_work_god_self_destruct',
            {
                owner: playerKey,
                special: SPECIAL_TYPE,
                selfDestruct: true,
                selfDestructChancePercent: chancePercent,
                randomSource
            }
        );
        return {
            processed: true,
            row,
            col,
            chancePercent,
            roll,
            selfDestructTriggered: true,
            selfDestructed: !!(destroyResult && destroyResult.destroyed === true),
            gained: 0,
            destroyResult: destroyResult || null
        };
    }

    const addCharge = typeof deps.addChargeWithTotal === 'function'
        ? deps.addChargeWithTotal
        : null;
    if (!addCharge) {
        throw new Error('CardUltimateWorkGod requires addChargeWithTotal.');
    }
    const gainedRaw = addCharge(cardState, playerKey, INCOME_AMOUNT, {
        popupKind: 'board',
        sourceType: 'ultimate_work_god_income',
        anchorRow: row,
        anchorCol: col,
        disableChargeGainMultiplier: true
    });
    const gained = Number.isFinite(Number(gainedRaw)) ? Math.max(0, Number(gainedRaw)) : 0;
    emitIncomePresentation(cardState, playerKey, row, col, gained, chancePercent, deps);
    return {
        processed: true,
        row,
        col,
        chancePercent,
        roll,
        selfDestructTriggered: false,
        selfDestructed: false,
        gained,
        destroyResult: null
    };
}

export = {
    SPECIAL_TYPE,
    INCOME_AMOUNT,
    MAX_SELF_DESTRUCT_CHANCE_PERCENT,
    normalizeChancePercent,
    processUltimateWorkGodAtTurnStartAnchor
};
