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

function addAnyToParams(fileName) {
  const filePath = path.join('scripts', fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Match function declarations with simple parameters
  // function name(param1, param2, param3) {
  // Arrow functions: (param1, param2) =>
  // Method definitions: name(param1, param2) {

  // Add : any to simple function parameters
  // This regex matches function declarations/definitions with parameter lists containing only identifiers
  const funcRegex = /function\s+\w+\s*\(\s*([\w\s,]+)\s*\)/g;
  const methodRegex = /(\w+)\s*\(\s*([\w\s,]+)\s*\)\s*\{/g;
  const arrowRegex = /\(\s*([\w\s,]+)\s*\)\s*=>/g;

  function processParams(match, p1, offset, string) {
    // Check if already has type annotation
    if (p1.includes(':') || p1.includes('...')) return match;
    
    const params = p1.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (params.length === 0) return match;
    
    // Check if all params are simple identifiers (no destructuring)
    const allSimple = params.every(p => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p));
    if (!allSimple) return match;
    
    const typedParams = params.map(p => `${p}: any`).join(', ');
    return match.replace(p1, typedParams);
  }

  content = content.replace(funcRegex, (match, p1) => {
    if (p1.includes(':') || p1.includes('...')) return match;
    const params = p1.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (params.length === 0) return match;
    const allSimple = params.every(p => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p));
    if (!allSimple) return match;
    const typedParams = params.map(p => `${p}: any`).join(', ');
    const result = match.replace(p1, typedParams);
    modified = true;
    return result;
  });

  content = content.replace(methodRegex, (match, name, p1) => {
    if (p1.includes(':') || p1.includes('...')) return match;
    const params = p1.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (params.length === 0) return match;
    const allSimple = params.every(p => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p));
    if (!allSimple) return match;
    const typedParams = params.map(p => `${p}: any`).join(', ');
    const result = match.replace(p1, typedParams);
    modified = true;
    return result;
  });

  content = content.replace(arrowRegex, (match, p1) => {
    if (p1.includes(':') || p1.includes('...')) return match;
    const params = p1.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (params.length === 0) return match;
    const allSimple = params.every(p => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p));
    if (!allSimple) return match;
    const typedParams = params.map(p => `${p}: any`).join(', ');
    const result = match.replace(p1, typedParams);
    modified = true;
    return result;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Added any to params: ${fileName}`);
  }
}

for (const file of targetFiles) {
  addAnyToParams(file);
}

console.log('Done adding any annotations.');
