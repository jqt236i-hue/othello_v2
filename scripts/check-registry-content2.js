const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');
const matches = [];
let pos = 0;
while ((pos = rl.indexOf('const exports =', pos)) !== -1) {
    // Find the registry key for this module
    const prev_r = rl.lastIndexOf('_r("', pos);
    const keyMatch = rl.substring(prev_r, prev_r + 80).match(/_r\("([^"]+)"/);
    matches.push({key: keyMatch ? keyMatch[1] : 'unknown', pos: pos});
    pos += 15;
}
console.log('Remaining const exports = :', matches.length);
matches.slice(0, 10).forEach(m => console.log('  ' + m.key + ' at pos ' + m.pos));

// Also check for 'const require' patterns
let pos2 = 0;
let requireMatches = 0;
while ((pos2 = rl.indexOf('const require', pos2)) !== -1) {
    requireMatches++;
    pos2 += 14;
}
console.log('Remaining const require:', requireMatches);

// Check for 'require is not defined' patterns
let pos3 = 0;
let bareRequire = 0;
// Look for patterns like: `require("...` that aren't prefixed with _require
const re = /(?<!\w)require\("/g;
let m;
while ((m = re.exec(rl)) !== null) {
    bareRequire++;
}
console.log('Bare require( calls:', bareRequire);