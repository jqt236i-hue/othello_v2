import {
  readLayoutCssSurface,
  readRepoTextFile,
} from './helpers/css-test-helpers';

describe('left action rail layout contract', () => {
  test('left action rail keeps vertical fixed desktop layout', () => {
    const layoutCss = readLayoutCssSurface();

    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*position:\s*fixed/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*top:\s*calc\(var\(--layout-stage-offset-y\)\s*\+\s*max\(calc\(148px\s*\*\s*var\(--layout-stage-scale\)\),\s*env\(safe-area-inset-top\)\s*\+\s*calc\(20px\s*\*\s*var\(--layout-stage-scale\)\)\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*padding:\s*calc\(42px\s*\*\s*var\(--layout-stage-scale\)\)\s*calc\(10px\s*\*\s*var\(--layout-stage-scale\)\)\s*calc\(14px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*gap:\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*flex-direction:\s*column/);
    expect(layoutCss).toMatch(/#leftActionButtons[\s\S]*background:\s*linear-gradient/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-btn[\s\S]*min-width:\s*calc\(96px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-btn[\s\S]*grid-template-rows/);
    expect(layoutCss).toMatch(/#leftActionButtons\s+\.left-action-icon[\s\S]*mask-image/);
  });

  test('left action rail exposes mode and utility buttons in index markup', () => {
    const html = readRepoTextFile('index.html');

    expect(html).toMatch(/id="leftActionButtons"[\s\S]*id="modeCpuBtn"[\s\S]*id="modeReversiBtn"[\s\S]*id="modeNetworkBtn"/);
    expect(html).toMatch(/id="leftActionButtons"[\s\S]*id="sidePanelToggleBtn"[\s\S]*>設定</);
    expect(html).toMatch(/class="left-action-icon left-action-icon-gacha"/);
    expect(html).toMatch(/class="left-action-icon left-action-icon-deck"/);
    expect(html).toMatch(/class="left-action-icon left-action-icon-ranking"/);
  });

  test('responsive rail overrides remain explicit', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-stage-enabled\s+#leftActionButtons[\s\S]*top:\s*max\(calc\(240px\s*\*\s*var\(--layout-stage-scale\)\),\s*env\(safe-area-inset-top\)\s*\+\s*calc\(12px\s*\*\s*var\(--layout-stage-scale\)\)\)\s*!important/);
    expect(responsiveCss).toMatch(/@media\s*\(max-width:\s*(?:900px|56\.25em)\)\s*\{[\s\S]*#leftActionButtons[\s\S]*top:/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#leftActionButtons[\s\S]*bottom:/);
  });
});
