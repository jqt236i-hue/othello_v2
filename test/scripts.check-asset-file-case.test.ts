import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import { checkAssetFileCase } from '../scripts/check-asset-file-case';

function createTempRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'asset-file-case-'));
}

function writeFile(rootDir: string, relativePath: string, content = 'x'): void {
  const filePath = path.join(rootDir, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('checkAssetFileCase', () => {
  test('regeneration does not require obsolete mirror paths after their canonical source was removed', () => {
    const rootDir = createTempRepo();
    try {
      const old = 'worker-public/assets/characters/old-reference.png';
      expect(checkAssetFileCase({ rootDir, trackedPaths: [old] })).toMatchObject({ ok: true, checkedFiles: 0, obsoleteMirrorPaths: [old] });
      writeFile(rootDir, 'assets/characters/old-reference.png');
      expect(checkAssetFileCase({ rootDir, trackedPaths: [old] })).toMatchObject({ ok: false, obsoleteMirrorPaths: [], issues: [{ type: 'missing', expectedPath: old }] });
      fs.unlinkSync(path.join(rootDir, 'assets/characters/old-reference.png'));
      expect(checkAssetFileCase({ rootDir, trackedPaths: [old, 'assets/characters/old-reference.png'] }).issues).toHaveLength(2);
    } finally { fs.rmSync(rootDir, { recursive: true, force: true }); }
  });
  test('checks real Git filenames with Japanese characters and spaces, including missing files', () => {
    const rootDir = createTempRepo();
    try {
      execFileSync('git', ['init', '--quiet', rootDir]);
      const relative = 'assets/観測者 資料/盤面画像.png';
      writeFile(rootDir, relative);
      execFileSync('git', ['-C', rootDir, 'add', '--', relative]);
      expect(checkAssetFileCase({ rootDir })).toMatchObject({ ok: true, checkedFiles: 1 });
      fs.unlinkSync(path.join(rootDir, relative));
      expect(checkAssetFileCase({ rootDir })).toMatchObject({ ok: false, checkedFiles: 1,
        issues: [expect.objectContaining({ type: 'missing', expectedPath: relative })] });
    } finally { fs.rmSync(rootDir, { recursive: true, force: true }); }
  });
  test('detects tracked asset files whose filesystem case differs from the deployed path', () => {
    const rootDir = createTempRepo();
    try {
      writeFile(rootDir, 'assets/images/hero/HERO.png');

      const result = checkAssetFileCase({
        rootDir,
        trackedPaths: ['assets/images/hero/hero.png']
      });

      expect(result.ok).toBe(false);
      expect(result.issues).toEqual([
        expect.objectContaining({
          type: 'case-mismatch',
          expectedPath: 'assets/images/hero/hero.png',
          actualPath: 'assets/images/hero/HERO.png'
        })
      ]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('accepts tracked asset files when every path segment matches exactly', () => {
    const rootDir = createTempRepo();
    try {
      writeFile(rootDir, 'worker-public/assets/images/hero/hero.png');

      const result = checkAssetFileCase({
        rootDir,
        trackedPaths: ['worker-public/assets/images/hero/hero.png']
      });

      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.checkedFiles).toBe(1);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
