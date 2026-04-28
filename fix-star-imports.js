const fs = require('fs');
const path = require('path');

const targetFiles = [
  'audit-card-context-parity.ts',
  'audit-card-use-future-delta.ts',
  'audit-corner-use-drift.ts',
  'benchmark-policy-onnx-gate.ts',
  'benchmark-policy-quality-gate.ts',
  'clean-selfplay-artifacts.ts',
  'deploy-lane-model-to-root.ts',
  'export-teacher-solutions.ts',
  'generate-selfplay-data-parallel.ts',
  'load-training-profile.ts',
  'local-cpu-commentary-server.ts',
  'match-network-smoke.ts',
  'monitor-selfplay-training-run.ts',
  'preflight-deepcfr-training.ts',
  'preflight-selfplay-training.ts',
  'prepare-worker-assets.ts',
  'promote-policy-model.ts',
  'replay-adoption-gate.ts',
  'run-foundation-bootstrap.ts',
  'run-hardcase-mining.ts',
  'run-hardcase-retrain.ts',
  'run-selfplay-training-preset.ts',
  'run-selfplay-training-profile.ts',
  'run-ui-level-match.ts',
  'seed-bank-manager.ts',
  'serve-with-fallback.ts',
  'training-artifact-status.ts',
  'training-cycle-command-builders.ts',
  'training-cycle-reporting.ts',
  'training-resolved-config-utils.ts',
  'training-warehouse-manifest-utils.ts'
];

function fixImportStars(fileName) {
  const filePath = path.join('scripts', fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Replace `import * as _name from './module';` with `import _name from './module';`
  // Only for local modules (starting with ./)
  const regex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"](\.\/[^'"]+)['"];/g;
  
  content = content.replace(regex, (match, varName, modulePath) => {
    modified = true;
    return `import ${varName} from '${modulePath}';`;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed star imports: ${fileName}`);
  }
}

for (const file of targetFiles) {
  fixImportStars(file);
}

console.log('Done fixing star imports.');
