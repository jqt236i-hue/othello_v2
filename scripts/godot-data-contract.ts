import * as fs from 'fs';
import * as path from 'path';
import {
    getBattleDataContract, validateBattleData, createBattle, BATTLE_CONTENT_VERSION, BATTLE_RULES_VERSION,
    type BattleDataKind
} from '../game/battle';
import Core = require('../game/logic/core');
import Hash = require('../shared/state-hash');
import { comparableProductionState } from '../src/engine/production-match';

/** Explicit regeneration only. Historical fixtures are never overwritten. */
export function generateCurrentBattleFixtures(root: string): void {
    const destination = path.join(root, 'test', 'fixtures');
    const battle = createBattle({ version: 1, battleId: 'format1-current-fixture', seed: 319 });
    battle.startTurn();
    fs.writeFileSync(path.join(destination, 'battle-save-current-v1.json'), JSON.stringify(battle.exportSave(), null, 2) + '\n');
    battle.dispose();
    const config = { version: 1 as const, battleId: 'current-catalog-baseline', seed: 914001,
        players: { black: { controller: 'human' as const, profile: '10' }, white: { controller: 'cpu' as const, profile: '10' } } };
    const current = createBattle(config), records: any[] = [];
    const record = (transition: any) => records.push({ kind: transition.kind,
        ...(transition.action ? { action: transition.action } : {}), ok: transition.ok, reason: transition.reason,
        hash: Hash.computeStableHash(comparableProductionState(transition.after)), prng: transition.after.prngState,
        after: comparableProductionState(transition.after), events: transition.events });
    record(current.startTurn()); record(current.apply({ type: 'pass' }));
    for (let step = 0; step < 200 && !current.result(); step++) {
        if (current.currentPhase === 'needs-turn-start') record(current.startTurn());
        if (current.currentPhase === 'terminal') break;
        const position = current.snapshot();
        const moves = Core.getLegalMoves(position.gameState, position.gameState.currentPlayer);
        const transition = current.apply(moves.length ? { type: 'place', row: moves[0].row, col: moves[0].col } : { type: 'pass' });
        if (!transition.ok) throw new Error(`Current baseline unexpectedly rejected a legal move: ${transition.reason}`);
        record(transition);
    }
    if (!current.result()) throw new Error('Current baseline did not terminate');
    fs.writeFileSync(path.join(destination, 'battle-replay-current-v1.json'), JSON.stringify({
        sourceCommit: 'bfd7ee62691436731abd9ba5bd1b38ce4a7bee5c', rulesVersion: BATTLE_RULES_VERSION,
        contentVersion: BATTLE_CONTENT_VERSION,
        scope: 'Default catalog opening, rejected pass, deterministic first legal placements and canonical consecutive-pass ending. All-card and pending behavior are covered by the Godot case corpus and battle.session tests.',
        config, records, result: current.result()
    }, null, 2) + '\n');
    current.dispose();
}

export function runBattleDataContractCli(args: string[]): unknown {
    const [command, kind, filename] = args;
    if (command === 'schema') {
        const contract = getBattleDataContract();
        if (kind) fs.writeFileSync(path.resolve(kind), JSON.stringify(contract, null, 2) + '\n');
        return contract;
    }
    if (command === 'validate' && kind && filename) {
        const value = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
        validateBattleData(kind as BattleDataKind, value);
        return { ok: true, contractVersion: 1, kind, file: filename };
    }
    if (command === 'fixtures' && kind === '--write-current') {
        generateCurrentBattleFixtures(process.cwd());
        return { ok: true, currentFixturesRegenerated: true, historicalFixturesPreserved: true };
    }
    throw new Error('Usage: godot-data-contract schema [output.json] | validate <config|save|position|transition|action|result|events|playbackEvents> <file.json> | fixtures --write-current');
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(runBattleDataContractCli(process.argv.slice(2)), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + '\n'); process.exitCode = 1; }
}
