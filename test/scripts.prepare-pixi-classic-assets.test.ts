import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PixiClassicAssets = require('../scripts/prepare-pixi-classic-assets');

describe('prepare-pixi-classic-assets', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    while (cleanup.length) fs.rmSync(cleanup.pop()!, { recursive: true, force: true });
  });

  function createFixture(version = PixiClassicAssets.PIXI_VERSION, includeSource = true): string {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixi-classic-assets-'));
    cleanup.push(rootDir);
    const packagePath = path.join(rootDir, PixiClassicAssets.PIXI_PACKAGE_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(packagePath), { recursive: true });
    fs.writeFileSync(packagePath, JSON.stringify({ version }), 'utf8');
    if (includeSource) {
      const sourcePath = path.join(rootDir, PixiClassicAssets.PIXI_SOURCE_RELATIVE_PATH);
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.copyFileSync(
        path.resolve(__dirname, '..', PixiClassicAssets.PIXI_SOURCE_RELATIVE_PATH),
        sourcePath
      );
    }
    return rootDir;
  }

  test('copies the exact pinned UMD asset and is idempotent', () => {
    const rootDir = createFixture();
    const first = PixiClassicAssets.preparePixiClassicAssets({ rootDir });
    const second = PixiClassicAssets.preparePixiClassicAssets({ rootDir });
    const output = fs.readFileSync(first.outputPath);

    expect(first).toMatchObject({
      version: '8.18.1',
      sha256: PixiClassicAssets.PIXI_SOURCE_SHA256,
      wroteFile: true
    });
    expect(second.wroteFile).toBe(false);
    expect(output.equals(fs.readFileSync(first.sourcePath))).toBe(true);
    expect(output.subarray(0, 4096).toString('utf8')).toContain(PixiClassicAssets.PIXI_BANNER);
  });

  test('rejects a package version mismatch', () => {
    const rootDir = createFixture('8.18.0');
    expect(() => PixiClassicAssets.preparePixiClassicAssets({ rootDir }))
      .toThrow(/version mismatch.*8\.18\.1.*8\.18\.0/i);
  });

  test('rejects a missing UMD source', () => {
    const rootDir = createFixture(PixiClassicAssets.PIXI_VERSION, false);
    expect(() => PixiClassicAssets.preparePixiClassicAssets({ rootDir }))
      .toThrow(/classic source is unavailable/i);
  });

  test('rejects content that does not match the pinned artifact', () => {
    const rootDir = createFixture();
    const sourcePath = path.join(rootDir, PixiClassicAssets.PIXI_SOURCE_RELATIVE_PATH);
    const outputPath = path.join(rootDir, PixiClassicAssets.PIXI_OUTPUT_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, 'known-good-output', 'utf8');
    const content = fs.readFileSync(sourcePath);
    content[content.length - 1] = content[content.length - 1] === 0 ? 1 : 0;
    fs.writeFileSync(sourcePath, content);

    expect(() => PixiClassicAssets.preparePixiClassicAssets({ rootDir }))
      .toThrow(/source hash mismatch/i);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('known-good-output');
  });
});
