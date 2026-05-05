const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');
const key = 'card-system';
const searchStr = '_r("' + key + '"';
const idx = rl.indexOf(searchStr);
const endIdx = rl.indexOf('`));', idx + 10);
const entry = rl.substring(idx, Math.min(idx + 5000, endIdx + 4));
const lines = entry.split('\n');
for (let i = 0; i < 30 && i < lines.length; i++) {
    console.log(i + ': ' + lines[i].substring(0, 120));
}