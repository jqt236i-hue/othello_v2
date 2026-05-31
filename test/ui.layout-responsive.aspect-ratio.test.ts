import * as fs from 'fs';
import * as path from 'path';
import {
  CORE_UI_STYLE_FILES,
  getExistingStyleFiles,
  readLayoutCssSurface,
} from './helpers/css-test-helpers';

describe('responsive layout rules for narrow aspect ratio', () => {
  test('styles-responsive.css defines 16:10 to 5:4 safeguards', () => {
    const cssPath = path.join(__dirname, '..', 'styles-responsive.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*16\/10\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*3\/2\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*4\/3\)/);
    expect(css).toMatch(/@media\s*\(max-aspect-ratio:\s*5\/4\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*(?:901px|56\.3125em)\)\s*and\s*\(max-width:\s*(?:1450px|90\.625em)\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-width:\s*(?:900px|56\.25em)\)/);
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
    expect(css).toMatch(/@media\s*\(min-width:\s*(?:901px|56\.3125em)\)\s*\{[\s\S]*html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#game-container[\s\S]*padding-bottom:\s*calc\(96px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-width:\s*(?:900px|56\.25em)\)\s*\{[\s\S]*html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#hero-label[\s\S]*font-size:\s*clamp\(11px/);
    expect(css).toMatch(/html\.sim-aspect-16-10\s+#board/);
    expect(css).toMatch(/html\.sim-aspect-3-2\s+#board/);
    expect(css).toMatch(/html\.sim-aspect-4-3\s+#effect-live-panel/);
    expect(css).toMatch(/html\.sim-aspect-5-4\s+#effect-live-panel/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#game-container/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#side-panel/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#side-panel\.side-panel-collapsed/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel[\s\S]*position:\s*relative/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#card-detail-panel[\s\S]*order:\s*1/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#hand-black[\s\S]*order:\s*2/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#hand-white,\s*[\s\S]*#hand-black[\s\S]*overflow-x:\s*auto/);
    expect(css).toMatch(/html\.layout-profile-phone-portrait\s+#round-display-panel[\s\S]*display:\s*none/);
    expect(css).not.toMatch(/html\.layout-phone-landscape-blocked\s+body::before/);
    expect(css).toMatch(/#effect-live-panel[\s\S]*left:\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/#cpu-character-img[\s\S]*clamp\(/);
  });

  test('index.html accepts aspect simulation query and sets root class', () => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toMatch(/simAspect/);
    expect(html).toMatch(/ui\/layout-stage\.js/);
    expect(html).toMatch(/sim-aspect/);
    expect(html).toMatch(/sim-aspect-16-10/);
    expect(html).toMatch(/sim-aspect-3-2/);
    expect(html).toMatch(/sim-aspect-4-3/);
    expect(html).toMatch(/sim-aspect-5-4/);
    expect(html).toMatch(/id="round-display-panel"/);
    expect(html).toMatch(/id="gachaBalanceSummary"[\s\S]*observation-stone-icon/);
  });

  test('worker-public layout mirrors stay in sync with root sources', () => {
    const rootResponsivePath = path.join(__dirname, '..', 'styles-responsive.css');
    const workerResponsivePath = path.join(__dirname, '..', 'worker-public', 'styles-responsive.css');
    const rootStagePath = path.join(__dirname, '..', 'ui', 'layout-stage.js');
    const workerStagePath = path.join(__dirname, '..', 'worker-public', 'ui', 'layout-stage.js');

    expect(fs.readFileSync(workerResponsivePath, 'utf8')).toBe(fs.readFileSync(rootResponsivePath, 'utf8'));
    expect(fs.readFileSync(workerStagePath, 'utf8')).toBe(fs.readFileSync(rootStagePath, 'utf8'));
  });

  test('card detail panel anchor sync exists for landscape layout', () => {
    const tsPath = path.join(__dirname, '..', 'cards', 'card-interaction.ts');
    const ts = fs.readFileSync(tsPath, 'utf8');

    expect(ts).toMatch(/_syncCardDetailLandscapeAnchorReserve/);
    expect(ts).toMatch(/ResizeObserver/);
    expect(ts).toMatch(/--card-detail-landscape-bottom-reserve/);
    expect(ts).toMatch(/width\s*>=\s*901/);
  });

  test('core UI styles avoid direct fixed px declarations', () => {
    const targets = getExistingStyleFiles(CORE_UI_STYLE_FILES);

    targets.forEach((fileName) => {
      const cssPath = path.join(__dirname, '..', fileName);
      const css = fs.readFileSync(cssPath, 'utf8');
      expect(css).not.toMatch(/:\s*-?\d+(?:\.\d+)?px/);
    });
  });

  test('stage layout script and variables exist', () => {
    const stageJsPath = path.join(__dirname, '..', 'ui', 'layout-stage.ts');
    const stageJs = fs.readFileSync(stageJsPath, 'utf8');
    const varsPath = path.join(__dirname, '..', 'styles-variables.css');
    const varsCss = fs.readFileSync(varsPath, 'utf8');
    const layoutCss = readLayoutCssSurface();
    const responsivePath = path.join(__dirname, '..', 'styles-responsive.css');
    const responsiveCss = fs.readFileSync(responsivePath, 'utf8');
    const boardPath = path.join(__dirname, '..', 'styles-board.css');
    const boardCss = fs.readFileSync(boardPath, 'utf8');
    const cardsPath = path.join(__dirname, '..', 'styles-cards.css');
    const cardsCss = fs.readFileSync(cardsPath, 'utf8');

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
    expect(varsCss).toMatch(/--layout-anchor-card-detail-width:\s*320px/);
    expect(varsCss).toMatch(/--layout-anchor-card-detail-gap:\s*28px/);
    expect(varsCss).toMatch(/--layout-anchor-card-detail-bottom:\s*170px/);
    expect(varsCss).toMatch(/--layout-anchor-chat-left:\s*132px/);
    expect(varsCss).toMatch(/--layout-anchor-character-offset-y:\s*48px/);
    expect(varsCss).toMatch(/--layout-cpu-image-scale:\s*1\.1/);
    expect(varsCss).toMatch(/--layout-priority-board-scale:\s*1/);
    expect(varsCss).toMatch(/--layout-priority-deck-scale:\s*1/);
    expect(varsCss).toMatch(/--layout-priority-hand-scale:\s*1/);
    expect(varsCss).toMatch(/--layout-priority-card-detail-scale:\s*1/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3\s*\{/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-anchor-board-size:\s*540px/);
    expect(varsCss).toMatch(/html\.layout-profile-tablet-4x3[\s\S]*--layout-anchor-card-detail-gap:\s*0px/);
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
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*position:\s*fixed/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*--layout-stage-bottom-safe-shift/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*gap:\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-btn[\s\S]*min-width:\s*calc\(96px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/\.observation-stone-icon[\s\S]*観測石\.png/);
    expect(layoutCss).toMatch(/\.result-observation-stone-text/);
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
    expect(layoutCss).toMatch(/#networkChatPanel[\s\S]*--layout-anchor-chat-left/);
    expect(layoutCss).toMatch(/#hero-character-img[\s\S]*--layout-anchor-character-offset-y/);
    expect(layoutCss).toMatch(/#cpu-character-img[\s\S]*--layout-cpu-image-scale/);
    expect(layoutCss).toMatch(/\.charge-display[\s\S]*font-size:\s*var\(--layout-size-charge-font\)/);
    expect(layoutCss).toMatch(/#charge-black[\s\S]*bottom:\s*var\(--layout-size-charge-offset\)/);
    expect(layoutCss).toMatch(/#charge-white \.time-stop-status-badge[\s\S]*bottom:\s*calc\(100%\s*\+\s*\(6px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*transform:\s*translateY\(var\(--layout-size-charge-delta-shift-y-start\)\)/);
    expect(layoutCss).toMatch(/\.charge-delta[\s\S]*-webkit-text-stroke/);
    expect(layoutCss).toMatch(/\.hand-container\.time-stop-hand-overlay-active[\s\S]*padding-top:\s*calc\(32px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/@keyframes\s+round-bonus-banner-slide-down/);
    expect(layoutCss).toMatch(/@keyframes\s+round-bonus-banner-fade-out/);
    expect(layoutCss).toMatch(/#round-display-panel\.is-round-bonus-active[\s\S]*animation:\s*round-bonus-banner-slide-down/);
    expect(layoutCss).toMatch(/#round-display-panel\.is-round-bonus-active\.is-round-bonus-fading[\s\S]*animation:\s*round-bonus-banner-fade-out/);
    expect(layoutCss).toMatch(/#round-display-panel\.is-round-bonus-active[\s\S]*min-height:\s*calc\(52px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*left:\s*var\(--profile-stone-info-left\)/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*top:\s*calc\(var\(--layout-stage-offset-y\)\s*\+\s*\(var\(--layout-anchor-effect-top\)\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(boardCss).toMatch(/\.stone-info-panel[\s\S]*transform:\s*translateY\(calc\(-100%\s*-\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#stone-info-panel[\s\S]*transform:\s*translateX\(-50%\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#stone-info-panel[\s\S]*left:\s*var\(--profile-stone-info-left\)/);
    expect(cardsCss).toMatch(/\.deck-stack[\s\S]*width:\s*calc\(var\(--layout-size-deck-width\)\s*\*\s*var\(--layout-priority-deck-scale\)\)/);
    expect(cardsCss).toMatch(/\.deck-stack::before[\s\S]*linear-gradient\(135deg,\s*#3d2e20 0%,\s*#24160d 52%,\s*#1a0f08 100%\)/);
    expect(cardsCss).toMatch(/\.card-item[\s\S]*width:\s*var\(--layout-size-card-width\)/);
    expect(cardsCss).toMatch(/\.card-badge-row[\s\S]*left:\s*0[\s\S]*right:\s*0[\s\S]*bottom:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(cardsCss).toMatch(/\.card-cost-badge[\s\S]*top:\s*calc\(var\(--layout-size-card-badge-offset\)\s*-\s*\(1px\s*\*\s*var\(--layout-stage-scale\)\)\)[\s\S]*left:\s*calc\(var\(--layout-size-card-badge-offset\)\s*-\s*\(1px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(cardsCss).toMatch(/\.card-name[\s\S]*padding:[\s\S]*var\(--layout-size-card-badge-font\)/);
    expect(cardsCss).toMatch(/#hand-black \.card-item[\s\S]*width:\s*calc\(var\(--layout-size-card-large-width\)\s*\*\s*var\(--layout-priority-hand-scale\)\)/);
    expect(cardsCss).toMatch(/#hand-black \.card-item \.card-cost-badge[\s\S]*top:\s*var\(--layout-size-card-badge-large-offset\)[\s\S]*left:\s*var\(--layout-size-card-badge-large-offset\)/);
    expect(cardsCss).toMatch(/#hand-black \.card-item \.card-name[\s\S]*padding-top:\s*calc\(var\(--layout-size-card-badge-large-font\)/);
    expect(cardsCss).toMatch(/\.flying-card[\s\S]*width:\s*var\(--layout-size-card-width\)/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*width:\s*calc\(var\(--layout-anchor-card-detail-width\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-card-detail-scale\)\)/);
    expect(cardsCss).toMatch(/#card-detail-panel[\s\S]*--layout-anchor-card-detail-bottom/);
    expect(responsiveCss).toMatch(/html\.layout-profile-tablet-4x3\.layout-stage-enabled\s+#card-detail-panel[\s\S]*right:\s*calc\(var\(--layout-stage-offset-x\)\s*\+\s*max\(var\(--layout-anchor-side-right\),\s*env\(safe-area-inset-right\)\)\)/);
    expect(responsiveCss).not.toMatch(/#hand-black\s+\.card-item\s+\.card-badge-row\s+\.card-cost-badge/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#hand-black\s+\.card-item\s+\.card-cost-badge[\s\S]*top:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*left:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#hand-black\s+\.card-item\s+\.card-cost-badge[\s\S]*top:\s*var\(--layout-size-card-badge-large-offset\)[\s\S]*left:\s*var\(--layout-size-card-badge-large-offset\)/);
    expect(responsiveCss).toMatch(/@media\s*\(max-width:\s*(?:900px|56\.25em)\)\s*\{[\s\S]*#leftActionButtons[\s\S]*bottom:/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#leftActionButtons[\s\S]*bottom:/);
    expect(responsiveCss).toMatch(/@media\s*\(max-width:\s*(?:900px|56\.25em)\)\s*\{[\s\S]*#gachaRevealSkipBtn/);
    expect(cardsCss).not.toMatch(/#card-detail-panel\s*>\s*#card-detail-header[\s\S]*scale\(0\.8333333,\s*0\.9803922\)/);
    expect(cardsCss).toMatch(/\.heaven-blessing-offers \.heaven-offer-card[\s\S]*width:\s*var\(--layout-size-card-width\)/);
  });
});
