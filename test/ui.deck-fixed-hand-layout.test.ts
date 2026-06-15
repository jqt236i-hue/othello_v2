import { readRepoTextFile } from './helpers/css-test-helpers';

describe('deck fixed hand layout contract', () => {
  test('normal hand lanes reserve five card slots so deck position is stable', () => {
    const layoutCss = readRepoTextFile('styles-layout.css');

    expect(layoutCss).toMatch(/--layout-hand-fixed-slot-count:\s*5/);
    expect(layoutCss).toMatch(/\.hand-container\s*\{[\s\S]*--layout-hand-fixed-width:[\s\S]*var\(--layout-hand-fixed-card-width\)[\s\S]*var\(--layout-hand-fixed-slot-count\)[\s\S]*width:\s*min\(var\(--layout-hand-fixed-width\),\s*var\(--layout-size-hand-max-width\)\)/);
    expect(layoutCss).toMatch(/#hand-black\s*\{[\s\S]*--layout-hand-fixed-card-width:\s*calc\(var\(--layout-size-card-large-width\)\s*\*\s*var\(--layout-priority-hand-scale\)\)/);
    expect(layoutCss).toMatch(/#hand-white\s*\{[\s\S]*--layout-hand-fixed-card-width:\s*calc\(var\(--layout-size-card-width\)\s*\*\s*var\(--layout-priority-hand-scale\)\s*\*\s*var\(--layout-opponent-hand-scale\)\)/);
  });

  test('debug and phone portrait layouts can still overflow hands without changing the fixed normal contract', () => {
    const layoutCss = readRepoTextFile('styles-layout.css');
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(layoutCss).toMatch(/html\.debug-layout \.hand-container,[\s\S]*body\.debug-layout \.hand-container\s*\{[\s\S]*overflow:\s*hidden/);
    expect(layoutCss).toMatch(/html\.debug-layout \.hand-track,[\s\S]*body\.debug-layout \.hand-track\s*\{[\s\S]*justify-content:\s*flex-start/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait #hand-white,\s*[\s\S]*#hand-black\s*\{[\s\S]*width:\s*auto;[\s\S]*overflow-x:\s*auto/);
  });
});
