import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
