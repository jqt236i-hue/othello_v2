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
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const ph = require(path.resolve(__dirname, '..', 'game', 'pass-handler'));
global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
global.gameState = { currentPlayer: 1 };
global.TurnPipeline = { applyTurnSafe: (cs, gs, playerKey, action) => ({ ok: true, gameState: gs, cardState: cs, events: [] }) };
(async () => {
    try {
        console.log('Calling handleBlackPassWhenNoMoves');
        try {
            const a = await ph.handleBlackPassWhenNoMoves();
            console.log('handleBlackPassWhenNoMoves ->', a);
        }
        catch (e) {
            console.error('handleBlackPassWhenNoMoves threw', e && e.stack ? e.stack : e);
        }
        console.log('Calling processPassTurn');
        try {
            const b = await ph.processPassTurn('black', false);
            console.log('processPassTurn ->', b);
        }
        catch (e) {
            console.error('processPassTurn threw', e && e.stack ? e.stack : e);
        }
    }
    catch (e) {
        console.error('ERROR:', e && e.stack ? e.stack : e);
        process.exit(2);
    }
})();
//# sourceMappingURL=run-pass-handler-debug.js.map