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
const SharedConstants = __importStar(require("../shared-constants.js"));
const StoryDeckSpecHelpers = __importStar(require("../shared/story-deck-spec.js"));
const StoryDeckCodecModule = __importStar(require("../shared/story-deck-codec.js"));
function getEnabledIds(count) {
    const ids = (SharedConstants.CARD_DEFS || [])
        .filter((card) => card && card.enabled !== false && card.id)
        .map((card) => card.id)
        .slice(0, count);
    expect(ids).toHaveLength(count);
    return ids;
}
describe('shared story deck codec', () => {
    test('free30 deck encodes and decodes canonically even when duplicates exceed normal 3-copy limit', () => {
        const ids = getEnabledIds(2);
        const deckSpec = StoryDeckSpecHelpers.createStoryDeckSpecFromCardIds(new Array(12).fill(ids[0]).concat(new Array(18).fill(ids[1])), { ruleSetId: 'free30' });
        const deckCode = StoryDeckCodecModule.encodeStoryDeckSpec(deckSpec);
        const decoded = StoryDeckCodecModule.decodeStoryDeckCode(deckCode);
        expect(deckCode.startsWith('SD1C')).toBe(true);
        expect(deckCode.includes('Rfree30:')).toBe(true);
        expect(decoded).toEqual(deckSpec);
        expect(StoryDeckSpecHelpers.expandStoryDeckSpec(decoded)).toHaveLength(30);
    });
    test('unique30 rejects duplicate cards', () => {
        const ids = getEnabledIds(29);
        const duplicatedDeckIds = ids.concat(ids[0]);
        expect(() => StoryDeckSpecHelpers.createStoryDeckSpecFromCardIds(duplicatedDeckIds, { ruleSetId: 'unique30' }))
            .toThrow(/1 枚まで/);
    });
    test('safeDecodeStoryDeckCode rejects malformed codes', () => {
        const result = StoryDeckCodecModule.safeDecodeStoryDeckCode('not-a-story-deck-code');
        expect(result.ok).toBe(false);
        expect(result.deckSpec).toBeNull();
        expect(result.error).toBeTruthy();
        expect(result.error.code).toBe('STORY_DECK_CODE_INVALID');
    });
});
//# sourceMappingURL=shared.story-deck-codec.test.js.map