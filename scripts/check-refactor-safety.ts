import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..', '..');

type Finding = { file: string; message: string };

const boundaryTargets = [
  'utils/match-authority.ts',
  'workers/match-worker.ts',
  'game/logic/cards.ts',
  'game/turn/turn_pipeline_phases.ts',
  'game/turn/pipeline_ui_adapter.ts',
  'game/ai/cpu-policy-core.ts'
];

const existingNoCheckDebt = new Set([
  'utils/match-authority.ts',
  'workers/match-worker.ts',
  'game/ai/cpu-policy-core.ts'
]);

const requiredAuthorityContractTypes = [
  'MatchAuthorityPublishMeta',
  'MatchAuthorityRoomPayload',
  'MatchAuthorityPublishResponsePayload',
  'MatchAuthorityBufferedSseEventRecord',
  'MatchAuthorityBufferedSseReplayEvent',
  'MatchAuthorityPublicApi'
];

const requiredAuthorityTypedFunctions = [
  'normalizePublishMeta',
  'buildPublishResponsePayload',
  'buildRoomPayload',
  'createBufferedSseEventRecord',
  'appendBufferedSseEvent',
  'getBufferedSseReplayEvents'
];

const requiredCpuPolicyContractTypes = [
  'CpuPolicyCoreApi',
  'CpuPolicyMove',
  'CpuPolicyCardDefinition',
  'CpuPolicyCardCostResolver',
  'CpuPolicyCardDefinitionResolver',
  'CpuPolicyRandomSource'
];

const requiredMatchWorkerContractTypes = [
  'MatchWorkerEnv',
  'DurableObjectNamespaceLike',
  'DurableObjectStateLike',
  'MatchWorkerEntrypoint',
  'MatchRoomDurableObjectApi',
  'MatchRoomDurableObjectConstructor'
];

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function hasNoCheck(source: string): boolean {
  return /@ts-nocheck\b/.test(source);
}

const findings: Finding[] = [];

for (const file of boundaryTargets) {
  const source = readSource(file);
  if (hasNoCheck(source) && !existingNoCheckDebt.has(file)) {
    findings.push({
      file,
      message: 'new @ts-nocheck is forbidden in high-risk runtime boundary targets'
    });
  }
}

const authorityTypesPath = 'utils/match-authority-types.ts';
const authorityTypes = readSource(authorityTypesPath);
for (const typeName of requiredAuthorityContractTypes) {
  if (!new RegExp(`export\\s+interface\\s+${typeName}\\b|export\\s+type\\s+${typeName}\\b`).test(authorityTypes)) {
    findings.push({
      file: authorityTypesPath,
      message: `missing exported authority contract type ${typeName}`
    });
  }
}

