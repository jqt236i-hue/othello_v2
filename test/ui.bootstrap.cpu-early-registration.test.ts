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
    try { delete global.showResult; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.isProcessing; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.MATCH_MODE; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.getCurrentMatchMode; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.customRuntimeFn; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.executeMove; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.processPassTurn; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.generateMovesForPlayer; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.__runtimeOwnValueForTest; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.ActionManager; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.NetworkTurnHandoff; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.NetworkMatchClient; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.writeNetworkStatus; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  test('installGameDI registers processCpuTurn when cpu-turn-handler exposes it', () => {
    const mockCpu = { processCpuTurn: jest.fn(), processAutoBlackTurn: jest.fn(), setCpuTurnTimerService: jest.fn(), setCpuUIImpl: jest.fn() };
    const setPassHandlerRuntime = jest.fn();
    const setCpuDecisionRuntime = jest.fn();
    const selectMoveFromOnnxPolicyAsync = jest.fn();
    const selectCpuMoveWithPolicy = jest.fn();
    const generateMovesForPlayer = jest.fn();
    const setTurnPipelinePhasesRuntime = jest.fn();
    jest.doMock('../game/cpu-turn-handler', () => mockCpu);
    jest.doMock('../game/pass-handler', () => ({
      setPassHandlerRuntime,
      setPlaybackStateManager: jest.fn(),
      setNetworkMatchClient: jest.fn()
    }));
    jest.doMock('../game/cpu-decision', () => ({
      setCpuDecisionRuntime,
      selectMoveFromOnnxPolicyAsync,
      selectCpuMoveWithPolicy
    }));
    jest.doMock('../game/move-generator', () => ({
      generateMovesForPlayer
    }));
    jest.doMock('../game/turn/turn_pipeline_phases', () => ({
      setTurnPipelinePhasesRuntime
    }));

    const uiBoot = require('../ui/bootstrap.js');
    // Call installGameDI (returns impl) to perform the registration logic
    const impl = uiBoot.installGameDI();

    const globals = uiBoot.getRegisteredUIGlobals();
    expect(typeof globals.processCpuTurn).toBe('function');
    expect(typeof globals.processAutoBlackTurn).toBe('function');
    expect(globals.selectMoveFromOnnxPolicyAsync).toBe(selectMoveFromOnnxPolicyAsync);
    expect(globals.selectCpuMoveWithPolicy).toBe(selectCpuMoveWithPolicy);
    expect(typeof globals.generateMovesForPlayer).toBe('function');
    expect(mockCpu.setCpuUIImpl).toHaveBeenCalledTimes(1);
    expect(mockCpu.setCpuTurnTimerService).toHaveBeenCalledWith(expect.objectContaining({
      setTimeout: expect.any(Function),
      clearTimeout: expect.any(Function)
    }));
    expect(typeof mockCpu.setCpuUIImpl.mock.calls[0][0].readMatchMode).toBe('function');
    expect(typeof mockCpu.setCpuUIImpl.mock.calls[0][0].readHumanVsHumanMode).toBe('function');
    expect(typeof mockCpu.setCpuUIImpl.mock.calls[0][0].readQuerySearch).toBe('function');
    expect(typeof mockCpu.setCpuUIImpl.mock.calls[0][0].readProcessing).toBe('function');
    expect(typeof mockCpu.setCpuUIImpl.mock.calls[0][0].readAnimationBusy).toBe('function');
    expect(setPassHandlerRuntime).toHaveBeenCalledTimes(1);
    expect(setPassHandlerRuntime.mock.calls[0][0].processCpuTurn).toBe(mockCpu.processCpuTurn);
    expect(typeof setPassHandlerRuntime.mock.calls[0][0].readMatchMode).toBe('function');
    expect(typeof setPassHandlerRuntime.mock.calls[0][0].readHumanVsHumanMode).toBe('function');
    expect(typeof setPassHandlerRuntime.mock.calls[0][0].resolveRuntimeFunction).toBe('function');
    expect(setPassHandlerRuntime.mock.calls[0][0].resolveRuntimeFunction('selectMoveFromOnnxPolicyAsync')).toBe(selectMoveFromOnnxPolicyAsync);
    expect(mockCpu.setCpuUIImpl.mock.calls[0][0].resolveRuntimeFunction('generateMovesForPlayer')).toBe(globals.generateMovesForPlayer);
    expect(mockCpu.setCpuUIImpl.mock.calls[0][0].resolveRuntimeFunction('selectCpuMoveWithPolicy')).toBe(selectCpuMoveWithPolicy);
    expect(typeof setPassHandlerRuntime.mock.calls[0][0].showResult).toBe('function');
    global.ActionManager = { sentinel: 'action' };
    global.NetworkTurnHandoff = { sentinel: 'handoff' };
    expect(setPassHandlerRuntime.mock.calls[0][0].getActionManager()).toBe(global.ActionManager);
    expect(setPassHandlerRuntime.mock.calls[0][0].getNetworkTurnHandoff()).toBe(global.NetworkTurnHandoff);
    expect(typeof setPassHandlerRuntime.mock.calls[0][0].setProcessing).toBe('function');
    expect(typeof setPassHandlerRuntime.mock.calls[0][0].publishSnapshot).toBe('function');
    expect(setCpuDecisionRuntime).toHaveBeenCalledTimes(1);
    expect(setCpuDecisionRuntime.mock.calls[0][0].processCpuTurn).toBe(mockCpu.processCpuTurn);
    expect(typeof setCpuDecisionRuntime.mock.calls[0][0].readMatchMode).toBe('function');
    expect(typeof setCpuDecisionRuntime.mock.calls[0][0].readHumanVsHumanMode).toBe('function');
    expect(typeof setCpuDecisionRuntime.mock.calls[0][0].readDebugFlag).toBe('function');
    expect(typeof setCpuDecisionRuntime.mock.calls[0][0].readQuerySearch).toBe('function');
    expect(typeof setCpuDecisionRuntime.mock.calls[0][0].readCpuSmartness).toBe('function');
    expect(setTurnPipelinePhasesRuntime).toHaveBeenCalledTimes(1);
    expect(typeof setTurnPipelinePhasesRuntime.mock.calls[0][0].readMatchMode).toBe('function');
    // Also mirrors to globalThis for legacy fallback
    expect(typeof global.processCpuTurn === 'function' || typeof globalThis.processCpuTurn === 'function').toBe(true);
  });

  test('installGameDI CPU runtime delegates resolve latest global move helpers', () => {
    const mockCpu = { processCpuTurn: jest.fn(), processAutoBlackTurn: jest.fn(), setCpuUIImpl: jest.fn() };
    const generateMovesForPlayer = jest.fn(() => ['fallback-move']);
    jest.doMock('../game/cpu-turn-handler', () => mockCpu);
    jest.doMock('../game/pass-handler', () => ({
      setPassHandlerRuntime: jest.fn(),
      setPlaybackStateManager: jest.fn(),
      setNetworkMatchClient: jest.fn()
    }));
    jest.doMock('../game/cpu-decision', () => ({
      setCpuDecisionRuntime: jest.fn(),
      selectMoveFromOnnxPolicyAsync: jest.fn()
    }));
    jest.doMock('../game/move-generator', () => ({
      generateMovesForPlayer
    }));
    jest.doMock('../game/turn/turn_pipeline_phases', () => ({
      setTurnPipelinePhasesRuntime: jest.fn()
    }));

    const uiBoot = require('../ui/bootstrap.js');
    uiBoot.installGameDI();

    const cpuRuntime = mockCpu.setCpuUIImpl.mock.calls[0][0];
    const generateMovesDelegate = cpuRuntime.resolveRuntimeFunction('generateMovesForPlayer');
    const executeMoveDelegate = cpuRuntime.resolveRuntimeFunction('executeMove');
    const processPassTurnDelegate = cpuRuntime.resolveRuntimeFunction('processPassTurn');

    expect(typeof generateMovesDelegate).toBe('function');
    expect(typeof executeMoveDelegate).toBe('function');
    expect(typeof processPassTurnDelegate).toBe('function');

    global.generateMovesForPlayer = jest.fn(() => ['global-move']);
    global.executeMove = jest.fn((move) => ({ executed: move }));
    global.processPassTurn = jest.fn(() => ({ passed: true }));

    expect(generateMovesDelegate('white')).toEqual(['global-move']);
    expect(global.generateMovesForPlayer).toHaveBeenCalledWith('white');
    expect(executeMoveDelegate({ row: 2, col: 4 })).toEqual({ executed: { row: 2, col: 4 } });
    expect(processPassTurnDelegate()).toEqual({ passed: true });

    delete global.generateMovesForPlayer;
    expect(generateMovesDelegate('black')).toEqual(['fallback-move']);
    expect(generateMovesForPlayer).toHaveBeenCalledWith('black');
  });

  test('installGameDI tolerates missing optional CPU and pass modules', () => {
    jest.doMock('../game/cpu-turn-handler', () => {
      throw new Error('cpu module unavailable');
    });
    jest.doMock('../game/pass-handler', () => {
      throw new Error('pass module unavailable');
    });

    const uiBoot = require('../ui/bootstrap.js');

    expect(() => uiBoot.installGameDI()).not.toThrow();
  });

  test('installGameDI runtime readers prefer registered globals and own globalThis values', () => {
    const mockCpu = { processCpuTurn: jest.fn(), processAutoBlackTurn: jest.fn(), setCpuUIImpl: jest.fn() };
    const setPassHandlerRuntime = jest.fn();
    jest.doMock('../game/cpu-turn-handler', () => mockCpu);
    jest.doMock('../game/pass-handler', () => ({
      setPassHandlerRuntime,
      setPlaybackStateManager: jest.fn(),
      setNetworkMatchClient: jest.fn()
    }));
    jest.doMock('../game/cpu-decision', () => ({
      setCpuDecisionRuntime: jest.fn(),
      selectMoveFromOnnxPolicyAsync: jest.fn()
    }));
    jest.doMock('../game/turn/turn_pipeline_phases', () => ({
      setTurnPipelinePhasesRuntime: jest.fn()
    }));

    const uiBoot = require('../ui/bootstrap.js');
    const registeredFn = jest.fn();
    const globalFn = jest.fn();
    uiBoot.registerUIGlobals({ customRuntimeFn: registeredFn });
    global.customRuntimeFn = globalFn;
    global.MATCH_MODE = 'local';
    global.getCurrentMatchMode = jest.fn(() => 'network');
    global.__runtimeOwnValueForTest = { source: 'own' };

    uiBoot.installGameDI();

    const cpuRuntime = mockCpu.setCpuUIImpl.mock.calls[0][0];
    const passRuntime = setPassHandlerRuntime.mock.calls[0][0];
    expect(cpuRuntime.readMatchMode()).toBe('network');
    expect(global.getCurrentMatchMode).toHaveBeenCalledTimes(1);
    expect(cpuRuntime.resolveRuntimeFunction('customRuntimeFn')).toBe(registeredFn);
    expect(passRuntime.resolveRuntimeFunction('customRuntimeFn')).toBe(registeredFn);
    expect(cpuRuntime.resolveRuntimeFunction('missingRuntimeFn')).toBeNull();
    expect(cpuRuntime.resolveRuntimeValue('__runtimeOwnValueForTest')).toEqual({ source: 'own' });
    expect(Object.prototype.hasOwnProperty.call(globalThis, 'toString')).toBe(false);
    expect(cpuRuntime.resolveRuntimeValue('toString')).toBeUndefined();
  });

  test('installGameDI treats spectator sessions as network publish inactive', () => {
    const bridgeState = { bridge: null };
    jest.doMock('../game/card-effects/selection-flow', () => ({
      setSignalBridge: (bridge) => {
        bridgeState.bridge = bridge;
      }
    }));
    jest.doMock('../game/cpu-turn-handler', () => ({}));
    jest.doMock('../game/pass-handler', () => ({
      setPassHandlerRuntime: jest.fn(),
      setPlaybackStateManager: jest.fn(),
      setNetworkMatchClient: jest.fn()
    }));
    jest.doMock('../game/cpu-decision', () => ({
      setCpuDecisionRuntime: jest.fn(),
      selectMoveFromOnnxPolicyAsync: jest.fn()
    }));
    jest.doMock('../game/turn/turn_pipeline_phases', () => ({
      setTurnPipelinePhasesRuntime: jest.fn()
    }));
    global.NetworkMatchClient = {
      publishSnapshot: jest.fn(),
      isActive: jest.fn(() => true),
      isSpectator: jest.fn(() => true)
    };

    const uiBoot = require('../ui/bootstrap.ts');
    uiBoot.installGameDI();

    expect(bridgeState.bridge).toBeTruthy();
    expect(bridgeState.bridge.isNetworkPublishActive()).toBe(false);
    expect(bridgeState.bridge.publishSnapshot({ actionType: 'place' })).toBeUndefined();
    expect(global.NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();
  });

  test('installGameDI wires current cardState into destroy selection handlers', () => {
    const destroySetUIImpl = jest.fn();
    jest.doMock('../game/card-effects/destroy', () => ({
      setUIImpl: destroySetUIImpl
    }));
    jest.doMock('../game/cpu-turn-handler', () => ({}));

    const currentCardState = {
      pendingEffectByPlayer: {
        black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' },
        white: null
      }
    };
    global.cardState = currentCardState;

    const uiBoot = require('../ui/bootstrap.ts');
    uiBoot.installGameDI();

    const destroyImpl = destroySetUIImpl.mock.calls
      .map((args) => args && args[0])
      .find((impl) => impl && typeof impl.getCardState === 'function');

    expect(destroyImpl).toBeTruthy();
    expect(destroyImpl.getCardState()).toBe(currentCardState);
  });

  test('installGameDI does not let spectator sessions publish through pass runtime', () => {
    const setPassHandlerRuntime = jest.fn();
    jest.doMock('../game/cpu-turn-handler', () => ({}));
    jest.doMock('../game/pass-handler', () => ({
      setPassHandlerRuntime,
      setPlaybackStateManager: jest.fn(),
      setNetworkMatchClient: jest.fn()
    }));
    jest.doMock('../game/cpu-decision', () => ({
      setCpuDecisionRuntime: jest.fn(),
      selectMoveFromOnnxPolicyAsync: jest.fn()
    }));
    jest.doMock('../game/turn/turn_pipeline_phases', () => ({
      setTurnPipelinePhasesRuntime: jest.fn()
    }));
    global.NetworkMatchClient = {
      publishSnapshot: jest.fn(() => ({ ok: true })),
      isActive: jest.fn(() => true),
      isSpectator: jest.fn(() => true)
    };

    const uiBoot = require('../ui/bootstrap.ts');
    uiBoot.installGameDI();

    expect(setPassHandlerRuntime).toHaveBeenCalledTimes(1);
    const passRuntime = setPassHandlerRuntime.mock.calls[0][0];
    expect(passRuntime.publishSnapshot({ actionType: 'pass' })).toBeUndefined();
    expect(global.NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();
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
    window.PlaybackStateManager = {
      sentinel: true,
      setBusyState: jest.fn(),
      getProcessing: jest.fn(() => false),
      getCardAnimating: jest.fn(() => false)
    };
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
    expect(typeof bridgeState.bridge.readMatchMode).toBe('function');
    expect(typeof bridgeState.bridge.readHumanVsHumanMode).toBe('function');
    expect(bridgeState.bridge.getPlaybackStateManager()).toBe(window.PlaybackStateManager);
    expect(bridgeState.bridge.setSelectionBusy(true)).toBe(true);
    expect(window.PlaybackStateManager.setBusyState).toHaveBeenCalledWith({ processing: true, cardAnimating: true });
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

  test('installGameDI wires move-executor processing through UI PlaybackStateManager bridge', () => {
    const setMoveExecutorUIImpl = jest.fn();
    const playbackState = {
      setBusyState: jest.fn(),
      setProcessing: jest.fn()
    };
    global.PlaybackStateManager = playbackState;
    jest.doMock('../game/move-executor', () => ({ setUIImpl: setMoveExecutorUIImpl }));
    jest.doMock('../game/cpu-turn-handler', () => ({}));

    const uiBoot = require('../ui/bootstrap.js');
    uiBoot.installGameDI();

    const uiImpl = setMoveExecutorUIImpl.mock.calls
      .map((args) => args && args[0])
      .find((impl) => impl && typeof impl.setProcessing === 'function');

    expect(uiImpl).toBeDefined();
    uiImpl.setProcessing(true);

    expect(playbackState.setBusyState).toHaveBeenCalledWith({ processing: true });
    expect(playbackState.setProcessing).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(true);
  });

  test('installGameDI wires CPU processing through UI PlaybackStateManager bridge', () => {
    const setCpuUIImpl = jest.fn();
    const playbackState = {
      getProcessing: jest.fn(() => false),
      setBusyState: jest.fn(),
      setProcessing: jest.fn()
    };
    global.PlaybackStateManager = playbackState;
    jest.doMock('../game/cpu-turn-handler', () => ({
      processCpuTurn: jest.fn(),
      processAutoBlackTurn: jest.fn(),
      setCpuUIImpl
    }));

    const uiBoot = require('../ui/bootstrap.js');
    uiBoot.installGameDI();

    const uiImpl = setCpuUIImpl.mock.calls
      .map((args) => args && args[0])
      .find((impl) => impl && typeof impl.setProcessing === 'function');

    expect(uiImpl).toBeDefined();
    expect(uiImpl.readProcessing()).toBe(false);
    uiImpl.setProcessing(true);

    expect(playbackState.getProcessing).toHaveBeenCalled();
    expect(playbackState.setBusyState).toHaveBeenCalledWith({ processing: true });
    expect(playbackState.setProcessing).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(true);
  });

  test('resetTransientUIState clears lingering fx ghosts and stale has-disc shadows', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board" class="playback-locked">
        <div class="cell has-disc legal keyboard-legal-cursor random-spawn-preview effect-target-highlight-positive" data-row="0" data-col="0"></div>
      </div>
      <div id="board-expansion-layer">
        <div class="cell-expanded legal-free" data-row="-1" data-col="0"></div>
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
    expect(typeof uiImpl.clearLegalMoveHints).toBe('function');
    expect(typeof uiImpl.showResult).toBe('function');
    global.showResult = jest.fn();
    expect(uiImpl.showResult()).toBe(true);
    expect(global.showResult).toHaveBeenCalledTimes(1);

    const board = document.getElementById('board');
    const cell = board.querySelector('.cell');
    const expansionCell = document.querySelector('#board-expansion-layer .cell-expanded');

    expect(uiImpl.clearLegalMoveHints()).toBe(true);
    expect(cell.classList.contains('legal')).toBe(false);
    expect(cell.classList.contains('keyboard-legal-cursor')).toBe(false);
    expect(cell.classList.contains('random-spawn-preview')).toBe(false);
    expect(cell.classList.contains('effect-target-highlight-positive')).toBe(true);
    expect(expansionCell.classList.contains('legal-free')).toBe(false);

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

  test('resetTransientUIState resets result presentation state before clearing stale result UI', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="result-overlay"></div>
      <div class="battle-status-turn has-result-reopen-button">
        <button id="result-reopen-button" type="button">リザルト</button>
      </div>
    </body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.resetRenderStats = jest.fn();
    global.hideCpuSpeechBubble = jest.fn();

    const resetResultPresentationState = jest.fn(() => {
      document.getElementById('result-overlay')?.remove();
      document.getElementById('result-reopen-button')?.remove();
      document.querySelectorAll('.battle-status-turn.has-result-reopen-button').forEach((el) => {
        el.classList.remove('has-result-reopen-button');
      });
      return { terminalResultShown: false };
    });

    const setUIImplMock = jest.fn();
    jest.doMock('../ui/result-overlay', () => ({ resetResultPresentationState }));
    jest.doMock('../game/turn-manager', () => ({ setUIImpl: setUIImplMock }));
    jest.doMock('../game/cpu-turn-handler', () => ({}));

    const uiBoot = require('../ui/bootstrap.js');
    uiBoot.installGameDI();

    const uiImpl = setUIImplMock.mock.calls
      .map((args) => args && args[0])
      .find((impl) => impl && typeof impl.resetTransientUIState === 'function');

    expect(typeof uiImpl.resetTransientUIState).toBe('function');

    uiImpl.resetTransientUIState();

    expect(resetResultPresentationState).toHaveBeenCalledTimes(1);
    expect(resetResultPresentationState).toHaveBeenCalledWith(null);
    expect(document.getElementById('result-overlay')).toBeNull();
    expect(document.getElementById('result-reopen-button')).toBeNull();
    expect(document.querySelector('.battle-status-turn')?.classList.contains('has-result-reopen-button')).toBe(false);
  });

  test('installGameDI wires turn-manager PRNG through UI bridge', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;

    const prng = { random: jest.fn(() => 0.25), shuffle: jest.fn((arr) => arr) };
    global.getGamePrng = jest.fn(() => prng);
    global.window.getGamePrng = global.getGamePrng;

    const setUIImplMock = jest.fn();
    jest.doMock('../game/turn-manager', () => ({ setUIImpl: setUIImplMock }));
    jest.doMock('../game/cpu-turn-handler', () => ({}));

    const uiBoot = require('../ui/bootstrap.js');
    uiBoot.installGameDI();

    const uiImpl = setUIImplMock.mock.calls
      .map((args) => args && args[0])
      .find((impl) => impl && typeof impl.getGamePrng === 'function');

    expect(uiImpl).toBeTruthy();
    expect(uiImpl.getGamePrng()).toBe(prng);
    expect(global.getGamePrng).toHaveBeenCalledTimes(1);
  });

  test('installGameDI wires turn-manager spectator read-only helpers through UI bridge', () => {
    const setUIImplMock = jest.fn();
    jest.doMock('../game/turn-manager', () => ({ setUIImpl: setUIImplMock }));
    jest.doMock('../game/cpu-turn-handler', () => ({}));

    global.NetworkMatchClient = {
      getSeatKey: jest.fn(() => null),
      isSpectator: jest.fn(() => true)
    };
    global.writeNetworkStatus = jest.fn();

    const uiBoot = require('../ui/bootstrap.js');
    uiBoot.installGameDI();

    const uiImpl = setUIImplMock.mock.calls
      .map((args) => args && args[0])
      .find((impl) => impl && typeof impl.isNetworkSpectator === 'function');

    expect(uiImpl).toBeTruthy();
    expect(uiImpl.isNetworkSpectator()).toBe(true);
    expect(uiImpl.emitStatus('観測中は操作できません', true)).toBe(true);
    expect(global.writeNetworkStatus).toHaveBeenCalledWith('観測中は操作できません', true);
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
    expect(document.getElementById('stone-info-panel').classList.contains('visible')).toBe(true);
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
