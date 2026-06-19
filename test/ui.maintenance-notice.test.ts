import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

const repoRoot = path.join(__dirname, '..');

function readRepoTextFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('startup maintenance notice', () => {
  test('index markup shows the enabled maintenance notice before the game UI', () => {
    const html = readRepoTextFile('index.html');
    const noticeIndex = html.indexOf('id="maintenanceNotice"');

    expect(noticeIndex).toBeGreaterThan(html.indexOf('<body>'));
    expect(noticeIndex).toBeLessThan(html.indexOf('id="info-panel"'));
    expect(html).toMatch(/id="maintenanceNotice"[\s\S]*data-maintenance-notice-enabled="true"[\s\S]*role="dialog"[\s\S]*aria-modal="true"/);
    expect(html).toContain('メンテナンス中です。');
    expect(html).toContain('ゲームが正常にプレイできない可能性があります。');
    expect(html).toMatch(/<button id="maintenanceNoticeCloseBtn"[\s\S]*>閉じる<\/button>/);
  });

  test('notice can be disabled by one data attribute and stays above other modal layers', () => {
    const css = readRepoTextFile('styles-layout-controls.css');
    const vars = readRepoTextFile('styles-variables.css');

    expect(css).toMatch(/#maintenanceNotice\s*\{[\s\S]*z-index:\s*var\(--z-modal-maintenance\)/);
    expect(css).toMatch(/#maintenanceNotice\.is-open\s*\{[\s\S]*display:\s*flex/);
    expect(css).toMatch(/#maintenanceNotice\[data-maintenance-notice-enabled="false"\][\s\S]*display:\s*none/);
    expect(vars).toMatch(/--z-modal-maintenance:\s*26000/);
  });

  test('close button hides the notice without touching game state', () => {
    const dom = new JSDOM(readRepoTextFile('index.html'), {
      pretendToBeVisual: true,
      runScripts: 'dangerously',
      url: 'https://example.test/'
    });

    const notice = dom.window.document.getElementById('maintenanceNotice');
    const closeButton = dom.window.document.getElementById('maintenanceNoticeCloseBtn') as HTMLButtonElement | null;

    expect(notice).not.toBeNull();
    expect(closeButton).not.toBeNull();
    expect(notice?.classList.contains('is-open')).toBe(true);

    closeButton?.click();

    expect(notice?.classList.contains('is-open')).toBe(false);
    expect(notice?.getAttribute('aria-hidden')).toBe('true');
  });
});
