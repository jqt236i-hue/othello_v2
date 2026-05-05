const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');
const keys = [
  'ui/bootstrap/init-dom',
  'ui/bootstrap',
  'ui/bootstrap/init-events',
  'ui/bootstrap/init-game',
  'ui/bootstrap/init-network',
];
for (const key of keys) {
  const has = r.includes('_r("' + key + '"');
  console.log(key + ': ' + (has ? 'FOUND' : 'MISSING'));
}
