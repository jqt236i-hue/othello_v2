const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');
const lines = rl.split('\n');

// Find the lines with "exports" redeclaration error
// Error was at line 16590 in browser, but file has been regenerated
// Search for "const exports =" inside a _r( call context

// Strategy: find _r( lines, then scan forward for "const exports =" or "const _require" inside the template literal
let count = 0;
let issues = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('_r(') && line.includes('new Function(')) {
        // This is a registry entry start - find its module key
        const keyMatch = line.match(/_r\("([^"]+)"/);
        if (keyMatch) {
            const key = keyMatch[1];
            // The template literal starts on this line
            // Scan forward for const exports or const _require
            const bodyStart = line.indexOf('`');
            if (bodyStart >= 0) {
                // Collect body until closing `
                let body = line.substring(bodyStart + 1);
                for (let j = i + 1; j < lines.length && !lines[j].includes('`));'); j++) {
                    body += '\n' + lines[j];
                }
                if (body.includes('const exports =')) {
                    issues.push({line: i+1, key, issue: 'const exports'});
                    count++;
                }
                if (body.includes('const _require =')) {
                    issues.push({line: i+1, key, issue: 'const _require'});
                    count++;
                }
            }
        }
    }
}
console.log('Issues found:', count);
issues.slice(0, 20).forEach(i => console.log(`L${i.line}: ${i.key} - ${i.issue}`));