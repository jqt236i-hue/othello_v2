/**
 * Check what specific token is invalid in card-system factory body.
 */
const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');

const key = 'card-system';
const marker = `_r("${key}",`;
const idx = r.indexOf(marker);
const start = r.indexOf('`', idx);
const end = r.indexOf('`));', start);
const body = r.substring(start + 1, end);

// Try to find the invalid token by bisecting
function testBody(b) {
    try {
        new Function('module', 'exports', 'require', '__dirname', '__filename', b);
        return true;
    } catch (e) {
        return e.message;
    }
}

// Find the rough position
let lo = 0, hi = body.length;
while (hi - lo > 100) {
    const mid = Math.floor((lo + hi) / 2);
    if (testBody(body.substring(0, mid)) === true) {
        lo = mid;
    } else {
        hi = mid;
    }
}

console.log('Error starts around position:', lo);
console.log('Context around error:');
console.log(body.substring(Math.max(0, lo - 100), lo + 200));

// Also check if backslash escaping is the problem
const backslashPositions = [];
for (let i = 0; i < body.length; i++) {
    if (body[i] === '\\') {
        backslashPositions.push({ pos: i, context: body.substring(Math.max(0, i - 5), i + 10) });
    }
}
console.log('\nBackslash positions (first 20):');
backslashPositions.slice(0, 20).forEach(bp => console.log(`  pos ${bp.pos}: ...${bp.context}...`));