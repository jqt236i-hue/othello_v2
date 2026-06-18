/**
 * @file init-events.ts
 * @description イベントリスナー登録
 */

import { setupSidePanelAnchor } from './side-panel-anchor';
import GameKeyboardShortcuts = require('../game-keyboard-shortcuts');

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

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
  humanVsHumanBtn: HTMLElement | null;
  visualTestBtn: HTMLElement | null;
  modeCpuBtn: HTMLElement | null;
  modeReversiBtn: HTMLElement | null;
  modeOthelloBtn: HTMLElement | null;
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
  reversiPassBtn: HTMLElement | null;
  boardFramePassBtn: HTMLElement | null;
  othelloPassBtn: HTMLElement | null;
}

declare const resetGame: (() => void) | undefined;
declare const SoundEngine: {
  init: () => void;
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
declare const destroySelectedHandCard: (() => void) | undefined;
declare const useSelectedCard: (() => void) | undefined;
declare const toggleCardDetailExpanded: (() => void) | undefined;
declare const passCurrentTurn: (() => void) | undefined;

function isNetworkSpectatorActive(root: any): boolean {
  const roots = [root, (typeof globalThis !== 'undefined' ? globalThis : null)];
  for (const candidateRoot of roots) {
    try {
      const client = candidateRoot && (candidateRoot as any).NetworkMatchClient;
      if (client && typeof client.isSpectator === 'function' && client.isSpectator() === true) return true;
    } catch (e) { /* ignore */ }
  }
  return false;
}

function emitSpectatorReadOnlyStatus(root: any): void {
  const roots = [root, (typeof globalThis !== 'undefined' ? globalThis : null)];
  for (const candidateRoot of roots) {
    try {
      const writer = candidateRoot && (candidateRoot as any).writeNetworkStatus;
      if (typeof writer !== 'function') continue;
      writer('観戦中は操作できません', true);
      return;
    } catch (e) { /* ignore */ }
  }
}

function guardSpectatorReadOnly(root: any): boolean {
  if (!isNetworkSpectatorActive(root)) return false;
  emitSpectatorReadOnlyStatus(root);
  return true;
}

function wrapSpectatorReadOnly(root: any, action: () => void): () => void {
  return () => {
    if (guardSpectatorReadOnly(root)) return;
    action();
  };
}

function syncQuickResetButtonLabel(resetBtn: HTMLElement | null, terminal: boolean): void {
  if (!resetBtn) return;
  const label = terminal ? '再戦' : 'リセット';
  resetBtn.textContent = label;
  resetBtn.setAttribute('aria-label', label);
  resetBtn.setAttribute('data-rematch-state', terminal ? 'terminal' : 'active');
  try {
    (resetBtn as HTMLButtonElement).disabled = false;
  } catch (e) { /* ignore */ }
}

function resolveCurrentGameState(root: any): any {
  if (root && root.gameState && typeof root.gameState === 'object') return root.gameState;
  if (typeof globalThis !== 'undefined' && (globalThis as any).gameState && typeof (globalThis as any).gameState === 'object') {
    return (globalThis as any).gameState;
  }
  return null;
}

function resolveIsGameOver(root: any): ((state: any) => boolean) | null {
  if (root && typeof root.isGameOver === 'function') return root.isGameOver.bind(root);
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).isGameOver === 'function') {
    return (globalThis as any).isGameOver.bind(globalThis);
  }
  return null;
}

function isCurrentGameTerminal(root: any): boolean {
  const gameStateRef = resolveCurrentGameState(root);
  const isGameOverFn = resolveIsGameOver(root);
  if (!gameStateRef || !isGameOverFn) return false;
  try {
    return isGameOverFn(gameStateRef) === true;
  } catch (e) {
    return false;
  }
}

function resolveCurrentMatchMode(root: any): string {
  try {
    if (root && typeof root.getCurrentMatchMode === 'function') {
      return String(root.getCurrentMatchMode() || '').trim().toLowerCase();
    }
  } catch (e) { /* ignore */ }
  try {
    if (root && root.MATCH_MODE) return String(root.MATCH_MODE || '').trim().toLowerCase();
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).MATCH_MODE) {
      return String((globalThis as any).MATCH_MODE || '').trim().toLowerCase();
    }
  } catch (e) { /* ignore */ }
  return '';
}

