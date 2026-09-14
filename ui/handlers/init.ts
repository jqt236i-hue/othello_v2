/**
 * @file init.ts
 * @description UI event handler initialization
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { GameState as GameStateType } from '../../src/types';

declare const UIBootstrap: {
  installGameDI: () => void;
  getBoardVisualController?: () => any;
  prepareInitialBoardFrameSkin?: (rootRef?: Window) => Promise<unknown>;
} | undefined;

declare const SharedUIBootstrap: {
  resolveUIBootstrap: () => typeof UIBootstrap;
} | undefined;

declare const loadCpuPolicy: (() => void) | undefined;
declare const resetGame: (() => void) | undefined;
declare const SoundEngine: {
  primeEffectSounds: () => void;
  installUserGestureUnlock?: (doc?: Document | null) => boolean;
} | undefined;
declare const setupDebugControls: ((btn: HTMLElement | null, hvhhBtn: HTMLElement | null, vtBtn: HTMLElement | null) => void) | undefined;
declare const setupAutoToggle: ((btn: HTMLElement | null, sb: HTMLSelectElement | null, sw: HTMLSelectElement | null) => void) | undefined;
declare const setupMatchModeControls: ((opts: Record<string, unknown>) => void) | undefined;
declare const setupDeckBuilderControls: ((opts: Record<string, HTMLElement | null>) => unknown) | undefined;
declare const setupSmartSelects: ((sb: HTMLSelectElement | null, sw: HTMLSelectElement | null) => void) | undefined;
declare const setupSoundControls: ((muteBtn: HTMLElement | null, seType: HTMLSelectElement | null, seVol: HTMLInputElement | null) => void) | undefined;
declare const setupBgmControls: ((playBtn: HTMLElement | null, pauseBtn: HTMLElement | null, trackSel: HTMLSelectElement | null, volSlider: HTMLInputElement | null, quickTrackPicker?: HTMLElement | null, quickToggleBtn?: HTMLElement | null) => void) | undefined;
declare const setupRulesHelp: ((btn: HTMLElement | null, panel: HTMLElement | null) => void) | undefined;
declare const setupGachaControls: ((opts: { root: Window }) => void) | undefined;
declare const setupHandSkinControls: ((opts: Record<string, unknown>) => void) | undefined;
declare const restoreStoredNetworkSessionOnBoot: (() => Promise<unknown>) | undefined;
declare const destroySelectedHandCard: (() => void) | undefined;
declare const useSelectedCard: (() => void) | undefined;
declare const toggleCardDetailExpanded: (() => void) | undefined;
declare const passCurrentTurn: (() => void) | undefined;
declare const GameState: GameStateType | undefined;

function requireInitHandlerModuleOrNull(id: string): any {
  if (typeof _require !== 'function') return null;
  try {
    return _require(id);
  } catch (e) {
    /* ignore */
  }
  return null;
}

const InitBootstrapShared = ((): typeof SharedUIBootstrap | null => {
  const sharedModule = requireInitHandlerModuleOrNull('../../shared/ui-bootstrap-shared');
  if (sharedModule) return sharedModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as typeof SharedUIBootstrap)) {
      return (globalThis as unknown as typeof SharedUIBootstrap);
    }
  } catch (e) { /* ignore */ }
  return null;
})();

function _getUiBootstrapModule(): typeof UIBootstrap | null {
  if (typeof _require === 'function') {
    try {
      const directBootstrap = _require('../bootstrap.js');
      if (directBootstrap && typeof directBootstrap.installGameDI === 'function') {
        return directBootstrap;
      }
    } catch (e) { /* ignore */ }
  }
  if (InitBootstrapShared && typeof InitBootstrapShared.resolveUIBootstrap === 'function') {
    return InitBootstrapShared.resolveUIBootstrap();
  }
  return (typeof UIBootstrap !== 'undefined' && UIBootstrap && typeof UIBootstrap.installGameDI === 'function')
    ? UIBootstrap
    : null;
}

function setUiInitializedFlag(value: boolean): void {
  try {
    const ready = value === true;
    if (typeof globalThis !== 'undefined') {
      (globalThis as unknown as Record<string, unknown>).__uiInitialized = ready;
    }
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__uiInitialized = ready;
    }
  } catch (e) { /* ignore */ }
}

function isBoardPerformanceStartup(): boolean {
  if (typeof location === 'undefined') return false;
  try {
    const params = new URLSearchParams(String(location.search || ''));
    return params.get('debug') === '1' && params.get('boardPerf') === '1';
  } catch (_error) {
    return false;
  }
}

