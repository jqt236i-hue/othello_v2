import { createBattle, restoreBattle, prepareBattle, serializeBattleSave, parseBattleSave, createBattleStorage } from '../game/battle';
import { createProductionPosition, ProductionMatch, productionStateKey } from '../src/engine/production-match';
import type { BattleConfig } from '../shared/battle/config';
import Core = require('../game/logic/core');
import Pipeline = require('../game/turn/turn_pipeline');
import Prng = require('../game/schema/prng');
import { createBattleSave, validateBattleSave } from '../shared/battle/save';

const config = (): BattleConfig => ({ version: 1, battleId: 'chapter-1-fight-1', seed: 914001,
    players: { black: { controller: 'human', profile: '10' }, white: { controller: 'cpu', profile: '10' } } });

test('product initialization retains production decks, privileges, RNG, and first-turn semantics', () => {
    const product = createBattle(config());
    const production = new ProductionMatch(createProductionPosition(914001, { black: 10, white: 10 }));
    expect(productionStateKey(product.snapshot())).toBe(productionStateKey(production.snapshot()));
    product.startTurn(); production.startTurn();
    expect(productionStateKey(product.snapshot())).toBe(productionStateKey(production.snapshot()));
    expect(product.startTurn()).toBeNull();
    expect(product.snapshot().cardState.hands.black).toHaveLength(1);
});

test('explicit zero and empty decks override profiles; invalid configuration fails before creation', () => {
    const cfg = config(); cfg.players!.black = { controller: 'human', profile: '10', deckCardIds: [], initialCharge: 0, chargeGainMultiplier: 1 };
    const result = prepareBattle(cfg);
    expect(result.position.cardState.decks.black).toEqual([]);
    expect(result.position.cardState.charge.black).toBe(0);
    expect(result.position.cardState.chargeGainMultiplierByPlayer.black).toBe(1);
    expect(() => prepareBattle({ ...cfg, seed: NaN })).toThrow();
    expect(() => prepareBattle({ ...cfg, players: { white: { controller: 'cpu', profile: 'not-a-profile' } } })).toThrow();
    expect(() => prepareBattle({ ...cfg, players: { white: { controller: 'cpu', deckCardIds: ['missing-card'] } } })).toThrow();
});

test('custom opening generates matching stone identities and uses canonical terminal passes', () => {
    const cfg = config();
    cfg.players = { black: { controller: 'human', deckCardIds: [] }, white: { controller: 'human', deckCardIds: [] } };
    cfg.initialLayout = { stones: Array.from({ length: 64 }, (_, n) => ({ row: Math.floor(n / 8), col: n % 8, owner: 1 as const })) };
    const battle = createBattle(cfg);
    expect(battle.result()).toBeNull();
    expect(battle.snapshot().cardState.stoneIdMap.flat().filter(Boolean)).toHaveLength(64);
    battle.startTurn(); expect(battle.apply({ type: 'pass' }).ok).toBe(true);
    expect(battle.result()).toBeNull();
    battle.startTurn(); expect(battle.apply({ type: 'pass' }).ok).toBe(true);
    expect(battle.result()).toMatchObject({ winner: 'black', black: 64, white: 0 });
    expect(restoreBattle(parseBattleSave(serializeBattleSave(battle.exportSave()))).result()).toEqual(battle.result());
});

test('fresh-runtime save restoration preserves every next boundary, including pending selection', () => {
    const battle = createBattle(config()); battle.startTurn();
    let saved = battle.exportSave();
    // A card-selection fixture starts at a valid committed boundary.
    saved.position.gameState.turnNumber = 6;
    saved.position.cardState.hands.black = ['destroy_01'];
    saved.position.cardState._handCopyIdsByPlayer.black = [saved.position.cardState._nextCardCopySeq++];
    const left = restoreBattle(saved);
    expect(left.apply({ type: 'use_card', useCardId: 'destroy_01', useCardHandIndex: 0, useCardOwnerKey: 'black' }).ok).toBe(true);
    const pending = left.snapshot().cardState.pendingEffectByPlayer.black;
    expect(pending).toBeTruthy();
    const right = restoreBattle(parseBattleSave(serializeBattleSave(left.exportSave())));
    const target = { type: 'place', destroyTarget: { row: 3, col: 3 } };
    expect(left.apply(target).ok).toBe(true); expect(right.apply(target).ok).toBe(true);
    expect(productionStateKey(right.snapshot())).toBe(productionStateKey(left.snapshot()));
    const move = Core.getLegalMoves(left.snapshot().gameState, 1)[0];
    const action = { type: 'place', row: move.row, col: move.col };
    left.apply(action); right.apply(action); left.startTurn(); right.startTurn();
    expect(productionStateKey(right.snapshot())).toBe(productionStateKey(left.snapshot()));
    left.dispose(); left.dispose(); expect(() => left.apply(action)).toThrow('disposed');
});

