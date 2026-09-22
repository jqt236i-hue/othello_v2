#!/usr/bin/env node
/** Portable golden cases use the public battle transition boundary. No renderer,
 * wall clock, CPU inference or new rule simulator participates in replay. */
import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert/strict');
import { BattleMatch, createBattle } from '../game/battle';
import { cloneBattle, type CompleteBattlePosition, type BattleAction } from '../shared/battle/types';
import { createProductionCardFixture, productionFixtureCardIds } from './production-card-fixtures';
import { enumerateLv10Actions } from '../game/ai/cpu-lv10-position';
import { productionStateKey } from '../src/engine/production-match';
import Shared = require('../shared-constants');
import Hash = require('../shared/state-hash');
import Core = require('../game/logic/core');
import MarkerPhase = require('../game/turn/turn-start/marker-phase');
import MarkerFactory = require('../game/logic/card-resolution/special-stone-marker-factory');
import SpecialRegistry = require('../shared/special-stone-registry-static');
const Cards: any = require('../game/logic/cards');
const Prng: any = require('../game/schema/prng');

export const CONFORMANCE_SCHEMA = 'godot-conformance.v1';
export const FIXTURE_DIRECTORY = path.resolve(__dirname, '../../test/fixtures/godot-conformance');
export type Operation = { kind: 'turn_start' } | { kind: 'action'; action: BattleAction };
export type ConformanceCase = { id: string; cardId?: string; tags: string[]; spec: string;
    initial: CompleteBattlePosition; operations: Operation[] };
export type CaseOutput = { id: string; steps: any[] };
export type Difference = { caseId: string; step: number | null; path: string; expected?: any; actual?: any };

export function replayCase(input: ConformanceCase): CaseOutput {
    const match = new BattleMatch(input.initial);
    try {
        return { id: input.id, steps: input.operations.map(operation => {
            const transition = operation.kind === 'turn_start' ? match.startTurn() : match.apply(operation.action);
            return cloneBattle({ kind: transition.kind, player: transition.player, ok: transition.ok,
                reason: transition.reason, stopAction: transition.stopAction ?? false, events: transition.events,
                state: transition.after, stateHash: Hash.computeStableHash(transition.after),
                result: match.terminal ? match.result() : null });
        }) };
    } finally { match.dispose(); }
}

/** Compare every JSON field, including null/absent, event order and extra keys.
 * Object member order is immaterial; array order always remains significant. */
export function jsonDifferences(expected: any, actual: any, pointer = ''): { path: string; expected?: any; actual?: any }[] {
    if (Object.is(expected, actual)) return [];
    if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object'
        || Array.isArray(expected) !== Array.isArray(actual)) return [{ path: pointer || '/', expected, actual }];
    const differences: { path: string; expected?: any; actual?: any }[] = [];
    if (Array.isArray(expected) && expected.length !== actual.length) differences.push({ path: pointer + '/length', expected: expected.length, actual: actual.length });
    for (const key of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) {
        const next = pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
        if (!Object.prototype.hasOwnProperty.call(expected, key) || !Object.prototype.hasOwnProperty.call(actual, key)) differences.push({ path: next, expected: expected[key], actual: actual[key] });
        else differences.push(...jsonDifferences(expected[key], actual[key], next));
        if (differences.length >= 100) return differences.slice(0, 100);
    }
    return differences;
}

