import {
  expectCssBlockNotToContain,
  expectCssBlockToContain,
  readRepoTextFile
} from './helpers/css-test-helpers';

describe('card surface layout contract', () => {
  test('deck and card base surfaces use layout variables', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(cardsCss).toMatch(/\.deck-stack[\s\S]*width:\s*calc\(var\(--layout-size-deck-width\)\s*\*\s*var\(--layout-priority-deck-scale\)\)/);
    expect(cardsCss).toMatch(/\.deck-stack::before[\s\S]*conic-gradient[\s\S]*--card-back-emblem/);
    expect(cardsCss).toMatch(/\.card-item[\s\S]*width:\s*var\(--layout-size-card-width\)/);
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
    const variablesCss = readRepoTextFile('styles-variables.css');

    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*width:\s*calc\(var\(--layout-anchor-card-detail-width\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-card-detail-scale\)\)/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*--layout-anchor-card-detail-bottom/);
    expect(variablesCss).toMatch(/--layout-anchor-card-detail-width:\s*336px/);
    expect(variablesCss).toMatch(/--layout-anchor-card-detail-min-height:\s*184px/);
    expect(variablesCss).toMatch(/--layout-anchor-card-detail-gap:\s*18px/);
    expect(variablesCss).toMatch(/--layout-anchor-card-detail-bottom:\s*304px/);
    expect(cardsCss).toMatch(/#card-detail-desc[\s\S]*min-height:\s*calc\(112px\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-card-detail-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#card-detail-panel[\s\S]*right:\s*calc\(var\(--layout-stage-offset-x\)\s*\+\s*max\(var\(--layout-anchor-side-right\),\s*env\(safe-area-inset-right\)\)\)/);
    expect(cardsCss).not.toMatch(/#card-detail-panel\s*>\s*#card-detail-header[\s\S]*scale\(0\.8333333,\s*0\.9803922\)/);
    expect(cardsCss).toMatch(/\.heaven-blessing-offers \.heaven-offer-card[\s\S]*width:\s*var\(--layout-size-card-width\)/);
  });

  test('card detail panel uses premium cut glass frame and unified action buttons', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');
    const indexHtml = readRepoTextFile('index.html');

    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*clip-path:\s*polygon\(/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*backdrop-filter:\s*blur/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*--card-detail-accent/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column/);
    expect(cardsCss).toMatch(/#card-detail-desc[\s\S]*background:[\s\S]*var\(--card-detail-desc-panel\)/);
    expect(cardsCss).toMatch(/#card-detail-desc[\s\S]*min-height:\s*calc\(112px\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-card-detail-scale\)\)/);
    expect(cardsCss).toMatch(/#card-detail-desc[\s\S]*font-size:\s*calc\(15px\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-card-detail-scale\)\)/);
    expect(indexHtml).toMatch(/id="card-detail-actions"[\s\S]*id="destroy-card-btn"[\s\S]*id="pass-btn"[\s\S]*<\/div>/);
    expect(cardsCss).toMatch(/#card-detail-actions\s*>\s*:is\(#toggle-card-detail-btn,\s*#use-card-btn,\s*#destroy-card-btn,\s*#pass-btn\)/);
    expect(cardsCss).toMatch(/#card-detail-actions\s*\{[\s\S]*margin-top:\s*auto/);
    expect(cardsCss).toMatch(/#card-detail-actions\s*\{[\s\S]*justify-content:\s*flex-start/);
    expect(cardsCss).toMatch(/#card-detail-desc[\s\S]*--card-detail-desc-panel/);
    expect(cardsCss).toMatch(/#card-detail-actions[\s\S]*--card-detail-action-bar/);
    expect(cardsCss).toMatch(/#card-detail-effect-tags[\s\S]*min-height:\s*calc\(21px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/#use-card-reason[\s\S]*--card-detail-warning-chip/);
    expect(cardsCss).toMatch(/#use-card-reason[\s\S]*min-height:\s*0/);
    expect(cardsCss).toMatch(/\.card-detail-effect-tag[\s\S]*--card-detail-tag-surface/);
    expect(cardsCss).toMatch(/\.card-detail-effect-tag[\s\S]*font-size:\s*calc\(13px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/\.card-detail-effect-tag-button[\s\S]*min-height:\s*calc\(24px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/\.card-detail-effect-tag-button::before[\s\S]*background:\s*var\(--card-detail-tag-accent/);
    expect(cardsCss).toMatch(/#toggle-card-detail-btn:not\(:disabled\)[\s\S]*--card-detail-action-accent:\s*#5f7cff/);
    expect(cardsCss).toMatch(/#use-card-btn:not\(:disabled\)[\s\S]*--card-detail-action-accent:\s*#22d878/);
    expect(cardsCss).toMatch(/#destroy-card-btn:not\(:disabled\)[\s\S]*--card-detail-action-accent:\s*#ff4f45/);
    expect(cardsCss).toMatch(/#card-detail-actions > #use-card-btn:not\(:disabled\)[\s\S]*border:[\s\S]*rgba\(34,\s*216,\s*120,\s*0\.78\)/);
  });

  test('effect tag chips keep distinct colors across detail and help surfaces', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');
    const layoutInfoCss = readRepoTextFile('styles-layout-info.css');
    const tagClasses = [
      'is-special-stone',
      'is-hole-cell',
      'is-inviolable',
      'is-flip-protection',
      'is-full-protection',
      'is-flip-evasion',
      'is-destroy-evasion'
    ];

    for (const className of tagClasses) {
      expect(cardsCss).toMatch(new RegExp(`\\.card-detail-effect-tag\\.${className},[\\s\\S]*\\.rules-help-card-tag\\.${className}[\\s\\S]*--card-detail-tag-accent:[\\s\\S]*color:[\\s\\S]*border-color:[\\s\\S]*background:`));
      expect(layoutInfoCss).toMatch(new RegExp(`\\.rules-help-card-tag-filter\\.${className}[\\s\\S]*--rules-help-tag-filter-border:[\\s\\S]*--rules-help-tag-filter-color:[\\s\\S]*--rules-help-tag-filter-bg:`));
    }
  });

  test('game term highlights use shared readable category colors', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');
    const layoutInfoCss = readRepoTextFile('styles-layout-info.css');
    const termClasses = [
      'flip',
      'destroy',
      'stone',
      'protection',
      'cell',
      'resource',
      'unique'
    ];
    const toneClasses = [
      'flip',
      'destroy',
      'stone',
      'protection',
      'cell',
      'resource'
    ];

    expect(layoutInfoCss).toMatch(/\.game-term-highlight\s*\{[\s\S]*font-weight:\s*800[\s\S]*border-radius:\s*4px[\s\S]*box-decoration-break:\s*clone/);
    for (const className of termClasses) {
      expect(layoutInfoCss).toMatch(new RegExp(`\\.game-term-highlight--${className}\\s*\\{[\\s\\S]*color:[\\s\\S]*background:`));
    }
    for (const className of toneClasses) {
      expect(layoutInfoCss).toMatch(new RegExp(`\\.game-term-highlight--unique\\.game-term-highlight--tone-${className}\\s*\\{[\\s\\S]*box-shadow:`));
    }
    expect(cardsCss).toMatch(/#card-detail-desc \.game-term-highlight,[\s\S]*#card-detail-more \.game-term-highlight,[\s\S]*#card-detail-tab-body \.game-term-highlight[\s\S]*font-weight:\s*800[\s\S]*text-shadow:/);
  });

  test('rules help tag filter layout stays stable while filters are active', () => {
    const layoutInfoCss = readRepoTextFile('styles-layout-info.css');

    expect(layoutInfoCss).toMatch(/#rules-help-catalog-controls\s*\{[\s\S]*grid-template-columns:\s*auto\s+minmax\(180px,\s*260px\)\s+minmax\(0,\s*1fr\)\s+minmax\(calc\(70px\s*\*\s*var\(--layout-stage-scale\)\),\s*calc\(96px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(layoutInfoCss).toMatch(/#rules-help-card-tag-filters\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(calc\(76px\s*\*\s*var\(--layout-stage-scale\)\),\s*calc\(76px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
    expect(layoutInfoCss).toMatch(/\.rules-help-card-tag-filter\s*\{[\s\S]*width:\s*100%/);
    expect(layoutInfoCss).toMatch(/#rules-help-card-filter-status\s*\{[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis/);
  });

  test('card surfaces do not keep hidden type badge CSS', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');

    expect(cardsCss).not.toMatch(/\.card-type-badge/);
    expect(cardsCss).not.toMatch(/\.card-badge-row/);
    expect(cardsCss).not.toMatch(/\.card-badge-row\s*\{[\s\S]*display:\s*none\s*!important/);
    expect(cardsCss).not.toMatch(/\.card-type-badge\s*\{[\s\S]*display:\s*none\s*!important/);
    expect(cardsCss).toMatch(/\.card-cost-badge[\s\S]*top:\s*calc\(var\(--layout-size-card-badge-offset\)\s*-\s*\(1px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
  });

  test('card faces use a shared pentagonal frame across all card variants', () => {
    const cardsCss = readRepoTextFile('styles-cards.css');
    const layoutCss = readRepoTextFile('styles-layout.css');

    expectCssBlockToContain(cardsCss, '.card-item', /--card-frame-pentagon:\s*polygon\(50% 0/);
    expect(cardsCss).toMatch(/\.card-item\.visible\s*\{[\s\S]*--card-type-field/);
    expect(cardsCss).toMatch(/\.card-item\.visible\s*\{[\s\S]*--card-face-rune-pattern/);
    expectCssBlockToContain(cardsCss, '.card-item.visible', /clip-path:\s*var\(--card-frame-pentagon\)/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible.cost-tier-special', /clip-path:/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible[data-card-id="rainbow_stone"]', /clip-path:/);
    expectCssBlockNotToContain(cardsCss, '.card-item.visible.special-card-face', /clip-path:/);
    expectCssBlockToContain(cardsCss, '.card-item.visible.special-card-face::after', /clip-path:\s*var\(--card-frame-pentagon\)/);
    expectCssBlockToContain(cardsCss, '.card-item.hidden', /clip-path:\s*var\(--card-frame-pentagon\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-gray[\s\S]*--card-tier-border:\s*#9aa4b2/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-white[\s\S]*--card-tier-border:\s*#f3f7ff/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-red[\s\S]*--card-tier-border:\s*#71d28e/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-blue[\s\S]*--card-tier-border:\s*#7db7ff/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-purple[\s\S]*--card-tier-border:\s*#c6a1ff/);
    expect(cardsCss).toMatch(/\.card-item\.visible::before[\s\S]*inset:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible::after[\s\S]*background:[\s\S]*--card-face-rune-pattern/);
    expect(cardsCss).toMatch(/\.card-background-art[\s\S]*background-image:[\s\S]*--card-background-art-image/);
    expect(cardsCss).toMatch(/\.card-background-art[\s\S]*opacity:\s*var\(--card-background-art-opacity,\s*0\.92\)/);
    expect(cardsCss).toMatch(/\.card-background-art[\s\S]*saturate\(1\.18\)[\s\S]*contrast\(1\.08\)/);
    expect(cardsCss).toMatch(/\.card-background-art[\s\S]*z-index:\s*0/);
    expect(cardsCss).toMatch(/\.card-name[\s\S]*backdrop-filter:\s*blur/);
    expect(cardsCss).toMatch(/\.card-cost-badge[\s\S]*rgba\(255,\s*232,\s*162,\s*0\.16\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-gray[\s\S]*--card-available-core:\s*rgba\(190,\s*202,\s*218,\s*0\.78\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-white[\s\S]*--card-available-core:\s*rgba\(246,\s*250,\s*255,\s*0\.86\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-red[\s\S]*--card-available-core:\s*rgba\(130,\s*225,\s*155,\s*0\.78\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-blue[\s\S]*--card-available-core:\s*rgba\(135,\s*190,\s*255,\s*0\.78\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-purple[\s\S]*--card-available-core:\s*rgba\(202,\s*164,\s*255,\s*0\.8\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-gold[\s\S]*--card-available-core:\s*rgba\(241,\s*210,\s*122,\s*0\.86\)/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-special[\s\S]*--card-available-core:\s*rgba\(155,\s*49,\s*71,\s*0\.82\)/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item:is\(\.affordable,\s*\.usable\):not\(\.selected\)[\s\S]*outline:\s*none/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item:is\(\.affordable,\s*\.usable\):not\(\.selected\)[\s\S]*transform:\s*none/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item\.selected\s*\{[\s\S]*rgba\(255,\s*239,\s*170,\s*0\.96\)/);
    expect(cardsCss).not.toMatch(/\.card-state-glow/);
    expect(cardsCss).not.toMatch(/--card-hand-available-background-glow/);
    expect(layoutCss).toMatch(/\.hand-track\s*\{[\s\S]*position:\s*relative[\s\S]*z-index:\s*1/);
    expect(cardsCss).toMatch(/\.hand-availability-glow-layer\s*\{[\s\S]*position:\s*absolute[\s\S]*z-index:\s*0/);
    expect(cardsCss).toMatch(/\.hand-availability-glow\s*\{[\s\S]*width:\s*calc\(var\(--hand-glow-width,\s*var\(--layout-size-card-width\)\)\s*\+\s*\(18px \* var\(--layout-stage-scale\)\)\)/);
    expect(cardsCss).toMatch(/\.hand-availability-glow\s*\{[\s\S]*height:\s*calc\(var\(--hand-glow-height,\s*var\(--layout-size-card-height\)\)\s*\+\s*\(23px \* var\(--layout-stage-scale\)\)\)/);
    expect(cardsCss).toMatch(/\.hand-availability-glow\s*\{[\s\S]*background:[\s\S]*radial-gradient[\s\S]*var\(--card-available-drop-core\) 0%[\s\S]*var\(--card-available-core\) 30%[\s\S]*var\(--card-available-outer\) 58%[\s\S]*transparent 88%/);
    expect(cardsCss).toMatch(/\.hand-availability-glow\s*\{[\s\S]*filter:\s*blur\(calc\(4\.2px \* var\(--layout-stage-scale\)\)\)/);
    expect(cardsCss).toMatch(/\.hand-availability-glow\s*\{[\s\S]*opacity:\s*0\.66/);
    expect(cardsCss).toMatch(/\.hand-availability-glow\s*\{[\s\S]*calc\(var\(--hand-glow-x,\s*0px\)\s*-\s*\(9px \* var\(--layout-stage-scale\)\)\)/);
    expect(cardsCss).toMatch(/\.hand-availability-glow\.cost-tier-gold[\s\S]*--card-available-core:\s*rgba\(241,\s*210,\s*122,\s*0\.94\)/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item\.selected:is\(\.affordable,\s*\.usable\)\s*\{[\s\S]*overflow:\s*visible/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item:is\(\.affordable,\s*\.usable\):not\(\.selected\)[\s\S]*overflow:\s*visible/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item:is\(\.affordable,\s*\.usable\):not\(\.selected\)[\s\S]*filter:\s*drop-shadow\(var\(--ui-drop-shadow-panel\)\) !important/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item:is\(\.affordable,\s*\.usable\):not\(\.selected\)[\s\S]*animation:\s*none/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item:is\(\.affordable,\s*\.usable\):not\(\.selected\)::before[\s\S]*border-color:\s*var\(--card-tier-inner-border/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item:is\(\.affordable,\s*\.usable\):not\(\.selected\) \.card-name[\s\S]*border-color:\s*var\(--card-tier-name-plate-border/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item:is\(\.affordable,\s*\.usable\):not\(\.selected\) \.card-cost-badge[\s\S]*border-color:\s*var\(--card-tier-badge-border/);
    expect(cardsCss).toMatch(/#hand-black \.card-item\.affordable\.visible\.clickable:hover:not\(\.selected\),[\s\S]*#hand-white \.card-item\.usable\.visible\.clickable:hover:not\(\.selected\)[\s\S]*transform:\s*translateY\(-3px\)/);
    expect(cardsCss).toMatch(/#hand-black \.card-item\.affordable\.visible\.clickable:hover:not\(\.selected\),[\s\S]*#hand-white \.card-item\.usable\.visible\.clickable:hover:not\(\.selected\)[\s\S]*filter:\s*drop-shadow\(var\(--ui-drop-shadow-panel\)\) !important/);
    expect(cardsCss).toMatch(/#hand-black \.card-item\.affordable:not\(\.selected\),[\s\S]*#hand-white \.card-item\.usable:not\(\.selected\)[\s\S]*animation:\s*none !important/);
    expect(cardsCss).toMatch(/:is\(#hand-black,\s*#hand-white\) \.card-item\.visible:not\(\.card-use-ghost\)[\s\S]*filter:\s*drop-shadow\(var\(--ui-drop-shadow-panel\)\)/);
    expect(cardsCss).toMatch(/\.card-special-art[\s\S]*z-index:\s*3/);
    expect(cardsCss).toMatch(/\.card-special-art[\s\S]*opacity:\s*var\(--card-special-art-opacity,\s*0\.76\)/);
    expect(cardsCss).toMatch(/\.card-special-art[\s\S]*background-position:\s*center,\s*center 50%/);
    expect(cardsCss).toMatch(/\.card-item\.visible\.cost-tier-special \.card-special-art,[\s\S]*--card-special-art-opacity:\s*0\.70/);
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
