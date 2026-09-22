import Board = require('../shared-board-utils');
import Playback = require('../playback-event-contract');
import { resolveBattleConfig } from './config';
import { assertBattleJson, BATTLE_RULES_VERSION, BATTLE_CONTENT_VERSION, BATTLE_SAVE_LIMITS, validateBattleSave } from './save';
import { BATTLE_EFFECT_TYPES, BATTLE_MARKER_TYPES, BATTLE_PENDING_REQUIRED_FIELDS, BATTLE_PENDING_STAGE_BY_TYPE, BATTLE_RESERVATION_FIELDS } from './state-validation';
import { getBattleRuntimeCardDefinitions } from './content-version';
import { cloneBattle, type BattleAction, type BattleResult } from './types';

export const BATTLE_DATA_CONTRACT_VERSION = 1;
export const BATTLE_ACTION_TARGET_FIELDS = Object.freeze([
    'destroyTarget', 'swapTarget', 'positionSwapTarget', 'strongWindTarget', 'buoyancyTarget', 'superBuoyancyTarget',
    'gravityTarget', 'superGravityTarget', 'superAttractionTarget', 'teleportTarget', 'temptTarget', 'captureTarget',
    'cloneTarget', 'bombTarget', 'extendTarget', 'corrosionTarget', 'guardTarget', 'livingWillTarget', 'reincarnationTarget',
    'trapTarget', 'reverseWillTarget', 'expansionTarget', 'shrinkTarget', 'blockadeTarget', 'poisonTarget', 'meteorTarget',
    'causalReplayTarget', 'freezeTarget', 'seedTarget'
]);
const ACTION_TYPES = Object.freeze(['place', 'use_card', 'pass', 'cancel_card', 'destroy_hand_card']);
const cardIds = new Set(getBattleRuntimeCardDefinitions().map(card => card.id));
function object(value: any, name: string): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid battle ${name}`);
}
function integer(value: any, min: number, max: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid battle ${name}`);
}
function coordinate(value: any, name: string): void {
    object(value, name); integer(value.row, -256, 256, `${name}.row`); integer(value.col, -256, 256, `${name}.col`);
}
/** Host command surface. Legal-move/card eligibility is still decided by apply().
 * Network authority flags and debug overrides are deliberately not host commands. */
