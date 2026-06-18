import { readRepoTextFile } from './helpers/css-test-helpers';

function readCssRuleBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  return match ? match[1] : '';
}

describe('network room list style', () => {
  test('観戦ボタンは参加ボタンより軽い secondary action として表示する', () => {
    const css = readRepoTextFile('styles-layout-info.css');
    const spectateBlock = readCssRuleBlock(css, '.network-room-entry-spectate');

    expect(spectateBlock).toMatch(/border-color:\s*rgba\(83,\s*214,\s*209,\s*0\.28\)/);
    expect(spectateBlock).toMatch(/background:\s*rgba\(83,\s*214,\s*209,\s*0\.08\)/);
    expect(spectateBlock).toMatch(/color:\s*rgba\(184,\s*236,\s*231,\s*0\.9\)/);
    expect(spectateBlock).toMatch(/box-shadow:\s*inset\s+0\s+0\s+0\s+calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)\s+rgba\(83,\s*214,\s*209,\s*0\.08\)/);
    expect(css).not.toMatch(/#networkJoinBtn,\s*\.network-room-entry-join,\s*\.network-room-entry-spectate/);
  });
});
