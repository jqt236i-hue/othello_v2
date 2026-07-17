import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PIXI_VERSION = '8.18.1';
const PIXI_SOURCE_RELATIVE_PATH = 'node_modules/pixi.js/dist/pixi.min.js';
const PIXI_UNSAFE_EVAL_SOURCE_RELATIVE_PATH = 'node_modules/pixi.js/dist/packages/unsafe-eval.min.js';
const PIXI_PACKAGE_RELATIVE_PATH = 'node_modules/pixi.js/package.json';
const PIXI_OUTPUT_RELATIVE_PATH = `public/vendor/pixi-${PIXI_VERSION}.min.js`;
const PIXI_UNSAFE_EVAL_OUTPUT_RELATIVE_PATH = `public/vendor/pixi-unsafe-eval-${PIXI_VERSION}.min.js`;
const PIXI_SOURCE_SHA256 = 'abeeec74acab20e84c74d05d89e13965b9f3152ca958864cf49e5de5de6dd516';
const PIXI_UNSAFE_EVAL_SOURCE_SHA256 = '4bbae0dceca43ad8f2e456ee37d39f87f5afd71c5287e4abc2bc558cd373edd8';
const PIXI_BANNER = `PixiJS - v${PIXI_VERSION}`;

interface PreparePixiClassicAssetsOptions {
  rootDir?: string;
  write?: boolean;
}

interface PreparedPixiClassicAsset {
  sourcePath: string;
  outputPath: string;
  sha256: string;
  bytes: number;
  wroteFile: boolean;
}

interface PreparePixiClassicAssetsResult extends PreparedPixiClassicAsset {
  version: string;
  runtime: PreparedPixiClassicAsset;
  unsafeEval: PreparedPixiClassicAsset;
}

interface PixiClassicAssetDefinition {
  label: string;
  sourceRelativePath: string;
  outputRelativePath: string;
  sourceSha256: string;
}

interface InspectedPixiClassicAsset extends Omit<PreparedPixiClassicAsset, 'outputPath' | 'wroteFile'> {
  content: Buffer;
}

const PIXI_CLASSIC_ASSET = Object.freeze<PixiClassicAssetDefinition>({
  label: 'classic',
  sourceRelativePath: PIXI_SOURCE_RELATIVE_PATH,
  outputRelativePath: PIXI_OUTPUT_RELATIVE_PATH,
  sourceSha256: PIXI_SOURCE_SHA256
});

const PIXI_UNSAFE_EVAL_CLASSIC_ASSET = Object.freeze<PixiClassicAssetDefinition>({
  label: 'classic unsafe-eval replacement',
  sourceRelativePath: PIXI_UNSAFE_EVAL_SOURCE_RELATIVE_PATH,
  outputRelativePath: PIXI_UNSAFE_EVAL_OUTPUT_RELATIVE_PATH,
  sourceSha256: PIXI_UNSAFE_EVAL_SOURCE_SHA256
});

function sha256(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readJson(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`PixiJS package metadata is unavailable: ${filePath}: ${error instanceof Error ? error.message : error}`);
  }
}

function inspectPixiClassicAssetSource(
  rootDir: string,
  definition: PixiClassicAssetDefinition
): InspectedPixiClassicAsset {
  const sourcePath = path.join(rootDir, definition.sourceRelativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`PixiJS ${definition.label} source is unavailable: ${sourcePath}`);
  }
  const content = fs.readFileSync(sourcePath);
  if (content.length < 1024) {
    throw new Error(`PixiJS ${definition.label} source is unexpectedly small: ${content.length} bytes`);
  }
  const header = content.subarray(0, Math.min(content.length, 4096)).toString('utf8');
  if (!header.includes(PIXI_BANNER)) {
    throw new Error(`PixiJS ${definition.label} source banner mismatch: expected ${PIXI_BANNER}`);
  }
  const digest = sha256(content);
  if (digest !== definition.sourceSha256) {
    throw new Error(`PixiJS ${definition.label} source hash mismatch: expected ${definition.sourceSha256}, received ${digest}`);
  }
  return {
    sourcePath,
    sha256: digest,
    bytes: content.length,
    content
  };
}

