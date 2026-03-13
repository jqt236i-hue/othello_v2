(function (root) {
    const MODE_CPU = 'cpu';
    const MODE_NETWORK = 'network';
    const CHAT_INPUT_FALLBACK_MAX = 20;
    const PLAYER_NAME_MAX = 7;
    const DEFAULT_PLAYER_NAME = 'ななし';
    const SHARED_LEADERBOARD_PANEL_LIMIT = 100;

    let currentMode = MODE_CPU;
    let networkChatVisible = false;
    let leaderboardRefreshToken = 0;
    let networkStatusBaseText = '';
    let networkStatusBaseIsError = false;
    let networkTurnTimerInfo = null;

    const uiRefs = {
        modeCpuBtn: null,
        modeNetworkBtn: null,
        controlPanel: null,
        networkPanel: null,
        networkAdvancedSettings: null,
        networkRoomInput: null,
        networkServerInput: null,
        networkPlayerNameInput: null,
        networkCreateBtn: null,
        networkJoinBtn: null,
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

    function normalizeMode(mode) {
        if (mode === MODE_NETWORK) return MODE_NETWORK;
        return MODE_CPU;
    }

    function isHumanMode(mode) {
        return mode === MODE_NETWORK;
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

    function normalizePlayerName(value) {
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

    function getActiveLocalDeckCode() {
        const controller = getDeckBuilderController();
        if (!controller || typeof controller.getActiveLocalChoice !== 'function') {
            return '';
        }
        try {
            const choice = controller.getActiveLocalChoice();
            return (choice && choice.mode === 'custom') ? String(choice.deckCode || '').trim() : '';
        } catch (e) {
            return '';
        }
    }

    function formatPendingRoomDeckText() {
        const controller = getDeckBuilderController();
        if (!controller || typeof controller.getActiveLocalChoice !== 'function') {
            return '作成時に送るデッキ: 標準デッキ';
        }
        try {
            const choice = controller.getActiveLocalChoice();
            if (choice && choice.mode === 'custom') {
                const deckSize = Number.isFinite(Number(choice.deckSize)) ? Number(choice.deckSize) : 30;
                return `作成時に送るデッキ: カスタム ${deckSize}枚`;
            }
            const standardSize = Number.isFinite(Number(choice && choice.deckSize)) ? Number(choice.deckSize) : 64;
            return `作成時に送るデッキ: 標準 ${standardSize}枚`;
        } catch (e) {
            return '作成時に送るデッキ: 標準デッキ';
        }
    }

    function formatSeatDeckText(seatLabel, deckCode, deckSize) {
        if (deckCode) {
            const customSize = Number.isFinite(Number(deckSize)) ? Number(deckSize) : 30;
            return `${seatLabel}カスタム ${customSize}枚`;
        }
        if (Number.isFinite(Number(deckSize))) {
            return `${seatLabel}標準 ${Number(deckSize)}枚`;
        }
        return `${seatLabel}標準デッキ`;
    }

    function hasCustomRoomDeck(roomDeck) {
        if (!roomDeck || typeof roomDeck !== 'object') return false;
        if (roomDeck.deckCode) return true;
        const byPlayer = roomDeck.deckCodeByPlayer && typeof roomDeck.deckCodeByPlayer === 'object'
            ? roomDeck.deckCodeByPlayer
            : null;
        return !!(byPlayer && (byPlayer.black || byPlayer.white));
    }

    function formatRoomDeckText(roomDeck) {
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
            return `部屋デッキ: 標準 ${Number(roomDeck.deckSize)}枚`;
        }
        return '部屋デッキ: 標準デッキ';
    }

    function renderNetworkDeckInfo(roomState) {
        const el = uiRefs.networkDeckInfo;
        if (!el) return;

        let roomDeck = roomState && roomState.roomDeck;
        if (!roomDeck && root.NetworkMatchClient && typeof root.NetworkMatchClient.getRoomDeck === 'function') {
            try {
                roomDeck = root.NetworkMatchClient.getRoomDeck();
            } catch (e) { /* ignore */ }
        }

        el.textContent = formatRoomDeckText(roomDeck);
        el.style.color = hasCustomRoomDeck(roomDeck) ? '#ffecb3' : '#d7ccc8';
        scheduleControlPanelLayoutSync();
    }

    function setSharedPlayerName(value) {
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

    function getShortPlayerId(playerId) {
        const raw = String(playerId || '').trim();
        if (!raw) return '';
        return raw.slice(-4).toUpperCase();
    }

    function collectDuplicateLeaderboardNames(entries) {
        const counts = new Map();
        const list = Array.isArray(entries) ? entries : [];

        list.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            const key = normalizePlayerName(entry.playerName) || DEFAULT_PLAYER_NAME;
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        const duplicates = new Set();
        counts.forEach((count, key) => {
            if (count > 1) duplicates.add(key);
        });
        return duplicates;
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
        const ownTurnLabel = timer.isOwnTurn === true ? '（あなた）' : '';
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

    function writeNetworkStatus(text, isError) {
        networkStatusBaseText = String(text || '');
        networkStatusBaseIsError = !!isError;
        renderNetworkStatus();
    }

    function isNetworkOverlayOpen() {
        return !!(uiRefs.networkOverlay && uiRefs.networkOverlay.classList.contains('is-open'));
    }

    function setNetworkOverlayVisible(visible) {
        if (!uiRefs.networkOverlay) return;
        const open = !!visible;
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
    }

    function writeLeaderboardStatus(text, isError) {
        const el = uiRefs.leaderboardStatus;
        if (el) {
            el.textContent = String(text || '');
            el.style.color = isError ? '#ffb4b4' : '#d8f3dc';
        }
    }

    function isLeaderboardOverlayOpen() {
        return !!(uiRefs.leaderboardOverlay && uiRefs.leaderboardOverlay.classList.contains('is-open'));
    }

    function setLeaderboardOverlayVisible(visible) {
        if (!uiRefs.leaderboardOverlay) return;
        const open = !!visible;
        uiRefs.leaderboardOverlay.classList.toggle('is-open', open);
        uiRefs.leaderboardOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');

        if (uiRefs.leaderboardOpenBtn) {
            uiRefs.leaderboardOpenBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        if (open && uiRefs.leaderboardNameInput && typeof uiRefs.leaderboardNameInput.focus === 'function') {
            try {
                uiRefs.leaderboardNameInput.focus({ preventScroll: true });
            } catch (e) {
                try { uiRefs.leaderboardNameInput.focus(); } catch (_e) { /* ignore */ }
            }
        }
    }

    function formatLeaderboardTime(epochMs) {
        if (!Number.isFinite(Number(epochMs)) || Number(epochMs) <= 0) return '';
        try {
            const date = new Date(Number(epochMs));
            if (!Number.isFinite(date.getTime())) return '';
            const hh = String(date.getHours()).padStart(2, '0');
            const mm = String(date.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        } catch (e) {
            return '';
        }
    }

    function clearLeaderboardRows() {
        if (!uiRefs.leaderboardList) return;
        uiRefs.leaderboardList.innerHTML = '';
    }

    function appendLeaderboardPlaceholder(text) {
        if (!uiRefs.leaderboardList) return;
        const row = document.createElement('div');
        row.className = 'leaderboard-row is-empty';
        row.textContent = String(text || 'まだ記録がありません');
        uiRefs.leaderboardList.appendChild(row);
    }

    function createLeaderboardRow(entry, selfPlayerId, duplicateNames) {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';

        const rank = document.createElement('span');
        rank.className = 'leaderboard-rank';
        rank.textContent = `#${entry.rank || '-'}`;

        const name = document.createElement('span');
        name.className = 'leaderboard-name';
        const normalizedName = normalizePlayerName(entry.playerName) || DEFAULT_PLAYER_NAME;
        const shouldAttachId = !!(duplicateNames && duplicateNames.has(normalizedName));
        const shortId = getShortPlayerId(entry.playerId);
        name.textContent = (shouldAttachId && shortId)
            ? `${normalizedName}#${shortId}`
            : normalizedName;

        const score = document.createElement('span');
        score.className = 'leaderboard-score';
        score.textContent = `${entry.bestScore || 0}`;

        const mode = document.createElement('span');
        mode.className = 'leaderboard-meta';
        const cpuSuffix = Number.isFinite(Number(entry.cpuLevel)) ? ` Lv${entry.cpuLevel}` : '';
        mode.textContent = entry.mode === 'network' ? '対人' : `CPU${cpuSuffix}`;

        if (selfPlayerId && entry.playerId && entry.playerId === selfPlayerId) {
            row.classList.add('is-self');
        }

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(score);
        row.appendChild(mode);
        return row;
    }

    function renderLeaderboardRows(entries) {
        clearLeaderboardRows();
        if (!uiRefs.leaderboardList) return;

        const safeEntries = Array.isArray(entries) ? entries : [];
        if (!safeEntries.length) {
            appendLeaderboardPlaceholder('まだ記録がありません');
            return;
        }

        let selfPlayerId = null;
        try {
            if (root.LeaderboardClient && typeof root.LeaderboardClient.getPlayerId === 'function') {
                selfPlayerId = root.LeaderboardClient.getPlayerId();
            }
        } catch (e) { /* ignore */ }

        const duplicateNames = collectDuplicateLeaderboardNames(safeEntries);

        safeEntries.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            uiRefs.leaderboardList.appendChild(createLeaderboardRow(entry, selfPlayerId, duplicateNames));
        });
    }

    async function refreshLeaderboardPanel(options) {
        const opts = options || {};
        if (!uiRefs.leaderboardPanel || !uiRefs.leaderboardStatus || !uiRefs.leaderboardList) return;
        if (uiRefs.leaderboardOverlay && !isLeaderboardOverlayOpen() && opts.force !== true) return;
        if (!root.LeaderboardClient || typeof root.LeaderboardClient.fetchLeaderboard !== 'function') {
            writeLeaderboardStatus('ランキング機能を利用できません', true);
            return;
        }

        const token = ++leaderboardRefreshToken;
        writeLeaderboardStatus('ランキング更新中...', false);

        let result = null;
        try {
            const fetchOptions = Object.assign({ limit: SHARED_LEADERBOARD_PANEL_LIMIT }, opts);
            delete fetchOptions.force;
            result = await root.LeaderboardClient.fetchLeaderboard(fetchOptions);
        } catch (e) {
            result = { ok: false, reason: 'LIST_FAILED', entries: [] };
        }

        if (token !== leaderboardRefreshToken) return;

        if (!result || result.ok !== true) {
            writeLeaderboardStatus('ランキング取得に失敗しました', true);
            return;
        }

        renderLeaderboardRows(result.entries || []);
        const timeLabel = formatLeaderboardTime(result.updatedAt);
        writeLeaderboardStatus(timeLabel ? `最終更新 ${timeLabel}` : 'ランキングを表示中', false);
    }

    function bindLeaderboardControls() {
        if (!uiRefs.leaderboardPanel || !uiRefs.leaderboardOverlay) return;

        if (uiRefs.leaderboardOpenBtn) {
            uiRefs.leaderboardOpenBtn.addEventListener('click', () => {
                const willOpen = !isLeaderboardOverlayOpen();
                if (willOpen) {
                    setNetworkOverlayVisible(false);
                }
                setLeaderboardOverlayVisible(willOpen);
                if (willOpen) {
                    refreshLeaderboardPanel({ force: true });
                }
            });
        }

        if (uiRefs.leaderboardCloseBtn) {
            uiRefs.leaderboardCloseBtn.addEventListener('click', () => {
                setLeaderboardOverlayVisible(false);
            });
        }

        uiRefs.leaderboardOverlay.addEventListener('click', (event) => {
            if (!event) return;
            if (event.target === uiRefs.leaderboardOverlay) {
                setLeaderboardOverlayVisible(false);
            }
        });

        if (typeof root.addEventListener === 'function') {
            root.addEventListener('keydown', (event) => {
                if (!event || event.key !== 'Escape') return;
                if (isLeaderboardOverlayOpen()) {
                    setLeaderboardOverlayVisible(false);
                    return;
                }
                if (isNetworkOverlayOpen()) {
                    setNetworkOverlayVisible(false);
                }
            });
        }

        if (uiRefs.leaderboardNameInput) {
            let initialName = getSharedPlayerName();
            try {
                if (root.LeaderboardClient && typeof root.LeaderboardClient.getPlayerName === 'function') {
                    initialName = normalizePlayerName(root.LeaderboardClient.getPlayerName());
                }
            } catch (e) { /* ignore */ }
            if (initialName === DEFAULT_PLAYER_NAME) initialName = '';
            uiRefs.leaderboardNameInput.value = initialName;
            if (uiRefs.networkPlayerNameInput && !normalizePlayerName(uiRefs.networkPlayerNameInput.value) && initialName) {
                uiRefs.networkPlayerNameInput.value = initialName;
            }

            const applyName = () => {
                const raw = uiRefs.leaderboardNameInput.value;
                const clipped = normalizePlayerName(raw);
                uiRefs.leaderboardNameInput.value = clipped;

                if (!clipped) {
                    writeLeaderboardStatus(`名前は1〜${PLAYER_NAME_MAX}文字で入力してください`, true);
                    return;
                }

                try {
                    if (root.LeaderboardClient && typeof root.LeaderboardClient.setPlayerName === 'function') {
                        uiRefs.leaderboardNameInput.value = normalizePlayerName(root.LeaderboardClient.setPlayerName(clipped));
                    }
                } catch (e) { /* ignore */ }

                if (uiRefs.networkPlayerNameInput && !normalizePlayerName(uiRefs.networkPlayerNameInput.value)) {
                    uiRefs.networkPlayerNameInput.value = uiRefs.leaderboardNameInput.value;
                }
            };

            uiRefs.leaderboardNameInput.addEventListener('input', () => {
                uiRefs.leaderboardNameInput.value = normalizePlayerName(uiRefs.leaderboardNameInput.value);
            });
            uiRefs.leaderboardNameInput.addEventListener('change', applyName);
            uiRefs.leaderboardNameInput.addEventListener('blur', applyName);
            uiRefs.leaderboardNameInput.addEventListener('keydown', (event) => {
                if (!event || event.key !== 'Enter') return;
                event.preventDefault();
                applyName();
            });
        }

        if (uiRefs.leaderboardReloadBtn) {
            uiRefs.leaderboardReloadBtn.addEventListener('click', () => {
                refreshLeaderboardPanel({ force: true });
            });
        }

        if (typeof root.addEventListener === 'function') {
            root.addEventListener('leaderboard:updated', () => {
                if (!isLeaderboardOverlayOpen()) return;
                refreshLeaderboardPanel({ force: true });
            });
        }

        setLeaderboardOverlayVisible(false);
    }

    function bindNetworkOverlayControls() {
        if (!uiRefs.networkOverlay) return;

        if (uiRefs.networkCloseBtn) {
            uiRefs.networkCloseBtn.addEventListener('click', () => {
                setNetworkOverlayVisible(false);
            });
        }

        uiRefs.networkOverlay.addEventListener('click', (event) => {
            if (!event) return;
            if (event.target === uiRefs.networkOverlay) {
                setNetworkOverlayVisible(false);
            }
        });

        setNetworkOverlayVisible(false);
    }

    function getChatMaxLength() {
        try {
            if (root.NetworkMatchClient && typeof root.NetworkMatchClient.getChatMaxLength === 'function') {
                return Math.max(1, Number(root.NetworkMatchClient.getChatMaxLength()) || CHAT_INPUT_FALLBACK_MAX);
            }
        } catch (e) { /* ignore */ }
        return CHAT_INPUT_FALLBACK_MAX;
    }

    function formatChatInput(value) {
        const maxLength = getChatMaxLength();
        return Array.from(String(value || '').replace(/[\r\n]+/g, ' ').trim())
            .slice(0, maxLength)
            .join('');
    }

    function clearNetworkChatMessages() {
        if (!uiRefs.networkChatMessages) return;
        uiRefs.networkChatMessages.innerHTML = '';
    }

    function appendNetworkChatMessage(entry) {
        if (!uiRefs.networkChatMessages || !entry || !entry.text) return;
        const seatKey = (entry.seatKey === 'white') ? 'white' : 'black';
        const seatLabel = seatKey === 'white' ? '白' : '黒';
        const localSeat = (root.NetworkMatchClient && typeof root.NetworkMatchClient.getSeatKey === 'function')
            ? root.NetworkMatchClient.getSeatKey()
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

    function renderNetworkChatHistory(messages) {
        clearNetworkChatMessages();
        if (!Array.isArray(messages)) return;
        messages.forEach((entry) => appendNetworkChatMessage(entry));
    }

    function setNetworkChatExpanded(expanded) {
        if (!uiRefs.networkChatPanel) return;
        const isOpen = !!expanded;
        uiRefs.networkChatPanel.classList.toggle('is-open', isOpen);
        if (uiRefs.networkChatToggle) {
            uiRefs.networkChatToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
    }

    function setNetworkChatVisible(visible) {
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

    function refreshNetworkChatVisibility() {
        const isNetworkMode = currentMode === MODE_NETWORK;
        const hasTwoPlayers = !!(
            root.NetworkMatchClient
            && typeof root.NetworkMatchClient.hasTwoPlayers === 'function'
            && root.NetworkMatchClient.hasTwoPlayers()
        );
        setNetworkChatVisible(isNetworkMode && hasTwoPlayers);
    }

    function clearControlPanelConstraints() {
        if (!uiRefs.controlPanel) return;
        uiRefs.controlPanel.style.height = '';
        uiRefs.controlPanel.style.maxHeight = '';
        uiRefs.controlPanel.style.overflowY = '';
        uiRefs.controlPanel.style.overscrollBehavior = '';
    }

    function updateCardDetailReserve() {
        try {
            if (!uiRefs.controlPanel || !document || !document.documentElement) return;
            const height = Math.ceil(uiRefs.controlPanel.getBoundingClientRect().height || 0);
            if (height <= 0) return;
            const reserve = Math.max(170, height);
            document.documentElement.style.setProperty('--card-detail-landscape-bottom-reserve', `${reserve}px`);
        } catch (e) { /* ignore */ }
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
        updateCardDetailReserve();
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
                updateCardDetailReserve();
            });
            uiRefs.layoutObserver.observe(uiRefs.controlPanel);
        }
    }

    function syncHumanModeFlags(enabled) {
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

    function refreshModeButtons() {
        const cpuActive = currentMode === MODE_CPU;
        const networkActive = currentMode === MODE_NETWORK;

        if (uiRefs.modeCpuBtn) uiRefs.modeCpuBtn.style.outline = cpuActive ? '2px solid #90ee90' : '';
        if (uiRefs.modeNetworkBtn) uiRefs.modeNetworkBtn.style.outline = networkActive ? '2px solid #90ee90' : '';

        if (uiRefs.networkPanel) {
            uiRefs.networkPanel.style.display = networkActive ? 'block' : 'none';
        }
        if (!networkActive) {
            setNetworkOverlayVisible(false);
        }

        refreshNetworkChatVisibility();
        renderNetworkTimerStatus();
        scheduleControlPanelLayoutSync();
    }

    function hasRenderableState() {
        try {
            const gs = (typeof gameState !== 'undefined' && gameState)
                ? gameState
                : (root && root.gameState ? root.gameState : null);
            const cs = (typeof cardState !== 'undefined' && cardState)
                ? cardState
                : (root && root.cardState ? root.cardState : null);
            if (!gs || !Array.isArray(gs.board) || gs.board.length !== 8) return false;
            if (!cs || typeof cs !== 'object') return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function refreshBoardUi() {
        if (!hasRenderableState()) return;
        try { if (typeof renderCardUI === 'function') renderCardUI(); } catch (e) { /* ignore */ }
        try {
            if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
            else if (typeof renderBoard === 'function') renderBoard();
        } catch (e) { /* ignore */ }
    }

    async function setMode(mode, options) {
        const opts = options || {};
        const nextMode = normalizeMode(mode);
        const prevMode = currentMode;
        if (nextMode === prevMode && !opts.force) {
            refreshModeButtons();
            return;
        }

        if (prevMode === MODE_NETWORK && nextMode !== MODE_NETWORK) {
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
        } catch (e) { /* ignore */ }

        syncHumanModeFlags(isHumanMode(currentMode));
        if (isHumanMode(currentMode)) {
            disableAutoModeForHumanPlay();
        }

        if (currentMode === MODE_NETWORK) {
            writeNetworkStatus('ネット対戦: 部屋作成か部屋参加を選んでください', false);
        } else {
            writeNetworkStatus('CPU対戦モード', false);
            setNetworkOverlayVisible(false);
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
            if (currentMode === MODE_NETWORK) addLog('モード: ネット対戦');
        }
    }

    function bindNetworkButtons() {
        const formatRoomIdInput = (value) => {
            return String(value || '')
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 3);
        };

        const sendChatMessage = async () => {
            if (!uiRefs.networkChatInput) return;
            const text = formatChatInput(uiRefs.networkChatInput.value);
            uiRefs.networkChatInput.value = text;
            if (!text) return;

            if (!root.NetworkMatchClient || typeof root.NetworkMatchClient.sendChatMessage !== 'function') {
                return;
            }

            try {
                const result = await root.NetworkMatchClient.sendChatMessage(text);
                if (result && result.ok) {
                    uiRefs.networkChatInput.value = '';
                }
            } catch (e) {
                writeNetworkStatus('チャット送信に失敗しました', true);
            }
        };

        if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setStatusWriter === 'function') {
            root.NetworkMatchClient.setStatusWriter((text, isError) => {
                writeNetworkStatus(text, isError);
            });
        }

        if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setRoomStateListener === 'function') {
            root.NetworkMatchClient.setRoomStateListener((roomState) => {
                refreshNetworkChatVisibility();
                renderNetworkDeckInfo(roomState);
                try {
                    if (typeof root.updateCpuCharacter === 'function') {
                        root.updateCpuCharacter();
                    }
                } catch (e) { /* ignore */ }
            });
        }

        if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setTurnTimerListener === 'function') {
            root.NetworkMatchClient.setTurnTimerListener((timerInfo) => {
                networkTurnTimerInfo = (timerInfo && typeof timerInfo === 'object') ? timerInfo : null;
                renderNetworkStatus();
            });
        }

        if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setChatListener === 'function') {
            root.NetworkMatchClient.setChatListener((payload) => {
                if (!payload || typeof payload !== 'object') return;
                if (payload.type === 'history') {
                    renderNetworkChatHistory(payload.messages || []);
                    return;
                }
                if (payload.type === 'message' && payload.message) {
                    appendNetworkChatMessage(payload.message);
                }
            });
        }

        if (uiRefs.networkChatToggle) {
            uiRefs.networkChatToggle.addEventListener('click', () => {
                if (!networkChatVisible || !uiRefs.networkChatPanel) return;
                const isOpen = uiRefs.networkChatPanel.classList.contains('is-open');
                setNetworkChatExpanded(!isOpen);
            });
        }

        if (uiRefs.networkChatInput) {
            uiRefs.networkChatInput.setAttribute('maxlength', String(getChatMaxLength()));
            uiRefs.networkChatInput.addEventListener('input', () => {
                uiRefs.networkChatInput.value = formatChatInput(uiRefs.networkChatInput.value);
            });
            uiRefs.networkChatInput.addEventListener('change', () => {
                uiRefs.networkChatInput.value = formatChatInput(uiRefs.networkChatInput.value);
            });
            uiRefs.networkChatInput.addEventListener('keydown', (event) => {
                if (event && event.key === 'Enter') {
                    event.preventDefault();
                    sendChatMessage();
                }
            });
        }

        if (uiRefs.networkChatSendBtn) {
            uiRefs.networkChatSendBtn.addEventListener('click', () => {
                sendChatMessage();
            });
        }

        if (uiRefs.networkServerInput) {
            try {
                if (root.NetworkMatchClient && typeof root.NetworkMatchClient.getServerUrl === 'function') {
                    const initial = root.NetworkMatchClient.getServerUrl();
                    if (initial) uiRefs.networkServerInput.value = initial;
                }
            } catch (e) { /* ignore */ }
            uiRefs.networkServerInput.addEventListener('change', () => {
                const nextUrl = uiRefs.networkServerInput.value.trim();
                if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setServerUrl === 'function') {
                    root.NetworkMatchClient.setServerUrl(nextUrl);
                }
            });
        }

        if (uiRefs.networkPlayerNameInput) {
            uiRefs.networkPlayerNameInput.setAttribute('maxlength', String(PLAYER_NAME_MAX));
            uiRefs.networkPlayerNameInput.setAttribute('placeholder', '名前を入力してください');
            const initialName = normalizePlayerName(getSharedPlayerName());
            if (initialName && initialName !== DEFAULT_PLAYER_NAME) {
                uiRefs.networkPlayerNameInput.value = initialName;
            } else if (normalizePlayerName(uiRefs.networkPlayerNameInput.value) === DEFAULT_PLAYER_NAME) {
                uiRefs.networkPlayerNameInput.value = '';
            }
            uiRefs.networkPlayerNameInput.addEventListener('input', () => {
                uiRefs.networkPlayerNameInput.value = normalizePlayerName(uiRefs.networkPlayerNameInput.value);
            });
            uiRefs.networkPlayerNameInput.addEventListener('change', () => {
                uiRefs.networkPlayerNameInput.value = normalizePlayerName(uiRefs.networkPlayerNameInput.value);
            });
        }

        if (uiRefs.networkRoomInput) {
            uiRefs.networkRoomInput.addEventListener('input', () => {
                uiRefs.networkRoomInput.value = formatRoomIdInput(uiRefs.networkRoomInput.value);
            });
            uiRefs.networkRoomInput.addEventListener('change', () => {
                uiRefs.networkRoomInput.value = formatRoomIdInput(uiRefs.networkRoomInput.value);
            });
        }

        if (uiRefs.networkCreateBtn) {
            uiRefs.networkCreateBtn.addEventListener('click', async () => {
                await setMode(MODE_NETWORK, { silentLog: true });
                const serverUrl = uiRefs.networkServerInput ? uiRefs.networkServerInput.value.trim() : '';
                const playerName = resolveRequiredNetworkPlayerName();
                const deckCode = getActiveLocalDeckCode();
                if (!playerName) return;
                try {
                    if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setServerUrl === 'function') {
                        root.NetworkMatchClient.setServerUrl(serverUrl);
                    }
                    const result = await root.NetworkMatchClient.createRoom({ serverUrl, playerName, deckCode });
                    if (result && result.ok && uiRefs.networkRoomInput) {
                        uiRefs.networkRoomInput.value = result.roomId || '';
                    }
                    refreshNetworkChatVisibility();
                    renderNetworkDeckInfo();
                    refreshBoardUi();
                } catch (e) {
                    writeNetworkStatus('部屋作成に失敗しました', true);
                }
            });
        }

        if (uiRefs.networkJoinBtn) {
            uiRefs.networkJoinBtn.addEventListener('click', async () => {
                await setMode(MODE_NETWORK, { silentLog: true });
                const roomId = uiRefs.networkRoomInput ? formatRoomIdInput(uiRefs.networkRoomInput.value) : '';
                const serverUrl = uiRefs.networkServerInput ? uiRefs.networkServerInput.value.trim() : '';
                const playerName = resolveRequiredNetworkPlayerName();
                const deckCode = getActiveLocalDeckCode();
                if (!playerName) return;
                try {
                    if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setServerUrl === 'function') {
                        root.NetworkMatchClient.setServerUrl(serverUrl);
                    }
                    await root.NetworkMatchClient.joinRoom(roomId, { serverUrl, playerName, deckCode });
                    refreshNetworkChatVisibility();
                    renderNetworkDeckInfo();
                    refreshBoardUi();
                } catch (e) {
                    writeNetworkStatus('部屋参加に失敗しました', true);
                }
            });
        }

        if (uiRefs.networkLeaveBtn) {
            uiRefs.networkLeaveBtn.addEventListener('click', async () => {
                try {
                    if (root.NetworkMatchClient && typeof root.NetworkMatchClient.leaveRoom === 'function') {
                        await root.NetworkMatchClient.leaveRoom();
                    }
                } catch (e) { /* ignore */ }
                await setMode(MODE_CPU, { silentLog: true });
                renderNetworkDeckInfo(null);
                refreshBoardUi();
            });
        }

        setNetworkChatExpanded(false);
        refreshNetworkChatVisibility();
        renderNetworkDeckInfo();
    }

    function setupMatchModeControls(options) {
        const opts = options || {};
        uiRefs.modeCpuBtn = opts.modeCpuBtn || null;
        uiRefs.modeNetworkBtn = opts.modeNetworkBtn || null;
        uiRefs.controlPanel = opts.controlPanel || null;
        uiRefs.networkPanel = opts.networkPanel || null;
        uiRefs.networkAdvancedSettings = opts.networkAdvancedSettings || null;
        uiRefs.networkRoomInput = opts.networkRoomInput || null;
        uiRefs.networkServerInput = opts.networkServerInput || null;
        uiRefs.networkPlayerNameInput = opts.networkPlayerNameInput || null;
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

        if (uiRefs.modeCpuBtn) {
            uiRefs.modeCpuBtn.addEventListener('click', () => {
                setMode(MODE_CPU);
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
    }

    root.MatchMode = {
        setupMatchModeControls,
        setMode,
        getCurrentMode,
        isLocalOrNetworkMode,
        isNetworkModeActive
    };

    root.setupMatchModeControls = setupMatchModeControls;
}(typeof window !== 'undefined' ? window : globalThis));
