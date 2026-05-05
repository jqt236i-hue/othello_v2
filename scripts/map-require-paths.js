// Build a mapping from dynamic _require() paths to window entries
const fs = require('fs');
const path = require('path');

// Step 1: From entry-browser.js, build a mapping of dist paths → window assignments
const entryContent = fs.readFileSync('entry-browser.js', 'utf8');
const lines = entryContent.split('\n');
const pathToWin = new Map();  // dist/foo/bar.js → window property name(s)

for (const line of lines) {
  // Match: var _modN = require("./dist/...");
  const m = line.match(/var\s+\w+\s*=\s*require\(["'](.+?)["']\)/);
  if (m) {
    let modPath = m[1];
    if (modPath.startsWith('./') || modPath.startsWith('../')) {
      modPath = path.resolve('dist', modPath);
    }
    pathToWin.set(modPath, null); // will fill in later
  }
}

// Step 2: Build a reverse mapping: relative path (as used in _require) → window property
// _require('../logic/cards') from dist/game/turn/turn_pipeline.js means:
//   absolute = path.resolve('dist/game/turn', '../logic/cards') = 'dist/game/logic/cards'
//   window property = whatever that module exported

// The augmented entry-browser does Object.assign(window, require(modPath)), so all exports are on window.
// Most _require calls expect the WHOLE export object, not individual properties.
// Solution: replace _require('../logic/cards') with window (since CardLogic and many others are already there)
// Better: return a mapping of known paths

// Actually, the simplest: define a global _require that returns window itself
// since Object.assign(window, exports) already put everything on window

// But that would be wrong for _require calls that need just one export...

// Most _require usage:
//   const X = _require('../path'); // expects X to be a specific object
//   const { Y } = _require('../path');
//   X = _require('../path');

// If Object.assign window has already put all exports on window, then:
//   - For const X = _require(...): X should be the specific export OR the whole module
//   - For destructuring: the module export should have those properties

// Let me add a global _require that returns a lookup object

console.log('Building _require mapping...');
console.log('Tracked paths: ' + pathToWin.size);
fs.writeFileSync('scripts/require-paths.json', JSON.stringify([...pathToWin.keys()], null, 2));
console.log('Done');
