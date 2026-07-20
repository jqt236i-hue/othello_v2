const IdentityContract = (() => {
    try {
        return require('../../../shared/player-identity-contract');
    } catch (e) {
        return null;
    }
})();

const PlayerIdentityModule = (() => {
    try {
        return require('../../player-identity');
    } catch (e) {
        return null;
    }
})();

const PlayerProfileModule = (() => {
    try {
        return require('../../player-profile');
    } catch (e) {
        return null;
    }
})();

type RatedMatchControllerContext = {
    root: any;
    uiRefs: any;
    MODE_NETWORK: string;
    DEFAULT_PLAYER_NAME: string;
    setMode: (mode: any, options?: any) => Promise<any>;
    setNetworkOverlayVisible: (visible: any) => void;
    setLeaderboardOverlayVisible: (visible: any) => void;
    ensureLeaderboardStylesheet?: () => Promise<any>;
    openRatedLeaderboard?: () => void;
    disableAutoModeForHumanPlay: () => void;
    refreshNetworkAutoModeAccess: () => void;
    readActiveLocalDeckSelection: () => any;
    notifyInvalidCustomDeckFallback: (selection: any) => void;
    normalizePlayerName: (value: any) => string;
    getSharedPlayerName: () => string;
};

type RatedMatchController = {
    bindControls: () => void;
    setOverlayVisible: (visible: any) => void;
    isOverlayOpen: () => boolean;
    cancelQueue: (options?: any) => void;
    refreshButtonState: () => void;
    render: () => void;
};

const RATED_QUEUE_TTL_MS = 10 * 60 * 1000;
const RATED_QUEUE_POLL_INTERVAL_MS = 2000;
const RATED_MATCH_BOARD_CONFIG = {
    rows: 8,
    cols: 8,
    standard8x8: true
};

function cloneRatedBoardConfig(): { rows: number; cols: number; standard8x8: boolean } {
    return {
        rows: RATED_MATCH_BOARD_CONFIG.rows,
        cols: RATED_MATCH_BOARD_CONFIG.cols,
        standard8x8: true
    };
}

function pad2(value: number): string {
    return String(Math.max(0, Math.floor(value))).padStart(2, '0');
}

function formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${pad2(minutes)}:${pad2(seconds)}`;
}

function toFiniteInteger(value: any, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.trunc(numberValue) : fallback;
}

function resolvePlayerIdentityApi(root: any): any {
    try {
        if (root && root.PlayerIdentity) return root.PlayerIdentity;
    } catch (e) { /* ignore */ }
    return PlayerIdentityModule;
}

function readStoredIdentity(root: any): any {
    const api = resolvePlayerIdentityApi(root);
    if (!api || typeof api.getPlayerIdentity !== 'function') return null;
    try {
        return api.getPlayerIdentity();
    } catch (e) {
        return null;
    }
}

async function ensureRatedIdentity(root: any): Promise<any> {
    const api = resolvePlayerIdentityApi(root);
    if (!api) return null;
    if (typeof api.ensurePlayerIdentity === 'function') {
        return api.ensurePlayerIdentity();
    }
    if (typeof api.getPlayerIdentity === 'function') {
        return api.getPlayerIdentity();
    }
    return null;
}

function formatPlayerId(value: any): string {
    if (IdentityContract && typeof IdentityContract.formatShortPlayerId === 'function') {
        const formatted = IdentityContract.formatShortPlayerId(value);
        if (formatted) return formatted;
    }
    const raw = String(value || '').trim();
    return raw ? `#${raw.slice(-4)}` : '未確認';
}

function setButtonDisabled(button: any, disabled: boolean): void {
    if (!button) return;
    try {
        button.disabled = disabled;
    } catch (e) { /* ignore */ }
    try {
        button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    } catch (e) { /* ignore */ }
}

function resolveRatedMatchRoot(contextRoot: any, uiRefs: any): any {
    const refs = uiRefs || {};
    const candidates = [
        refs.ratedMatchOverlay,
        refs.ratedMatchOpenBtn,
        refs.ratedMatchQueueBtn,
        refs.ratedMatchQueueTimer
    ];
    for (const candidate of candidates) {
        try {
            const view = candidate && candidate.ownerDocument && candidate.ownerDocument.defaultView;
            if (view) return view;
        } catch (e) { /* ignore */ }
    }
    return contextRoot || (typeof window !== 'undefined' ? window : globalThis);
}

