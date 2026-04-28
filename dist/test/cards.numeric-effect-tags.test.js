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
const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
describe('CardInteractionEffects effect tags', () => {
    function getEffectTagLabels(cardType) {
        return CardInteractionEffects.resolveCardEffectTags({ type: cardType }).map((tag) => tag.label);
    }
    function getNumericTagLabels(cardType) {
        return CardInteractionEffects.resolveCardNumericTags({ type: cardType }).map((tag) => tag.label);
    }
    test('AFTERIMAGE_WILL returns flip and destroy evasion count tags', () => {
        expect(getEffectTagLabels('AFTERIMAGE_WILL')).toEqual(['反転回避3回', '破壊回避3回']);
    });
    test('HYPERACTIVE_INHERIT_WILL returns mixed evasion and duration tags', () => {
        expect(getEffectTagLabels('HYPERACTIVE_INHERIT_WILL')).toEqual(['反転回避1回', '破壊回避1回', '10ターン持続']);
    });
    test('ROBOT_VACUUM_WILL returns only its base duration tag', () => {
        expect(getEffectTagLabels('ROBOT_VACUUM_WILL')).toEqual(['5ターン持続']);
    });
    test('TIME_BOMB, TIME_STOP_GOD, PERMA_PROTECT_NEXT_STONE, and SEED_WILL use delayed activation tags', () => {
        expect(getNumericTagLabels('TIME_BOMB')).toEqual(['3ターン後に発動']);
        expect(getNumericTagLabels('TIME_STOP_GOD')).toEqual(['5ターン後に発動']);
        expect(getNumericTagLabels('PERMA_PROTECT_NEXT_STONE')).toEqual(['10ターン後に発動']);
        expect(getNumericTagLabels('SEED_WILL')).toEqual(['5ターン後に発動']);
    });
    test('TRAP_WILL and RIBO_WILL do not invent numeric tags for opponent-turn or repayment wording', () => {
        expect(getNumericTagLabels('TRAP_WILL')).toEqual([]);
        expect(getNumericTagLabels('RIBO_WILL')).toEqual([]);
    });
    test('protection tag audit covers all cards that should expose 反転保護 or 完全保護', () => {
        expect(getEffectTagLabels('PROTECTED_NEXT_STONE')).toEqual(['反転保護']);
        expect(getEffectTagLabels('PERMA_PROTECT_NEXT_STONE')).toEqual(['反転保護', '10ターン後に発動']);
        expect(getEffectTagLabels('ANCHOR_WILL')).toEqual(['反転保護']);
        expect(getEffectTagLabels('ULTIMATE_REVERSE_DRAGON')).toEqual(['反転保護', '5ターン持続']);
        expect(getEffectTagLabels('BREEDING_WILL')).toEqual(['反転保護', '5ターン持続']);
        expect(getEffectTagLabels('GLUTTONOUS_WILL')).toEqual(['反転保護']);
        expect(getEffectTagLabels('GUARD_WILL')).toEqual(['完全保護', '3ターン持続']);
        expect(getEffectTagLabels('GUARDIAN_GOD')).toEqual(['完全保護', '10ターン持続']);
        expect(getEffectTagLabels('ULTIMATE_DESTROY_GOD')).toEqual(['反転保護', '5ターン持続']);
        expect(getEffectTagLabels('DESTROY_DRAGON_WILL')).toEqual(['反転保護', '3ターン持続']);
        expect(getEffectTagLabels('LIGHTNING_WILL')).toEqual(['反転保護', '5ターン持続']);
    });
    test('numeric tag resolver stays numeric-only even after protection tags are added', () => {
        expect(getNumericTagLabels('PROTECTED_NEXT_STONE')).toEqual([]);
        expect(getNumericTagLabels('ANCHOR_WILL')).toEqual([]);
        expect(getNumericTagLabels('GUARD_WILL')).toEqual(['3ターン持続']);
        expect(getNumericTagLabels('DESTROY_DRAGON_WILL')).toEqual(['3ターン持続']);
    });
    test('resolveCardDescriptionTexts includes effectTags and numericTags alongside quick/detail text', () => {
        const resolved = CardInteractionEffects.resolveCardDescriptionTexts({
            type: 'DESTROY_DRAGON_WILL',
            desc: '次に置く石を破壊龍化する。'
        });
        expect(resolved.quickText).toContain('破壊龍化');
        expect(resolved.detailText).toContain('反転保護');
        expect(resolved.effectTags.map((tag) => tag.label)).toEqual(['反転保護', '3ターン持続']);
        expect(resolved.numericTags.map((tag) => tag.label)).toEqual(['3ターン持続']);
    });
});
//# sourceMappingURL=cards.numeric-effect-tags.test.js.map