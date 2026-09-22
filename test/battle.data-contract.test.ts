import {
    createBattle, restoreBattle, createBattleSave, validateBattleSave, validateBattleData, getBattleDataContract,
    computeBattleContentVersion, getBattleRuntimeCardDefinitions, BATTLE_CONTENT_VERSION, createBattleStorage
} from '../game/battle';
import Hash = require('../shared/state-hash');
import Cards = require('../game/logic/cards');
import { runBattleDataContractCli } from '../scripts/godot-data-contract';
import currentSave from './fixtures/battle-save-current-v1.json';
import { comparableProductionState } from '../src/engine/production-match';
import corpus from './fixtures/godot-conformance/expected.json';
import inputs from './fixtures/godot-conformance/cases.json';

const saved = () => JSON.parse(JSON.stringify(currentSave));

const reservationCases = [
    ['observer_will_01', 'nextObserverWillStoneByPlayer', 'OBSERVER_WILL', 1],
    ['board_executor_01', 'nextBoardExecutorStoneByPlayer', 'BOARD_EXECUTOR', 0],
    ['theory_incarnation_01', 'nextTheoryIncarnationStoneByPlayer', 'THEORY_INCARNATION', 0]
] as const;
function savedCase(cardId: string, index: number): any {
    const position: any = JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === `card/${cardId}/basic`)!.steps[index].state));
    return createBattleSave({ ...saved().config, seed: position.prngState.seed }, position, 'action');
}

test.each(reservationCases)('saved %s reservation survives restoration and manifests on the same placement', (cardId, field, type, index) => {
    const checkpoint = savedCase(cardId, index);
    expect(checkpoint.position.cardState[field].black).toMatchObject({ sourceType: type });
    const first = restoreBattle(checkpoint), second = restoreBattle(first.exportSave());
    const action = inputs.cases.find(item => item.id === `card/${cardId}/basic`)!.operations[index + 1].action!;
    const left = first.apply(action), right = second.apply(action);
    expect(left.ok).toBe(true); expect(right.ok).toBe(true);
    expect(right.events).toEqual(left.events); expect(second.exportSave()).toEqual(first.exportSave());
    expect(right.after.cardState[field].black).toBeNull();
    expect(right.after.cardState.markers).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'manifestStone', data: expect.objectContaining({ type }) })]));
});

test.each(reservationCases)('rejects missing or malformed %s reservation before runtime normalization loses it', (cardId, field, _type, index) => {
    for (const corrupt of [
        (cs: any) => { delete cs[field]; },
        (cs: any) => { delete cs[field].black; },
        (cs: any) => { cs[field] = 'invalid'; },
        (cs: any) => { cs[field].black = 'invalid'; },
        (cs: any) => { delete cs[field].black.sourceType; },
        (cs: any) => { cs[field].black.sourceType = 'REINCARNATION_WILL'; }
    ]) {
        const input = savedCase(cardId, index); corrupt(input.position.cardState);
        expect(() => restoreBattle(input)).toThrow();
    }
});

test('observer reservation survives destroying the stolen card, saving and resuming the next placement', () => {
    const battle = restoreBattle(savedCase('observer_will_01', 1));
    const reservation = battle.snapshot().cardState.nextObserverWillStoneByPlayer.black;
    expect(reservation.stolenCardId).toBe('udr_01');
    expect(battle.apply({ type: 'destroy_hand_card', destroyCardId: reservation.stolenCardId }).ok).toBe(true);
    const state = battle.snapshot().cardState;
    expect(state.hands.black).not.toContain(reservation.stolenCardId);
    expect(state.discard[state._discardCopyIds.indexOf(reservation.stolenCardCopyId)]).toBe(reservation.stolenCardId);
    expect(state.nextObserverWillStoneByPlayer.black).toEqual(reservation);
    const checkpoint = battle.exportSave(), resumed = restoreBattle(checkpoint);
    expect(resumed.exportSave()).toEqual(checkpoint);
    const placement = { type: 'place', row: 0, col: 1 };
    const left = battle.apply(placement), right = resumed.apply(placement);
    expect(left.ok).toBe(true); expect(right.ok).toBe(true);
    expect(right.events).toEqual(left.events); expect(resumed.exportSave()).toEqual(battle.exportSave());
    expect(right.after.cardState.nextObserverWillStoneByPlayer.black).toBeNull();
    expect(right.after.cardState.markers).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'manifestStone', data: expect.objectContaining({ type: 'OBSERVER_WILL', repaymentId: reservation.repaymentId, stolenCardCopyId: reservation.stolenCardCopyId }) })]));
});