function resolveSelectedHandSkinId(root: any): string {
    try {
        const api = root && root.HandSkinSelectionModule;
        if (api && typeof api.readStoredHandSkinId === 'function') {
            return String(api.readStoredHandSkinId(root) || '').trim() || 'default';
        }
    } catch (e) { /* ignore */ }
    return 'default';
}

function readPublicProfile(): any {
    try {
        if (PlayerProfileModule && typeof PlayerProfileModule.readPlayerProfile === 'function') {
            return PlayerProfileModule.readPlayerProfile();
        }
    } catch (e) { /* ignore */ }
    return { avatarStoneType: 'REGEN', bio: '' };
}

function createRatedMatchController(context: RatedMatchControllerContext): RatedMatchController {
    const ctx = context || {} as RatedMatchControllerContext;
    const uiRefs = ctx.uiRefs || {};
    const root = resolveRatedMatchRoot(ctx.root, uiRefs);
    let waiting = false;
    let busy = false;
    let queuedAt = 0;
    let expiresAt = 0;
    let ticker: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let statusText = '待機していません';
    let statusKind = 'idle';
    let lastIdentity: any = null;
    let ratingText = '1500';
    let ratingSubText = '未対戦';
    let lastQueuePayload: any = null;
    let connecting = false;
    let historyOpen = false;
    let historyLoading = false;
    let historyStatusText = '戦績を読み込んでいません';
    let historyEntries: any[] = [];
    let historyFetchToken = 0;

    function getNetworkClient(): any {
        try {
            return root && root.NetworkMatchClient ? root.NetworkMatchClient : null;
        } catch (e) {
            return null;
        }
    }

    function getSelection(): any {
        if (typeof ctx.readActiveLocalDeckSelection !== 'function') {
            return { choice: null, deckCode: '', invalidCustomDeck: false };
        }
        try {
            return ctx.readActiveLocalDeckSelection() || { choice: null, deckCode: '', invalidCustomDeck: false };
        } catch (e) {
            return { choice: null, deckCode: '', invalidCustomDeck: false };
        }
    }

    function readChoiceLabel(choice: any): string {
        const candidates = [
            choice && choice.name,
            choice && choice.displayName,
            choice && choice.label,
            choice && choice.deckName,
            choice && choice.title
        ];
        for (const value of candidates) {
            const text = String(value || '').replace(/\s+/g, ' ').trim();
            if (text) return text;
        }
        return '';
    }

    function formatDeckName(): string {
        const selection = getSelection();
        const choice = selection && selection.choice ? selection.choice : null;
        if (selection && selection.invalidCustomDeck) {
            return 'デフォルトデッキ';
        }
        if (!choice) {
            return 'デフォルトデッキ';
        }
        const explicitLabel = readChoiceLabel(choice);
        if (explicitLabel) return explicitLabel;
        const size = Number.isFinite(Number(choice.deckSize)) ? Number(choice.deckSize) : 30;
        if (choice.mode === 'custom') {
            return `カスタム ${size}枚`;
        }
        return `デフォルト ${size}枚`;
    }

    function formatDeckSummary(): string {
        return `使用デッキ: ${formatDeckName()}`;
    }

    function getPlayerName(): string {
        const shared = typeof ctx.getSharedPlayerName === 'function' ? ctx.getSharedPlayerName() : '';
        const normalized = typeof ctx.normalizePlayerName === 'function'
            ? ctx.normalizePlayerName(shared)
            : String(shared || '').trim();
        return normalized || ctx.DEFAULT_PLAYER_NAME || 'ななし';
    }

    function buildQueuePayload(identity: any): any {
        const selection = getSelection();
        const choice = selection && selection.choice ? selection.choice : null;
        const deckCode = String((selection && selection.deckCode) || (choice && choice.deckCode) || '').trim();
        const playerId = identity && identity.playerId ? String(identity.playerId) : '';
        const playerToken = identity && identity.playerToken ? String(identity.playerToken) : '';
        const profile = readPublicProfile();
        return {
            playerName: getPlayerName(),
            playerId,
            playerToken,
            avatarStoneType: profile && profile.avatarStoneType ? String(profile.avatarStoneType) : 'REGEN',
            bio: profile && profile.bio ? String(profile.bio) : '',
            deckCode: choice && choice.mode === 'custom' && !selection.invalidCustomDeck ? deckCode : '',
            selectedHandSkinId: resolveSelectedHandSkinId(root),
            roomBoardConfig: cloneRatedBoardConfig(),
            networkAutoEnabled: false
        };
    }

    function buildQueueSnapshot(status: string, extra?: any): any {
        const payload = lastQueuePayload || {};
        return Object.assign({
            version: 1,
            status,
            queueType: 'rated',
            queuedAt,
            expiresAt,
            remainingMs: getRemainingMs(),
            playerName: payload.playerName || getPlayerName(),
            playerId: payload.playerId || '',
            boardConfig: cloneRatedBoardConfig(),
            constraints: {
                deckCarryAllowed: true,
                autoPlayAllowed: false,
                fixedBoard: cloneRatedBoardConfig()
            },
            deck: {
                mode: payload.deckCode ? 'custom' : 'default',
                deckCode: payload.deckCode || '',
                deckSize: 30
            }
        }, extra || {});
    }

    function writeRootState(snapshot: any): void {
        try {
            root.__RATED_MATCH_CONSTRAINTS = {
                deckCarryAllowed: true,
                autoPlayAllowed: false,
                boardConfig: cloneRatedBoardConfig()
            };
            root.__RATED_MATCH_QUEUE = snapshot;
        } catch (e) { /* ignore */ }
    }

    function clearTicker(): void {
        if (!ticker) return;
        clearInterval(ticker);
        ticker = null;
    }

    function clearPollTimer(): void {
        if (!pollTimer) return;
        clearTimeout(pollTimer);
        pollTimer = null;
    }

    function startTicker(): void {
        clearTicker();
        ticker = setInterval(() => {
            tick();
        }, 1000);
    }

    function getRemainingMs(): number {
        if (!waiting || !expiresAt) return 0;
        return Math.max(0, expiresAt - Date.now());
    }

    function setStatus(text: string, kind: string): void {
        statusText = text;
        statusKind = kind;
        render();
    }

    function isOverlayOpen(): boolean {
        return !!(uiRefs.ratedMatchOverlay && uiRefs.ratedMatchOverlay.classList.contains('is-open'));
    }

    function refreshButtonState(): void {
        const open = isOverlayOpen();
        if (!uiRefs.ratedMatchOpenBtn) return;
        uiRefs.ratedMatchOpenBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        uiRefs.ratedMatchOpenBtn.classList.toggle('is-active', open || waiting || connecting);
        uiRefs.ratedMatchOpenBtn.classList.toggle('is-queue-waiting', waiting);
    }

    function renderQueueTimer(remainingMs: number): void {
        const timer = uiRefs.ratedMatchQueueTimer;
        if (!timer) return;
        const visible = waiting && remainingMs > 0;
        timer.hidden = !visible;
        timer.setAttribute('aria-hidden', visible ? 'false' : 'true');
        timer.textContent = visible ? `RATE ${formatRemaining(remainingMs)}` : '';
        timer.classList.toggle('is-waiting', visible);
    }

    function normalizeHistoryResult(value: any): string {
        if (value === 'WIN' || value === '勝利') return 'WIN';
        if (value === 'LOSS' || value === '敗北') return 'LOSS';
        if (value === 'DRAW' || value === '引き分け') return 'DRAW';
        return 'DRAW';
    }

    function getHistoryResultLabel(entry: any): string {
        const result = normalizeHistoryResult(entry && entry.result);
        if (result === 'WIN') return '勝利';
        if (result === 'LOSS') return '敗北';
        return '引き分け';
    }

    function getHistoryResultClass(entry: any): string {
        const result = normalizeHistoryResult(entry && entry.result);
        if (result === 'WIN') return 'is-win';
        if (result === 'LOSS') return 'is-loss';
        return 'is-draw';
    }

    function formatSignedDelta(value: any): string {
        const delta = Number(value);
        if (!Number.isFinite(delta) || Math.round(delta) === 0) return '±0';
        const rounded = Math.round(delta);
        return rounded > 0 ? `+${rounded}` : String(rounded);
    }

    function formatHistoryRatingRange(entry: any): string {
        const before = Number(entry && (entry.displayBeforeRating ?? entry.beforeDisplayRating ?? entry.beforeRating));
        const after = Number(entry && (entry.displayAfterRating ?? entry.afterDisplayRating ?? entry.afterRating));
        const beforeText = Number.isFinite(before) ? String(Math.round(before)) : '--';
        const afterText = Number.isFinite(after) ? String(Math.round(after)) : '--';
        return `${beforeText} → ${afterText}`;
    }

    function renderHistory(): void {
        const historyPageRoot = uiRefs.ratedMatchHistoryPanel && uiRefs.ratedMatchHistoryPanel.ownerDocument
            ? uiRefs.ratedMatchHistoryPanel.ownerDocument.getElementById('ratedMatchPanel')
            : null;
        if (historyPageRoot && historyPageRoot.classList) {
            historyPageRoot.classList.toggle('is-history-page', historyOpen);
        }
        if (uiRefs.ratedMatchHistoryPanel) {
            uiRefs.ratedMatchHistoryPanel.hidden = !historyOpen;
            uiRefs.ratedMatchHistoryPanel.setAttribute('aria-hidden', historyOpen ? 'false' : 'true');
        }
        if (uiRefs.ratedMatchHistoryBtn) {
            uiRefs.ratedMatchHistoryBtn.textContent = historyLoading ? '読み込み中...' : '直近10戦';
            uiRefs.ratedMatchHistoryBtn.setAttribute('aria-expanded', historyOpen ? 'true' : 'false');
            setButtonDisabled(uiRefs.ratedMatchHistoryBtn, historyLoading);
        }
        if (uiRefs.ratedMatchCloseBtn) {
            uiRefs.ratedMatchCloseBtn.setAttribute('aria-label', historyOpen ? 'レート戦へ戻る' : 'レート戦を閉じる');
        }
        if (uiRefs.ratedMatchHistoryStatus) {
            uiRefs.ratedMatchHistoryStatus.textContent = historyStatusText;
        }
        const list = uiRefs.ratedMatchHistoryList;
        if (!list) return;
        list.textContent = '';
        if (!historyOpen) return;
        if (historyLoading) {
            const loading = list.ownerDocument.createElement('div');
            loading.className = 'rated-match-history-row is-draw';
            loading.textContent = '読み込み中...';
            list.appendChild(loading);
            return;
        }
        if (!historyEntries.length) {
            const empty = list.ownerDocument.createElement('div');
            empty.className = 'rated-match-history-row is-draw';
            empty.textContent = 'まだレート戦の履歴がありません';
            list.appendChild(empty);
            return;
        }
        historyEntries.forEach((entry) => {
            const delta = Number(entry && (entry.displayDelta ?? entry.delta ?? entry.pointsDelta));
            const row = list.ownerDocument.createElement('div');
            row.className = `rated-match-history-row ${getHistoryResultClass(entry)}`;

            const result = list.ownerDocument.createElement('span');
            result.className = 'rated-match-history-result';
            result.textContent = getHistoryResultLabel(entry);

            const rating = list.ownerDocument.createElement('span');
            rating.className = 'rated-match-history-rating';
            rating.textContent = formatHistoryRatingRange(entry);

            const deltaEl = list.ownerDocument.createElement('span');
            deltaEl.className = `rated-match-history-delta ${Number(delta) > 0 ? 'is-positive' : Number(delta) < 0 ? 'is-negative' : 'is-zero'}`;
            deltaEl.textContent = formatSignedDelta(delta);

            row.appendChild(result);
            row.appendChild(rating);
            row.appendChild(deltaEl);
            list.appendChild(row);
        });
    }

    function render(): void {
        const identity = lastIdentity || readStoredIdentity(root);
        if (identity && identity.playerId) {
            lastIdentity = identity;
        }

        if (uiRefs.ratedMatchIdentityText) {
            uiRefs.ratedMatchIdentityText.textContent = formatPlayerId(identity && identity.playerId);
        }
        if (uiRefs.ratedMatchRatingText) {
            uiRefs.ratedMatchRatingText.textContent = ratingSubText ? `${ratingText} / ${ratingSubText}` : ratingText;
        }
        if (uiRefs.ratedMatchDeckSummary) {
            uiRefs.ratedMatchDeckSummary.textContent = formatDeckSummary();
        }
        if (uiRefs.ratedMatchDeckNameText) {
            uiRefs.ratedMatchDeckNameText.textContent = formatDeckName();
        }

        const remainingMs = getRemainingMs();
        const effectiveStatusText = waiting
            ? `キュー待機中 残り ${formatRemaining(remainingMs)}`
            : statusText;
        const effectiveKind = waiting ? 'waiting' : statusKind;

        if (uiRefs.ratedMatchStatus) {
            uiRefs.ratedMatchStatus.textContent = effectiveStatusText;
            uiRefs.ratedMatchStatus.classList.toggle('is-waiting', effectiveKind === 'waiting');
            uiRefs.ratedMatchStatus.classList.toggle('is-error', effectiveKind === 'error');
        }
        renderQueueTimer(remainingMs);
        if (uiRefs.ratedMatchQueueBtn) {
            uiRefs.ratedMatchQueueBtn.textContent = busy ? '確認中...' : (waiting ? '待機中' : 'キューに入る');
            setButtonDisabled(uiRefs.ratedMatchQueueBtn, busy || waiting || connecting);
        }
        if (uiRefs.ratedMatchCancelBtn) {
            setButtonDisabled(uiRefs.ratedMatchCancelBtn, !waiting || busy || connecting);
        }
        renderHistory();
        refreshButtonState();
    }

    async function refreshMyRating(identityValue?: any): Promise<void> {
        const identity = identityValue || lastIdentity || readStoredIdentity(root);
        const playerId = identity && identity.playerId ? String(identity.playerId) : '';
        const client = getNetworkClient();
        if (!playerId || !client || typeof client.getMyRating !== 'function') {
            ratingText = '1500';
            ratingSubText = '未対戦';
            render();
            return;
        }
        try {
            const response = await client.getMyRating(playerId);
            const displayRating = Number(response && response.displayRating);
            const ratedGames = Number(response && response.rating && response.rating.ratedGames);
            ratingText = Number.isFinite(displayRating) ? String(Math.round(displayRating)) : '1500';
            ratingSubText = Number.isFinite(ratedGames) && ratedGames > 0 ? `${Math.trunc(ratedGames)}戦` : '未対戦';
        } catch (e) {
            ratingText = '1500';
            ratingSubText = '未対戦';
        }
        render();
    }

    async function refreshRatingHistory(): Promise<void> {
        const token = ++historyFetchToken;
        historyLoading = true;
        historyStatusText = '戦績を取得中...';
        render();
        try {
            const identity = lastIdentity || await ensureRatedIdentity(root);
            if (identity && identity.playerId) {
                lastIdentity = identity;
            }
            const playerId = identity && identity.playerId ? String(identity.playerId) : '';
            const client = getNetworkClient();
            if (!playerId) {
                historyEntries = [];
                historyStatusText = 'プレイヤーIDを確認できませんでした';
                return;
            }
            if (!client || typeof client.getMyRatingHistory !== 'function') {
                historyEntries = [];
                historyStatusText = '戦績機能を利用できません';
                return;
            }
            const response = await client.getMyRatingHistory(playerId, 10);
            if (token !== historyFetchToken) return;
            if (!response || response.ok !== true) {
                historyEntries = [];
                historyStatusText = '戦績の取得に失敗しました';
                return;
            }
            historyEntries = Array.isArray(response.entries) ? response.entries.slice(0, 10) : [];
            historyStatusText = historyEntries.length ? `${historyEntries.length}戦を表示中` : 'レート戦の履歴はまだありません';
        } catch (e) {
            if (token !== historyFetchToken) return;
            historyEntries = [];
            historyStatusText = '戦績の取得に失敗しました';
        } finally {
            if (token === historyFetchToken) {
                historyLoading = false;
                render();
            }
        }
    }

    function closeHistoryPage(): void {
        if (!historyOpen) return;
        historyOpen = false;
        historyStatusText = historyEntries.length ? `${historyEntries.length}戦を表示中` : '戦績を読み込んでいません';
        render();
    }

    function toggleHistoryPanel(): void {
        if (historyLoading) return;
        historyOpen = true;
        render();
        void refreshRatingHistory();
    }

    function openRatedLeaderboardFromModal(): void {
        setOverlayVisible(false);
        try {
            root.__returnToRatedMatchAfterLeaderboard = true;
        } catch (e) { /* ignore transient return marker failure */ }
        if (typeof ctx.openRatedLeaderboard === 'function') {
            ctx.openRatedLeaderboard();
            return;
        }
        try { ctx.setLeaderboardOverlayVisible(true); } catch (e) { /* ignore */ }
    }

    function openDeckBuilderFromModal(): void {
        setOverlayVisible(false);
        try {
            root.__returnToRatedMatchAfterDeckBuilder = true;
        } catch (e) { /* ignore transient return marker failure */ }
        const deckBuilderOpenBtn = uiRefs.deckBuilderOpenBtn;
        if (deckBuilderOpenBtn && typeof deckBuilderOpenBtn.click === 'function') {
            try {
                deckBuilderOpenBtn.click();
                return;
            } catch (e) { /* fall through to controller fallback */ }
        }
        try {
            const controller = root && root.DeckBuilderController;
            if (controller && typeof controller.open === 'function') {
                controller.open();
            }
        } catch (e) { /* ignore missing deck builder controller */ }
    }

    function applyServerWaitingState(response: any): void {
        const nowMs = Date.now();
        queuedAt = toFiniteInteger(response && response.queuedAt, nowMs);
        expiresAt = toFiniteInteger(response && response.expiresAt, queuedAt + RATED_QUEUE_TTL_MS);
        waiting = true;
        startTicker();
        writeRootState(buildQueueSnapshot('waiting'));
        setStatus(`キュー待機中 残り ${formatRemaining(getRemainingMs())}`, 'waiting');
    }

    async function connectMatchedRoom(response: any): Promise<void> {
        const match = response && response.match && typeof response.match === 'object' ? response.match : null;
        const payload = match && match.payload && typeof match.payload === 'object' ? match.payload : null;
        const client = getNetworkClient();
        if (!payload || !client || typeof client.adoptMatchedRoom !== 'function') {
            waiting = false;
            connecting = false;
            clearTicker();
            clearPollTimer();
            writeRootState(buildQueueSnapshot('idle', { reason: 'match_payload_invalid' }));
            setStatus('マッチ成立情報を読み込めませんでした', 'error');
            return;
        }

        waiting = false;
        connecting = true;
        clearTicker();
        clearPollTimer();
        render();
        writeRootState(buildQueueSnapshot('matched', {
            roomId: match.roomId || payload.roomId || '',
            seatKey: match.seatKey || payload.seatKey || ''
        }));

        try {
            await ctx.setMode(ctx.MODE_NETWORK, { silentLog: true, suppressStatus: true });
            try { ctx.disableAutoModeForHumanPlay(); } catch (e) { /* ignore */ }
            try { ctx.refreshNetworkAutoModeAccess(); } catch (e) { /* ignore */ }
            const adopted = await client.adoptMatchedRoom(payload, { source: 'rated_queue' });
            if (!adopted || adopted.ok !== true) {
                throw new Error((adopted && adopted.reason) || 'ADOPT_MATCH_FAILED');
            }
            setOverlayVisible(false);
            statusText = 'マッチ成立';
            statusKind = 'idle';
        } catch (e) {
            writeRootState(buildQueueSnapshot('idle', { reason: 'adopt_failed' }));
            setStatus('マッチ接続に失敗しました', 'error');
        } finally {
            connecting = false;
            render();
        }
    }

    function schedulePoll(): void {
        clearPollTimer();
        if (!waiting || !lastQueuePayload) return;
        pollTimer = setTimeout(() => {
            void pollQueue();
        }, RATED_QUEUE_POLL_INTERVAL_MS);
    }

    async function pollQueue(): Promise<void> {
        if (!waiting || busy || !lastQueuePayload) return;
        const client = getNetworkClient();
        if (!client || typeof client.pollRatedQueue !== 'function') {
            schedulePoll();
            return;
        }
        try {
            const response = await client.pollRatedQueue({
                playerId: lastQueuePayload.playerId,
                playerToken: lastQueuePayload.playerToken
            });
            if (response && response.status === 'matched') {
                await connectMatchedRoom(response);
                return;
            }
            if (response && response.status === 'expired') {
                expireLocalQueue('timeout');
                return;
            }
            if (response && response.status === 'waiting') {
                applyServerWaitingState(response);
            }
        } catch (e) {
            // Keep the local countdown visible; the next poll can recover.
        }
        schedulePoll();
    }

    function expireLocalQueue(reason: string): void {
        const payload = lastQueuePayload;
        waiting = false;
        busy = false;
        queuedAt = 0;
        expiresAt = 0;
        clearTicker();
        clearPollTimer();
        writeRootState(buildQueueSnapshot('idle', { reason }));
        setStatus(reason === 'timeout' ? '10分経過で待機を解除しました' : '待機を解除しました', 'idle');
        if (payload) {
            const client = getNetworkClient();
            if (client && typeof client.cancelRatedQueue === 'function') {
                void client.cancelRatedQueue({
                    playerId: payload.playerId,
                    playerToken: payload.playerToken,
                    reason
                }).catch(() => undefined);
            }
        }
        render();
    }

    function tick(): void {
        if (waiting && getRemainingMs() <= 0) {
            expireLocalQueue('timeout');
            return;
        }
        if (waiting) {
            writeRootState(buildQueueSnapshot('waiting'));
        }
        render();
    }

    async function enterQueue(): Promise<void> {
        if (waiting || busy || connecting) return;
        const client = getNetworkClient();
        if (!client || typeof client.enterRatedQueue !== 'function') {
            setStatus('レート戦サーバーに接続できません', 'error');
            return;
        }
        busy = true;
        setStatus('プレイヤーID確認中...', 'busy');
        try {
            const identity = await ensureRatedIdentity(root);
            if (!identity || !identity.playerId || !identity.playerToken) {
                setStatus('プレイヤーIDを確認できませんでした', 'error');
                return;
            }
            lastIdentity = identity;
            void refreshMyRating(identity);
            const selection = getSelection();
            if (selection && selection.invalidCustomDeck && typeof ctx.notifyInvalidCustomDeckFallback === 'function') {
                ctx.notifyInvalidCustomDeckFallback(selection);
            }
            lastQueuePayload = buildQueuePayload(identity);
            const response = await client.enterRatedQueue(lastQueuePayload);
            if (!response || response.ok !== true) {
                setStatus('キュー待機に失敗しました', 'error');
                return;
            }
            if (response.status === 'matched') {
                await connectMatchedRoom(response);
                return;
            }
            if (response.status !== 'waiting') {
                setStatus('キュー待機に失敗しました', 'error');
                return;
            }
            applyServerWaitingState(response);
            schedulePoll();
        } catch (e) {
            waiting = false;
            queuedAt = 0;
            expiresAt = 0;
            clearTicker();
            clearPollTimer();
            setStatus('キュー待機に失敗しました', 'error');
        } finally {
            busy = false;
            render();
        }
    }

    function cancelQueue(options?: any): void {
        const opts = options || {};
        if (!waiting && opts.reason !== 'timeout') {
            render();
            return;
        }
        expireLocalQueue(opts.reason || 'cancelled');
        if (opts.closeOverlay === true) {
            setOverlayVisible(false);
        }
    }

    function setOverlayVisible(visible: any): void {
        if (!uiRefs.ratedMatchOverlay) return;
        const open = visible === true;
        if (open) {
            try { void ctx.ensureLeaderboardStylesheet?.(); } catch (e) { /* fallback styling must not block the panel */ }
            try { ctx.setNetworkOverlayVisible(false); } catch (e) { /* ignore */ }
            try { ctx.setLeaderboardOverlayVisible(false); } catch (e) { /* ignore */ }
        } else {
            historyOpen = false;
            historyStatusText = historyEntries.length ? `${historyEntries.length}戦を表示中` : '戦績を読み込んでいません';
        }
        uiRefs.ratedMatchOverlay.classList.toggle('is-open', open);
        uiRefs.ratedMatchOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
        refreshButtonState();
        render();
        if (open) {
            void refreshMyRating();
        }
        if (open && uiRefs.ratedMatchQueueBtn && typeof uiRefs.ratedMatchQueueBtn.focus === 'function') {
            try {
                uiRefs.ratedMatchQueueBtn.focus({ preventScroll: true });
            } catch (e) {
                try { uiRefs.ratedMatchQueueBtn.focus(); } catch (_e) { /* ignore */ }
            }
        }
    }

    function bindControls(): void {
        if (uiRefs.ratedMatchOpenBtn && uiRefs.ratedMatchOpenBtn.dataset.ratedMatchBound !== '1') {
            uiRefs.ratedMatchOpenBtn.addEventListener('click', () => {
                setOverlayVisible(!isOverlayOpen());
            });
            uiRefs.ratedMatchOpenBtn.dataset.ratedMatchBound = '1';
        }
        if (uiRefs.ratedMatchCloseBtn && uiRefs.ratedMatchCloseBtn.dataset.ratedMatchBound !== '1') {
            uiRefs.ratedMatchCloseBtn.addEventListener('click', () => {
                if (historyOpen) {
                    closeHistoryPage();
                    return;
                }
                setOverlayVisible(false);
            });
            uiRefs.ratedMatchCloseBtn.dataset.ratedMatchBound = '1';
        }
        if (uiRefs.ratedMatchQueueBtn && uiRefs.ratedMatchQueueBtn.dataset.ratedMatchBound !== '1') {
            uiRefs.ratedMatchQueueBtn.addEventListener('click', () => {
                void enterQueue();
            });
            uiRefs.ratedMatchQueueBtn.dataset.ratedMatchBound = '1';
        }
        if (uiRefs.ratedMatchCancelBtn && uiRefs.ratedMatchCancelBtn.dataset.ratedMatchBound !== '1') {
            uiRefs.ratedMatchCancelBtn.addEventListener('click', () => cancelQueue());
            uiRefs.ratedMatchCancelBtn.dataset.ratedMatchBound = '1';
        }
        if (uiRefs.ratedMatchLeaderboardBtn && uiRefs.ratedMatchLeaderboardBtn.dataset.ratedMatchBound !== '1') {
            uiRefs.ratedMatchLeaderboardBtn.addEventListener('click', () => openRatedLeaderboardFromModal());
            uiRefs.ratedMatchLeaderboardBtn.dataset.ratedMatchBound = '1';
        }
        if (uiRefs.ratedMatchHistoryBtn && uiRefs.ratedMatchHistoryBtn.dataset.ratedMatchBound !== '1') {
            uiRefs.ratedMatchHistoryBtn.addEventListener('click', () => toggleHistoryPanel());
            uiRefs.ratedMatchHistoryBtn.dataset.ratedMatchBound = '1';
        }
        if (uiRefs.ratedMatchDeckOpenBtn && uiRefs.ratedMatchDeckOpenBtn.dataset.ratedMatchBound !== '1') {
            uiRefs.ratedMatchDeckOpenBtn.addEventListener('click', () => openDeckBuilderFromModal());
            uiRefs.ratedMatchDeckOpenBtn.dataset.ratedMatchBound = '1';
        }
        if (uiRefs.ratedMatchOverlay && uiRefs.ratedMatchOverlay.dataset.ratedMatchBound !== '1') {
            uiRefs.ratedMatchOverlay.addEventListener('click', (event: any) => {
                if (event && event.target === uiRefs.ratedMatchOverlay) {
                    if (historyOpen) {
                        closeHistoryPage();
                        return;
                    }
                    setOverlayVisible(false);
                }
            });
            uiRefs.ratedMatchOverlay.dataset.ratedMatchBound = '1';
        }
        if (root && typeof root.addEventListener === 'function' && !root.__ratedMatchEscapeBound) {
            root.addEventListener('keydown', (event: any) => {
                if (!event || event.key !== 'Escape' || !isOverlayOpen()) return;
                if (historyOpen) {
                    closeHistoryPage();
                    return;
                }
                setOverlayVisible(false);
            });
            root.__ratedMatchEscapeBound = true;
        }
        try {
            root.__RatedMatchControllerTest = Object.assign({}, root.__RatedMatchControllerTest || {}, { tick });
        } catch (e) { /* ignore */ }
        writeRootState(buildQueueSnapshot('idle'));
        render();
    }

    return {
        bindControls,
        setOverlayVisible,
        isOverlayOpen,
        cancelQueue,
        refreshButtonState,
        render
    };
}

export = {
    createRatedMatchController
};
