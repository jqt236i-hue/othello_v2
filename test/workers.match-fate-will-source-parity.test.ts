import { spawnSync } from 'child_process';
import * as path from 'path';

// Exercise root TS in Node: deployed worker .mjs reads dist/, which can be stale before the final build.
// This loader only selects canonical sibling TS and catalog data; it does not mock game behavior.
const sourceLoader = `
const fs = require('fs'), path = require('path'), Module = require('module');
const root = process.argv[2], ts = require(root + '/node_modules/typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.endsWith('/cards/catalog.js') || request.endsWith('/cards/catalog')) return resolve.call(this, request.replace(/\\.js$/, '') + '.json', parent, ...rest);
  if (request.endsWith('.js') && parent && !parent.filename.includes('node_modules')) {
    try { return resolve.call(this, request.slice(0, -3) + '.ts', parent, ...rest); } catch (_) {}
  }
  const resolved = resolve.call(this, request, parent, ...rest);
  if (!resolved.includes('node_modules') && resolved.endsWith('.js') && fs.existsSync(resolved.slice(0, -3) + '.ts')) return resolved.slice(0, -3) + '.ts';
  return resolved;
};
Module._extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText, f);
`;

async function runScenario() {
    const assert = require('assert');
    const root = process.argv[2], completion = process.argv[1];
    const { MatchRoomDurableObject } = require(root + '/workers/match-worker.ts');
    const { BattleMatch } = require(root + '/game/battle/match.ts');
    const Runtime = require(root + '/scripts/local-match-runtime.ts');
    const Cards = require(root + '/game/logic/cards.ts'), Core = require(root + '/game/logic/core.ts');
    const Prng = require(root + '/game/schema/prng.ts');
    const rng = Prng.createPRNG(24), cardState = Cards.createCardState(rng), gameState = Core.createGameState();
    gameState.currentPlayer = -1;
    cardState.debugNoDraw = true;
    cardState.hands = { black: [], white: [] };
    cardState.lastTurnStartedFor = 'white';
    cardState.fateWillControllerByTurnOwner.white = 'black';
    cardState.fateWillPhaseByTurnOwner.white = 'active';
    cardState.timeStopConsecutiveTurnsRemainingByPlayer.white = 4;
    const local = new BattleMatch({ cardState, gameState, prngState: rng.getState() });
    const action = completion === 'place'
        ? { type: 'place', row: 2, col: 4 }
        : { type: 'pass', timeoutPass: true, reason: 'timeout' };
    assert(local.apply(action, undefined, 'black').ok);
    local.startTurn();
    const runtime = Runtime.createRuntime({ roomId: 'FATESOURCE', seed: 24 });
    const room = runtime.getRoom();
    room.seatTokens = { black: 'token_black', white: 'token_white' };
    room.snapshot = { gameState, cardState, stateVersion: 0 };
    const stored = new Map([['match_room_state_v1', room]]);
    const worker = new MatchRoomDurableObject({ storage: {
        get: async (key) => stored.get(key), put: async (key, value) => { stored.set(key, value); },
        delete: async (key) => stored.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {}
    } });
    worker.broadcastSnapshot = async () => {};
    const response = await worker.fetch(new Request('https://room/api/match/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.roomId, seatKey: 'black', playerKey: 'black', seatToken: 'token_black',
            baseVersion: 0, operationId: 'fate_source_' + completion, actionType: action.type, actor: 'black',
            params: completion === 'place' ? { row: 2, col: 4 } : { timeoutPass: true, reason: 'timeout' },
            turnIndex: cardState.turnIndex })
    }));
    const payload = await response.json();
    assert.equal(response.status, 200, JSON.stringify(payload));
    const remote = stored.get('match_room_state_v1').snapshot;
    assert.deepEqual(remote.gameState.board, local.snapshot().gameState.board);
    assert.equal(remote.gameState.currentPlayer, local.snapshot().gameState.currentPlayer);
    assert.deepEqual(remote.cardState.fateWillControllerByTurnOwner, { black: null, white: null });
    assert.deepEqual(remote.cardState.fateWillPhaseByTurnOwner, { black: null, white: null });
    assert.equal(remote.cardState.timeStopConsecutiveTurnsRemainingByPlayer.white, 3);
    process.stdout.write('__FATE_SOURCE_PARITY_OK__');
}

describe('FATE_WILL source Worker / local pipeline parity', () => {
    test.each(['place', 'timeout'])('%s releases control before the owner extra turn', completion => {
        const result = spawnSync(process.execPath, ['-e', sourceLoader + `(${runScenario.toString()})().catch(e => { console.error(e); process.exit(1); });`, completion, path.resolve(__dirname, '..')], { encoding: 'utf8' });
        if (result.status !== 0) throw new Error(result.stderr || result.stdout);
        expect(result.stdout).toContain('__FATE_SOURCE_PARITY_OK__');
    }, 30000);
});
