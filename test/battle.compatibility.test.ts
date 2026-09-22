import baseline from './fixtures/battle-before-refactor.json';
import { createBattle, restoreBattle, serializeBattleSave, parseBattleSave } from '../game/battle';
import { comparableProductionState } from '../src/engine/production-match';
import Hash = require('../shared/state-hash');
import initialSave from './fixtures/battle-save-v1.json';

test('format-1 save fixture restores without applying its completed first turn again', () => {
    const saved = restoreBattle(initialSave as any);
    expect(saved.currentPhase).toBe('action');
    expect(saved.startTurn()).toBeNull();
    expect(saved.exportSave()).toEqual(initialSave);
});

test('pre-refactor replay retains all committed state and RNG across card selection, passes and restoration', () => {
    let battle = createBattle({ version: 1, battleId: 'baseline', seed: baseline.seed,
        players: { black: { controller: 'human', profile: '10' }, white: { controller: 'cpu', profile: '10' } } });
    for (const expected of baseline.records) {
        const transition = expected.kind === 'turn_start' ? battle.startTurn() : battle.apply((expected as any).action);
        // The old driver can ask for a turn start twice during multi-stage selection.
        const after = transition?.after || battle.snapshot();
        expect(Hash.computeStableHash(comparableProductionState(after))).toBe(expected.hash);
        expect(after.prngState).toEqual(expected.prng);
        if (transition) { expect(transition.ok).toBe(expected.ok); expect(transition.reason).toBe(expected.reason); }
        const saved = parseBattleSave(serializeBattleSave(battle.exportSave()));
        battle.dispose(); battle = restoreBattle(saved);
    }
    expect(battle.result()).not.toBeNull();
});
