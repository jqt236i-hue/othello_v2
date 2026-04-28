const fs = require('fs');
const path = require('path');

const filesWithShebang = [
  'benchmark-policy-onnx-gate.ts',
  'load-training-profile.ts',
  'local-cpu-commentary-server.ts',
  'monitor-selfplay-training-run.ts',
  'preflight-deepcfr-training.ts',
  'preflight-selfplay-training.ts',
  'promote-policy-model.ts',
  'run-selfplay-training-preset.ts',
  'run-selfplay-training-profile.ts',
  'run-ui-level-match.ts'
];

for (const file of filesWithShebang) {
  const filePath = path.join('scripts', file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.startsWith('// @ts-nocheck\n#!/usr/bin/env node')) {
    content = content.replace('// @ts-nocheck\n#!/usr/bin/env node', '#!/usr/bin/env node\n// @ts-nocheck');
    fs.writeFileSync(filePath, content);
    console.log(`Fixed shebang order: ${file}`);
  }
}

console.log('Done fixing shebangs.');
