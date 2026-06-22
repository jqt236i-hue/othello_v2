import { JSDOM } from 'jsdom';

const LeaderboardStyles = require('../ui/handlers/match-mode/leaderboard-styles');

describe('match-mode leaderboard stylesheet loader', () => {
  test('inserts the leaderboard stylesheet once', () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');

    LeaderboardStyles.ensureLeaderboardStylesheet(dom.window.document);
    LeaderboardStyles.ensureLeaderboardStylesheet(dom.window.document);

    const links = dom.window.document.querySelectorAll('link[data-leaderboard-styles="true"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('styles-leaderboard.css');

    dom.window.close();
  });
});
