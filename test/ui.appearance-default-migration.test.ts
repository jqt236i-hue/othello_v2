import { JSDOM } from 'jsdom';
import migration = require('../ui/storage/appearance-default-migration');

const previous = {
  handSkin: 'custom-hand', backgroundSkin: 'default-25', boardSkin: 'bluegreen-felt',
  boardFrameSkin: 'submerged-wood', handMatSkin: 'espresso-leather',
  fontSkin: 'dotgothic16', stoneSkin: 'default'
};

describe('standard appearance adoption for existing browsers', () => {
  let dom: JSDOM;
  beforeEach(() => { dom = new JSDOM('<html><body><div id="board"></div><div id="board-frame"></div></body></html>', { url: 'https://example.test/' }); });
  afterEach(() => { dom.window.close(); });

  test.each(['reversi', 'othello', 'both'])('adopts all seven defaults from %s keys without any preset', (namespace) => {
    for (const [field, value] of Object.entries(previous)) {
      for (const prefix of namespace === 'both' ? ['reversi', 'othello'] : [namespace]) {
        dom.window.localStorage.setItem(`${prefix}.${field}`, value);
      }
    }
    dom.window.localStorage.setItem('reversi.backgroundSkin.version', '2');
    dom.window.localStorage.setItem('reversi.stoneSkin.version', '2');
    dom.window.localStorage.setItem('reversi.gacha.progress.v1', '{"coins":123}');
    dom.window.localStorage.setItem('reversi.appearancePresets', '{"presets":[]}');
    dom.window.localStorage.setItem('soundVolume', '0.4');

    expect(migration.migrateStandardAppearance(dom.window)).toBe(true);
    for (const [field, value] of Object.entries(migration.STANDARD_APPEARANCE)) {
      expect(dom.window.localStorage.getItem(`reversi.${field}`)).toBe(value);
      expect(dom.window.localStorage.getItem(`othello.${field}`)).toBe(value);
    }
    expect(dom.window.localStorage.getItem('reversi.gacha.progress.v1')).toBe('{"coins":123}');
    expect(dom.window.localStorage.getItem('reversi.appearancePresets')).toBe('{"presets":[]}');
    expect(dom.window.localStorage.getItem('soundVolume')).toBe('0.4');
    expect(migration.migrateStandardAppearance(dom.window)).toBe(false);
  });

  test('does not reset a later intentional choice on repeated boots', () => {
    migration.migrateStandardAppearance(dom.window);
    dom.window.localStorage.setItem('reversi.backgroundSkin', 'default-25');
    dom.window.localStorage.setItem('reversi.boardFrameSkin', 'submerged-wood');
    expect(migration.migrateStandardAppearance(dom.window)).toBe(false);
    expect(dom.window.localStorage.getItem('reversi.backgroundSkin')).toBe('default-25');
    expect(dom.window.localStorage.getItem('reversi.boardFrameSkin')).toBe('submerged-wood');
  });

  test('new installs use catalog defaults without manufacturing a saved preset or selection', () => {
    expect(migration.migrateStandardAppearance(dom.window)).toBe(true);
    expect(dom.window.localStorage.length).toBe(1);
    expect(dom.window.localStorage.getItem(migration.STANDARD_APPEARANCE_VERSION_KEY)).toBe(migration.STANDARD_APPEARANCE_VERSION);
  });

  test('storage-disabled browsers can still start', () => {
    const root = { get localStorage(): Storage { throw new Error('blocked'); } };
    expect(() => migration.migrateStandardAppearance(root)).not.toThrow();
    expect(migration.migrateStandardAppearance(null)).toBe(false);
  });

  test('a failed migration is retried instead of being marked complete', () => {
    dom.window.localStorage.setItem('reversi.backgroundSkin', 'default-25');
    const spy = jest.spyOn(Object.getPrototypeOf(dom.window.localStorage), 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(migration.migrateStandardAppearance(dom.window)).toBe(false);
    expect(dom.window.localStorage.getItem(migration.STANDARD_APPEARANCE_VERSION_KEY)).toBeNull();
    spy.mockRestore();
    expect(migration.migrateStandardAppearance(dom.window)).toBe(true);
    expect(dom.window.localStorage.getItem('reversi.backgroundSkin')).toBe('desk-quiet-fantasy');
  });

  test('real bootstrap migrates before restoring the initial board without opening the panel', async () => {
    jest.resetModules();
    dom.window.localStorage.setItem('reversi.backgroundSkin', 'default-25');
    dom.window.localStorage.setItem('reversi.boardFrameSkin', 'submerged-wood');
    dom.window.localStorage.setItem('reversi.boardSkin', 'bluegreen-felt');
    const bootstrap = require('../ui/bootstrap.ts');
    bootstrap.initializeUIBootstrapRuntime(dom.window);
    await bootstrap.prepareInitialBoardFrameSkin(dom.window);
    expect(dom.window.document.documentElement.dataset.boardSkinId).toBe('study-forest-baize');
    expect(dom.window.document.documentElement.dataset.boardFrameSkinId).toBe('study-ebony-jade');
    expect(dom.window.localStorage.getItem('reversi.backgroundSkin')).toBe('desk-quiet-fantasy');
    expect(dom.window.document.querySelector('#handSkinPanel')).toBeNull();
  });
});
