import { readRepoTextFile } from './helpers/css-test-helpers';

describe('card surface layout contract', () => {
  test('deck and card base surfaces use layout variables', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(cardsCss).toMatch(/\.deck-stack[\s\S]*width:\s*calc\(var\(--layout-size-deck-width\)\s*\*\s*var\(--layout-priority-deck-scale\)\)/);
    expect(cardsCss).toMatch(/\.deck-stack::before[\s\S]*conic-gradient[\s\S]*--card-back-emblem/);
    expect(cardsCss).toMatch(/\.card-item[\s\S]*width:\s*var\(--layout-size-card-width\)/);
    expect(cardsCss).toMatch(/\.card-badge-row[\s\S]*left:\s*0[\s\S]*right:\s*0[\s\S]*bottom:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/\.card-cost-badge[\s\S]*top:\s*calc\(var\(--layout-size-card-badge-offset\)\s*-\s*\(1px\s*\*\s*var\(--layout-stage-scale\)\)\)[\s\S]*left:\s*calc\(var\(--layout-size-card-badge-offset\)\s*-\s*\(1px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(cardsCss).toMatch(/\.card-name[\s\S]*padding:[\s\S]*var\(--layout-size-card-badge-font\)/);
    expect(cardsCss).toMatch(/\.flying-card[\s\S]*width:\s*var\(--layout-size-card-width\)/);
  });

  test('player hand large card layout remains tokenized', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(cardsCss).toMatch(/#hand-black \.card-item[\s\S]*width:\s*calc\(var\(--layout-size-card-large-width\)\s*\*\s*var\(--layout-priority-hand-scale\)\)/);
    expect(cardsCss).toMatch(/#hand-black \.card-item \.card-cost-badge[\s\S]*top:\s*var\(--layout-size-card-badge-large-offset\)[\s\S]*left:\s*var\(--layout-size-card-badge-large-offset\)/);
    expect(cardsCss).toMatch(/#hand-black \.card-item \.card-name[\s\S]*padding-top:\s*calc\(var\(--layout-size-card-badge-large-font\)/);
    expect(responsiveCss).not.toMatch(/#hand-black\s+\.card-item\s+\.card-badge-row\s+\.card-cost-badge/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#hand-black\s+\.card-item\s+\.card-cost-badge[\s\S]*top:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*left:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#hand-black\s+\.card-item\s+\.card-cost-badge[\s\S]*top:\s*var\(--layout-size-card-badge-large-offset\)[\s\S]*left:\s*var\(--layout-size-card-badge-large-offset\)/);
  });

  test('card detail panel layout remains anchored and avoids legacy header scaling', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*width:\s*calc\(var\(--layout-anchor-card-detail-width\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-card-detail-scale\)\)/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*--layout-anchor-card-detail-bottom/);
    expect(responsiveCss).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#card-detail-panel[\s\S]*right:\s*calc\(var\(--layout-stage-offset-x\)\s*\+\s*max\(var\(--layout-anchor-side-right\),\s*env\(safe-area-inset-right\)\)\)/);
    expect(cardsCss).not.toMatch(/#card-detail-panel\s*>\s*#card-detail-header[\s\S]*scale\(0\.8333333,\s*0\.9803922\)/);
    expect(cardsCss).toMatch(/\.heaven-blessing-offers \.heaven-offer-card[\s\S]*width:\s*var\(--layout-size-card-width\)/);
  });

  test('card detail panel uses premium cut glass frame and unified action buttons', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*clip-path:\s*polygon\(/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*backdrop-filter:\s*blur/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*--card-detail-accent/);
    expect(cardsCss).toMatch(/#card-detail-desc[\s\S]*background:[\s\S]*rgba\(0,\s*0,\s*0,\s*0\.22\)/);
    expect(cardsCss).toMatch(/#card-detail-actions\s*>\s*:is\(#toggle-card-detail-btn,\s*#use-card-btn,\s*#destroy-card-btn\)/);
    expect(cardsCss).toMatch(/#use-card-btn:not\(:disabled\)[\s\S]*--card-detail-action-accent:\s*#70e09a/);
    expect(cardsCss).toMatch(/#destroy-card-btn:not\(:disabled\)[\s\S]*--card-detail-action-accent:\s*#ff8a7a/);
  });

  test('card surfaces suppress type badges while keeping other card layout tokens intact', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(cardsCss).toMatch(/\.card-badge-row\s*\{[\s\S]*display:\s*none\s*!important/);
    expect(cardsCss).toMatch(/\.card-type-badge\s*\{[\s\S]*display:\s*none\s*!important/);
    expect(cardsCss).toMatch(/\.card-cost-badge[\s\S]*top:\s*calc\(var\(--layout-size-card-badge-offset\)\s*-\s*\(1px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
  });

  test('card faces use premium frame, type texture variables, and bottom name plate', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(cardsCss).toMatch(/\.card-item\.visible\s*\{[\s\S]*--card-type-field/);
    expect(cardsCss).toMatch(/\.card-item\.visible\s*\{[\s\S]*--card-face-rune-pattern/);
    expect(cardsCss).toMatch(/\.card-item\.visible\s*\{[\s\S]*clip-path:\s*polygon\(50% 0/);
    expect(cardsCss).toMatch(/\.card-item\.visible::before[\s\S]*inset:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible::after[\s\S]*background:[\s\S]*--card-face-rune-pattern/);
    expect(cardsCss).toMatch(/\.card-name\s*\{[\s\S]*top:\s*auto[\s\S]*bottom:\s*calc\(6px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });

  test('card backs and deck stacks use shared emblem treatment without readable CARD text', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(cardsCss).toMatch(/\.card-item\.hidden\s*\{[\s\S]*font-size:\s*0/);
    expect(cardsCss).toMatch(/\.card-item\.hidden::before[\s\S]*--card-back-emblem/);
    expect(cardsCss).toMatch(/\.card-item\.hidden::after[\s\S]*conic-gradient/);
    expect(cardsCss).toMatch(/\.deck-stack::before[\s\S]*--card-back-emblem/);
    expect(cardsCss).toMatch(/\.deck-stack \.deck-count[\s\S]*backdrop-filter:\s*blur/);
  });
});
