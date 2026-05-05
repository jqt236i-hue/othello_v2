// Augment entry-browser.js with window assignments for all require() calls
// AND store module exports under window._modules for _require() compatibility
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('entry-browser-original.js', 'utf8');
const lines = content.split('\n');
const result = [];
let varN = 1;

// Initialize _modules store
result.push('window._modules = window._modules || {};');

for (const line of lines) {
  const trimmed = line.trim();
  // Match lines that are pure require() calls (no assignment)
  const m = trimmed.match(/^require\(["'](.+?)["']\);?\s*$/);
  if (m) {
    const modPath = m[1];
    // Resolve to absolute from dist/
    const absPath = path.resolve('dist', modPath);
    const varName = '_mod' + (varN++);
    result.push('var ' + varName + ' = require("' + modPath + '");');
    result.push('if (' + varName + ') Object.assign(window, ' + varName + ');');
    result.push('window._modules["' + absPath.replace(/\\/g, '/') + '"] = ' + varName + ';');
  } else {
    result.push(line);
  }
}

fs.writeFileSync('entry-browser-augmented.js', result.join('\n'));
console.log('Written entry-browser-augmented.js');
