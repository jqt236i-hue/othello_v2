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
  'MatchAuthorityBufferedSseReplayEvent'
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
  'CpuPolicyCardDefinitionResolver'
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
if (!/const\s+cpuPolicyCoreApi\s*:\s*CpuPolicyCoreApi\s*=/.test(cpuPolicySource)) {
  findings.push({
    file: 'game/ai/cpu-policy-core.ts',
    message: 'CPU policy core module.exports must be routed through CpuPolicyCoreApi'
  });
}
if (!/module\.exports\s*=\s*cpuPolicyCoreApi\s*;/.test(cpuPolicySource)) {
  findings.push({
    file: 'game/ai/cpu-policy-core.ts',
    message: 'CPU policy core must export the typed API object directly'
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
