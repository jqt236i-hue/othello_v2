import { JSDOM } from 'jsdom';

describe('card interaction runtime initialization', () => {
  afterEach(() => {
    try { delete (global as any).window; } catch (e) { /* ignore */ }
    try { delete (global as any).document; } catch (e) { /* ignore */ }
    try { delete (global as any).CardLogic; } catch (e) { /* ignore */ }
  });

  test('importing the controller neither installs globals nor registers DOM listeners', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).CardLogic = {};
    const addEventListener = jest.spyOn(dom.window.document, 'addEventListener');

    const controller = require('../cards/card-interaction.ts');

    expect((dom.window as any).onCardClick).toBeUndefined();
    expect((dom.window as any).ensureDebugActionsLoaded).toBeUndefined();
    expect(addEventListener).not.toHaveBeenCalled();
    expect(typeof controller.initializeCardInteractionRuntime).toBe('function');
  });

  test('explicit initialization installs compatibility globals once and binds gestures once', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).CardLogic = {};
    const addEventListener = jest.spyOn(dom.window.document, 'addEventListener');
    const controller = require('../cards/card-interaction.ts');

    expect(controller.initializeCardInteractionRuntime(dom.window)).toBe(true);
    expect((dom.window as any).onCardClick).toBe(controller.onCardClick);
    expect((dom.window as any).useSelectedCard).toBe(controller.useSelectedCard);
    expect((dom.window as any).ensureDebugActionsLoaded).toBeInstanceOf(Function);
    const firstBindingCount = addEventListener.mock.calls.length;
    expect(firstBindingCount).toBeGreaterThan(0);

    expect(controller.initializeCardInteractionRuntime(dom.window)).toBe(false);
    expect(addEventListener).toHaveBeenCalledTimes(firstBindingCount);
  });
});
