import { readRepoTextFile } from './helpers/css-test-helpers';

describe('mobile quick controls layout contract', () => {
  test('phone portrait replaces the horizontal quick tray with one bottom-sheet trigger', () => {
    const mobileCss = readRepoTextFile('styles-mobile-command-surface.css');
    const classicHtml = readRepoTextFile('index.classic.html');

    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+:is\(\s*#leftActionButtons,\s*#quick-controls-bar\s*\)[\s\S]*display:\s*none\s*!important/);
    expect(mobileCss).toMatch(/\.mobile-command-quick-trigger\s*\{[\s\S]*display:\s*none/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+\.player-area-bottom\s+\.mobile-command-quick-trigger[\s\S]*position:\s*absolute[\s\S]*right:\s*0[\s\S]*bottom:\s*calc\(62px\s*\*\s*var\(--layout-stage-scale\)\)[\s\S]*width:\s*44px[\s\S]*height:\s*44px/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\.mobile-command-surface-locked\s+\.mobile-command-quick-trigger[\s\S]*visibility:\s*hidden[\s\S]*pointer-events:\s*none/);
    expect(mobileCss).toMatch(/html\.layout-profile-phone-portrait\s+\.mobile-command-quick-sheet[\s\S]*max-height:\s*min\(78dvh,\s*620px\)[\s\S]*transform:\s*translateY\(102%\)/);
    expect(mobileCss).toMatch(/#mobile-command-surface\.is-quick-open\s+\.mobile-command-quick-sheet[\s\S]*transform:\s*translateY\(0\)/);
    expect(mobileCss).toMatch(/\.mobile-command-quick-grid[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileCss).toMatch(/\.mobile-command-bgm-select[\s\S]*grid-column:\s*1\s*\/\s*-1/);
    expect(mobileCss).toMatch(/\.mobile-command-volume[\s\S]*grid-column:\s*1\s*\/\s*-1/);
    expect(mobileCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(classicHtml).toMatch(/styles-responsive\.css[\s\S]*styles-mobile-command-surface\.css/);
  });
});
