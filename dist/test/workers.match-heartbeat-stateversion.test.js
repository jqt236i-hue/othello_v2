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
function runScenario(runnerSource) {
    const result = (0, child_process_1.spawnSync)(process.execPath, ['-e', runnerSource, workerModulePath], {
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'heartbeat runner failed');
    }
    return JSON.parse(String(result.stdout || '{}'));
}
function runHeartbeatScenario() {
    const runner = [
        "(async () => {",
        "  const modulePath = process.argv[1];",
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
        "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
        "  board[3][3] = -1;",
        "  board[3][4] = 1;",
        "  board[4][3] = 1;",
        "  board[4][4] = -1;",
        "",
        "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
        "    roomId: 'HBV1',",
        "    playerName: 'くろ',",
        "    seed: 1,",
        "    snapshot: {",
        "      gameState: {",
        "        board,",
        "        currentPlayer: 1,",
        "        consecutivePasses: 0,",
        "        turnNumber: 0",
        "      },",
        "      cardState: {}",
        "    }",
        "  });",
        "  const createPayload = await createResponse.json();",
        "  await durableObject.handleJoin({ seatKey: 'white', playerName: 'しろ' });",
        "",
        "  const chunks = [];",
        "  durableObject.streams.set('manual_stream', {",
        "    seatKey: 'black',",
        "    writer: {",
        "      write: async (bin) => { chunks.push(Buffer.from(bin).toString('utf8')); },",
        "      close: async () => {},",
        "      releaseLock: () => {}",
        "    }",
        "  });",
        "",
        "  await durableObject.loadRoom();",
        "  durableObject.room.stateVersion = 7;",
        "  await durableObject.broadcastHeartbeat();",
        "",
        "  process.stdout.write(JSON.stringify({",
        "    chunks,",
        "    createSeatToken: createPayload.seatToken",
        "  }));",
        "})().catch((error) => {",
        "  console.error(error && error.stack ? error.stack : String(error));",
        "  process.exit(1);",
        "});"
    ].join('\n');
    return runScenario(runner);
}
describe('match worker heartbeat payload', () => {
    test('heartbeatイベントにstateVersionを含める', () => {
        const result = runHeartbeatScenario();
        expect(Array.isArray(result.chunks)).toBe(true);
        expect(result.chunks.length).toBeGreaterThan(0);
        const heartbeatChunk = result.chunks.find((chunk) => String(chunk).includes('event: heartbeat'));
        expect(heartbeatChunk).toBeTruthy();
        expect(heartbeatChunk).toContain('"stateVersion":7');
        expect(heartbeatChunk).toContain('"turnTimer"');
    });
});
//# sourceMappingURL=workers.match-heartbeat-stateversion.test.js.map