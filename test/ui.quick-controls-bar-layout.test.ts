import * as fs from 'fs';
import * as path from 'path';

describe('quick controls bar layout', () => {
  test('desktop layout anchors quick controls near the bottom edge', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#quick-controls-bar[\s\S]*bottom:\s*calc\(var\(--layout-stage-offset-y\)/);
    expect(css).toMatch(/#quick-controls-bar[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/#quick-controls-bar[\s\S]*display:\s*grid/);
    expect(css).toMatch(/#quick-controls-bar[\s\S]*grid-template-areas:[\s\S]*"reset bgmtoggle bgmtrack bgmtrack"[\s\S]*"autobtn mute volume volume"/);
  });

  test('quick controls use console styling with stateful buttons and readable volume slider', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-controls.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#quick-controls-bar[\s\S]*clip-path:\s*polygon\(/);
    expect(css).toMatch(/#quick-controls-bar[\s\S]*backdrop-filter:\s*blur/);
    expect(css).toMatch(/#quick-controls-bar::before[\s\S]*linear-gradient\(90deg,\s*transparent,\s*rgba\(255,\s*224,\s*132/);
    expect(css).toMatch(/#resetBtn\.quick-control-btn[\s\S]*--quick-control-accent:\s*#ff8a7a/);
    expect(css).toMatch(/#resetBtn\.quick-control-btn[\s\S]*grid-area:\s*reset/);
    expect(css).toMatch(/#resetBtn\.quick-control-btn[\s\S]*min-width:\s*calc\(92px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/#autoToggleBtn\.quick-control-btn[\s\S]*--quick-control-accent:\s*#f2c95f/);
    expect(css).toMatch(/#autoToggleBtn\.quick-control-btn[\s\S]*grid-area:\s*autobtn/);
    expect(css).toMatch(/#muteBtn\.quick-control-btn[\s\S]*--quick-control-accent:\s*#7ed7ff/);
    expect(css).toMatch(/#muteBtn\.quick-control-btn[\s\S]*grid-area:\s*mute/);
    expect(css).toMatch(/#quickBgmToggleBtn\.quick-control-btn[\s\S]*grid-area:\s*bgmtoggle/);
    expect(css).toMatch(/#quickBgmToggleBtn\.quick-control-btn[\s\S]*--quick-control-accent:\s*#7ed7ff/);
    expect(css).toMatch(/#quickBgmTrackPicker\.quick-bgm-track-picker[\s\S]*grid-area:\s*bgmtrack/);
    expect(css).toMatch(/#quickBgmTrackMenu\.quick-bgm-track-menu[\s\S]*background:[\s\S]*rgba\(40,\s*31,\s*20,\s*0\.98\)/);
    expect(css).toMatch(/\.quick-bgm-track-option:hover[\s\S]*background:[\s\S]*rgba\(217,\s*192,\s*138,\s*0\.28\)/);
    expect(css).not.toMatch(/quick-bgm[\s\S]*#[0-9a-fA-F]{0,4}268d/);
    expect(css).toMatch(/\.quick-volume-control[\s\S]*grid-area:\s*volume/);
    expect(css).toMatch(/input\[type=range\]\.compact-slider\.quick-volume-slider[\s\S]*background:[\s\S]*linear-gradient\(90deg,\s*rgba\(242,\s*201,\s*95/);
    expect(css).toMatch(/input\[type=range\]\.compact-slider\.quick-volume-slider::-webkit-slider-thumb[\s\S]*box-shadow:/);
  });

  test('quick controls expose a BGM-only toggle and the settings panel exposes the log toggle', () => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const quickControls = html.match(/<div id="quick-controls-bar"[\s\S]*?<\/div>/)?.[0] || '';

    expect(quickControls).toMatch(/<button id="quickBgmToggleBtn"[\s\S]*>BGM: ON<\/button>/);
    expect(quickControls).not.toMatch(/<button id="logToggleBtn"/);
    expect(html).toMatch(/<div id="control-panel"[\s\S]*<button id="logToggleBtn"[\s\S]*>ログ<\/button>/);
    expect(html).toMatch(/id="logToggleBtn"[\s\S]*aria-controls="log"[\s\S]*aria-expanded="false"/);
  });

  test('quick controls expose a subdued BGM track selector above the volume slider', () => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toMatch(/<div id="quick-controls-bar"[\s\S]*<div id="quickBgmTrackPicker" class="quick-bgm-track-picker">[\s\S]*<div id="quickBgmTrackMenu" class="quick-bgm-track-menu" role="listbox" aria-label="BGM変更"><\/div>[\s\S]*<label class="quick-volume-control"/);
  });

  test('battle log is opened only by the user log toggle state', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-info.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#log\s*\{[\s\S]*display:\s*none/);
    expect(css).toMatch(/#log\.is-log-open\s*\{[\s\S]*display:\s*block/);
    expect(css).not.toMatch(/#log\.is-visible\s*\{[\s\S]*display:\s*block/);
  });
});
