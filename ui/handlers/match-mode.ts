import type { CardState, GameState, PlayerKey } from '../../src/types';

declare var cardState: any;
declare var gameState: any;
declare var emitBoardUpdate: any;
declare var renderBoard: any;
declare var renderCardUI: any;
declare var addLog: any;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const root: any = (typeof window !== 'undefined' ? window : globalThis);
const DeckCodecModule = (() => {
    try {
        return _require('../../shared/deck-codec');
    } catch (e) {
        return null;
    }
})();
const SharedUIBootstrapModule = (() => {
    try {
        return _require('../../shared/ui-bootstrap-shared');
    } catch (e) {
        return null;
    }
})();
const MatchModeLeaderboardControllerModule = (() => {
    try {
        return _require('./match-mode/leaderboard-controller');
    } catch (e) {
        return null;
    }
})();
const MatchModeNetworkButtonsModule = (() => {
    try {
        return _require('./match-mode/network-buttons');
    } catch (e) {
        return null;
    }
})();

const MODE_CPU = 'cpu';
const MODE_REVERSI = 'reversi';
const MODE_OTHELLO = 'othello';
    const MODE_NETWORK = 'network';
    const CHAT_INPUT_FALLBACK_MAX = 20;
    const PLAYER_NAME_MAX = 7;
    const DEFAULT_PLAYER_NAME = 'ななし';

    let currentMode = MODE_CPU;
    let networkChatVisible = false;
    let networkStatusBaseText = '';
    let networkStatusBaseIsError = false;
    let networkTurnTimerInfo: any = null;
    let networkRoomDebugEnabled = false;
    let networkRoomAutoEnabled = false;
    let selectedNetworkRoomId = '';

    const uiRefs: any = {
        modeCpuBtn: null,
        modeReversiBtn: null,
        modeNetworkBtn: null,
        controlPanel: null,
        networkPanel: null,
        networkAdvancedSettings: null,
        networkRoomInput: null,
        networkServerInput: null,
        networkPlayerNameInput: null,
        networkBoardSizeRowsInput: null,
        networkBoardSizeColsInput: null,
        networkBoardSizeSummary: null,
        networkBoardSizeNote: null,
        networkEnableDebugCheckbox: null,
        networkEnableAutoCheckbox: null,
        networkCopyRoomBtn: null,
        networkRoomSettingsBtn: null,
        networkRoomSettingsBackdrop: null,
        networkRoomSettingsPopup: null,
        networkRoomSettingsCloseBtn: null,
        networkCreateBtn: null,
        networkJoinBtn: null,
        networkRoomPasswordInput: null,
        networkRoomListRefreshBtn: null,
        networkRoomList: null,
        networkLeaveBtn: null,
        networkStatus: null,
        networkDeckInfo: null,
        networkTimerStatus: null,
        networkOverlay: null,
        networkCloseBtn: null,
        leaderboardOpenBtn: null,
        leaderboardOverlay: null,
        leaderboardPanel: null,
        leaderboardCloseBtn: null,
        leaderboardNameInput: null,
        leaderboardReloadBtn: null,
        leaderboardStatus: null,
        leaderboardList: null,
        networkChatPanel: null,
        networkChatToggle: null,
        networkChatMessages: null,
        networkChatInput: null,
        networkChatSendBtn: null,
        autoToggleBtn: null,
        baseControlPanelHeight: 0,
        layoutObserver: null,
        layoutBound: false,
        layoutSyncRaf: 0
    };

    function normalizeMode(mode: any) {
        if (mode === MODE_REVERSI || mode === MODE_OTHELLO) return MODE_REVERSI;
        if (mode === MODE_NETWORK) return MODE_NETWORK;
        return MODE_CPU;
    }

    function shouldClearHumanVsHumanMode(mode: any) {
        return mode === MODE_NETWORK || mode === MODE_REVERSI;
    }

    function shouldDisableAutoMode(mode: any) {
        if (mode !== MODE_NETWORK) return false;
        return networkRoomAutoEnabled !== true || isNetworkSpectatorActive();
    }

    function getCurrentMode() {
        return currentMode;
    }

    function isLocalOrNetworkMode() {
        // Compatibility shim: local mode was removed, keep exported name for existing callers.
        return currentMode === MODE_NETWORK;
    }

    function isNetworkModeActive() {
        return currentMode === MODE_NETWORK;
    }

    function isReversiModeActive() {
        return currentMode === MODE_REVERSI;
    }

    function isOthelloModeActive() {
        return isReversiModeActive();
    }

    function normalizePlayerName(value: any) {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        return Array.from(normalized).slice(0, PLAYER_NAME_MAX).join('');
    }

    function getSharedPlayerName() {
        try {
            if (root.LeaderboardClient && typeof root.LeaderboardClient.getPlayerName === 'function') {
                return normalizePlayerName(root.LeaderboardClient.getPlayerName());
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    function getDeckBuilderController() {
        try {
            if (root.UIBootstrap && typeof root.UIBootstrap.getRegisteredUIGlobals === 'function') {
                const globals = root.UIBootstrap.getRegisteredUIGlobals() || {};
                if (globals.DeckBuilderController) {
                    return globals.DeckBuilderController;
                }
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function readActiveLocalDeckSelection() {
        const controller = getDeckBuilderController();
        if (!controller || typeof controller.getActiveLocalChoice !== 'function') {
            return { choice: null, deckCode: '', invalidCustomDeck: false };
        }
        try {
            const choice = controller.getActiveLocalChoice();
            const deckCode = (choice && choice.mode === 'custom') ? String(choice.deckCode || '').trim() : '';
            if (!deckCode) {
                return { choice, deckCode: '', invalidCustomDeck: false };
            }
            if (!/^D\d+C\d+:/i.test(deckCode)) {
                return { choice, deckCode: '', invalidCustomDeck: true };
            }
            if (!DeckCodecModule || typeof DeckCodecModule.safeDecodeDeckCode !== 'function') {
                return { choice, deckCode, invalidCustomDeck: false };
            }
            const decoded = DeckCodecModule.safeDecodeDeckCode(deckCode);
            if (!decoded || decoded.ok !== true || !decoded.deckSpec) {
                return { choice, deckCode: '', invalidCustomDeck: true };
            }
            return { choice, deckCode, invalidCustomDeck: false };
        } catch (e) {
            return { choice: null, deckCode: '', invalidCustomDeck: false };
        }
    }

    function notifyInvalidCustomDeckFallback(selection: any) {
        if (selection && selection.invalidCustomDeck) {
            writeNetworkStatus('選択中のカスタムデッキを読み込めなかったため、標準デッキで続行します', false);
        }
    }

    function getActiveLocalBoardConfig() {
        const controller = getDeckBuilderController();
        if (!controller || typeof controller.getLocalBoardConfig !== 'function') {
            return null;
        }
        try {
            return controller.getLocalBoardConfig();
        } catch (e) {
            return null;
        }
    }

    function createDefaultBoardConfig() {
        try {
            if (root.SharedBoardUtils && typeof root.SharedBoardUtils.createDefaultBoardConfig === 'function') {
                return root.SharedBoardUtils.createDefaultBoardConfig();
            }
        } catch (e) { /* ignore */ }
        return {
            rows: 8,
            cols: 8,
            standard8x8: true
        };
    }

    function normalizeBoardConfig(boardConfig: any, fallbackBoardConfig?: any) {
        const fallback = (fallbackBoardConfig && typeof fallbackBoardConfig === 'object')
            ? fallbackBoardConfig
            : createDefaultBoardConfig();
        try {
            if (root.SharedBoardUtils && typeof root.SharedBoardUtils.normalizeBoardConfig === 'function') {
                return root.SharedBoardUtils.normalizeBoardConfig(boardConfig, fallback);
            }
        } catch (e) { /* ignore */ }
        const fallbackRows = Number.isFinite(Number(fallback && fallback.rows)) ? Number(fallback.rows) : 8;
        const fallbackCols = Number.isFinite(Number(fallback && fallback.cols)) ? Number(fallback.cols) : 8;
        const rows = Number.isFinite(Number(boardConfig && boardConfig.rows)) ? Number(boardConfig.rows) : fallbackRows;
        const cols = Number.isFinite(Number(boardConfig && boardConfig.cols)) ? Number(boardConfig.cols) : fallbackCols;
        return {
            rows,
            cols,
            standard8x8: rows === 8 && cols === 8
        };
    }

    function getBoardDimensionBounds(axis: any) {
        try {
            if (root.SharedBoardUtils && typeof root.SharedBoardUtils.getBoardDimensionBounds === 'function') {
                return root.SharedBoardUtils.getBoardDimensionBounds(axis);
            }
        } catch (e) { /* ignore */ }
        return axis === 'col'
            ? { min: 4, max: 10 }
            : { min: 4, max: 10 };
    }

    function stepBoardDimensionValue(value: any, direction: any, fallbackValue: any, axis: any) {
        try {
            if (root.SharedBoardUtils && typeof root.SharedBoardUtils.stepBoardDimensionValue === 'function') {
                return root.SharedBoardUtils.stepBoardDimensionValue(value, direction, fallbackValue, axis);
            }
        } catch (e) { /* ignore */ }
        const bounds = getBoardDimensionBounds(axis);
        const fallback = Number.isFinite(Number(fallbackValue)) ? Number(fallbackValue) : 8;
        const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
        const step = Number(direction) > 0 ? 1 : -1;
        return Math.max(bounds.min, Math.min(bounds.max, Math.floor(numeric + step)));
    }

    function readPrimaryWheelDelta(event: any) {
        const deltaX = Number(event && event.deltaX) || 0;
        const deltaY = Number(event && event.deltaY) || 0;
        return Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    }

    function applyBoardDimensionInputBounds(inputRef: any, axis: any) {
        if (!inputRef) return;
        const bounds = getBoardDimensionBounds(axis);
        inputRef.min = String(bounds.min);
        inputRef.max = String(bounds.max);
    }

    function getPendingRoomBoardConfig() {
        const localBoardConfig = getActiveLocalBoardConfig();
        if (localBoardConfig) {
            return normalizeBoardConfig(localBoardConfig);
        }
        if (uiRefs.networkBoardSizeRowsInput || uiRefs.networkBoardSizeColsInput) {
            return normalizeBoardConfig({
                rows: uiRefs.networkBoardSizeRowsInput ? uiRefs.networkBoardSizeRowsInput.value : null,
                cols: uiRefs.networkBoardSizeColsInput ? uiRefs.networkBoardSizeColsInput.value : null
            });
        }
        return createDefaultBoardConfig();
    }

    function getRoomBoardConfig(roomState: any) {
        let roomBoardConfig = roomState && roomState.roomBoardConfig;
        if (!roomBoardConfig && root.NetworkMatchClient && typeof root.NetworkMatchClient.getRoomBoardConfig === 'function') {
            try {
                roomBoardConfig = root.NetworkMatchClient.getRoomBoardConfig();
            } catch (e) { /* ignore */ }
        }
        if (!roomBoardConfig || typeof roomBoardConfig !== 'object') {
            return null;
        }
        return normalizeBoardConfig(roomBoardConfig);
    }

    function formatBoardConfigLabel(boardConfig: any) {
        const normalizedBoardConfig = normalizeBoardConfig(boardConfig);
        return `${normalizedBoardConfig.rows}x${normalizedBoardConfig.cols}`;
    }

    function hasCustomRoomBoardConfig(boardConfig: any) {
        if (!boardConfig || typeof boardConfig !== 'object') return false;
        const rows = Number(boardConfig.rows);
        const cols = Number(boardConfig.cols);
        return !(rows === 8 && cols === 8);
    }

    function formatPendingRoomDeckText() {
        const selection = readActiveLocalDeckSelection();
        const choice = selection.choice;
        if (!choice) {
            return '作成時に送るデッキ: デフォルトデッキ';
        }
        try {
            if (choice.mode === 'custom' && selection.invalidCustomDeck !== true) {
                const deckSize = Number.isFinite(Number(choice.deckSize)) ? Number(choice.deckSize) : 30;
                return `作成時に送るデッキ: カスタム ${deckSize}枚`;
            }
            const standardSize = Number.isFinite(Number(choice && choice.deckSize)) ? Number(choice.deckSize) : 30;
            return `作成時に送るデッキ: デフォルト ${standardSize}枚`;
        } catch (e) {
            return '作成時に送るデッキ: デフォルトデッキ';
        }
    }

    function formatPendingRoomSettingsText() {
        return `${formatPendingRoomDeckText()} / 作成時に送る盤面: ${formatBoardConfigLabel(getPendingRoomBoardConfig())}`;
    }

    function renderNetworkBoardSizeControls(roomState: any) {
        const roomBoardConfig = getRoomBoardConfig(roomState);
        const activeBoardConfig = roomBoardConfig || getPendingRoomBoardConfig();
        const locked = !!roomBoardConfig;

        if (uiRefs.networkBoardSizeSummary) {
            uiRefs.networkBoardSizeSummary.textContent = locked
                ? `${formatBoardConfigLabel(activeBoardConfig)} / 部屋固定`
                : formatBoardConfigLabel(activeBoardConfig);
            uiRefs.networkBoardSizeSummary.classList.toggle('is-room-override', locked);
        }
        if (uiRefs.networkBoardSizeRowsInput) {
            applyBoardDimensionInputBounds(uiRefs.networkBoardSizeRowsInput, 'row');
            uiRefs.networkBoardSizeRowsInput.value = String(activeBoardConfig.rows);
            uiRefs.networkBoardSizeRowsInput.disabled = locked;
        }
        if (uiRefs.networkBoardSizeColsInput) {
            applyBoardDimensionInputBounds(uiRefs.networkBoardSizeColsInput, 'col');
            uiRefs.networkBoardSizeColsInput.value = String(activeBoardConfig.cols);
            uiRefs.networkBoardSizeColsInput.disabled = locked;
        }
        if (uiRefs.networkBoardSizeNote) {
            uiRefs.networkBoardSizeNote.textContent = locked
                ? 'ネット対戦中は部屋で決めた盤面サイズを使います'
                : '部屋作成前に変更できます';
            uiRefs.networkBoardSizeNote.classList.toggle('is-room-override', locked);
        }
    }

    function updatePendingRoomBoardConfigFromInputs() {
        const controller = getDeckBuilderController();
        const nextBoardConfig = normalizeBoardConfig({
            rows: uiRefs.networkBoardSizeRowsInput ? uiRefs.networkBoardSizeRowsInput.value : null,
            cols: uiRefs.networkBoardSizeColsInput ? uiRefs.networkBoardSizeColsInput.value : null
        }, getPendingRoomBoardConfig());
        if (controller && typeof controller.setLocalBoardConfig === 'function') {
            controller.setLocalBoardConfig(nextBoardConfig);
        }
        renderNetworkDeckInfo();
    }

    function formatSeatDeckText(seatLabel: any, deckCode: any, deckSize: any) {
        if (deckCode) {
            const customSize = Number.isFinite(Number(deckSize)) ? Number(deckSize) : 30;
            return `${seatLabel}カスタム ${customSize}枚`;
        }
        if (Number.isFinite(Number(deckSize))) {
            return `${seatLabel}デフォルト ${Number(deckSize)}枚`;
        }
        return `${seatLabel}デフォルトデッキ`;
    }

    function hasCustomRoomDeck(roomDeck: any) {
        if (!roomDeck || typeof roomDeck !== 'object') return false;
        if (roomDeck.deckCode) return true;
        const byPlayer = roomDeck.deckCodeByPlayer && typeof roomDeck.deckCodeByPlayer === 'object'
            ? roomDeck.deckCodeByPlayer
            : null;
        return !!(byPlayer && (byPlayer.black || byPlayer.white));
    }

    function formatRoomDeckText(roomDeck: any) {
        if (!roomDeck || typeof roomDeck !== 'object') {
            return formatPendingRoomDeckText();
        }
        if (roomDeck.mode === 'perPlayer') {
            const deckCodeByPlayer = (roomDeck.deckCodeByPlayer && typeof roomDeck.deckCodeByPlayer === 'object')
                ? roomDeck.deckCodeByPlayer
                : {};
            const deckSizeByPlayer = (roomDeck.deckSizeByPlayer && typeof roomDeck.deckSizeByPlayer === 'object')
                ? roomDeck.deckSizeByPlayer
                : {};
            return `部屋デッキ: ${formatSeatDeckText('黒', deckCodeByPlayer.black, deckSizeByPlayer.black)} / ${formatSeatDeckText('白', deckCodeByPlayer.white, deckSizeByPlayer.white)}`;
        }
        if (roomDeck.deckCode) {
            const deckSize = Number.isFinite(Number(roomDeck.deckSize)) ? Number(roomDeck.deckSize) : 30;
            return `部屋デッキ: カスタム ${deckSize}枚`;
        }
        if (Number.isFinite(Number(roomDeck.deckSize))) {
            return `部屋デッキ: デフォルト ${Number(roomDeck.deckSize)}枚`;
        }
        return '部屋デッキ: デフォルトデッキ';
    }

    function renderNetworkDeckInfo(roomState?: any) {
        const el = uiRefs.networkDeckInfo;
        if (!el) return;

        let roomDeck = roomState && roomState.roomDeck;
        if (!roomDeck && root.NetworkMatchClient && typeof root.NetworkMatchClient.getRoomDeck === 'function') {
            try {
                roomDeck = root.NetworkMatchClient.getRoomDeck();
            } catch (e) { /* ignore */ }
        }

        const roomBoardConfig = getRoomBoardConfig(roomState);

        const boardText = roomBoardConfig
            ? `部屋盤面: ${formatBoardConfigLabel(roomBoardConfig)}`
            : `作成時に送る盤面: ${formatBoardConfigLabel(getPendingRoomBoardConfig())}`;
        el.textContent = `${formatRoomDeckText(roomDeck)} / ${boardText}`;
        el.style.color = (hasCustomRoomDeck(roomDeck) || hasCustomRoomBoardConfig(roomBoardConfig)) ? '#ffecb3' : '#d7ccc8';
        renderNetworkBoardSizeControls(roomState);
        scheduleControlPanelLayoutSync();
        try {
            const controller = getDeckBuilderController();
            if (controller && typeof controller.render === 'function') {
                controller.render();
            }
        } catch (e) { /* ignore */ }
    }

    function resolveNetworkDebugModeAccessSetter() {
        if (typeof root.setNetworkDebugModeAccess === 'function') {
            return root.setNetworkDebugModeAccess;
        }
        try {
            if (root.UIBootstrap && typeof root.UIBootstrap.getRegisteredUIGlobals === 'function') {
                const globals = root.UIBootstrap.getRegisteredUIGlobals() || {};
                if (typeof globals.setNetworkDebugModeAccess === 'function') {
                    return globals.setNetworkDebugModeAccess;
                }
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function applyNetworkDebugModeAccess() {
        const setter = resolveNetworkDebugModeAccessSetter();
        if (typeof setter !== 'function') return;
        setter({
            networkMode: currentMode === MODE_NETWORK,
            roomDebugEnabled: networkRoomDebugEnabled === true
        });
    }

    function updateNetworkDebugEnabledFromRoomState(roomState: any) {
        if (!roomState || typeof roomState !== 'object') return;
        if (!Object.prototype.hasOwnProperty.call(roomState, 'networkDebugEnabled')) return;
        networkRoomDebugEnabled = roomState.networkDebugEnabled === true;
    }

    function updateNetworkAutoEnabledFromRoomState(roomState: any) {
        if (!roomState || typeof roomState !== 'object') return;
        if (!Object.prototype.hasOwnProperty.call(roomState, 'networkAutoEnabled')) return;
        networkRoomAutoEnabled = roomState.networkAutoEnabled === true;
    }

    function tryAutoEnableDebugModeForNetworkRoom() {
        if (currentMode !== MODE_NETWORK) return;
        if (networkRoomDebugEnabled !== true) return;

        try {
            if (typeof root.setDebugModeEnabled === 'function') {
                if (root.setDebugModeEnabled(true) === true) return;
            }
        } catch (e) { /* ignore */ }

        try {
            if (root.UIBootstrap && typeof root.UIBootstrap.getRegisteredUIGlobals === 'function') {
                const globals = root.UIBootstrap.getRegisteredUIGlobals() || {};
                if (typeof globals.setDebugModeEnabled === 'function') {
                    if (globals.setDebugModeEnabled(true) === true) return;
                }
            }
        } catch (e) { /* ignore */ }

        if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

        const debugModeBtn = document.getElementById('debugModeBtn');
        if (!debugModeBtn) return;
        if (debugModeBtn.dataset && debugModeBtn.dataset.active === 'true') return;

        try {
            debugModeBtn.click();
        } catch (e) { /* ignore */ }
    }

    function setSharedPlayerName(value: any) {
        const normalized = normalizePlayerName(value);
        if (!normalized) return '';

        let stored = normalized;
        try {
            if (root.LeaderboardClient && typeof root.LeaderboardClient.setPlayerName === 'function') {
                stored = normalizePlayerName(root.LeaderboardClient.setPlayerName(normalized));
            }
        } catch (e) { /* ignore */ }

        if (!stored) stored = normalized;

        if (uiRefs.leaderboardNameInput) {
            uiRefs.leaderboardNameInput.value = stored;
        }
        if (uiRefs.networkPlayerNameInput) {
            uiRefs.networkPlayerNameInput.value = stored;
        }
        return stored;
    }

    function resolveRequiredNetworkPlayerName() {
        const candidate = uiRefs.networkPlayerNameInput
            ? normalizePlayerName(uiRefs.networkPlayerNameInput.value)
            : '';

        if (!candidate) {
            writeNetworkStatus(`ニックネームを1〜${PLAYER_NAME_MAX}文字で入力してください`, true);
            if (uiRefs.networkPlayerNameInput && typeof uiRefs.networkPlayerNameInput.focus === 'function') {
                try {
                    uiRefs.networkPlayerNameInput.focus({ preventScroll: true });
                } catch (e) {
                    try { uiRefs.networkPlayerNameInput.focus(); } catch (_e) { /* ignore */ }
                }
            }
            return null;
        }

        if (uiRefs.networkPlayerNameInput) {
            uiRefs.networkPlayerNameInput.value = candidate;
        }

        return setSharedPlayerName(candidate);
    }

    function getShortPlayerId(playerId: any) {
        const raw = String(playerId || '').trim();
        if (!raw) return '';
        return raw.slice(-4).toUpperCase();
    }


    function formatNetworkTimerSuffix() {
        if (currentMode !== MODE_NETWORK) return '';
        const timer = (networkTurnTimerInfo && typeof networkTurnTimerInfo === 'object') ? networkTurnTimerInfo : null;
        if (!timer || timer.active !== true) return '';

        const remainingMs = Number.isFinite(Number(timer.remainingMs)) ? Number(timer.remainingMs) : null;
        if (remainingMs === null) return '';

        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        const turnSeatLabel = timer.turnSeatKey === 'white' ? '白' : '黒';
        return ` / 手番:${turnSeatLabel} 残り${remainingSeconds}秒`;
    }

    function formatNetworkTimerLabel() {
        const timer = (networkTurnTimerInfo && typeof networkTurnTimerInfo === 'object') ? networkTurnTimerInfo : null;
        const limitSeconds = Number.isFinite(Number(timer && timer.limitSeconds))
            ? Math.max(1, Math.trunc(Number(timer.limitSeconds)))
            : 120;

        if (!timer || timer.active !== true) {
            return `手番タイマー: 待機中（制限 ${limitSeconds} 秒）`;
        }

        const remainingMs = Number.isFinite(Number(timer.remainingMs)) ? Number(timer.remainingMs) : null;
        const remainingSeconds = remainingMs === null ? limitSeconds : Math.max(0, Math.ceil(remainingMs / 1000));
        const turnSeatKey = timer.turnSeatKey === 'white' ? 'white' : 'black';
        const turnSeatLabel = turnSeatKey === 'white' ? '白' : '黒';
        const ownTurnLabel = timer.isOwnTurn === true && !isNetworkSpectatorActive() ? '（あなた）' : '';
        return `手番タイマー: ${turnSeatLabel}${ownTurnLabel} 残り ${remainingSeconds} 秒`;
    }

    function renderNetworkTimerStatus() {
        const el = uiRefs.networkTimerStatus;
        if (!el) return;

        if (currentMode !== MODE_NETWORK) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }

        el.style.display = 'block';
        el.textContent = formatNetworkTimerLabel();
    }

    function renderNetworkStatus() {
        const el = uiRefs.networkStatus;
        if (el) {
            const baseText = String(networkStatusBaseText || '');
            const fullText = `${baseText}${formatNetworkTimerSuffix()}`.trim();
            el.textContent = fullText;
            el.style.color = networkStatusBaseIsError ? '#ff6b6b' : '#d8f3dc';
        }

        renderNetworkTimerStatus();
        scheduleControlPanelLayoutSync();
    }

    function writeNetworkStatus(text: any, isError: any) {
        networkStatusBaseText = String(text || '');
        networkStatusBaseIsError = !!isError;
        renderNetworkStatus();
    }

    function normalizeRoomPassword(value: any) {
        return Array.from(String(value || '').trim()).slice(0, 20).join('');
    }

    function formatRoomIdInput(value: any) {
        return String(value || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 3);
    }

    function normalizeRoomName(value: any) {
        return Array.from(String(value || '').trim()).slice(0, 20).join('');
    }

    function readNetworkRoomPassword() {
        return uiRefs.networkRoomPasswordInput ? normalizeRoomPassword(uiRefs.networkRoomPasswordInput.value) : '';
    }

    function readNetworkRoomName() {
        return uiRefs.networkRoomInput ? normalizeRoomName(uiRefs.networkRoomInput.value) : '';
    }

    function createNetworkPanelInput(id: string, type: string, placeholder: string) {
        const input = document.createElement('input');
        input.id = id;
        input.type = type;
        input.placeholder = placeholder;
        input.autocomplete = 'off';
        input.spellcheck = false;
        return input;
    }

    function ensureNetworkLobbyUi() {
        if (!uiRefs.networkPanel || uiRefs.networkRoomList) return;
        const roomInput = uiRefs.networkRoomInput;
        if (roomInput) {
            roomInput.placeholder = 'ルーム名（任意）';
            roomInput.maxLength = 20;
            roomInput.removeAttribute('pattern');
        }
        if (uiRefs.networkCopyRoomBtn) {
            uiRefs.networkCopyRoomBtn.textContent = 'ルーム名コピー';
        }
        const existingPasswordInput = typeof document !== 'undefined'
            ? document.getElementById('networkRoomPasswordInput')
            : null;
        const passwordInput = (existingPasswordInput as HTMLInputElement | null)
            || createNetworkPanelInput('networkRoomPasswordInput', 'password', 'パスワード（任意）');
        passwordInput.maxLength = 20;
        if (!existingPasswordInput && roomInput && roomInput.parentNode === uiRefs.networkPanel) {
            uiRefs.networkPanel.insertBefore(passwordInput, roomInput.nextSibling);
        } else if (!existingPasswordInput) {
            uiRefs.networkPanel.appendChild(passwordInput);
        }
        uiRefs.networkRoomPasswordInput = passwordInput;

        const listWrap = document.createElement('div');
        listWrap.id = 'networkRoomListPanel';

        const header = document.createElement('div');
        header.id = 'networkRoomListHeader';
        const title = document.createElement('span');
        title.className = 'network-room-list-title';
        title.textContent = 'ルーム一覧';
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'networkRoomListRefreshBtn';
        refreshBtn.className = 'btn-small';
        refreshBtn.type = 'button';
        refreshBtn.textContent = '更新';
        header.appendChild(title);
        header.appendChild(refreshBtn);

        const list = document.createElement('div');
        list.id = 'networkRoomList';
        list.setAttribute('aria-live', 'polite');
        const viewport = document.createElement('div');
        viewport.id = 'networkRoomListViewport';
        viewport.appendChild(list);

        listWrap.appendChild(header);
        listWrap.appendChild(viewport);

        const deckInfo = uiRefs.networkDeckInfo;
        if (deckInfo && deckInfo.parentNode === uiRefs.networkPanel) {
            uiRefs.networkPanel.insertBefore(listWrap, deckInfo);
        } else {
            uiRefs.networkPanel.appendChild(listWrap);
        }
        uiRefs.networkRoomListRefreshBtn = refreshBtn;
        uiRefs.networkRoomList = list;
    }

    function renderNetworkRoomList(rooms: any[]) {
        if (!uiRefs.networkRoomList) return;
        uiRefs.networkRoomList.textContent = '';
        const list = Array.isArray(rooms) ? rooms : [];
        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'network-room-list-empty';
            empty.textContent = '募集中のルームはありません';
            uiRefs.networkRoomList.appendChild(empty);
            return;
        }

        list.forEach((room) => {
            const entry = room && typeof room === 'object' ? room : {};
            const roomId = formatRoomIdInput(entry.roomId);
            if (!roomId) return;
            const item = document.createElement('div');
            item.className = 'network-room-list-entry';
            item.dataset.roomId = roomId;
            item.dataset.hasPassword = entry.hasPassword === true ? '1' : '0';
            item.dataset.roomName = normalizeRoomName(entry.roomName) || '無名部屋';
            const roomName = normalizeRoomName(entry.roomName) || '無名部屋';
            const host = normalizePlayerName(entry.hostName) || '名前なし';
            const boardLabel = String(entry.boardLabel || '8x8');
            const seatCount = Number.isFinite(Number(entry.seatCount)) ? Number(entry.seatCount) : 1;
            const maxSeats = Number.isFinite(Number(entry.maxSeats)) ? Number(entry.maxSeats) : 2;
            const spectatorCount = Number.isFinite(Number(entry.spectatorCount)) ? Number(entry.spectatorCount) : 0;
            const maxSpectators = Number.isFinite(Number(entry.maxSpectators)) ? Number(entry.maxSpectators) : 4;
            const blackPlayerName = normalizePlayerName(entry.blackPlayerName || entry.blackName || entry.seatNames?.black) || host;
            const whitePlayerName = normalizePlayerName(entry.whitePlayerName || entry.whiteName || entry.guestName || entry.opponentName || entry.seatNames?.white)
                || (seatCount >= 2 ? '参加者' : '募集中');
            const currentRoomId = root.NetworkMatchClient && typeof root.NetworkMatchClient.getRoomId === 'function'
                ? formatRoomIdInput(root.NetworkMatchClient.getRoomId())
                : '';
            if (currentRoomId && currentRoomId === roomId) {
                item.classList.add('is-current-room');
            }
            const body = document.createElement('div');
            body.className = 'network-room-entry-body';
            const main = document.createElement('span');
            main.className = 'network-room-entry-main';
            const nameEl = document.createElement('span');
            nameEl.className = 'network-room-entry-name';
            nameEl.textContent = roomName;
            const badgeWrap = document.createElement('span');
            badgeWrap.className = 'network-room-entry-badges';
            const seatBadge = document.createElement('span');
            seatBadge.className = 'network-room-entry-badge';
            seatBadge.textContent = `${seatCount}/${maxSeats}`;
            badgeWrap.appendChild(seatBadge);
            if (entry.hasPassword === true) {
                const passwordBadge = document.createElement('span');
                passwordBadge.className = 'network-room-entry-badge is-password';
                passwordBadge.textContent = '鍵あり';
                badgeWrap.appendChild(passwordBadge);
            }
            main.appendChild(nameEl);
            main.appendChild(badgeWrap);

            const meta = document.createElement('span');
            meta.className = 'network-room-entry-meta';
            const hostEl = document.createElement('span');
            hostEl.textContent = `ホスト ${host}`;
            const boardEl = document.createElement('span');
            boardEl.textContent = `盤面 ${boardLabel}`;
            const spectatorEl = document.createElement('span');
            spectatorEl.textContent = `観測 ${spectatorCount}/${maxSpectators}`;
            meta.appendChild(hostEl);
            meta.appendChild(boardEl);
            meta.appendChild(spectatorEl);

            const versus = document.createElement('span');
            versus.className = 'network-room-entry-versus';
            const blackMark = document.createElement('span');
            blackMark.className = 'network-room-entry-mark';
            blackMark.textContent = blackPlayerName;
            if (Array.from(blackPlayerName).length > 4) {
                blackMark.classList.add('is-long-name');
            }
            const versusText = document.createElement('span');
            versusText.className = 'network-room-entry-vs';
            versusText.textContent = 'VS';
            const whiteMark = document.createElement('span');
            whiteMark.className = 'network-room-entry-mark';
            whiteMark.textContent = whitePlayerName;
            if (Array.from(whitePlayerName).length > 4) {
                whiteMark.classList.add('is-long-name');
            }
            versus.appendChild(blackMark);
            versus.appendChild(versusText);
            versus.appendChild(whiteMark);

            const counts = document.createElement('span');
            counts.className = 'network-room-entry-counts';
            const playerCount = document.createElement('span');
            playerCount.className = 'network-room-entry-count is-player-count';
            const playerLabel = document.createElement('span');
            playerLabel.className = 'network-room-entry-count-label';
            playerLabel.textContent = 'プレイヤー';
            const playerValue = document.createElement('span');
            playerValue.className = 'network-room-entry-count-value';
            playerValue.textContent = `${seatCount}/${maxSeats}`;
            playerCount.appendChild(playerLabel);
            playerCount.appendChild(playerValue);
            const spectatorCountEl = document.createElement('span');
            spectatorCountEl.className = 'network-room-entry-count is-spectator-count';
            const spectatorLabel = document.createElement('span');
            spectatorLabel.className = 'network-room-entry-count-label';
            spectatorLabel.textContent = '観測中';
            const spectatorValue = document.createElement('span');
            spectatorValue.className = 'network-room-entry-count-value';
            spectatorValue.textContent = `${spectatorCount}/${maxSpectators}`;
            spectatorCountEl.appendChild(spectatorLabel);
            spectatorCountEl.appendChild(spectatorValue);
            counts.appendChild(playerCount);
            counts.appendChild(spectatorCountEl);

            body.appendChild(main);
            body.appendChild(versus);
            body.appendChild(counts);
            body.appendChild(meta);

            const joinButton = document.createElement('button');
            joinButton.type = 'button';
            joinButton.className = 'btn-small network-room-entry-join';
            joinButton.textContent = '参加';
            joinButton.disabled = entry.canJoin === false;
            if (currentRoomId && currentRoomId === roomId) {
                joinButton.textContent = '参加済み';
                joinButton.disabled = true;
            }
            joinButton.setAttribute(
                'aria-label',
                `${roomName}に参加。ホスト ${host}、盤面 ${boardLabel}、${seatCount}/${maxSeats}${entry.hasPassword === true ? '、パスワードあり' : ''}`
            );
            joinButton.addEventListener('click', () => {
                joinRoomFromList(roomId, roomName, entry.hasPassword === true);
            });
            const spectateButton = document.createElement('button');
            spectateButton.type = 'button';
            spectateButton.className = 'btn-small network-room-entry-spectate';
            spectateButton.textContent = '観測';
            spectateButton.disabled = entry.canSpectate === false;
            if (currentRoomId && currentRoomId === roomId) {
                spectateButton.classList.add('network-room-entry-leave');
                spectateButton.textContent = '退出';
                spectateButton.disabled = false;
                spectateButton.setAttribute('aria-label', `${roomName}から退出`);
                spectateButton.addEventListener('click', () => {
                    if (uiRefs.networkLeaveBtn && typeof uiRefs.networkLeaveBtn.click === 'function') {
                        uiRefs.networkLeaveBtn.click();
                    }
                });
            } else {
                spectateButton.setAttribute(
                    'aria-label',
                    `${roomName}を観測。観測 ${spectatorCount}/${maxSpectators}${entry.hasPassword === true ? '、パスワードあり' : ''}`
                );
                spectateButton.addEventListener('click', () => {
                    spectateRoomFromList(roomId, roomName, entry.hasPassword === true);
                });
            }
            item.appendChild(body);
            item.appendChild(joinButton);
            item.appendChild(spectateButton);
            uiRefs.networkRoomList.appendChild(item);
        });
    }

    async function refreshNetworkRoomList(options?: any) {
        const silentStatus = !!(options && options.silentStatus === true);
        if (!root.NetworkMatchClient || typeof root.NetworkMatchClient.listRooms !== 'function') {
            if (!silentStatus) writeNetworkStatus('ルーム一覧を取得できません', true);
            return;
        }
        const serverUrl = uiRefs.networkServerInput ? uiRefs.networkServerInput.value.trim() : '';
        try {
            if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setServerUrl === 'function') {
                root.NetworkMatchClient.setServerUrl(serverUrl);
            }
            const result = await root.NetworkMatchClient.listRooms({ serverUrl });
            if (!result || result.ok !== true) {
                renderNetworkRoomList([]);
                return;
            }
            renderNetworkRoomList(result.rooms || []);
            if (!silentStatus) writeNetworkStatus(`ルーム一覧を更新しました（${(result.rooms || []).length}件）`, false);
        } catch (e) {
            renderNetworkRoomList([]);
            if (!silentStatus) writeNetworkStatus('ルーム一覧の取得に失敗しました', true);
        }
    }

    async function joinRoomFromList(roomId: string, roomName: string, hasPassword: boolean) {
        selectedNetworkRoomId = roomId;
        if (uiRefs.networkRoomInput) {
            uiRefs.networkRoomInput.value = roomName || '無名部屋';
        }
        if (hasPassword && !readNetworkRoomPassword()) {
            writeNetworkStatus('パスワードを入力してください', true);
            if (uiRefs.networkRoomPasswordInput && typeof uiRefs.networkRoomPasswordInput.focus === 'function') {
                uiRefs.networkRoomPasswordInput.focus();
            }
            return;
        }
        if (uiRefs.networkJoinBtn && typeof uiRefs.networkJoinBtn.click === 'function') {
            uiRefs.networkJoinBtn.click();
        }
    }

    async function spectateRoomFromList(roomId: string, roomName: string, hasPassword: boolean) {
        selectedNetworkRoomId = roomId;
        if (uiRefs.networkRoomInput) {
            uiRefs.networkRoomInput.value = roomName || '無名部屋';
        }
        if (hasPassword && !readNetworkRoomPassword()) {
            writeNetworkStatus('パスワードを入力してください', true);
            if (uiRefs.networkRoomPasswordInput && typeof uiRefs.networkRoomPasswordInput.focus === 'function') {
                uiRefs.networkRoomPasswordInput.focus();
            }
            return;
        }
        if (!root.NetworkMatchClient || typeof root.NetworkMatchClient.spectateRoom !== 'function') {
            writeNetworkStatus('観測機能を利用できません', true);
            return;
        }

        const playerName = resolveRequiredNetworkPlayerName();
        if (!playerName) return;

        await setMode(MODE_NETWORK, { silentLog: true });
        const roomPassword = readNetworkRoomPassword();
        const serverUrl = uiRefs.networkServerInput ? uiRefs.networkServerInput.value.trim() : '';
        try {
            if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setServerUrl === 'function') {
                root.NetworkMatchClient.setServerUrl(serverUrl);
            }
            const result = await root.NetworkMatchClient.spectateRoom(roomId, {
                playerName,
                roomPassword,
                serverUrl
            });
            if (result && result.ok) {
                setNetworkOverlayVisible(false);
                writeNetworkStatus('観測中', false);
                refreshNetworkChatVisibility();
                renderNetworkDeckInfo();
                refreshBoardUi();
                return;
            }
            writeNetworkStatus('観測への参加に失敗しました', true);
        } catch (e) {
            writeNetworkStatus('観測への参加に失敗しました', true);
        }
    }

    function isNetworkOverlayOpen() {
        return !!(uiRefs.networkOverlay && uiRefs.networkOverlay.classList.contains('is-open'));
    }

    function setNetworkOverlayVisible(visible: any) {
        if (!uiRefs.networkOverlay) return;
        const open = !!visible;
        if (!open) {
            setNetworkRoomSettingsPopupVisible(false);
        }
        uiRefs.networkOverlay.classList.toggle('is-open', open);
        uiRefs.networkOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
        renderNetworkDeckInfo();

        if (uiRefs.modeNetworkBtn) {
            uiRefs.modeNetworkBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        const shouldFocusName = !!(uiRefs.networkPlayerNameInput && !normalizePlayerName(uiRefs.networkPlayerNameInput.value));
        const focusTarget = shouldFocusName ? uiRefs.networkPlayerNameInput : uiRefs.networkRoomInput;

        if (open && focusTarget && typeof focusTarget.focus === 'function') {
            try {
                focusTarget.focus({ preventScroll: true });
            } catch (e) {
                try { focusTarget.focus(); } catch (_e) { /* ignore */ }
            }
        }
        if (open && uiRefs.networkRoomList) {
            Promise.resolve(refreshNetworkRoomList()).catch(() => { /* ignore */ });
        }
    }

    let leaderboardController: any = null;

    function createLeaderboardControllerContext() {
        return {
            root,
            uiRefs,
            PLAYER_NAME_MAX,
            DEFAULT_PLAYER_NAME,
            normalizePlayerName,
            getSharedPlayerName,
            setNetworkOverlayVisible,
            isNetworkOverlayOpen
        };
    }

    function getLeaderboardController() {
        if (!leaderboardController
            && MatchModeLeaderboardControllerModule
            && typeof MatchModeLeaderboardControllerModule.createLeaderboardController === 'function') {
            leaderboardController = MatchModeLeaderboardControllerModule.createLeaderboardController(createLeaderboardControllerContext());
        }
        return leaderboardController;
    }

    function isLeaderboardOverlayOpen() {
        const controller = getLeaderboardController();
        return !!(controller && typeof controller.isOverlayOpen === 'function' && controller.isOverlayOpen());
    }

    function setLeaderboardOverlayVisible(visible: any) {
        const controller = getLeaderboardController();
        if (controller && typeof controller.setOverlayVisible === 'function') {
            controller.setOverlayVisible(visible);
        }
    }

    function bindLeaderboardControls() {
        const controller = getLeaderboardController();
        if (controller && typeof controller.bindControls === 'function') {
            controller.bindControls();
        }
    }

    function bindNetworkOverlayControls() {
        if (!uiRefs.networkOverlay) return;

        if (uiRefs.networkCloseBtn) {
            uiRefs.networkCloseBtn.addEventListener('click', () => {
                setNetworkOverlayVisible(false);
            });
        }

        uiRefs.networkOverlay.addEventListener('click', (event: any) => {
            if (!event) return;
            if (event.target === uiRefs.networkOverlay) {
                setNetworkOverlayVisible(false);
            }
        });

        setNetworkOverlayVisible(false);
    }

    function setNetworkRoomSettingsPopupVisible(open: boolean) {
        if (uiRefs.networkRoomSettingsPopup) {
            uiRefs.networkRoomSettingsPopup.classList.toggle('is-open', open);
            uiRefs.networkRoomSettingsPopup.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
        if (uiRefs.networkRoomSettingsBackdrop) {
            uiRefs.networkRoomSettingsBackdrop.classList.toggle('is-open', open);
            uiRefs.networkRoomSettingsBackdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
        if (uiRefs.networkRoomSettingsBtn) {
            uiRefs.networkRoomSettingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    }

    function getChatMaxLength() {
        try {
            if (root.NetworkMatchClient && typeof root.NetworkMatchClient.getChatMaxLength === 'function') {
                return Math.max(1, Number(root.NetworkMatchClient.getChatMaxLength()) || CHAT_INPUT_FALLBACK_MAX);
            }
        } catch (e) { /* ignore */ }
        return CHAT_INPUT_FALLBACK_MAX;
    }

    function formatChatInput(value: any) {
        const maxLength = getChatMaxLength();
        return Array.from(String(value || '').replace(/[\r\n]+/g, ' ').trim())
            .slice(0, maxLength)
            .join('');
    }

    function clearNetworkChatMessages() {
        if (!uiRefs.networkChatMessages) return;
        uiRefs.networkChatMessages.innerHTML = '';
    }

    function normalizeNetworkChatSeatKey(value: any) {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'white' ? 'white' : 'black';
    }

    function appendNetworkChatMessage(entry: any) {
        if (!uiRefs.networkChatMessages || !entry || !entry.text) return;
        const seatKey = normalizeNetworkChatSeatKey(entry.seatKey);
        const seatLabel = seatKey === 'white' ? '白' : '黒';
        const localSeat = (root.NetworkMatchClient && typeof root.NetworkMatchClient.getSeatKey === 'function')
            ? normalizeNetworkChatSeatKey(root.NetworkMatchClient.getSeatKey())
            : 'black';

        const line = document.createElement('div');
        line.className = 'network-chat-line';
        if (seatKey === localSeat) {
            line.classList.add('network-chat-line--self');
        }
        line.textContent = `${seatLabel}: ${entry.text}`;
        uiRefs.networkChatMessages.appendChild(line);
        uiRefs.networkChatMessages.scrollTop = uiRefs.networkChatMessages.scrollHeight;
    }

    function showNetworkChatSpeechBubble(entry: any) {
        if (!entry || !entry.text) return;
        const seatKey = normalizeNetworkChatSeatKey(entry.seatKey);
        const localSeat = (root.NetworkMatchClient && typeof root.NetworkMatchClient.getSeatKey === 'function')
            ? normalizeNetworkChatSeatKey(root.NetworkMatchClient.getSeatKey())
            : 'black';
        const speechText = String(entry.text || '').trim();
        if (!speechText) return;

        if (seatKey === localSeat) {
            if (typeof root.showHeroSpeechBubble === 'function') {
                root.showHeroSpeechBubble(speechText);
            }
            return;
        }

        if (typeof root.showCpuSpeechBubble === 'function') {
            root.showCpuSpeechBubble(speechText);
        }
    }

    function renderNetworkChatHistory(messages: any) {
        clearNetworkChatMessages();
        if (!Array.isArray(messages)) return;
        messages.forEach((entry) => {
            appendNetworkChatMessage(entry);
        });
    }

    function setNetworkChatExpanded(expanded: any) {
        if (!uiRefs.networkChatPanel) return;
        const isOpen = !!expanded;
        uiRefs.networkChatPanel.classList.toggle('is-open', isOpen);
        if (uiRefs.networkChatToggle) {
            uiRefs.networkChatToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
    }

    function setNetworkChatVisible(visible: any) {
        if (!uiRefs.networkChatPanel) return;
        const nextVisible = !!visible;
        const changed = networkChatVisible !== nextVisible;
        networkChatVisible = nextVisible;

        uiRefs.networkChatPanel.classList.toggle('is-active', nextVisible);
        uiRefs.networkChatPanel.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
        if (uiRefs.networkChatInput) {
            uiRefs.networkChatInput.disabled = !nextVisible;
        }
        if (uiRefs.networkChatSendBtn) {
            uiRefs.networkChatSendBtn.disabled = !nextVisible;
        }
        if (changed && nextVisible) {
            setNetworkChatExpanded(false);
        }
        if (changed && !nextVisible) {
            setNetworkChatExpanded(false);
            clearNetworkChatMessages();
        }
    }

    function isNetworkSpectatorActive(roomState?: any) {
        if (roomState && String(roomState.viewerRole || '').trim().toLowerCase() === 'spectator') {
            return true;
        }
        return !!(
            root.NetworkMatchClient
            && typeof root.NetworkMatchClient.isSpectator === 'function'
            && root.NetworkMatchClient.isSpectator()
        );
    }

    function refreshNetworkChatVisibility() {
        const isNetworkMode = currentMode === MODE_NETWORK;
        const spectatorActive = isNetworkSpectatorActive();
        const hasTwoPlayers = !!(
            root.NetworkMatchClient
            && typeof root.NetworkMatchClient.hasTwoPlayers === 'function'
            && root.NetworkMatchClient.hasTwoPlayers()
        );
        setNetworkChatVisible(isNetworkMode && hasTwoPlayers && !spectatorActive);
    }

    function clearControlPanelConstraints() {
        if (!uiRefs.controlPanel) return;
        uiRefs.controlPanel.style.height = '';
        uiRefs.controlPanel.style.maxHeight = '';
        uiRefs.controlPanel.style.overflowY = '';
        uiRefs.controlPanel.style.overscrollBehavior = '';
    }

    function measureBaseControlPanelHeight() {
        if (!uiRefs.controlPanel) return 0;
        const panel = uiRefs.controlPanel;
        const prevHeight = panel.style.height;
        const prevMaxHeight = panel.style.maxHeight;
        const prevOverflowY = panel.style.overflowY;
        const prevOverscroll = panel.style.overscrollBehavior;
        const prevNetworkDisplay = uiRefs.networkPanel ? uiRefs.networkPanel.style.display : '';

        clearControlPanelConstraints();
        if (uiRefs.networkPanel) uiRefs.networkPanel.style.display = 'none';

        const measured = Math.ceil(panel.getBoundingClientRect().height || panel.scrollHeight || 0);
        if (measured > 0) uiRefs.baseControlPanelHeight = measured;

        if (uiRefs.networkPanel) uiRefs.networkPanel.style.display = prevNetworkDisplay;
        panel.style.height = prevHeight;
        panel.style.maxHeight = prevMaxHeight;
        panel.style.overflowY = prevOverflowY;
        panel.style.overscrollBehavior = prevOverscroll;
        return measured;
    }

    function getLockedControlPanelHeight() {
        const base = uiRefs.baseControlPanelHeight > 0 ? uiRefs.baseControlPanelHeight : measureBaseControlPanelHeight();
        if (base <= 0) return 0;
        const vh = (typeof root.innerHeight === 'number' && root.innerHeight > 0) ? root.innerHeight : 0;
        if (vh <= 0) return base;
        const maxByViewport = Math.max(220, Math.floor(vh * 0.42));
        return Math.max(180, Math.min(base, maxByViewport));
    }

    function syncControlPanelLayout() {
        if (!uiRefs.controlPanel) return;

        clearControlPanelConstraints();
        const fresh = measureBaseControlPanelHeight();
        if (fresh > 0) uiRefs.baseControlPanelHeight = fresh;
    }

    function scheduleControlPanelLayoutSync() {
        if (uiRefs.layoutSyncRaf && typeof root.cancelAnimationFrame === 'function') {
            root.cancelAnimationFrame(uiRefs.layoutSyncRaf);
            uiRefs.layoutSyncRaf = 0;
        }
        if (typeof root.requestAnimationFrame === 'function') {
            uiRefs.layoutSyncRaf = root.requestAnimationFrame(() => {
                uiRefs.layoutSyncRaf = 0;
                syncControlPanelLayout();
            });
            return;
        }
        syncControlPanelLayout();
    }

    function bindControlPanelLayoutObservers() {
        if (uiRefs.layoutBound) return;
        uiRefs.layoutBound = true;

        if (typeof root.addEventListener === 'function') {
            root.addEventListener('resize', () => {
                scheduleControlPanelLayoutSync();
            });
            root.addEventListener('orientationchange', () => {
                scheduleControlPanelLayoutSync();
            });
        }

        if (uiRefs.networkAdvancedSettings && typeof uiRefs.networkAdvancedSettings.addEventListener === 'function') {
            uiRefs.networkAdvancedSettings.addEventListener('toggle', () => {
                scheduleControlPanelLayoutSync();
            });
        }

        if (typeof ResizeObserver === 'function' && uiRefs.controlPanel) {
            uiRefs.layoutObserver = new ResizeObserver(() => {
                scheduleControlPanelLayoutSync();
            });
            uiRefs.layoutObserver.observe(uiRefs.controlPanel);
        }
    }

    function syncHumanModeFlags(enabled: any) {
        try {
            root.DEBUG_HUMAN_VS_HUMAN = !!enabled;

            root.__uiImpl_turn_manager = Object.assign({}, root.__uiImpl_turn_manager || {}, {
                DEBUG_HUMAN_VS_HUMAN: !!enabled
            });
            root.__uiImpl_move_executor = Object.assign({}, root.__uiImpl_move_executor || {}, {
                DEBUG_HUMAN_VS_HUMAN: !!enabled
            });
            root.__uiImpl = Object.assign({}, root.__uiImpl || {}, {
                DEBUG_HUMAN_VS_HUMAN: !!enabled
            });
        } catch (e) { /* ignore */ }
    }

    function disableAutoModeForHumanPlay() {
        try {
            if (typeof root.disableAutoMode === 'function') {
                root.disableAutoMode();
            }
        } catch (e) { /* ignore */ }

        if (uiRefs.autoToggleBtn) {
            uiRefs.autoToggleBtn.textContent = 'AUTO: OFF';
        }
        try {
            root.AUTO_MODE_ACTIVE = false;
        } catch (e) { /* ignore */ }
    }

    function markTimeAttackFirstMoveForMatchMode() {
        try {
            const mod = root && root.ResultOverlayModule;
            if (mod && typeof mod.markTimeAttackStarted === 'function') {
                mod.markTimeAttackStarted();
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function refreshNetworkAutoModeAccess() {
        if (!uiRefs.autoToggleBtn) return;
        const disable = shouldDisableAutoMode(currentMode);
        uiRefs.autoToggleBtn.disabled = disable;
        uiRefs.autoToggleBtn.classList.toggle('is-network-disabled', disable);
        uiRefs.autoToggleBtn.setAttribute('aria-disabled', disable ? 'true' : 'false');
        if (disable) {
            disableAutoModeForHumanPlay();
        }
    }

    function applyReversiModeUiState() {
        const active = currentMode === MODE_REVERSI;
        try {
            if (document && document.body) {
                document.body.classList.toggle('reversi-mode-active', active);
                document.body.classList.toggle('othello-mode-active', active);
            }
            const hiddenElementIds = [
                'deck-white',
                'deck-black',
                'hand-white',
                'hand-black',
                'card-detail-panel',
                'discard-display',
                'effect-live-panel',
                'deckBuilderOpenBtn',
                'deckBuilderControlSummary',
                'gachaOpenBtn',
                'charge-black',
                'charge-white',
                'charge-delta-black-increase',
                'charge-delta-black-decrease',
                'charge-delta-white-increase',
                'charge-delta-white-decrease'
            ];
            hiddenElementIds.forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.hidden = active;
                el.setAttribute('aria-hidden', active ? 'true' : 'false');
            });
        } catch (e) { /* ignore */ }
        try {
            root.REVERSI_MODE_ACTIVE = active;
            root.__REVERSI_MODE_ACTIVE = active;
            root.OTHELLO_MODE_ACTIVE = active;
            root.__OTHELLO_MODE_ACTIVE = active;
        } catch (e) { /* ignore */ }
    }

    function resetGameForReversiModeSwitch(prevMode: any, nextMode: any) {
        if (prevMode !== MODE_REVERSI && nextMode !== MODE_REVERSI) return;
        try {
            if (typeof root.resetGame === 'function') {
                root.resetGame({ skipNetworkPublish: true });
            }
        } catch (e) { /* ignore */ }
    }

    function refreshModeButtons() {
        const cpuActive = currentMode === MODE_CPU;
        const reversiActive = currentMode === MODE_REVERSI;
        const networkActive = currentMode === MODE_NETWORK;

        if (uiRefs.modeCpuBtn) uiRefs.modeCpuBtn.style.outline = cpuActive ? '2px solid #90ee90' : '';
        if (uiRefs.modeReversiBtn) uiRefs.modeReversiBtn.style.outline = reversiActive ? '2px solid #90ee90' : '';
        if (uiRefs.modeNetworkBtn) uiRefs.modeNetworkBtn.style.outline = networkActive ? '2px solid #90ee90' : '';

        if (uiRefs.networkPanel) {
            uiRefs.networkPanel.style.display = networkActive ? 'block' : 'none';
        }
        if (!networkActive) {
            setNetworkOverlayVisible(false);
        }

        refreshNetworkChatVisibility();
        refreshNetworkAutoModeAccess();
        renderNetworkTimerStatus();
        scheduleControlPanelLayoutSync();
    }

    function _getGameState() {
        try {
            return (typeof gameState !== 'undefined' && gameState) ? gameState : (root && root.gameState ? root.gameState : null);
        } catch (e) { return null; }
    }

    function _getCardState() {
        try {
            return (typeof cardState !== 'undefined' && cardState) ? cardState : (root && root.cardState ? root.cardState : null);
        } catch (e) { return null; }
    }

    function hasRenderableState() {
        try {
            const gs = _getGameState();
            const cs = _getCardState();
            if (!gs || !Array.isArray(gs.board) || gs.board.length <= 0) return false;
            if (!Array.isArray(gs.board[0]) || gs.board[0].length <= 0) return false;
            if (!cs || typeof cs !== 'object') return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function refreshBoardUi() {
        if (!hasRenderableState()) return;
        try {
            if (typeof root.requestCardUiSync === 'function') root.requestCardUiSync('match-mode:refresh');
            else if (typeof renderCardUI === 'function') renderCardUI();
        } catch (e) { /* ignore */ }
        try {
            if (root.BoardUpdateDispatch && typeof root.BoardUpdateDispatch.requestBoardUpdate === 'function') {
                root.BoardUpdateDispatch.requestBoardUpdate();
            } else if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
            else if (typeof renderBoard === 'function') renderBoard();
        } catch (e) { /* ignore */ }
    }

    async function setMode(mode: any, options?: any) {
        const opts = options || {};
        const nextMode = normalizeMode(mode);
        const prevMode = currentMode;
        if (nextMode === prevMode && !opts.force) {
            refreshModeButtons();
            return;
        }

        if (prevMode === MODE_NETWORK && nextMode !== MODE_NETWORK && opts.skipNetworkLeave !== true) {
            try {
                if (root.NetworkMatchClient && typeof root.NetworkMatchClient.leaveRoom === 'function') {
                    await root.NetworkMatchClient.leaveRoom();
                }
            } catch (e) { /* ignore */ }
        }

        currentMode = nextMode;

        try {
            root.MATCH_MODE = currentMode;
            root.__MATCH_MODE = currentMode;
            root.getCurrentMatchMode = getCurrentMode;
            root.isLocalOrNetworkMode = isLocalOrNetworkMode;
            root.isNetworkModeActive = isNetworkModeActive;
            root.isReversiModeActive = isReversiModeActive;
            root.isOthelloModeActive = isOthelloModeActive;
        } catch (e) { /* ignore */ }

        applyReversiModeUiState();

        if (shouldClearHumanVsHumanMode(currentMode)) {
            syncHumanModeFlags(false);
        }
        refreshNetworkAutoModeAccess();

        if (opts.suppressStatus !== true) {
            if (currentMode === MODE_NETWORK) {
                writeNetworkStatus('ネット対戦: 部屋作成か部屋参加を選んでください', false);
            } else if (currentMode === MODE_REVERSI) {
                writeNetworkStatus('リバーシモード', false);
            } else {
                writeNetworkStatus('CPU対戦モード', false);
                setNetworkOverlayVisible(false);
            }
        } else if (currentMode !== MODE_NETWORK) {
            setNetworkOverlayVisible(false);
        }

        applyNetworkDebugModeAccess();

        if (opts.skipReset !== true) {
            resetGameForReversiModeSwitch(prevMode, currentMode);
        }
        refreshModeButtons();
        refreshBoardUi();
        try {
            if (typeof root.updateCpuCharacter === 'function') {
                root.updateCpuCharacter();
            }
        } catch (e) { /* ignore */ }

        if (!opts.silentLog && typeof addLog === 'function') {
            if (currentMode === MODE_CPU) addLog('モード: CPU対戦');
            if (currentMode === MODE_REVERSI) addLog('モード: リバーシ');
            if (currentMode === MODE_NETWORK) addLog('モード: ネット対戦');
        }
    }

    async function restoreStoredNetworkSessionOnBoot() {
        try {
            if (!root.NetworkMatchClient || typeof root.NetworkMatchClient.restoreStoredSession !== 'function') return;
            const result = await root.NetworkMatchClient.restoreStoredSession();
            if (!result || result.ok !== true) return;
            await setMode(MODE_NETWORK, {
                silentLog: true,
                skipReset: true,
                suppressStatus: true
            });
            const role = String(result.viewerRole || '').trim().toLowerCase();
            writeNetworkStatus(role === 'spectator'
                ? 'ネット対戦: 観測セッションへ復帰しました'
                : 'ネット対戦: 対戦セッションへ復帰しました', false);
            setNetworkOverlayVisible(false);
            renderNetworkTimerStatus();
            refreshNetworkChatVisibility();
        } catch (e) { /* ignore restore failure; normal CPU boot remains available */ }
    }

    function createNetworkButtonBindingContext() {
        return {
            root,
            uiRefs,
            PLAYER_NAME_MAX,
            DEFAULT_PLAYER_NAME,
            MODE_NETWORK,
            MODE_CPU,
            getNetworkChatVisible: () => networkChatVisible,
            setNetworkTurnTimerInfo: (next: any) => { networkTurnTimerInfo = next; },
            setNetworkRoomDebugEnabled: (next: any) => { networkRoomDebugEnabled = next === true; },
            setNetworkRoomAutoEnabled: (next: any) => { networkRoomAutoEnabled = next === true; },
            getSelectedNetworkRoomId: () => selectedNetworkRoomId,
            setSelectedNetworkRoomId: (next: any) => { selectedNetworkRoomId = String(next || ''); },
            formatChatInput,
            writeNetworkStatus,
            isNetworkSpectatorActive,
            updateNetworkDebugEnabledFromRoomState,
            updateNetworkAutoEnabledFromRoomState,
            applyNetworkDebugModeAccess,
            refreshNetworkAutoModeAccess,
            refreshNetworkChatVisibility,
            renderNetworkDeckInfo,
            renderNetworkStatus,
            renderNetworkChatHistory,
            appendNetworkChatMessage,
            showNetworkChatSpeechBubble,
            setNetworkChatExpanded,
            getChatMaxLength,
            normalizePlayerName,
            getSharedPlayerName,
            normalizeRoomPassword,
            normalizeRoomName,
            readPrimaryWheelDelta,
            getPendingRoomBoardConfig,
            stepBoardDimensionValue,
            updatePendingRoomBoardConfigFromInputs,
            readNetworkRoomName,
            readNetworkRoomPassword,
            refreshNetworkRoomList,
            setNetworkRoomSettingsPopupVisible,
            setMode,
            readActiveLocalDeckSelection,
            notifyInvalidCustomDeckFallback,
            setSharedPlayerName,
            tryAutoEnableDebugModeForNetworkRoom,
            refreshBoardUi,
            resolveRequiredNetworkPlayerName
        };
    }

    function bindNetworkButtons() {
        if (MatchModeNetworkButtonsModule && typeof MatchModeNetworkButtonsModule.bindNetworkButtons === 'function') {
            MatchModeNetworkButtonsModule.bindNetworkButtons(createNetworkButtonBindingContext());
        }
    }

    function setupMatchModeControls(options: any) {
        const opts = options || {};
        uiRefs.modeCpuBtn = opts.modeCpuBtn || null;
        uiRefs.modeReversiBtn = opts.modeReversiBtn || opts.modeOthelloBtn || null;
        uiRefs.modeNetworkBtn = opts.modeNetworkBtn || null;
        uiRefs.controlPanel = opts.controlPanel || null;
        uiRefs.networkPanel = opts.networkPanel || null;
        uiRefs.networkAdvancedSettings = opts.networkAdvancedSettings || null;
        uiRefs.networkRoomInput = opts.networkRoomInput || null;
        uiRefs.networkServerInput = opts.networkServerInput || null;
        uiRefs.networkPlayerNameInput = opts.networkPlayerNameInput || null;
        uiRefs.networkBoardSizeRowsInput = opts.networkBoardSizeRowsInput || null;
        uiRefs.networkBoardSizeColsInput = opts.networkBoardSizeColsInput || null;
        uiRefs.networkBoardSizeSummary = opts.networkBoardSizeSummary || null;
        uiRefs.networkBoardSizeNote = opts.networkBoardSizeNote || null;
        uiRefs.networkEnableDebugCheckbox = opts.networkEnableDebugCheckbox || null;
        uiRefs.networkEnableAutoCheckbox = opts.networkEnableAutoCheckbox || null;
        uiRefs.networkCopyRoomBtn = opts.networkCopyRoomBtn || null;
        uiRefs.networkRoomSettingsBtn = opts.networkRoomSettingsBtn || null;
        uiRefs.networkRoomSettingsBackdrop = opts.networkRoomSettingsBackdrop || null;
        uiRefs.networkRoomSettingsPopup = opts.networkRoomSettingsPopup || null;
        uiRefs.networkRoomSettingsCloseBtn = opts.networkRoomSettingsCloseBtn || null;
        uiRefs.networkCreateBtn = opts.networkCreateBtn || null;
        uiRefs.networkJoinBtn = opts.networkJoinBtn || null;
        uiRefs.networkLeaveBtn = opts.networkLeaveBtn || null;
        uiRefs.networkStatus = opts.networkStatus || null;
        uiRefs.networkDeckInfo = opts.networkDeckInfo || null;
        uiRefs.networkTimerStatus = opts.networkTimerStatus || null;
        uiRefs.networkOverlay = opts.networkOverlay || null;
        uiRefs.networkCloseBtn = opts.networkCloseBtn || null;
        uiRefs.leaderboardOpenBtn = opts.leaderboardOpenBtn || null;
        uiRefs.leaderboardOverlay = opts.leaderboardOverlay || null;
        uiRefs.leaderboardPanel = opts.leaderboardPanel || null;
        uiRefs.leaderboardCloseBtn = opts.leaderboardCloseBtn || null;
        uiRefs.leaderboardNameInput = opts.leaderboardNameInput || null;
        uiRefs.leaderboardReloadBtn = opts.leaderboardReloadBtn || null;
        uiRefs.leaderboardStatus = opts.leaderboardStatus || null;
        uiRefs.leaderboardList = opts.leaderboardList || null;
        uiRefs.networkChatPanel = opts.networkChatPanel || null;
        uiRefs.networkChatToggle = opts.networkChatToggle || null;
        uiRefs.networkChatMessages = opts.networkChatMessages || null;
        uiRefs.networkChatInput = opts.networkChatInput || null;
        uiRefs.networkChatSendBtn = opts.networkChatSendBtn || null;
        uiRefs.autoToggleBtn = opts.autoToggleBtn || null;
        try {
            const payload = { onTimeAttackFirstMove: markTimeAttackFirstMoveForMatchMode };
            if (SharedUIBootstrapModule && typeof SharedUIBootstrapModule.mergeUIImpl === 'function') {
                SharedUIBootstrapModule.mergeUIImpl(root, 'turn_manager', payload);
            } else {
                root.__uiImpl_turn_manager = Object.assign({}, root.__uiImpl_turn_manager || {}, payload);
                root.onTimeAttackFirstMove = markTimeAttackFirstMoveForMatchMode;
            }
        } catch (e) { /* ignore */ }
        ensureNetworkLobbyUi();
        if (uiRefs.networkEnableDebugCheckbox) {
            uiRefs.networkEnableDebugCheckbox.checked = false;
        }
        if (uiRefs.networkEnableAutoCheckbox) {
            uiRefs.networkEnableAutoCheckbox.checked = false;
        }

        if (uiRefs.modeCpuBtn) {
            uiRefs.modeCpuBtn.addEventListener('click', () => {
                setMode(MODE_CPU);
            });
        }
        if (uiRefs.modeReversiBtn) {
            uiRefs.modeReversiBtn.addEventListener('click', () => {
                setMode(MODE_REVERSI);
            });
        }
        if (uiRefs.modeNetworkBtn) {
            uiRefs.modeNetworkBtn.addEventListener('click', async () => {
                if (currentMode !== MODE_NETWORK) {
                    await setMode(MODE_NETWORK);
                    setLeaderboardOverlayVisible(false);
                    setNetworkOverlayVisible(true);
                    return;
                }

                setLeaderboardOverlayVisible(false);
                setNetworkOverlayVisible(!isNetworkOverlayOpen());
            });
        }

        bindNetworkButtons();
        bindNetworkOverlayControls();
        bindLeaderboardControls();
        bindControlPanelLayoutObservers();
        measureBaseControlPanelHeight();
        scheduleControlPanelLayoutSync();
        setMode(MODE_CPU, { force: true, silentLog: true });
        if (!(options && options.deferStoredSessionRestore === true)) {
            restoreStoredNetworkSessionOnBoot();
        }
    }
export = {
        setupMatchModeControls,
        restoreStoredNetworkSessionOnBoot,
        setMode,
        getCurrentMode,
        isLocalOrNetworkMode,
        isNetworkModeActive,
        isReversiModeActive,
        isOthelloModeActive
    };
