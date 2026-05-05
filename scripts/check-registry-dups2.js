const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');
const re = /_r\("([^"]+)",\s*new Function\(/g;
let m;
let last = '';
let dups = 0;
while ((m = re.exec(rl)) !== null) {
    if (m[1] === last) {
        console.log('DUP:', m[1]);
        dups++;
    }
    last = m[1];
}
console.log('duplicates:', dups);

// Also check for the specific SyntaxError lines
const lines = rl.split('\n');
console.log('Line 16590:', lines[16589].substring(0, 80));
console.log('Line 81002:', lines[81001].substring(0, 80));