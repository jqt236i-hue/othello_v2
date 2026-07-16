import { JSDOM } from 'jsdom';

describe('init event board input wiring', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../ui/board-renderer');
    jest.dontMock('../ui/game-keyboard-shortcuts');
    try { delete (global as any).window; } catch (_error) { /* cleanup guard */ }
    try { delete (global as any).document; } catch (_error) { /* cleanup guard */ }
  });

  test('activates one shared controller and injects the global UI lock resolver', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="profileOverlay"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const boardInputController = { handleKeyboard: jest.fn() };
    const activateBoardInputController = jest.fn(() => boardInputController);
    const setupGameKeyboardShortcuts = jest.fn();
    const isBlockingUiOpen = jest.fn((doc: Document) => doc.getElementById('profileOverlay')?.classList.contains('is-open') === true);

    jest.doMock('../ui/board-renderer', () => ({ activateBoardInputController }));
    jest.doMock('../ui/game-keyboard-shortcuts', () => ({ setupGameKeyboardShortcuts, isBlockingUiOpen }));

    const { attachInitEventListeners } = require('../ui/bootstrap/init-events');
    attachInitEventListeners({}, false);

    expect(activateBoardInputController).toHaveBeenCalledTimes(1);
    const options = activateBoardInputController.mock.calls[0][0];
    expect(options.isInputLocked()).toBe(false);

    dom.window.document.getElementById('profileOverlay')?.classList.add('is-open');
    expect(options.isInputLocked()).toBe(true);
    expect(isBlockingUiOpen).toHaveBeenLastCalledWith(dom.window.document);
    expect(setupGameKeyboardShortcuts).toHaveBeenCalledWith(expect.objectContaining({
      boardInputController,
      getWindowRef: expect.any(Function)
    }));
    expect(setupGameKeyboardShortcuts.mock.calls[0][0].getWindowRef()).toBe(dom.window);

    dom.window.close();
  });
});
