"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const url_1 = require("url");
const child_process_1 = require("child_process");
const workerModulePath = (0, url_1.pathToFileURL)(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
function runScenario(runnerSource, actionType) {
    const result = (0, child_process_1.spawnSync)(process.execPath, ['-e', runnerSource, workerModulePath, actionType], {
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'rematch publish runner failed');
    }
    return JSON.parse(String(result.stdout || '{}'));
}
function runOutOfTurnPublishScenario(actionType) {
    const runner = [
        "(async () => {",
        "  const modulePath = process.argv[1];",
        "  const actionType = process.argv[2];",
        "  const { MatchRoomDurableObject } = await import(modulePath);",
        "  const storage = new Map();",
        "  const state = {",
        "    storage: {",
        "      get: async (key) => storage.get(key),",
        "      put: async (key, value) => storage.set(key, value),",
        "      delete: async (key) => storage.delete(key)",
        "    }",
        "  };",
        "  const durableObject = new MatchRoomDurableObject(state);",
        "",
        "  const terminalBoard = Array.from({ length: 8 }, () => Array(8).fill(1));",
        "  const requestedResetBoard = Array.from({ length: 8 }, () => Array(8).fill(-1));",
        "",
        "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
        "    roomId: 'RMR1',",
        "    playerName: 'くろ',",
        "    seed: 1,",
        "    snapshot: {",
        "      gameState: {",
        "        board: terminalBoard,",
        "        currentPlayer: 1,",
        "        consecutivePasses: 0,",
        "        turnNumber: 60",
        "      },",
        "      cardState: {}",
        "    }",
        "  });",
        "  const createPayload = await createResponse.json();",
        "",
        "  const joinResponse = await durableObject.handleJoin({ seatKey: 'white', playerName: 'しろ' });",
        "  const joinPayload = await joinResponse.json();",
        "",
        "  await durableObject.loadRoom();",
        "  durableObject.room.stateVersion = 5;",
        "  durableObject.room.snapshot = {",
        "    gameState: {",
        "      board: terminalBoard,",
        "      currentPlayer: 1,",
        "      consecutivePasses: 0,",
        "      turnNumber: 60",
        "    },",
        "    cardState: {}",
        "  };",
        "  durableObject.room.updatedAt = Date.now();",
        "  await durableObject.saveRoom();",
        "",
        "  const publishResponse = await durableObject.handlePublish({",
        "    seatKey: 'white',",
        "    playerKey: 'white',",
        "    seatToken: joinPayload.seatToken,",
        "    baseVersion: 5,",
        "    operationId: `op_rematch_${actionType}_1`,",
        "    actionType,",
        "    snapshot: {",
        "      gameState: {",
        "        board: requestedResetBoard,",
        "        currentPlayer: 1,",
        "        consecutivePasses: 0,",
        "        turnNumber: 0",
        "      },",
        "      cardState: {}",
        "    }",
        "  });",
        "  const payload = await publishResponse.json();",
        "",
        "  process.stdout.write(JSON.stringify({",
        "    status: publishResponse.status,",
        "    payload,",
        "    createSeatToken: createPayload.seatToken",
        "  }));",
        "})().catch((error) => {",
        "  console.error(error && error.stack ? error.stack : String(error));",
        "  process.exit(1);",
        "});"
    ].join('\n');
    return runScenario(runner, actionType);
}
describe('match worker rematch publish', () => {
    test('ゲーム終了後は手番外でも reset_game publish を許可する', () => {
        const result = runOutOfTurnPublishScenario('reset_game');
        const board = result && result.payload && result.payload.snapshot && result.payload.snapshot.gameState
            ? result.payload.snapshot.gameState.board
            : null;
        const occupied = Array.isArray(board)
            ? board.reduce((sum, row) => sum + row.filter((cell) => cell !== 0).length, 0)
            : -1;
        expect(result.status).toBe(200);
        expect(result.payload && result.payload.ok).toBe(true);
        expect(result.payload.stateVersion).toBe(6);
        expect(result.payload.snapshot.gameState.currentPlayer).toBe(1);
        expect(result.payload.snapshot.gameState.turnNumber).toBe(0);
        expect(Array.isArray(board)).toBe(true);
        expect(board[3][3]).toBe(-1);
        expect(board[3][4]).toBe(1);
        expect(board[4][3]).toBe(1);
        expect(board[4][4]).toBe(-1);
        expect(occupied).toBe(4);
    });
    test('ゲーム終了後でも reset 以外の手番外 publish は拒否する', () => {
        const result = runOutOfTurnPublishScenario('use_card');
        expect(result.status).toBe(409);
        expect(result.payload && result.payload.ok).toBe(false);
        expect(result.payload.rejectedReason).toBe('OUT_OF_TURN');
    });
});
//# sourceMappingURL=workers.match-rematch-publish.test.js.map