function inspectPixiPackageVersion(rootDir: string): string {
  const packagePath = path.join(rootDir, PIXI_PACKAGE_RELATIVE_PATH);
  const packageMetadata = readJson(packagePath);
  const version = String(packageMetadata && packageMetadata.version || '').trim();
  if (version !== PIXI_VERSION) {
    throw new Error(`PixiJS package version mismatch: expected ${PIXI_VERSION}, received ${version || 'missing'}`);
  }
  return version;
}

function inspectPixiClassicSource(rootDir: string): InspectedPixiClassicAsset & { version: string } {
  const version = inspectPixiPackageVersion(rootDir);
  return { version, ...inspectPixiClassicAssetSource(rootDir, PIXI_CLASSIC_ASSET) };
}

function inspectPixiUnsafeEvalSource(rootDir: string): InspectedPixiClassicAsset & { version: string } {
  const version = inspectPixiPackageVersion(rootDir);
  return { version, ...inspectPixiClassicAssetSource(rootDir, PIXI_UNSAFE_EVAL_CLASSIC_ASSET) };
}

function writePreparedAsset(
  rootDir: string,
  definition: PixiClassicAssetDefinition,
  inspected: InspectedPixiClassicAsset,
  write: boolean
): PreparedPixiClassicAsset {
  const outputPath = path.join(rootDir, definition.outputRelativePath);
  let wroteFile = false;
  if (write) {
    const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null;
    if (!existing || !existing.equals(inspected.content)) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, inspected.content);
      wroteFile = true;
    }
  }
  return {
    sourcePath: inspected.sourcePath,
    outputPath,
    sha256: inspected.sha256,
    bytes: inspected.bytes,
    wroteFile
  };
}

function preparePixiClassicAssets(options: PreparePixiClassicAssetsOptions = {}): PreparePixiClassicAssetsResult {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const version = inspectPixiPackageVersion(rootDir);
  // Inspect every pinned input before writing either output so a broken package
  // cannot leave a partially refreshed classic runtime pair behind.
  const inspected = inspectPixiClassicAssetSource(rootDir, PIXI_CLASSIC_ASSET);
  const inspectedUnsafeEval = inspectPixiClassicAssetSource(rootDir, PIXI_UNSAFE_EVAL_CLASSIC_ASSET);
  const write = options.write !== false;
  const prepared = writePreparedAsset(rootDir, PIXI_CLASSIC_ASSET, inspected, write);
  const unsafeEval = writePreparedAsset(rootDir, PIXI_UNSAFE_EVAL_CLASSIC_ASSET, inspectedUnsafeEval, write);
  return {
    version,
    ...prepared,
    wroteFile: prepared.wroteFile || unsafeEval.wroteFile,
    runtime: prepared,
    unsafeEval
  };
}

if (require.main === module) {
  try {
    const result = preparePixiClassicAssets();
    console.log(`[pixi-classic-assets] ${result.runtime.wroteFile ? 'wrote' : 'verified'} ${result.outputPath} version=${result.version} sha256=${result.sha256}`);
    console.log(`[pixi-classic-assets] ${result.unsafeEval.wroteFile ? 'wrote' : 'verified'} ${result.unsafeEval.outputPath} version=${result.version} sha256=${result.unsafeEval.sha256}`);
  } catch (error) {
    console.error(`[pixi-classic-assets] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export = {
  PIXI_BANNER,
  PIXI_OUTPUT_RELATIVE_PATH,
  PIXI_PACKAGE_RELATIVE_PATH,
  PIXI_SOURCE_RELATIVE_PATH,
  PIXI_SOURCE_SHA256,
  PIXI_UNSAFE_EVAL_OUTPUT_RELATIVE_PATH,
  PIXI_UNSAFE_EVAL_SOURCE_RELATIVE_PATH,
  PIXI_UNSAFE_EVAL_SOURCE_SHA256,
  PIXI_VERSION,
  inspectPixiClassicSource,
  inspectPixiUnsafeEvalSource,
  preparePixiClassicAssets
};
