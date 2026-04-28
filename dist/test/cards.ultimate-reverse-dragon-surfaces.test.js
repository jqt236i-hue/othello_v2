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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));
const EXPECTED_BASE_CARD = Object.freeze({
    id: 'udr_01',
    name_ja: '究極反転龍',
    type: 'ULTIMATE_REVERSE_DRAGON',
    cost: 30,
    desc_ja: '空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（5ターン）。',
    display_type_ja: '戦闘'
});
const EXPECTED_BROWSER_CARD = Object.freeze({
    ...EXPECTED_BASE_CARD,
    name: '究極反転龍',
    desc: '空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（5ターン）。'
});
const EXPECTED_QUICK_TEXT = '空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（5ターン）。';
const EXPECTED_DETAIL_TEXT = '反転が0でも空きマスに配置できる。\n配置時に周囲1マス（8方向）を反転する。\n自ターン開始時はランダムな空きマスへ移動してから周囲1マス（8方向）を反転する。\n移動先が無いときはその場で反転する。\n持続は5ターン。\n反転保護を持つ特殊石として扱う。';
function getCardById(catalog, cardId) {
    return ((catalog && catalog.cards) || []).find((card) => card && card.id === cardId) || null;
}
function pickCardFields(card, fields) {
    return fields.reduce((result, field) => {
        result[field] = card ? card[field] : undefined;
        return result;
    }, {});
}
function loadWindowCatalog(relativePath) {
    jest.resetModules();
    global.window = {};
    require(path.resolve(__dirname, '..', relativePath));
    return window.CardCatalog;
}
describe('ULTIMATE_REVERSE_DRAGON catalog/help surfaces', () => {
    afterEach(() => {
        jest.resetModules();
        try {
            delete global.window;
        }
        catch (error) { }
    });
    test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for ULTIMATE_REVERSE_DRAGON', () => {
        const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
        const generatedCatalogObject = generator.generate();
        const browserCatalog = loadWindowCatalog('cards\\catalog.js');
        const generatedWindowCatalog = loadWindowCatalog('cards\\catalog.generated.js');
        const jsonEntry = getCardById(jsonCatalog, EXPECTED_BASE_CARD.id);
        const generatedEntry = getCardById(generatedCatalogObject, EXPECTED_BASE_CARD.id);
        const browserEntry = getCardById(browserCatalog, EXPECTED_BASE_CARD.id);
        const generatedWindowEntry = getCardById(generatedWindowCatalog, EXPECTED_BASE_CARD.id);
        const baseFields = Object.keys(EXPECTED_BASE_CARD);
        expect(jsonEntry).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
        expect(generatedEntry).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
        expect(browserEntry).toEqual(expect.objectContaining(EXPECTED_BROWSER_CARD));
        expect(generatedWindowEntry).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
        expect(pickCardFields(browserEntry, baseFields)).toEqual(pickCardFields(generatedWindowEntry, baseFields));
        expect(browserEntry.name).toBe(browserEntry.name_ja);
        expect(browserEntry.desc).toBe(browserEntry.desc_ja);
    });
    test('CardInteractionEffects exposes quick/detail help text for ULTIMATE_REVERSE_DRAGON', () => {
        const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
        const cardDef = {
            type: 'ULTIMATE_REVERSE_DRAGON',
            desc: EXPECTED_BROWSER_CARD.desc
        };
        expect(CardInteractionEffects.quickCardEffectByType.ULTIMATE_REVERSE_DRAGON).toBe(EXPECTED_QUICK_TEXT);
        expect(CardInteractionEffects.detailCardEffectByType.ULTIMATE_REVERSE_DRAGON).toBe(EXPECTED_DETAIL_TEXT);
        expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
        expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
        expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
    });
    test('shared constants and rulebook keep the UDR wording in sync', () => {
        const SharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.js'));
        const rulebook = fs.readFileSync(path.resolve(__dirname, '..', '01-rulebook.md'), 'utf8');
        const sharedCard = ((SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'ULTIMATE_REVERSE_DRAGON')) || null;
        expect(sharedCard).toEqual(expect.objectContaining({
            id: EXPECTED_BASE_CARD.id,
            name: EXPECTED_BASE_CARD.name_ja,
            type: EXPECTED_BASE_CARD.type,
            cost: EXPECTED_BASE_CARD.cost,
            desc: EXPECTED_QUICK_TEXT
        }));
        expect(rulebook).toContain('### 10.14 ULTIMATE_REVERSE_DRAGON（究極反転龍）');
        expect(rulebook).toContain(EXPECTED_QUICK_TEXT);
    });
});
//# sourceMappingURL=cards.ultimate-reverse-dragon-surfaces.test.js.map