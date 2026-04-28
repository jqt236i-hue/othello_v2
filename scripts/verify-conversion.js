const fs = require('fs');
const files = [
  { js: 'game/card-effects/selection-flow.js', ts: 'game/card-effects/selection-flow.ts' },
  { js: 'game/ai/policy-onnx-runtime.js', ts: 'game/ai/policy-onnx-runtime.ts' },
  { js: 'game/cards/target-resolver.js', ts: 'game/cards/target-resolver.ts' },
  { js: 'game/game/cards/target-resolver.js', ts: 'game/game/cards/target-resolver.ts' },
  { js: 'game/turn-manager.js', ts: 'game/turn-manager.ts' },
  { js: 'game/ai/fixed-commentary-engine.js', ts: 'game/ai/fixed-commentary-engine.ts' },
  { js: 'cards/catalog.js', ts: 'cards/catalog.ts' }
];

console.log('=== CONVERSION SUMMARY ===\n');
for (const { js, ts } of files) {
  const jsStats = fs.statSync(js);
  const tsStats = fs.statSync(ts);
  const jsContent = fs.readFileSync(js, 'utf8');
  const isWrapper = jsContent.includes('module.exports = require');
  const tsContent = fs.readFileSync(ts, 'utf8');
  const hasExport = tsContent.includes('export =');
  const hasNocheck = tsContent.includes('@ts-nocheck');
  
  console.log(ts + ':');
  console.log('  - Size: ' + tsStats.size + ' bytes');
  console.log('  - JS wrapper: ' + (isWrapper ? 'YES' : 'NO'));
  console.log('  - Has export =: ' + (hasExport ? 'YES' : 'NO'));
  console.log('  - Has @ts-nocheck: ' + (hasNocheck ? 'YES' : 'NO'));
  console.log();
}
