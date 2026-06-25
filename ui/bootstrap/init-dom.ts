/**
 * @file init-dom.ts
 * @description DOM要素取得
 */

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
  ratedMatchOpenBtn: HTMLElement | null;
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
  ratedMatchOverlay: HTMLElement | null;
  ratedMatchCloseBtn: HTMLElement | null;
  ratedMatchQueueBtn: HTMLElement | null;
  ratedMatchCancelBtn: HTMLElement | null;
  ratedMatchStatus: HTMLElement | null;
  ratedMatchQueueTimer: HTMLElement | null;
  ratedMatchDeckOpenBtn: HTMLElement | null;
  ratedMatchDeckNameText: HTMLElement | null;
  ratedMatchDeckSummary: HTMLElement | null;
  ratedMatchLeaderboardBtn: HTMLElement | null;
  ratedMatchHistoryBtn: HTMLElement | null;
  ratedMatchHistoryPanel: HTMLElement | null;
  ratedMatchHistoryStatus: HTMLElement | null;
  ratedMatchHistoryList: HTMLElement | null;
  ratedMatchRatingText: HTMLElement | null;
  ratedMatchIdentityText: HTMLElement | null;
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
  profileModal: HTMLElement | null;
  profileCloseBtn: HTMLElement | null;
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

function getInitDomElements(): InitDomElements {
  const $ = (id: string): HTMLElement | null => document.getElementById(id);
  return {
    resetBtn: $('resetBtn'), muteBtn: $('muteBtn'), logToggleBtn: $('logToggleBtn'), logPanel: $('log'), seTypeSelect: $('seTypeSelect') as HTMLSelectElement | null,
    seVolSlider: $('seVolSlider') as HTMLInputElement | null, bgmPlayBtn: $('bgmPlayBtn'), bgmPauseBtn: $('bgmPauseBtn'), quickBgmToggleBtn: $('quickBgmToggleBtn'), quickBgmTrackPicker: $('quickBgmTrackPicker'),
    bgmTrackSelect: $('bgmTrackSelect') as HTMLSelectElement | null, bgmVolSlider: $('bgmVolSlider') as HTMLInputElement | null,
    rulesHelpBtn: $('rulesHelpBtn'), rulesHelpPanel: $('rules-help-panel'), gachaOpenBtn: $('gachaOpenBtn'),
    gachaOverlay: $('gachaOverlay'), gachaModal: $('gachaModal'), gachaCloseBtn: $('gachaCloseBtn'),
    gachaBalanceValue: $('gachaBalanceValue'), gachaDetailToggleBtn: $('gachaDetailToggleBtn'),
    gachaDetailsPanel: $('gachaDetailsPanel'), gachaSinglePullBtn: $('gachaSinglePullBtn'),
    gachaTenPullBtn: $('gachaTenPullBtn'), gachaStatusText: $('gachaStatusText'),
    gachaResults: $('gachaResults'), handSkinBtn: $('handSkinBtn'), handSkinPanel: $('handSkinPanel'),
    handSkinCloseBtn: $('handSkinCloseBtn'), handSkinOptions: $('handSkinOptions'),
    handImage: $('handImage') as HTMLImageElement | null, autoToggleBtn: $('autoToggleBtn'), smartBlack: $('smartBlack') as HTMLSelectElement | null,
    smartWhite: $('smartWhite') as HTMLSelectElement | null, debugModeBtn: $('debugModeBtn'), humanVsHumanBtn: $('humanVsHumanBtn'),
    visualTestBtn: $('visualTestBtn'), modeCpuBtn: $('modeCpuBtn'), modeReversiBtn: $('modeReversiBtn') || $('modeOthelloBtn'), modeOthelloBtn: $('modeOthelloBtn'), modeNetworkBtn: $('modeNetworkBtn'),
    ratedMatchOpenBtn: $('ratedMatchOpenBtn'),
    controlPanel: $('control-panel'), deckBuilderOpenBtn: $('deckBuilderOpenBtn'),
    deckBuilderControlSummary: $('deckBuilderControlSummary'), deckBuilderOverlay: $('deckBuilderOverlay'),
    deckBuilderCloseBtn: $('deckBuilderCloseBtn'), deckBuilderHeaderSummary: $('deckBuilderHeaderSummary'),
    deckBuilderBody: $('deckBuilderBody'), boardSizeOpenBtn: $('boardSizeOpenBtn'),
    boardSizeControlSummary: $('boardSizeControlSummary'), boardSizeEditor: $('boardSizeEditor'),
    boardSizeRowsInput: $('boardSizeRowsInput') as HTMLInputElement | null, boardSizeColsInput: $('boardSizeColsInput') as HTMLInputElement | null,
    boardSizeCloseBtn: $('boardSizeCloseBtn'), boardSizeEditorNote: $('boardSizeEditorNote'),
    networkPanel: $('networkPanel'), networkAdvancedSettings: $('networkAdvancedSettings'),
    networkServerInput: $('networkServerInput') as HTMLInputElement | null, networkPlayerNameInput: $('networkPlayerNameInput') as HTMLInputElement | null,
    networkRoomIdInput: $('networkRoomIdInput') as HTMLInputElement | null, networkBoardSizeRowsInput: $('networkBoardSizeRowsInput') as HTMLInputElement | null,
    networkBoardSizeColsInput: $('networkBoardSizeColsInput') as HTMLInputElement | null, networkBoardSizeSummary: $('networkBoardSizeSummary'),
    networkBoardSizeNote: $('networkBoardSizeNote'), networkEnableDebugCheckbox: $('networkEnableDebugCheckbox') as HTMLInputElement | null,
    networkEnableAutoCheckbox: $('networkEnableAutoCheckbox') as HTMLInputElement | null,
    networkAllCardsDeckCheckbox: $('networkAllCardsDeckCheckbox') as HTMLInputElement | null,
    networkCopyRoomBtn: $('networkCopyRoomBtn'), networkRoomSettingsBtn: $('networkRoomSettingsBtn'),
    networkRoomSettingsBackdrop: $('networkRoomSettingsBackdrop'), networkRoomSettingsPopup: $('networkRoomSettingsPopup'), networkRoomSettingsCloseBtn: $('networkRoomSettingsCloseBtn'),
    networkCreateBtn: $('networkCreateBtn'),
    networkJoinBtn: $('networkJoinBtn'), networkLeaveBtn: $('networkLeaveBtn'),
    networkStatusText: $('networkStatusText'), networkDeckInfo: $('networkDeckInfo'),
    networkTimerStatus: $('networkTimerStatus'), networkOverlay: $('networkOverlay'),
    networkCloseBtn: $('networkCloseBtn'), ratedMatchOverlay: $('ratedMatchOverlay'),
    ratedMatchCloseBtn: $('ratedMatchCloseBtn'), ratedMatchQueueBtn: $('ratedMatchQueueBtn'),
    ratedMatchCancelBtn: $('ratedMatchCancelBtn'), ratedMatchStatus: $('ratedMatchStatus'),
    ratedMatchQueueTimer: $('ratedMatchQueueTimer'),
    ratedMatchDeckOpenBtn: $('ratedMatchDeckOpenBtn'),
    ratedMatchDeckNameText: $('ratedMatchDeckNameText'),
    ratedMatchDeckSummary: $('ratedMatchDeckSummary'), ratedMatchRatingText: $('ratedMatchRatingText'),
    ratedMatchLeaderboardBtn: $('ratedMatchLeaderboardBtn'), ratedMatchHistoryBtn: $('ratedMatchHistoryBtn'),
    ratedMatchHistoryPanel: $('ratedMatchHistoryPanel'), ratedMatchHistoryStatus: $('ratedMatchHistoryStatus'),
    ratedMatchHistoryList: $('ratedMatchHistoryList'),
    ratedMatchIdentityText: $('ratedMatchIdentityText'),
    leaderboardOpenBtn: $('leaderboardOpenBtn'),
    leaderboardOverlay: $('leaderboardOverlay'), leaderboardPanel: $('leaderboardModal'),
    leaderboardCloseBtn: $('leaderboardCloseBtn'), leaderboardNameInput: $('leaderboardNameInput') as HTMLInputElement | null,
    leaderboardReloadBtn: $('leaderboardReloadBtn'), leaderboardStatusText: $('leaderboardStatusText'),
    leaderboardList: $('leaderboardList'), profileOpenBtn: $('profileOpenBtn'),
    profileOverlay: $('profileOverlay'), profileModal: $('profileModal'), profileCloseBtn: $('profileCloseBtn'),
    networkChatPanel: $('networkChatPanel'),
    networkChatToggle: $('networkChatToggle'), networkChatMessages: $('networkChatMessages'),
    networkChatInput: $('networkChatInput') as HTMLInputElement | null, networkChatSendBtn: $('networkChatSendBtn'),
    sidePanel: $('side-panel'), sidePanelToggleBtn: $('sidePanelToggleBtn'),
    destroyBtn: $('destroy-card-btn'), useBtn: $('use-card-btn'),
    detailBtn: $('toggle-card-detail-btn'), passBtn: $('pass-btn'), reversiPassBtn: $('reversi-pass-btn') || $('othello-pass-btn'), boardFramePassBtn: $('board-frame-pass-btn'), othelloPassBtn: $('othello-pass-btn')
  };
}

export = {
  getInitDomElements
};
