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
const cpuLv6SharedProfile = __importStar(require("../constants/cpu-lv6-shared-profile.js"));
const CpuLv6RuntimeCapability = __importStar(require("../shared/cpu-lv6-runtime-capability.js"));
describe('shared cpu lv6 runtime capability', () => {
    test('shared profile keeps policy-table as the primary browser Lv6 path', () => {
        const capability = CpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability(cpuLv6SharedProfile);
        expect(capability.primaryMoveSource).toBe('policy-table');
        expect(capability.primaryCardSource).toBe('policy-table');
        expect(capability.usesPolicyTableLookaheadMoveDecision).toBe(true);
        expect(capability.usesPolicyTableCoreCardDecision).toBe(true);
        expect(capability.shouldLoadPrimaryOnnxRuntime).toBe(false);
        expect(capability.hasAuxiliaryTargetHead).toBe(true);
        expect(capability.hasAuxiliaryValueHead).toBe(true);
    });
    test('forcePrimaryOnnx only changes primary-load gating and keeps guard overrides explicit', () => {
        const capability = CpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability(cpuLv6SharedProfile, {
            forcePrimaryOnnx: true,
            guardOverrides: { cardBudgetMs: 33 },
            legacyPendingSelectionBudgetMs: 77
        });
        expect(capability.shouldLoadPrimaryOnnxRuntime).toBe(true);
        expect(capability.onnxRuntimeGuard.moveBudgetMs).toBe(120);
        expect(capability.onnxRuntimeGuard.cardBudgetMs).toBe(33);
        expect(capability.onnxRuntimeGuard.pendingSelectionBudgetMs).toBe(77);
    });
    test('lookahead caps resolve by white ui, white headless, and black branches', () => {
        expect(CpuLv6RuntimeCapability.resolveCpuLv6LookaheadTimeCaps(cpuLv6SharedProfile, {
            playerKey: 'white',
            isBrowserUi: true
        })).toEqual(cpuLv6SharedProfile.browser.lookaheadTimeCaps.whiteUi);
        expect(CpuLv6RuntimeCapability.resolveCpuLv6LookaheadTimeCaps(cpuLv6SharedProfile, {
            playerKey: 'white',
            isBrowserUi: false
        })).toEqual(cpuLv6SharedProfile.browser.lookaheadTimeCaps.whiteHeadless);
        expect(CpuLv6RuntimeCapability.resolveCpuLv6LookaheadTimeCaps(cpuLv6SharedProfile, {
            playerKey: 'black',
            isBrowserUi: true
        })).toEqual(cpuLv6SharedProfile.browser.lookaheadTimeCaps.black);
    });
    test('shared helper exposes teacher profile and lookahead weights from the shared profile', () => {
        expect(CpuLv6RuntimeCapability.resolveCpuLv6TeacherProfile(cpuLv6SharedProfile)).toBe(cpuLv6SharedProfile.teacher);
        expect(CpuLv6RuntimeCapability.resolveCpuLv6LookaheadWeights(cpuLv6SharedProfile)).toEqual(cpuLv6SharedProfile.browser.lookaheadWeights);
    });
    test('standard-board compatibility helper only accepts 8x8 boards', () => {
        expect(CpuLv6RuntimeCapability.isStandardBoardCpuPolicyCompatible(Array.from({ length: 8 }, () => Array(8).fill(0)))).toBe(true);
        expect(CpuLv6RuntimeCapability.isStandardBoardCpuPolicyCompatible(Array.from({ length: 7 }, () => Array(9).fill(0)))).toBe(false);
    });
});
//# sourceMappingURL=shared.cpu-lv6-runtime-capability.test.js.map