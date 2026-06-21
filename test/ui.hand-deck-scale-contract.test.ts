import { readRepoTextFile } from './helpers/css-test-helpers';

describe('hand and deck scale CSS contract', () => {
  test('opponent hand and deck scale are named tokens', () => {
    const varsCss = readRepoTextFile('styles-variables.css');

    expect(varsCss).toMatch(/--layout-opponent-hand-scale:\s*0\.765;/);
    expect(varsCss).toMatch(/--layout-opponent-deck-scale:\s*0\.765;/);
  });

  test('opponent slot sizing uses scale tokens instead of local numeric multipliers', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(cardsCss).toMatch(/#hand-white\s+\.card-item\s*\{[\s\S]*width:\s*calc\(var\(--layout-size-card-width\)\s*\*\s*var\(--layout-priority-hand-scale\)\s*\*\s*var\(--layout-opponent-hand-scale\)\)/);
    expect(cardsCss).toMatch(/#hand-white\s+\.card-item\s*\{[\s\S]*height:\s*calc\(var\(--layout-size-card-height\)\s*\*\s*var\(--layout-priority-hand-scale\)\s*\*\s*var\(--layout-opponent-hand-scale\)\)/);
    expect(cardsCss).toMatch(/#deck-white\.deck-stack\s*\{[\s\S]*width:\s*calc\(var\(--layout-size-deck-width\)\s*\*\s*var\(--layout-priority-deck-scale\)\s*\*\s*var\(--layout-opponent-deck-scale\)\)/);
    expect(cardsCss).not.toMatch(/#hand-white\s+\.card-item\s*\{[^}]*\*\s*0\.765/);
    expect(cardsCss).not.toMatch(/#deck-white\.deck-stack\s*\{[^}]*\*\s*0\.765/);
  });

  test('tablet opponent hand override updates the token only', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#hand-white\s*\{[\s\S]*--layout-opponent-hand-scale:\s*0\.697;/);
    expect(responsiveCss).not.toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#hand-white\s+\.card-item\s*\{[\s\S]*\*\s*0\.697/);
  });

  test('phone portrait keeps the player deck after the fixed hand lane', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#deck-black\s*\{[\s\S]*width:\s*var\(--layout-phone-portrait-player-deck-width\);[\s\S]*height:\s*calc\(66px\s*\*\s*var\(--layout-stage-scale\)\);[\s\S]*margin-left:\s*0;/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#deck-black\s+\.deck-count\s*\{[\s\S]*font-size:\s*calc\(11px\s*\*\s*var\(--layout-stage-scale\)\);/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#hand-black\s*\{[\s\S]*order:\s*2;[\s\S]*width:\s*min\(var\(--layout-phone-portrait-hand-fixed-width\),\s*calc\(100%\s*-\s*var\(--layout-phone-portrait-player-deck-width\)\s*-\s*var\(--layout-phone-portrait-player-deck-gap\)\)\);[\s\S]*min-height:\s*calc\(108px\s*\*\s*var\(--layout-stage-scale\)\);/);
  });
});
