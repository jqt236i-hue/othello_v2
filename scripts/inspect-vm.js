const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');

// The registry file parses as valid JS. The issue is in the factory bodies.
// Let's extract all factory bodies from the RAW file and test each one.

// The format is: _r("key", new Function("module","exports","require","__dirname","__filename",`...body...`));
// We need to extract the body from between the backticks

const lines = r.split('\n');
let totalFails = 0;
let totalChecked = 0;
let failSamples = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^  _r\("([^"]+)",\s*new Function\("module","exports","require","__dirname","__filename",\x60/);
    if (!match) continue;
    
    const key = match[1];
    // Find the end of this entry (line with `));
    let bodyParts = [];
    let j = i;
    let found = false;
    for (; j < lines.length; j++) {
        const lineEnd = lines[j].indexOf('\x60));');
        if (lineEnd >= 0 && j > i) {
            // This line has the closing
            bodyParts.push(lines[j].substring(0, lineEnd));
            found = true;
            break;
        }
        if (j > i) {
            if (lines[j].trim() === '});') {
                bodyParts.push(lines[j]);
                continue;
            }
            bodyParts.push(lines[j]);
        }
    }
    
    // Actually, the registry file has each factory on a single _r() call,
    // with the template literal spanning multiple lines until `));
    // Let me use a different approach - find the matching backtick
    
    // Skip this complex parsing for now. Let me test the whole file differently.
}

// Different approach: Just evaluate the whole registry file, then test each entry in __cjsRegistry
// First, let's load runtime.js, then module-registry.js, then test each factory

const runtime = fs.readFileSync('public/runtime.js', 'utf8');
const registry = fs.readFileSync('public/module-registry.js', 'utf8');

// Simulate browser environment
const vm = require('vm');
const context = { 
    window: {}, 
    console,
    Error,
    Object,
    Array,
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    TypeError,
    RangeError,
    SyntaxError
};
context.window = context;

// First run runtime.js
try {
    vm.runInNewContext(runtime, context);
    console.log('Runtime loaded OK');
    console.log('__cjsRegister:', typeof context.window.__cjsRegister);
    console.log('__cjsRegistry keys:', Object.keys(context.window.__cjsRegistry || {}).length);
} catch (e) {
    console.log('Runtime error:', e.message);
}

// Then run module-registry.js
try {
    vm.runInNewContext(registry, context);
    console.log('Registry loaded OK');
    console.log('__cjsRegistry keys:', Object.keys(context.window.__cjsRegistry || {}).length);
} catch (e) {
    console.log('Registry error:', e.message);
    // Find position
    const posMatch = e.message.match(/(\d+)/);
    if (posMatch) {
        const pos = parseInt(posMatch[0]);
        console.log('Around position:', registry.substring(Math.max(0, pos-100), pos+100));
    }
}