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
const adapter = __importStar(require("../game/turn/pipeline_ui_adapter.js"));
describe('pipeline_ui_adapter chain flip ordering', () => {
    test('maps chain flips to a later phase than primary flips, while keeping chain batch together', () => {
        const pres = [
            { type: 'CHANGE', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
            { type: 'CHANGE', row: 3, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
            { type: 'CHANGE', row: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL', reason: 'chain_flip' },
            { type: 'CHANGE', row: 5, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL', reason: 'chain_flip' }
        ];
        const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });
        expect(out).toHaveLength(4);
        expect(out.every(e => e.type === 'flip')).toBe(true);
        const primary = out.filter(e => e.targets[0].reason === 'standard_flip');
        const chain = out.filter(e => e.targets[0].reason === 'chain_flip');
        expect(primary).toHaveLength(2);
        expect(chain).toHaveLength(2);
        const primaryPhase = primary[0].phase;
        expect(primary[1].phase).toBe(primaryPhase);
        expect(chain[0].phase).toBeGreaterThan(primaryPhase);
        expect(chain[1].phase).toBe(chain[0].phase);
    });
    test('treats CHAIN_WILL cause as chain phase even if reason is missing', () => {
        const pres = [
            { type: 'CHANGE', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
            { type: 'CHANGE', row: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL' },
            { type: 'CHANGE', row: 5, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL' }
        ];
        const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });
        expect(out).toHaveLength(3);
        expect(out[1].phase).toBeGreaterThan(out[0].phase);
        expect(out[2].phase).toBe(out[1].phase);
    });
    test('separates chain link 1 and chain link 2 into different phases', () => {
        const pres = [
            { type: 'CHANGE', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
            { type: 'CHANGE', row: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL', reason: 'chain_flip', meta: { chainLink: 1 } },
            { type: 'CHANGE', row: 5, col: 5, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL', reason: 'chain_flip', meta: { chainLink: 2 } }
        ];
        const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });
        expect(out).toHaveLength(3);
        expect(out[1].phase).toBeGreaterThan(out[0].phase);
        expect(out[2].phase).toBeGreaterThan(out[1].phase);
    });
});
//# sourceMappingURL=game.pipeline-ui-adapter.chain-flip-order.test.js.map