const authoritySource = readSource('utils/match-authority.ts');
if (!/from\s+['"]\.\/match-authority-types['"]/.test(authoritySource)) {
  findings.push({
    file: 'utils/match-authority.ts',
    message: 'match authority must import its public boundary contract types'
  });
}
if (!/from\s+['"]\.\/match-authority-contract['"]/.test(authoritySource)) {
  findings.push({
    file: 'utils/match-authority.ts',
    message: 'match authority must import checked public API contract assertions'
  });
}
if (!/const\s+matchAuthority\s*=\s*assertMatchAuthorityPublicApi\s*\(/.test(authoritySource)) {
  findings.push({
    file: 'utils/match-authority.ts',
    message: 'match authority export must be validated by assertMatchAuthorityPublicApi'
  });
}
for (const functionName of requiredAuthorityTypedFunctions) {
  const signaturePattern = new RegExp(`function\\s+${functionName}\\s*\\([^)]*:\\s*[^)]*\\)\\s*:\\s*`);
  if (!signaturePattern.test(authoritySource)) {
    findings.push({
      file: 'utils/match-authority.ts',
      message: `public boundary function ${functionName} must keep typed parameters and return type`
    });
  }
}

const cpuPolicyTypesPath = 'game/ai/cpu-policy-core-types.ts';
const cpuPolicyTypes = readSource(cpuPolicyTypesPath);
for (const typeName of requiredCpuPolicyContractTypes) {
  if (!new RegExp(`export\\s+interface\\s+${typeName}\\b|export\\s+type\\s+${typeName}\\b`).test(cpuPolicyTypes)) {
    findings.push({
      file: cpuPolicyTypesPath,
      message: `missing exported CPU policy contract type ${typeName}`
    });
  }
}

const cpuPolicySource = readSource('game/ai/cpu-policy-core.ts');
if (!/from\s+['"]\.\/cpu-policy-core-types['"]/.test(cpuPolicySource)) {
  findings.push({
    file: 'game/ai/cpu-policy-core.ts',
    message: 'CPU policy core must import its public API contract types'
  });
}
if (!/from\s+['"]\.\/cpu-policy-core-api['"]/.test(cpuPolicySource)) {
  findings.push({
    file: 'game/ai/cpu-policy-core.ts',
    message: 'CPU policy core must route its public API through the checked adapter'
  });
}
if (!/const\s+cpuPolicyCoreApi\s*:\s*CpuPolicyCoreApi\s*=\s*createCpuPolicyCoreApi\s*\(/.test(cpuPolicySource)) {
  findings.push({
    file: 'game/ai/cpu-policy-core.ts',
    message: 'CPU policy core module.exports must be validated by createCpuPolicyCoreApi'
  });
}
if (!/module\.exports\s*=\s*cpuPolicyCoreApi\s*;/.test(cpuPolicySource)) {
  findings.push({
    file: 'game/ai/cpu-policy-core.ts',
    message: 'CPU policy core must export the typed API object directly'
  });
}

const matchWorkerTypesPath = 'workers/match-worker-types.ts';
const matchWorkerTypes = readSource(matchWorkerTypesPath);
for (const typeName of requiredMatchWorkerContractTypes) {
  if (!new RegExp(`export\\s+interface\\s+${typeName}\\b|export\\s+type\\s+${typeName}\\b`).test(matchWorkerTypes)) {
    findings.push({
      file: matchWorkerTypesPath,
      message: `missing exported match Worker contract type ${typeName}`
    });
  }
}

const matchWorkerSource = readSource('workers/match-worker.ts');
if (!/from\s+['"]\.\/match-worker-types['"]/.test(matchWorkerSource)) {
  findings.push({
    file: 'workers/match-worker.ts',
    message: 'match Worker must import its public runtime contract types'
  });
}
if (!/from\s+['"]\.\/match-worker-contract['"]/.test(matchWorkerSource)) {
  findings.push({
    file: 'workers/match-worker.ts',
    message: 'match Worker must import checked public runtime contract assertions'
  });
}
if (!/export\s+class\s+MatchRoomDurableObject\s+implements\s+MatchRoomDurableObjectApi/.test(matchWorkerSource)) {
  findings.push({
    file: 'workers/match-worker.ts',
    message: 'MatchRoomDurableObject must declare the public Durable Object API contract'
  });
}
if (!/assertMatchRoomDurableObjectConstructor\s*\(\s*MatchRoomDurableObject\s*\)/.test(matchWorkerSource)) {
  findings.push({
    file: 'workers/match-worker.ts',
    message: 'MatchRoomDurableObject constructor must be validated outside @ts-nocheck'
  });
}
if (!/const\s+matchWorkerEntrypoint\s*:\s*MatchWorkerEntrypoint\s*=\s*assertMatchWorkerEntrypoint\s*\(/.test(matchWorkerSource)) {
  findings.push({
    file: 'workers/match-worker.ts',
    message: 'default Worker export must be validated by assertMatchWorkerEntrypoint'
  });
}
if (!/export\s+default\s+matchWorkerEntrypoint\s*;/.test(matchWorkerSource)) {
  findings.push({
    file: 'workers/match-worker.ts',
    message: 'match Worker must export the typed entrypoint directly'
  });
}

if (findings.length > 0) {
  console.error('[refactor-safety] Boundary safety check failed:');
  for (const finding of findings) {
    console.error(` - ${finding.file}: ${finding.message}`);
  }
  process.exit(2);
}

console.log('[refactor-safety] Runtime boundary type safety checks passed.');
process.exit(0);
