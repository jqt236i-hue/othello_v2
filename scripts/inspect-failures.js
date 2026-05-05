/**
 * Inspect failing factories to understand error patterns.
 */
const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');

// Extract each _r entry and test with new Function
const re = /_r\("([^"]+)",\s*new Function\("module","exports","require","__dirname","__filename",`/g;
let m;
let fails = [];
let count = 0;
let errorTypes = {};

while ((m = re.exec(r)) !== null) {
    const key = m[1];
    const funcBodyStart = m.index + m[0].length;
    const funcBodyEnd = r.indexOf('`));', funcBodyStart);
    if (funcBodyEnd < 0) {
        fails.push({ key, err: 'no closing found' });
        continue;
    }
    const body = r.substring(funcBodyStart, funcBodyEnd);
    try {
        new Function('module', 'exports', 'require', '__dirname', '__filename', body);
    } catch (e) {
        const errType = e.message.split(':')[0] || e.message.substring(0, 40);
        errorTypes[errType] = (errorTypes[errType] || 0) + 1;
        if (fails.length < 30) {
            // Find the problematic line
            const lines = body.split('\n');
            const lineMatch = e.message.match(/line (\d+)/);
            const colMatch = e.message.match(/column (\d+)/);
            let snippet = '';
            if (lineMatch) {
                const lineNum = parseInt(lineMatch[1]);
                const startLine = Math.max(0, lineNum - 3);
                const endLine = Math.min(lines.length, lineNum + 2);
                snippet = lines.slice(startLine, endLine).map((l, i) => `${startLine + i + 1}: ${l}`).join('\n');
            }
            fails.push({ 
                key, 
                err: e.message.substring(0, 200),
                snippet: snippet.substring(0, 500)
            });
        }
    }
    count++;
}

console.log('\nChecked:', count, 'Fails:', fails.length);
console.log('\nError type counts:', JSON.stringify(errorTypes));
console.log('\n--- First 30 failures ---');
fails.forEach(f => {
    console.log(`\n[${f.key}]: ${f.err}`);
    if (f.snippet) console.log(f.snippet);
});