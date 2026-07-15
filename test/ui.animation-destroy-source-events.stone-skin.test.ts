import { JSDOM } from 'jsdom';

describe('destroy source animation stone skin visuals', () => {
  let dom: JSDOM;

  function installDom() {
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    (dom.window.Element.prototype as any).animate = jest.fn(() => ({ finished: Promise.resolve() }));
    document.documentElement.style.setProperty('--normal-stone-black-image', 'url("assets/images/stone-skin/o-stone/black.png")');
    document.documentElement.style.setProperty('--normal-stone-white-image', 'url("assets/images/stone-skin/o-stone/white.png")');
  }

  function makeDeps(observedBackgroundImages: string[]) {
    const fromRect = {
      left: 20,
      top: 30,
      width: 80,
      height: 80,
      right: 100,
      bottom: 110,
      x: 20,
      y: 30,
      toJSON: () => ({})
    } as DOMRect;
    const toRect = {
      left: 220,
      top: 230,
      width: 80,
      height: 80,
      right: 300,
      bottom: 310,
      x: 220,
      y: 230,
      toJSON: () => ({})
    } as DOMRect;

    return {
      isNoAnim: () => false,
      getCellClientRect: (row: number, col: number) => (row === 1 && col === 1 ? fromRect : toRect),
      resolveSniperSource: () => ({ row: 1, col: 1 }),
      resolveRobotVacuumSource: () => ({ row: 1, col: 1 }),
      resolveDestroyDragonSource: () => ({ row: 1, col: 1 }),
      waitForAnimationFinish: jest.fn(async () => {
        const projectile = Array.from(document.body.children)
          .map((element) => element as HTMLElement)
          .find((element) => element.style.backgroundImage);
        observedBackgroundImages.push(projectile ? projectile.style.backgroundImage : '');
      }),
      sleep: jest.fn(async () => undefined),
      timer: () => ({
        setTimeout: (fn: () => void) => {
          fn();
          return 0;
        },
        clearTimeout: jest.fn()
      }),
      playbackScope: {}
    };
  }

  beforeEach(() => {
    jest.resetModules();
    installDom();
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close();
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).getComputedStyle;
  });

  test('sniper projectile uses the selected black normal stone skin', async () => {
    const mod = require('../ui/animation-destroy-source-events.js');
    const observedBackgroundImages: string[] = [];

    await mod.animateSniperProjectile({ r: 2, col: 2, projectileOwner: 'black' }, makeDeps(observedBackgroundImages));

    expect(observedBackgroundImages[0]).toContain('assets/images/stone-skin/o-stone/black.png');
  });

  test('robot vacuum suction uses the selected white normal stone skin', async () => {
    const mod = require('../ui/animation-destroy-source-events.js');
    const observedBackgroundImages: string[] = [];

    await mod.animateRobotVacuumSuction({ r: 2, col: 2, ownerBefore: 'white' }, makeDeps(observedBackgroundImages));

    expect(observedBackgroundImages[0]).toContain('assets/images/stone-skin/o-stone/white.png');
  });
});
