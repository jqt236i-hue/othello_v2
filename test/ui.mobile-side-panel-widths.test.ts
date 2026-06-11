import { readRepoTextFile } from './helpers/css-test-helpers';

describe('mobile auxiliary panel width contract', () => {
  test('phone portrait uses a compact shared width for cpu and network panels', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-main-column-width:\s*min\(calc\(430px\s*\*\s*var\(--layout-stage-scale\)\),\s*96vw\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s*\{[\s\S]*--layout-phone-portrait-aux-panel-width:\s*min\(calc\(360px\s*\*\s*var\(--layout-stage-scale\)\),\s*88vw\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#control-panel[\s\S]*width:\s*var\(--layout-phone-portrait-aux-panel-width\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#networkChatPanel[\s\S]*width:\s*var\(--layout-phone-portrait-aux-panel-width\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#networkModal[\s\S]*width:\s*var\(--layout-phone-portrait-aux-panel-width\)/);
  });
});
