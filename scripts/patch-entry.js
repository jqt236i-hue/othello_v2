const fs = require('fs');
let e = fs.readFileSync('entry-browser.js', 'utf8');

// For each `var _modN = require("./dist/...");` line,
// add `if (_modN) Object.assign(window, _modN);` after it.
const lines = e.split('\n');
const result = [];

let modCounter = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result.push(line);
    
    // Match:   var _modX = require("./dist/...");
    const match = line.match(/^\s*var\s+(_mod\d+)\s*=\s*require\(\s*"\.\/dist\/[^"]+"\s*\)\s*;$/);
    if (match) {
        const varName = match[1];
        result.push('  if (' + varName + ') Object.assign(window, ' + varName + ');');
    }
}

fs.writeFileSync('entry-browser.js', result.join('\n'), 'utf8');
console.log('Done. Lines:', result.length);

// Verify first few
for (let i = 0; i < result.length; i++) {
    if (result[i].includes('require(') && result[i].includes('./dist/')) {
        console.log('Line ' + (i + 1) + ': ' + result[i]);
        if (result[i + 1]) {
            console.log('Line ' + (i + 2) + ': ' + result[i + 1]);
        }
        break;
    }
}
