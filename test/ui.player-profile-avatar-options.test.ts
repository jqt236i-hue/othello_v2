describe('player profile avatar options', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('builds avatar options from existing special-stone visuals', () => {
    const avatarOptions = require('../ui/player-profile-avatar-options.js');
    const options = avatarOptions.getProfileAvatarOptions();

    expect(options.length).toBeGreaterThan(8);
    expect(options[0]).toMatchObject({
      id: 'stone:REGEN',
      stoneType: 'REGEN',
      label: '復活石'
    });
    expect(options[0].imagePath).toContain('assets/images/special-stones/');
    expect(options.some((option: any) => option.stoneType === 'SNIPER' && option.label === '狙撃石')).toBe(true);
  });

  test('offers every implemented special-stone visual marker type as a profile avatar', () => {
    const avatarOptions = require('../ui/player-profile-avatar-options.js');
    const visualMap = require('../game/visual-effects-map');
    const optionTypes = avatarOptions.getProfileAvatarOptions().map((option: any) => option.stoneType);
    const supportedTypes = Object.keys(visualMap.SPECIAL_TYPE_TO_EFFECT_KEY);

    expect(supportedTypes).toEqual(expect.arrayContaining(optionTypes));
    expect(optionTypes).not.toContain('TRAP_REVEAL');
  });

  test('normalizes avatar stone type with REGEN fallback', () => {
    const avatarOptions = require('../ui/player-profile-avatar-options.js');

    expect(avatarOptions.normalizeProfileAvatarStoneType('sniper')).toBe('SNIPER');
    expect(avatarOptions.normalizeProfileAvatarStoneType('afterimage_will')).toBe('AFTERIMAGE_WILL');
    expect(avatarOptions.normalizeProfileAvatarStoneType('unknown')).toBe('REGEN');
    expect(avatarOptions.normalizeProfileAvatarStoneType('')).toBe('REGEN');
  });

  test('fallback paths still resolve to real runtime images when the visual map is unavailable', () => {
    jest.doMock('../ui/visual-effects-map', () => ({}));
    try {
      const avatarOptions = require('../ui/player-profile-avatar-options');
      const fs = require('node:fs');
      const path = require('node:path');
      const options = avatarOptions.getProfileAvatarOptions();
      expect(options.find((option: any) => option.stoneType === 'ULTIMATE_HYPERACTIVE').imagePath)
        .toBe('assets/images/special-stones/ULTIMATE_HYPERACTIVE_GOD-black.png');
      for (const option of options) expect(fs.existsSync(path.resolve(option.imagePath))).toBe(true);
    } finally { jest.dontMock('../ui/visual-effects-map'); }
  });
});