function resolveNetworkMatchClient(root: any): any {
  try {
    if (root && root.NetworkMatchClient) return root.NetworkMatchClient;
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).NetworkMatchClient) {
      return (globalThis as any).NetworkMatchClient;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function canRequestNetworkRematchFromResetButton(root: any): boolean {
  if (resolveCurrentMatchMode(root) !== 'network') return false;
  if (!isCurrentGameTerminal(root)) return false;
  const networkClient = resolveNetworkMatchClient(root);
  if (!networkClient || typeof networkClient.requestRematch !== 'function') return false;
  if (typeof networkClient.isActive === 'function' && networkClient.isActive() !== true) return false;
  return true;
}

function requestNetworkRematchFromResetButton(root: any, resetBtn: HTMLElement): void {
  const networkClient = resolveNetworkMatchClient(root);
  const button = resetBtn as HTMLButtonElement;
  const idleLabel = resetBtn.textContent || '再戦';
  button.disabled = true;
  resetBtn.textContent = '再戦中...';
  resetBtn.setAttribute('aria-label', '再戦中');
  Promise.resolve(networkClient.requestRematch())
    .then((result: any) => {
      if (result && result.ok === true) return;
      button.disabled = false;
      resetBtn.textContent = idleLabel;
      resetBtn.setAttribute('aria-label', idleLabel);
    })
    .catch(() => {
      button.disabled = false;
      resetBtn.textContent = idleLabel;
      resetBtn.setAttribute('aria-label', idleLabel);
    });
}

function setupBattleLogToggle(logToggleBtn: HTMLElement | null, logPanel: HTMLElement | null): void {
  const panel = logPanel || ((typeof document !== 'undefined') ? document.getElementById('log') : null);
  if (!logToggleBtn || !panel) return;

  const sync = (open: boolean) => {
    panel.classList.toggle('is-log-open', open);
    logToggleBtn.classList.toggle('btn-active', open);
    logToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  sync(panel.classList.contains('is-log-open'));
  logToggleBtn.addEventListener('click', () => {
    sync(!panel.classList.contains('is-log-open'));
  });
}

function attachInitEventListeners(refs: InitDomElements, debugAllowed: boolean): void {
  const root = (typeof window !== 'undefined') ? window : null;
  setupBattleLogToggle(refs.logToggleBtn, refs.logPanel);

  if (refs.resetBtn) {
    syncQuickResetButtonLabel(refs.resetBtn, isCurrentGameTerminal(root));
    refs.resetBtn.addEventListener('click', () => {
      if (canRequestNetworkRematchFromResetButton(root)) {
        requestNetworkRematchFromResetButton(root, refs.resetBtn as HTMLElement);
      } else if (typeof resetGame === 'function') {
        try { resetGame(); } catch (e: unknown) { const err = e as Error; console.error('[init] resetGame threw', err && err.message); }
        syncQuickResetButtonLabel(refs.resetBtn as HTMLElement, false);
      } else {
        console.warn('[init] resetGame not available; skipping reset');
      }
      try { if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.init === 'function') SoundEngine.init(); } catch (e) { /* ignore */ }
    });
  }

  if (typeof setupDebugControls === 'function') {
    setupDebugControls(refs.debugModeBtn, refs.humanVsHumanBtn, refs.visualTestBtn);
  } else {
    if (refs.debugModeBtn) refs.debugModeBtn.style.display = 'none';
    if (refs.humanVsHumanBtn) refs.humanVsHumanBtn.style.display = 'none';
    if (refs.visualTestBtn) refs.visualTestBtn.style.display = 'none';
  }

  if (typeof setupAutoToggle === 'function') {
    setupAutoToggle(refs.autoToggleBtn, refs.smartBlack, refs.smartWhite);
  }

  if (typeof setupMatchModeControls === 'function') {
    setupMatchModeControls({
      modeCpuBtn: refs.modeCpuBtn, modeReversiBtn: refs.modeReversiBtn || refs.modeOthelloBtn, modeOthelloBtn: refs.modeOthelloBtn, modeNetworkBtn: refs.modeNetworkBtn,
      controlPanel: refs.controlPanel, networkPanel: refs.networkPanel,
      networkAdvancedSettings: refs.networkAdvancedSettings,
      networkRoomInput: refs.networkRoomIdInput, networkServerInput: refs.networkServerInput,
      networkPlayerNameInput: refs.networkPlayerNameInput,
      networkBoardSizeRowsInput: refs.networkBoardSizeRowsInput,
      networkBoardSizeColsInput: refs.networkBoardSizeColsInput,
      networkBoardSizeSummary: refs.networkBoardSizeSummary,
      networkBoardSizeNote: refs.networkBoardSizeNote,
      networkEnableDebugCheckbox: refs.networkEnableDebugCheckbox,
      networkCopyRoomBtn: refs.networkCopyRoomBtn, networkCreateBtn: refs.networkCreateBtn,
      networkJoinBtn: refs.networkJoinBtn, networkLeaveBtn: refs.networkLeaveBtn,
      networkStatus: refs.networkStatusText, networkDeckInfo: refs.networkDeckInfo,
      networkTimerStatus: refs.networkTimerStatus, networkOverlay: refs.networkOverlay,
      networkCloseBtn: refs.networkCloseBtn, leaderboardOpenBtn: refs.leaderboardOpenBtn,
      leaderboardOverlay: refs.leaderboardOverlay, leaderboardPanel: refs.leaderboardPanel,
      leaderboardCloseBtn: refs.leaderboardCloseBtn, leaderboardNameInput: refs.leaderboardNameInput,
      leaderboardReloadBtn: refs.leaderboardReloadBtn, leaderboardStatus: refs.leaderboardStatusText,
      leaderboardList: refs.leaderboardList, networkChatPanel: refs.networkChatPanel,
      networkChatToggle: refs.networkChatToggle, networkChatMessages: refs.networkChatMessages,
      networkChatInput: refs.networkChatInput, networkChatSendBtn: refs.networkChatSendBtn,
      autoToggleBtn: refs.autoToggleBtn,
      deferStoredSessionRestore: true
    });
  }

  if (typeof setupDeckBuilderControls === 'function') {
    setupDeckBuilderControls({
      openBtn: refs.deckBuilderOpenBtn, controlSummary: refs.deckBuilderControlSummary,
      overlay: refs.deckBuilderOverlay, closeBtn: refs.deckBuilderCloseBtn,
      headerSummary: refs.deckBuilderHeaderSummary, body: refs.deckBuilderBody,
      boardSizeOpenBtn: refs.boardSizeOpenBtn, boardSizeControlSummary: refs.boardSizeControlSummary,
      boardSizeEditor: refs.boardSizeEditor, boardSizeRowsInput: refs.boardSizeRowsInput,
      boardSizeColsInput: refs.boardSizeColsInput, boardSizeCloseBtn: refs.boardSizeCloseBtn,
      boardSizeEditorNote: refs.boardSizeEditorNote
    });
  }

  if (typeof setupSmartSelects === 'function') setupSmartSelects(refs.smartBlack, refs.smartWhite);
  if (typeof setupSoundControls === 'function') setupSoundControls(refs.muteBtn, refs.seTypeSelect, refs.seVolSlider);
  if (typeof setupBgmControls === 'function') setupBgmControls(refs.bgmPlayBtn, refs.bgmPauseBtn, refs.bgmTrackSelect, refs.bgmVolSlider, refs.quickBgmTrackPicker, refs.quickBgmToggleBtn);
  if (typeof setupRulesHelp === 'function') setupRulesHelp(refs.rulesHelpBtn, refs.rulesHelpPanel);
  if (typeof setupGachaControls === 'function') setupGachaControls({ root: root as Window });
  if (typeof setupHandSkinControls === 'function') {
    setupHandSkinControls({ button: refs.handSkinBtn, panel: refs.handSkinPanel, closeBtn: refs.handSkinCloseBtn, optionsEl: refs.handSkinOptions, handImage: refs.handImage, root });
  }
  setupSidePanelAnchor({
    sidePanel: refs.sidePanel,
    sidePanelToggleBtn: refs.sidePanelToggleBtn,
    initialCollapsed: debugAllowed !== true,
    root
  });
  GameKeyboardShortcuts.setupGameKeyboardShortcuts({
    getWindowRef: () => root as (Window & Record<string, unknown>) | null
  });

  if (refs.destroyBtn && typeof destroySelectedHandCard === 'function') {
    refs.destroyBtn.addEventListener('click', wrapSpectatorReadOnly(root, () => destroySelectedHandCard()));
  }
  if (refs.useBtn && typeof useSelectedCard === 'function') {
    refs.useBtn.addEventListener('click', wrapSpectatorReadOnly(root, () => useSelectedCard()));
  }
  if (refs.detailBtn && typeof toggleCardDetailExpanded === 'function') {
    refs.detailBtn.addEventListener('click', toggleCardDetailExpanded);
  }
  if (refs.passBtn && typeof passCurrentTurn === 'function') {
    refs.passBtn.addEventListener('click', wrapSpectatorReadOnly(root, passCurrentTurn));
  }
  const reversiPassButtons = [refs.reversiPassBtn || refs.othelloPassBtn, refs.boardFramePassBtn]
    .filter((button, index, buttons): button is HTMLElement => !!button && buttons.indexOf(button) === index);
  if (typeof passCurrentTurn === 'function') {
    reversiPassButtons.forEach((button) => {
      button.addEventListener('click', wrapSpectatorReadOnly(root, passCurrentTurn));
    });
  }
}

export = {
  attachInitEventListeners,
  setupBattleLogToggle
};
