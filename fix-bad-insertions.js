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

function fixBadAnyInsertions(fileName) {
  const filePath = path.join('scripts', fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix : any in control flow statements
  // if (xxx: any) -> if (xxx)
  content = content.replace(/if\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*: any\s*\)/g, (match, p1) => {
    modified = true;
    return `if (${p1})`;
  });

  // while (xxx: any) -> while (xxx)
  content = content.replace(/while\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*: any\s*\)/g, (match, p1) => {
    modified = true;
    return `while (${p1})`;
  });

  // switch (xxx: any) -> switch (xxx)
  content = content.replace(/switch\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*: any\s*\)/g, (match, p1) => {
    modified = true;
    return `switch (${p1})`;
  });

  // for (const xxx: any of -> for (const xxx of
  content = content.replace(/for\s*\(\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*: any\s+of\s+/g, (match, p1) => {
    modified = true;
    return `for (const ${p1} of `;
  });

  // for (let xxx: any of -> for (let xxx of
  content = content.replace(/for\s*\(\s*let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*: any\s+of\s+/g, (match, p1) => {
    modified = true;
    return `for (let ${p1} of `;
  });

  // catch (xxx: any) -> catch (xxx)
  content = content.replace(/catch\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*: any\s*\)/g, (match, p1) => {
    modified = true;
    return `catch (${p1})`;
  });

  // typeof xxx: any -> typeof xxx (might occur in conditions)
  content = content.replace(/typeof\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*: any/g, (match, p1) => {
    modified = true;
    return `typeof ${p1}`;
  });

  // Fix cases where : any was added after a property access like obj.prop
  // This can happen in if (obj.prop: any) etc.
  content = content.replace(/if\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*)\s*: any\s*\)/g, (match, p1) => {
    modified = true;
    return `if (${p1})`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed bad insertions: ${fileName}`);
  }
}

for (const file of targetFiles) {
  fixBadAnyInsertions(file);
}

console.log('Done fixing bad insertions.');
