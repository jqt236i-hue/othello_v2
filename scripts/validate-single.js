const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');

// Find a specific module entry and validate it
const key = 'card-system';
const idx = rl.indexOf('_r("' + key + '"');
const endIdx = rl.indexOf('`));', idx);
const entry = rl.substring(idx, endIdx + 4);

// Extract the function body (between backticks)
const backtickStart = entry.indexOf('`');
const backtickEnd = entry.lastIndexOf('`');
const body = entry.substring(backtickStart + 1, backtickEnd);

// Unescape backslash sequences that were applied for template literal
const unescaped = body.replace(/\\`/g, '`').replace(/\\\$\{/g, '${').replace(/\\\\/g, '\\');

try {
    new Function('module', 'exports', 'require', '__dirname', '__filename', unescaped);
    console.log(key + ': OK');
} catch(e) {
    console.log(key + ': ' + e.message.substring(0, 200));
    // Show first 500 chars of unescaped body for context
    const errorLine = e.message.match(/position\s+(\d+)/);
    if (errorLine) {
        const pos = parseInt(errorLine[1]);
        console.log('Near error pos ' + pos + ':', unescaped.substring(Math.max(0, pos-50), pos+50));
    }
}