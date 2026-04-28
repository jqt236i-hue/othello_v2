"use strict";
/**
 * @file init-events.ts
 * @description イベントリスナー登録
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function attachInitEventListeners(refs, debugAllowed) {
    const root = (typeof window !== 'undefined') ? window : null;
    if (refs.resetBtn) {
        refs.resetBtn.addEventListener('click', () => {
            if (typeof resetGame === 'function') {
                try {
                    resetGame();
                }
                catch (e) {
                    const err = e;
                    console.error('[init] resetGame threw', err && err.message);
                }
            }
            else {
                console.warn('[init] resetGame not available; skipping reset');
            }
            try {
                if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.init === 'function')
                    SoundEngine.init();
            }
            catch (e) { /* ignore */ }
        });
    }
    if (typeof setupDebugControls === 'function') {
        setupDebugControls(refs.debugModeBtn, refs.humanVsHumanBtn, refs.visualTestBtn);
    }
    else {
        if (refs.debugModeBtn)
            refs.debugModeBtn.style.display = 'none';
        if (refs.humanVsHumanBtn)
            refs.humanVsHumanBtn.style.display = 'none';
        if (refs.visualTestBtn)
            refs.visualTestBtn.style.display = 'none';
    }
    if (typeof setupAutoToggle === 'function') {
        setupAutoToggle(refs.autoToggleBtn, refs.smartBlack, refs.smartWhite);
    }
    if (typeof setupMatchModeControls === 'function') {
        setupMatchModeControls({
            modeCpuBtn: refs.modeCpuBtn, modeNetworkBtn: refs.modeNetworkBtn,
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
            autoToggleBtn: refs.autoToggleBtn
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
    if (typeof setupSmartSelects === 'function')
        setupSmartSelects(refs.smartBlack, refs.smartWhite);
    if (typeof setupSoundControls === 'function')
        setupSoundControls(refs.muteBtn, refs.seTypeSelect, refs.seVolSlider);
    if (typeof setupBgmControls === 'function')
        setupBgmControls(refs.bgmPlayBtn, refs.bgmPauseBtn, refs.bgmTrackSelect, refs.bgmVolSlider);
    if (typeof setupRulesHelp === 'function')
        setupRulesHelp(refs.rulesHelpBtn, refs.rulesHelpPanel);
    if (typeof setupGachaControls === 'function')
        setupGachaControls({ root: root });
    if (typeof setupHandSkinControls === 'function') {
        setupHandSkinControls({ button: refs.handSkinBtn, panel: refs.handSkinPanel, closeBtn: refs.handSkinCloseBtn, optionsEl: refs.handSkinOptions, handImage: refs.handImage, root });
    }
    if (typeof setupStoryControls === 'function')
        setupStoryControls(refs.storyBtn, refs.storyMenuOverlay, refs.tutorialOverlay);
    if (typeof setupStoryBattleUi === 'function') {
        setupStoryBattleUi({ root, soundRefs: { muteBtn: refs.muteBtn, seVolSlider: refs.seVolSlider, bgmVolSlider: refs.bgmVolSlider, bgmTrackSelect: refs.bgmTrackSelect } });
    }
    if (refs.sidePanel && refs.sidePanelToggleBtn) {
        const applySidePanelCollapsedState = (collapsed) => {
            const isCollapsed = collapsed === true;
            refs.sidePanel.classList.toggle('side-panel-collapsed', isCollapsed);
            refs.sidePanelToggleBtn.textContent = isCollapsed ? '＋' : '−';
            refs.sidePanelToggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            const label = isCollapsed ? '操作パネルを開く' : '操作パネルを閉じる';
            refs.sidePanelToggleBtn.setAttribute('aria-label', label);
            refs.sidePanelToggleBtn.title = label;
        };
        const docRoot = document.documentElement;
        const rootProfile = docRoot ? String(docRoot.getAttribute('data-layout-profile') || '').trim() : '';
        const isPhonePortraitProfile = !!(docRoot && docRoot.classList.contains('layout-profile-phone-portrait')) || rootProfile === 'layout-profile-phone-portrait';
        applySidePanelCollapsedState(isPhonePortraitProfile);
        if (refs.sidePanelToggleBtn.dataset.sidePanelToggleBound !== '1') {
            refs.sidePanelToggleBtn.addEventListener('click', () => {
                applySidePanelCollapsedState(!refs.sidePanel.classList.contains('side-panel-collapsed'));
            });
            refs.sidePanelToggleBtn.dataset.sidePanelToggleBound = '1';
        }
    }
    if (refs.destroyBtn && typeof destroySelectedHandCard === 'function') {
        refs.destroyBtn.addEventListener('click', () => destroySelectedHandCard());
    }
    if (refs.useBtn && typeof useSelectedCard === 'function') {
        refs.useBtn.addEventListener('click', () => useSelectedCard());
    }
    if (refs.detailBtn && typeof toggleCardDetailExpanded === 'function') {
        refs.detailBtn.addEventListener('click', toggleCardDetailExpanded);
    }
    if (refs.passBtn && typeof passCurrentTurn === 'function') {
        refs.passBtn.addEventListener('click', passCurrentTurn);
    }
}
module.exports = {
    attachInitEventListeners
};
//# sourceMappingURL=init-events.js.map