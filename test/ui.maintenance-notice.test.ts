import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.join(__dirname, '..');

function readRepoTextFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('startup maintenance notice', () => {
  test('index markup does not include the temporary maintenance notice popup', () => {
    const html = readRepoTextFile('index.html');

    expect(html).not.toContain('id="maintenanceNotice"');
    expect(html).not.toContain('id="maintenanceNoticeScript"');
    expect(html).not.toContain('メンテナンス中です。');
    expect(html).not.toContain('ゲームが正常にプレイできない可能性があります。');
  });
});