test('each recorded pending type rejects the opposite stage, including null reincarnation stage', () => {
    const checked = new Set<string>();
    for (const example of corpus.cases) for (const step of example.steps) {
        const position: any = JSON.parse(JSON.stringify(step.state));
        const pending = position.cardState.pendingEffectByPlayer.black;
        if (!pending || checked.has(pending.type)) continue;
        checked.add(pending.type);
        pending.stage = pending.stage === null ? 'selectTarget' : null;
        expect(() => validateBattleData('position', position)).toThrow('pending');
    }
    expect(checked.has('REINCARNATION_WILL')).toBe(true);
    expect(checked.has('THEORY_INCARNATION')).toBe(true);
});

test('observer reservation identity and stolen-card references cannot be deleted or redirected', () => {
    const corruptions = [
        (cs: any) => { cs.nextObserverWillStoneByPlayer.black = null; },
        (cs: any) => { cs.observerWillRepaymentsByPlayer.black = []; },
        (cs: any) => { cs.nextObserverWillStoneByPlayer.black.repaymentId = 'observer_will_repay_white_1'; },
        (cs: any) => { cs.nextObserverWillStoneByPlayer.black.stolenCardId = 'free_01'; },
        (cs: any) => { cs.nextObserverWillStoneByPlayer.black.stolenCardCopyId = cs._nextCardCopySeq; },
        (cs: any) => { cs.observerWillRepaymentsByPlayer.black[0].status = 'unknown'; }
    ];
    for (const field of ['repaymentId', 'stolenCardId', 'stolenCardCopyId', 'repaymentIndex', 'createdTurnNumber'])
        corruptions.push((cs: any) => { delete cs.nextObserverWillStoneByPlayer.black[field]; });
    for (const corrupt of corruptions) {
        const input = savedCase('observer_will_01', 1); corrupt(input.position.cardState);
        expect(() => restoreBattle(input)).toThrow();
    }
});

test('theory reservations require intact owner state, session, cell records and references', () => {
    for (const corrupt of [
        (cs: any) => { delete cs.nextTheoryIncarnationStoneByPlayer.black.sessionId; },
        (cs: any) => { cs.nextTheoryIncarnationStoneByPlayer.black.sessionId = 'theory_white_1'; },
        (cs: any) => { delete cs.theoryIncarnationStateByPlayer; },
        (cs: any) => { cs.theoryIncarnationStateByPlayer.black = null; },
        (cs: any) => { delete cs.theoryIncarnationStateByPlayer.black.remainingSpawnCount; },
        (cs: any) => { delete cs.theoryNumberCellsBySession; },
        (cs: any) => { delete cs.theoryNumberCellsBySession.theory_black_1; },
        (cs: any) => { delete cs.theoryNumberCellsBySession.theory_black_1.cells; },
        (cs: any) => { Object.values<any>(cs.theoryNumberCellsBySession.theory_black_1.cells)[0].markerData.type = 'unknown'; },
        (cs: any) => { Object.values<any>(cs.theoryNumberCellsBySession.theory_black_1.cells)[0].sourceCardId = 'unknown'; },
        (cs: any) => { delete cs.theoryNumberCellByCell; },
        (cs: any) => { Object.values<any>(cs.theoryNumberCellByCell)[0].sessionId = 'theory_black_999'; }
    ]) {
        const input = savedCase('theory_incarnation_01', 0); corrupt(input.position.cardState);
        expect(() => restoreBattle(input)).toThrow();
    }
});

