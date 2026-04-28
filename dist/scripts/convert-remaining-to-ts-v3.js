"use strict";
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}
const fs = _require('fs');
const path = _require('path');
function createTsFile(jsPath, tsPath, typesPath, customExtract) {
    if (!fs.existsSync(jsPath)) {
        console.log(`SKIP: ${path.basename(jsPath)} does not exist`);
        return false;
    }
    if (fs.existsSync(tsPath)) {
        console.log(`SKIP: ${path.basename(tsPath)} already exists`);
        return false;
    }
    const content = fs.readFileSync(jsPath, 'utf8');
    let body = customExtract ? customExtract(content) : content;
    if (!body) {
        console.log(`ERROR: Could not extract body from ${path.basename(jsPath)}`);
        return false;
    }
    const header = `// @ts-nocheck\nimport type { CardState, GameState, PlayerKey } from '${typesPath}';\n\ndeclare const __non_webpack_require__: NodeRequire | undefined;\n\nconst _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n  ? __non_webpack_require__\n  : require;\n\n`;
    fs.writeFileSync(tsPath, header + body);
    console.log(`CREATED: ${path.basename(tsPath)}`);
    return true;
}
// 1. game/card-effects/selection-flow.js - UMD wrapper
{
    const jsPath = path.join(process.cwd(), 'game/card-effects/selection-flow.js');
    const content = fs.readFileSync(jsPath, 'utf8');
    // Find the factory function body
    const factoryStart = content.indexOf("function (root) {\n    ");
    const factoryEnd = content.lastIndexOf('}));');
    if (factoryStart === -1 || factoryEnd === -1) {
        console.log('ERROR: Could not parse selection-flow.js');
    }
    else {
        const body = content.substring(factoryStart + "function (root) {\n    \n".length, factoryEnd).trim();
        createTsFile(jsPath, path.join(process.cwd(), 'game/card-effects/selection-flow.ts'), '../../src/types', () => body);
    }
}
// 2. game/ai/policy-onnx-runtime.js - IIFE
{
    const jsPath = path.join(process.cwd(), 'game/ai/policy-onnx-runtime.js');
    const content = fs.readFileSync(jsPath, 'utf8');
    const start = content.indexOf("(() => {\n");
    const end = content.lastIndexOf('})();');
    if (start === -1 || end === -1) {
        console.log('ERROR: Could not parse policy-onnx-runtime.js');
    }
    else {
        const body = content.substring(start + "(() => {\n\n".length, end).trim();
        createTsFile(jsPath, path.join(process.cwd(), 'game/ai/policy-onnx-runtime.ts'), '../../src/types', () => body);
    }
}
// 3. game/cards/target-resolver.js - UMD with deps
{
    const jsPath = path.join(process.cwd(), 'game/cards/target-resolver.js');
    const content = fs.readFileSync(jsPath, 'utf8');
    const start = content.indexOf("function (SharedConstants, SharedBoardUtils, CardMarkers, CardSelectors, CardTargets) {\n    ");
    const end = content.lastIndexOf('}));');
    if (start === -1 || end === -1) {
        console.log('ERROR: Could not parse game/cards/target-resolver.js');
    }
    else {
        let body = content.substring(start + "function (SharedConstants, SharedBoardUtils, CardMarkers, CardSelectors, CardTargets) {\n    \n".length, end).trim();
        // Add imports at the beginning
        const imports = `const SharedConstants = _require('../../shared-constants');\nconst SharedBoardUtils = _require('../../shared/shared-board-utils');\nconst CardMarkers = _require('../logic/cards/markers');\nconst CardSelectors = _require('../logic/cards/selectors');\nconst CardTargets = _require('../logic/cards/targets');\n\nconst { BLACK, WHITE, EMPTY, DIRECTIONS, BOARD_SIZE } = SharedConstants || {};\nconst BoardUtils = SharedBoardUtils || null;\nconst Markers = CardMarkers || {};\nconst Selectors = CardSelectors || {};\nconst Targets = CardTargets || {};\n\n`;
        // Remove the destructuring lines from body since we're adding them above
        body = body.replace(/const \{ BLACK, WHITE, EMPTY, DIRECTIONS, BOARD_SIZE \} = SharedConstants \|\| \{\};\n/, '');
        body = body.replace(/const BoardUtils = SharedBoardUtils \|\| null;\n/, '');
        body = body.replace(/const Markers = CardMarkers \|\| \{\};\n/, '');
        body = body.replace(/const Selectors = CardSelectors \|\| \{\};\n/, '');
        body = body.replace(/const Targets = CardTargets \|\| \{\};\n/, '');
        createTsFile(jsPath, path.join(process.cwd(), 'game/cards/target-resolver.ts'), '../../src/types', () => imports + body);
    }
}
// 4. game/game/cards/target-resolver.js - custom _require
{
    const jsPath = path.join(process.cwd(), 'game/game/cards/target-resolver.js');
    const content = fs.readFileSync(jsPath, 'utf8');
    // Find where the actual code starts after the requires
    const codeStart = content.indexOf("const { BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};");
    const end = content.lastIndexOf('};');
    if (codeStart === -1 || end === -1) {
        console.log('ERROR: Could not parse game/game/cards/target-resolver.js');
    }
    else {
        let body = content.substring(codeStart, end).trim();
        // Add imports
        const imports = `const SharedConstants = _require('../../shared-constants');\nconst BoardUtils = _require('../../shared/shared-board-utils');\nconst Markers = _require('../logic/cards/markers');\nconst Selectors = _require('../logic/cards/selectors');\nconst Targets = _require('../logic/cards/targets');\n\n`;
        createTsFile(jsPath, path.join(process.cwd(), 'game/game/cards/target-resolver.ts'), '../../../src/types', () => imports + body);
    }
}
// 5. game/turn-manager.js - plain file with requires at top
{
    const jsPath = path.join(process.cwd(), 'game/turn-manager.js');
    createTsFile(jsPath, path.join(process.cwd(), 'game/turn-manager.ts'), '../src/types', (content) => {
        // Replace the require patterns with _require
        let body = content;
        body = body.replace(/if \(typeof require === 'function'\) \{\n?\s*try \{ ([^}]+)\} catch \(e\) \{ \/\* ignore \*\/ \}\n?\s*\}/g, (match, p1) => {
            return p1.replace(/require\(/g, '_require(');
        });
        body = body.replace(/require\(/g, '_require(');
        return body;
    });
}
// 6. game/ai/fixed-commentary-engine.js - UMD
{
    const jsPath = path.join(process.cwd(), 'game/ai/fixed-commentary-engine.js');
    const content = fs.readFileSync(jsPath, 'utf8');
    const start = content.indexOf("function () {\n    let Data = null;");
    const end = content.lastIndexOf('}));');
    if (start === -1 || end === -1) {
        console.log('ERROR: Could not parse fixed-commentary-engine.js');
    }
    else {
        let body = content.substring(start + "function () {\n    ".length, end).trim();
        // Add imports
        const imports = `let Data: any = null;\nlet CommentaryContextHelpers: any = null;\nlet CommentaryRuntimeHelpers: any = null;\nlet OwnerHelpersModule: any = null;\ntry {\n    Data = _require('../../data/dialogue/fixed-commentary-data');\n} catch (e) { Data = null; }\nif (!Data) {\n    try { Data = _require('../..//data/dialogue/fixed-commentary-data'); } catch (e) { Data = null; }\n}\ntry { CommentaryContextHelpers = _require('../../shared/commentary-context-helpers'); } catch (e) { CommentaryContextHelpers = null; }\ntry { CommentaryRuntimeHelpers = _require('../../shared/commentary-runtime-helpers'); } catch (e) { CommentaryRuntimeHelpers = null; }\ntry { OwnerHelpersModule = _require('../../utils/owner-helpers'); } catch (e) { OwnerHelpersModule = null; }\n\n`;
        // Remove the original require block
        body = body.replace(/let Data = null;\nlet CommentaryContextHelpers = null;\nlet CommentaryRuntimeHelpers = null;\nlet OwnerHelpersModule = null;\nif \(typeof require === 'function'\) \{[\s\S]*?\}\n/, '');
        createTsFile(jsPath, path.join(process.cwd(), 'game/ai/fixed-commentary-engine.ts'), '../../src/types', () => imports + body);
    }
}
// 7. cards/catalog.js - plain data file
{
    const jsPath = path.join(process.cwd(), 'cards/catalog.js');
    const content = fs.readFileSync(jsPath, 'utf8');
    // This is a simple data assignment - convert to export
    const body = content.replace('window.CardCatalog = ', 'const CardCatalog = ') + '\n\nexport = CardCatalog;\n';
    createTsFile(jsPath, path.join(process.cwd(), 'cards/catalog.ts'), '../src/types', () => body);
}
console.log('All conversions complete!');
//# sourceMappingURL=convert-remaining-to-ts-v3.js.map