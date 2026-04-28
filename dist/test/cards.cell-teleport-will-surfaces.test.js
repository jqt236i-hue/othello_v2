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
    id: 'cell_teleport_01',
    name_ja: 'マステレポート',
    type: 'CELL_TELEPORT_WILL',
    cost: 18,
    desc_ja: 'マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴化。',
    display_type_ja: '執行'
});
const EXPECTED_BROWSER_CARD = Object.freeze({
    ...EXPECTED_BASE_CARD,
    name: 'マステレポート',
    desc: 'マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴化。'
});
const EXPECTED_QUICK_TEXT = 'マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴化。';
const EXPECTED_DETAIL_TEXT = '現在の盤面上に存在する石のあるマスを1つ選ぶ。\n選ばれた石を、盤面拡張・盤面拡張神で追加可能な外側マスのうち空いている1マスへランダムにテレポートさせる。\n移動先が未生成ならその拡張マスを作ってから移動し、元のマスは永続の穴になる。\n対象は敵味方・通常石・特殊石・爆弾を問わない。';
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
describe('CELL_TELEPORT_WILL catalog/help surfaces', () => {
    afterEach(() => {
        jest.resetModules();
        try {
            delete global.window;
        }
        catch (error) { }
    });
    test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for CELL_TELEPORT_WILL', () => {
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
    test('CardInteractionEffects exposes quick/detail help text for CELL_TELEPORT_WILL', () => {
        const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
        const cardDef = {
            type: 'CELL_TELEPORT_WILL',
            desc: EXPECTED_BROWSER_CARD.desc
        };
        expect(CardInteractionEffects.quickCardEffectByType.CELL_TELEPORT_WILL).toBe(EXPECTED_QUICK_TEXT);
        expect(CardInteractionEffects.detailCardEffectByType.CELL_TELEPORT_WILL).toBe(EXPECTED_DETAIL_TEXT);
        expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
        expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
        expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
    });
    test('shared constants and rulebook keep the cell teleport wording in sync', () => {
        const SharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.js'));
        const rulebook = fs.readFileSync(path.resolve(__dirname, '..', '01-rulebook.md'), 'utf8');
        const sharedCard = ((SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'CELL_TELEPORT_WILL')) || null;
        expect(sharedCard).toEqual(expect.objectContaining({
            id: EXPECTED_BASE_CARD.id,
            name: EXPECTED_BASE_CARD.name_ja,
            type: EXPECTED_BASE_CARD.type,
            cost: EXPECTED_BASE_CARD.cost,
            desc: EXPECTED_QUICK_TEXT
        }));
        expect(rulebook).toContain('### 10.35.3 CELL_TELEPORT_WILL（マステレポート）');
        expect(rulebook).toContain(EXPECTED_QUICK_TEXT);
    });
});
//# sourceMappingURL=cards.cell-teleport-will-surfaces.test.js.map