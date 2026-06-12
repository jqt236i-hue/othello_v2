import { readRepoTextFile } from './helpers/css-test-helpers';

describe('mobile quick controls layout contract', () => {
  test('phone portrait exposes the quick controls bar as a compact horizontal tray', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-player-bottom-offset:\s*calc\(18px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-quick-controls-bottom-offset:\s*calc\(44px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-quick-controls-width:\s*min\(92vw,\s*calc\(520px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#game-container[\s\S]*padding-bottom:\s*calc\(max\(calc\(8px\s*\*\s*var\(--layout-stage-scale\)\),\s*env\(safe-area-inset-bottom\)\)\s*\+\s*calc\(102px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#info-panel\s+\.brand-wordmark[\s\S]*display:\s*none/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#quick-controls-bar[\s\S]*display:\s*flex/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#quick-controls-bar[\s\S]*bottom:\s*calc\(max\(calc\(8px\s*\*\s*var\(--layout-stage-scale\)\),\s*env\(safe-area-inset-bottom\)\)\s*\+\s*var\(--layout-phone-portrait-quick-controls-bottom-offset\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#quick-controls-bar[\s\S]*overflow-x:\s*auto/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#quick-controls-bar::before[\s\S]*display:\s*none/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#quickBgmTrackPicker\.quick-bgm-track-picker[\s\S]*width:\s*var\(--layout-phone-portrait-quick-controls-bgm-width\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+\.quick-volume-label[\s\S]*display:\s*none/);
  });
});
