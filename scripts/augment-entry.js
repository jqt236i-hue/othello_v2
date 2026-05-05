// Augment entry-browser.js with window assignments for all require() calls
const fs = require('fs');
const content = fs.readFileSync('entry-browser.js', 'utf8');
const lines = content.split('\n');
const result = [];
const assignedModules = new Set();
let varN = 1;

for (const line of lines) {
  const trimmed = line.trim();
  // Match lines that are pure require() calls (no assignment)
  const m = trimmed.match(/^require\(["'](\.\/dist\/[^"']+)["']\);?\s*$/);
  if (m) {
    const modPath = m[1];
    if (!assignedModules.has(modPath)) {
      assignedModules.add(modPath);
      const varName = '_mod' + (varN++);
      result.push('var ' + varName + ' = require("' + modPath + '");');
      result.push('if (' + varName + ') Object.assign(window, ' + varName + ');');
    } else {
      result.push(line);
    }
  } else {
    result.push(line);
  }
}
fs.writeFileSync('entry-browser-augmented.js', result.join('\n'));
console.log('Written entry-browser-augmented.js');
console.log('Module exposures added: ' + assignedModules.size);
