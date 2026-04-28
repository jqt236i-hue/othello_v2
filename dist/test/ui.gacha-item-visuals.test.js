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
const ItemVisualsModule = __importStar(require("../ui/gacha/gacha-item-visuals.js"));
describe('gacha item visuals', () => {
    test('placement sound items hide img previews and show fallback tiles', () => {
        const doc = {
            createElement(tagName) {
                return {
                    tagName,
                    className: '',
                    textContent: '',
                    hidden: false,
                    src: '',
                    children: [],
                    appendChild(child) {
                        this.children.push(child);
                    },
                    removeAttribute(name) {
                        if (name === 'src')
                            this.src = '';
                    }
                };
            }
        };
        const image = doc.createElement('img');
        const fallback = ItemVisualsModule.createSoundFallbackTile(doc, 'gacha-result-fallback');
        ItemVisualsModule.applyItemPreviewState({
            id: 'gacha__n__placement_sound__type-1-standard',
            kind: 'placement_sound',
            label: 'type-1-standard'
        }, image, fallback);
        expect(ItemVisualsModule.getItemKindLabel({ kind: 'placement_sound' })).toBe('配置音');
        expect(image.hidden).toBe(true);
        expect(fallback.hidden).toBe(false);
    });
    test('background items keep image previews and use the background label', () => {
        const doc = {
            createElement(tagName) {
                return {
                    tagName,
                    className: '',
                    textContent: '',
                    hidden: false,
                    src: '',
                    children: [],
                    appendChild(child) {
                        this.children.push(child);
                    },
                    removeAttribute(name) {
                        if (name === 'src')
                            this.src = '';
                    }
                };
            }
        };
        const image = doc.createElement('img');
        const fallback = ItemVisualsModule.createSoundFallbackTile(doc, 'gacha-result-fallback');
        ItemVisualsModule.applyItemPreviewState({
            id: 'gacha__n__background_skin__観測できなかった夜',
            kind: 'background_skin',
            label: '観測できなかった夜',
            imagePath: 'assets/images/Gacha/N/background/観測できなかった夜.png'
        }, image, fallback);
        expect(ItemVisualsModule.getItemKindLabel({ kind: 'background_skin' })).toBe('背景');
        expect(image.hidden).toBe(false);
        expect(image.src).toBe('assets/images/Gacha/N/background/観測できなかった夜.png');
        expect(fallback.hidden).toBe(true);
    });
});
//# sourceMappingURL=ui.gacha-item-visuals.test.js.map