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
const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));
const EXPECTED_BASE_CARD = Object.freeze({
    id: 'afterimage_will_01',
    name_ja: '残像の意志',
    type: 'AFTERIMAGE_WILL',
    cost: 8,
    desc_ja: '次に置く石は反転または破壊されたとき3回まで復活する、復活後挟める列があれば反転させる。',
    display_type_ja: '守護'
});
const EXPECTED_BROWSER_CARD = Object.freeze({
    ...EXPECTED_BASE_CARD,
    name: '残像の意志',
    desc: '次に置く石は反転または破壊されたとき3回まで復活する、復活後挟める列があれば反転させる。'
});
const EXPECTED_QUICK_TEXT = '次に置く石は反転または破壊されたとき3回まで復活する、復活後挟める列があれば反転させる。';
const EXPECTED_DETAIL_TEXT = '次に置く石を残像石化する。\n残像石は反転回避3回と破壊回避3回を持つ特殊石。\n回避に成功した時だけ対応する回数を1消費する。\n片方だけ0になっても、もう片方が残る間は残像石のまま継続する。\n反転回避で移動先が無い場合は消滅し、破壊回避で空きマスが無い場合はそのまま破壊される。\n両方0になると特殊石状態を解除して通常石へ戻る。';
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
describe('AFTERIMAGE_WILL catalog/help surfaces', () => {
    afterEach(() => {
        jest.resetModules();
        try {
            delete global.window;
        }
        catch (error) { /* Intentionally empty: test cleanup guard */ }
    });
    test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for AFTERIMAGE_WILL', () => {
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
    test('CardInteractionEffects exposes quick/detail help text for AFTERIMAGE_WILL', () => {
        const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
        const cardDef = {
            type: 'AFTERIMAGE_WILL',
            desc: EXPECTED_BROWSER_CARD.desc
        };
        expect(CardInteractionEffects.quickCardEffectByType.AFTERIMAGE_WILL).toBe(EXPECTED_QUICK_TEXT);
        expect(CardInteractionEffects.detailCardEffectByType.AFTERIMAGE_WILL).toBe(EXPECTED_DETAIL_TEXT);
        expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
        expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
        expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
    });
});
//# sourceMappingURL=cards.afterimage-will-surfaces.test.js.map