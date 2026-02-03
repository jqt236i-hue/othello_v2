const fs = require('fs');
const path = require('path');

describe('game ↔ UI boundary (headless)', () => {
  afterEach(() => {
    // Ensure module cache is cleared between tests
    jest.resetModules();
    try { delete global.__uiImpl; } catch (e) { /* ignore */ }
  });

  test('game/visual-effects-map exports DI and delegates when implanted', () => {
    const vmap = require('../game/visual-effects-map');
    expect(typeof vmap.setUIImpl).toBe('function');
    expect(typeof vmap.applyStoneVisualEffect).toBe('function');

    // Without UI impl, should be a safe no-op/undefined
    expect(vmap.applyStoneVisualEffect(undefined, 'goldStone')).toBeUndefined();

    // With mock UI impl, delegation should occur
    const mock = {
      applyStoneVisualEffect: jest.fn(() => 'ok'),
      removeStoneVisualEffect: jest.fn(() => 'ok')
    };
    vmap.setUIImpl(mock);
    expect(vmap.applyStoneVisualEffect({}, 'goldStone')).toBe('ok');
    expect(mock.applyStoneVisualEffect).toHaveBeenCalled();

    // restore
    vmap.setUIImpl({});
  });

  test('game/move-executor-visuals exports DI and delegates when implanted', () => {
    const mv = require('../game/move-executor-visuals');
    expect(typeof mv.setUIImpl).toBe('function');
    expect(typeof mv.applyFlipAnimations).toBe('function');

    // No UI -> safe no-op
    expect(mv.applyFlipAnimations([])).toBeUndefined();

    // With mock: note the module checks both module-local and global __uiImpl
    const mock = { applyFlipAnimations: jest.fn(() => 'flip-ok') };
    mv.setUIImpl(mock);
    // Also populate legacy global hook to emulate bootstrap behavior
    global.__uiImpl = mock;

    expect(mv.applyFlipAnimations([])).toBe('flip-ok');
    expect(mock.applyFlipAnimations).toHaveBeenCalled();

    // restore
    mv.clearUIImpl && mv.clearUIImpl();
    try { delete global.__uiImpl; } catch (e) {}
  });

  test('turn-manager loads safely and cooperates with ui/bootstrap registerUIGlobals', () => {
    jest.resetModules();
    const registerMock = jest.fn();
    // Provide a mock ui/bootstrap before requiring the module
    jest.doMock('../ui/bootstrap', () => ({ registerUIGlobals: registerMock }));

    const tm = require('../game/turn-manager');
    expect(typeof tm.setUIImpl).toBe('function');

    // turn-manager attempts to register resetGame on bootstrap; ensure it called safely
    expect(registerMock).toHaveBeenCalled();
  });

  test('static scan: game/ does not contain direct DOM API usages', () => {
    const forbidden = [
      'document.querySelector',
      'document.getElementById',
      'document.querySelectorAll',
      'document.createElement',
      'document.getElementsByClassName'
    ];

    function listJsFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const out = [];
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...listJsFiles(p));
        else if (e.isFile() && p.endsWith('.js')) out.push(p);
      }
      return out;
    }

    const gameDir = path.join(__dirname, '..', 'game');
    const files = listJsFiles(gameDir);
    const hits = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      for (const pat of forbidden) {
        if (content.indexOf(pat) !== -1) hits.push({ file: path.relative(process.cwd(), f), pattern: pat });
      }
    }

    expect(hits).toEqual([]);
  });
});