async function installBoardPerformanceHarnessIfRequested(): Promise<void> {
  if (!isBoardPerformanceStartup() || typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    const loadPayload = (window as any).__CARD_REVERSI_LOAD_VITE_BOARD_PAYLOAD__;
    if (typeof loadPayload === 'function') await loadPayload.call(window, 'diagnostics');
    const module = requireInitHandlerModuleOrNull('../board-visual/performance-harness');
    if (typeof module?.installBoardVisualPerformanceHarness === 'function') {
      await module.installBoardVisualPerformanceHarness({ root: window, document });
    }
  } catch (error) {
    // The isolated page remains inspectable, but capture stays disabled when its
    // immutable artifact metadata cannot be authenticated.
    console.error('[board-perf] harness installation failed', error);
  }
}

async function waitForInitialBoardVisualReady(uiBootstrap: typeof UIBootstrap | null): Promise<any> {
  if (!uiBootstrap || typeof uiBootstrap.getBoardVisualController !== 'function') {
    throw new Error('board_visual_controller_api_unavailable');
  }
  const controller = uiBootstrap.getBoardVisualController();
  if (!controller) throw new Error('board_visual_controller_unavailable');
  if (typeof controller.waitUntilReady === 'function') {
    await controller.waitUntilReady();
  } else if (controller.ready && typeof controller.ready.then === 'function') {
    await controller.ready;
  } else {
    throw new Error('board_visual_controller_readiness_unavailable');
  }
  if (typeof controller.isReady !== 'function') {
    throw new Error('board_visual_controller_state_unavailable');
  }
  if (controller.isReady() !== true) {
    throw new Error('board_visual_controller_not_ready');
  }
  if (typeof controller.getVisualFrameDigest !== 'function') {
    throw new Error('board_visual_controller_digest_unavailable');
  }
  if (!controller.getVisualFrameDigest()) {
    throw new Error('board_visual_initial_frame_unavailable');
  }
  return controller;
}