export function compareOutputs(expected: any, actual: any): Difference[] {
    if (!expected || expected.schema !== CONFORMANCE_SCHEMA || !Array.isArray(expected.cases)) throw new Error('Invalid reference schema');
    if (!actual || actual.schema !== CONFORMANCE_SCHEMA || !Array.isArray(actual.cases)) throw new Error('Invalid candidate schema');
    const expectedMap = new Map<string, CaseOutput>(), actualMap = new Map<string, CaseOutput>();
    for (const [list, map] of [[expected.cases, expectedMap], [actual.cases, actualMap]] as const) for (const item of list) {
        if (!item || typeof item.id !== 'string' || !Array.isArray(item.steps)) throw new Error('Invalid case output');
        if (map.has(item.id)) throw new Error(`Duplicate case: ${item.id}`);
        map.set(item.id, item);
    }
    const differences: Difference[] = [];
    for (const id of [...new Set([...expectedMap.keys(), ...actualMap.keys()])]) {
        if (!expectedMap.has(id) || !actualMap.has(id)) { differences.push({ caseId: id, step: null, path: '/', expected: expectedMap.has(id) ? 'present' : 'absent', actual: actualMap.has(id) ? 'present' : 'absent' }); continue; }
        for (const difference of jsonDifferences(expectedMap.get(id), actualMap.get(id))) {
            const index = /^\/steps\/(\d+)(?:\/|$)/.exec(difference.path);
            differences.push({ caseId: id, step: index ? Number(index[1]) : null, ...difference });
        }
    }
    return differences;
}

function cardCase(cardId: string, fusion = false): ConformanceCase {
    const initial = createProductionCardFixture(cardId, 'black', fusion), operations: Operation[] = [];
    // The older internal production fixture numbers identities. The public
    // save/data contract uses sN and null; normalize before any transition.
    initial.cardState.stoneIdMap = initial.cardState.stoneIdMap.map((row: number[]) => row.map(id => id ? `s${id}` : null));
    if (cardId === 'chest_01' || cardId === 'ribo_01') initial.cardState.charge.black = 10;
    const match = new BattleMatch(initial);
    const use = enumerateLv10Actions(initial).find(action => action.useCardId === cardId);
    assert.ok(use, `Card not usable in fixture: ${cardId}`);
    operations.push({ kind: 'action', action: use }); assert.ok(match.apply(use).ok);
    let completed = false;
    for (let index = 0; index < 120 && !match.terminal; index++) {
        const before = match.snapshot();
        if (before.gameState.turnNumber > initial.gameState.turnNumber || match.owner !== 'black') completed = true;
        if (before.cardState.lastTurnStartedFor !== match.owner) {
            operations.push({ kind: 'turn_start' }); match.startTurn();
            // Include the next owner turn: placement-triggered and owner-start
            // effects are both represented, without a long arbitrary rollout.
            if (completed && match.owner === 'black') break;
            if (match.terminal) break;
        }
        const current = match.snapshot();
        const choice = enumerateLv10Actions(current, { allowCards: false }).find(action => {
            const trial = new BattleMatch(current);
            try { return trial.apply(action).ok && productionStateKey(trial.snapshot()) !== productionStateKey(current); }
            finally { trial.dispose(); }
        });
        assert.ok(choice, `No progressing fixture continuation: ${cardId}`);
        operations.push({ kind: 'action', action: choice }); assert.ok(match.apply(choice).ok);
    }
    assert.ok(completed || match.terminal, `Card turn incomplete: ${cardId}`);
    match.dispose();
    return { id: fusion ? 'interaction/four-element-fusion' : `card/${cardId}/basic`, cardId,
        tags: fusion ? ['interaction', 'fusion'] : ['card-basic'], spec: '正本/カード仕様正本.md', initial, operations };
}

function ordinaryInitial(): CompleteBattlePosition {
    const battle = createBattle({ version: 1, battleId: 'godot-conformance', seed: 914071,
        players: { black: { controller: 'human', deckCardIds: [] }, white: { controller: 'human', deckCardIds: [] } } });
    battle.startTurn(); const initial = battle.snapshot(); battle.dispose(); return initial;
}

