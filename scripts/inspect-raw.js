const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');

// The body is inside a template literal, so we're seeing it AFTER template literal parsing.
// When we read from the file, backtick escaping has already been processed by JS.
// So the issue is: what does `new Function(...)` see when it tries to parse this?

// Let's look at the RAW file content (before template literal processing)
const key = 'card-system';
const marker = '_r("' + key + '",';
const idx = r.indexOf(marker);
const lineStart = r.lastIndexOf('\n', idx) + 1;
const lineEnd = r.indexOf('\n', idx);
const firstLine = r.substring(lineStart, Math.min(lineEnd || lineStart + 300, lineStart + 300));
console.log('Registration line start:');
console.log(firstLine);

// Find the template literal start in the RAW file
const btStart = r.indexOf('`', idx);
console.log('\nTemplate literal starts at:', btStart);

// The raw content between backticks includes the escaping
// Let's find what's problematic
// Let's just check if the ENTIRE registry file is valid JS
try {
    new Function(r);
    console.log('\nEntire registry file is valid JS');
} catch (e) {
    console.log('\nRegistry file JS parse error:', e.message);
    // Try to find the position
    const posMatch = e.message.match(/position\s+(\d+)/i) || e.message.match(/line\s+(\d+)/i);
    console.log('Position info:', posMatch ? posMatch[0] : 'unknown');
}

// Let's extract the raw template literal content (between backticks)
// and check for problematic sequences
const rawContent = r.substring(btStart + 1, r.indexOf('`));', btStart));
console.log('\nRaw content length:', rawContent.length);

// Check for unescaped backticks that would break the template literal
let btCount = 0;
let problematicBt = -1;
for (let i = 0; i < rawContent.length; i++) {
    if (rawContent[i] === '`' && (i === 0 || rawContent[i-1] !== '\\')) {
        btCount++;
        if (problematicBt < 0) {
            problematicBt = i;
            console.log('Unescaped backtick at position', i, ':', JSON.stringify(rawContent.substring(Math.max(0,i-20), i+20)));
        }
    }
}
console.log('Total unescaped backticks:', btCount);

// Check for ${ that's not escaped
let unescapedDollar = -1;
for (let i = 0; i < rawContent.length - 1; i++) {
    if (rawContent[i] === '$' && rawContent[i+1] === '{' && (i === 0 || rawContent[i-1] !== '\\')) {
        if (unescapedDollar < 0) {
            unescapedDollar = i;
            console.log('Unescaped ${ at position', i, ':', JSON.stringify(rawContent.substring(Math.max(0,i-20), i+20)));
        }
    }
}