const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');

// New format: _r("key", "JSON-encoded-source");
const re = /_r\("([^"]+)",\s*(?:"(?:[^"\\]|\\.)*")\s*\);/g;
let m;
let count = 0;
let fails = [];

while ((m = re.exec(rl)) !== null) {
    const key = m[1];
    const start = m.index + m[0].length - 1; // re positions to end of match
    // Find the JSON string by scanning backward from the match end
    const jsonEnd = re.lastIndex - 2; // before );
    // Actually, let me parse differently. The _r("key", followed by JSON string.
    // Reset and use a simpler regex.
}

// Simpler approach: just scan line by line for _r(
const lines = rl.split('\n');
let checked = 0;
let failCount = 0;
let errorTypes = {};

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('_r(')) continue;
    // Extract the JSON string between _r("key", and );
    const firstQuote = line.indexOf('"');
    if (firstQuote < 0) continue;
    const secondQuote = line.indexOf('"', firstQuote + 1);
    if (secondQuote < 0) continue;
    const jsonStart = line.indexOf('"', secondQuote + 1); // start of JSON string
    if (jsonStart < 0) continue;
    // Find the end of the JSON string (unescaped " before );
    let jsonEnd = jsonStart + 1;
    while (jsonEnd < line.length) {
        if (line[jsonEnd] === '\\') { jsonEnd += 2; continue; }
        if (line[jsonEnd] === '"') break;
        jsonEnd++;
    }
    const jsonStr = line.substring(jsonStart, jsonEnd + 1);
    let body;
    try {
        body = JSON.parse(jsonStr);
    } catch (e) {
        failCount++;
        if (failCount <= 20) console.log('[' + line.substring(4, 40) + '...]: JSON parse error: ' + e.message.substring(0, 80));
        continue;
    }
    try {
        new Function('module', 'exports', '__dirname', '__filename', body);
    } catch (e) {
        failCount++;
        const errType = e.message.split('\n')[0].substring(0, 80);
        errorTypes[errType] = (errorTypes[errType] || 0) + 1;
        if (failCount <= 20) {
            console.log('[' + line.substring(4, 40) + '...]: ' + e.message.substring(0, 150));
        }
    }
    checked++;
}

console.log('\nChecked:', checked, 'Fails:', failCount);
console.log('Error type counts:', JSON.stringify(errorTypes));
