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
const chargeLedger = __importStar(require("../game/logic/cards-internal/charge-ledger.js"));
describe('cards-internal charge-ledger', () => {
    test('setChargeValue initializes and clamps to configured max', () => {
        const cardState = {};
        const result = chargeLedger.setChargeValue(cardState, 'black', 120, 'test_reason', {
            helpers: { chargeMax: 99 }
        });
        expect(cardState.charge).toEqual({ black: 99, white: 0 });
        expect(result).toEqual({ changed: true, before: 0, after: 99, delta: 99 });
    });
    test('addChargeValue accumulates from existing charge', () => {
        const cardState = { charge: { black: 10, white: 3 } };
        const result = chargeLedger.addChargeValue(cardState, 'black', 7, 'gain', {
            helpers: { chargeMax: 99 }
        });
        expect(cardState.charge.black).toBe(17);
        expect(result).toEqual({ changed: true, before: 10, after: 17, delta: 7 });
    });
    test('addChargeWithTotal tracks only actual positive gain under cap', () => {
        const cardState = {
            charge: { black: 97, white: 0 },
            chargeGainedTotal: { black: 4, white: 0 }
        };
        const added = chargeLedger.addChargeWithTotal(cardState, 'black', 10, {
            helpers: { chargeMax: 99 }
        });
        expect(added).toBe(2);
        expect(cardState.charge.black).toBe(99);
        expect(cardState.chargeGainedTotal.black).toBe(6);
    });
    test('setChargeValue delegates to injected helper when available', () => {
        const helperResult = { changed: true, before: 1, after: 5, delta: 4 };
        const setChargeWithDelta = jest.fn().mockReturnValue(helperResult);
        const cardState = {};
        const result = chargeLedger.setChargeValue(cardState, 'white', 5, 'delegated', {
            helpers: { setChargeWithDelta }
        });
        expect(setChargeWithDelta).toHaveBeenCalledWith(cardState, 'white', 5, 'delegated');
        expect(result).toBe(helperResult);
    });
});
//# sourceMappingURL=game.cards.charge-ledger-module.test.js.map