export function buildCases(): ConformanceCase[] {
    const cases: ConformanceCase[] = [];
    for (const cardId of productionFixtureCardIds()) {
        const basic = cardCase(cardId); cases.push(basic);
        // A turn has exactly one card use. This refusal is valid for zero-cost,
        // special and derived cards as well as ordinary paid cards.
        const initial = cloneBattle(basic.initial); initial.cardState.hasUsedCardThisTurnByPlayer.black = true;
        cases.push({ id: `card/${cardId}/rejected`, cardId, tags: ['card-rejection', 'rejection'],
            spec: '01-rulebook.md §5', initial, operations: [basic.operations[0]] });
    }
    cases.push(cardCase('fire_will_01', true));
    const full = ordinaryInitial();
    full.gameState.board = full.gameState.board.map((row: number[]) => row.map(() => 1));
    full.cardState.stoneIdMap = full.gameState.board.map((row: number[], r: number) => row.map((_v: number, c: number) => `s${r * row.length + c + 1}`));
    full.cardState._nextStoneId = 65;
    cases.push({ id: 'boundary/consecutive-passes', tags: ['consecutive-passes'], spec: '01-rulebook.md §2.6', initial: full,
        operations: [{ kind: 'action', action: { type: 'pass' } }, { kind: 'turn_start' }, { kind: 'action', action: { type: 'pass' } }] });
    cases.push({ id: 'boundary/illegal-placement', tags: ['rejection'], spec: '01-rulebook.md §2.2', initial: ordinaryInitial(),
        operations: [{ kind: 'action', action: { type: 'place', row: 3, col: 3 } }, { kind: 'action', action: { type: 'pass' } }] });
    const ghost = ordinaryInitial();
    ghost.gameState.turnNumber = 24; ghost.cardState.charge.black = 99;
    ghost.cardState.hands.black = ['destroy_01']; Cards.ensureCardCopyState(ghost.cardState);
    Cards.addMarker(ghost.cardState, 'specialStone', 3, 3, 'white', { type: 'GHOST', remainingOwnerTurns: 8 });
    cases.push({ id: 'interaction/destroy-ghost', tags: ['interaction', 'ghost', 'pending'], spec: '正本/共通ルール正本.md 幽体化', initial: ghost,
        operations: [{ kind: 'action', action: { type: 'use_card', useCardId: 'destroy_01', useCardHandIndex: 0, useCardOwnerKey: 'black' } },
            { kind: 'action', action: { type: 'place', destroyTarget: { row: 3, col: 3 } } }] });
    const invalidTarget = cloneBattle(cases.find(item => item.id === 'card/reincarnation_will_01/basic')!);
    invalidTarget.id = 'boundary/reincarnation-invalid-target'; invalidTarget.tags = ['pending', 'invalid-target'];
    invalidTarget.operations = [invalidTarget.operations[0], { kind: 'action', action: { type: 'place', reincarnationTarget: { row: 0, col: 0 } } }];
    cases.push(invalidTarget);
    const circle = createBattle({ version: 1, battleId: 'circle', seed: 42, board: { rows: 8, cols: 8, shape: 'circle' } } as any);
    cases.push({ id: 'boundary/circle-exterior', tags: ['board-shape', 'rejection'], spec: '01-rulebook.md §3', initial: circle.snapshot(),
        operations: [{ kind: 'turn_start' }, { kind: 'action', action: { type: 'place', row: 0, col: 0 } }] }); circle.dispose();
    return cases;
}

/** Rule oracles are intentionally independent of saved output. Regeneration
 * cannot turn rejected basic uses, mutated rejected states or premature wins
 * into a new passing golden. Detailed card expectations remain in named tests. */
