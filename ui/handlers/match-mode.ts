
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
const SharedBoardUtilsModule = (() => {
    try {
        return _require('../../shared/shared-board-utils');
    } catch (e) {
        return null;
    }
})();
const NetworkContractModule = (() => {
    try {
        return _require('../../shared/network-contract');
    } catch (e) {
        return null;
    }
})();
const PlayerProfileModule = (() => {
    try {
        return _require('../player-profile');
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
const FeatureStylesheetLoader = (() => {
    try {
        return _require('../assets/feature-stylesheet-loader');
    } catch (e) {
        return null;
    }
})();
const LazyFeatureSurface = (() => {
    try {
        return _require('../assets/lazy-feature-surface');
    } catch (e) {
        return null;
    }
})();
const NetworkSurfaceTemplate = (() => {
    try {
        return _require('./match-mode/network-surface-template');
    } catch (e) {
        return null;
    }
})();
const MatchModeNetworkChatModule = (() => {
    try {
        return _require('./match-mode/network-chat');
    } catch (e) {
        return null;
    }
})();
const MatchModeNetworkRoomListModule = (() => {
    try {
        return _require('./match-mode/network-room-list');
    } catch (e) {
        return null;
    }
})();
const MatchModeControlPanelLayoutModule = (() => {
    try {
        return _require('./match-mode/control-panel-layout');
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
    const NETWORK_SURFACE_ID = 'network';
    const NETWORK_STYLESHEET_GROUPS = Object.freeze([
        'network-layout-controls',
        'network',
        'network-responsive'
    ]);

    let currentMode = MODE_CPU;
    let networkStatusBaseText = '';
    let networkStatusBaseIsError = false;
    let networkTurnTimerInfo: any = null;
    let networkRoomDebugEnabled = false;
    let networkRoomAutoEnabled = false;
    let selectedNetworkRoomId = '';
    let networkRoomListRequestGeneration = 0;

    const uiRefs: any = {
        modeCpuBtn: null,
        modeReversiBtn: null,
        modeNetworkBtn: null,
        controlPanel: null,
        deckBuilderOpenBtn: null,
        networkPanel: null,
        networkAdvancedSettings: null,
        networkRoomInput: null,
        networkServerInput: null,
        networkPlayerNameInput: null,
        networkBoardSizeRowsInput: null,
        networkBoardSizeColsInput: null,
        networkBoardShapeSelect: null,
        networkBoardSizeSummary: null,
        networkBoardSizeNote: null,
        networkTurnTimeSecondsInput: null,
        networkEnableDebugCheckbox: null,
        networkEnableAutoCheckbox: null,
        networkAllCardsDeckCheckbox: null,
        networkStoneSupplyCheckbox: null,
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
    const NETWORK_SURFACE_REF_IDS = Object.freeze({
        networkPanel: 'networkPanel',
        networkAdvancedSettings: 'networkAdvancedSettings',
        networkRoomInput: 'networkRoomIdInput',
        networkServerInput: 'networkServerInput',
        networkPlayerNameInput: 'networkPlayerNameInput',
        networkBoardSizeRowsInput: 'networkBoardSizeRowsInput',
        networkBoardSizeColsInput: 'networkBoardSizeColsInput',
        networkBoardShapeSelect: 'networkBoardShapeSelect',
        networkBoardSizeSummary: 'networkBoardSizeSummary',
        networkBoardSizeNote: 'networkBoardSizeNote',
        networkTurnTimeSecondsInput: 'networkTurnTimeSecondsInput',
        networkEnableDebugCheckbox: 'networkEnableDebugCheckbox',
        networkEnableAutoCheckbox: 'networkEnableAutoCheckbox',
        networkAllCardsDeckCheckbox: 'networkAllCardsDeckCheckbox',
        networkStoneSupplyCheckbox: 'networkStoneSupplyCheckbox',
        networkCopyRoomBtn: 'networkCopyRoomBtn',
        networkRoomSettingsBtn: 'networkRoomSettingsBtn',
        networkRoomSettingsBackdrop: 'networkRoomSettingsBackdrop',
        networkRoomSettingsPopup: 'networkRoomSettingsPopup',
        networkRoomSettingsCloseBtn: 'networkRoomSettingsCloseBtn',
        networkCreateBtn: 'networkCreateBtn',
        networkJoinBtn: 'networkJoinBtn',
        networkLeaveBtn: 'networkLeaveBtn',
        networkStatus: 'networkStatusText',
        networkDeckInfo: 'networkDeckInfo',
        networkCloseBtn: 'networkCloseBtn',
        networkChatToggle: 'networkChatToggle',
        networkChatMessages: 'networkChatMessages',
        networkChatInput: 'networkChatInput',
        networkChatSendBtn: 'networkChatSendBtn',
        networkRoomPasswordInput: 'networkRoomPasswordInput',
        networkRoomListRefreshBtn: 'networkRoomListRefreshBtn',
        networkRoomList: 'networkRoomList'
    });
    let matchModeControlsBound = false;
    let networkSurfaceHydrated = false;
    let networkSurfaceUsesLazyDom = true;
    let networkSurfaceFailureCleanup: (() => void) | null = null;

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

    function getProfilePlayerName() {
        try {
            if (PlayerProfileModule && typeof PlayerProfileModule.readPlayerProfile === 'function') {
                const profile = PlayerProfileModule.readPlayerProfile();
                return normalizePlayerName(profile && profile.displayName);
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    function saveProfilePlayerName(value: any) {
        const normalized = normalizePlayerName(value);
        if (!normalized) return '';
        try {
            if (PlayerProfileModule && typeof PlayerProfileModule.savePlayerProfile === 'function') {
                const saved = PlayerProfileModule.savePlayerProfile({ displayName: normalized });
                return normalizePlayerName(saved && saved.displayName) || normalized;
            }
        } catch (e) { /* ignore */ }
        return normalized;
    }

    function getSharedPlayerName() {
        const profileName = getProfilePlayerName();
        if (profileName) return profileName;

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
            shape: 'rectangle',
            standard8x8: true
        };
    }

    function normalizeBoardConfig(boardConfig: any, fallbackBoardConfig?: any) {
        const fallback = (fallbackBoardConfig && typeof fallbackBoardConfig === 'object')
            ? fallbackBoardConfig
            : createDefaultBoardConfig();
        try {
            const boardUtils = root.SharedBoardUtils || SharedBoardUtilsModule;
            if (boardUtils && typeof boardUtils.normalizeBoardConfig === 'function') {
                return boardUtils.normalizeBoardConfig(boardConfig, fallback);
            }
        } catch (e) { /* ignore */ }
        const fallbackRows = Number.isFinite(Number(fallback && fallback.rows)) ? Number(fallback.rows) : 8;
        const fallbackCols = Number.isFinite(Number(fallback && fallback.cols)) ? Number(fallback.cols) : 8;
        const rows = Number.isFinite(Number(boardConfig && boardConfig.rows)) ? Number(boardConfig.rows) : fallbackRows;
        const cols = Number.isFinite(Number(boardConfig && boardConfig.cols)) ? Number(boardConfig.cols) : fallbackCols;
        const shape = String(boardConfig && boardConfig.shape || fallback && fallback.shape || '').toLowerCase() === 'circle'
            ? 'circle'
            : 'rectangle';
        const circleSize = shape === 'circle'
            ? Math.max(6, Math.min(16, 6 + Math.round((rows - 6) / 2) * 2))
            : null;
        return {
            rows: circleSize !== null ? circleSize : rows,
            cols: circleSize !== null ? circleSize : cols,
            shape,
            standard8x8: shape === 'rectangle' && rows === 8 && cols === 8
        };
    }

    function getBoardDimensionBounds(axis: any) {
        let sharedBoardUtils: any = null;
        try {
            sharedBoardUtils = root.SharedBoardUtils || SharedBoardUtilsModule || null;
            if (sharedBoardUtils && typeof sharedBoardUtils.getBoardDimensionBounds === 'function') {
                return sharedBoardUtils.getBoardDimensionBounds(axis);
            }
        } catch (e) { /* ignore */ }
        const columnAxis = axis === 'col' || axis === 'cols' || axis === 'column';
        const minValue = columnAxis ? sharedBoardUtils && sharedBoardUtils.MIN_BOARD_COLS : sharedBoardUtils && sharedBoardUtils.MIN_BOARD_ROWS;
        const maxValue = columnAxis ? sharedBoardUtils && sharedBoardUtils.MAX_BOARD_COLS : sharedBoardUtils && sharedBoardUtils.MAX_BOARD_ROWS;
        return {
            min: minValue != null && Number.isFinite(Number(minValue)) ? Number(minValue) : 4,
            max: maxValue != null && Number.isFinite(Number(maxValue)) ? Number(maxValue) : 16
        };
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

    function normalizeNetworkTurnTimeSeconds(value: any, fallback?: any) {
        if (NetworkContractModule && typeof NetworkContractModule.normalizeNetworkTurnLimitSeconds === 'function') {
            return NetworkContractModule.normalizeNetworkTurnLimitSeconds(value, fallback);
        }
        const fallbackValue = Number.isFinite(Number(fallback)) ? Math.trunc(Number(fallback)) : 120;
        const numeric = Number(value);
        return Math.max(3, Math.min(1800, Number.isFinite(numeric) ? Math.trunc(numeric) : fallbackValue));
    }

    function readNetworkTurnTimeSeconds() {
        const input = uiRefs.networkTurnTimeSecondsInput;
        const normalized = normalizeNetworkTurnTimeSeconds(input ? input.value : undefined);
        if (input) input.value = String(normalized);
        return normalized;
    }

    function stepNetworkTurnTimeSeconds(direction: any) {
        const input = uiRefs.networkTurnTimeSecondsInput;
        const current = normalizeNetworkTurnTimeSeconds(input ? input.value : undefined);
        const wheelStep = NetworkContractModule
            && Number.isFinite(Number(NetworkContractModule.NETWORK_TURN_LIMIT_WHEEL_STEP_SECONDS))
            ? Number(NetworkContractModule.NETWORK_TURN_LIMIT_WHEEL_STEP_SECONDS)
            : 10;
        const next = normalizeNetworkTurnTimeSeconds(current + (Number(direction) > 0 ? wheelStep : -wheelStep), current);
        if (input) input.value = String(next);
        return next;
    }

    function applyBoardDimensionInputBounds(inputRef: any, axis: any) {
        if (!inputRef) return;
        const sharedBoardUtils = root.SharedBoardUtils || SharedBoardUtilsModule || null;
        const circle = uiRefs.networkBoardShapeSelect && uiRefs.networkBoardShapeSelect.value === 'circle';
        const circleMinValue = sharedBoardUtils && sharedBoardUtils.MIN_CIRCLE_BOARD_SIZE;
        const circleMaxValue = sharedBoardUtils && sharedBoardUtils.MAX_CIRCLE_BOARD_SIZE;
        const circleStepValue = sharedBoardUtils && sharedBoardUtils.CIRCLE_BOARD_SIZE_STEP;
        const bounds = circle
            ? {
                min: circleMinValue != null && Number.isFinite(Number(circleMinValue)) ? Number(circleMinValue) : 6,
                max: circleMaxValue != null && Number.isFinite(Number(circleMaxValue)) ? Number(circleMaxValue) : 16
            }
            : getBoardDimensionBounds(axis);
        inputRef.min = String(bounds.min);
        inputRef.max = String(bounds.max);
        inputRef.step = String(circle
            ? (circleStepValue != null && Number.isFinite(Number(circleStepValue)) ? Number(circleStepValue) : 2)
            : 1);
    }

    function getPendingRoomBoardConfig() {
        const localBoardConfig = getActiveLocalBoardConfig();
        if (localBoardConfig) {
            return normalizeBoardConfig(localBoardConfig);
        }
        if (uiRefs.networkBoardSizeRowsInput || uiRefs.networkBoardSizeColsInput) {
            return normalizeBoardConfig({
                shape: uiRefs.networkBoardShapeSelect ? uiRefs.networkBoardShapeSelect.value : 'rectangle',
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
        const normalizedBoardConfig = boardConfig
            && typeof boardConfig === 'object'
            && Number.isFinite(Number(boardConfig.rows))
            && Number.isFinite(Number(boardConfig.cols))
            ? boardConfig
            : normalizeBoardConfig(boardConfig);
        if (normalizedBoardConfig.shape !== 'circle') return `${normalizedBoardConfig.rows}x${normalizedBoardConfig.cols}`;
        const boardUtils = root.SharedBoardUtils || SharedBoardUtilsModule || null;
        const playableCount = boardUtils && typeof boardUtils.collectMainBoardCoordinates === 'function'
            ? boardUtils.collectMainBoardCoordinates(normalizedBoardConfig).length
            : 0;
        return `円形 ${normalizedBoardConfig.rows}x${normalizedBoardConfig.cols} / ${playableCount}マス`;
    }

    function hasCustomRoomBoardConfig(boardConfig: any) {
        if (!boardConfig || typeof boardConfig !== 'object') return false;
        const rows = Number(boardConfig.rows);
        const cols = Number(boardConfig.cols);
        return String(boardConfig.shape || '').toLowerCase() === 'circle' || !(rows === 8 && cols === 8);
    }

    function formatPendingRoomDeckText() {
        if (uiRefs.networkAllCardsDeckCheckbox && uiRefs.networkAllCardsDeckCheckbox.checked) {
            return '作成時に送るデッキ: 両者全カードデッキ';
        }
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

    function renderNetworkBoardSizeControls(roomState: any, pendingBoardConfig?: any) {
        const roomBoardConfig = getRoomBoardConfig(roomState);
        const activeBoardConfig = roomBoardConfig || pendingBoardConfig || getPendingRoomBoardConfig();
        const locked = !!roomBoardConfig;
        const circle = activeBoardConfig.shape === 'circle';

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
        if (uiRefs.networkBoardShapeSelect) {
            uiRefs.networkBoardShapeSelect.value = circle ? 'circle' : 'rectangle';
            uiRefs.networkBoardShapeSelect.disabled = locked;
        }
        if (uiRefs.networkBoardSizeNote) {
            uiRefs.networkBoardSizeNote.textContent = locked
                ? 'ネット対戦中は部屋で決めた盤面形状とサイズを使います'
                : (circle ? '円形は6〜16の偶数・正方形固定' : '部屋作成前に変更できます');
            uiRefs.networkBoardSizeNote.classList.toggle('is-room-override', locked);
        }
    }

    function updatePendingRoomBoardConfigFromInputs() {
        const controller = getDeckBuilderController();
        const nextBoardConfig = normalizeBoardConfig({
            shape: uiRefs.networkBoardShapeSelect ? uiRefs.networkBoardShapeSelect.value : 'rectangle',
            rows: uiRefs.networkBoardSizeRowsInput ? uiRefs.networkBoardSizeRowsInput.value : null,
            cols: uiRefs.networkBoardSizeColsInput ? uiRefs.networkBoardSizeColsInput.value : null
        }, getPendingRoomBoardConfig());
        if (controller && typeof controller.setLocalBoardConfig === 'function') {
            controller.setLocalBoardConfig(nextBoardConfig);
        }
        renderNetworkDeckInfo(undefined, nextBoardConfig);
    }

    function syncNetworkCircleBoardSizeInputs(inputRef: any, commitInvalid: boolean) {
        if (!uiRefs.networkBoardShapeSelect || uiRefs.networkBoardShapeSelect.value !== 'circle') return true;
        const boardUtils = root.SharedBoardUtils || SharedBoardUtilsModule || null;
        if (!boardUtils || typeof boardUtils.normalizeCircleBoardSize !== 'function') return false;
        const rawValue = Number(inputRef && inputRef.value);
        const min = Number(boardUtils.MIN_CIRCLE_BOARD_SIZE);
        const max = Number(boardUtils.MAX_CIRCLE_BOARD_SIZE);
        const step = Number(boardUtils.CIRCLE_BOARD_SIZE_STEP) || 2;
        const valid = Number.isInteger(rawValue) && rawValue >= min && rawValue <= max && (rawValue - min) % step === 0;
        if (!valid && !commitInvalid) return false;
        const fallback = getPendingRoomBoardConfig();
        const normalized = boardUtils.normalizeCircleBoardSize(rawValue, fallback.rows);
        if (uiRefs.networkBoardSizeRowsInput) uiRefs.networkBoardSizeRowsInput.value = String(normalized);
        if (uiRefs.networkBoardSizeColsInput) uiRefs.networkBoardSizeColsInput.value = String(normalized);
        return true;
    }

    function formatSeatDeckText(seatLabel: any, deckSize: any) {
        if (Number.isFinite(Number(deckSize))) {
            return `${seatLabel} ${Number(deckSize)}枚`;
        }
        return `${seatLabel} デッキ`;
    }

    function hasCustomRoomDeck(roomDeck: any) {
        if (!roomDeck || typeof roomDeck !== 'object') return false;
        if (String(roomDeck.source || '').trim() === 'allCards') return true;
        return roomDeck.mode === 'perPlayer';
    }

    function formatRoomDeckText(roomDeck: any) {
        if (!roomDeck || typeof roomDeck !== 'object') {
            return formatPendingRoomDeckText();
        }
        if (String(roomDeck.source || '').trim() === 'allCards') {
            const deckSize = Number.isFinite(Number(roomDeck.deckSize)) ? Number(roomDeck.deckSize) : null;
            return deckSize !== null
                ? `部屋デッキ: 両者全カードデッキ ${deckSize}枚`
                : '部屋デッキ: 両者全カードデッキ';
        }
        if (roomDeck.mode === 'perPlayer') {
            const deckSizeByPlayer = (roomDeck.deckSizeByPlayer && typeof roomDeck.deckSizeByPlayer === 'object')
                ? roomDeck.deckSizeByPlayer
                : {};
            return `部屋デッキ: ${formatSeatDeckText('黒', deckSizeByPlayer.black)} / ${formatSeatDeckText('白', deckSizeByPlayer.white)}`;
        }
        if (Number.isFinite(Number(roomDeck.deckSize))) {
            return `部屋デッキ: ${Number(roomDeck.deckSize)}枚`;
        }
        return '部屋デッキ';
    }

    function renderNetworkDeckInfo(roomState?: any, pendingBoardConfig?: any) {
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
            : `作成時に送る盤面: ${formatBoardConfigLabel(pendingBoardConfig || getPendingRoomBoardConfig())}`;
        el.textContent = `${formatRoomDeckText(roomDeck)} / ${boardText}`;
        el.style.color = (hasCustomRoomDeck(roomDeck) || hasCustomRoomBoardConfig(roomBoardConfig)) ? '#ffecb3' : '#d7ccc8';
        renderNetworkBoardSizeControls(roomState, pendingBoardConfig);
        renderNetworkTurnTimeControl(roomState);
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

        let stored = saveProfilePlayerName(normalized) || normalized;
        try {
            if (root.LeaderboardClient && typeof root.LeaderboardClient.setPlayerName === 'function') {
                stored = normalizePlayerName(root.LeaderboardClient.setPlayerName(stored)) || stored;
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
        const limitSeconds = timer && Number.isFinite(Number(timer.limitSeconds))
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

    function readNetworkAllCardsDeckEnabled() {
        return !!(uiRefs.networkAllCardsDeckCheckbox && uiRefs.networkAllCardsDeckCheckbox.checked);
    }

    function readNetworkStoneSupplyEnabled() {
        return !uiRefs.networkStoneSupplyCheckbox || uiRefs.networkStoneSupplyCheckbox.checked === true;
    }

    let networkRoomListController: any = null;

    function createNetworkRoomListControllerContext() {
        return {
            root,
            uiRefs,
            normalizePlayerName,
            normalizeRoomName,
            formatRoomIdInput,
            joinRoomFromList,
            spectateRoomFromList
        };
    }

    function getNetworkRoomListController() {
        if (!networkRoomListController
            && MatchModeNetworkRoomListModule
            && typeof MatchModeNetworkRoomListModule.createNetworkRoomListController === 'function') {
            networkRoomListController = MatchModeNetworkRoomListModule.createNetworkRoomListController(createNetworkRoomListControllerContext());
        }
        return networkRoomListController;
    }

    function ensureNetworkLobbyUi() {
        const controller = getNetworkRoomListController();
        if (controller && typeof controller.ensureNetworkLobbyUi === 'function') {
            controller.ensureNetworkLobbyUi();
        }
    }

    function renderNetworkTurnTimeControl(roomState: any) {
        const input = uiRefs.networkTurnTimeSecondsInput;
        if (!input) return;
        const clientActive = !!(
            root.NetworkMatchClient
            && typeof root.NetworkMatchClient.isActive === 'function'
            && root.NetworkMatchClient.isActive()
        );
        const explicitRoomTimer = roomState && roomState.turnTimer && typeof roomState.turnTimer === 'object'
            ? roomState.turnTimer
            : null;
        const roomTimer = explicitRoomTimer || (clientActive ? networkTurnTimerInfo : null);
        const roomLimit = roomTimer && Number.isFinite(Number(roomTimer.limitSeconds))
            ? normalizeNetworkTurnTimeSeconds(roomTimer.limitSeconds)
            : null;
        input.disabled = clientActive || explicitRoomTimer !== null;
        input.value = String(roomLimit !== null
            ? roomLimit
            : normalizeNetworkTurnTimeSeconds(input.value));
    }

    function renderNetworkRoomList(rooms: any[]) {
        const controller = getNetworkRoomListController();
        if (controller && typeof controller.renderNetworkRoomList === 'function') {
            controller.renderNetworkRoomList(rooms);
        }
    }

    async function refreshNetworkRoomList(options?: any) {
        const silentStatus = !!(options && options.silentStatus === true);
        if (!root.NetworkMatchClient || typeof root.NetworkMatchClient.listRooms !== 'function') {
            if (!silentStatus) writeNetworkStatus('ルーム一覧を取得できません', true);
            return;
        }
        const client = root.NetworkMatchClient;
        const requestGeneration = ++networkRoomListRequestGeneration;
        const activeRoom = typeof client.isActive === 'function' && client.isActive() === true;
        const serverUrl = activeRoom && typeof client.getServerUrl === 'function'
            ? String(client.getServerUrl() || '')
            : (uiRefs.networkServerInput ? uiRefs.networkServerInput.value.trim() : '');
        try {
            if (!activeRoom && typeof client.setServerUrl === 'function') {
                client.setServerUrl(serverUrl);
            }
            const result = await client.listRooms({ serverUrl });
            if (requestGeneration !== networkRoomListRequestGeneration) return;
            if (!result || result.ok !== true) {
                renderNetworkRoomList([]);
                return;
            }
            renderNetworkRoomList(result.rooms || []);
            if (!silentStatus) writeNetworkStatus(`ルーム一覧を更新しました（${(result.rooms || []).length}件）`, false);
        } catch (e) {
            if (requestGeneration !== networkRoomListRequestGeneration) return;
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

    function collectNetworkSurfaceRefs(documentRef: Document, supplied?: any) {
        const explicit = (supplied && typeof supplied === 'object') ? supplied : {};
        const refs: any = {};
        Object.entries(NETWORK_SURFACE_REF_IDS).forEach(([refName, elementId]) => {
            refs[refName] = explicit[refName]
                || documentRef.getElementById(String(elementId))
                || null;
        });
        refs.networkOverlay = explicit.networkOverlay
            || documentRef.getElementById('networkOverlay')
            || uiRefs.networkOverlay
            || null;
        refs.networkChatPanel = explicit.networkChatPanel
            || documentRef.getElementById('networkChatPanel')
            || uiRefs.networkChatPanel
            || null;
        refs.networkTimerStatus = explicit.networkTimerStatus
            || documentRef.getElementById('networkTimerStatus')
            || uiRefs.networkTimerStatus
            || null;
        return refs;
    }

    function detachNetworkUiRefs(refs: any) {
        Object.keys(NETWORK_SURFACE_REF_IDS).forEach((refName) => {
            if (!refs || uiRefs[refName] === refs[refName]) {
                uiRefs[refName] = null;
            }
        });
        networkSurfaceHydrated = false;
    }

    function reprojectNetworkUiState() {
        const sharedName = normalizePlayerName(getSharedPlayerName());
        if (
            uiRefs.networkPlayerNameInput
            && sharedName
            && sharedName !== DEFAULT_PLAYER_NAME
            && !normalizePlayerName(uiRefs.networkPlayerNameInput.value)
        ) {
            uiRefs.networkPlayerNameInput.value = sharedName;
        }
        const client = root.NetworkMatchClient;
        if (
            uiRefs.networkServerInput
            && client
            && typeof client.getServerUrl === 'function'
            && !String(uiRefs.networkServerInput.value || '').trim()
        ) {
            try {
                uiRefs.networkServerInput.value = String(client.getServerUrl() || '');
            } catch (e) { /* ignore */ }
        }
        if (
            !networkStatusBaseText
            && client
            && typeof client.isActive === 'function'
            && client.isActive()
        ) {
            writeNetworkStatus(
                isNetworkSpectatorActive() ? 'ネット対戦: 観測中' : 'ネット対戦: 接続中',
                false
            );
        } else {
            renderNetworkStatus();
        }
        refreshModeButtons();
        renderNetworkDeckInfo();
        refreshNetworkChatVisibility();
        applyNetworkDebugModeAccess();
        refreshNetworkAutoModeAccess();
    }

    function hydrateNetworkUiRefs(surfaceOrRefs: any, context?: any) {
        const documentRef = (context && context.document)
            || (typeof document !== 'undefined' ? document : null);
        if (!documentRef) {
            throw new Error('Network surface hydration requires a Document');
        }
        const supplied = surfaceOrRefs && surfaceOrRefs.refs
            ? surfaceOrRefs.refs
            : surfaceOrRefs;
        const refs = collectNetworkSurfaceRefs(documentRef, supplied);
        Object.assign(uiRefs, refs);

        ensureNetworkLobbyUi();
        Object.assign(uiRefs, collectNetworkSurfaceRefs(documentRef, uiRefs));

        if (!networkSurfaceHydrated) {
            if (uiRefs.networkEnableDebugCheckbox) uiRefs.networkEnableDebugCheckbox.checked = false;
            if (uiRefs.networkEnableAutoCheckbox) uiRefs.networkEnableAutoCheckbox.checked = false;
            if (uiRefs.networkAllCardsDeckCheckbox) uiRefs.networkAllCardsDeckCheckbox.checked = false;
            if (uiRefs.networkStoneSupplyCheckbox) uiRefs.networkStoneSupplyCheckbox.checked = true;
            if (uiRefs.networkTurnTimeSecondsInput) uiRefs.networkTurnTimeSecondsInput.value = '120';
            bindNetworkButtons();
            bindNetworkOverlayControls();
            networkSurfaceHydrated = true;
            if (context && typeof context.recordListenerBinding === 'function') {
                context.recordListenerBinding(1);
            }
        }
        reprojectNetworkUiState();
        return refs;
    }

    function createNetworkSurface(context: any) {
        const documentRef = context.document as Document;
        const overlay = documentRef.getElementById('networkOverlay') as HTMLElement | null;
        const modal = documentRef.getElementById('networkModal') as HTMLElement | null;
        const chatPanel = documentRef.getElementById('networkChatPanel') as HTMLElement | null;
        if (
            !overlay
            || !modal
            || !chatPanel
            || !NetworkSurfaceTemplate
            || typeof NetworkSurfaceTemplate.NETWORK_MODAL_INNER_HTML !== 'string'
            || typeof NetworkSurfaceTemplate.NETWORK_CHAT_INNER_HTML !== 'string'
        ) {
            throw new Error('Network stable shell or surface template is unavailable');
        }

        const modalTemplate = documentRef.createElement('template');
        modalTemplate.innerHTML = NetworkSurfaceTemplate.NETWORK_MODAL_INNER_HTML.trim();
        const chatTemplate = documentRef.createElement('template');
        chatTemplate.innerHTML = NetworkSurfaceTemplate.NETWORK_CHAT_INNER_HTML.trim();
        modal.replaceChildren(modalTemplate.content.cloneNode(true));
        chatPanel.replaceChildren(chatTemplate.content.cloneNode(true));
        context.recordDomCreated(modal.childElementCount + chatPanel.childElementCount);

        const refs = collectNetworkSurfaceRefs(documentRef);
        context.addCleanup(() => {
            detachNetworkUiRefs(refs);
            modal.replaceChildren();
            chatPanel.replaceChildren();
            chatPanel.classList.remove('is-active', 'is-open');
            chatPanel.setAttribute('aria-hidden', 'true');
            overlay.classList.remove('is-open', 'network-surface-failure');
            overlay.setAttribute('aria-hidden', 'true');
            modal.classList.remove('network-surface-failure');
        });
        return { overlay, modal, chatPanel, refs };
    }

    function clearNetworkSurfaceFailure(restoreFocus = false) {
        const documentRef = typeof document !== 'undefined' ? document : null;
        const overlay = documentRef?.getElementById('networkOverlay') as HTMLElement | null;
        const modal = documentRef?.getElementById('networkModal') as HTMLElement | null;
        const hadFailure = !!(
            overlay?.classList.contains('network-surface-failure')
            || modal?.classList.contains('network-surface-failure')
        );
        networkSurfaceFailureCleanup?.();
        networkSurfaceFailureCleanup = null;
        if (!hadFailure) return;
        overlay?.classList.remove('is-open', 'network-surface-failure');
        overlay?.setAttribute('aria-hidden', 'true');
        modal?.classList.remove('network-surface-failure');
        modal?.replaceChildren();
        uiRefs.modeNetworkBtn?.setAttribute('aria-expanded', 'false');
        if (restoreFocus) {
            try { uiRefs.modeNetworkBtn?.focus(); } catch (e) { /* best-effort */ }
        }
    }

    function showNetworkSurfaceFailure() {
        const documentRef = typeof document !== 'undefined' ? document : null;
        const overlay = documentRef?.getElementById('networkOverlay') as HTMLElement | null;
        const modal = documentRef?.getElementById('networkModal') as HTMLElement | null;
        const chatPanel = documentRef?.getElementById('networkChatPanel') as HTMLElement | null;
        if (!documentRef || !overlay || !modal) return;
        clearNetworkSurfaceFailure(false);
        chatPanel?.replaceChildren();
        overlay.classList.add('is-open', 'network-surface-failure');
        overlay.setAttribute('aria-hidden', 'false');
        modal.classList.add('network-surface-failure');
        uiRefs.modeNetworkBtn?.setAttribute('aria-expanded', 'true');

        const title = documentRef.createElement('div');
        title.className = 'network-surface-failure-title';
        title.textContent = 'ネット対戦画面を読み込めませんでした';
        const message = documentRef.createElement('p');
        message.className = 'network-surface-failure-message';
        message.textContent = '閉じてネット対戦ボタンをもう一度押すと再試行します。';
        const closeBtn = documentRef.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-small';
        closeBtn.textContent = '閉じる';
        modal.replaceChildren(title, message, closeBtn);

        const close = () => clearNetworkSurfaceFailure(true);
        const onBackdrop = (event: Event) => {
            if (event.target === overlay) close();
        };
        const onKeydown = (event: Event) => {
            if ((event as KeyboardEvent).key !== 'Escape') return;
            event.preventDefault();
            close();
        };
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', onBackdrop);
        documentRef.addEventListener('keydown', onKeydown);
        networkSurfaceFailureCleanup = () => {
            closeBtn.removeEventListener('click', close);
            overlay.removeEventListener('click', onBackdrop);
            documentRef.removeEventListener('keydown', onKeydown);
        };
        try { closeBtn.focus(); } catch (e) { /* best-effort */ }
    }

    function ensureNetworkSurface() {
        if (networkSurfaceHydrated) return Promise.resolve(uiRefs);
        const documentRef = typeof document !== 'undefined' ? document : null;
        if (!documentRef || !LazyFeatureSurface || typeof LazyFeatureSurface.ensureLazyFeatureSurface !== 'function') {
            return Promise.reject(new Error('Network lazy surface loader is unavailable'));
        }
        clearNetworkSurfaceFailure(false);
        uiRefs.modeNetworkBtn?.setAttribute('aria-busy', 'true');
        return Promise.resolve(
            LazyFeatureSurface.ensureLazyFeatureSurface(NETWORK_SURFACE_ID, documentRef)
        ).then((surface: any) => surface.dom).finally(() => {
            uiRefs.modeNetworkBtn?.removeAttribute('aria-busy');
        });
    }

    function isNetworkOverlayOpen() {
        return !!(uiRefs.networkOverlay && uiRefs.networkOverlay.classList.contains('is-open'));
    }

    function setNetworkOverlayVisible(visible: any) {
        if (!uiRefs.networkOverlay) return;
        const open = !!visible;
        const wasOpen = isNetworkOverlayOpen();
        if (open && !networkSurfaceUsesLazyDom) {
            try {
                if (FeatureStylesheetLoader && typeof FeatureStylesheetLoader.ensureFeatureStylesheet === 'function') {
                    NETWORK_STYLESHEET_GROUPS.forEach((group) => {
                        void FeatureStylesheetLoader.ensureFeatureStylesheet(group, typeof document !== 'undefined' ? document : null);
                    });
                }
            } catch (e) { /* fallback styling must not block the panel */ }
        }
        if (!open) {
            setNetworkRoomSettingsPopupVisible(false);
        } else {
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
        } else if (!open && wasOpen && uiRefs.modeNetworkBtn && typeof uiRefs.modeNetworkBtn.focus === 'function') {
            try {
                uiRefs.modeNetworkBtn.focus({ preventScroll: true });
            } catch (e) {
                try { uiRefs.modeNetworkBtn.focus(); } catch (_e) { /* ignore */ }
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
            isNetworkOverlayOpen,
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
        if (visible === true) {
        }
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

    let networkChatController: any = null;

    function createNetworkChatControllerContext() {
        return {
            root,
            uiRefs,
            CHAT_INPUT_FALLBACK_MAX
        };
    }

    function getNetworkChatController() {
        if (!networkChatController
            && MatchModeNetworkChatModule
            && typeof MatchModeNetworkChatModule.createNetworkChatController === 'function') {
            networkChatController = MatchModeNetworkChatModule.createNetworkChatController(createNetworkChatControllerContext());
        }
        return networkChatController;
    }

    function getNetworkChatVisible() {
        const controller = getNetworkChatController();
        return !!(controller && typeof controller.getVisible === 'function' && controller.getVisible());
    }

    function getChatMaxLength() {
        const controller = getNetworkChatController();
        return controller && typeof controller.getChatMaxLength === 'function'
            ? controller.getChatMaxLength()
            : CHAT_INPUT_FALLBACK_MAX;
    }

    function formatChatInput(value: any) {
        const controller = getNetworkChatController();
        return controller && typeof controller.formatInput === 'function'
            ? controller.formatInput(value)
            : Array.from(String(value || '').replace(/[\r\n]+/g, ' ').trim()).slice(0, CHAT_INPUT_FALLBACK_MAX).join('');
    }

    function appendNetworkChatMessage(entry: any) {
        const controller = getNetworkChatController();
        if (controller && typeof controller.appendMessage === 'function') {
            controller.appendMessage(entry);
        }
    }

    function showNetworkChatSpeechBubble(entry: any) {
        const controller = getNetworkChatController();
        if (controller && typeof controller.showSpeechBubble === 'function') {
            controller.showSpeechBubble(entry);
        }
    }

    function renderNetworkChatHistory(messages: any) {
        const controller = getNetworkChatController();
        if (controller && typeof controller.renderHistory === 'function') {
            controller.renderHistory(messages);
        }
    }

    function setNetworkChatExpanded(expanded: any) {
        const controller = getNetworkChatController();
        if (controller && typeof controller.setExpanded === 'function') {
            controller.setExpanded(expanded);
        }
    }

    function refreshNetworkChatVisibility() {
        const controller = getNetworkChatController();
        if (controller && typeof controller.refreshVisibility === 'function') {
            controller.refreshVisibility({
                networkMode: currentMode === MODE_NETWORK,
                spectatorActive: isNetworkSpectatorActive()
            });
        }
    }

    let controlPanelLayoutController: any = null;

    function createControlPanelLayoutControllerContext() {
        return {
            root,
            uiRefs
        };
    }

    function getControlPanelLayoutController() {
        if (!controlPanelLayoutController
            && MatchModeControlPanelLayoutModule
            && typeof MatchModeControlPanelLayoutModule.createControlPanelLayoutController === 'function') {
            controlPanelLayoutController = MatchModeControlPanelLayoutModule.createControlPanelLayoutController(createControlPanelLayoutControllerContext());
        }
        return controlPanelLayoutController;
    }

    function measureBaseControlPanelHeight() {
        const controller = getControlPanelLayoutController();
        return controller && typeof controller.measureBaseControlPanelHeight === 'function'
            ? controller.measureBaseControlPanelHeight()
            : 0;
    }

    function scheduleControlPanelLayoutSync() {
        const controller = getControlPanelLayoutController();
        if (controller && typeof controller.scheduleControlPanelLayoutSync === 'function') {
            controller.scheduleControlPanelLayoutSync();
        }
    }

    function bindControlPanelLayoutObservers() {
        const controller = getControlPanelLayoutController();
        if (controller && typeof controller.bindControlPanelLayoutObservers === 'function') {
            controller.bindControlPanelLayoutObservers();
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
        if (
            nextMode === MODE_NETWORK
            && opts.surfaceReady !== true
            && !networkSurfaceHydrated
        ) {
            await ensureNetworkSurface();
        }
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
        const client = root.NetworkMatchClient;
        try {
            if (!client || typeof client.restoreStoredSession !== 'function') return;
            if (typeof client.hasRestorableStoredSession === 'function') {
                if (client.hasRestorableStoredSession() !== true) return;
            } else if (networkSurfaceUsesLazyDom) {
                return;
            }
            if (!networkSurfaceHydrated) {
                await ensureNetworkSurface();
            }
            const result = await client.restoreStoredSession();
            if (!result || result.ok !== true) {
                if (result && result.reason === 'NO_STORED_SESSION') return;
                writeNetworkStatus('ネット対戦: 保存セッションの復帰に失敗しました', true);
                return;
            }
            await setMode(MODE_NETWORK, {
                silentLog: true,
                skipReset: true,
                suppressStatus: true,
                surfaceReady: true
            });
            const role = String(result.viewerRole || '').trim().toLowerCase();
            writeNetworkStatus(role === 'spectator'
                ? 'ネット対戦: 観測セッションへ復帰しました'
                : 'ネット対戦: 対戦セッションへ復帰しました', false);
            setNetworkOverlayVisible(false);
            renderNetworkTimerStatus();
            refreshNetworkChatVisibility();
        } catch (e) {
            if (networkSurfaceHydrated) {
                writeNetworkStatus('ネット対戦: 保存セッションの復帰に失敗しました', true);
            }
            // Normal CPU boot remains available and the stored session is left for retry.
        }
    }

    function createNetworkButtonBindingContext() {
        return {
            root,
            boardUtils: root.SharedBoardUtils || SharedBoardUtilsModule,
            uiRefs,
            PLAYER_NAME_MAX,
            DEFAULT_PLAYER_NAME,
            MODE_NETWORK,
            MODE_CPU,
            getNetworkChatVisible,
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
            normalizeNetworkTurnTimeSeconds,
            readNetworkTurnTimeSeconds,
            stepNetworkTurnTimeSeconds,
            getPendingRoomBoardConfig,
            stepBoardDimensionValue,
            syncNetworkCircleBoardSizeInputs,
            updatePendingRoomBoardConfigFromInputs,
            readNetworkRoomName,
        readNetworkRoomPassword,
        readNetworkAllCardsDeckEnabled,
        readNetworkStoneSupplyEnabled,
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

    const NetworkSurfaceRegistration = Object.freeze({
        id: NETWORK_SURFACE_ID,
        stylesheetGroups: NETWORK_STYLESHEET_GROUPS,
        ensureDom: createNetworkSurface,
        onReady: (surface: any, context: any) => {
            hydrateNetworkUiRefs(surface.dom, context);
        },
        onFailure: () => {
            showNetworkSurfaceFailure();
        }
    });

    if (LazyFeatureSurface && typeof LazyFeatureSurface.registerLazyFeatureSurface === 'function') {
        LazyFeatureSurface.registerLazyFeatureSurface(NetworkSurfaceRegistration);
    }

    function setupMatchModeControls(options: any) {
        const opts = options || {};
        uiRefs.modeCpuBtn = opts.modeCpuBtn || null;
        uiRefs.modeReversiBtn = opts.modeReversiBtn || opts.modeOthelloBtn || null;
        uiRefs.modeNetworkBtn = opts.modeNetworkBtn || null;
        uiRefs.controlPanel = opts.controlPanel || null;
        uiRefs.deckBuilderOpenBtn = opts.deckBuilderOpenBtn || null;
        uiRefs.networkPanel = opts.networkPanel || null;
        uiRefs.networkAdvancedSettings = opts.networkAdvancedSettings || null;
        uiRefs.networkRoomInput = opts.networkRoomInput || null;
        uiRefs.networkServerInput = opts.networkServerInput || null;
        uiRefs.networkPlayerNameInput = opts.networkPlayerNameInput || null;
        uiRefs.networkBoardSizeRowsInput = opts.networkBoardSizeRowsInput || null;
        uiRefs.networkBoardSizeColsInput = opts.networkBoardSizeColsInput || null;
        uiRefs.networkBoardShapeSelect = opts.networkBoardShapeSelect || null;
        uiRefs.networkBoardSizeSummary = opts.networkBoardSizeSummary || null;
        uiRefs.networkBoardSizeNote = opts.networkBoardSizeNote || null;
        uiRefs.networkTurnTimeSecondsInput = opts.networkTurnTimeSecondsInput || null;
        uiRefs.networkEnableDebugCheckbox = opts.networkEnableDebugCheckbox || null;
        uiRefs.networkEnableAutoCheckbox = opts.networkEnableAutoCheckbox || null;
        uiRefs.networkAllCardsDeckCheckbox = opts.networkAllCardsDeckCheckbox || null;
        uiRefs.networkStoneSupplyCheckbox = opts.networkStoneSupplyCheckbox || null;
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
        networkSurfaceUsesLazyDom = !opts.networkPanel;
        try {
            const payload = { onTimeAttackFirstMove: markTimeAttackFirstMoveForMatchMode };
            if (SharedUIBootstrapModule && typeof SharedUIBootstrapModule.mergeUIImpl === 'function') {
                SharedUIBootstrapModule.mergeUIImpl(root, 'turn_manager', payload);
            } else {
                root.__uiImpl_turn_manager = Object.assign({}, root.__uiImpl_turn_manager || {}, payload);
                root.onTimeAttackFirstMove = markTimeAttackFirstMoveForMatchMode;
            }
        } catch (e) { /* ignore */ }
        if (!networkSurfaceUsesLazyDom) {
            hydrateNetworkUiRefs(opts);
        }
        if (!matchModeControlsBound) {
            if (uiRefs.modeCpuBtn) {
                uiRefs.modeCpuBtn.addEventListener('click', () => {
                    void setMode(MODE_CPU);
                });
            }
            if (uiRefs.modeReversiBtn) {
                uiRefs.modeReversiBtn.addEventListener('click', () => {
                    void setMode(MODE_REVERSI);
                });
            }
            if (uiRefs.modeNetworkBtn) {
                uiRefs.modeNetworkBtn.addEventListener('click', async () => {
                    try {
                        if (currentMode !== MODE_NETWORK) {
                            await setMode(MODE_NETWORK);
                            setLeaderboardOverlayVisible(false);
                            setNetworkOverlayVisible(true);
                            return;
                        }

                        await ensureNetworkSurface();
                        setLeaderboardOverlayVisible(false);
                        setNetworkOverlayVisible(!isNetworkOverlayOpen());
                    } catch (e) {
                        // The surface failure shell owns the retry path.
                    }
                });
            }
            bindLeaderboardControls();
            bindControlPanelLayoutObservers();
            matchModeControlsBound = true;
        }
        measureBaseControlPanelHeight();
        scheduleControlPanelLayoutSync();
        void setMode(MODE_CPU, { force: true, silentLog: true });
        if (!(options && options.deferStoredSessionRestore === true)) {
            restoreStoredNetworkSessionOnBoot();
        }
    }
    export = {
        setupMatchModeControls,
        restoreStoredNetworkSessionOnBoot,
        ensureNetworkSurface,
        hydrateNetworkUiRefs,
        setMode,
        getCurrentMode,
        isLocalOrNetworkMode,
        isNetworkModeActive,
        isReversiModeActive,
        isOthelloModeActive
    };
