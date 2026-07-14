import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PIXI_VERSION = '8.18.1';
const PIXI_SOURCE_RELATIVE_PATH = 'node_modules/pixi.js/dist/pixi.min.js';
const PIXI_PACKAGE_RELATIVE_PATH = 'node_modules/pixi.js/package.json';
const PIXI_OUTPUT_RELATIVE_PATH = `public/vendor/pixi-${PIXI_VERSION}.min.js`;
const PIXI_SOURCE_SHA256 = 'abeeec74acab20e84c74d05d89e13965b9f3152ca958864cf49e5de5de6dd516';
const PIXI_BANNER = `PixiJS - v${PIXI_VERSION}`;

interface PreparePixiClassicAssetsOptions {
  rootDir?: string;
  write?: boolean;
}

interface PreparePixiClassicAssetsResult {
  version: string;
  sourcePath: string;
  outputPath: string;
  sha256: string;
  bytes: number;
  wroteFile: boolean;
}

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

function inspectPixiClassicSource(rootDir: string): Omit<PreparePixiClassicAssetsResult, 'outputPath' | 'wroteFile'> & { content: Buffer } {
  const packagePath = path.join(rootDir, PIXI_PACKAGE_RELATIVE_PATH);
  const sourcePath = path.join(rootDir, PIXI_SOURCE_RELATIVE_PATH);
  const packageMetadata = readJson(packagePath);
  const version = String(packageMetadata && packageMetadata.version || '').trim();
  if (version !== PIXI_VERSION) {
    throw new Error(`PixiJS package version mismatch: expected ${PIXI_VERSION}, received ${version || 'missing'}`);
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`PixiJS classic source is unavailable: ${sourcePath}`);
  }
  const content = fs.readFileSync(sourcePath);
  if (content.length < 1024) {
    throw new Error(`PixiJS classic source is unexpectedly small: ${content.length} bytes`);
  }
  const header = content.subarray(0, Math.min(content.length, 4096)).toString('utf8');
  if (!header.includes(PIXI_BANNER)) {
    throw new Error(`PixiJS classic source banner mismatch: expected ${PIXI_BANNER}`);
  }
  const digest = sha256(content);
  if (digest !== PIXI_SOURCE_SHA256) {
    throw new Error(`PixiJS classic source hash mismatch: expected ${PIXI_SOURCE_SHA256}, received ${digest}`);
  }
  return {
    version,
    sourcePath,
    sha256: digest,
    bytes: content.length,
    content
  };
}

function preparePixiClassicAssets(options: PreparePixiClassicAssetsOptions = {}): PreparePixiClassicAssetsResult {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const inspected = inspectPixiClassicSource(rootDir);
  const outputPath = path.join(rootDir, PIXI_OUTPUT_RELATIVE_PATH);
  let wroteFile = false;
  if (options.write !== false) {
    const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null;
    if (!existing || !existing.equals(inspected.content)) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, inspected.content);
      wroteFile = true;
    }
  }
  return {
    version: inspected.version,
    sourcePath: inspected.sourcePath,
    outputPath,
    sha256: inspected.sha256,
    bytes: inspected.bytes,
    wroteFile
  };
}

if (require.main === module) {
  try {
    const result = preparePixiClassicAssets();
    console.log(`[pixi-classic-assets] ${result.wroteFile ? 'wrote' : 'verified'} ${result.outputPath} version=${result.version} sha256=${result.sha256}`);
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
  PIXI_VERSION,
  inspectPixiClassicSource,
  preparePixiClassicAssets
};