export function validateBattleAction(value: any): BattleAction {
    assertBattleJson(value); object(value, 'action');
    if (!ACTION_TYPES.includes(value.type)) throw new Error('Invalid battle action type');
    const keys = ['type', 'row', 'col', 'useCardId', 'useCardHandIndex', 'useCardOwnerKey', 'destroyCardId',
        'condemnTargetIndex', 'observerWillTargetIndex', 'heavenBlessingCardId', ...BATTLE_ACTION_TARGET_FIELDS];
    if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('Invalid battle action field');
    if (value.row !== undefined || value.col !== undefined) coordinate(value, 'placement');
    for (const key of BATTLE_ACTION_TARGET_FIELDS) if (value[key] !== undefined) coordinate(value[key], key);
    for (const key of ['useCardHandIndex', 'condemnTargetIndex', 'observerWillTargetIndex']) {
        if (value[key] !== undefined) integer(value[key], 0, 16383, key);
    }
    for (const key of ['useCardId', 'destroyCardId', 'heavenBlessingCardId']) {
        if (value[key] !== undefined && !cardIds.has(value[key])) throw new Error(`Invalid battle ${key}`);
    }
    if (value.useCardOwnerKey !== undefined && !['black', 'white'].includes(value.useCardOwnerKey)) throw new Error('Invalid battle card owner');
    if (value.type === 'use_card' && !value.useCardId) throw new Error('Battle use_card requires useCardId');
    if (value.type === 'destroy_hand_card' && !value.destroyCardId) throw new Error('Battle destroy_hand_card requires destroyCardId');
    if (value.type === 'place' && value.row === undefined && !BATTLE_ACTION_TARGET_FIELDS.some(key => value[key] !== undefined)
        && value.condemnTargetIndex === undefined && value.observerWillTargetIndex === undefined && value.heavenBlessingCardId === undefined) {
        throw new Error('Battle place requires coordinates or selection');
    }
    return cloneBattle(value);
}
export function validateBattleResult(value: any): BattleResult | null {
    assertBattleJson(value); if (value === null) return null;
    object(value, 'result');
    for (const field of ['black', 'white', 'turnNumber']) integer(value[field], 0, Number.MAX_SAFE_INTEGER, field);
    const winner = value.black === value.white ? 'draw' : value.black > value.white ? 'black' : 'white';
    if (value.winner !== winner || value.endedBy !== 'consecutive_passes') throw new Error('Invalid battle result outcome');
    return cloneBattle(value);
}
export type BattleDataKind = 'config' | 'save' | 'position' | 'transition' | 'action' | 'result' | 'playbackEvents' | 'events';
/** Single validation entry shared by language-neutral CLI consumers and the core. */
export function validateBattleData(kind: BattleDataKind, value: any): unknown {
    assertBattleJson(value);
    if (kind === 'config') return resolveBattleConfig(value);
    if (kind === 'save') return validateBattleSave(value);
    if (kind === 'position') {
        object(value, 'position');
        const board = value.gameState?.boardConfig;
        const config = resolveBattleConfig({ version: 1, battleId: 'position-validation', seed: value.prngState?.seed,
            board: board && { rows: board.rows, cols: board.cols, shape: board.shape } });
        return validateBattleSave({ formatVersion: 1, rulesVersion: BATTLE_RULES_VERSION, contentVersion: BATTLE_CONTENT_VERSION,
            config, position: value, phase: value.gameState?.consecutivePasses === 2 ? 'terminal' : 'action', cpuMemory: {} }).position;
    }
    if (kind === 'transition') {
        object(value, 'transition');
        if (!['action', 'turn_start'].includes(value.kind) || !['black', 'white'].includes(value.player)
            || typeof value.ok !== 'boolean' || !(value.reason === null || typeof value.reason === 'string')
            || (value.ok && value.reason !== null) || (!value.ok && !value.reason)
            || (value.stopAction !== undefined && typeof value.stopAction !== 'boolean')) throw new Error('Invalid battle transition');
        if (value.kind === 'action') validateBattleAction(value.action);
        validateBattleData('position', value.before); validateBattleData('position', value.after); validateBattleData('events', value.events);
        return cloneBattle(value);
    }
    if (kind === 'action') return validateBattleAction(value);
    if (kind === 'result') return validateBattleResult(value);
    if (kind === 'events' || kind === 'playbackEvents') {
        if (!Array.isArray(value)) throw new Error('Invalid battle events');
        for (const event of value) {
            object(event, 'event');
            if (typeof event.type !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(event.type)) throw new Error('Invalid battle event type');
        }
        if (kind === 'playbackEvents') {
            const errors = Playback.validatePlaybackEventsForNetworkReplay(value);
            if (errors.length) throw new Error(`Invalid battle playback events: ${JSON.stringify(errors)}`);
        }
        return cloneBattle(value);
    }
    throw new Error('Unsupported battle data kind');
}
/** Describes the existing wire values; no alternate simulation/state format. */
export function getBattleDataContract() {
    return cloneBattle({ contractVersion: BATTLE_DATA_CONTRACT_VERSION, saveFormatVersion: 1, configVersion: 1,
        rulesVersion: BATTLE_RULES_VERSION, contentVersion: BATTLE_CONTENT_VERSION,
        kinds: ['config', 'save', 'position', 'transition', 'action', 'result', 'events', 'playbackEvents'],
        players: ['black', 'white'], owners: [-1, 0, 1], phases: ['needs-turn-start', 'action', 'terminal'],
        actionTypes: ACTION_TYPES, actionTargetFields: BATTLE_ACTION_TARGET_FIELDS,
        board: { rowBounds: Board.getBoardDimensionBounds('row'), colBounds: Board.getBoardDimensionBounds('col'),
            shapes: ['rectangle', 'circle'], coordinateMin: -256, coordinateMax: 256, indexing: 'zero-based-row-col' },
        seed: { min: 0, max: 0xffffffff, integer: true }, limits: BATTLE_SAVE_LIMITS,
        cards: getBattleRuntimeCardDefinitions().map((card: any) => ({ id: card.id, type: card.type, cost: card.cost, initialDeckEligible: card.enabled !== false })),
        pendingEffectTypes: BATTLE_EFFECT_TYPES, markerTypes: BATTLE_MARKER_TYPES,
        pendingRequiredFieldsByType: BATTLE_PENDING_REQUIRED_FIELDS,
        pendingStageByType: BATTLE_PENDING_STAGE_BY_TYPE,
        reservations: { playerKeys: ['black', 'white'], mapsRequired: true, absentReservation: null,
            fieldsByMap: BATTLE_RESERVATION_FIELDS,
            sourceTypesByMap: { nextObserverWillStoneByPlayer: 'OBSERVER_WILL', nextBoardExecutorStoneByPlayer: 'BOARD_EXECUTOR', nextTheoryIncarnationStoneByPlayer: 'THEORY_INCARNATION' },
            observerReference: 'repaymentId identifies a waiting, unplaced repayment; stolenCardId/copyId match that historical record, even after the stolen card is destroyed or used. repaymentIndex is a historical fallback index.',
            theoryReference: 'sessionId identifies the same owner state and theoryNumberCellsBySession entry. A THEORY_INCARNATION placement pending requires a non-null reservation for that session.',
            reviveMap: 'pendingStoneSalvationGodRevivesByPlayer', reviveEntriesRequired: ['row', 'col', 'owner', 'destroyedOwner', 'cause', 'reason', 'queuedTurnIndex'] },
        expansionGodDirectionKeys: ['up-left', 'up-right', 'down-right', 'down-left'],
        markerKinds: ['specialStone', 'manifestStone'], pendingStages: [null, 'selectTarget'],
        requiredSaveFields: ['formatVersion', 'rulesVersion', 'contentVersion', 'config', 'position', 'phase', 'cpuMemory'],
        requiredPositionFields: ['gameState', 'cardState', 'prngState'],
        eventPolicy: 'Logic events are ordered diagnostic records; playbackEvents use shared/playback-event-contract. Neither substitutes canonical state.'
    });
}