export function assertCoverage(cases: ConformanceCase[], outputs: CaseOutput[]): void {
    const ids = new Set(cases.map(item => item.id)); assert.equal(ids.size, cases.length, 'Duplicate input case');
    const map = new Map(outputs.map(item => [item.id, item])); assert.equal(map.size, outputs.length, 'Duplicate output case');
    assert.equal(map.size, cases.length, 'Missing or extra output case');
    for (const cardId of productionFixtureCardIds()) for (const suffix of ['basic', 'rejected']) assert.ok(ids.has(`card/${cardId}/${suffix}`), `Missing card coverage: ${cardId}/${suffix}`);
    for (const id of ['interaction/four-element-fusion', 'interaction/destroy-ghost', 'boundary/consecutive-passes', 'boundary/illegal-placement', 'boundary/reincarnation-invalid-target', 'boundary/circle-exterior']) assert.ok(ids.has(id), `Missing boundary: ${id}`);
    for (const input of cases) {
        const output = map.get(input.id); assert.ok(output, `Missing output: ${input.id}`);
        assert.equal(output.steps.length, input.operations.length, `Incomplete steps: ${input.id}`);
        if (input.tags.includes('card-basic')) {
            assert.equal(output.steps[0].ok, true, input.id);
            assert.ok(!output.steps[0].state.cardState.hands.black.includes(input.cardId), `Used copy remained: ${input.id}`);
            assert.ok(output.steps.every(step => step.ok), `Failed continuation: ${input.id}`);
            const markerType = BASIC_MARKER_EXPECTATIONS[input.cardId!];
            if (markerType) {
                const previous = new Set(input.initial.cardState.markers.map((marker: any) => marker.markerId));
                assert.ok(output.steps.some(step => step.state.cardState.markers.some((marker: any) => marker.data?.type === markerType && !previous.has(marker.markerId))), `Card must create ${markerType}: ${input.id}`);
            }
        }
        if (input.tags.includes('card-rejection')) {
            assert.equal(output.steps[0].ok, false, input.id);
            assert.equal(productionStateKey(output.steps[0].state), productionStateKey(input.initial), `Rejected command mutated canonical state: ${input.id}`);
        }
    }
    const pass = map.get('boundary/consecutive-passes')!.steps;
    assert.equal(pass[0].result, null); assert.equal(pass[1].result, null);
    assert.deepEqual(pass[2].result, { black: 64, white: 0, winner: 'black', endedBy: 'consecutive_passes', turnNumber: pass[2].state.gameState.turnNumber });
    const ghost = map.get('interaction/destroy-ghost')!.steps;
    assert.equal(ghost[1].state.gameState.board[3][3], -1, 'Ghost must survive destruction');
    assert.ok(ghost[0].state.cardState.pendingEffectByPlayer.black, 'Target selection must be explicit');
    const pending = map.get('boundary/reincarnation-invalid-target')!.steps;
    assert.ok(pending[1].state.cardState.pendingEffectByPlayer.black, 'Invalid target must not discard pending');
    assert.equal(pending[1].state.prngState.calls, pending[0].state.prngState.calls, 'Invalid target must not consume random draws');
    assert.ok(map.get('interaction/four-element-fusion')!.steps.some(step => step.state.cardState.markers.some((marker: any) => marker.data?.type === 'SHINRA_BANSHO_GOD')), 'Four elements must fuse');
    assert.equal(map.get('boundary/circle-exterior')!.steps[1].ok, false);
    const holes = (state: any) => state.cardState.markers.filter((marker: any) => marker.data?.type === 'METEOR_HOLE').length;
    assert.ok(map.get('card/board_expand_01/basic')!.steps.some(step => step.state.gameState.boardExpansion?.cells?.length > 0), 'Expansion must add world coordinates');
    assert.ok(map.get('card/board_shrink_01/basic')!.steps.some(step => holes(step.state) === 3), 'Shrink must create the selected three holes');
    assert.equal(holes(map.get('card/meteor_01/basic')!.steps[1].state), 1, 'Meteor must create a permanent hole');
    assert.equal(holes(map.get('card/causal_replay_01/basic')!.steps[1].state), 0, 'Causal replay must restore the hole');
    const chest = map.get('card/chest_01/basic')!.steps[0].state.cardState.charge.black;
    assert.ok(chest >= 12 && chest <= 22 && chest % 2 === 0, 'Treasure grants 1..6 times the fixture multiplier 2');
    assert.equal(map.get('card/ribo_01/basic')!.steps[0].state.cardState.charge.black, 70, 'Ribo grants 30 times multiplier 2');
    assert.equal(map.get('card/equality_will_01/basic')!.steps[0].state.cardState.charge.black, 10, 'Equality transfers ten without multiplying');
    const count = (state: any) => state.gameState.board.flat().filter((value: number) => value !== 0).length;
    for (const [id, increment] of [['reinforcement_01', 1], ['support_troops_01', 3], ['salvation_01', 2]] as const) {
        const input = cases.find(item => item.id === `card/${id}/basic`)!;
        assert.equal(count(map.get(input.id)!.steps[0].state) - count(input.initial), increment, `Spawn count: ${id}`);
    }
}

