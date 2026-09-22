import baseline from './fixtures/battle-before-refactor.json';
import { createBattle, restoreBattle, serializeBattleSave, parseBattleSave } from '../game/battle';
import { comparableProductionState } from '../src/engine/production-match';
import Hash = require('../shared/state-hash');
import initialSave from './fixtures/battle-save-v1.json';
import currentSave from './fixtures/battle-save-current-v1.json';
import currentBaseline from './fixtures/battle-replay-current-v1.json';
import { BATTLE_CONTENT_VERSION, BattleSaveCompatibilityError } from '../game/battle';

test('historical pre-Reincarnation save is explicitly incompatible and remains archived unchanged', () => {
    expect(initialSave.contentVersion).toBe('fnv1a32:fce6c0f5');
    expect(() => restoreBattle(initialSave as any)).toThrow(BattleSaveCompatibilityError);
    expect(baseline.sourceCommit).toBe('592359fec1b263ab8c2c652c5fbe232ef848ecca');
    // Adding a default-deck candidate changes shuffle calls and the following number cells.
    const now = createBattle({ version: 1, battleId: 'baseline', seed: baseline.seed,
        players: { black: { controller: 'human', profile: '10' }, white: { controller: 'cpu', profile: '10' } } });
    const after = now.startTurn()!.after;
    expect(baseline.records[0].prng.calls).toBe(273);
    expect(after.prngState.calls).toBe(275);
    expect(Hash.computeStableHash(comparableProductionState(after))).not.toBe(baseline.records[0].hash);
});

test('current format-1 save restores without applying its completed first turn again', () => {
    expect(currentSave.contentVersion).toBe(BATTLE_CONTENT_VERSION);
    const saved = restoreBattle(currentSave as any);
    expect(saved.currentPhase).toBe('action');
    expect(saved.startTurn()).toBeNull();
    expect(saved.exportSave()).toEqual(currentSave);
});

test('current-catalog replay retains full state, events and RNG across rejection, placements, passes and restoration', () => {
    expect(currentBaseline.contentVersion).toBe(BATTLE_CONTENT_VERSION);
    let battle = createBattle(currentBaseline.config as any);
    for (const expected of currentBaseline.records) {
        const transition = expected.kind === 'turn_start' ? battle.startTurn() : battle.apply((expected as any).action);
        // The old driver can ask for a turn start twice during multi-stage selection.
        const after = transition?.after || battle.snapshot();
        expect(Hash.computeStableHash(comparableProductionState(after))).toBe(expected.hash);
        expect(comparableProductionState(after)).toEqual(expected.after);
        expect(after.prngState).toEqual(expected.prng);
        if (transition) {
            expect(transition.ok).toBe(expected.ok); expect(transition.reason).toBe(expected.reason);
            expect(transition.events).toEqual(expected.events);
        }
        const saved = parseBattleSave(serializeBattleSave(battle.exportSave()));
        battle.dispose(); battle = restoreBattle(saved);
    }
    expect(battle.result()).toEqual(currentBaseline.result);
});
