import { readRepoTextFile } from './helpers/css-test-helpers';

describe('deck fixed hand layout contract', () => {
  test('normal hand lanes reserve five card slots so deck position is stable', () => {
    const layoutCss = readRepoTextFile('styles-layout.css');

    expect(layoutCss).toMatch(/--layout-hand-fixed-slot-count:\s*5/);
    expect(layoutCss).toMatch(/\.hand-container\s*\{[\s\S]*--layout-hand-fixed-width:[\s\S]*var\(--layout-hand-fixed-card-width\)[\s\S]*var\(--layout-hand-fixed-slot-count\)[\s\S]*width:\s*min\(var\(--layout-hand-fixed-width\),\s*var\(--layout-size-hand-max-width\)\)/);
    expect(layoutCss).toMatch(/#hand-black\s*\{[\s\S]*--layout-hand-fixed-card-width:\s*calc\(var\(--layout-size-card-large-width\)\s*\*\s*var\(--layout-priority-hand-scale\)\)/);
    expect(layoutCss).toMatch(/#hand-white\s*\{[\s\S]*--layout-hand-fixed-card-width:\s*calc\(var\(--layout-size-card-width\)\s*\*\s*var\(--layout-priority-hand-scale\)\s*\*\s*var\(--layout-opponent-hand-scale\)\)/);
  });

  test('debug layouts can still overflow hands without changing the fixed normal contract', () => {
    const layoutCss = readRepoTextFile('styles-layout.css');

    expect(layoutCss).toMatch(/html\.debug-layout \.hand-container,[\s\S]*body\.debug-layout \.hand-container\s*\{[\s\S]*overflow:\s*hidden/);
    expect(layoutCss).toMatch(/html\.debug-layout \.hand-track,[\s\S]*body\.debug-layout \.hand-track\s*\{[\s\S]*justify-content:\s*flex-start/);
  });

  test('phone portrait keeps the player deck after a fixed five-card hand lane', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/--layout-phone-portrait-player-row-width:\s*min\(calc\(540px\s*\*\s*var\(--layout-stage-scale\)\),\s*96vw\)/);
    expect(responsiveCss).toMatch(/--layout-phone-portrait-player-utility-width:\s*max\(44px,\s*var\(--layout-phone-portrait-player-deck-width\)\)/);
    expect(responsiveCss).toMatch(/--layout-phone-portrait-hand-fixed-card-width:\s*calc\(92px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/--layout-phone-portrait-hand-fixed-padding-x:\s*calc\(10px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/--layout-phone-portrait-hand-fixed-width:[\s\S]*var\(--layout-phone-portrait-hand-fixed-card-width\)[\s\S]*var\(--layout-phone-portrait-hand-fixed-card-width\)[\s\S]*var\(--layout-phone-portrait-hand-fixed-card-width\)[\s\S]*var\(--layout-phone-portrait-hand-fixed-card-width\)[\s\S]*var\(--layout-phone-portrait-hand-fixed-card-width\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait \.player-area-bottom\s*\{[\s\S]*width:\s*var\(--layout-phone-portrait-player-row-width\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait #deck-black\s*\{[\s\S]*margin-left:\s*calc\(var\(--layout-phone-portrait-player-utility-width\)\s*-\s*var\(--layout-phone-portrait-player-deck-width\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait #hand-black\s*\{[\s\S]*--layout-hand-fixed-card-width:\s*var\(--layout-phone-portrait-hand-fixed-card-width\)[\s\S]*width:\s*min\(var\(--layout-phone-portrait-hand-fixed-width\),\s*calc\(100%\s*-\s*var\(--layout-phone-portrait-player-utility-width\)\s*-\s*var\(--layout-phone-portrait-player-deck-gap\)\)\)/);
  });
});
