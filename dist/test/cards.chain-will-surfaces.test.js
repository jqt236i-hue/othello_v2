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
const EXPECTED_CARDS = Object.freeze([
    {
        id: 'double_chain_01',
        name_ja: '二連鎖の意志',
        type: 'DOUBLE_CHAIN_WILL',
        cost: 22,
        desc_ja: '反転後新たに挟める列ができた場合、1列追加反転する。使用後、三連鎖の意志が手札に加わる。',
        display_type_ja: '禁忌',
        detail: 'この手の通常反転を起点に、追加反転を1回行う。\n使用後、三連鎖の意志が手札に加わる。'
    },
    {
        id: 'triple_chain_01',
        name_ja: '三連鎖の意志',
        type: 'TRIPLE_CHAIN_WILL',
        cost: 22,
        desc_ja: '反転後新たに挟める列ができた場合、2列追加反転する。使用後、四連鎖の意志が手札に加わる。',
        display_type_ja: '禁忌',
        detail: 'この手の通常反転を起点に、追加反転を2回行う。\n使用後、四連鎖の意志が手札に加わる。'
    },
    {
        id: 'quad_chain_01',
        name_ja: '四連鎖の意志',
        type: 'QUAD_CHAIN_WILL',
        cost: 22,
        desc_ja: '反転後新たに挟める列ができた場合、3列追加反転する。使用後、無限連鎖の意志が手札に加わる。',
        display_type_ja: '禁忌',
        detail: 'この手の通常反転を起点に、追加反転を3回行う。\n使用後、無限連鎖の意志が手札に加わる。'
    },
    {
        id: 'infinite_chain_01',
        name_ja: '無限連鎖の意志',
        type: 'INFINITE_CHAIN_WILL',
        cost: 50,
        desc_ja: '反転後新たに挟める列ができた場合、可能な限り追加反転する。',
        display_type_ja: '禁忌',
        detail: 'この手の通常反転を起点に、追加反転を可能な限り続ける。\n追加反転できなくなった時点で終了する。'
    }
]);
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
describe('CHAIN_WILL catalog/help surfaces', () => {
    afterEach(() => {
        jest.resetModules();
        try {
            delete global.window;
        }
        catch (error) { /* Intentionally empty: test cleanup guard */ }
    });
    test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for chain cards', () => {
        const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
        const generatedCatalogObject = generator.generate();
        const browserCatalog = loadWindowCatalog('cards\\catalog.js');
        const generatedWindowCatalog = loadWindowCatalog('cards\\catalog.generated.js');
        for (const expected of EXPECTED_CARDS) {
            const { detail, ...baseExpected } = expected;
            const jsonEntry = getCardById(jsonCatalog, expected.id);
            const generatedEntry = getCardById(generatedCatalogObject, expected.id);
            const browserEntry = getCardById(browserCatalog, expected.id);
            const generatedWindowEntry = getCardById(generatedWindowCatalog, expected.id);
            const baseFields = Object.keys(baseExpected);
            expect(jsonEntry).toEqual(expect.objectContaining(baseExpected));
            expect(generatedEntry).toEqual(expect.objectContaining(baseExpected));
            expect(browserEntry).toEqual(expect.objectContaining({
                ...baseExpected,
                name: expected.name_ja,
                desc: expected.desc_ja
            }));
            expect(generatedWindowEntry).toEqual(expect.objectContaining(baseExpected));
            expect(pickCardFields(browserEntry, baseFields)).toEqual(pickCardFields(generatedWindowEntry, baseFields));
            expect(browserEntry.name).toBe(browserEntry.name_ja);
            expect(browserEntry.desc).toBe(browserEntry.desc_ja);
        }
    });
    test('CardInteractionEffects exposes quick/detail help text for chain cards', () => {
        const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
        for (const expected of EXPECTED_CARDS) {
            const cardDef = {
                type: expected.type,
                desc: expected.desc_ja
            };
            expect(CardInteractionEffects.quickCardEffectByType[expected.type]).toBe(expected.desc_ja);
            expect(CardInteractionEffects.detailCardEffectByType[expected.type]).toBe(expected.detail);
            expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(expected.desc_ja);
            expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(expected.detail);
            expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
        }
    });
});
//# sourceMappingURL=cards.chain-will-surfaces.test.js.map