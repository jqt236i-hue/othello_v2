const fs = require('fs');
const path = require('path');

// List of the 31 converted files
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

function hasExportEquals(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return /export\s*=\s*\{/.test(content);
}

function fixImports(fileName) {
  const filePath = path.join('scripts', fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Match import statements from local modules - capture everything between import and from
  const importRegex = /import\s+(.+?)\s+from\s+['"](\.\/[^'"]+)['"];/g;
  
  const replacements = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const importClause = match[1].trim();
    const modulePath = match[2];
    
    // Resolve the module path
    let resolvedPath = path.join('scripts', modulePath);
    if (!resolvedPath.endsWith('.ts')) {
      resolvedPath += '.ts';
    }
    
    if (!fs.existsSync(resolvedPath)) {
      continue;
    }
    
    if (!hasExportEquals(resolvedPath)) {
      continue;
    }
    
    // Skip if already namespace import
    if (importClause.startsWith('* as ')) {
      continue;
    }
    
    // Generate a safe variable name
    const baseName = path.basename(modulePath).replace(/[-.]/g, '_');
    const varName = '_' + baseName;
    
    let newImport;
    
    if (importClause.startsWith('{') && importClause.endsWith('}')) {
      // Named imports: import { a, b } from './module'
      const inner = importClause.slice(1, -1).trim();
      newImport = `import * as ${varName} from '${modulePath}';\nconst { ${inner} } = ${varName};`;
    } else {
      // Default or other import: import x from './module'
      newImport = `import * as ${importClause} from '${modulePath}';`;
    }
    
    replacements.push({ old: fullMatch, new: newImport });
  }
  
  // Apply replacements
  for (const { old, new: newStr } of replacements) {
    content = content.replace(old, newStr);
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed imports: ${fileName}`);
  }
}

for (const file of targetFiles) {
  fixImports(file);
}

console.log('Done fixing imports.');
