import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const keys = [
  'ui/bootstrap/init-dom',
  'ui/bootstrap',
  'ui/bootstrap/init-events',
  'ui/bootstrap/init-game',
  'ui/bootstrap/init-network'
];

for (const key of keys) {
  const hasKey = registry.includes(`_r("${key}"`);
  console.log(`${key}: ${hasKey ? 'FOUND' : 'MISSING'}`);
}
