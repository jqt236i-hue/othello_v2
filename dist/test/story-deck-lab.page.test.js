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
describe('story deck lab page', () => {
    test('root page loads base card sizing styles before deck lab layout', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'story-deck-lab.html'), 'utf8');
        const variablesTag = '<link rel="stylesheet" href="styles-variables.css">';
        const baseTag = '<link rel="stylesheet" href="styles-base.css">';
        const layoutTag = '<link rel="stylesheet" href="styles-layout.css">';
        const cardsTag = '<link rel="stylesheet" href="styles-cards.css">';
        expect(html.includes(variablesTag)).toBe(true);
        expect(html.includes(baseTag)).toBe(true);
        expect(html.includes(layoutTag)).toBe(true);
        expect(html.includes(cardsTag)).toBe(true);
        expect(html.indexOf(layoutTag)).toBeGreaterThan(html.indexOf(baseTag));
        expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(layoutTag));
    });
    test('root page loads story deck lab modules in order', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'story-deck-lab.html'), 'utf8');
        const sharedConstantsTag = '<script src="shared-constants.js"></script>';
        const specTag = '<script src="shared/story-deck-spec.js"></script>';
        const codecTag = '<script src="shared/story-deck-codec.js"></script>';
        const controllerTag = '<script src="ui/story-deck-lab/story-deck-lab-controller.js"></script>';
        expect(html.includes(sharedConstantsTag)).toBe(true);
        expect(html.includes(specTag)).toBe(true);
        expect(html.includes(codecTag)).toBe(true);
        expect(html.includes(controllerTag)).toBe(true);
        expect(html.indexOf(specTag)).toBeGreaterThan(html.indexOf(sharedConstantsTag));
        expect(html.indexOf(codecTag)).toBeGreaterThan(html.indexOf(specTag));
        expect(html.indexOf(controllerTag)).toBeGreaterThan(html.indexOf(codecTag));
    });
    test('worker-public page mirrors story deck lab modules', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'worker-public', 'story-deck-lab.html'), 'utf8');
        expect(html.includes('<link rel="stylesheet" href="styles-variables.css">')).toBe(true);
        expect(html.includes('<link rel="stylesheet" href="styles-base.css">')).toBe(true);
        expect(html.includes('<script src="shared/story-deck-spec.js"></script>')).toBe(true);
        expect(html.includes('<script src="shared/story-deck-codec.js"></script>')).toBe(true);
        expect(html.includes('<script src="ui/story-deck-lab/story-deck-lab-controller.js"></script>')).toBe(true);
    });
});
//# sourceMappingURL=story-deck-lab.page.test.js.map