// Add _modules tracking and restore original entry-browser
const fs = require('fs');
const path = require('path');

// Read the original entry content from the current file
// We need the non-augmented version
// Let's reconstruct from the augmented by stripping the _modN assignments

// Actually, let's just add _modules tracking to the current entry-browser.js
let content = fs.readFileSync('entry-browser.js', 'utf8');

// Add _modules init at top
content = 'window._modules = {};\n' + content;

// Add module path storage after each Object.assign line
// Pattern: if (_modN) Object.assign(window, _modN);
// Add: window._modules[path] = _modN;
content = content.replace(
  /if \(_mod(\d+)\) Object\.assign\(window, _mod\1\);/g,
  'if (_mod$1) { Object.assign(window, _mod$1); window._modules["dist$2"] = _mod$1; }'
);

// This regex approach is fragile. Let me use a different approach:
// Replace each: var _modN = require("path");\nif (_modN) Object.assign(window, _modN);
// With: same + window._modules entry

// Reset
content = fs.readFileSync('entry-browser.js', 'utf8');
content = 'window._modules = {};\n' + content;

const lines = content.split('\n');
const result = [];
let lastModPath = null;

for (const line of lines) {
  const m1 = line.match(/var _mod\d+ = require\("(.+?)"\)/);
  const m2 = line.match(/if \(_mod\d+\) Object\.assign\(window, _mod\d+\)/);
  
  if (m1) {
    lastModPath = m1[1]; // relative path like ./dist/game/logic/core
    result.push(line);
  } else if (m2 && lastModPath) {
    // Add module storage
    const absPath = path.resolve('dist', lastModPath).replace(/\\/g, '/');
    const varName = m2[0].match(/Object\.assign\(window, (_mod\d+)\)/)[1];
    result.push(line);
    result.push('window._modules["' + absPath + '"] = ' + varName + ';');
    lastModPath = null;
  } else {
    result.push(line);
  }
}

fs.writeFileSync('entry-browser.js', result.join('\n'));
console.log('Added _modules tracking to entry-browser.js');
