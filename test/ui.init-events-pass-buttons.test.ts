import { JSDOM } from 'jsdom';

describe('init event pass buttons', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete (global as any).window; } catch (e) { /* cleanup guard */ }
    try { delete (global as any).document; } catch (e) { /* cleanup guard */ }
    try { delete (global as any).passCurrentTurn; } catch (e) { /* cleanup guard */ }
    try { delete (global as any).useSelectedCard; } catch (e) { /* cleanup guard */ }
    try { delete (global as any).destroySelectedHandCard; } catch (e) { /* cleanup guard */ }
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

  test('spectator action buttons are read-only for use, destroy, and pass handlers', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="use-card-btn">使用</button>
      <button id="destroy-card-btn">破壊</button>
      <button id="pass-btn">パス</button>
      <button id="board-frame-pass-btn">パス</button>
    </body></html>`);
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (dom.window as any).NetworkMatchClient = {
      isSpectator: jest.fn(() => true)
    };
    (dom.window as any).writeNetworkStatus = jest.fn();
    const useSelectedCard = jest.fn();
    const destroySelectedHandCard = jest.fn();
    const passCurrentTurn = jest.fn();
    (global as any).useSelectedCard = useSelectedCard;
    (global as any).destroySelectedHandCard = destroySelectedHandCard;
    (global as any).passCurrentTurn = passCurrentTurn;

    const { attachInitEventListeners } = require('../ui/bootstrap/init-events');
    const useBtn = document.getElementById('use-card-btn') as HTMLButtonElement;
    const destroyBtn = document.getElementById('destroy-card-btn') as HTMLButtonElement;
    const passBtn = document.getElementById('pass-btn') as HTMLButtonElement;
    const boardFramePassBtn = document.getElementById('board-frame-pass-btn') as HTMLButtonElement;

    attachInitEventListeners({
      useBtn,
      destroyBtn,
      passBtn,
      boardFramePassBtn,
      reversiPassBtn: null,
      othelloPassBtn: null
    }, false);

    useBtn.click();
    destroyBtn.click();
    passBtn.click();
    boardFramePassBtn.click();

    expect(useSelectedCard).not.toHaveBeenCalled();
    expect(destroySelectedHandCard).not.toHaveBeenCalled();
    expect(passCurrentTurn).not.toHaveBeenCalled();
    expect((dom.window as any).writeNetworkStatus).toHaveBeenCalledWith('観戦中は操作できません', true);
    expect((dom.window as any).writeNetworkStatus).toHaveBeenCalledTimes(4);
    dom.window.close();
  });
});