// These expectations are card-spec assertions, not learned from the golden.
// A replacement implementation that consumes a card without its actual marker
// cannot be accepted simply by recording a new output snapshot.
const BASIC_MARKER_EXPECTATIONS: Record<string, string> = {
    sniper_01: 'SNIPER', hard_01: 'PROTECTED', ghost_01: 'GHOST', sacrifice_will_01: 'SACRIFICE',
    zombie_will_01: 'ZOMBIE', afterimage_will_01: 'AFTERIMAGE_WILL', perma_01: 'PERMA_PROTECTED', trap_01: 'TRAP',
    regen_01: 'REGEN', bomb_01: 'TIME_BOMB', time_stop_god_01: 'TIME_STOP', time_stop_deity_01: 'TIME_STOP_DEITY',
    udr_01: 'DRAGON', breeding_01: 'BREEDING', proliferation_01: 'PROLIFERATION', seed_01: 'SEED',
    hyperactive_01: 'HYPERACTIVE', extreme_hyperactive_01: 'EXTREME_HYPERACTIVE', escape_01: 'ESCAPE_HYPERACTIVE',
    robot_vacuum_01: 'ROBOT_VACUUM', gluttonous_will_01: 'GLUTTONOUS', will_hunter_king_01: 'WILL_HUNTER_KING',
    work_01: 'WORK', ultimate_work_god_01: 'ULTIMATE_WORK_GOD', mass_freeze_will_01: 'FREEZE',
    theory_incarnation_01: 'THEORY_INCARNATION', board_executor_01: 'BOARD_EXECUTOR', observer_will_01: 'OBSERVER_WILL',
    guard_01: 'GUARD', guardian_god_01: 'GUARD', stone_salvation_god_01: 'STONE_SALVATION_GOD',
    destroy_dragon_01: 'DESTROY_DRAGON', lightning_01: 'LIGHTNING', udg_01: 'ULTIMATE_DESTROY_GOD',
    ultimate_hyperactive_01: 'ULTIMATE_HYPERACTIVE', blockade_01: 'BLOCKADE', poison_will_01: 'POISON_CELL',
    fire_will_01: 'FIRE', water_will_01: 'WATER', grass_will_01: 'GRASS', freeze_01: 'FREEZE',
    living_will_01: 'LIVING_WILL', meteor_god_01: 'METEOR_GOD'
};

export function deterministicVectors(): any {
    const sequences = [0, 1, 0xffffffff].map(seed => {
        const rng = Prng.createPRNG(seed);
        const uint32 = Array.from({ length: 8 }, () => rng.random() * 0x100000000);
        const checkpoint = rng.getState(), resumed = Prng.fromState(checkpoint).random();
        const shuffleRng = Prng.createPRNG(seed), shuffled = ['A', 'B', 'C', 'D', 'E', 'F']; shuffleRng.shuffle(shuffled);
        return { seed, uint32, checkpoint, resumed, shuffled, shuffleCheckpoint: shuffleRng.getState() };
    });
    const hashInputs = [null, { b: 2, a: 1 }, { japanese: '転生の意志', astral: '😀', escaped: '\n"\\' }, { min: -0, fraction: 0.125, integer: 4294967295 }, ['white', 'black']];
    const initial = ordinaryInitial();
    const markerInput = [
        { id: 'z', markerId: 'z', kind: 'specialStone', createdSeq: 4, data: { type: 'WORK' } },
        { id: 'b', markerId: 'b', kind: 'specialStone', createdSeq: 2, data: { type: 'WORK' } },
        { id: 'a', markerId: 'a', kind: 'specialStone', createdSeq: 2, data: { type: 'WORK' } }
    ];
    const markerOrder = MarkerPhase.collectTurnStartMarkerAnchors({ markers: markerInput }, { isBombCategoryMarker: () => false })
        .map((anchor: any) => ({ markerId: anchor.markerId, createdSeq: anchor.createdSeq, sourceIndex: anchor.sourceIndex }));
    const reincarnationCandidates = MarkerFactory.buildTheoryIncarnationSpawnTable(Shared.CARD_DEFS, { SpecialStoneRegistry: SpecialRegistry })
        .filter((entry: any) => !['GHOST', 'TRAP', 'TIME_BOMB'].includes(entry.markerData.type))
        .map((entry: any) => ({ cardId: entry.cardId, type: entry.markerData.type }));
    return { schema: 'godot-determinism.v1', sequences, directions: Shared.DIRECTIONS,
        legalMoves: Core.getLegalMoves(initial.gameState, 1).map((move: any) => ({ row: move.row, col: move.col })),
        markerInput, markerOrder, reincarnationFromGhost: reincarnationCandidates,
        hashes: hashInputs.map(value => ({ value: cloneBattle(value), text: Hash.stableStringify(value), hash: Hash.computeStableHash(value) })) };
}

