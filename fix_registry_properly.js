const fs = require('fs');

// Read the function definition from dist
const distContent = fs.readFileSync('dist/game/turn/pipeline_ui_adapter.js', 'utf8');
const funcMatch = distContent.match(/function isInheritedHyperactiveType\(special\) \{[\s\S]*?\n\}/);
if (!funcMatch) {
  console.error('Function not found in dist file');
  process.exit(1);
}
const functionDef = funcMatch[0];
console.log('Found function definition:', functionDef.substring(0, 100) + '...');

// Read module-registry.js
const registryPath = 'public/module-registry.js';
let registryContent = fs.readFileSync(registryPath, 'utf8');

// Find the pipeline_ui_adapter section
const marker = '_r("game/turn/pipeline_ui_adapter", "';
const idx = registryContent.indexOf(marker);
if (idx === -1) {
  console.error('pipeline_ui_adapter section not found');
  process.exit(1);
}

// Find the position after the opening quote
const startIdx = idx + marker.length;

// Find "function resolveDisplayTimerValue" within the pipeline_ui_adapter section
const searchStart = registryContent.indexOf('function resolveDisplayTimerValue', startIdx);
if (searchStart === -1) {
  console.error('resolveDisplayTimerValue not found in pipeline_ui_adapter section');
  process.exit(1);
}

// Insert the function definition before resolveDisplayTimerValue
const before = registryContent.substring(0, searchStart);
const after = registryContent.substring(searchStart);
const newContent = before + functionDef + '\\n' + after;

fs.writeFileSync(registryPath, newContent);
console.log('Successfully added isInheritedHyperactiveType to', registryPath);

// Also update worker-public copy
const workerRegistryPath = 'worker-public/public/module-registry.js';
if (fs.existsSync(workerRegistryPath)) {
  let workerContent = fs.readFileSync(workerRegistryPath, 'utf8');
  const workerIdx = workerContent.indexOf(marker);
  if (workerIdx !== -1) {
    const workerStartIdx = workerIdx + marker.length;
    const workerSearchStart = workerContent.indexOf('function resolveDisplayTimerValue', workerStartIdx);
    if (workerSearchStart !== -1) {
      const workerBefore = workerContent.substring(0, workerSearchStart);
      const workerAfter = workerContent.substring(workerSearchStart);
      const workerNewContent = workerBefore + functionDef + '\\n' + workerAfter;
      fs.writeFileSync(workerRegistryPath, workerNewContent);
      console.log('Successfully added isInheritedHyperactiveType to', workerRegistryPath);
    }
  }
}
