const fs = require('fs');

// Test: simulate what __cjsRegister does
const registryContent = fs.readFileSync('public/module-registry.js', 'utf8');

// First, let's test the actual JSON.parse on the first entry
const re = /_r\("([^"]+)",\s*("(?:[^"\\]|\\.)*")\s*\);/;
const m = registryContent.match(re);
if (m) {
    const key = m[1];
    const jsonStr = m[2];
    console.log('Key:', key);
    console.log('JSON string first 100 chars:', jsonStr.substring(0, 100));
    console.log('JSON string last 20 chars:', jsonStr.substring(jsonStr.length - 20));
    try {
        const body = JSON.parse(jsonStr);
        console.log('JSON.parse: SUCCESS');
        if (body.startsWith('var _require')) {
            console.log('Body starts with var _require: OK');
        } else {
            console.log('Body starts with:', body.substring(0, 50));
        }
    } catch (e) {
        console.log('JSON.parse FAILED:', e.message);
        // Try to find the issue
        for (let i = 0; i < jsonStr.length; i++) {
            try {
                JSON.parse(jsonStr.substring(0, i + 1));
            } catch (e2) {
                // Check if this is the first time it fails
                console.log('First failure at position', i, 'char:', jsonStr[i], 'code:', jsonStr.charCodeAt(i));
                break;
            }
        }
    }
} else {
    console.log('No match for first entry');
}

// Also check: is the registry valid JavaScript?
try {
    new Function(registryContent);
    console.log('\nEntire registry file: VALID JS');
} catch (e) {
    console.log('\nEntire registry file: INVALID JS -', e.message);
}
