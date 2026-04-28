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
describe('catalog generator', () => {
    test('generated object matches cards/catalog.json', () => {
        const generated = generator.generate();
        const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
        expect(generated).toEqual(jsonCatalog);
    });
    test('generated file content parses to same object as cards/catalog.js', () => {
        // ensure window.CardCatalog is set by requiring browser file
        if (typeof window === 'undefined')
            global.window = {};
        require(path.resolve(__dirname, '..', 'cards', 'catalog.js'));
        const jsCatalog = window.CardCatalog;
        expect(jsCatalog).toBeDefined();
        const generated = generator.generate();
        // Check core properties (avoid brittle full-object equality): version, length, and per-card id/name/desc/type/cost
        expect(jsCatalog.version).toBe(generated.version);
        expect(jsCatalog.cards.length).toBe(generated.cards.length);
        const mapJson = new Map(generated.cards.map(c => [c.id, c]));
        const mapJs = new Map(jsCatalog.cards.map(c => [c.id, c]));
        for (const [id, jsonCard] of mapJson.entries()) {
            expect(mapJs.has(id)).toBe(true);
            const jsCard = mapJs.get(id);
            expect(jsCard.id).toBe(jsonCard.id);
            expect(jsCard.name).toBe(jsonCard.name_ja || jsonCard.name);
            expect(jsCard.type).toBe(jsonCard.type);
            expect(Number(jsCard.cost)).toBe(Number(jsonCard.cost));
            expect(jsCard.desc).toBe(jsonCard.desc_ja || jsonCard.desc || '');
        }
    });
});
//# sourceMappingURL=cards.generate.test.js.map