interface InitDomElements {
  resetBtn: HTMLElement | null;
  muteBtn: HTMLElement | null;
  logToggleBtn: HTMLElement | null;
  logPanel: HTMLElement | null;
  seTypeSelect: HTMLSelectElement | null;
  seVolSlider: HTMLInputElement | null;
  bgmPlayBtn: HTMLElement | null;
  bgmPauseBtn: HTMLElement | null;
  quickBgmToggleBtn: HTMLElement | null;
  quickBgmTrackPicker: HTMLElement | null;
  bgmTrackSelect: HTMLSelectElement | null;
  bgmVolSlider: HTMLInputElement | null;
  rulesHelpBtn: HTMLElement | null;
  rulesHelpPanel: HTMLElement | null;
  gachaOpenBtn: HTMLElement | null;
  gachaOverlay: HTMLElement | null;
  gachaModal: HTMLElement | null;
  gachaCloseBtn: HTMLElement | null;
  gachaBalanceValue: HTMLElement | null;
  gachaDetailToggleBtn: HTMLElement | null;
  gachaDetailsPanel: HTMLElement | null;
  gachaSinglePullBtn: HTMLElement | null;
  gachaTenPullBtn: HTMLElement | null;
  gachaStatusText: HTMLElement | null;
  gachaResults: HTMLElement | null;
  handSkinBtn: HTMLElement | null;
  handSkinPanel: HTMLElement | null;
  handSkinCloseBtn: HTMLElement | null;
  handSkinOptions: HTMLElement | null;
  handImage: HTMLImageElement | null;
  autoToggleBtn: HTMLElement | null;
  smartBlack: HTMLSelectElement | null;
  smartWhite: HTMLSelectElement | null;
  debugModeBtn: HTMLElement | null;
  fpsToggleBtn: HTMLElement | null;
  fpsDisplay: HTMLElement | null;
  humanVsHumanBtn: HTMLElement | null;
  visualTestBtn: HTMLElement | null;
  modeCpuBtn: HTMLElement | null;
  modeNetworkBtn: HTMLElement | null;
  controlPanel: HTMLElement | null;
  deckBuilderOpenBtn: HTMLElement | null;
  deckBuilderControlSummary: HTMLElement | null;
  deckBuilderOverlay: HTMLElement | null;
  boardSizeOpenBtn: HTMLElement | null;
  boardSizeControlSummary: HTMLElement | null;
  boardSizeEditor: HTMLElement | null;
  boardShapeSelect: HTMLSelectElement | null;
  boardSizeRowsInput: HTMLInputElement | null;
  boardSizeColsInput: HTMLInputElement | null;
  boardSizeCloseBtn: HTMLElement | null;
  boardSizeEditorNote: HTMLElement | null;
  networkPanel: HTMLElement | null;
  networkAdvancedSettings: HTMLElement | null;
  networkServerInput: HTMLInputElement | null;
  networkPlayerNameInput: HTMLInputElement | null;
  networkRoomIdInput: HTMLInputElement | null;
  networkBoardSizeRowsInput: HTMLInputElement | null;
  networkBoardSizeColsInput: HTMLInputElement | null;
  networkBoardShapeSelect: HTMLSelectElement | null;
  networkBoardSizeSummary: HTMLElement | null;
  networkBoardSizeNote: HTMLElement | null;
  networkTurnTimeSecondsInput: HTMLInputElement | null;
  networkEnableDebugCheckbox: HTMLInputElement | null;
  networkEnableAutoCheckbox: HTMLInputElement | null;
  networkAllCardsDeckCheckbox: HTMLInputElement | null;
  networkCopyRoomBtn: HTMLElement | null;
  networkRoomSettingsBtn: HTMLElement | null;
  networkRoomSettingsBackdrop: HTMLElement | null;
  networkRoomSettingsPopup: HTMLElement | null;
  networkRoomSettingsCloseBtn: HTMLElement | null;
  networkCreateBtn: HTMLElement | null;
  networkJoinBtn: HTMLElement | null;
  networkLeaveBtn: HTMLElement | null;
  networkStatusText: HTMLElement | null;
  networkDeckInfo: HTMLElement | null;
  networkTimerStatus: HTMLElement | null;
  networkOverlay: HTMLElement | null;
  networkCloseBtn: HTMLElement | null;
  leaderboardOpenBtn: HTMLElement | null;
  leaderboardOverlay: HTMLElement | null;
  leaderboardPanel: HTMLElement | null;
  leaderboardCloseBtn: HTMLElement | null;
  leaderboardNameInput: HTMLInputElement | null;
  leaderboardReloadBtn: HTMLElement | null;
  leaderboardStatusText: HTMLElement | null;
  leaderboardList: HTMLElement | null;
  profileOpenBtn: HTMLElement | null;
  profileOverlay: HTMLElement | null;
  networkChatPanel: HTMLElement | null;
  networkChatToggle: HTMLElement | null;
  networkChatMessages: HTMLElement | null;
  networkChatInput: HTMLInputElement | null;
  networkChatSendBtn: HTMLElement | null;
  sidePanel: HTMLElement | null;
  sidePanelToggleBtn: HTMLElement | null;
  destroyBtn: HTMLElement | null;
  useBtn: HTMLElement | null;
  detailBtn: HTMLElement | null;
  passBtn: HTMLElement | null;
}

