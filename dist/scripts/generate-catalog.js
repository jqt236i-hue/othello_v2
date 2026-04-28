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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function generate() {
    const jsonPath = path.resolve(__dirname, '..', 'cards', 'catalog.json');
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    // Ensure version exists
    if (typeof json.version === 'undefined')
        json.version = 1;
    return json;
}
function toBrowserCatalog(source) {
    return {
        ...source,
        cards: Array.isArray(source.cards)
            ? source.cards.map((card) => ({
                ...card,
                name: card.name_ja || card.name || '',
                desc: card.desc_ja || card.desc || ''
            }))
            : []
    };
}
function generateFile(outPath) {
    const obj = generate();
    const content = '// Auto-generated from cards/catalog.json - do not edit directly.\n' +
        '// Use: node scripts/generate-catalog.js to regenerate.\n' +
        'window.CardCatalog = ' + JSON.stringify(obj, null, 2) + ';\n';
    fs.writeFileSync(outPath, content, 'utf8');
}
function generateBrowserFile(outPath) {
    const obj = toBrowserCatalog(generate());
    const content = '// Auto-generated from cards/catalog.json - do not edit directly.\n' +
        '// Use: node scripts/generate-catalog.js to regenerate.\n' +
        'window.CardCatalog = ' + JSON.stringify(obj, null, 2) + ';\n';
    fs.writeFileSync(outPath, content, 'utf8');
}
if (require.main === module) {
    const generatedPath = path.resolve(__dirname, '..', 'cards', 'catalog.generated.js');
    const browserPath = path.resolve(__dirname, '..', 'cards', 'catalog.js');
    generateFile(generatedPath);
    generateBrowserFile(browserPath);
    console.log('Generated', generatedPath);
    console.log('Generated', browserPath);
}
module.exports = { generate, generateFile, toBrowserCatalog, generateBrowserFile };
//# sourceMappingURL=generate-catalog.js.map