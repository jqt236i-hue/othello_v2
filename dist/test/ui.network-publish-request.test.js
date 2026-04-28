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
const NetworkPublishRequestModule = __importStar(require("../ui/network/publish-request.js"));
describe('NetworkPublishRequestModule', () => {
    test('builds request payload from command payload result', () => {
        const result = NetworkPublishRequestModule.buildPublishRequest({
            action: {
                type: 'place',
                playerKey: 'black',
                row: 4,
                col: 5
            }
        }, {
            playerKey: 'black',
            roomId: 'ROOM123',
            seatKey: 'black',
            seatToken: 'seat-token',
            operationId: 'op_123',
            baseVersion: 42,
            buildPublishCommandPayload: () => ({
                actionType: 'place',
                actor: 'black',
                params: { row: 4, col: 5 }
            })
        });
        expect(result).toEqual({
            commandPayload: {
                actionType: 'place',
                actor: 'black',
                params: { row: 4, col: 5 }
            },
            queuedActionType: 'place',
            requestPayload: {
                roomId: 'ROOM123',
                seatKey: 'black',
                seatToken: 'seat-token',
                playerKey: 'black',
                actionType: 'place',
                operationId: 'op_123',
                baseVersion: 42,
                actor: 'black',
                params: { row: 4, col: 5 },
                action: {
                    type: 'place',
                    playerKey: 'black',
                    row: 4,
                    col: 5
                }
            }
        });
    });
    test('returns null when no command payload can be built', () => {
        const result = NetworkPublishRequestModule.buildPublishRequest({}, {
            playerKey: 'black',
            buildPublishCommandPayload: () => null
        });
        expect(result).toBeNull();
    });
    test('prefers explicit request turnIndex over stale action turnIndex', () => {
        const result = NetworkPublishRequestModule.buildPublishRequest({
            action: {
                type: 'place',
                playerKey: 'black',
                row: 4,
                col: 5,
                turnIndex: 10
            }
        }, {
            playerKey: 'black',
            roomId: 'ROOM123',
            seatKey: 'black',
            seatToken: 'seat-token',
            operationId: 'op_123',
            baseVersion: 42,
            turnIndex: 25,
            buildPublishCommandPayload: () => ({
                actionType: 'place',
                actor: 'black',
                params: { row: 4, col: 5 },
                turnIndex: 10
            })
        });
        expect(result.requestPayload.baseVersion).toBe(42);
        expect(result.requestPayload.turnIndex).toBe(25);
    });
});
//# sourceMappingURL=ui.network-publish-request.test.js.map