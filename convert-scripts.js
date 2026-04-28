const fs = require('fs');
const path = require('path');

const files = [
  'preflight-selfplay-training.js',
  'training-artifact-status.js',
  'clean-selfplay-artifacts.js',
  'preflight-deepcfr-training.js',
  'replay-adoption-gate.js',
  'run-foundation-bootstrap.js',
  'local-cpu-commentary-server.js',
  'deploy-lane-model-to-root.js',
  'training-resolved-config-utils.js',
  'seed-bank-manager.js',
  'serve-with-fallback.js',
  'run-hardcase-mining.js',
  'training-cycle-reporting.js',
  'benchmark-policy-quality-gate.js',
  'audit-corner-use-drift.js',
  'audit-card-use-future-delta.js',
  'export-teacher-solutions.js',
  'prepare-worker-assets.js',
  'run-selfplay-training-preset.js',
  'match-network-smoke.js',
  'audit-card-context-parity.js',
  'training-cycle-command-builders.js',
  'run-hardcase-retrain.js',
  'generate-selfplay-data-parallel.js',
  'run-selfplay-training-profile.js',
  'promote-policy-model.js',
  'run-ui-level-match.js',
  'training-warehouse-manifest-utils.js',
  'monitor-selfplay-training-run.js',
  'benchmark-policy-onnx-gate.js',
  'load-training-profile.js'
];

