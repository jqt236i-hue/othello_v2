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
} | undefined;

declare const SharedUIBootstrap: {
  resolveUIBootstrap: () => typeof UIBootstrap;
} | undefined;

declare const loadCpuPolicy: (() => void) | undefined;
declare const resetGame: (() => void) | undefined;
declare const SoundEngine: {
  primeEffectSounds: () => void;
} | undefined;
declare const setupDebugControls: ((btn: HTMLElement | null, hvhhBtn: HTMLElement | null, vtBtn: HTMLElement | null) => void) | undefined;
declare const setupAutoToggle: ((btn: HTMLElement | null, sb: HTMLSelectElement | null, sw: HTMLSelectElement | null) => void) | undefined;
declare const setupMatchModeControls: ((opts: Record<string, HTMLElement | null>) => void) | undefined;
declare const setupDeckBuilderControls: ((opts: Record<string, HTMLElement | null>) => unknown) | undefined;
declare const setupSmartSelects: ((sb: HTMLSelectElement | null, sw: HTMLSelectElement | null) => void) | undefined;
declare const setupSoundControls: ((muteBtn: HTMLElement | null, seType: HTMLSelectElement | null, seVol: HTMLInputElement | null) => void) | undefined;
declare const setupBgmControls: ((playBtn: HTMLElement | null, pauseBtn: HTMLElement | null, trackSel: HTMLSelectElement | null, volSlider: HTMLInputElement | null) => void) | undefined;
declare const setupRulesHelp: ((btn: HTMLElement | null, panel: HTMLElement | null) => void) | undefined;
declare const setupGachaControls: ((opts: { root: Window }) => void) | undefined;
declare const setupHandSkinControls: ((opts: Record<string, unknown>) => void) | undefined;
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

interface InitDomElements {
  resetBtn: HTMLElement | null;
  muteBtn: HTMLElement | null;
  seTypeSelect: HTMLSelectElement | null;
  seVolSlider: HTMLInputElement | null;
  bgmPlayBtn: HTMLElement | null;
  bgmPauseBtn: HTMLElement | null;
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
  humanVsHumanBtn: HTMLElement | null;
  visualTestBtn: HTMLElement | null;
  modeCpuBtn: HTMLElement | null;
  modeNetworkBtn: HTMLElement | null;
  controlPanel: HTMLElement | null;
  deckBuilderOpenBtn: HTMLElement | null;
  deckBuilderControlSummary: HTMLElement | null;
  deckBuilderOverlay: HTMLElement | null;
  deckBuilderCloseBtn: HTMLElement | null;
  deckBuilderHeaderSummary: HTMLElement | null;
  deckBuilderBody: HTMLElement | null;
  boardSizeOpenBtn: HTMLElement | null;
  boardSizeControlSummary: HTMLElement | null;
  boardSizeEditor: HTMLElement | null;
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
  networkBoardSizeSummary: HTMLElement | null;
  networkBoardSizeNote: HTMLElement | null;
  networkEnableDebugCheckbox: HTMLInputElement | null;
  networkCopyRoomBtn: HTMLElement | null;
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
  try {
    const uiBootstrap = _getUiBootstrapModule();
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
  const debugAllowed = (typeof window !== 'undefined' && (window as Window & { DEBUG_MODE_ALLOWED?: boolean }).DEBUG_MODE_ALLOWED === true)
    || /[?&]debug=1/.test((typeof location !== 'undefined' && location.search) ? location.search : '')
    || /[?&]debug=true/.test((typeof location !== 'undefined' && location.search) ? location.search : '');

  try {
    if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.primeEffectSounds === 'function') {
      SoundEngine.primeEffectSounds();
    }
  } catch (e) { /* ignore */ }

  if (typeof attachInitEventListeners === 'function') {
    attachInitEventListeners(refs, debugAllowed);
  }

  if (typeof initGameSystems === 'function') {
    await initGameSystems();
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
  setUiInitializedFlag
};

if (typeof window !== 'undefined') {
  (window as Window & { initializeUI?: typeof initializeUI }).initializeUI = initializeUI;
}
