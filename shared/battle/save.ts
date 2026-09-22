import Hash = require('../state-hash');
import Deck = require('../deck-spec');
import Board = require('../shared-board-utils');
import { resolveBattleConfig, type ResolvedBattleConfig } from './config';
import { cloneBattle, type CompleteBattlePosition } from './types';

export const BATTLE_RULES_VERSION = 'card-reversi.rules.v1';
export const BATTLE_CONTENT_VERSION = Hash.computeStableHash(Deck.getEnabledCardDefs());
export const BATTLE_SAVE_LIMITS = Object.freeze({ chars: 8 * 1024 * 1024, nodes: 300000, depth: 80, rngCalls: 10000000 });
export class BattleSaveCompatibilityError extends Error { readonly code = 'BATTLE_SAVE_INCOMPATIBLE'; }
export type BattlePhase = 'needs-turn-start' | 'action' | 'terminal';
export interface BattleSave {
    formatVersion: 1;
    rulesVersion: string;
    contentVersion: string;
    config: ResolvedBattleConfig;
    position: CompleteBattlePosition;
    phase: BattlePhase;
    cpuMemory: Record<string, any>;
}

/** Persistence accepts bounded JSON, never runtime objects or executable properties. */
export function assertBattleJson(value: unknown): void {
    let count = 0;
    const visit = (item: any, depth: number) => {
        if (++count > BATTLE_SAVE_LIMITS.nodes || depth > BATTLE_SAVE_LIMITS.depth) throw new Error('Battle data exceeds limits');
        if (item === null || typeof item === 'boolean') return;
        if (typeof item === 'string') {
            if (item.length > BATTLE_SAVE_LIMITS.chars) throw new Error('Battle string exceeds limits');
            return;
        }
        if (typeof item === 'number' && Number.isFinite(item)) return;
        if (typeof item !== 'object' || (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype
            && Object.getPrototypeOf(item) !== null)) throw new Error('Expected plain battle data');
        for (const key of Object.keys(item)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid battle data key');
            const property = Object.getOwnPropertyDescriptor(item, key);
            if (!property || !('value' in property)) throw new Error('Invalid battle data property');
            visit(property.value, depth + 1);
        }
    };
    visit(value, 0);
}
function integer(value: any, min: number, max: number, name: string): void {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid saved ${name}`);
}
export function validateBattleSave(value: any): BattleSave {
    assertBattleJson(value);
    if (value?.formatVersion !== 1) throw new BattleSaveCompatibilityError('Unsupported battle save version');
    if (value.rulesVersion !== BATTLE_RULES_VERSION || value.contentVersion !== BATTLE_CONTENT_VERSION) {
        throw new BattleSaveCompatibilityError('Incompatible battle rules or content');
    }
    const config = resolveBattleConfig(value.config);
    const position = value.position;
    if (!position || !position.gameState || !position.cardState || !position.prngState) throw new Error('Incomplete battle state');
    integer(position.prngState.seed, 0, 0xffffffff, 'seed');
    integer(position.prngState.calls, 0, BATTLE_SAVE_LIMITS.rngCalls, 'random checkpoint');
    if (position.prngState.seed !== config.seed) throw new Error('Mismatched battle seed');
    const gs = position.gameState, cs = position.cardState;
    for (const metadata of [gs.boardConfig, cs.boardConfig]) {
        if (!metadata || metadata.rows !== config.board.rows || metadata.cols !== config.board.cols
            || metadata.shape !== config.board.shape) throw new Error('Invalid saved board configuration');
    }
    if (!Array.isArray(gs.board) || gs.board.length !== config.board.rows || gs.board.some((row: any) =>
        !Array.isArray(row) || row.length !== config.board.cols || row.some((cell: any) => ![-1, 0, 1].includes(cell)))) {
        throw new Error('Invalid saved board');
    }
    if (gs.currentPlayer !== 1 && gs.currentPlayer !== -1) throw new Error('Invalid saved player');
    integer(gs.turnNumber, 0, 10000000, 'turn');
    integer(gs.consecutivePasses, 0, 2, 'passes');
    if (!['needs-turn-start', 'action', 'terminal'].includes(value.phase)
        || (value.phase === 'terminal') !== (gs.consecutivePasses >= 2)) throw new Error('Invalid saved phase');
    if (!Array.isArray(cs.markers) || !Array.isArray(cs.discard) || !Array.isArray(cs.stoneIdMap)
        || !cs.pendingEffectByPlayer || !cs._handCopyIdsByPlayer || !cs._deckCopyIdsByPlayer) throw new Error('Incomplete saved card state');
    if (cs.stoneIdMap.length !== gs.board.length || cs.stoneIdMap.some((row: any) => !Array.isArray(row) || row.length !== config.board.cols)) throw new Error('Invalid saved stone map');
    const stoneIds = new Set<string>();
    for (let row = 0; row < gs.board.length; row++) for (let col = 0; col < gs.board[row].length; col++) {
        const id = cs.stoneIdMap[row][col];
        if (gs.board[row][col] !== 0) {
            if (!Board.isMainBoardCell(row, col, gs.boardConfig) || typeof id !== 'string' || !/^s[1-9][0-9]*$/.test(id)
                || stoneIds.has(id)) throw new Error('Invalid saved stone identity');
            stoneIds.add(id);
        } else if (id !== null) throw new Error('Stale saved stone identity');
    }
    for (const field of ['turnCountByPlayer', 'hasUsedCardThisTurnByPlayer', 'hasDestroyedCardThisTurnByPlayer', 'activeEffectsByPlayer',
        'extraPlaceRemainingByPlayer', 'infinitePlaceActiveByPlayer', 'timeStopConsecutiveTurnsRemainingByPlayer', 'chargeGainMultiplierByPlayer',
        'fateWillControllerByTurnOwner', 'riboRepaymentsByPlayer', 'observerWillRepaymentsByPlayer', 'lastUsedCardByPlayer']) {
        if (!cs[field] || !Object.prototype.hasOwnProperty.call(cs[field], 'black') || !Object.prototype.hasOwnProperty.call(cs[field], 'white')) throw new Error(`Incomplete saved ${field}`);
    }
    for (const field of ['boardBonusByCell', 'boardBonusConsumedByCell', 'expansionStoneIdByCell', 'cardCostOverridesByCopyId', 'cardCostModifiersByCopyId']) {
        if (!cs[field] || typeof cs[field] !== 'object' || Array.isArray(cs[field])) throw new Error(`Incomplete saved ${field}`);
    }
    for (const field of ['turnIndex', '_nextStoneId', '_nextMarkerId', '_nextCreatedSeq']) integer(cs[field], 0, Number.MAX_SAFE_INTEGER, field);
    if (cs.prngState) {
        integer(cs.prngState.calls, 0, position.prngState.calls, 'card random checkpoint');
        if (cs.prngState.seed !== position.prngState.seed) throw new Error('Mismatched saved random seed');
    }
    const cardIds = new Set(Deck.getEnabledCardIds());
    const validateCards = (cards: any, name: string) => {
        if (!Array.isArray(cards) || cards.length > 16384 || cards.some((id: any) => !cardIds.has(id))) throw new Error(`Invalid saved ${name}`);
    };
    validateCards(cs.discard, 'discard');
    integer(cs._nextCardCopySeq, 1, Number.MAX_SAFE_INTEGER, 'card sequence');
    const seenCopies = new Set<number>();
    const validateCopies = (cards: any[], copies: any) => {
        if (!Array.isArray(copies) || copies.length !== cards.length) throw new Error('Invalid saved card identities');
        for (const id of copies) {
            integer(id, 1, cs._nextCardCopySeq - 1, 'card identity');
            if (seenCopies.has(id)) throw new Error('Duplicate saved card identity');
            seenCopies.add(id);
        }
    };
    validateCopies(cs.discard, cs._discardCopyIds);
    for (const player of ['black', 'white'] as const) {
        validateCards(cs.hands?.[player], 'hand');
        validateCards(cs.decks?.[player], 'deck');
        integer(cs.charge?.[player], 0, 99, 'charge');
        for (const [cards, copies] of [[cs.hands[player], cs._handCopyIdsByPlayer[player]], [cs.decks[player], cs._deckCopyIdsByPlayer[player]]]) {
            validateCopies(cards, copies);
        }
        const pending = cs.pendingEffectByPlayer[player];
        if (pending !== null && (!pending || typeof pending.type !== 'string' || !pending.type)) throw new Error('Invalid saved pending');
    }
    if (!value.cpuMemory || Array.isArray(value.cpuMemory) || typeof value.cpuMemory !== 'object') throw new Error('Invalid CPU memory');
    return cloneBattle({ ...value, config });
}

export function createBattleSave(config: ResolvedBattleConfig, position: CompleteBattlePosition,
    phase: BattlePhase, cpuMemory: Record<string, any> = {}): BattleSave {
    const cardState = { ...position.cardState };
    for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta', 'presentationEvents', '_presentationEventsPersist', 'chargeDeltaEvents']) delete cardState[key];
    cardState.presentationEvents = []; cardState.chargeDeltaEvents = [];
    const gameState = { ...position.gameState };
    for (const key of ['__resultShown', '__resultToken']) delete gameState[key];
    // Live pending effects have optional own properties set to undefined. Omit those
    // object fields without invoking getters/toJSON; external saves stay strict.
    let nodes = 0;
    const runtimeJson = (value: any, depth = 0): any => {
        if (++nodes > BATTLE_SAVE_LIMITS.nodes || depth > BATTLE_SAVE_LIMITS.depth) throw new Error('Battle data exceeds limits');
        if (value === null || typeof value !== 'object') return value;
        const array = Array.isArray(value);
        const prototype = Object.getPrototypeOf(value);
        // structuredClone may return another realm's plain Object in a host/VM.
        if (!array && prototype !== null && Object.getPrototypeOf(prototype) !== null) throw new Error('Expected plain battle data');
        const result: any = array ? [] : {};
        for (const key of Object.keys(value)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid battle data key');
            const property = Object.getOwnPropertyDescriptor(value, key);
            if (!property || !('value' in property)) throw new Error('Invalid battle data property');
            if (!array && property.value === undefined) continue;
            result[key] = runtimeJson(property.value, depth + 1);
        }
        return result;
    };
    return validateBattleSave(runtimeJson({ formatVersion: 1, rulesVersion: BATTLE_RULES_VERSION, contentVersion: BATTLE_CONTENT_VERSION,
        config, position: { ...position, gameState, cardState }, phase, cpuMemory }));
}
export function serializeBattleSave(save: BattleSave): string {
    const data = validateBattleSave(save);
    const text = JSON.stringify({ data, checksum: Hash.computeStableHash(data) });
    if (text.length > BATTLE_SAVE_LIMITS.chars) throw new Error('Battle save exceeds size limit');
    return text;
}
export function parseBattleSave(text: string): BattleSave {
    if (typeof text !== 'string' || text.length > BATTLE_SAVE_LIMITS.chars) throw new Error('Battle save exceeds size limit');
    const envelope = JSON.parse(text);
    assertBattleJson(envelope);
    if (!envelope?.data || envelope.checksum !== Hash.computeStableHash(envelope.data)) throw new Error('Damaged battle save');
    return validateBattleSave(envelope.data);
}
