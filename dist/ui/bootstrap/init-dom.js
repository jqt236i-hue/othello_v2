"use strict";
/**
 * @file init-dom.ts
 * @description DOM要素取得
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function getInitDomElements() {
    const $ = (id) => document.getElementById(id);
    return {
        resetBtn: $('resetBtn'), muteBtn: $('muteBtn'), seTypeSelect: $('seTypeSelect'),
        seVolSlider: $('seVolSlider'), bgmPlayBtn: $('bgmPlayBtn'), bgmPauseBtn: $('bgmPauseBtn'),
        bgmTrackSelect: $('bgmTrackSelect'), bgmVolSlider: $('bgmVolSlider'), storyBtn: $('storyBtn'),
        storyMenuOverlay: $('storyMenuOverlay'), tutorialOverlay: $('tutorialOverlay'),
        rulesHelpBtn: $('rulesHelpBtn'), rulesHelpPanel: $('rules-help-panel'), gachaOpenBtn: $('gachaOpenBtn'),
        gachaOverlay: $('gachaOverlay'), gachaModal: $('gachaModal'), gachaCloseBtn: $('gachaCloseBtn'),
        gachaBalanceValue: $('gachaBalanceValue'), gachaDetailToggleBtn: $('gachaDetailToggleBtn'),
        gachaDetailsPanel: $('gachaDetailsPanel'), gachaSinglePullBtn: $('gachaSinglePullBtn'),
        gachaTenPullBtn: $('gachaTenPullBtn'), gachaStatusText: $('gachaStatusText'),
        gachaResults: $('gachaResults'), handSkinBtn: $('handSkinBtn'), handSkinPanel: $('handSkinPanel'),
        handSkinCloseBtn: $('handSkinCloseBtn'), handSkinOptions: $('handSkinOptions'),
        handImage: $('handImage'), autoToggleBtn: $('autoToggleBtn'), smartBlack: $('smartBlack'),
        smartWhite: $('smartWhite'), debugModeBtn: $('debugModeBtn'), humanVsHumanBtn: $('humanVsHumanBtn'),
        visualTestBtn: $('visualTestBtn'), modeCpuBtn: $('modeCpuBtn'), modeNetworkBtn: $('modeNetworkBtn'),
        controlPanel: $('control-panel'), deckBuilderOpenBtn: $('deckBuilderOpenBtn'),
        deckBuilderControlSummary: $('deckBuilderControlSummary'), deckBuilderOverlay: $('deckBuilderOverlay'),
        deckBuilderCloseBtn: $('deckBuilderCloseBtn'), deckBuilderHeaderSummary: $('deckBuilderHeaderSummary'),
        deckBuilderBody: $('deckBuilderBody'), boardSizeOpenBtn: $('boardSizeOpenBtn'),
        boardSizeControlSummary: $('boardSizeControlSummary'), boardSizeEditor: $('boardSizeEditor'),
        boardSizeRowsInput: $('boardSizeRowsInput'), boardSizeColsInput: $('boardSizeColsInput'),
        boardSizeCloseBtn: $('boardSizeCloseBtn'), boardSizeEditorNote: $('boardSizeEditorNote'),
        networkPanel: $('networkPanel'), networkAdvancedSettings: $('networkAdvancedSettings'),
        networkServerInput: $('networkServerInput'), networkPlayerNameInput: $('networkPlayerNameInput'),
        networkRoomIdInput: $('networkRoomIdInput'), networkBoardSizeRowsInput: $('networkBoardSizeRowsInput'),
        networkBoardSizeColsInput: $('networkBoardSizeColsInput'), networkBoardSizeSummary: $('networkBoardSizeSummary'),
        networkBoardSizeNote: $('networkBoardSizeNote'), networkEnableDebugCheckbox: $('networkEnableDebugCheckbox'),
        networkCopyRoomBtn: $('networkCopyRoomBtn'), networkCreateBtn: $('networkCreateBtn'),
        networkJoinBtn: $('networkJoinBtn'), networkLeaveBtn: $('networkLeaveBtn'),
        networkStatusText: $('networkStatusText'), networkDeckInfo: $('networkDeckInfo'),
        networkTimerStatus: $('networkTimerStatus'), networkOverlay: $('networkOverlay'),
        networkCloseBtn: $('networkCloseBtn'), leaderboardOpenBtn: $('leaderboardOpenBtn'),
        leaderboardOverlay: $('leaderboardOverlay'), leaderboardPanel: $('leaderboardModal'),
        leaderboardCloseBtn: $('leaderboardCloseBtn'), leaderboardNameInput: $('leaderboardNameInput'),
        leaderboardReloadBtn: $('leaderboardReloadBtn'), leaderboardStatusText: $('leaderboardStatusText'),
        leaderboardList: $('leaderboardList'), networkChatPanel: $('networkChatPanel'),
        networkChatToggle: $('networkChatToggle'), networkChatMessages: $('networkChatMessages'),
        networkChatInput: $('networkChatInput'), networkChatSendBtn: $('networkChatSendBtn'),
        sidePanel: $('side-panel'), sidePanelToggleBtn: $('sidePanelToggleBtn'),
        destroyBtn: $('destroy-card-btn'), useBtn: $('use-card-btn'),
        detailBtn: $('toggle-card-detail-btn'), passBtn: $('pass-btn')
    };
}
module.exports = {
    getInitDomElements
};
//# sourceMappingURL=init-dom.js.map