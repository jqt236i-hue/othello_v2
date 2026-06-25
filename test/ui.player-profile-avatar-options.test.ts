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
    const visualMap = require('../game/visual-effects-map.runtime.js');
    const optionTypes = avatarOptions.getProfileAvatarOptions().map((option: any) => option.stoneType);
    const duplicateAliases = new Set(['TRAP_REVEAL']);
    const requiredTypes = Object.keys(visualMap.SPECIAL_TYPE_TO_EFFECT_KEY)
      .filter((type) => !duplicateAliases.has(type));

    expect(optionTypes).toEqual(expect.arrayContaining(requiredTypes));
    expect(optionTypes).not.toContain('TRAP_REVEAL');
  });

  test('normalizes avatar stone type with REGEN fallback', () => {
    const avatarOptions = require('../ui/player-profile-avatar-options.js');

    expect(avatarOptions.normalizeProfileAvatarStoneType('sniper')).toBe('SNIPER');
    expect(avatarOptions.normalizeProfileAvatarStoneType('afterimage_will')).toBe('AFTERIMAGE_WILL');
    expect(avatarOptions.normalizeProfileAvatarStoneType('unknown')).toBe('REGEN');
    expect(avatarOptions.normalizeProfileAvatarStoneType('')).toBe('REGEN');
  });
});
