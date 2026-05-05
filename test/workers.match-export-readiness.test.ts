import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const wranglerConfigPath = path.resolve(__dirname, '../wrangler.toml');
const RESULT_MARKER = '__WORKER_EXPORT_READINESS_RESULT__';

type WorkerExportInspection = {
  exportNames: string[];
  defaultType: string;
  defaultHasFetch: boolean;
  durableObjectType: string;
  durableObjectName: string | null;
};

function inspectWorkerExports(): WorkerExportInspection {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const workerModule = await import(modulePath);",
    "  const worker = workerModule.default;",
    "  const DurableObjectClass = workerModule.MatchRoomDurableObject;",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    exportNames: Object.keys(workerModule).sort(),",
    "    defaultType: typeof worker,",
    "    defaultHasFetch: !!(worker && typeof worker.fetch === 'function'),",
    "    durableObjectType: typeof DurableObjectClass,",
    "    durableObjectName: DurableObjectClass && DurableObjectClass.name ? DurableObjectClass.name : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker export readiness runner failed');
  }

  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'worker export readiness runner did not emit result marker');
  }

  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

function readWranglerDurableObjectClassNames(): string[] {
  const wranglerConfig = fs.readFileSync(wranglerConfigPath, 'utf8');
  return Array.from(wranglerConfig.matchAll(/class_name\s*=\s*"([^"]+)"/g), (match) => match[1]);
}

function findMissingDurableObjectExports(exportNames: string[], durableObjectClassNames: string[]): string[] {
  const exported = new Set(exportNames);
  return durableObjectClassNames.filter((className) => !exported.has(className));
}

describe('match worker export readiness', () => {
  test('exports the Worker default and wrangler Durable Object class', () => {
    const inspectedExports = inspectWorkerExports();
    const durableObjectClassNames = readWranglerDurableObjectClassNames();

    expect(inspectedExports.exportNames).toContain('default');
    expect(inspectedExports.defaultType).toBe('object');
    expect(inspectedExports.defaultHasFetch).toBe(true);

    expect(inspectedExports.exportNames).toContain('MatchRoomDurableObject');
    expect(inspectedExports.durableObjectType).toBe('function');
    expect(inspectedExports.durableObjectName).toBe('MatchRoomDurableObject');

    expect(durableObjectClassNames).toContain('MatchRoomDurableObject');
    expect(findMissingDurableObjectExports(inspectedExports.exportNames, durableObjectClassNames)).toEqual([]);
  });

  test('local export check reports a wrangler Durable Object class missing from module exports', () => {
    expect(findMissingDurableObjectExports(['default'], ['MatchRoomDurableObject'])).toEqual([
      'MatchRoomDurableObject'
    ]);
  });
});
