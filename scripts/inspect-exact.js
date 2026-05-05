const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');

const key = 'card-system';
const marker = '_r("' + key + '",';
const idx = r.indexOf(marker);
const start = r.indexOf('`', idx);
const end = r.indexOf('`));', start);
const body = r.substring(start + 1, end);

console.log('Body first 200 chars:');
console.log(JSON.stringify(body.substring(0, 200)));

console.log('\nChars around first 200:');
for (let i = 140; i < 200; i++) {
    const ch = body.charCodeAt(i);
    if (ch < 32 || ch > 126) {
        console.log(i + ': charCode=' + ch + ' char=' + JSON.stringify(body[i]));
    }
}

// Test with new Function: does removing first 144 chars help?
try {
    new Function('module', 'exports', 'require', '__dirname', '__filename', body.substring(0, 144));
    console.log('\nFirst 144 chars: PASS');
} catch (e) {
    console.log('\nFirst 144 chars: FAIL -', e.message);
}

// Check the exact position by testing char by char
let lastPass = 0;
for (let i = 1; i <= 200; i++) {
    try {
        new Function(body.substring(0, i));
        lastPass = i;
    } catch (e) {
        if (i > lastPass + 1) {
            console.log('\nFirst failure at pos', lastPass + 1, '- char:', JSON.stringify(body[lastPass]), 'code:', body.charCodeAt(lastPass));
            console.log('Context:', JSON.stringify(body.substring(Math.max(0, lastPass - 10), lastPass + 10)));
            break;
        }
    }
}