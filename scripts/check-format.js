const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');
// Check first 5 _r entries
const re = /_r\("([^"]+)",/g;
let m, count = 0;
while ((m = re.exec(r)) !== null && count < 5) {
    const key = m[1];
    const start = m.index;
    const end = r.indexOf(');', start);
    const snippet = r.substring(start, Math.min(start + 150, end + 2));
    console.log('Entry ' + (count + 1) + ': ' + snippet);
    count++;
}
console.log('\nFile size:', r.length, 'bytes');
console.log('File starts with:', r.substring(0, 80));