function fixtureDirectory(): string {
    // The source is also imported by Jest; __dirname then lacks /dist.
    return fs.existsSync(path.join(FIXTURE_DIRECTORY, 'cases.json')) ? FIXTURE_DIRECTORY : path.resolve(__dirname, '../test/fixtures/godot-conformance');
}
export function loadConformance(): { cases: ConformanceCase[]; expected: any; vectors: any } {
    const directory = fixtureDirectory();
    return { cases: JSON.parse(fs.readFileSync(path.join(directory, 'cases.json'), 'utf8')).cases,
        expected: JSON.parse(fs.readFileSync(path.join(directory, 'expected.json'), 'utf8')),
        vectors: JSON.parse(fs.readFileSync(path.join(directory, 'vectors.json'), 'utf8')) };
}
export function main(args: string[]): void {
    const [command, file] = args;
    if (command === 'record') {
        if (!file) throw new Error('record requires a NEW directory; historical data is never overwritten');
        const directory = path.resolve(file); fs.mkdirSync(directory); const cases = buildCases(), outputs = cases.map(replayCase);
        assertCoverage(cases, outputs);
        fs.writeFileSync(path.join(directory, 'cases.json'), JSON.stringify({ schema: CONFORMANCE_SCHEMA, cases }), { flag: 'wx' });
        fs.writeFileSync(path.join(directory, 'expected.json'), JSON.stringify({ schema: CONFORMANCE_SCHEMA, cases: outputs }), { flag: 'wx' });
        fs.writeFileSync(path.join(directory, 'vectors.json'), JSON.stringify(deterministicVectors(), null, 2), { flag: 'wx' });
        console.log(JSON.stringify({ directory, cases: cases.length, steps: outputs.reduce((sum, item) => sum + item.steps.length, 0) })); return;
    }
    const baseline = loadConformance();
    if (command === 'generate') {
        if (!file) throw new Error('generate requires a NEW output.json');
        const cases = baseline.cases.map(replayCase); assertCoverage(baseline.cases, cases);
        fs.writeFileSync(path.resolve(file), JSON.stringify({ schema: CONFORMANCE_SCHEMA, cases }), { flag: 'wx' }); return;
    }
    if (command === 'check' || command === 'compare') {
        const actual = command === 'compare' ? JSON.parse(fs.readFileSync(file, 'utf8')) : { schema: CONFORMANCE_SCHEMA, cases: baseline.cases.map(replayCase) };
        if (command === 'check') { assertCoverage(baseline.cases, actual.cases); assert.deepEqual(deterministicVectors(), baseline.vectors); }
        const differences = compareOutputs(baseline.expected, actual);
        console.log(JSON.stringify({ valid: differences.length === 0, cases: baseline.cases.length, differenceCount: differences.length, differences: differences.slice(0, 100) }, null, 2));
        if (differences.length) process.exitCode = 1; return;
    }
    throw new Error('Usage: godot-conformance record <new-directory> | generate <new-output.json> | check | compare <godot-output.json>');
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(String(error)); process.exitCode = 1; } }
