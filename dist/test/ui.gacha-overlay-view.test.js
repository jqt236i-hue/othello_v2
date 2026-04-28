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
const jsdom_1 = require("jsdom");
const OverlayViewModule = __importStar(require("../ui/gacha/gacha-overlay-view.js"));
describe('gacha overlay view', () => {
    test('renders hand, background, and placement-sound rewards with the correct visuals', () => {
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><body>
      <button id="gachaOpenBtn"></button>
      <div id="gachaOverlay"></div>
      <div id="gachaModal"></div>
      <button id="gachaCloseBtn"></button>
      <div id="gachaBalanceValue"></div>
      <button id="gachaDetailToggleBtn"></button>
      <div id="gachaDetailsPanel"></div>
      <button id="gachaSinglePullBtn"></button>
      <button id="gachaTenPullBtn"></button>
      <div id="gachaStatusText"></div>
      <div id="gachaResults"></div>
    </body>`);
        const view = OverlayViewModule.createGachaOverlayView({
            document: dom.window.document,
            root: dom.window
        });
        view.renderPullResults([
            {
                rarity: 'N',
                item: {
                    id: 'gacha__n__小鬼の手',
                    kind: 'hand_skin',
                    label: '小鬼の手',
                    imagePath: 'assets/images/Gacha/N/小鬼の手.png',
                    previewImagePath: 'assets/images/Gacha/N/小鬼の手.png'
                }
            },
            {
                rarity: 'N',
                item: {
                    id: 'gacha__n__background_skin__観測できなかった夜',
                    kind: 'background_skin',
                    label: '観測できなかった夜',
                    imagePath: 'assets/images/Gacha/N/background/観測できなかった夜.png',
                    previewImagePath: 'assets/images/Gacha/N/background/観測できなかった夜.png'
                }
            },
            {
                rarity: 'N',
                item: {
                    id: 'gacha__n__placement_sound__type-1-standard',
                    kind: 'placement_sound',
                    label: 'type-1-standard',
                    assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
                    soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
                }
            }
        ], ['gacha__n__placement_sound__type-1-standard']);
        const cards = Array.from(dom.window.document.querySelectorAll('.gacha-result-card'));
        expect(cards).toHaveLength(3);
        expect(cards[0].querySelector('.gacha-result-image')).toBeTruthy();
        expect(cards[0].querySelector('.gacha-result-fallback').hidden).toBe(true);
        expect(cards[0].querySelector('.gacha-result-kind').textContent).toBe('手の見た目');
        expect(cards[1].querySelector('.gacha-result-image').hidden).toBe(false);
        expect(cards[1].querySelector('.gacha-result-fallback').hidden).toBe(true);
        expect(cards[1].querySelector('.gacha-result-kind').textContent).toBe('背景');
        expect(cards[2].querySelector('.gacha-result-image').hidden).toBe(true);
        expect(cards[2].querySelector('.gacha-result-fallback').hidden).toBe(false);
        expect(cards[2].querySelector('.gacha-item-fallback-icon').textContent).toBe('SOUND');
        expect(cards[2].querySelector('.gacha-result-kind').textContent).toBe('配置音');
        expect(cards[2].querySelector('.gacha-result-status').textContent).toBe('NEW');
        dom.window.close();
    });
});
//# sourceMappingURL=ui.gacha-overlay-view.test.js.map