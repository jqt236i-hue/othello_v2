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
const DestroyOutcomeContract = __importStar(require("../shared/destroy-outcome-contract.js"));
describe('DestroyOutcomeContract', () => {
    test('normalizes regenerated outcomes and treats them as resolved', () => {
        const out = DestroyOutcomeContract.createDestroyOutcome(DestroyOutcomeContract.DESTROY_OUTCOME_KINDS.REGENERATED, {
            reason: 'regen_triggered',
            row: 3,
            col: 3,
            owner: 'black',
            remaining: 2
        });
        expect(out).toMatchObject({
            kind: 'regenerated',
            destroyed: false,
            regenerated: true,
            evaded: false,
            blockedByGhost: false,
            proliferated: false,
            reason: 'regen_triggered',
            row: 3,
            col: 3,
            owner: 'black',
            remaining: 2
        });
        expect(DestroyOutcomeContract.isDestroyOutcomeResolved(out)).toBe(true);
    });
    test('normalizes proliferated outcomes with kind and aliases', () => {
        const out = DestroyOutcomeContract.createDestroyOutcome(DestroyOutcomeContract.DESTROY_OUTCOME_KINDS.PROLIFERATED, {
            reason: 'proliferation_triggered',
            from: { row: 3, col: 3 },
            to: { row: 2, col: 2 }
        });
        expect(out).toMatchObject({
            kind: 'proliferated',
            destroyed: false,
            evaded: false,
            blockedByGhost: false,
            proliferated: true,
            reason: 'proliferation_triggered',
            from: { row: 3, col: 3 },
            to: { row: 2, col: 2 },
            source: { row: 3, col: 3 },
            destination: { row: 2, col: 2 }
        });
    });
    test('derives outcome kind and resolved state from legacy flags', () => {
        expect(DestroyOutcomeContract.getDestroyOutcomeKind({ regenerated: true })).toBe('regenerated');
        expect(DestroyOutcomeContract.getDestroyOutcomeKind({ blockedByGhost: true })).toBe('ghost_blocked');
        expect(DestroyOutcomeContract.getDestroyOutcomeKind({ evaded: true })).toBe('evaded_move');
        expect(DestroyOutcomeContract.getDestroyOutcomeKind({ destroyed: true })).toBe('destroyed');
        expect(DestroyOutcomeContract.isDestroyOutcomeResolved({ regenerated: true })).toBe(true);
        expect(DestroyOutcomeContract.isDestroyOutcomeResolved({ proliferated: true })).toBe(true);
        expect(DestroyOutcomeContract.isDestroyOutcomeResolved({ destroyed: false })).toBe(false);
    });
});
//# sourceMappingURL=shared.destroy-outcome-contract.test.js.map