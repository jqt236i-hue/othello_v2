import {
  readLayoutCssSurface,
  readRepoTextFile,
} from './helpers/css-test-helpers';

describe('left info stack layout contract', () => {
  test('left info stack and manifest panel exist in index markup', () => {
    const html = readRepoTextFile('index.html');

    expect(html).toMatch(/id="left-info-stack"/);
    expect(html).toMatch(/id="manifest-effect-panel"/);
  });

  test('desktop left info stack uses anchored layout hooks', () => {
    const layoutCss = readLayoutCssSurface();
    const varsCss = readRepoTextFile('styles-variables.css');

    expect(layoutCss).toMatch(/#left-info-stack[\s\S]*display:\s*contents/);
    expect(layoutCss).toMatch(/#manifest-effect-panel[\s\S]*#manifest-effect-panel\.is-visible/);
    expect(varsCss).toMatch(/--layout-anchor-left-info-stack-top/);
  });

  test('responsive left info stack overrides stay explicit', () => {
    const responsiveCss = readRepoTextFile('styles-responsive.css');

    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#manifest-effect-panel/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#left-info-stack[\s\S]*display:\s*flex/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#left-info-stack\s*>\s*#effect-live-panel,[\s\S]*#left-info-stack\s*>\s*#manifest-effect-panel[\s\S]*position:\s*static/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#stone-info-panel[\s\S]*position:\s*fixed/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#stone-info-panel[\s\S]*top:\s*calc\(var\(--profile-effect-top\)\s*\+\s*var\(--profile-effect-min-height\)\s*\+\s*calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#stone-info-panel[\s\S]*transform:\s*none/);
    expect(responsiveCss).toMatch(/html\.layout-stage-enabled:not\(\.layout-profile-phone-portrait\)\s+#manifest-effect-panel[\s\S]*max-height:\s*calc\(164px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(responsiveCss).toMatch(/html\.layout-profile-phone-portrait\s+#stone-info-panel[\s\S]*transform:\s*translateX\(-50%\)/);
  });
});
