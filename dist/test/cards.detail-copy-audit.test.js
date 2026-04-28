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
const catalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
const FORBIDDEN_DETAIL_TOKENS = /(UI|画面|バナー|server|currentPlayer|gameState|slot|window|pending|ペンディング|タイムアウト|ネット対戦|コントローラー|DOM|アニメ|remainingOwnerTurns)/;
function buildComparisonKey(text) {
    return String(text || '')
        .trim()
        .replace(/[\s\u3000]/g, '')
        .replace(/[。\.、,，:：;；!！?？'"“”‘’\-ー／/（）()\[\]{}「」『』【】<>《》・]/g, '')
        .toLowerCase();
}
describe('card detail copy audit', () => {
    test('every catalog card exposes explicit supplementary detail text', () => {
        for (const card of catalog.cards) {
            expect(Object.prototype.hasOwnProperty.call(CardInteractionEffects.detailCardEffectByType, card.type)).toBe(true);
            const resolved = CardInteractionEffects.resolveCardDescriptionTexts({
                id: card.id,
                type: card.type,
                name: card.name_ja,
                desc: card.desc_ja
            });
            const quickText = String(resolved.quickText || '').trim();
            const distinctDetailText = String(resolved.distinctDetailText || '').trim();
            expect(distinctDetailText).toBeTruthy();
            expect(buildComparisonKey(distinctDetailText)).not.toBe(buildComparisonKey(quickText));
            expect(distinctDetailText).not.toMatch(FORBIDDEN_DETAIL_TOKENS);
        }
    });
});
//# sourceMappingURL=cards.detail-copy-audit.test.js.map