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
function getProjectedOffersForSeat(seatKey) {
    const runner = [
        "(async () => {",
        "  const modulePath = process.argv[1];",
        "  const seatKey = process.argv[2];",
        "  const seatToken = seatKey === 'black' ? 'token_black' : 'token_white';",
        "  const { MatchRoomDurableObject } = await import(modulePath);",
        "  const room = {",
        "    roomId: 'ROOMTEST',",
        "    stateVersion: 3,",
        "    updatedAt: Date.now(),",
        "    seats: { black: true, white: true },",
        "    seatTokens: { black: 'token_black', white: 'token_white' },",
        "    snapshot: {",
        "      gameState: { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
        "      cardState: {",
        "        hands: { black: ['condemn_will'], white: ['gold_stone', 'silver_stone'] },",
        "        pendingEffectByPlayer: {",
        "          black: {",
        "            type: 'CONDEMN_WILL',",
        "            stage: 'selectTarget',",
        "            offers: [",
        "              { handIndex: 0, cardId: '__hidden_hand__:white:0' },",
        "              { handIndex: 1, cardId: '__hidden_hand__:white:1' }",
        "            ]",
        "          },",
        "          white: null",
        "        }",
        "      }",
        "    }",
        "  };",
        "  const storage = new Map();",
        "  storage.set('match_room_state_v1', room);",
        "  const state = {",
        "    storage: {",
        "      get: async (key) => storage.get(key),",
        "      put: async (key, value) => storage.set(key, value),",
        "      delete: async (key) => storage.delete(key)",
        "    }",
        "  };",
        "  const durableObject = new MatchRoomDurableObject(state);",
        "  const response = await durableObject.handleState(new URL(`https://room/api/match/state?seatKey=${seatKey}&seatToken=${seatToken}`));",
        "  const payload = await response.json();",
        "  const offers = payload.snapshot.cardState.pendingEffectByPlayer.black.offers;",
        "  process.stdout.write(JSON.stringify(offers));",
        "})().catch((error) => {",
        "  console.error(error && error.stack ? error.stack : String(error));",
        "  process.exit(1);",
        "});"
    ].join('\n');
    const result = (0, child_process_1.spawnSync)(process.execPath, ['-e', runner, workerModulePath, seatKey], {
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'worker projection check failed');
    }
    return JSON.parse(String(result.stdout || '[]'));
}
describe('match worker condemn visibility projection', () => {
    test('reveals condemn offers to the effect owner seat', () => {
        const offers = getProjectedOffersForSeat('black');
        expect(Array.isArray(offers)).toBe(true);
        expect(offers).toHaveLength(2);
        expect(offers[0]).toEqual({ handIndex: 0, cardId: 'gold_stone' });
        expect(offers[1]).toEqual({ handIndex: 1, cardId: 'silver_stone' });
    });
    test('keeps condemn offers hidden for the non-owner seat', () => {
        const offers = getProjectedOffersForSeat('white');
        expect(Array.isArray(offers)).toBe(true);
        expect(offers).toHaveLength(2);
        expect(offers[0].cardId).toBe('__hidden_hand__:white:0');
        expect(offers[1].cardId).toBe('__hidden_hand__:white:1');
    });
});
//# sourceMappingURL=workers.match-condemn-visibility.test.js.map