const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');
// Match: _r("key", "json-string");
const re = /_r\("([^"]+)",\s*("(?:[^"\\]|\\.)*")\s*\);/g;
let m;
let checked = 0, fails = 0;
while ((m = re.exec(rl)) !== null) {
    const key = m[1], jsonStr = m[2];
    let body;
    try { body = JSON.parse(jsonStr); } catch(e) { fails++; if (fails <= 10) console.log('JSON[' + key + ']: ' + e.message.substring(0, 80)); continue; }
    try { new Function('module', 'exports', '__dirname', '__filename', body); } catch(e) { fails++; if (fails <= 20) console.log('FN[' + key + ']: ' + e.message.substring(0, 100)); }
    checked++;
}
console.log('\nChecked: ' + checked + '  Fails: ' + fails);
if (fails > 20) console.log('... and ' + (fails - 20) + ' more failures');