function convertFile(fileName) {
  const jsPath = path.join('scripts', fileName);
  const tsPath = path.join('scripts', fileName.replace(/\.js$/, '.ts'));
  const baseName = fileName.replace(/\.js$/, '');
  
  let content = fs.readFileSync(jsPath, 'utf8');
  
  // Convert require statements
  // const fs = require('fs'); -> import * as fs from 'fs';
  content = content.replace(
    /const\s+(\w+)\s+=\s+require\(['"]([^'"]+)['"]\);?/g,
    "import * as $1 from '$2';"
  );
  
  // const { spawnSync } = require('child_process'); -> import { spawnSync } from 'child_process';
  content = content.replace(
    /const\s+\{\s*([^}]+)\s*\}\s+=\s+require\(['"]([^'"]+)['"]\);?/g,
    (match, imports, modulePath) => {
      const cleaned = imports.split(',').map(s => s.trim()).filter(Boolean).join(', ');
      return `import { ${cleaned} } from '${modulePath}';`;
    }
  );
  
  // Add __non_webpack_require__ declaration and _require helper at top
  const decl = `declare const __non_webpack_require__: NodeRequire | undefined;\n\nconst _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n  ? __non_webpack_require__\n  : require;\n`;
  
  // Find position after imports to insert declaration
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIdx = i;
    }
  }
  
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, '', decl.trim());
  } else {
    lines.unshift(decl.trim());
  }
  
  content = lines.join('\n');
  
  // Convert module.exports = { ... } to export = { ... }
  content = content.replace(/module\.exports\s+=\s+\{/g, 'export = {');
  
  // Add basic type annotations for common patterns
  // function foo(argv) -> function foo(argv: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*argv\s*\)/g, 'function $1(argv: string[])');
  // function foo(args) -> function foo(args: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*args\s*\)/g, 'function $1(args: any)');
  // function foo(options) -> function foo(options: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*options\s*\)/g, 'function $1(options: any)');
  // function foo(config) -> function foo(config: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*config\s*\)/g, 'function $1(config: any)');
  // function foo(record) -> function foo(record: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*record\s*\)/g, 'function $1(record: any)');
  // function foo(filePath) -> function foo(filePath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*filePath\s*\)/g, 'function $1(filePath: string)');
  // function foo(path) -> function foo(path: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*path\s*\)/g, 'function $1(path: string)');
  // function foo(payload) -> function foo(payload: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*payload\s*\)/g, 'function $1(payload: any)');
  // function foo(entry) -> function foo(entry: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*entry\s*\)/g, 'function $1(entry: any)');
  // function foo(err) -> function foo(err: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*err\s*\)/g, 'function $1(err: any)');
  // function foo(error) -> function foo(error: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*error\s*\)/g, 'function $1(error: any)');
  // function foo(value) -> function foo(value: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*value\s*\)/g, 'function $1(value: any)');
  // function foo(state) -> function foo(state: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*state\s*\)/g, 'function $1(state: any)');
  // function foo(target) -> function foo(target: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*target\s*\)/g, 'function $1(target: any)');
  // function foo(result) -> function foo(result: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*result\s*\)/g, 'function $1(result: any)');
  // function foo(context) -> function foo(context: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*context\s*\)/g, 'function $1(context: any)');
  // function foo(data) -> function foo(data: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*data\s*\)/g, 'function $1(data: any)');
  // function foo(item) -> function foo(item: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*item\s*\)/g, 'function $1(item: any)');
  // function foo(event) -> function foo(event: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*event\s*\)/g, 'function $1(event: any)');
  // function foo(snapshot) -> function foo(snapshot: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*snapshot\s*\)/g, 'function $1(snapshot: any)');
  // function foo(stream) -> function foo(stream: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*stream\s*\)/g, 'function $1(stream: any)');
  // function foo(response) -> function foo(response: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*response\s*\)/g, 'function $1(response: any)');
  // function foo(request) -> function foo(request: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*request\s*\)/g, 'function $1(request: any)');
  // function foo(step) -> function foo(step: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*step\s*\)/g, 'function $1(step: any)');
  // function foo(gate) -> function foo(gate: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*gate\s*\)/g, 'function $1(gate: any)');
  // function foo(manifest) -> function foo(manifest: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*manifest\s*\)/g, 'function $1(manifest: any)');
  // function foo(diagnostics) -> function foo(diagnostics: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*diagnostics\s*\)/g, 'function $1(diagnostics: any)');
  // function foo(match) -> function foo(match: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*match\s*\)/g, 'function $1(match: any)');
  // function foo(task) -> function foo(task: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*task\s*\)/g, 'function $1(task: any)');
  // function foo(descriptors) -> function foo(descriptors: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*descriptors?\s*\)/g, 'function $1(descriptors: any)');
  // function foo(dependencies) -> function foo(dependencies: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*dependencies?\s*\)/g, 'function $1(dependencies: any)');
  // function foo(report) -> function foo(report: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*report\s*\)/g, 'function $1(report: any)');
  // function foo(comparison) -> function foo(comparison: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*comparison\s*\)/g, 'function $1(comparison: any)');
  // function foo(candidate) -> function foo(candidate: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*candidate\s*\)/g, 'function $1(candidate: any)');
  // function foo(audit) -> function foo(audit: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*audit\s*\)/g, 'function $1(audit: any)');
  // function foo(rec) -> function foo(rec: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*rec\s*\)/g, 'function $1(rec: any)');
  // function foo(left) -> function foo(left: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*left\s*\)/g, 'function $1(left: any)');
  // function foo(right) -> function foo(right: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*right\s*\)/g, 'function $1(right: any)');
  // function foo(raw) -> function foo(raw: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*raw\s*\)/g, 'function $1(raw: any)');
  // function foo(tag) -> function foo(tag: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*tag\s*\)/g, 'function $1(tag: string)');
  // function foo(kind) -> function foo(kind: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*kind\s*\)/g, 'function $1(kind: string)');
  // function foo(label) -> function foo(label: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*label\s*\)/g, 'function $1(label: string)');
  // function foo(text) -> function foo(text: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*text\s*\)/g, 'function $1(text: string)');
  // function foo(message) -> function foo(message: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*message\s*\)/g, 'function $1(message: string)');
  // function foo(name) -> function foo(name: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*name\s*\)/g, 'function $1(name: string)');
  // function foo(key) -> function foo(key: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*key\s*\)/g, 'function $1(key: string)');
  // function foo(flag) -> function foo(flag: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*flag\s*\)/g, 'function $1(flag: string)');
  // function foo(playerKey) -> function foo(playerKey: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*playerKey\s*\)/g, 'function $1(playerKey: string)');
  // function foo(seed) -> function foo(seed: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*seed\s*\)/g, 'function $1(seed: number)');
  // function foo(n) -> function foo(n: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*n\s*\)/g, 'function $1(n: number)');
  // function foo(i) -> function foo(i: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*i\s*\)/g, 'function $1(i: number)');
  // function foo(idx) -> function foo(idx: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*idx\s*\)/g, 'function $1(idx: number)');
  // function foo(index) -> function foo(index: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*index\s*\)/g, 'function $1(index: number)');
  // function foo(num) -> function foo(num: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*num\s*\)/g, 'function $1(num: number)');
  // function foo(size) -> function foo(size: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*size\s*\)/g, 'function $1(size: number)');
  // function foo(bytes) -> function foo(bytes: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*bytes\s*\)/g, 'function $1(bytes: number)');
  // function foo(port) -> function foo(port: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*port\s*\)/g, 'function $1(port: number)');
  // function foo(threshold) -> function foo(threshold: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*threshold\s*\)/g, 'function $1(threshold: number)');
  // function foo(code) -> function foo(code: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*code\s*\)/g, 'function $1(code: number)');
  // function foo(date) -> function foo(date: Date)
  content = content.replace(/function\s+(\w+)\s*\(\s*date\s*\)/g, 'function $1(date: Date)');
  // function foo(chunk) -> function foo(chunk: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*chunk\s*\)/g, 'function $1(chunk: any)');
  // function foo(buf) -> function foo(buf: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*buf\s*\)/g, 'function $1(buf: string)');
  // function foo(prefix) -> function foo(prefix: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*prefix\s*\)/g, 'function $1(prefix: string)');
  // function foo(dirPath) -> function foo(dirPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*dirPath\s*\)/g, 'function $1(dirPath: string)');
  // function foo(baseDir) -> function foo(baseDir: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*baseDir\s*\)/g, 'function $1(baseDir: string)');
  // function foo(basePath) -> function foo(basePath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*basePath\s*\)/g, 'function $1(basePath: string)');
  // function foo(relativePath) -> function foo(relativePath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*relativePath\s*\)/g, 'function $1(relativePath: string)');
  // function foo(resolvedPath) -> function foo(resolvedPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*resolvedPath\s*\)/g, 'function $1(resolvedPath: string)');
  // function foo(inputPath) -> function foo(inputPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*inputPath\s*\)/g, 'function $1(inputPath: string)');
  // function foo(outPath) -> function foo(outPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*outPath\s*\)/g, 'function $1(outPath: string)');
  // function foo(srcPath) -> function foo(srcPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*srcPath\s*\)/g, 'function $1(srcPath: string)');
  // function foo(dstPath) -> function foo(dstPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*dstPath\s*\)/g, 'function $1(dstPath: string)');
  // function foo(targetPath) -> function foo(targetPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*targetPath\s*\)/g, 'function $1(targetPath: string)');
  // function foo(artifactPath) -> function foo(artifactPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*artifactPath\s*\)/g, 'function $1(artifactPath: string)');
  // function foo(manifestPath) -> function foo(manifestPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*manifestPath\s*\)/g, 'function $1(manifestPath: string)');
  // function foo(summaryPath) -> function foo(summaryPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*summaryPath\s*\)/g, 'function $1(summaryPath: string)');
  // function foo(modelPath) -> function foo(modelPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*modelPath\s*\)/g, 'function $1(modelPath: string)');
  // function foo(onnxPath) -> function foo(onnxPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*onnxPath\s*\)/g, 'function $1(onnxPath: string)');
  // function foo(metaPath) -> function foo(metaPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*metaPath\s*\)/g, 'function $1(metaPath: string)');
  // function foo(rootDir) -> function foo(rootDir: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*rootDir\s*\)/g, 'function $1(rootDir: string)');
  // function foo(rootPath) -> function foo(rootPath: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*rootPath\s*\)/g, 'function $1(rootPath: string)');
  // function foo(cwd) -> function foo(cwd: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*cwd\s*\)/g, 'function $1(cwd: string)');
  // function foo(runDir) -> function foo(runDir: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*runDir\s*\)/g, 'function $1(runDir: string)');
  // function foo(runsDir) -> function foo(runsDir: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*runsDir\s*\)/g, 'function $1(runsDir: string)');
  // function foo(modelsDir) -> function foo(modelsDir: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*modelsDir\s*\)/g, 'function $1(modelsDir: string)');
  // function foo(laneDir) -> function foo(laneDir: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*laneDir\s*\)/g, 'function $1(laneDir: string)');
  // function foo(promotedDir) -> function foo(promotedDir: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*promotedDir\s*\)/g, 'function $1(promotedDir: string)');
  // function foo(archiveDir) -> function foo(archiveDir: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*archiveDir\s*\)/g, 'function $1(archiveDir: string)');
  // function foo(entrypoint) -> function foo(entrypoint: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*entrypoint\s*\)/g, 'function $1(entrypoint: string)');
  // function foo(executable) -> function foo(executable: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*executable\s*\)/g, 'function $1(executable: string)');
  // function foo(cmd) -> function foo(cmd: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*cmd\s*\)/g, 'function $1(cmd: string)');
  // function foo(stepName) -> function foo(stepName: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*stepName\s*\)/g, 'function $1(stepName: string)');
  // function foo(host) -> function foo(host: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*host\s*\)/g, 'function $1(host: string)');
  // function foo(token) -> function foo(token: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*token\s*\)/g, 'function $1(token: string)');
  // function foo(arg) -> function foo(arg: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*arg\s*\)/g, 'function $1(arg: string)');
  // function foo(a) -> function foo(a: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*a\s*\)/g, 'function $1(a: string)');
  // function foo(profile) -> function foo(profile: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*profile\s*\)/g, 'function $1(profile: string)');
  // function foo(gateType) -> function foo(gateType: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*gateType\s*\)/g, 'function $1(gateType: string)');
  // function foo(bankOrPath) -> function foo(bankOrPath: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*bankOrPath\s*\)/g, 'function $1(bankOrPath: any)');
  // function foo(bank) -> function foo(bank: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*bank\s*\)/g, 'function $1(bank: any)');
  // function foo(usage) -> function foo(usage: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*usage\s*\)/g, 'function $1(usage: any)');
  // function foo(desiredBank) -> function foo(desiredBank: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*desiredBank\s*\)/g, 'function $1(desiredBank: any)');
  // function foo(existingBank) -> function foo(existingBank: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*existingBank\s*\)/g, 'function $1(existingBank: any)');
  // function foo(resolved) -> function foo(resolved: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*resolved\s*\)/g, 'function $1(resolved: any)');
  // function foo(specified) -> function foo(specified: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*specified\s*\)/g, 'function $1(specified: any)');
  // function foo(argMap) -> function foo(argMap: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*argMap\s*\)/g, 'function $1(argMap: any)');
  // function foo(flagMap) -> function foo(flagMap: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*flagMap\s*\)/g, 'function $1(flagMap: any)');
  // function foo(settings) -> function foo(settings: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*settings\s*\)/g, 'function $1(settings: any)');
  // function foo(opts) -> function foo(opts: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*opts\s*\)/g, 'function $1(opts: any)');
  // function foo(params) -> function foo(params: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*params\s*\)/g, 'function $1(params: any)');
  // function foo(props) -> function foo(props: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*props\s*\)/g, 'function $1(props: any)');
  // function foo(details) -> function foo(details: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*details?\s*\)/g, 'function $1(details: any)');
  // function foo(plan) -> function foo(plan: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*plan\s*\)/g, 'function $1(plan: any)');
  // function foo(plans) -> function foo(plans: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*plans\s*\)/g, 'function $1(plans: any[])');
  // function foo(actionCounterRef) -> function foo(actionCounterRef: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*actionCounterRef\s*\)/g, 'function $1(actionCounterRef: any)');
  // function foo(execution) -> function foo(execution: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*execution\s*\)/g, 'function $1(execution: any)');
  // function foo(decision) -> function foo(decision: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*decision\s*\)/g, 'function $1(decision: any)');
  // function foo(selectionTrace) -> function foo(selectionTrace: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*selectionTrace\s*\)/g, 'function $1(selectionTrace: any)');
  // function foo(liveContext) -> function foo(liveContext: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*liveContext\s*\)/g, 'function $1(liveContext: any)');
  // function foo(selfplayContext) -> function foo(selfplayContext: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*selfplayContext\s*\)/g, 'function $1(selfplayContext: any)');
  // function foo(fieldNames) -> function foo(fieldNames: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*fieldNames?\s*\)/g, 'function $1(fieldNames: string[])');
  // function foo(cardTypeById) -> function foo(cardTypeById: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*cardTypeById\s*\)/g, 'function $1(cardTypeById: any)');
  // function foo(cardType) -> function foo(cardType: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*cardType\s*\)/g, 'function $1(cardType: string)');
  // function foo(filterTypes) -> function foo(filterTypes: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*filterTypes?\s*\)/g, 'function $1(filterTypes: string[])');
  // function foo(types) -> function foo(types: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*types\s*\)/g, 'function $1(types: string[])');
  // function foo(type) -> function foo(type: string)
  content = content.replace(/function\s+(\w+)\s*\(\s*type\s*\)/g, 'function $1(type: string)');
  // function foo(gameIndex) -> function foo(gameIndex: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*gameIndex\s*\)/g, 'function $1(gameIndex: number)');
  // function foo(ply) -> function foo(ply: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*ply\s*\)/g, 'function $1(ply: number)');
  // function foo(turnNumber) -> function foo(turnNumber: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*turnNumber\s*\)/g, 'function $1(turnNumber: number)');
  // function foo(row) -> function foo(row: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*row\s*\)/g, 'function $1(row: number)');
  // function foo(col) -> function foo(col: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*col\s*\)/g, 'function $1(col: number)');
  // function foo(maxChars) -> function foo(maxChars: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*maxChars\s*\)/g, 'function $1(maxChars: number)');
  // function foo(maxLines) -> function foo(maxLines: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*maxLines?\s*\)/g, 'function $1(maxLines: number)');
  // function foo(maxBytes) -> function foo(maxBytes: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*maxBytes\s*\)/g, 'function $1(maxBytes: number)');
  // function foo(maxLength) -> function foo(maxLength: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*maxLength\s*\)/g, 'function $1(maxLength: number)');
  // function foo(limit) -> function foo(limit: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*limit\s*\)/g, 'function $1(limit: number)');
  // function foo(timeoutMs) -> function foo(timeoutMs: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*timeoutMs\s*\)/g, 'function $1(timeoutMs: number)');
  // function foo(intervalMs) -> function foo(intervalMs: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*intervalMs\s*\)/g, 'function $1(intervalMs: number)');
  // function foo(elapsedMs) -> function foo(elapsedMs: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*elapsedMs\s*\)/g, 'function $1(elapsedMs: number)');
  // function foo(startedAt) -> function foo(startedAt: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*startedAt\s*\)/g, 'function $1(startedAt: number)');
  // function foo(nowMs) -> function foo(nowMs: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*nowMs\s*\)/g, 'function $1(nowMs: number)');
  // function foo(minAgeMs) -> function foo(minAgeMs: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*minAgeMs\s*\)/g, 'function $1(minAgeMs: number)');
  // function foo(ageFloorMs) -> function foo(ageFloorMs: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*ageFloorMs\s*\)/g, 'function $1(ageFloorMs: number)');
  // function foo(baselineNowMs) -> function foo(baselineNowMs: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*baselineNowMs\s*\)/g, 'function $1(baselineNowMs: number)');
  // function foo(spawnTimeoutMs) -> function foo(spawnTimeoutMs: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*spawnTimeoutMs\s*\)/g, 'function $1(spawnTimeoutMs: number)');
  // function foo(shard) -> function foo(shard: any)
  content = content.replace(/function\s+(\w+)\s*\(\s*shard\s*\)/g, 'function $1(shard: any)');
  // function foo(shardSpecs) -> function foo(shardSpecs: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*shardSpecs?\s*\)/g, 'function $1(shardSpecs: any[])');
  // function foo(parts) -> function foo(parts: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*parts\s*\)/g, 'function $1(parts: any[])');
  // function foo(chunks) -> function foo(chunks: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*chunks?\s*\)/g, 'function $1(chunks: any[])');
  // function foo(games) -> function foo(games: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*games\s*\)/g, 'function $1(games: number)');
  // function foo(workers) -> function foo(workers: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*workers\s*\)/g, 'function $1(workers: number)');
  // function foo(totalGames) -> function foo(totalGames: number)
  content = content.replace(/function\s+(\w+)\s*\(\s*totalGames\s*\)/g, 'function $1(totalGames: number)');
  // function foo(perSeed) -> function foo(perSeed: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*perSeed\s*\)/g, 'function $1(perSeed: any[])');
  // function foo(seeds) -> function foo(seeds: number[])
  content = content.replace(/function\s+(\w+)\s*\(\s*seeds\s*\)/g, 'function $1(seeds: number[])');
  // function foo(scores) -> function foo(scores: number[])
  content = content.replace(/function\s+(\w+)\s*\(\s*scores?\s*\)/g, 'function $1(scores: number[])');
  // function foo(values) -> function foo(values: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*values?\s*\)/g, 'function $1(values: any[])');
  // function foo(entries) -> function foo(entries: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*entries\s*\)/g, 'function $1(entries: any[])');
  // function foo(issues) -> function foo(issues: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*issues\s*\)/g, 'function $1(issues: string[])');
  // function foo(lines) -> function foo(lines: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*lines\s*\)/g, 'function $1(lines: string[])');
  // function foo(words) -> function foo(words: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*words?\s*\)/g, 'function $1(words: string[])');
  // function foo(array) -> function foo(array: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*array\s*\)/g, 'function $1(array: any[])');
  // function foo(list) -> function foo(list: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*list\s*\)/g, 'function $1(list: any[])');
  // function foo(items) -> function foo(items: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*items?\s*\)/g, 'function $1(items: any[])');
  // function foo(elements) -> function foo(elements: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*elements?\s*\)/g, 'function $1(elements: any[])');
  // function foo(columns) -> function foo(columns: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*columns?\s*\)/g, 'function $1(columns: any[])');
  // function foo(rows) -> function foo(rows: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*rows?\s*\)/g, 'function $1(rows: any[])');
  // function foo(cells) -> function foo(cells: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*cells?\s*\)/g, 'function $1(cells: any[])');
  // function foo(stones) -> function foo(stones: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*stones?\s*\)/g, 'function $1(stones: any[])');
  // function foo(moves) -> function foo(moves: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*moves?\s*\)/g, 'function $1(moves: any[])');
  // function foo(actions) -> function foo(actions: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*actions?\s*\)/g, 'function $1(actions: any[])');
  // function foo(candidates) -> function foo(candidates: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*candidates?\s*\)/g, 'function $1(candidates: any[])');
  // function foo(ids) -> function foo(ids: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*ids\s*\)/g, 'function $1(ids: string[])');
  // function foo(paths) -> function foo(paths: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*paths?\s*\)/g, 'function $1(paths: string[])');
  // function foo(files) -> function foo(files: string[])
  content = content.replace(/function\s+(\w+)\s*\(\s*files?\s*\)/g, 'function $1(files: string[])');
  // function foo(artifacts) -> function foo(artifacts: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*artifacts?\s*\)/g, 'function $1(artifacts: any[])');
  // function foo(variants) -> function foo(variants: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*variants?\s*\)/g, 'function $1(variants: any[])');
  // function foo(targets) -> function foo(targets: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*targets?\s*\)/g, 'function $1(targets: any[])');
  // function foo(goals) -> function foo(goals: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*goals?\s*\)/g, 'function $1(goals: any[])');
  // function foo(objectives) -> function foo(objectives: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*objectives?\s*\)/g, 'function $1(objectives: any[])');
  // function foo(outcomes) -> function foo(outcomes: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*outcomes?\s*\)/g, 'function $1(outcomes: any[])');
  // function foo(consequences) -> function foo(consequences: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*consequences?\s*\)/g, 'function $1(consequences: any[])');
  // function foo(implications) -> function foo(implications: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*implications?\s*\)/g, 'function $1(implications: any[])');
  // function foo(ramifications) -> function foo(ramifications: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*ramifications?\s*\)/g, 'function $1(ramifications: any[])');
  // function foo(aftereffects) -> function foo(aftereffects: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*aftereffects?\s*\)/g, 'function $1(aftereffects: any[])');
  // function foo(sideEffects) -> function foo(sideEffects: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*sideEffects?\s*\)/g, 'function $1(sideEffects: any[])');
  // function foo(fallouts) -> function foo(fallouts: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*fallouts?\s*\)/g, 'function $1(fallouts: any[])');
  // function foo(repercussions) -> function foo(repercussions: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*repercussions?\s*\)/g, 'function $1(repercussions: any[])');
  // function foo(sequelae) -> function foo(sequelae: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*sequelae?\s*\)/g, 'function $1(sequelae: any[])');
  // function foo(spinoffs) -> function foo(spinoffs: any[])
  content = content.replace(/function\s+(\w+)\s*\(\s*spinoffs?\s*\)/g, 'function $1(spinoffs: any[])');
  
  fs.writeFileSync(tsPath, content, 'utf8');
  
  // Replace .js with wrapper
  const wrapper = `"use strict";\n/** @type {any} */\nmodule.exports = require('../dist/scripts/${baseName}');\n`;
  fs.writeFileSync(jsPath, wrapper, 'utf8');
  
  console.log(`Converted: ${fileName}`);
}

for (const file of files) {
  convertFile(file);
}

console.log('Done converting all files.');
