import { JSDOM } from 'jsdom';

describe('init event pass buttons', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete (global as any).window; } catch (e) { /* cleanup guard */ }
    try { delete (global as any).document; } catch (e) { /* cleanup guard */ }
    try { delete (global as any).passCurrentTurn; } catch (e) { /* cleanup guard */ }
  });

  test('board frame pass button uses the existing passCurrentTurn handler', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="reversi-pass-btn">パス</button>
      <button id="board-frame-pass-btn">パス</button>
    </body></html>`);
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    const passCurrentTurn = jest.fn();
    (global as any).passCurrentTurn = passCurrentTurn;

    const { attachInitEventListeners } = require('../ui/bootstrap/init-events');
    const reversiPassBtn = document.getElementById('reversi-pass-btn') as HTMLButtonElement;
    const boardFramePassBtn = document.getElementById('board-frame-pass-btn') as HTMLButtonElement;

    attachInitEventListeners({
      reversiPassBtn,
      boardFramePassBtn,
      othelloPassBtn: null
    }, false);

    boardFramePassBtn.click();
    reversiPassBtn.click();

    expect(passCurrentTurn).toHaveBeenCalledTimes(2);
    dom.window.close();
  });
});
