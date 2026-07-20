import { JSDOM } from 'jsdom';

const LeaderboardStyles = require('../ui/handlers/match-mode/leaderboard-styles');

describe('match-mode leaderboard stylesheet loader', () => {
  test('inserts the leaderboard stylesheet once', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/'
    });

    const first = LeaderboardStyles.ensureLeaderboardStylesheet(dom.window.document);
    const second = LeaderboardStyles.ensureLeaderboardStylesheet(dom.window.document);

    const links = dom.window.document.querySelectorAll('link[data-card-reversi-feature-style="leaderboard"]');
    expect(links).toHaveLength(1);
    expect((links[0] as HTMLLinkElement).href).toBe('https://example.test/styles-leaderboard.css');
    links[0].dispatchEvent(new dom.window.Event('load'));
    await expect(first).resolves.toEqual(expect.objectContaining({ ok: true }));
    await expect(second).resolves.toEqual(expect.objectContaining({ ok: true }));

    dom.window.close();
  });
});
