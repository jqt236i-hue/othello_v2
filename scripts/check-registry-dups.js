const fs = require('fs');
const lines = fs.readFileSync('public/module-registry.js', 'utf8').split('\n');
let bad = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('const exports =') && line.includes('_r(')) {
        bad++;
        console.log('L' + (i+1) + ': ' + line.substring(0, 120));
    }
    if (line.includes('const _require =') && line.includes('_r(')) {
        bad++;
        console.log('L' + (i+1) + ': ' + line.substring(0, 120));
    }
}
console.log('total issues:', bad);