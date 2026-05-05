const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');

// Find ui/handlers/init in the registry
const key = 'ui/handlers/init';
const re = new RegExp('_r\\("' + key.replace(/\//g, '\\/') + '",\\s*("(?:[^"\\\\]|\\\\.)*")');
const m = r.match(re);
if (!m) { console.log('NOT FOUND'); process.exit(1); }

const jsonStr = m[1];
const body = JSON.parse(jsonStr);

// Check factory body for _require handling
console.log('=== Factory body first 2000 chars ===');
console.log(body.substring(0, 2000));