test('bad save versions, corrupt envelopes, excessive PRNG work and partial state are rejected', () => {
    const save = createBattle(config()).exportSave();
    expect(() => restoreBattle({ ...save, formatVersion: 2 } as any)).toThrow('version');
    expect(() => parseBattleSave(serializeBattleSave(save).replace('chapter-1', 'chapter-9'))).toThrow('Damaged');
    save.position.prngState.calls = 1e12;
    expect(() => restoreBattle(save)).toThrow('checkpoint');
    save.position.prngState.calls = 0;
    delete save.position.cardState.pendingEffectByPlayer;
    expect(() => restoreBattle(save)).toThrow('Incomplete');
});

test('live pending state saves optional undefined fields without weakening external JSON validation', () => {
    const battle = createBattle(config()); battle.startTurn();
    const source = battle.exportSave(), position = source.position;
    position.gameState.turnNumber = 6;
    position.cardState.hands.black = ['destroy_01'];
    position.cardState._handCopyIdsByPlayer.black = [position.cardState._nextCardCopySeq++];
    const rng = Prng.fromState(position.prngState);
    const result = Pipeline.applyTurnSafe(position.cardState, position.gameState, 'black',
        { type: 'use_card', useCardId: 'destroy_01', useCardHandIndex: 0, useCardOwnerKey: 'black' }, rng, { skipTurnStart: true });
    expect(result.ok).toBe(true);
    const pending = result.cardState.pendingEffectByPlayer.black;
    expect(Object.values(pending)).toContain(undefined);
    const saved = createBattleSave(source.config, { gameState: result.gameState, cardState: result.cardState, prngState: rng.getState() }, 'action');
    expect(Object.values(saved.position.cardState.pendingEffectByPlayer.black)).not.toContain(undefined);
    expect(restoreBattle(saved).apply({ type: 'place', destroyTarget: { row: 3, col: 3 } }).ok).toBe(true);
    saved.position.cardState.pendingEffectByPlayer.black.unknown = undefined;
    expect(() => validateBattleSave(saved)).toThrow('plain battle data');
});

test('failed shadow writes preserve the last committed save and corrupted latest save recovers the previous one', async () => {
    const values = new Map<string, string>(); let fail = false;
    const port = { read: (key: string) => values.get(key) ?? null,
        write: (key: string, value: string) => { if (fail) throw new Error('disk full'); values.set(key, value); },
        exclusive: async <T>(_key: string, work: () => Promise<T>) => work() };
    const storage = createBattleStorage(port, 'story.slot1');
    const first = createBattle(config()); const before = first.exportSave();
    expect((await storage.save(before)).ok).toBe(true);
    first.startTurn(); fail = true;
    expect((await storage.save(first.exportSave())).ok).toBe(false);
    expect(await storage.load()).toMatchObject({ ok: true, value: before });
    fail = false; expect((await storage.save(first.exportSave())).ok).toBe(true);
    values.set('story.slot1:b', 'broken');
    expect(await storage.load()).toMatchObject({ ok: true, value: before, recovered: true });
    // A failed manifest commit after recovery must not overwrite the only good slot.
    const write = port.write;
    port.write = (key, value) => { if (key.endsWith(':manifest')) throw new Error('commit interrupted'); write(key, value); };
    expect((await storage.save(first.exportSave())).ok).toBe(false);
    expect(await storage.load()).toMatchObject({ ok: true, value: before, recovered: true });
    values.set('story.slot1:b', 'broken');
    expect(await storage.load()).toMatchObject({ ok: true, value: before, recovered: true });
});
