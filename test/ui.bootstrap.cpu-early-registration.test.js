const { JSDOM } = require('jsdom');

describe('UI bootstrap early CPU registration', () => {
  const modPath = require.resolve('../ui/bootstrap');
  beforeEach(() => {
    jest.resetModules();
    try { delete global.processCpuTurn; } catch (e) {}
  });

  afterEach(() => {
    try { delete global.window; } catch (e) {}
    try { delete global.document; } catch (e) {}
    try { delete global.resetRenderStats; } catch (e) {}
    try { delete global.hideCpuSpeechBubble; } catch (e) {}
  });

  test('installGameDI registers processCpuTurn when cpu-turn-handler exposes it', () => {
    const mockCpu = { processCpuTurn: jest.fn(), processAutoBlackTurn: jest.fn() };
    jest.doMock('../game/cpu-turn-handler', () => mockCpu);

    const uiBoot = require('../ui/bootstrap');
    // Call installGameDI (returns impl) to perform the registration logic
    const impl = uiBoot.installGameDI();

    const globals = uiBoot.getRegisteredUIGlobals();
    expect(typeof globals.processCpuTurn).toBe('function');
    expect(typeof globals.processAutoBlackTurn).toBe('function');
    // Also mirrors to globalThis for legacy fallback
    expect(typeof global.processCpuTurn === 'function' || typeof globalThis.processCpuTurn === 'function').toBe(true);
  });

  test('resetTransientUIState clears lingering fx ghosts and stale has-disc shadows', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board" class="playback-locked">
        <div class="cell has-disc" data-row="0" data-col="0"></div>
      </div>
      <div id="card-fx-layer"><div class="hyperactive-move-ghost"></div></div>
      <div id="handLayer" style="display:block"></div>
      <div id="handWrapper" style="display:block"><div>dummy</div></div>
      <div id="heldStone"><div>dummy</div></div>
    </body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.resetRenderStats = jest.fn();
    global.hideCpuSpeechBubble = jest.fn();

    const strayBodyGhost = document.createElement('div');
    strayBodyGhost.className = 'disc stone-instant';
    strayBodyGhost.style.position = 'fixed';
    document.body.appendChild(strayBodyGhost);

    const setUIImplMock = jest.fn();
    jest.doMock('../game/turn-manager', () => ({ setUIImpl: setUIImplMock }));
    jest.doMock('../game/cpu-turn-handler', () => ({}));

    const uiBoot = require('../ui/bootstrap');
    uiBoot.installGameDI();

    expect(setUIImplMock.mock.calls.length).toBeGreaterThan(0);
    const matchingCall = setUIImplMock.mock.calls
      .map((args) => args && args[0])
      .find((impl) => impl && typeof impl.resetTransientUIState === 'function');
    const uiImpl = matchingCall;
    expect(typeof uiImpl.resetTransientUIState).toBe('function');

    const board = document.getElementById('board');
    const cell = board.querySelector('.cell');

    const staleDestroyFadeDisc = document.createElement('div');
    staleDestroyFadeDisc.className = 'disc destroy-fade';
    cell.appendChild(staleDestroyFadeDisc);

    uiImpl.resetTransientUIState();

    const fxLayer = document.getElementById('card-fx-layer');

    expect(board.classList.contains('playback-locked')).toBe(false);
    expect(cell.querySelector('.disc.destroy-fade')).toBeNull();
    expect(cell.classList.contains('has-disc')).toBe(false);
    expect(fxLayer.innerHTML).toBe('');
    expect(document.body.contains(strayBodyGhost)).toBe(false);
    expect(global.resetRenderStats).toHaveBeenCalledTimes(1);
  });
});