test('theory placement pending requires its reservation even when the reservation map retains a null slot', () => {
    const input = savedCase('theory_incarnation_01', 0);
    const cs = input.position.cardState;
    expect(cs.pendingEffectByPlayer.black).toMatchObject({ type: 'THEORY_INCARNATION', stage: null });
    expect(cs.theoryIncarnationStateByPlayer.black.sessionId).toBe(cs.nextTheoryIncarnationStoneByPlayer.black.sessionId);
    cs.nextTheoryIncarnationStoneByPlayer.black = null;
    expect(() => createBattleSave(input.config, input.position, 'action')).toThrow('theory pending reservation');
    expect(() => restoreBattle(input)).toThrow('theory pending reservation');
});

test('salvation revive reservation containers and work placement flags cannot silently default', () => {
    for (const field of ['pendingStoneSalvationGodRevivesByPlayer', 'workNextPlacementArmedByPlayer']) {
        for (const corrupt of [
            (cs: any) => { delete cs[field]; }, (cs: any) => { delete cs[field].black; },
            (cs: any) => { cs[field].black = 'invalid'; }
        ]) {
            const input = saved(); corrupt(input.position.cardState); expect(() => restoreBattle(input)).toThrow();
        }
    }
    const input = saved();
    const entry = { row: 3, col: 4, owner: 'black', destroyedOwner: 'white', cause: 'DESTROY_ONE_STONE', reason: 'destroy', queuedTurnIndex: 6 };
    input.position.cardState.pendingStoneSalvationGodRevivesByPlayer.black = [entry];
    expect(restoreBattle(input).exportSave().position.cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([entry]);
    for (const key of ['row', 'col', 'owner', 'destroyedOwner', 'cause', 'reason', 'queuedTurnIndex']) {
        const broken = JSON.parse(JSON.stringify(input)); delete broken.position.cardState.pendingStoneSalvationGodRevivesByPlayer.black[0][key];
        expect(() => restoreBattle(broken)).toThrow();
    }
});

test('expansion god preserves corner direction during a saved multi-selection and rejects direction loss', () => {
    const example = corpus.cases.find(item => item.id === 'card/board_expand_god_01/basic')!;
    const index = example.steps.findIndex(step => (step.state.cardState.pendingEffectByPlayer.black as any)?.selectedCount === 1);
    const checkpoint = savedCase('board_expand_god_01', index);
    const left = restoreBattle(checkpoint), right = restoreBattle(left.exportSave());
    const action = inputs.cases.find(item => item.id === example.id)!.operations[index + 1].action!;
    expect(left.apply(action).ok).toBe(true); expect(right.apply(action).ok).toBe(true);
    expect(right.exportSave()).toEqual(left.exportSave());
    for (const direction of [undefined, null, 'up', 'unknown']) {
        const corrupt = JSON.parse(JSON.stringify(checkpoint));
        const target = corrupt.position.cardState.pendingEffectByPlayer.black.selectedTargets[0];
        if (direction === undefined) delete target.directionKey; else target.directionKey = direction;
        expect(() => restoreBattle(corrupt)).toThrow('pending expansion direction');
    }
});

test('content identity ignores only declared presentation fields; rules fields and catalog order remain significant', () => {
    const cards = getBattleRuntimeCardDefinitions();
    expect(computeBattleContentVersion(cards.map((card: any) => ({ ...card, name: '表示', desc: '説明', display_type_ja: '種類', card_face_art_path: 'new.png' })))).toBe(BATTLE_CONTENT_VERSION);
    expect(computeBattleContentVersion(cards.map((card: any, i: number) => i ? card : { ...card, cost: card.cost + 1 }))).not.toBe(BATTLE_CONTENT_VERSION);
    expect(computeBattleContentVersion([...cards].reverse())).not.toBe(BATTLE_CONTENT_VERSION);
    expect(computeBattleContentVersion(cards.map((card: any) => ({ ...card, futureRuleField: true })))).not.toBe(BATTLE_CONTENT_VERSION);
});

test('only the inspected identical-rules legacy digest migrates, without mutating saved input', () => {
    const input = saved(); input.contentVersion = 'fnv1a32:f89cfb79';
    const migrated = validateBattleSave(input);
    expect(migrated.contentVersion).toBe(BATTLE_CONTENT_VERSION);
    expect(migrated.position).toEqual(input.position);
    expect(input.contentVersion).toBe('fnv1a32:f89cfb79');
    for (const contentVersion of ['fnv1a32:fce6c0f5', 'fnv1a32:ffffffff']) expect(() => validateBattleSave({ ...input, contentVersion })).toThrow('Incompatible');
    expect(() => validateBattleSave({ ...input, rulesVersion: 'future' })).toThrow('Incompatible');
});

test('known legacy browser descriptors migrate to canonical IDs; current and malformed descriptors are rejected', () => {
    const input = saved(); input.contentVersion = 'fnv1a32:f89cfb79';
    const descriptor = { id: 'reincarnation_will_01', name: '転生の意志', desc: '保存時の表示説明' };
    input.position.cardState.lastUsedCardByPlayer.black = descriptor;
    const migrated = validateBattleSave(input);
    expect(migrated.contentVersion).toBe(BATTLE_CONTENT_VERSION);
    expect(migrated.position.cardState.lastUsedCardByPlayer.black).toBe('reincarnation_will_01');
    expect(restoreBattle(input).exportSave()).toEqual(migrated);
    expect(input.position.cardState.lastUsedCardByPlayer.black).toEqual(descriptor);
    expect(() => validateBattleSave({ ...input, contentVersion: BATTLE_CONTENT_VERSION })).toThrow('last-used card');
    for (const invalid of [
        { ...descriptor, id: 'unknown_01' }, { id: descriptor.id, name: descriptor.name },
        { ...descriptor, name: 123 }, { ...descriptor, desc: null }, { ...descriptor, futureField: true }, [descriptor]
    ]) {
        const corrupt = JSON.parse(JSON.stringify(input)); corrupt.position.cardState.lastUsedCardByPlayer.black = invalid;
        expect(() => validateBattleSave(corrupt)).toThrow('legacy last-used card descriptor');
    }
    expect(() => validateBattleSave({ ...input, contentVersion: 'fnv1a32:ffffffff' })).toThrow('Incompatible');
});

test('all recorded card and topology boundaries satisfy the public saved-position contract', () => {
    for (const example of corpus.cases) for (const [index, step] of example.steps.entries()) {
        try { validateBattleData('position', step.state); }
        catch (error) { throw new Error(`${example.id} step ${index}: ${(error as Error).message}`); }
    }
});

test.each(['selectedTargets', 'selectedCount', 'maxSelections'])('multi-selection save refuses missing %s rather than silently resetting progress', field => {
    const example = corpus.cases.find(item => item.id === 'card/board_shrink_01/basic')!;
    const position = JSON.parse(JSON.stringify(example.steps[1].state));
    expect(position.cardState.pendingEffectByPlayer.black.selectedCount).toBe(1);
    expect(() => validateBattleData('position', position)).not.toThrow();
    delete position.cardState.pendingEffectByPlayer.black[field];
    expect(() => validateBattleData('position', position)).toThrow('pending');
});

test.each([
    ['observer_will_01', 'offers'], ['condemn_01', 'offers'], ['heaven_01', 'offers'],
    ['last_resort_01', 'placementsRemaining'], ['reincarnation_will_01', 'cardId']
])('pending %s refuses missing %s instead of losing the selection or replenishing remaining placements', (cardId, field) => {
    const example = corpus.cases.find(item => item.id === `card/${cardId}/basic`)!;
    const position = JSON.parse(JSON.stringify(example.steps[0].state));
    expect(() => validateBattleData('position', position)).not.toThrow();
    delete position.cardState.pendingEffectByPlayer.black[field];
    expect(() => validateBattleData('position', position)).toThrow('pending');
});

test('generated cards remain valid in saves and actions while initial-deck eligibility stays separate', () => {
    const battle = createBattle({ version: 1, battleId: 'derived-roundtrip', seed: 319,
        players: { black: { controller: 'human', deckCardIds: ['double_chain_01'], initialCharge: 99 }, white: { controller: 'human', deckCardIds: [] } } });
    battle.startTurn(); const initial = battle.exportSave(); initial.position.gameState.turnNumber = 6;
    const active = restoreBattle(initial);
    expect(active.apply({ type: 'use_card', useCardId: 'double_chain_01' }).ok).toBe(true);
    const save = active.exportSave(); expect(save.position.cardState.hands.black).toContain('triple_chain_01');
    expect(restoreBattle(save).exportSave()).toEqual(save);
    expect(validateBattleData('action', { type: 'use_card', useCardId: 'triple_chain_01' })).toEqual({ type: 'use_card', useCardId: 'triple_chain_01' });
    expect(() => createBattle({ version: 1, battleId: 'invalid-initial-derived', seed: 1,
        players: { black: { controller: 'human', deckCardIds: ['triple_chain_01'] } } })).toThrow('deckCardIds');
});

const corruptions: Array<[string, (save: any) => void]> = [
    ['unknown pending', s => { s.position.cardState.pendingEffectByPlayer.black = { type: 'NO_SUCH_EFFECT', stage: 'selectTarget' }; }],
    ['unknown stage', s => { s.position.cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', stage: 'anything' }; }],
    ['pending card mismatch', s => { s.position.cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', cardId: 'free_01', stage: 'selectTarget' }; }],
    ['unknown active effect', s => { s.position.cardState.activeEffectsByPlayer.black = [{ type: 'UNKNOWN' }]; }],
    ['negative turn count', s => { s.position.cardState.turnCountByPlayer.black = -1; }],
    ['fractional placement count', s => { s.position.cardState.extraPlaceRemainingByPlayer.white = 0.5; }],
    ['string boolean', s => { s.position.cardState.infinitePlaceActiveByPlayer.black = 'false'; }],
    ['invalid fate controller', s => { s.position.cardState.fateWillControllerByTurnOwner.white = 'red'; }],
    ['invalid repayment', s => { s.position.cardState.riboRepaymentsByPlayer.black = [{ remainingOwnerTurns: -1, repaymentAmount: 1, shortageDestroyCount: 1 }]; }],
    ['stale cost identity', s => { s.position.cardState.cardCostOverridesByCopyId['999999'] = { cost: 0, sourceType: 'OBSERVER_WILL' }; }],
    ['stale revealed identity', s => { s.position.cardState._revealedHandCopyIdsByViewer.black = [999999]; }],
    ['stale expansion identity', s => { s.position.cardState.expansionStoneIdByCell['-1,0'] = 's50'; }],
    ['stone sequence collision', s => { s.position.cardState._nextStoneId = 1; }],
    ['duplicate stone identity', s => { s.position.cardState.stoneIdMap[3][4] = s.position.cardState.stoneIdMap[3][3]; }],
    ['invalid number-cell key', s => { s.position.cardState.boardBonusByCell['0.5,1'] = 5; }],
    ['invalid number-cell amount', s => { s.position.cardState.boardBonusByCell['0,0'] = -1; }],
    ['sparse array', s => { s.position.cardState.markers = new Array(1); }]
];
test.each(corruptions)('rejects malformed save: %s', (_name, corrupt) => {
    const input = saved(); corrupt(input); expect(() => restoreBattle(input)).toThrow();
});

test.each(['type', 'kind', 'owner', 'remainingOwnerTurns', 'id', 'stoneId'])('rejects malformed marker %s', field => {
    const input = saved(); const cs = input.position.cardState;
    const marker = Cards.addMarker(cs, 'specialStone', 3, 4, 'black', { type: 'GHOST', remainingOwnerTurns: 3 }, { emitStatusApplied: false });
    expect(() => validateBattleSave(input)).not.toThrow();
    if (field === 'type') marker.data.type = 'UNKNOWN';
    if (field === 'kind') marker.kind = 'UNKNOWN';
    if (field === 'owner') marker.owner = 'red';
    if (field === 'remainingOwnerTurns') marker.data.remainingOwnerTurns = -1;
    if (field === 'id') marker.id = cs._nextMarkerId;
    if (field === 'stoneId') marker.data.stoneId = 's999999';
    expect(() => validateBattleSave(input)).toThrow();
});

test('転生の意志 pending save preserves RNG, candidate result, events and completed turn start', () => {
    const battle = createBattle({ version: 1, battleId: 'reincarnation-roundtrip', seed: 319,
        players: { black: { controller: 'human', deckCardIds: ['reincarnation_will_01'], initialCharge: 99 }, white: { controller: 'human', deckCardIds: [] } } });
    battle.startTurn(); const checkpoint = battle.exportSave(); checkpoint.position.gameState.turnNumber = 6;
    Cards.addMarker(checkpoint.position.cardState, 'specialStone', 3, 4, 'black', { type: 'GHOST', remainingOwnerTurns: 3 }, { emitStatusApplied: false });
    const left = restoreBattle(checkpoint);
    expect(left.apply({ type: 'use_card', useCardId: 'reincarnation_will_01', useCardHandIndex: 0, useCardOwnerKey: 'black' }).ok).toBe(true);
    const pending = left.exportSave(), right = restoreBattle(pending);
    expect(right.startTurn()).toBeNull(); expect(right.exportSave()).toEqual(pending);
    const action = { type: 'place', reincarnationTarget: { row: 3, col: 4 } };
    const one = left.apply(action), two = right.apply(action);
    expect(one.ok).toBe(true); expect(two.ok).toBe(true);
    expect(two.events).toEqual(one.events); expect(two.reason).toBe(one.reason);
    // Save boundaries omit transient presentation queues, including from `before`.
    expect(comparableProductionState(two.after)).toEqual(comparableProductionState(one.after));
    expect(right.exportSave()).toEqual(left.exportSave());
});

test('contract and CLI reject malformed public data without accepting debug authority overrides', () => {
    expect(getBattleDataContract()).toMatchObject({ contractVersion: 1, contentVersion: BATTLE_CONTENT_VERSION });
    expect(validateBattleData('action', { type: 'place', row: 2, col: 3 })).toEqual({ type: 'place', row: 2, col: 3 });
    for (const action of [{ type: 'place', row: '2', col: 3 }, { type: 'pass', forcePass: true }, { type: 'use_card' }, { type: 'place', destroyTarget: null }]) {
        expect(() => validateBattleData('action', action)).toThrow();
    }
    expect(() => validateBattleData('result', { black: 1, white: 2, winner: 'black', turnNumber: 60, endedBy: 'consecutive_passes' })).toThrow();
    expect(() => validateBattleData('playbackEvents', [{ type: 'flip', phase: 0, targets: [{ row: 3, col: 4 }] }])).toThrow();
    expect(runBattleDataContractCli(['validate', 'save', 'test/fixtures/battle-save-current-v1.json'])).toMatchObject({ ok: true });
    expect(() => runBattleDataContractCli(['validate', 'save', 'test/fixtures/battle-save-v1.json'])).toThrow('Incompatible');
});

test('standalone normal and malformed JSON examples use the same CLI validator', () => {
    for (const [kind, file] of [['config', 'config-valid'], ['action', 'action-valid'], ['result', 'result-valid'], ['playbackEvents', 'playback-valid']]) {
        expect(runBattleDataContractCli(['validate', kind, `test/fixtures/battle-contract/${file}.json`])).toMatchObject({ ok: true });
    }
    for (const [kind, file] of [['action', 'action-invalid'], ['result', 'result-invalid'], ['playbackEvents', 'playback-invalid'], ['save', 'save-invalid']]) {
        expect(() => runBattleDataContractCli(['validate', kind, `test/fixtures/battle-contract/${file}.json`])).toThrow();
    }
});

test('a future compatible-checksum generation prevents recovery or overwrite by an older runtime', async () => {
    const values = new Map<string, string>();
    const storage = createBattleStorage({ read: key => values.get(key) ?? null,
        write: (key, value) => { values.set(key, value); }, exclusive: async (_key, work) => work() }, 'future');
    expect((await storage.save(saved())).ok).toBe(true);
    const future = { ...saved(), formatVersion: 99 };
    values.set('future:b', JSON.stringify({ data: future, checksum: Hash.computeStableHash(future) }));
    values.set('future:manifest', JSON.stringify({ version: 1, current: 'b', previous: 'a' }));
    const before = [...values.entries()];
    expect(await storage.load()).toMatchObject({ ok: false });
    expect(await storage.save(saved())).toMatchObject({ ok: false });
    expect([...values.entries()]).toEqual(before);
});
