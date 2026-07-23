import {
  readNetworkResponsiveCssSurface,
  readRepoTextFile,
} from './helpers/css-test-helpers';

describe('mobile auxiliary panel width contract', () => {
  test('phone portrait uses a compact shared width for cpu and network panels', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');
    const networkResponsiveCss = readNetworkResponsiveCssSurface();

    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-main-column-width:\s*min\(calc\(430px\s*\*\s*var\(--layout-stage-scale\)\),\s*96vw\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-aux-panel-width:\s*min\(calc\(360px\s*\*\s*var\(--layout-stage-scale\)\),\s*88vw\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#control-panel[\s\S]*width:\s*var\(--layout-phone-portrait-aux-panel-width\)/);
    expect(networkResponsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#networkChatPanel[\s\S]*width:\s*var\(--layout-phone-portrait-aux-panel-width\)/);
    expect(networkResponsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#networkModal[\s\S]*width:\s*var\(--layout-phone-portrait-aux-panel-width\)/);
  });

  test('phone portrait offsets the player bottom stack and equalizes the bottom rail buttons', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-player-bottom-offset:\s*calc\(18px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-rail-button-width:\s*calc\(54px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+\.player-area-bottom[\s\S]*margin-top:\s*var\(--layout-phone-portrait-player-bottom-offset\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#leftActionButtons[\s\S]*max-height:\s*none/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#leftActionButtons\s+\.left-action-btn[\s\S]*flex:\s*0\s+0\s+var\(--layout-phone-portrait-rail-button-width\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#leftActionButtons\s+\.left-action-btn[\s\S]*width:\s*var\(--layout-phone-portrait-rail-button-width\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#leftActionButtons\s+\.left-action-btn[\s\S]*min-width:\s*var\(--layout-phone-portrait-rail-button-width\)/);
  });
});
