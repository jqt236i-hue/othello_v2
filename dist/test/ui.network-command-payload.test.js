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
const NetworkCommandPayloadModule = __importStar(require("../ui/network/command-payload.js"));
describe('NetworkCommandPayloadModule', () => {
    test('serializes action payload with actor, params, actionId, and turnIndex', () => {
        const payload = NetworkCommandPayloadModule.buildPublishCommandPayload({
            action: {
                type: 'place',
                playerKey: 'white',
                row: 2,
                col: 3,
                actionId: 'act_01',
                turnIndex: 9
            }
        }, {
            playerKey: 'white'
        });
        expect(payload).toEqual({
            actionType: 'place',
            actor: 'white',
            actionId: 'act_01',
            turnIndex: 9,
            params: {
                row: 2,
                col: 3
            }
        });
    });
    test('keeps deferred pending card identity inside pendingSelectionState only', () => {
        const payload = NetworkCommandPayloadModule.buildPublishCommandPayload({
            action: {
                type: 'place',
                playerKey: 'black',
                heavenBlessingCardId: 'offer_2',
                pendingSelectionState: {
                    type: 'HEAVEN_BLESSING',
                    stage: 'selectTarget',
                    cardId: 'heaven_01'
                }
            }
        }, {
            playerKey: 'black'
        });
        expect(payload).toEqual({
            actionType: 'place',
            actor: 'black',
            params: {
                heavenBlessingCardId: 'offer_2',
                pendingSelectionState: {
                    type: 'HEAVEN_BLESSING',
                    stage: 'selectTarget',
                    cardId: 'heaven_01'
                }
            }
        });
    });
    test('does not add top-level card use context from authoritative pendingSelectionState', () => {
        const payload = NetworkCommandPayloadModule.buildPublishCommandPayload({
            action: {
                type: 'place',
                playerKey: 'black',
                expansionTarget: { row: 7, col: 7 },
                pendingSelectionState: {
                    type: 'BOARD_EXPANSION_GOD',
                    stage: 'selectTarget',
                    cardId: 'board_expand_god_01',
                    selectedTargets: [{ row: 0, col: 0 }],
                    selectedCount: 1,
                    maxSelections: 2
                }
            }
        }, {
            playerKey: 'black'
        });
        expect(payload).toEqual({
            actionType: 'place',
            actor: 'black',
            params: {
                expansionTarget: { row: 7, col: 7 },
                pendingSelectionState: {
                    type: 'BOARD_EXPANSION_GOD',
                    stage: 'selectTarget',
                    cardId: 'board_expand_god_01',
                    selectedTargets: [{ row: 0, col: 0 }],
                    selectedCount: 1,
                    maxSelections: 2
                }
            }
        });
    });
    test('builds reset_game payload without explicit action object', () => {
        const payload = NetworkCommandPayloadModule.buildPublishCommandPayload({
            actionType: 'reset_game'
        }, {
            playerKey: 'black'
        });
        expect(payload).toEqual({
            actionType: 'reset_game',
            actor: 'black',
            params: {}
        });
    });
});
//# sourceMappingURL=ui.network-command-payload.test.js.map