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
const StoryDeckLabStateModule = __importStar(require("../ui/story-deck-lab/story-deck-lab-state.js"));
const StoryDeckSpecHelpers = __importStar(require("../shared/story-deck-spec.js"));
describe('story deck lab state', () => {
    test('free30 allows more than 3 copies of the same card', () => {
        const targetCardId = StoryDeckSpecHelpers.getEnabledCardDefs()[0].id;
        let draft = StoryDeckLabStateModule.createEmptyDraft('free30');
        for (let index = 0; index < 5; index += 1) {
            draft = StoryDeckLabStateModule.addCardToDraft(draft, targetCardId);
        }
        expect(StoryDeckLabStateModule.getSelectedCount(draft, targetCardId)).toBe(5);
    });
    test('unique30 clamps duplicate copies to one when switching rule set', () => {
        const targetCardId = StoryDeckSpecHelpers.getEnabledCardDefs()[0].id;
        let draft = StoryDeckLabStateModule.createEmptyDraft('free30');
        draft = StoryDeckLabStateModule.addCardToDraft(draft, targetCardId);
        draft = StoryDeckLabStateModule.addCardToDraft(draft, targetCardId);
        draft = StoryDeckLabStateModule.setRuleSetId(draft, 'unique30');
        expect(StoryDeckLabStateModule.getSelectedCount(draft, targetCardId)).toBe(1);
        expect(StoryDeckLabStateModule.canAddCardToDraft(draft, targetCardId)).toBe(false);
    });
    test('draft can round-trip through story deck spec', () => {
        const cardIds = StoryDeckSpecHelpers.getEnabledCardDefs()
            .slice(0, 2)
            .flatMap((cardDef, index) => new Array(index === 0 ? 14 : 16).fill(cardDef.id));
        const originalDraft = StoryDeckLabStateModule.createDraftFromStoryDeckSpec(StoryDeckSpecHelpers.createStoryDeckSpecFromCardIds(cardIds, { ruleSetId: 'free30' }));
        const deckSpec = StoryDeckLabStateModule.createStoryDeckSpecFromDraft(originalDraft);
        const restoredDraft = StoryDeckLabStateModule.createDraftFromStoryDeckSpec(deckSpec);
        expect(restoredDraft).toEqual(originalDraft);
    });
});
//# sourceMappingURL=ui.story-deck-lab-state.test.js.map