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
describe('generate observation gacha catalog', () => {
    test('derives rarity and display name from assets/images/Gacha', () => {
        import { generateObservationGachaCatalogs } from '../scripts/generate-observation-gacha-catalog.js';
        const result = (0, generate_observation_gacha_catalog_js_1.generateObservationGachaCatalogs)({
            root: path.resolve(__dirname, '..'),
            write: false
        });
        expect(result.handCatalog.sourceDir).toBe('assets/images/Gacha');
        expect(result.handCatalog.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'gacha__n__人の手',
                label: '人の手',
                rarity: 'N',
                imagePath: 'assets/images/Gacha/N/人の手.png'
            }),
            expect.objectContaining({
                id: 'gacha__n__陽気な手',
                label: '陽気な手',
                rarity: 'N',
                imagePath: 'assets/images/Gacha/N/陽気な手.png'
            }),
            expect.objectContaining({
                id: 'gacha__n__小鬼の手',
                label: '小鬼の手',
                rarity: 'N',
                imagePath: 'assets/images/Gacha/N/小鬼の手.png'
            }),
            expect.objectContaining({
                id: 'gacha__sr__虹の手',
                label: '虹の手',
                rarity: 'SR',
                imagePath: 'assets/images/Gacha/SR/虹の手.png'
            })
        ]));
        expect(result.observationCatalog.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'gacha__n__background_skin__観測できなかった夜',
                label: '観測できなかった夜',
                rarity: 'N',
                kind: 'background_skin',
                imagePath: 'assets/images/Gacha/N/background/観測できなかった夜.png',
                previewImagePath: 'assets/images/Gacha/N/background/観測できなかった夜.png'
            }),
            expect.objectContaining({
                id: 'gacha__sr__background_skin__宇宙の観測',
                label: '宇宙の観測',
                rarity: 'SR',
                kind: 'background_skin',
                imagePath: 'assets/images/Gacha/SR/background/宇宙の観測.png',
                previewImagePath: 'assets/images/Gacha/SR/background/宇宙の観測.png'
            }),
            expect.objectContaining({
                id: 'gacha__n__placement_sound__type-1-standard',
                label: 'type-1-standard',
                rarity: 'N',
                kind: 'placement_sound',
                assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
                soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
            })
        ]));
        expect(result.handCatalog.items).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'gacha__n__background_skin__観測できなかった夜'
            }),
            expect.objectContaining({
                id: 'gacha__sr__background_skin__宇宙の観測'
            })
        ]));
    });
});
//# sourceMappingURL=scripts.generate-observation-gacha-catalog.test.js.map