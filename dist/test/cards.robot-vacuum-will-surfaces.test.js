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
    id: 'robot_vacuum_01',
    name_ja: 'ロボット掃除機',
    type: 'ROBOT_VACUUM_WILL',
    cost: 17,
    desc_ja: '次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。',
    display_type_ja: '戦闘'
});
const EXPECTED_BROWSER_CARD = Object.freeze({
    ...EXPECTED_BASE_CARD,
    name: 'ロボット掃除機',
    desc: '次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。'
});
const EXPECTED_QUICK_TEXT = '次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。';
const EXPECTED_DETAIL_TEXT = '移動先は周囲8マスの空きから敵石に近づく候補を優先して1マス選ぶ（同優先度はランダム）。\n空きが無い場合はその場で消滅する。\n吸い込み後も反転は発生しない。\n吸い込み成功ごとに持続ターン+1（基本5ターン、所有者ターン開始時のみ減算）。\n守る意志の完全保護中の石は吸い込めない。';
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
describe('ROBOT_VACUUM_WILL catalog/help surfaces', () => {
    afterEach(() => {
        jest.resetModules();
        try {
            delete global.window;
        }
        catch (error) { /* Intentionally empty: test cleanup guard */ }
    });
    test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for ROBOT_VACUUM_WILL', () => {
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
    test('CardInteractionEffects exposes quick/detail help text for ROBOT_VACUUM_WILL', () => {
        const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
        const cardDef = {
            type: 'ROBOT_VACUUM_WILL',
            desc: EXPECTED_BROWSER_CARD.desc
        };
        expect(CardInteractionEffects.quickCardEffectByType.ROBOT_VACUUM_WILL).toBe(EXPECTED_QUICK_TEXT);
        expect(CardInteractionEffects.detailCardEffectByType.ROBOT_VACUUM_WILL).toBe(EXPECTED_DETAIL_TEXT);
        expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
        expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
        expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
    });
    test('shared constants and rulebook keep the robot vacuum wording in sync', () => {
        const SharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.js'));
        const rulebook = fs.readFileSync(path.resolve(__dirname, '..', '01-rulebook.md'), 'utf8');
        const sharedCard = ((SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'ROBOT_VACUUM_WILL')) || null;
        expect(sharedCard).toEqual(expect.objectContaining({
            id: EXPECTED_BASE_CARD.id,
            name: EXPECTED_BASE_CARD.name_ja,
            type: EXPECTED_BASE_CARD.type,
            cost: EXPECTED_BASE_CARD.cost,
            desc: EXPECTED_QUICK_TEXT
        }));
        expect(rulebook).toContain('### 10.17.3 ROBOT_VACUUM_WILL（ロボット掃除機）');
        expect(rulebook).toContain(EXPECTED_QUICK_TEXT);
    });
});
//# sourceMappingURL=cards.robot-vacuum-will-surfaces.test.js.map