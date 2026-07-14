import { JSDOM } from 'jsdom';
import {
  installModuleBridge,
  registerModuleAccessors,
  requireBundledModule,
  resetModuleBridgeForTests
} from '../browser-vite/module-bridge';

describe('Vite bundled module bridge', () => {
  beforeEach(() => resetModuleBridgeForTests());

  test('resolves legacy relative/dist aliases while Vite accessors own export identity', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const exported = { default: { value: 1 }, named: 'ok' };
    const accessor = jest.fn(() => exported);
    registerModuleAccessors({ 'ui/example': accessor }, { 'legacy/example': 'ui/example' }, 'startup');
    installModuleBridge(dom.window as any);

    expect((dom.window as any).require('./dist/ui/example')).toBe(exported);
    expect((dom.window as any).require('../example.js', 'ui/nested')).toBe(exported);
    expect(requireBundledModule('legacy/example')).toBe(exported);
    expect(accessor).toHaveBeenCalledTimes(3);
  });

  test('supports circular accessor re-entry without adding a bridge-owned cache', () => {
    const a = { name: 'a', peer: null as any };
    const b = { name: 'b', peer: null as any };
    let aEvaluated = false;
    let bEvaluated = false;
    registerModuleAccessors({
      'cycle/a': () => {
        if (!aEvaluated) {
          aEvaluated = true;
          a.peer = requireBundledModule('./b', 'cycle');
        }
        return a;
      },
      'cycle/b': () => {
        if (!bEvaluated) {
          bEvaluated = true;
          b.peer = requireBundledModule('./a', 'cycle');
        }
        return b;
      }
    }, {}, 'startup');

    expect(requireBundledModule('cycle/a')).toBe(a);
    expect(a.peer).toBe(b);
    expect(b.peer).toBe(a);
  });

  test('fails clearly before an optional group registers its accessor', () => {
    expect(() => requireBundledModule('ui/gacha/gacha-overlay-controller'))
      .toThrow('Module not available: ui/gacha/gacha-overlay-controller');
  });
});