async function initializeUI(): Promise<void> {
  setUiInitializedFlag(false);
  const uiBootstrap = _getUiBootstrapModule();
  try {
    if (uiBootstrap && typeof uiBootstrap.installGameDI === 'function') {
      uiBootstrap.installGameDI();
    }
  } catch (e) {
    console.warn('[init] UIBootstrap.installGameDI failed', e);
  }

  const { getInitDomElements } = (typeof _require === 'function')
    ? _require('../bootstrap/init-dom')
    : (typeof window !== 'undefined' && (window as Window & { InitDOM?: { getInitDomElements: () => InitDomElements } }).InitDOM ? (window as Window & { InitDOM?: { getInitDomElements: () => InitDomElements } }).InitDOM : {}) as { getInitDomElements?: () => InitDomElements };
  const { attachInitEventListeners } = (typeof _require === 'function')
    ? _require('../bootstrap/init-events')
    : (typeof window !== 'undefined' && (window as Window & { InitEvents?: { attachInitEventListeners: (refs: InitDomElements, debugAllowed: boolean) => void } }).InitEvents ? (window as Window & { InitEvents?: { attachInitEventListeners: (refs: InitDomElements, debugAllowed: boolean) => void } }).InitEvents : {}) as { attachInitEventListeners?: (refs: InitDomElements, debugAllowed: boolean) => void };
  const { initGameSystems } = (typeof _require === 'function')
    ? _require('../bootstrap/init-game')
    : (typeof window !== 'undefined' && (window as Window & { InitGame?: { initGameSystems: () => Promise<void> } }).InitGame ? (window as Window & { InitGame?: { initGameSystems: () => Promise<void> } }).InitGame : {}) as { initGameSystems?: () => Promise<void> };
  const { initNetworkAndDebug } = (typeof _require === 'function')
    ? _require('../bootstrap/init-network')
    : (typeof window !== 'undefined' && (window as Window & { InitNetwork?: { initNetworkAndDebug: () => Promise<void> } }).InitNetwork ? (window as Window & { InitNetwork?: { initNetworkAndDebug: () => Promise<void> } }).InitNetwork : {}) as { initNetworkAndDebug?: () => Promise<void> };

  const refs = (typeof getInitDomElements === 'function') ? getInitDomElements() : {} as InitDomElements;
  const initialOptions = requireInitHandlerModuleOrNull('../bootstrap/init-events')
    || (typeof window !== 'undefined' ? (window as any).InitEvents : null);
  initialOptions?.prepareInitialGameOptions?.(refs);
  const debugAllowed = (typeof window !== 'undefined' && (window as Window & { DEBUG_MODE_ALLOWED?: boolean }).DEBUG_MODE_ALLOWED === true)
    || /[?&]debug=1/.test((typeof location !== 'undefined' && location.search) ? location.search : '')
    || /[?&]debug=true/i.test((typeof location !== 'undefined' && location.search) ? location.search : '')
    || /[?&]specialDebug=1/.test((typeof location !== 'undefined' && location.search) ? location.search : '')
    || /[?&]specialDebug=true/i.test((typeof location !== 'undefined' && location.search) ? location.search : '')
    || /[?&]special-debug=1/.test((typeof location !== 'undefined' && location.search) ? location.search : '')
    || /[?&]special-debug=true/i.test((typeof location !== 'undefined' && location.search) ? location.search : '');

  try {
    if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.installUserGestureUnlock === 'function') {
      SoundEngine.installUserGestureUnlock(typeof document !== 'undefined' ? document : null);
    }
  } catch (e) { /* ignore */ }

  const gameSystemsReady = typeof initGameSystems === 'function'
    ? Promise.resolve(initGameSystems())
    : Promise.resolve();
  const initialBoardFrameReady = (
    uiBootstrap
    && typeof uiBootstrap.prepareInitialBoardFrameSkin === 'function'
    && typeof window !== 'undefined'
  )
    ? Promise.resolve(uiBootstrap.prepareInitialBoardFrameSkin(window))
    : Promise.resolve();
  await Promise.all([gameSystemsReady, initialBoardFrameReady]);

  const boardVisualController = await waitForInitialBoardVisualReady(uiBootstrap);

  if (typeof attachInitEventListeners === 'function') {
    attachInitEventListeners(refs, debugAllowed);
  }

  const rulesHelpModule = requireInitHandlerModuleOrNull('./rules-help');
  if (
    rulesHelpModule
    && typeof rulesHelpModule.scheduleInitialHelpImageIdlePrefetch === 'function'
    && boardVisualController
    && typeof boardVisualController.waitForIdle === 'function'
    && typeof document !== 'undefined'
  ) {
    rulesHelpModule.scheduleInitialHelpImageIdlePrefetch(boardVisualController, {
      documentRef: document
    });
  }

  if (!isBoardPerformanceStartup() && typeof restoreStoredNetworkSessionOnBoot === 'function') {
    await restoreStoredNetworkSessionOnBoot();
  }

  setUiInitializedFlag(true);

  try {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'cpuSmartness', {
        configurable: false,
        enumerable: false,
        get: () => undefined,
        set: () => {}
      });
    }
  } catch (e) { /* ignore */ }

  if (typeof initNetworkAndDebug === 'function') {
    await initNetworkAndDebug();
  }

  await installBoardPerformanceHarnessIfRequested();
}

// Auto-initialize UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Promise.resolve(initializeUI()).catch((err: unknown) => {
    const error = err as Error;
    console.error('[init] initializeUI failed', error && error.message ? error.message : err);
  });
});

export = {
  initializeUI,
  setupSmartSelects: (typeof setupSmartSelects !== 'undefined') ? setupSmartSelects : function () {},
  setupSoundControls: (typeof setupSoundControls !== 'undefined') ? setupSoundControls : function () {},
  setupBgmControls: (typeof setupBgmControls !== 'undefined') ? setupBgmControls : function () {},
  loadCpuPolicy: (typeof loadCpuPolicy !== 'undefined') ? loadCpuPolicy : function () {},
  setUiInitializedFlag,
  isBoardPerformanceStartup
};

if (typeof window !== 'undefined') {
  (window as Window & { initializeUI?: typeof initializeUI }).initializeUI = initializeUI;
}
