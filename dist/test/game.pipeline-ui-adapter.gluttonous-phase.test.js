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
describe('pipeline_ui_adapter gluttonous phase mapping', () => {
    test('GLUTTONOUS_WILL の捕食破壊と移動は同一フェーズにまとまる', () => {
        const pres = [
            {
                type: 'DESTROY',
                row: 3,
                col: 4,
                cause: 'GLUTTONOUS_WILL',
                reason: 'gluttonous_eat',
                actionId: 'a1'
            },
            {
                type: 'MOVE',
                prevRow: 3,
                prevCol: 3,
                row: 3,
                col: 4,
                ownerBefore: 'black',
                ownerAfter: 'black',
                cause: 'GLUTTONOUS_WILL',
                reason: 'gluttonous_eat_move',
                actionId: 'a1'
            }
        ];
        const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array.from({ length: 8 }, () => Array(8).fill(0)) });
        expect(out).toHaveLength(2);
        expect(out[0].type).toBe('destroy');
        expect(out[1].type).toBe('move');
        expect(out[0].phase).toBe(out[1].phase);
    });
    test('GLUTTONOUS_WILL の捕食破壊は actionId が変わると次フェーズへ進む', () => {
        const pres = [
            {
                type: 'DESTROY',
                row: 3,
                col: 4,
                cause: 'GLUTTONOUS_WILL',
                reason: 'gluttonous_eat',
                actionId: 'a1'
            },
            {
                type: 'DESTROY',
                row: 3,
                col: 5,
                cause: 'GLUTTONOUS_WILL',
                reason: 'gluttonous_eat',
                actionId: 'a2'
            }
        ];
        const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array.from({ length: 8 }, () => Array(8).fill(0)) });
        expect(out).toHaveLength(2);
        expect(out[0].type).toBe('destroy');
        expect(out[1].type).toBe('destroy');
        expect(out[1].phase).toBeGreaterThan(out[0].phase);
    });
});
//# sourceMappingURL=game.pipeline-ui-adapter.gluttonous-phase.test.js.map