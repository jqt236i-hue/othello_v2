import * as fs from 'fs';
const path = require('path');
import { JSDOM } from 'jsdom';

describe('UI bootstrap early CPU registration', () => {
  const modPath = require.resolve('../ui/bootstrap');
  beforeEach(() => {
    jest.resetModules();
    try { delete global.processCpuTurn; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  afterEach(() => {
    try { delete global.window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.document; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.resetRenderStats; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.hideCpuSpeechBubble; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.PlaybackStateManager; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  test('installGameDI registers processCpuTurn when cpu-turn-handler exposes it', () => {
    const mockCpu = { processCpuTurn: jest.fn(), processAutoBlackTurn: jest.fn(), setCpuUIImpl: jest.fn() };
    const setPassHandlerRuntime = jest.fn();
    const setCpuDecisionRuntime = jest.fn();
    jest.doMock('../game/cpu-turn-handler', () => mockCpu);
    jest.doMock('../game/pass-handler', () => ({
      setPassHandlerRuntime,
      setPlaybackStateManager: jest.fn(),
      setNetworkMatchClient: jest.fn()
    }));
    jest.doMock('../game/cpu-decision', () => ({
      setCpuDecisionRuntime
    }));

    const uiBoot = require('../ui/bootstrap.js');
    // Call installGameDI (returns impl) to perform the registration logic
    const impl = uiBoot.installGameDI();

    const globals = uiBoot.getRegisteredUIGlobals();
    expect(typeof globals.processCpuTurn).toBe('function');
    expect(typeof globals.processAutoBlackTurn).toBe('function');
    expect(mockCpu.setCpuUIImpl).toHaveBeenCalledTimes(1);
    expect(typeof mockCpu.setCpuUIImpl.mock.calls[0][0].readMatchMode).toBe('function');
    expect(typeof mockCpu.setCpuUIImpl.mock.calls[0][0].readHumanVsHumanMode).toBe('function');
    expect(setPassHandlerRuntime).toHaveBeenCalledTimes(1);
    expect(setPassHandlerRuntime.mock.calls[0][0].processCpuTurn).toBe(mockCpu.processCpuTurn);
    expect(typeof setPassHandlerRuntime.mock.calls[0][0].readMatchMode).toBe('function');
    expect(typeof setPassHandlerRuntime.mock.calls[0][0].readHumanVsHumanMode).toBe('function');
    expect(setCpuDecisionRuntime).toHaveBeenCalledTimes(1);
    expect(setCpuDecisionRuntime.mock.calls[0][0].processCpuTurn).toBe(mockCpu.processCpuTurn);
    expect(typeof setCpuDecisionRuntime.mock.calls[0][0].readMatchMode).toBe('function');
    expect(typeof setCpuDecisionRuntime.mock.calls[0][0].readHumanVsHumanMode).toBe('function');
    // Also mirrors to globalThis for legacy fallback
    expect(typeof global.processCpuTurn === 'function' || typeof globalThis.processCpuTurn === 'function').toBe(true);
  });

  test('classic-script installGameDI wires pending selection bridge through globals when require is unavailable', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      runScripts: 'outside-only',
      url: 'http://localhost/'
    });
    const { window } = dom;
    const bridgeState = { bridge: null };

    window.PendingSelectionFlow = {
      setSignalBridge: (bridge) => {
        bridgeState.bridge = bridge;
      }
    };
    window.PresentationHelper = {
      emitPresentationEvent: jest.fn(() => true)
    };
    window.PlaybackStateManager = { sentinel: true };
    window.emitCardStateChange = jest.fn();
    window.emitBoardUpdate = jest.fn();
    window.emitGameStateChange = jest.fn();
    window.emitLogAdded = jest.fn();
    window.cardState = { _presentationEventsPersist: [] };
    window.Image = class {
      set src(_value) {
        if (typeof this.onload === 'function') this.onload();
      }
    };

    const source = fs.readFileSync(path.resolve(__dirname, '../ui/bootstrap.js'), 'utf8');
    const browserLikeCode = `var require = undefined; var module = undefined; var exports = undefined;\n${source}`;
    expect(() => window.eval(browserLikeCode)).not.toThrow();

    expect(window.UIBootstrap).toBeTruthy();
    window.UIBootstrap.installGameDI();

    expect(bridgeState.bridge).toBeTruthy();
    expect(bridgeState.bridge.getPlaybackStateManager()).toBe(window.PlaybackStateManager);
    expect(bridgeState.bridge.emitPlaybackEvents([{ type: 'flip', phase: 1 }], { cause: 'FREEZE_WILL' }, window.cardState)).toBe(true);
    expect(window.PresentationHelper.emitPresentationEvent).toHaveBeenCalledWith(window.cardState, {
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'flip', phase: 1 }],
      meta: { cause: 'FREEZE_WILL' }
    });

    expect(bridgeState.bridge.emitStateChanges()).toBe(true);
    expect(window.emitCardStateChange).toHaveBeenCalledTimes(1);
    expect(window.emitBoardUpdate).toHaveBeenCalledTimes(1);
    expect(window.emitGameStateChange).toHaveBeenCalledTimes(1);

    expect(bridgeState.bridge.emitMessage('pending target')).toBe(true);
    expect(window.emitLogAdded).toHaveBeenCalledWith('pending target');
    expect(bridgeState.bridge.emitBoardUpdate()).toBe(true);
    expect(window.emitBoardUpdate).toHaveBeenCalledTimes(2);

    dom.window.close();
  });

  test('classic-script bridge emits representative target-selection playback batches unchanged', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      runScripts: 'outside-only',
      url: 'http://localhost/'
    });
    const { window } = dom;
    const bridgeState = { bridge: null };

    window.PendingSelectionFlow = {
      setSignalBridge: (bridge) => {
        bridgeState.bridge = bridge;
      }
    };
    window.PresentationHelper = {
      emitPresentationEvent: jest.fn(() => true)
    };
    window.cardState = { _presentationEventsPersist: [] };
    window.Image = class {
      set src(_value) {
        if (typeof this.onload === 'function') this.onload();
      }
    };

    const source = fs.readFileSync(path.resolve(__dirname, '../ui/bootstrap.js'), 'utf8');
    const browserLikeCode = `var require = undefined; var module = undefined; var exports = undefined;\n${source}`;
    window.eval(browserLikeCode);
    window.UIBootstrap.installGameDI();

    expect(bridgeState.bridge).toBeTruthy();

    const cases = [
      [{ type: 'sound_effect', phase: 1, targets: [{ soundKey: 'trap_select' }] }],
      [{ type: 'status_applied', phase: 2, targets: [{ r: 3, col: 3, cause: 'FREEZE_WILL', reason: 'freeze_selected' }] }],
      [{ type: 'capture_to_hand_animation', phase: 3, targets: [{ player: 'black', cardId: 'dragon_01', sourceRow: 3, sourceCol: 3, insertIndex: 0 }] }]
    ];

    cases.forEach((events, index) => {
      expect(bridgeState.bridge.emitPlaybackEvents(events, { sample: index }, window.cardState)).toBe(true);
      expect(window.PresentationHelper.emitPresentationEvent).toHaveBeenNthCalledWith(index + 1, window.cardState, {
        type: 'PLAYBACK_EVENTS',
        events,
        meta: { sample: index }
      });
    });

    dom.window.close();
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

    const uiBoot = require('../ui/bootstrap.js');
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

  test('resetTransientUIState aborts before clearing playback context and stays stable across repeated calls', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board" class="playback-locked">
        <div class="cell has-disc" data-row="0" data-col="0">
          <div class="disc stone-hidden"></div>
        </div>
      </div>
      <div id="card-fx-layer"><div class="hyperactive-move-ghost"></div></div>
      <div id="result-overlay"></div>
      <div id="stone-info-panel" class="visible"></div>
      <div id="stone-info-tag-panel" class="is-open"></div>
      <div class="observer-speech-bubble"></div>
      <div id="handLayer" style="display:block">
        <div id="handWrapper" style="display:block;transform:translateX(5px)">
          <img id="handImage" />
          <div class="transient-card">dummy</div>
          <div id="heldStone" style="display:block"><div>dummy</div></div>
        </div>
        <div class="moving-card">dummy</div>
      </div>
    </body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.resetRenderStats = jest.fn();
    global.hideCpuSpeechBubble = jest.fn();

    const playbackState = require('../ui/playback-state-manager.js');
    global.PlaybackStateManager = playbackState;
    global.window.PlaybackStateManager = playbackState;

    playbackState.setInteractionLock(true);
    playbackState.armBoardUpdateContext({
      suppressFallbackFlip: true,
      source: 'unit-test',
      reason: 'pending_abort_sync'
    });
    global.window.__drawHandAnimActive = true;
    global.window.__handSequentialRevealState = { index: 1 };
    global.window._currentPlaybackScope = 'scope-1';
    global.window.TimerRegistry = { clearAll: jest.fn() };

    const observedContexts = [];
    global.window.AnimationEngine = {
      abortAndSync: jest.fn(() => {
        observedContexts.push(playbackState.getBoardUpdateContext());
      })
    };

    const setUIImplMock = jest.fn();
    jest.doMock('../game/turn-manager', () => ({ setUIImpl: setUIImplMock }));
    jest.doMock('../game/cpu-turn-handler', () => ({}));

    const uiBoot = require('../ui/bootstrap.js');
    uiBoot.installGameDI();

    const uiImpl = setUIImplMock.mock.calls
      .map((args) => args && args[0])
      .find((impl) => impl && typeof impl.resetTransientUIState === 'function');

    expect(typeof uiImpl.resetTransientUIState).toBe('function');

    uiImpl.resetTransientUIState();
    uiImpl.resetTransientUIState();

    expect(global.window.AnimationEngine.abortAndSync).toHaveBeenCalledTimes(2);
    expect(observedContexts[0]).toMatchObject({
      suppressFallbackFlip: true,
      source: 'unit-test',
      reason: 'pending_abort_sync'
    });
    expect(observedContexts[1]).toBeNull();
    expect(playbackState.getPlaybackActive()).toBe(false);
    expect(playbackState.getBoardUpdateContext()).toBeNull();
    expect(global.window.__suppressNextDiffFlip).toBe(false);
    expect(global.window.__drawHandAnimActive).toBe(false);
    expect(global.window.__handSequentialRevealState).toBeNull();
    expect(global.window._currentPlaybackScope).toBeUndefined();
    expect(global.window.TimerRegistry.clearAll).toHaveBeenCalledTimes(2);
    expect(document.getElementById('board').classList.contains('playback-locked')).toBe(false);
    expect(document.getElementById('result-overlay')).toBeNull();
    expect(document.getElementById('stone-info-panel').classList.contains('visible')).toBe(false);
    expect(document.getElementById('stone-info-tag-panel').classList.contains('is-open')).toBe(false);
    expect(document.querySelector('.observer-speech-bubble')).toBeNull();
    expect(document.getElementById('handLayer').style.display).toBe('none');
    expect(document.getElementById('handWrapper').style.display).toBe('none');
    expect(document.getElementById('handWrapper').style.transform).toBe('');
    expect(document.getElementById('handLayer').querySelector('.moving-card')).toBeNull();
    expect(document.getElementById('handWrapper').querySelector('.transient-card')).toBeNull();
    expect(document.getElementById('handImage')).not.toBeNull();
    expect(document.getElementById('heldStone')).not.toBeNull();
    expect(document.getElementById('heldStone').innerHTML).toBe('');
    expect(document.getElementById('heldStone').style.display).toBe('none');
    expect(global.hideCpuSpeechBubble).toHaveBeenCalledTimes(2);
    expect(global.resetRenderStats).toHaveBeenCalledTimes(2);
  });
});
