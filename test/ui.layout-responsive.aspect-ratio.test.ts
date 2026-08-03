import * as fs from 'fs';
import * as path from 'path';
import {
  LAYOUT_STYLE_FILES,
  readNetworkFeatureCssSurface,
  readRepoTextFile,
  readLayoutCssSurface,
  requireExistingStyleFiles,
} from './helpers/css-test-helpers';

describe('responsive layout rules for narrow aspect ratio', () => {
  test('styles-responsive.css defines 16:10 to 5:4 safeguards', () => {
    const cssPath = path.join(__dirname, '..', 'styles-responsive.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const layoutCss = readLayoutCssSurface();
    const variablesCss = readRepoTextFile('styles-variables.css');

    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*16\/10\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*3\/2\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*4\/3\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*5\/4\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*(?:901px|56\.3125em)\)\s*and\s*\(max-width:\s*(?:1450px|90\.625em)\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-width:\s*(?:900px|56\.25em)\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*portrait\)\s*and\s*\(pointer:\s*coarse\)\s*and\s*\(min-width:\s*37\.5em\)\s*and\s*\(max-width:\s*56\.25em\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(pointer:\s*coarse\)\s*and\s*\(min-width:\s*56\.3125em\)\s*and\s*\(max-width:\s*87\.5em\)\s*and\s*\(max-height:\s*56\.25em\)[\s\S]*#leftActionButtons[\s\S]*display:\s*grid/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(pointer:\s*coarse\)\s*and\s*\(min-width:\s*56\.3125em\)\s*and\s*\(max-width:\s*87\.5em\)\s*and\s*\(max-height:\s*56\.25em\)[\s\S]*#leftActionButtons[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*calc\(64px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
    expect(css).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+#leftActionButtons[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*calc\(50px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
    expect(css).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#quick-controls-bar[\s\S]*max-width:\s*min\(calc\(320px\s*\*\s*var\(--layout-stage-scale\)\),\s*calc\(100vw\s*-\s*calc\(24px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
    expect(css).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+\.player-area-top[\s\S]*top:\s*calc\(22px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#effect-live-panel[\s\S]*min-height:\s*calc\(156px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(pointer:\s*coarse\)\s*and\s*\(min-width:\s*56\.3125em\)\s*and\s*\(max-width:\s*87\.5em\)\s*and\s*\(max-height:\s*56\.25em\)[\s\S]*#log[\s\S]*right:\s*max/);
    expect(css).toMatch(/@media\s*\(orientation:\s*portrait\)\s*and\s*\(pointer:\s*coarse\)[\s\S]*:is\([\s\S]*#quick-controls-bar,[\s\S]*#manifest-effect-panel,[\s\S]*#hero-character-panel[\s\S]*\)[\s\S]*display:\s*none/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#left-info-stack\s*>\s*#stone-info-panel[\s\S]*position:\s*relative[\s\S]*display:\s*none/);
    expect(css).toMatch(/@media\s*\(orientation:\s*portrait\)\s*and\s*\(pointer:\s*coarse\)[\s\S]*#effect-live-panel[\s\S]*width:\s*min\(calc\(250px\s*\*\s*var\(--layout-stage-scale\)\),\s*30vw\)/);
    expect(css).toMatch(/safe-area-inset-right/);
    expect(css).toMatch(/safe-area-inset-left/);
    expect(css).toMatch(/#game-container[\s\S]*height:\s*100dvh/);
    expect(css).toMatch(/#hero-label[\s\S]*display:\s*none/);
    expect(css).toMatch(/#card-detail-panel[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/--card-detail-landscape-bottom-reserve/);
    expect(css).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#board/);
    expect(css).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#side-panel/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-width:\s*(?:900px|56\.25em)\)\s*\{[\s\S]*html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#game-container[\s\S]*width:\s*var\(--layout-stage-viewport-width\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-width:\s*(?:900px|56\.25em)\)\s*\{[\s\S]*html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#cpu-level-label/);
    expect(css).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#card-detail-panel[\s\S]*--layout-anchor-card-detail-width/);
    expect(css).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#card-detail-panel[\s\S]*--layout-anchor-card-detail-gap/);
    expect(css).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#log[\s\S]*left:\s*calc\(100dvw\s*-\s*var\(--layout-stage-offset-x\)\s*-\s*max\(var\(--layout-anchor-side-right\),\s*env\(safe-area-inset-right\)\)\s*-\s*\(\(var\(--layout-anchor-side-width\)\s*\+\s*var\(--layout-anchor-card-detail-gap\)\)\s*\*\s*var\(--layout-stage-scale\)\)\s*\+\s*\(var\(--layout-anchor-log-detail-gap\)\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(css).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#log[\s\S]*right:\s*auto/);
    expect(css).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#log[\s\S]*top:\s*calc\(var\(--layout-stage-offset-y\)\s*\+\s*var\(--card-detail-landscape-top-anchor/);
    expect(css).toMatch(/html\.layout-profile-16x9\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#log[\s\S]*top:\s*calc\(var\(--layout-stage-offset-y\)\s*\+\s*var\(--card-detail-landscape-top-anchor\)\s*\+\s*calc\(56px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(css).toMatch(/html\.layout-profile-16x9\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#log[\s\S]*width:\s*calc\(292px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-16x9\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s*\{[\s\S]*--layout-anchor-board-size:\s*532px[\s\S]*--layout-player-hand-offset-y:\s*calc\(20px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-16x9\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#game-container\s*\{[\s\S]*padding-top:\s*calc\(44px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*padding-bottom:\s*calc\(92px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(variablesCss).toMatch(/--layout-player-hand-offset-y:\s*calc\(9px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#hand-black,[\s\S]*#deck-black\s*\{[\s\S]*transform:\s*translateY\(var\(--layout-player-hand-offset-y\)\)/);
    expect(layoutCss).not.toMatch(/#side-panel\.side-panel-collapsed\s+#log/);
    expect(css).toMatch(/@media\s*\(min-width:\s*(?:901px|56\.3125em)\)\s*\{[\s\S]*html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#game-container[\s\S]*padding-bottom:\s*calc\(96px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-width:\s*(?:900px|56\.25em)\)\s*\{[\s\S]*html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#hero-label[\s\S]*font-size:\s*clamp\(11px/);
    expect(css).toMatch(/html\.sim-aspect-16-10\s+#board/);
    expect(css).toMatch(/html\.sim-aspect-3-2\s+#board/);
    expect(css).toMatch(/html\.sim-aspect-4-3\s+#effect-live-panel/);
    expect(css).toMatch(/html\.sim-aspect-5-4\s+#effect-live-panel/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#game-container/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#side-panel/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#side-panel\.side-panel-collapsed/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#quick-controls-bar[\s\S]*display:\s*none/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel[\s\S]*position:\s*relative/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel[\s\S]*order:\s*1/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel[\s\S]*max-height:\s*calc\(130px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-desc[\s\S]*min-height:\s*calc\(42px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-actions[\s\S]*margin:\s*calc\(3px\s*\*\s*var\(--layout-stage-scale\)\)\s+0\s+0/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#log[\s\S]*display:\s*none/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#hand-black[\s\S]*order:\s*2/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#hand-white,\s*[\s\S]*#hand-black[\s\S]*overflow-x:\s*auto/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#game-container[\s\S]*gap:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+\.player-area-top,[\s\S]*\.player-area-bottom[\s\S]*gap:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+\.player-area-bottom[\s\S]*row-gap:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*column-gap:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#left-info-stack\s*>\s*#stone-info-panel[\s\S]*position:\s*relative[\s\S]*display:\s*none[\s\S]*transform:\s*none/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#hand-white[\s\S]*min-height:\s*calc\(68px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#hand-white\s+\.card-item[\s\S]*width:\s*calc\(61px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*height:\s*calc\(73px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#hand-black[\s\S]*min-height:\s*calc\(108px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#hand-black\s+\.card-item[\s\S]*width:\s*calc\(92px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*height:\s*calc\(110px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#round-display-panel[\s\S]*display:\s*none/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#cpu-speech-bubble[\s\S]*display:\s*none/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#game-container[\s\S]*padding-bottom:\s*max\(calc\(8px\s*\*\s*var\(--layout-stage-scale\)\),\s*env\(safe-area-inset-bottom\)\)/);
    expect(css).toMatch(/--layout-phone-portrait-player-bottom-offset:\s*calc\(10px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#board-frame[\s\S]*--board-frame-inner-size:\s*min\(86vw,\s*calc\(418px\s*\*\s*var\(--layout-stage-scale\)\),\s*44\.8dvh\)/);
    expect(css).toMatch(/@media\s*\(max-height:\s*620px\)[\s\S]*html\.layout-profile-phone-portrait\s+#board-frame[\s\S]*min\(82vw,\s*calc\(385px\s*\*\s*var\(--layout-stage-scale\)\),\s*41dvh\)/);
    expect(css).not.toMatch(/--layout-phone-portrait-card-detail-tag-reserve|:has\(#card-detail-panel\.has-effect-tags\)/);
    expect(css).toMatch(/#card-detail-panel\.has-effect-tags\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*max-content\s+minmax\(0,\s*1fr\)/);
    expect(css).not.toMatch(/#card-detail-panel\.has-effect-tags\s*\{[\s\S]*"state state"/);
    expect(css).toMatch(/#card-detail-panel\.has-effect-tags\s+#card-detail-live-state\s*\{[\s\S]*grid-area:\s*name[\s\S]*justify-self:\s*end/);
    expect(css).toMatch(/#card-detail-panel\.has-effect-tags\s+#card-detail-actions\s*\{[\s\S]*grid-area:\s*actions[\s\S]*align-self:\s*end/);
    expect(css).toMatch(/#card-detail-panel\.has-effect-tags\s+#card-detail-effect-tags\s*\{[\s\S]*grid-area:\s*tags[\s\S]*flex-wrap:\s*nowrap[\s\S]*overflow-x:\s*auto/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel\s*\{[\s\S]*scrollbar-gutter:\s*auto/);
    expect(css).toMatch(/#card-detail-panel\.has-effect-tags\s+\.card-detail-effect-tag\s*\{[\s\S]*padding-inline:\s*min\(calc\(10px\s*\*\s*var\(--layout-stage-scale\)\),\s*4px\)[\s\S]*font-size:\s*min\(calc\(13px\s*\*\s*var\(--layout-stage-scale\)\),\s*9px\)/);
    expect(css).toMatch(/#card-detail-actions\s*>\s*:is\(#toggle-card-detail-btn,\s*#use-card-btn,\s*#destroy-card-btn\),[\s\S]*min-width:\s*min\(calc\(54px\s*\*\s*var\(--layout-stage-scale\)\),\s*29px\)/);
    expect(css).not.toMatch(/html\.layout-phone-landscape-blocked\s+body::before/);
    expect(css).toMatch(/#effect-live-panel[\s\S]*left:\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#leftActionButtons[\s\S]*top:\s*max\(calc\(240px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/#cpu-character-img[\s\S]*clamp\(/);
  });

  test('stone info list stays on one horizontally scrollable row', () => {
    const boardCss = readRepoTextFile('styles-board.css');

    expect(boardCss).toMatch(/\.stone-info-list\s*\{[\s\S]*flex-wrap:\s*nowrap[\s\S]*min-width:\s*0[\s\S]*overflow-x:\s*auto[\s\S]*overflow-y:\s*hidden[\s\S]*-webkit-overflow-scrolling:\s*touch/);
    expect(boardCss).toMatch(/\.stone-info-list-item\s*\{[\s\S]*flex:\s*0 0 calc\(58px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });

  test('index.html accepts aspect simulation query and sets root class', () => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const classicHtml = readRepoTextFile('index.classic.html');

    expect(html).toMatch(/simAspect/);
    expect(html).toMatch(/data-browser-lane="vite"/);
    expect(classicHtml).toMatch(/ui\/layout-stage\.js/);
    expect(html).toMatch(/sim-aspect/);
    expect(html).toMatch(/sim-aspect-16-10/);
    expect(html).toMatch(/sim-aspect-3-2/);
    expect(html).toMatch(/sim-aspect-4-3/);
    expect(html).toMatch(/sim-aspect-5-4/);
    expect(html).toMatch(/id="round-display-panel"/);
    expect(html).toMatch(/id="manifest-effect-panel"/);
    expect(html).toMatch(/id="gachaBalanceSummary"[\s\S]*observation-stone-icon/);
    expect(html).toMatch(/<div id="log" aria-hidden="true"><\/div>[\s\S]*<!-- Side UI Panel -->/);
    expect(html).not.toMatch(/<div id="side-panel">[\s\S]*<div id="log"[\s\S]*<\/div>[\s\S]*<\/div>\s*<\/div>\s*<!-- Discard Display -->/);
  });

  test('worker-public layout mirrors stay in sync with root sources', () => {
    const mirroredStyleFiles = LAYOUT_STYLE_FILES.concat(
      'styles-layout-result.css',
      'styles-responsive.css'
    );
    const rootStagePath = path.join(__dirname, '..', 'ui', 'layout-stage.js');
    const workerStagePath = path.join(__dirname, '..', 'worker-public', 'ui', 'layout-stage.js');

    mirroredStyleFiles.forEach((fileName) => {
      const rootStylePath = path.join(__dirname, '..', fileName);
      const workerStylePath = path.join(__dirname, '..', 'worker-public', fileName);
      expect(fs.readFileSync(workerStylePath, 'utf8')).toBe(fs.readFileSync(rootStylePath, 'utf8'));
    });
    expect(fs.readFileSync(workerStagePath, 'utf8')).toBe(fs.readFileSync(rootStagePath, 'utf8'));
  });

  test('card detail panel anchor sync exists for landscape layout', () => {
    const tsPath = path.join(__dirname, '..', 'cards', 'card-interaction-detail-panel.ts');
    const ts = fs.readFileSync(tsPath, 'utf8');

    expect(ts).toMatch(/createCardDetailLandscapeAnchorSync/);
    expect(ts).toMatch(/ResizeObserver/);
    expect(ts).toMatch(/--card-detail-landscape-bottom-reserve/);
    expect(ts).toMatch(/width\s*>=\s*901/);
    expect(ts).toMatch(/rect\.top\s*<\s*windowRef\.innerHeight\s*\*\s*0\.5/);
    expect(ts).toMatch(/clearReserve\(\);\s*return;/);
  });

  test('core stage geometry styles avoid non-zero direct fixed px declarations', () => {
    const targets = requireExistingStyleFiles([
      'styles-layout.css',
      'styles-charge-hud.css',
      'styles-layout-result.css',
      'styles-layout-characters.css',
    ]);

    targets.forEach((fileName) => {
      const cssPath = path.join(__dirname, '..', fileName);
      const css = fs.readFileSync(cssPath, 'utf8');
      const directFixedDeclarations = Array.from(
        css.matchAll(/^\s*([\w-]+)\s*:\s*(-?\d+(?:\.\d+)?)px\b/gm),
      )
        .filter((match) => Number(match[2]) !== 0)
        .map((match) => match[0].trim());
      expect(directFixedDeclarations).toEqual([]);
    });
  });

  test('split layout styles keep the same cascade order in browser entries and worker assets', () => {
    const extractStylesheetHrefs = (html: string): string[] => {
      const directHrefs = Array.from(html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g))
        .map((match) => match[1]);
      const viteStyleMetadata = Array.from(html.matchAll(/<meta\s+name="card-reversi-classic-style"\s+content="([^"]+)"/g))
        .map((match) => match[1]);
      return (directHrefs.length > 0 ? directHrefs : viteStyleMetadata)
        .map((href) => href.replace(/\?v=\d+$/, ''));
    };
    const assertLayoutCascadeOrder = (fileName: string): void => {
      const hrefs = extractStylesheetHrefs(readRepoTextFile(fileName));
      const layoutIndex = hrefs.indexOf('styles-layout.css');
      expect(layoutIndex).toBeGreaterThanOrEqual(0);
      expect(hrefs.slice(layoutIndex, layoutIndex + LAYOUT_STYLE_FILES.length)).toEqual(LAYOUT_STYLE_FILES);
      expect(hrefs[layoutIndex + LAYOUT_STYLE_FILES.length]).toBe('styles-board.css');
    };

    assertLayoutCascadeOrder('index.html');
    assertLayoutCascadeOrder('index.classic.html');
    assertLayoutCascadeOrder('worker-public/index.html');
    assertLayoutCascadeOrder('worker-public/index.classic.html');

    const prepareWorkerAssets = readRepoTextFile('scripts/prepare-worker-assets.ts');
    const workerLayoutFiles = Array.from(prepareWorkerAssets.matchAll(/'([^']+\.css)'/g))
      .map((match) => match[1])
      .filter((fileName) => LAYOUT_STYLE_FILES.includes(fileName));
    expect(workerLayoutFiles).toEqual(LAYOUT_STYLE_FILES);
  });

  test('stage layout script and variables exist', () => {
    const stageJsPath = path.join(__dirname, '..', 'ui', 'layout-stage.ts');
    const stageJs = fs.readFileSync(stageJsPath, 'utf8');
    const varsPath = path.join(__dirname, '..', 'styles-variables.css');
    const varsCss = fs.readFileSync(varsPath, 'utf8');
    const layoutCss = readLayoutCssSurface();
    const networkFeatureCss = readNetworkFeatureCssSurface();
    const html = readRepoTextFile('index.html');

    expect(stageJs).toMatch(/layout-stage-enabled/);
    expect(stageJs).toMatch(/layout-profile-16x9/);
    expect(stageJs).toMatch(/layout-profile-tablet-4x3/);
    expect(stageJs).toMatch(/layout-profile-phone-portrait/);
    expect(stageJs).toMatch(/layout-phone-landscape-blocked/);
    expect(stageJs).toMatch(/data-layout-profile/);
    expect(stageJs).toMatch(/--layout-stage-scale/);
    expect(stageJs).toMatch(/--layout-stage-offset-x/);
    expect(stageJs).toMatch(/BASE_PHONE_PORTRAIT[\s\S]*430[\s\S]*932/);
    expect(stageJs).toMatch(/BASE_TABLET_43[\s\S]*1366[\s\S]*960/);
    expect(stageJs).toMatch(/resolveLayoutProfile/);
    expect(stageJs).toMatch(/any-pointer:\s*coarse/);
    expect(stageJs).toMatch(/maxTouchPoints/);
    expect(stageJs).toMatch(/isIpadUserAgent/);
    expect(stageJs).toMatch(/iPad/i);
    expect(stageJs).toMatch(/Macintosh/i);
    expect(stageJs).toMatch(/shortEdge\s*<=\s*500/);
    expect(stageJs).toMatch(/blockPhoneLandscape/);
    expect(stageJs).toMatch(/dprRatio/);
    expect(stageJs).toMatch(/innerWidth\s*\*\s*dprRatio/);
    expect(stageJs).toMatch(/vv\.width\s*\*\s*vvScale/);
    expect(stageJs).not.toMatch(/if\s*\(!force\s*&&\s*isZoomInteractionActive\(\)\)\s*return/);
    expect(stageJs).toMatch(/ASPECT_TABLET_43_MIN/);
    expect(stageJs).toMatch(/ASPECT_TABLET_43_MAX/);
    expect(stageJs).toMatch(/ASPECT_TABLET_43_HYSTERESIS/);
    expect(stageJs).toMatch(/previousProfile/);
    expect(stageJs).toMatch(/nearTabletAspectWithHysteresis/);
    expect(stageJs).toMatch(/tabletLikeTouchDevice/);
    expect(stageJs).toMatch(/currentAspect\s*<=\s*1\.9/);
    expect(stageJs).toMatch(/simAspect[\s\S]*>=\s*ASPECT_TABLET_43_MIN[\s\S]*simAspect[\s\S]*<=\s*ASPECT_TABLET_43_MAX/);
    expect(stageJs).toMatch(/visualViewport[\s\S]*scale/);
    expect(stageJs).toMatch(/devicePixelRatio/);
    expect(stageJs).toMatch(/getDesktopChromeCompensation/);
    expect(stageJs).toMatch(/getTabletLandscapeCompensation/);
    expect(stageJs).toMatch(/compensationHeight\s*=\s*getDesktopChromeCompensation\(viewport\)/);
    expect(stageJs).toMatch(/compensationHeight\s*=\s*getTabletLandscapeCompensation\(viewport\)/);
    expect(stageJs).toMatch(/--layout-stage-bottom-safe-shift/);
    expect(stageJs).toMatch(/window\.screen|screenObj\.height|screenObj\.availHeight/);
    expect(stageJs).toMatch(/effectiveHeight\s*<\s*baseHeight/);
    expect(stageJs).toMatch(/Math\.max\(0\.01,\s*scale\)/);
    expect(stageJs).not.toMatch(/Math\.min\(1,\s*scale\)/);
    expect(varsCss).toMatch(/--layout-base-width:\s*1920/);
    expect(varsCss).toMatch(/--layout-base-height:\s*1080/);
    expect(varsCss).toMatch(/--layout-stage-bottom-safe-shift:\s*0px/);
    expect(varsCss).toMatch(/--layout-anchor-board-size/);
    expect(varsCss).toMatch(/--layout-anchor-card-detail-width:\s*336px/);
    expect(varsCss).toMatch(/--layout-anchor-card-detail-gap:\s*18px/);
    expect(varsCss).toMatch(/--layout-anchor-card-detail-bottom:\s*304px/);
    expect(varsCss).toMatch(/--layout-anchor-log-detail-gap:\s*12px/);
    expect(varsCss).toMatch(/--layout-anchor-chat-left:\s*132px/);
    expect(varsCss).toMatch(/--layout-anchor-hero-bottom:\s*92px/);
    expect(varsCss).toMatch(/--layout-anchor-character-offset-y:\s*48px/);
    expect(varsCss).toMatch(/--layout-cpu-image-scale:\s*1\.1/);
    expect(varsCss).toMatch(/--layout-priority-board-scale:\s*1/);
    expect(varsCss).toMatch(/--layout-priority-deck-scale:\s*1/);
    expect(varsCss).toMatch(/--layout-priority-hand-scale:\s*1/);
    expect(varsCss).toMatch(/--layout-priority-card-detail-scale:\s*1/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3\s*\{/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-anchor-board-size:\s*540px/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-anchor-card-detail-gap:\s*0px/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-anchor-card-detail-bottom:\s*252px/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-anchor-hero-bottom:\s*28px/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-character-image-scale:\s*0\.72/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-cpu-image-scale:\s*0\.98/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-priority-board-scale:\s*1\.02/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-priority-hand-scale:\s*1\.02/);
    expect(varsCss).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(pointer:\s*coarse\)\s*and\s*\(min-width:\s*(?:900px|56\.25em)\)\s*and\s*\(max-width:\s*(?:1400px|87\.5em)\)\s*and\s*\(max-height:\s*(?:1100px|68\.75em)\)/);
    expect(varsCss).toMatch(/:root:not\(\.layout-profile-phone-portrait\)[\s\S]*--layout-priority-board-scale:\s*1\.02/);
    expect(varsCss).toMatch(/--layout-size-deck-width/);
    expect(varsCss).toMatch(/--layout-size-card-width/);
    expect(varsCss).toMatch(/--layout-size-card-large-width/);
    expect(varsCss).toMatch(/--layout-size-charge-font/);
    expect(varsCss).toMatch(/--layout-size-charge-offset/);
    expect(varsCss).toMatch(/--layout-size-charge-delta-side-gap/);
    expect(layoutCss).toMatch(/--layout-stage-offset-x/);
    expect(layoutCss).toMatch(/--layout-stage-offset-y/);
    expect(layoutCss).toMatch(/#side-panel[\s\S]*--layout-stage-bottom-safe-shift/);
    expect(layoutCss).toMatch(/\.observation-stone-icon[\s\S]*assets\/images\/other\/観測石\.png/);
    expect(layoutCss).not.toMatch(/gacha-observation-stone-v1\.png/);
    expect(layoutCss).toMatch(/\.result-observation-stone-text/);
    expect(html).toMatch(/class="gacha-reference-shell"/);
    expect(html).toMatch(/class="gacha-pull-showcase"/);
    expect(html).toMatch(/class="gacha-pull-main gacha-pull-main-ten"/);
    expect(layoutCss).toMatch(/#gachaModal[\s\S]*--gacha-reference-scale:\s*clamp\(0\.56,\s*calc\(var\(--layout-stage-scale\)\s*\*\s*0\.80\),\s*0\.64\)/);
    expect(layoutCss).toMatch(/#gachaModal[\s\S]*width:\s*min\(calc\(1500px\s*\*\s*var\(--gacha-reference-scale\)\)/);
    expect(layoutCss).toMatch(/#gachaModal[\s\S]*height:\s*min\(calc\(1088px\s*\*\s*var\(--gacha-reference-scale\)\)/);
    expect(layoutCss).toMatch(/\.gacha-reference-shell[\s\S]*grid-template-rows:\s*calc\(52px\s*\*\s*var\(--gacha-reference-scale\)\)\s*calc\(248px\s*\*\s*var\(--gacha-reference-scale\)\)\s*calc\(340px\s*\*\s*var\(--gacha-reference-scale\)\)\s*calc\(138px\s*\*\s*var\(--gacha-reference-scale\)\)/);
    expect(layoutCss).toMatch(/#gachaModal\s+\.gacha-rate-rarity[\s\S]*clip-path:\s*polygon\(/);
    expect(layoutCss).toMatch(/#gachaModal\s+\.gacha-pull-showcase::after[\s\S]*var\(--gacha-crystal-cluster-image, none\)/);
    const gachaFeatureCss = fs.readFileSync(path.resolve(__dirname, '..', 'styles-feature-gacha.css'), 'utf8');
    expect(gachaFeatureCss).toContain('gacha-crystal-cluster-v1.png');
    expect(layoutCss).toMatch(/#gachaModal\s+\.gacha-pull-main::before[\s\S]*radial-gradient\(circle at 50% 50%,\s*rgba\(255,\s*232,\s*146/);
    expect(layoutCss).toMatch(/@media\s*\(max-width:\s*56\.25em\)\s*and\s*\(min-width:\s*50em\)[\s\S]*#gachaModal[\s\S]*--gacha-reference-scale:\s*0\.5\s*!important/);
    expect(layoutCss).toMatch(/@media\s*\(max-width:\s*56\.25em\)\s*and\s*\(min-width:\s*50em\)[\s\S]*#gachaModal[\s\S]*width:\s*min\(calc\(1500px\s*\*\s*var\(--gacha-reference-scale\)\),\s*calc\(100vw\s*-\s*48px\)\)\s*!important/);
    expect(layoutCss).toMatch(/\.gacha-pull-showcase[\s\S]*grid-template-columns:/);
    expect(layoutCss).toMatch(/\.gacha-rate-row\[data-gacha-rarity="exr"\]/);
    expect(layoutCss).toMatch(/\.gacha-result-rarity[\s\S]*font-size:\s*calc\(13px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#gachaOverlay\.is-revealing\s+#gachaModal/);
    expect(layoutCss).toMatch(/#gachaRevealStage[\s\S]*position:\s*absolute/);
    expect(layoutCss).toMatch(/\.gacha-reveal-impact-flash/);
    expect(layoutCss).toMatch(/#gachaRevealStage\.is-impact-visible\[data-reveal-effect="subtle"\]/);
    expect(layoutCss).toMatch(/#gachaRevealStage\.is-impact-visible\[data-reveal-effect="singularity"\]/);
    expect(layoutCss).toMatch(/\.gacha-reveal-hero-rarity::before/);
    expect(layoutCss).toMatch(/\.gacha-reveal-hero-rarity[\s\S]*font-size:\s*calc\(22px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.gacha-reveal-slot-rarity[\s\S]*border-radius:\s*calc\(999px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.gacha-reveal-slot-rarity[\s\S]*font-size:\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(networkFeatureCss).toMatch(/#networkChatPanel[\s\S]*--layout-anchor-chat-left/);
    expect(layoutCss).toMatch(/#hero-character-img[\s\S]*--layout-anchor-character-offset-y/);
    expect(layoutCss).toMatch(/#cpu-character-img[\s\S]*--layout-cpu-image-scale/);
    expect(layoutCss).toMatch(/@keyframes\s+round-bonus-toast-enter/);
    expect(layoutCss).toMatch(/@keyframes\s+round-bonus-toast-fade-out/);
    expect(layoutCss).toMatch(/#round-display-panel[\s\S]*display:\s*none/);
    expect(layoutCss).toMatch(/#round-display-panel\.is-round-bonus-active[\s\S]*animation:\s*round-bonus-toast-enter/);
    expect(layoutCss).toMatch(/#round-display-panel\.is-round-bonus-active\.is-round-bonus-fading[\s\S]*animation:\s*round-bonus-toast-fade-out/);
    expect(layoutCss).toMatch(/#round-display-panel\.is-round-bonus-active[\s\S]*min-height:\s*calc\(58px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });
});
