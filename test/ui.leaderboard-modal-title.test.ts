import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

describe('leaderboard modal title', () => {
  test('スコアランキングとして表示する', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const dom = new JSDOM(html);

    const modal = dom.window.document.getElementById('leaderboardModal');
    const title = dom.window.document.querySelector('.leaderboard-title');
    const closeBtn = dom.window.document.getElementById('leaderboardCloseBtn');

    expect(modal?.getAttribute('aria-label')).toBe('スコアランキング');
    expect(title?.textContent).toBe('スコアランキング');
    expect(closeBtn?.getAttribute('aria-label')).toBe('スコアランキングを閉じる');
  });
});
