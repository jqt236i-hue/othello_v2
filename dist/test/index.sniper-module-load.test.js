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
function assertSniperScriptOrder(html, targetLabel) {
    const randomSourceTag = '<script src="game/logic/cards-internal/random-source.js"></script>';
    const sniperTag = '<script src="game/logic/cards/sniper.js"></script>';
    const lightningTag = '<script src="game/logic/cards/lightning.js"></script>';
    const destroyDragonTag = '<script src="game/logic/cards/destroy_dragon.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';
    const randomSourceIndex = html.indexOf(randomSourceTag);
    const sniperIndex = html.indexOf(sniperTag);
    const lightningIndex = html.indexOf(lightningTag);
    const destroyDragonIndex = html.indexOf(destroyDragonTag);
    const cardsIndex = html.indexOf(cardsTag);
    expect(randomSourceIndex).toBeGreaterThanOrEqual(0);
    expect(sniperIndex).toBeGreaterThanOrEqual(0);
    expect(lightningIndex).toBeGreaterThanOrEqual(0);
    expect(destroyDragonIndex).toBeGreaterThanOrEqual(0);
    expect(cardsIndex).toBeGreaterThanOrEqual(0);
    expect(randomSourceIndex).toBeLessThan(sniperIndex);
    expect(randomSourceIndex).toBeLessThan(lightningIndex);
    expect(randomSourceIndex).toBeLessThan(destroyDragonIndex);
    expect(sniperIndex).toBeLessThan(cardsIndex);
    expect(lightningIndex).toBeLessThan(cardsIndex);
    expect(destroyDragonIndex).toBeLessThan(cardsIndex);
    if (randomSourceIndex < 0 || sniperIndex < 0 || lightningIndex < 0 || destroyDragonIndex < 0 || cardsIndex < 0 || randomSourceIndex >= sniperIndex || randomSourceIndex >= lightningIndex || randomSourceIndex >= destroyDragonIndex || sniperIndex >= cardsIndex || lightningIndex >= cardsIndex || destroyDragonIndex >= cardsIndex) {
        throw new Error(`${targetLabel}: sniper.js load order is invalid`);
    }
}
describe('sniper module load order', () => {
    test('index.html loads sniper.js before cards.js', () => {
        const htmlPath = path.join(__dirname, '..', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        assertSniperScriptOrder(html, 'index.html');
    });
    test('worker-public/index.html loads sniper.js before cards.js', () => {
        const htmlPath = path.join(__dirname, '..', 'worker-public', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        assertSniperScriptOrder(html, 'worker-public/index.html');
    });
});
//# sourceMappingURL=index.sniper-module-load.test.js.map