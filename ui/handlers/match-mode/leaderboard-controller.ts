const LeaderboardStylesModule = (() => {
    try {
        return require('./leaderboard-styles');
    } catch (e: any) {
        return null;
    }
})();
const PlayerIdentityContract = (() => {
    try {
        return require('../../../shared/player-identity-contract');
    } catch (e: any) {
        return null;
    }
})();
const PlayerProfileAvatarOptions = (() => {
    try {
        return require('../../player-profile-avatar-options');
    } catch (e: any) {
        return null;
    }
})();

function resolveLazyRuntimeGroupLoader(root: any): any {
    try {
        if (root && typeof root.loadLazyRuntimeGroup === 'function') {
            return root.loadLazyRuntimeGroup.bind(root);
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).loadLazyRuntimeGroup === 'function') {
            return (globalThis as any).loadLazyRuntimeGroup;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (
            typeof globalThis !== 'undefined' &&
            (globalThis as any).LazyRuntimeLoaderModule &&
            typeof (globalThis as any).LazyRuntimeLoaderModule.loadLazyRuntimeGroup === 'function'
        ) {
            return (globalThis as any).LazyRuntimeLoaderModule.loadLazyRuntimeGroup;
        }
    } catch (e: any) { /* ignore */ }
    try {
        const moduleRef = require('../../bootstrap/lazy-runtime-loader');
        if (moduleRef && typeof moduleRef.loadLazyRuntimeGroup === 'function') {
            return moduleRef.loadLazyRuntimeGroup;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function resolveLeaderboardClient(root: any, allowRequire = true): any {
    try {
        if (root && root.LeaderboardClient) return root.LeaderboardClient;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).LeaderboardClient) {
            return (globalThis as any).LeaderboardClient;
        }
    } catch (e: any) { /* ignore */ }
    if (allowRequire !== true) return null;
    try {
        const moduleRef = require('../../leaderboard-client');
        if (moduleRef) {
            try {
                if (root && !root.LeaderboardClient) root.LeaderboardClient = moduleRef;
            } catch (e: any) { /* ignore */ }
            return moduleRef;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function createLeaderboardController(context: any) {
    const {
        root,
        uiRefs,
        PLAYER_NAME_MAX,
        DEFAULT_PLAYER_NAME,
        normalizePlayerName,
        getSharedPlayerName,
        setNetworkOverlayVisible,
        isNetworkOverlayOpen
} = context;

    const SHARED_LEADERBOARD_PANEL_LIMIT = 100;
    const LEADERBOARD_PODIUM_ENTRY_COUNT = 3;
    const LEADERBOARD_FILTER_ALL = 'all';
    const LEADERBOARD_FILTER_NETWORK = 'network';
    const LEADERBOARD_FILTER_CPU = 'cpu';
    const LEADERBOARD_CATEGORY_SCORE = 'score';
    const LEADERBOARD_CATEGORY_TIME_ATTACK = 'timeAttack';
    const LEADERBOARD_CATEGORY_TIME_DEFENSE = 'timeDefense';
    const LEADERBOARD_CATEGORY_SHORTEST_TURNS = 'shortestTurns';
    const LEADERBOARD_ERA_CURRENT = 'current';
    const LEADERBOARD_ERA_HISTORY = 'history';
    const LEADERBOARD_ERA_LEGACY = 'legacy';
    const LEADERBOARD_CPU_LEVEL_NAMES = [
        '',
        '盤喰いの小鬼',
        '反転の影',
        '布石を紡ぐ者',
        '盤面支配者',
        '終局を告げる者',
        '盤理の観測者',
        '盤界の執行者',
        '理論の化身',
        '終焉の冥灰',
        '観測ダークドラゴン',
        '執行エグゼキューションカオスドラゴン',
        '理論カオスロジカルエンペラービースト',
        '真理カオスロジカルエンペラービースト'
    ];

    let leaderboardRefreshToken = 0;
    let leaderboardEntriesCache: any[] = [];
    let leaderboardUpdatedAt = 0;
    let leaderboardActiveFilter = LEADERBOARD_FILTER_ALL;
    let leaderboardActiveCategory = LEADERBOARD_CATEGORY_SCORE;
    let leaderboardActiveEra = LEADERBOARD_ERA_HISTORY;
    let leaderboardCpuLevelFilter: number | null = null;
    let leaderboardCpuLevelMenuOpen = false;
    let leaderboardModeMenuOpen = false;
    let leaderboardDetailsOpen = false;
    let leaderboardProfilePopupOpen = false;
    let leaderboardClientLoad: Promise<any> | null = null;

    function ensureLeaderboardClient(): Promise<any> {
        const existing = resolveLeaderboardClient(root, false);
        if (existing && typeof existing.fetchLeaderboard === 'function') return Promise.resolve(existing);
        if (!leaderboardClientLoad) {
            const loadLazyRuntimeGroup = resolveLazyRuntimeGroupLoader(root);
            if (typeof loadLazyRuntimeGroup !== 'function') return Promise.resolve(null);
            leaderboardClientLoad = Promise.resolve(loadLazyRuntimeGroup('leaderboard')).then(() => {
                const client = resolveLeaderboardClient(root, true);
                return client && typeof client.fetchLeaderboard === 'function' ? client : null;
            }).finally(() => {
                if (!resolveLeaderboardClient(root, true)) leaderboardClientLoad = null;
            });
        }
        return leaderboardClientLoad;
    }

    function getLeaderboardClient(): any {
        const client = resolveLeaderboardClient(root, false);
        return client && typeof client.fetchLeaderboard === 'function' ? client : null;
    }

    function collectDuplicateLeaderboardNames(entries: any) {
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

    function writeLeaderboardStatus(text: any, isError: any) {
        const el = uiRefs.leaderboardStatus;
        if (el) {
            el.textContent = String(text || '');
            el.style.color = isError ? '#ffb4b4' : '#d8f3dc';
        }
    }

    function isLeaderboardOverlayOpen() {
        return !!(uiRefs.leaderboardOverlay && uiRefs.leaderboardOverlay.classList.contains('is-open'));
    }

    function setLeaderboardOverlayVisible(visible: any) {
        if (!uiRefs.leaderboardOverlay) return;
        const open = !!visible;
        if (open) ensureLeaderboardStylesheet();
        uiRefs.leaderboardOverlay.classList.toggle('is-open', open);
        uiRefs.leaderboardOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');

        if (uiRefs.leaderboardOpenBtn) {
            uiRefs.leaderboardOpenBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        if (!open) closeLeaderboardProfilePopup();

        if (open && uiRefs.leaderboardNameInput && typeof uiRefs.leaderboardNameInput.focus === 'function') {
            try {
                uiRefs.leaderboardNameInput.focus({ preventScroll: true });
            } catch (e) {
                try { uiRefs.leaderboardNameInput.focus(); } catch (_e) { /* ignore */ }
            }
        }
    }

    function formatLeaderboardTime(epochMs: any) {
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

    function ensureLeaderboardStylesheet() {
        if (LeaderboardStylesModule && typeof LeaderboardStylesModule.ensureLeaderboardStylesheet === 'function') {
            LeaderboardStylesModule.ensureLeaderboardStylesheet(typeof document !== 'undefined' ? document : null);
        }
    }

    function normalizeLeaderboardFilter(value: any) {
        if (value === LEADERBOARD_FILTER_NETWORK) return LEADERBOARD_FILTER_NETWORK;
        if (value === LEADERBOARD_FILTER_CPU) return LEADERBOARD_FILTER_CPU;
        return LEADERBOARD_FILTER_ALL;
    }

    function normalizeLeaderboardCategory(value: any) {
        if (value === LEADERBOARD_CATEGORY_TIME_ATTACK) return LEADERBOARD_CATEGORY_TIME_ATTACK;
        if (value === LEADERBOARD_CATEGORY_TIME_DEFENSE) return LEADERBOARD_CATEGORY_TIME_DEFENSE;
        if (value === LEADERBOARD_CATEGORY_SHORTEST_TURNS) return LEADERBOARD_CATEGORY_SHORTEST_TURNS;
        return LEADERBOARD_CATEGORY_SCORE;
    }

    function normalizeLeaderboardEra(value: any) {
        if (value === LEADERBOARD_ERA_LEGACY) return LEADERBOARD_ERA_LEGACY;
        if (value === LEADERBOARD_ERA_HISTORY) return LEADERBOARD_ERA_HISTORY;
        return LEADERBOARD_ERA_CURRENT;
    }

    function isLegacyLeaderboardActive(): boolean {
        return leaderboardActiveEra === LEADERBOARD_ERA_LEGACY;
    }

    function isHistoricalLeaderboardActive(): boolean {
        return leaderboardActiveEra === LEADERBOARD_ERA_HISTORY;
    }

    function getLeaderboardModeLabel(filter: any): string {
        const normalized = normalizeLeaderboardFilter(filter);
        if (normalized === LEADERBOARD_FILTER_NETWORK) return '対人';
        if (normalized === LEADERBOARD_FILTER_ALL) return '総合';
        return 'CPU';
    }

    function getLeaderboardModeButtonLabel(): string {
        if (isHistoricalLeaderboardActive()) return 'MODE・通算';
        return isLegacyLeaderboardActive() ? 'MODE・旧' : 'MODE';
    }

    function normalizeLeaderboardCpuLevel(value: any): number | null {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        if (!Number.isFinite(Number(value))) return null;
        return Math.max(1, Math.min(13, Math.trunc(Number(value))));
    }

    function getLeaderboardCpuLevelLabel(level: any): string {
        const normalized = normalizeLeaderboardCpuLevel(level);
        if (normalized === null) return '全Lv';
        const name = LEADERBOARD_CPU_LEVEL_NAMES[normalized] || '';
        return name ? `Lv${normalized}: ${name}` : `Lv${normalized}`;
    }

    function getActiveLeaderboardEntries() {
        return Array.isArray(leaderboardEntriesCache) ? leaderboardEntriesCache.slice() : [];
    }

    function isTimeAttackLeaderboardActive(): boolean {
        return leaderboardActiveCategory === LEADERBOARD_CATEGORY_TIME_ATTACK;
    }

    function isTimeDefenseLeaderboardActive(): boolean {
        return leaderboardActiveCategory === LEADERBOARD_CATEGORY_TIME_DEFENSE;
    }

    function isShortestTurnsLeaderboardActive(): boolean {
        return leaderboardActiveCategory === LEADERBOARD_CATEGORY_SHORTEST_TURNS;
    }

    function isTurnCountLeaderboardActive(): boolean {
        return isTimeDefenseLeaderboardActive() || isShortestTurnsLeaderboardActive();
    }

    function formatLeaderboardDuration(ms: any): string {
        const totalMs = Number(ms);
        if (!Number.isFinite(totalMs) || totalMs <= 0) return '--';
        const centiseconds = Math.floor((Math.trunc(totalMs) % 1000) / 10);
        const totalSeconds = Math.floor(Math.trunc(totalMs) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    }

    function getLeaderboardEntryValueText(entry: any): string {
        if (isTimeAttackLeaderboardActive() || (entry && entry.category === LEADERBOARD_CATEGORY_TIME_ATTACK)) {
            return formatLeaderboardDuration(entry && entry.bestTimeMs);
        }
        if (
            isTurnCountLeaderboardActive()
            || (entry && (entry.category === LEADERBOARD_CATEGORY_TIME_DEFENSE || entry.category === LEADERBOARD_CATEGORY_SHORTEST_TURNS))
        ) {
            const turns = Number(entry && entry.turnCount);
            return Number.isFinite(turns) && turns > 0 ? `${Math.trunc(turns)}手` : '--';
        }
        return `${entry && entry.bestScore ? entry.bestScore : 0}`;
    }

    function getLeaderboardValueHeaderLabel(): string {
        if (isTimeAttackLeaderboardActive()) return 'タイム';
        if (isTurnCountLeaderboardActive()) return '手数';
        return 'スコア';
    }

    function getLeaderboardSummaryBestLabel(): string {
        if (isTimeAttackLeaderboardActive()) return 'あなたの最速記録';
        if (isTimeDefenseLeaderboardActive()) return 'あなたの最長記録';
        if (isShortestTurnsLeaderboardActive()) return 'あなたの最短記録';
        return 'あなたの最高記録';
    }

    function createLeaderboardModeLabel(entry: any) {
        const cpuSuffix = Number.isFinite(Number(entry && entry.cpuLevel)) ? ` Lv${entry.cpuLevel}` : '';
        const modeLabel = entry && entry.mode === 'network' ? '対人' : `CPU${cpuSuffix}`;
        if (!isHistoricalLeaderboardActive()) return modeLabel;
        if (entry && entry.recordSource === 'legacy') return `${modeLabel}・旧記録`;
        if (entry && entry.recordSource === 'verified') return `${modeLabel}・検証済み`;
        return modeLabel;
    }

    function createLeaderboardModeChip(entry: any) {
        const chip = document.createElement('span');
        chip.className = 'leaderboard-mode-chip';
        chip.dataset.mode = entry && entry.mode === 'network' ? 'network' : 'cpu';
        chip.textContent = createLeaderboardModeLabel(entry);
        return chip;
    }

    function ensureLeaderboardScaffold() {
        if (!uiRefs.leaderboardPanel) return null;

        const header = uiRefs.leaderboardPanel.querySelector('#leaderboardModalHeader');
        const title = header ? header.querySelector('.leaderboard-title') : null;
        if (title && !title.classList.contains('is-reference-title')) {
            title.classList.add('is-reference-title');
            title.textContent = '';

            const titleMain = document.createElement('span');
            titleMain.className = 'leaderboard-title-main';
            titleMain.textContent = 'ランキング';

            const titleSub = document.createElement('span');
            titleSub.className = 'leaderboard-title-sub';
            titleSub.textContent = 'Card Reversi';

            title.appendChild(titleMain);
            title.appendChild(titleSub);
        }

        const body = uiRefs.leaderboardPanel.querySelector('#leaderboardModalBody');
        const nameRow = uiRefs.leaderboardPanel.querySelector('#leaderboardNameRow');
        const status = uiRefs.leaderboardPanel.querySelector('#leaderboardStatusText');
        const list = uiRefs.leaderboardPanel.querySelector('#leaderboardList');
        if (!body || !nameRow || !status || !list) return null;

        let shell = uiRefs.leaderboardPanel.querySelector('#leaderboardReferenceShell');
        if (!shell) {
            shell = document.createElement('div');
            shell.id = 'leaderboardReferenceShell';
            shell.className = 'leaderboard-reference-shell';
        }

        let summary = uiRefs.leaderboardPanel.querySelector('#leaderboardSummary');
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'leaderboardSummary';
            summary.className = 'leaderboard-summary';
        }

        let tabs = uiRefs.leaderboardPanel.querySelector('#leaderboardFilterTabs');
        if (!tabs) {
            tabs = document.createElement('div');
            tabs.id = 'leaderboardFilterTabs';
            tabs.className = 'leaderboard-filter-tabs';

            const tabDefs = [
                { id: 'leaderboardCategoryScore', label: 'スコアランキング', category: LEADERBOARD_CATEGORY_SCORE },
                { id: 'leaderboardCategoryTimeAttack', label: 'タイムアタック', category: LEADERBOARD_CATEGORY_TIME_ATTACK },
                { id: 'leaderboardCategoryTimeDefense', label: '最長手数', category: LEADERBOARD_CATEGORY_TIME_DEFENSE, compact: true },
                { id: 'leaderboardCategoryShortestTurns', label: '最短手数', category: LEADERBOARD_CATEGORY_SHORTEST_TURNS, compact: true }
            ];
            tabDefs.forEach((tabDef) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.id = tabDef.id;
                button.className = tabDef.compact ? 'leaderboard-filter-tab is-compact' : 'leaderboard-filter-tab';
                button.dataset.category = tabDef.category;
                button.textContent = tabDef.label;
                button.setAttribute('aria-pressed', 'false');
                tabs.appendChild(button);
            });
        }

        if (!nameRow.classList.contains('is-reference-row')) {
            nameRow.classList.add('is-reference-row');
            const label = nameRow.querySelector('label');
            const input = uiRefs.leaderboardNameInput;
            const reloadBtn = uiRefs.leaderboardReloadBtn;

            const field = document.createElement('div');
            field.id = 'leaderboardNameField';
            field.className = 'leaderboard-name-field';
            if (label) field.appendChild(label);
            if (input) field.appendChild(input);

            const actions = document.createElement('div');
            actions.id = 'leaderboardActionButtons';
            actions.className = 'leaderboard-action-buttons';

            const modeWrap = document.createElement('div');
            modeWrap.id = 'leaderboardModeControl';
            modeWrap.className = 'leaderboard-mode-control';
            const modeBtn = document.createElement('button');
            modeBtn.id = 'leaderboardModeBtn';
            modeBtn.className = 'btn-small leaderboard-mode-btn';
            modeBtn.type = 'button';
            modeBtn.textContent = getLeaderboardModeButtonLabel();
            modeBtn.setAttribute('aria-label', `表示モード: ${getLeaderboardModeLabel(leaderboardActiveFilter)}`);
            modeBtn.setAttribute('aria-expanded', 'false');
            modeBtn.setAttribute('aria-haspopup', 'listbox');
            const modeMenu = document.createElement('div');
            modeMenu.id = 'leaderboardModeMenu';
            modeMenu.className = 'leaderboard-mode-menu';
            modeMenu.setAttribute('role', 'listbox');
            modeMenu.setAttribute('aria-hidden', 'true');
            [
                { id: 'leaderboardModeOptionCpu', label: 'CPU', filter: LEADERBOARD_FILTER_CPU },
                { id: 'leaderboardModeOptionNetwork', label: '対人', filter: LEADERBOARD_FILTER_NETWORK },
                { id: 'leaderboardModeOptionAll', label: '総合', filter: LEADERBOARD_FILTER_ALL }
            ].forEach((item) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.id = item.id;
                option.className = 'leaderboard-mode-option';
                option.dataset.filter = item.filter;
                option.setAttribute('role', 'option');
                option.textContent = item.label;
                modeMenu.appendChild(option);
            });
            const eraToggle = document.createElement('button');
            eraToggle.type = 'button';
            eraToggle.id = 'leaderboardEraToggle';
            eraToggle.className = 'leaderboard-mode-option leaderboard-era-toggle';
            eraToggle.dataset.era = LEADERBOARD_ERA_HISTORY;
            eraToggle.setAttribute('role', 'option');
            modeMenu.appendChild(eraToggle);
            modeWrap.appendChild(modeBtn);
            modeWrap.appendChild(modeMenu);
            actions.appendChild(modeWrap);

            const levelWrap = document.createElement('div');
            levelWrap.id = 'leaderboardCpuLevelControl';
            levelWrap.className = 'leaderboard-cpu-level-control';
            const levelBtn = document.createElement('button');
            levelBtn.id = 'leaderboardCpuLevelBtn';
            levelBtn.className = 'btn-small leaderboard-cpu-level-btn';
            levelBtn.type = 'button';
            levelBtn.textContent = getLeaderboardCpuLevelLabel(leaderboardCpuLevelFilter);
            levelBtn.setAttribute('aria-expanded', 'false');
            levelBtn.setAttribute('aria-haspopup', 'listbox');
            const levelMenu = document.createElement('div');
            levelMenu.id = 'leaderboardCpuLevelMenu';
            levelMenu.className = 'leaderboard-cpu-level-menu';
            levelMenu.setAttribute('role', 'listbox');
            levelMenu.setAttribute('aria-hidden', 'true');
            const levelDefs: Array<{ level: number | null; label: string }> = [
                { level: null, label: '全Lv' },
                ...Array.from({ length: 13 }, (_item, index) => {
                    const level = index + 1;
                    return { level, label: getLeaderboardCpuLevelLabel(level) };
                })
            ];
            levelDefs.forEach((item) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'leaderboard-cpu-level-option';
                option.id = item.level === null ? 'leaderboardCpuLevelOptionAll' : `leaderboardCpuLevelOption${item.level}`;
                option.dataset.cpuLevel = item.level === null ? '' : String(item.level);
                option.setAttribute('role', 'option');
                option.textContent = item.label;
                levelMenu.appendChild(option);
            });
            levelWrap.appendChild(levelBtn);
            levelWrap.appendChild(levelMenu);
            actions.appendChild(levelWrap);
            if (reloadBtn) actions.appendChild(reloadBtn);

            let infoBtn = uiRefs.leaderboardPanel.querySelector('#leaderboardInfoBtn');
            if (!infoBtn) {
                infoBtn = document.createElement('button');
                infoBtn.id = 'leaderboardInfoBtn';
                infoBtn.className = 'btn-small leaderboard-info-btn';
                infoBtn.type = 'button';
                infoBtn.textContent = 'ⓘ';
                infoBtn.setAttribute('aria-pressed', 'false');
                infoBtn.setAttribute('aria-label', 'ランキング説明');
            }
            actions.appendChild(infoBtn);

            nameRow.innerHTML = '';
            nameRow.appendChild(field);
            nameRow.appendChild(actions);
        }

        let details = uiRefs.leaderboardPanel.querySelector('#leaderboardDetailsPanel');
        if (!details) {
            details = document.createElement('div');
            details.id = 'leaderboardDetailsPanel';
            details.className = 'leaderboard-details-panel';
            details.textContent = '通算ランキングは旧記録を基準に、同じプレイヤーの検証済み新記録が上回った場合だけ表示を更新する。各行の「旧記録」「検証済み」で記録の由来を示す。共有スコアはサーバーが終局を確定した標準8x8のネット対戦だけを登録する。CPUの自己ベストはこの端末内だけに保存する。タイムアタック・最長手数・最短手数の共有登録は、サーバーがCPU対戦結果を検証できる仕組みを導入するまで停止する。速攻は15:00超過を有効記録にしない。';
        }

        let podium = uiRefs.leaderboardPanel.querySelector('#leaderboardPodium');
        if (!podium) {
            podium = document.createElement('div');
            podium.id = 'leaderboardPodium';
            podium.className = 'leaderboard-podium';
        }

        let table = uiRefs.leaderboardPanel.querySelector('#leaderboardTable');
        if (!table) {
            table = document.createElement('div');
            table.id = 'leaderboardTable';
            table.className = 'leaderboard-table';
        }

        let tableHeader = uiRefs.leaderboardPanel.querySelector('#leaderboardTableHeader');
        if (!tableHeader) {
            tableHeader = document.createElement('div');
            tableHeader.id = 'leaderboardTableHeader';
            tableHeader.className = 'leaderboard-table-header';
            ['順位', 'プレイヤー名', getLeaderboardValueHeaderLabel(), 'モード'].forEach((labelText, index) => {
                const cell = document.createElement('span');
                cell.className = `leaderboard-table-header-cell is-col-${index + 1}`;
                cell.textContent = labelText;
                tableHeader.appendChild(cell);
            });
        }

        let listViewport = uiRefs.leaderboardPanel.querySelector('#leaderboardListViewport');
        if (!listViewport) {
            listViewport = document.createElement('div');
            listViewport.id = 'leaderboardListViewport';
            listViewport.className = 'leaderboard-list-viewport';
        }

        let footnote = uiRefs.leaderboardPanel.querySelector('#leaderboardFootnote');
        if (!footnote) {
            footnote = document.createElement('div');
            footnote.id = 'leaderboardFootnote';
            footnote.className = 'leaderboard-footnote';
            footnote.textContent = 'ランキングは定期的に更新されます';
        }

        body.innerHTML = '';
        listViewport.appendChild(list);
        table.appendChild(tableHeader);
        table.appendChild(listViewport);
        shell.appendChild(summary);
        shell.appendChild(tabs);
        shell.appendChild(nameRow);
        shell.appendChild(details);
        shell.appendChild(status);
        shell.appendChild(podium);
        shell.appendChild(table);
        shell.appendChild(footnote);
        body.appendChild(shell);

        uiRefs.leaderboardStatus = status;
        uiRefs.leaderboardList = list;
        uiRefs.leaderboardNameInput = uiRefs.leaderboardPanel.querySelector('#leaderboardNameInput');
        uiRefs.leaderboardReloadBtn = uiRefs.leaderboardPanel.querySelector('#leaderboardReloadBtn');
        const profileOverlay = ensureLeaderboardProfilePopup();

        return {
            summary,
            tabs,
            cpuLevelControl: uiRefs.leaderboardPanel.querySelector('#leaderboardCpuLevelControl'),
            cpuLevelBtn: uiRefs.leaderboardPanel.querySelector('#leaderboardCpuLevelBtn'),
            cpuLevelMenu: uiRefs.leaderboardPanel.querySelector('#leaderboardCpuLevelMenu'),
            modeBtn: uiRefs.leaderboardPanel.querySelector('#leaderboardModeBtn'),
            modeMenu: uiRefs.leaderboardPanel.querySelector('#leaderboardModeMenu'),
            eraToggle: uiRefs.leaderboardPanel.querySelector('#leaderboardEraToggle'),
            details,
            podium,
            table,
            footnote,
            status,
            list,
            profileOverlay,
            infoBtn: uiRefs.leaderboardPanel.querySelector('#leaderboardInfoBtn')
        };
    }

    function clearLeaderboardRows() {
        if (!uiRefs.leaderboardList) return;
        uiRefs.leaderboardList.innerHTML = '';
    }

    function appendLeaderboardPlaceholder(text: any) {
        if (!uiRefs.leaderboardList) return;
        const row = document.createElement('div');
        row.className = 'leaderboard-row is-empty';
        row.textContent = String(text || 'まだ記録がありません');
        uiRefs.leaderboardList.appendChild(row);
    }

    function createLeaderboardRankBadge(rankValue: any) {
        const badge = document.createElement('span');
        badge.className = 'leaderboard-rank-badge';
        badge.textContent = `${rankValue || '-'}`;
        return badge;
    }

    function createLeaderboardNameLabel(entry: any, duplicateNames: any) {
        const name = document.createElement('span');
        name.className = 'leaderboard-name';
        const normalizedName = normalizePlayerName(entry.playerName) || DEFAULT_PLAYER_NAME;
        const text = document.createElement('span');
        text.className = 'leaderboard-name-text';
        text.textContent = normalizedName;
        name.appendChild(text);

        const playerId = PlayerIdentityContract && typeof PlayerIdentityContract.normalizeLeaderboardDisplayPlayerId === 'function'
            ? PlayerIdentityContract.normalizeLeaderboardDisplayPlayerId(entry && entry.playerId)
            : null;
        const suffixText = PlayerIdentityContract && typeof PlayerIdentityContract.formatShortPlayerId === 'function'
            ? PlayerIdentityContract.formatShortPlayerId(playerId)
            : '';
        if (playerId && suffixText) {
            const id = document.createElement('span');
            id.className = 'leaderboard-name-id';
            id.textContent = suffixText;
            id.title = `playerId: ${playerId}`;
            id.setAttribute('aria-label', `playerId ${playerId}`);
            name.appendChild(id);
        }
        return name;
    }

    function resolveLeaderboardProfileAvatar(entry: any): any {
        try {
            if (PlayerProfileAvatarOptions && typeof PlayerProfileAvatarOptions.getProfileAvatarOption === 'function') {
                return PlayerProfileAvatarOptions.getProfileAvatarOption(entry && entry.avatarStoneType);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function getLeaderboardProfileAvatarPath(entry: any): string {
        const option = resolveLeaderboardProfileAvatar(entry);
        return option && option.imagePath ? String(option.imagePath) : '';
    }

    function getLeaderboardProfileName(entry: any): string {
        return normalizePlayerName(entry && entry.playerName) || DEFAULT_PLAYER_NAME;
    }

    function getLeaderboardProfilePlayerId(entry: any): string {
        if (PlayerIdentityContract && typeof PlayerIdentityContract.normalizeLeaderboardDisplayPlayerId === 'function') {
            return PlayerIdentityContract.normalizeLeaderboardDisplayPlayerId(entry && entry.playerId) || '';
        }
        return String((entry && entry.playerId) || '').trim();
    }

    function ensureLeaderboardProfilePopup(): any {
        if (!uiRefs.leaderboardOverlay) return null;
        let overlay = uiRefs.leaderboardOverlay.querySelector('#leaderboardProfileOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'leaderboardProfileOverlay';
            overlay.className = 'leaderboard-profile-overlay';
            overlay.setAttribute('aria-hidden', 'true');

            const card = document.createElement('div');
            card.className = 'leaderboard-profile-card';
            card.setAttribute('role', 'dialog');
            card.setAttribute('aria-modal', 'true');
            card.setAttribute('aria-labelledby', 'leaderboardProfileName');

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'leaderboard-profile-close';
            closeBtn.setAttribute('aria-label', 'プロフィールを閉じる');
            closeBtn.textContent = '×';

            const avatar = document.createElement('div');
            avatar.className = 'leaderboard-profile-avatar';
            const avatarImg = document.createElement('img');
            avatarImg.className = 'leaderboard-profile-avatar-img';
            avatarImg.alt = '';
            avatar.appendChild(avatarImg);

            const body = document.createElement('div');
            body.className = 'leaderboard-profile-body';

            const name = document.createElement('div');
            name.id = 'leaderboardProfileName';
            name.className = 'leaderboard-profile-name';

            const playerId = document.createElement('div');
            playerId.className = 'leaderboard-profile-id';

            const bio = document.createElement('div');
            bio.className = 'leaderboard-profile-bio';

            body.appendChild(name);
            body.appendChild(playerId);
            body.appendChild(bio);
            card.appendChild(closeBtn);
            card.appendChild(avatar);
            card.appendChild(body);
            overlay.appendChild(card);
            uiRefs.leaderboardOverlay.appendChild(overlay);
        }

        if (!(overlay as any).__leaderboardProfileBound) {
            (overlay as any).__leaderboardProfileBound = true;
            overlay.addEventListener('click', (event: any) => {
                if (event && event.target === overlay) closeLeaderboardProfilePopup();
            });
            const closeBtn = overlay.querySelector('.leaderboard-profile-close');
            if (closeBtn) closeBtn.addEventListener('click', () => closeLeaderboardProfilePopup());
        }

        return overlay;
    }

    function openLeaderboardProfilePopup(entry: any): void {
        if (!entry || typeof entry !== 'object') return;
        const overlay = ensureLeaderboardProfilePopup();
        if (!overlay) return;
        const nameText = getLeaderboardProfileName(entry);
        const playerId = getLeaderboardProfilePlayerId(entry);
        const avatarPath = getLeaderboardProfileAvatarPath(entry);
        const bioText = String((entry && entry.bio) || '').trim() || '自己紹介は未設定です';
        const avatarImg = overlay.querySelector('.leaderboard-profile-avatar-img') as HTMLImageElement | null;
        const name = overlay.querySelector('.leaderboard-profile-name');
        const id = overlay.querySelector('.leaderboard-profile-id');
        const bio = overlay.querySelector('.leaderboard-profile-bio');

        if (avatarImg) {
            avatarImg.src = avatarPath || '';
            avatarImg.alt = avatarPath ? `${nameText}のアイコン` : '';
            avatarImg.hidden = !avatarPath;
        }
        if (name) name.textContent = nameText;
        if (id) id.textContent = playerId ? `playerId ${playerId}` : 'playerId 未設定';
        if (bio) bio.textContent = bioText;

        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        leaderboardProfilePopupOpen = true;
        const closeBtn = overlay.querySelector('.leaderboard-profile-close') as HTMLElement | null;
        if (closeBtn && typeof closeBtn.focus === 'function') {
            try { closeBtn.focus({ preventScroll: true }); } catch (e) { try { closeBtn.focus(); } catch (_e) { /* ignore */ } }
        }
    }

    function closeLeaderboardProfilePopup(): void {
        const overlay = uiRefs.leaderboardOverlay
            ? uiRefs.leaderboardOverlay.querySelector('#leaderboardProfileOverlay')
            : null;
        if (overlay) {
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
        }
        leaderboardProfilePopupOpen = false;
    }

    function makeLeaderboardProfileOpenable(element: HTMLElement, entry: any): void {
        if (!element || !entry || typeof entry !== 'object') return;
        element.classList.add('is-profile-openable');
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.setAttribute('aria-label', `${getLeaderboardProfileName(entry)}のプロフィールを開く`);
        element.addEventListener('click', () => openLeaderboardProfilePopup(entry));
        element.addEventListener('keydown', (event: any) => {
            if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            openLeaderboardProfilePopup(entry);
        });
    }

    function createLeaderboardRow(entry: any, selfPlayerId: any, duplicateNames: any) {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.dataset.mode = entry && entry.mode === 'network' ? 'network' : 'cpu';
        const displayRank = Number(entry && entry.rank);
        if (Number.isFinite(displayRank) && displayRank >= 1 && displayRank <= 3) {
            row.classList.add(`is-rank-${displayRank}`, 'is-top-rank');
        }

        const rankWrap = document.createElement('span');
        rankWrap.className = 'leaderboard-rank-wrap';
        rankWrap.appendChild(createLeaderboardRankBadge(entry.rank));

        const name = createLeaderboardNameLabel(entry, duplicateNames);

        const score = document.createElement('span');
        score.className = 'leaderboard-score';
        score.textContent = getLeaderboardEntryValueText(entry);

        const mode = createLeaderboardModeChip(entry);

        if (selfPlayerId && entry.playerId && entry.playerId === selfPlayerId) {
            row.classList.add('is-self');
            const marker = document.createElement('span');
            marker.className = 'leaderboard-self-marker';
            marker.textContent = '▹';
            rankWrap.insertBefore(marker, rankWrap.firstChild);
        }

        row.appendChild(rankWrap);
        row.appendChild(name);
        row.appendChild(score);
        row.appendChild(mode);
        makeLeaderboardProfileOpenable(row, entry);
        return row;
    }

    function createLeaderboardPodiumCard(entry: any, displayRank: any, duplicateNames: any, selfPlayerId: any) {
        const card = document.createElement('div');
        card.className = `leaderboard-podium-card is-rank-${displayRank || 0}`;
        if (selfPlayerId && entry && entry.playerId === selfPlayerId) {
            card.classList.add('is-self');
        }

        const avatarPath = getLeaderboardProfileAvatarPath(entry);
        if (avatarPath) {
            const avatarBg = document.createElement('span');
            avatarBg.className = 'leaderboard-podium-avatar-bg';
            avatarBg.setAttribute('aria-hidden', 'true');
            avatarBg.style.backgroundImage = `url("${avatarPath.replace(/"/g, '\\"')}")`;
            card.appendChild(avatarBg);
        }

        const badge = document.createElement('div');
        badge.className = 'leaderboard-podium-badge';
        badge.textContent = `${displayRank || '-'}`;

        const name = createLeaderboardNameLabel(entry, duplicateNames);
        name.classList.add('leaderboard-podium-name');

        const score = document.createElement('div');
        score.className = 'leaderboard-podium-score';
        score.textContent = getLeaderboardEntryValueText(entry);

        const mode = createLeaderboardModeChip(entry);
        mode.classList.add('leaderboard-podium-mode');

        card.appendChild(badge);
        card.appendChild(name);
        card.appendChild(score);
        card.appendChild(mode);
        makeLeaderboardProfileOpenable(card, entry);
        return card;
    }

    function createLeaderboardPodiumPlaceholder(displayRank: any) {
        const card = document.createElement('div');
        card.className = `leaderboard-podium-card is-rank-${displayRank || 0} is-placeholder`;

        const badge = document.createElement('div');
        badge.className = 'leaderboard-podium-badge';
        badge.textContent = `${displayRank || '-'}`;

        const name = document.createElement('div');
        name.className = 'leaderboard-podium-name';
        name.textContent = '----';

        const score = document.createElement('div');
        score.className = 'leaderboard-podium-score';
        score.textContent = '----';

        const meta = document.createElement('div');
        meta.className = 'leaderboard-podium-mode leaderboard-mode-chip is-placeholder';
        meta.textContent = '未接続';

        card.appendChild(badge);
        card.appendChild(name);
        card.appendChild(score);
        card.appendChild(meta);
        return card;
    }

    function createLeaderboardSummaryMetric(labelText: any, valueText: any, accentText?: any) {
        const card = document.createElement('div');
        card.className = 'leaderboard-summary-card';

        const label = document.createElement('span');
        label.className = 'leaderboard-summary-label';
        label.textContent = String(labelText || '');

        const value = document.createElement('span');
        value.className = 'leaderboard-summary-value';
        value.textContent = String(valueText || '未記録');

        card.appendChild(label);
        card.appendChild(value);

        if (accentText) {
            const accent = document.createElement('span');
            accent.className = 'leaderboard-summary-accent';
            accent.textContent = String(accentText);
            card.appendChild(accent);
        }

        return card;
    }

    function syncLeaderboardFilterButtons() {
        if (!uiRefs.leaderboardPanel) return;
        const buttons = Array.from(uiRefs.leaderboardPanel.querySelectorAll('.leaderboard-filter-tab'));
        buttons.forEach((button: any) => {
            const active = normalizeLeaderboardCategory(button && button.dataset ? button.dataset.category : '') === leaderboardActiveCategory;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function syncLeaderboardModeControl() {
        if (!uiRefs.leaderboardPanel) return;
        const button = uiRefs.leaderboardPanel.querySelector('#leaderboardModeBtn');
        const menu = uiRefs.leaderboardPanel.querySelector('#leaderboardModeMenu');
        const control = uiRefs.leaderboardPanel.querySelector('#leaderboardModeControl');
        const visible = true;
        if (control) {
            control.classList.toggle('is-visible', visible);
            control.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }
        if (button) {
            button.textContent = getLeaderboardModeButtonLabel();
            button.setAttribute('aria-label', `表示モード: ${getLeaderboardModeLabel(leaderboardActiveFilter)}`);
            button.setAttribute('aria-expanded', leaderboardModeMenuOpen && visible ? 'true' : 'false');
        }
        if (menu) {
            menu.classList.toggle('is-open', leaderboardModeMenuOpen && visible);
            menu.setAttribute('aria-hidden', leaderboardModeMenuOpen && visible ? 'false' : 'true');
            const options = Array.from(menu.querySelectorAll('.leaderboard-mode-option'));
            options.forEach((option: any) => {
                if (option.classList.contains('leaderboard-era-toggle')) return;
                const active = normalizeLeaderboardFilter(option && option.dataset ? option.dataset.filter : '') === leaderboardActiveFilter;
                option.classList.toggle('is-active', active);
                option.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            const eraToggle = menu.querySelector('#leaderboardEraToggle');
            if (eraToggle) {
                const historyAvailable = visible;
                const historyActive = isHistoricalLeaderboardActive();
                eraToggle.textContent = historyActive ? '現行記録のみ表示' : '通算ランキングを表示';
                eraToggle.classList.toggle('is-active', historyActive);
                eraToggle.setAttribute('aria-selected', historyActive ? 'true' : 'false');
                eraToggle.hidden = !historyAvailable;
                eraToggle.disabled = !historyAvailable;
                eraToggle.setAttribute('aria-hidden', historyAvailable ? 'false' : 'true');
            }
        }
    }

    function syncLeaderboardArchiveContext() {
        if (!uiRefs.leaderboardPanel) return;
        const legacyActive = isLegacyLeaderboardActive();
        const historyActive = isHistoricalLeaderboardActive();
        uiRefs.leaderboardPanel.classList.toggle('is-legacy-records', legacyActive);
        uiRefs.leaderboardPanel.classList.toggle('is-history-records', historyActive);
        const footnote = uiRefs.leaderboardPanel.querySelector('#leaderboardFootnote');
        if (footnote) {
            footnote.textContent = historyActive
                ? '通算ランキングは旧記録を基準に、上回った検証済み新記録だけを反映しています'
                : legacyActive
                ? '旧記録は検証方式導入前の履歴です。現行順位や新規登録には含まれません'
                : '現行ランキングはサーバー検証済みの記録です';
        }
    }

    function syncLeaderboardTableHeader() {
        if (!uiRefs.leaderboardPanel) return;
        const header = uiRefs.leaderboardPanel.querySelector('#leaderboardTableHeader');
        if (!header) return;
        const labels = ['順位', 'プレイヤー名', getLeaderboardValueHeaderLabel(), 'モード'];
        const cells = Array.from(header.querySelectorAll('.leaderboard-table-header-cell'));
        cells.forEach((cell: any, index) => {
            cell.textContent = labels[index] || '';
        });
    }

    function syncLeaderboardCpuLevelControl() {
        if (!uiRefs.leaderboardPanel) return;
        const control = uiRefs.leaderboardPanel.querySelector('#leaderboardCpuLevelControl');
        const button = uiRefs.leaderboardPanel.querySelector('#leaderboardCpuLevelBtn');
        const menu = uiRefs.leaderboardPanel.querySelector('#leaderboardCpuLevelMenu');
        const cpuActive = leaderboardActiveFilter === LEADERBOARD_FILTER_CPU;
        if (control) {
            control.classList.toggle('is-visible', cpuActive);
            control.setAttribute('aria-hidden', cpuActive ? 'false' : 'true');
        }
        if (button) {
            button.textContent = getLeaderboardCpuLevelLabel(leaderboardCpuLevelFilter);
            button.setAttribute('aria-expanded', leaderboardCpuLevelMenuOpen && cpuActive ? 'true' : 'false');
        }
        if (menu) {
            menu.classList.toggle('is-open', leaderboardCpuLevelMenuOpen && cpuActive);
            menu.setAttribute('aria-hidden', leaderboardCpuLevelMenuOpen && cpuActive ? 'false' : 'true');
            const options = Array.from(menu.querySelectorAll('.leaderboard-cpu-level-option'));
            options.forEach((option: any) => {
                const level = normalizeLeaderboardCpuLevel(option && option.dataset ? option.dataset.cpuLevel : '');
                const active = level === leaderboardCpuLevelFilter;
                option.classList.toggle('is-active', active);
                option.setAttribute('aria-selected', active ? 'true' : 'false');
            });
        }
    }

    function syncLeaderboardDetailsVisibility() {
        if (!uiRefs.leaderboardPanel) return;
        uiRefs.leaderboardPanel.classList.toggle('is-detail-open', leaderboardDetailsOpen === true);
        const infoBtn = uiRefs.leaderboardPanel.querySelector('#leaderboardInfoBtn');
        if (infoBtn) {
            infoBtn.setAttribute('aria-pressed', leaderboardDetailsOpen ? 'true' : 'false');
            infoBtn.textContent = 'ⓘ';
        }
    }

    function renderLeaderboardSummary(entries: any, updatedAt: any) {
        const scaffold = ensureLeaderboardScaffold();
        if (!scaffold || !scaffold.summary) return;

        let selfPlayerId = null;
        try {
            if (root.LeaderboardClient && typeof root.LeaderboardClient.getPlayerId === 'function') {
                selfPlayerId = root.LeaderboardClient.getPlayerId();
            }
        } catch (e) { /* ignore */ }

        const selfEntry = Array.isArray(entries)
            ? entries.find((entry: any) => entry && entry.playerId && entry.playerId === selfPlayerId)
            : null;

        const bestText = selfEntry ? getLeaderboardEntryValueText(selfEntry) : '未記録';
        const rankText = selfEntry ? `#${selfEntry.rank || '-'}` : '未記録';
        const timeText = formatLeaderboardTime(updatedAt) || '--:--';

        scaffold.summary.innerHTML = '';
        scaffold.summary.appendChild(createLeaderboardSummaryMetric(getLeaderboardSummaryBestLabel(), bestText));
        scaffold.summary.appendChild(createLeaderboardSummaryMetric('現在順位', rankText));
        scaffold.summary.appendChild(createLeaderboardSummaryMetric('最終更新', timeText));
    }

    function renderLeaderboardPodium(entries: any) {
        const scaffold = ensureLeaderboardScaffold();
        if (!scaffold || !scaffold.podium) return;
        scaffold.podium.innerHTML = '';

        const safeEntries = Array.isArray(entries) ? entries : [];
        if (!safeEntries.length) {
            [2, 1, 3].forEach((rank) => {
                scaffold.podium.appendChild(createLeaderboardPodiumPlaceholder(rank));
            });
            return;
        }

        let selfPlayerId = null;
        try {
            if (root.LeaderboardClient && typeof root.LeaderboardClient.getPlayerId === 'function') {
                selfPlayerId = root.LeaderboardClient.getPlayerId();
            }
        } catch (e) { /* ignore */ }

        const duplicateNames = collectDuplicateLeaderboardNames(safeEntries);
        const topThree = safeEntries.slice(0, LEADERBOARD_PODIUM_ENTRY_COUNT);
        const displayOrder = [1, 0, 2];
        displayOrder.forEach((entryIndex) => {
            const entry = topThree[entryIndex];
            if (!entry) return;
            scaffold.podium.appendChild(
                createLeaderboardPodiumCard(entry, entry.rank || (entryIndex + 1), duplicateNames, selfPlayerId)
            );
        });
    }

    function renderLeaderboardRows(entries: any) {
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
        const rowEntries = safeEntries.slice();
        if (!rowEntries.length) {
            appendLeaderboardPlaceholder('上位表示のみです');
            return;
        }

        rowEntries.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            uiRefs.leaderboardList.appendChild(createLeaderboardRow(entry, selfPlayerId, duplicateNames));
        });
    }

    function renderLeaderboardView() {
        const activeEntries = getActiveLeaderboardEntries();
        renderLeaderboardSummary(activeEntries, leaderboardUpdatedAt);
        renderLeaderboardPodium(activeEntries);
        renderLeaderboardRows(activeEntries);
        syncLeaderboardFilterButtons();
        syncLeaderboardModeControl();
        syncLeaderboardCpuLevelControl();
        syncLeaderboardArchiveContext();
        syncLeaderboardTableHeader();
        syncLeaderboardDetailsVisibility();
    }

    async function refreshLeaderboardPanel(options: any) {
        const opts = options || {};
        if (!uiRefs.leaderboardPanel || !uiRefs.leaderboardStatus || !uiRefs.leaderboardList) return;
        ensureLeaderboardScaffold();
        if (uiRefs.leaderboardOverlay && !isLeaderboardOverlayOpen() && opts.force !== true) return;
        const requestedFilter = normalizeLeaderboardFilter(opts.mode || leaderboardActiveFilter);
        renderLeaderboardView();
        const token = ++leaderboardRefreshToken;
        writeLeaderboardStatus('ランキング更新中...', false);

        let leaderboardClient = getLeaderboardClient();
        if (!leaderboardClient) {
            leaderboardClient = await ensureLeaderboardClient();
        }
        if (token !== leaderboardRefreshToken) return;

        if (!leaderboardClient || (typeof leaderboardClient.fetchLeaderboard !== 'function')) {
            writeLeaderboardStatus('ランキング機能を利用できません', true);
            return;
        }

        let result = null;
        try {
{
                const fetchOptions = Object.assign({ limit: SHARED_LEADERBOARD_PANEL_LIMIT, mode: requestedFilter, category: leaderboardActiveCategory }, opts);
                delete fetchOptions.force;
                fetchOptions.mode = requestedFilter;
                fetchOptions.category = leaderboardActiveCategory;
                if (isHistoricalLeaderboardActive()) {
                    fetchOptions.era = LEADERBOARD_ERA_HISTORY;
                } else if (isLegacyLeaderboardActive()) {
                    fetchOptions.era = LEADERBOARD_ERA_LEGACY;
                } else {
                    delete fetchOptions.era;
                }
                if (requestedFilter === LEADERBOARD_FILTER_CPU && leaderboardCpuLevelFilter !== null) {
                    fetchOptions.cpuLevel = leaderboardCpuLevelFilter;
                } else {
                    delete fetchOptions.cpuLevel;
                }
                result = await leaderboardClient.fetchLeaderboard(fetchOptions);
            }
        } catch (e) {
            result = { ok: false, reason: 'LIST_FAILED', entries: [] };
        }

        if (token !== leaderboardRefreshToken) return;

        if (!result || result.ok !== true) {
            renderLeaderboardView();
            writeLeaderboardStatus('ランキング取得に失敗しました', true);
            return;
        }

        leaderboardEntriesCache = Array.isArray(result.entries) ? result.entries.slice() : [];
        leaderboardUpdatedAt = Number.isFinite(Number(result.updatedAt)) ? Number(result.updatedAt) : 0;
        renderLeaderboardView();
        const timeLabel = formatLeaderboardTime(result.updatedAt);
        const archiveSuffix = isHistoricalLeaderboardActive()
            ? '（通算）'
            : isLegacyLeaderboardActive()
            ? '（旧記録）'
            : '';
        writeLeaderboardStatus(timeLabel ? `最終更新 ${timeLabel}${archiveSuffix}` : `ランキングを表示中${archiveSuffix}`, false);
    }

    function openLeaderboard(options?: any) {
        const opts = options || {};
        leaderboardActiveCategory = normalizeLeaderboardCategory(opts.category || leaderboardActiveCategory);
        if (opts.mode) {
            leaderboardActiveFilter = normalizeLeaderboardFilter(opts.mode);
        }
        if (opts.era) {
            leaderboardActiveEra = normalizeLeaderboardEra(opts.era);
        }
        leaderboardCpuLevelMenuOpen = false;
        leaderboardModeMenuOpen = false;
        setNetworkOverlayVisible(false);
        setLeaderboardOverlayVisible(true);
        syncLeaderboardFilterButtons();
        syncLeaderboardModeControl();
        syncLeaderboardCpuLevelControl();
        syncLeaderboardArchiveContext();
        refreshLeaderboardPanel({ force: true, mode: leaderboardActiveFilter });
    }

    function bindLeaderboardControls() {
        if (!uiRefs.leaderboardPanel || !uiRefs.leaderboardOverlay) return;
        ensureLeaderboardScaffold();

        if (uiRefs.leaderboardOpenBtn) {
            uiRefs.leaderboardOpenBtn.addEventListener('click', () => {
                const willOpen = !isLeaderboardOverlayOpen();
                if (willOpen) {
                    setNetworkOverlayVisible(false);
                }
                setLeaderboardOverlayVisible(willOpen);
                if (willOpen) {
                    refreshLeaderboardPanel({ force: true, mode: leaderboardActiveFilter });
                }
            });
        }

        const filterTabs = uiRefs.leaderboardPanel.querySelector('#leaderboardFilterTabs');
        if (filterTabs && !(filterTabs as any).__leaderboardBound) {
            (filterTabs as any).__leaderboardBound = true;
            filterTabs.addEventListener('click', (event: any) => {
                const target = event && event.target && typeof event.target.closest === 'function'
                    ? event.target.closest('.leaderboard-filter-tab')
                    : null;
                if (!target || !target.dataset) return;
                leaderboardActiveCategory = normalizeLeaderboardCategory(target.dataset.category);
                leaderboardCpuLevelMenuOpen = false;
                leaderboardModeMenuOpen = false;
                syncLeaderboardFilterButtons();
                syncLeaderboardModeControl();
                syncLeaderboardCpuLevelControl();
                syncLeaderboardArchiveContext();
                refreshLeaderboardPanel({ force: true, mode: leaderboardActiveFilter });
            });
        }

        const modeBtn = uiRefs.leaderboardPanel.querySelector('#leaderboardModeBtn');
        if (modeBtn && !(modeBtn as any).__leaderboardBound) {
            (modeBtn as any).__leaderboardBound = true;
            modeBtn.addEventListener('click', () => {
                leaderboardModeMenuOpen = !leaderboardModeMenuOpen;
                leaderboardCpuLevelMenuOpen = false;
                syncLeaderboardModeControl();
                syncLeaderboardCpuLevelControl();
            });
        }

        const modeMenu = uiRefs.leaderboardPanel.querySelector('#leaderboardModeMenu');
        if (modeMenu && !(modeMenu as any).__leaderboardBound) {
            (modeMenu as any).__leaderboardBound = true;
            modeMenu.addEventListener('click', (event: any) => {
                const target = event && event.target && typeof event.target.closest === 'function'
                    ? event.target.closest('.leaderboard-mode-option')
                    : null;
                if (!target || !target.dataset) return;
                if (target.classList.contains('leaderboard-era-toggle')) {
                    leaderboardActiveEra = isHistoricalLeaderboardActive()
                        ? LEADERBOARD_ERA_CURRENT
                        : LEADERBOARD_ERA_HISTORY;
                    leaderboardModeMenuOpen = false;
                    leaderboardCpuLevelMenuOpen = false;
                    syncLeaderboardModeControl();
                    syncLeaderboardCpuLevelControl();
                    syncLeaderboardArchiveContext();
                    refreshLeaderboardPanel({ force: true, mode: leaderboardActiveFilter });
                    return;
                }
                leaderboardActiveFilter = normalizeLeaderboardFilter(target.dataset.filter);
                leaderboardModeMenuOpen = false;
                leaderboardCpuLevelMenuOpen = false;
                syncLeaderboardModeControl();
                syncLeaderboardCpuLevelControl();
                refreshLeaderboardPanel({ force: true, mode: leaderboardActiveFilter });
            });
        }

        const cpuLevelBtn = uiRefs.leaderboardPanel.querySelector('#leaderboardCpuLevelBtn');
        if (cpuLevelBtn && !(cpuLevelBtn as any).__leaderboardBound) {
            (cpuLevelBtn as any).__leaderboardBound = true;
            cpuLevelBtn.addEventListener('click', () => {
                if (leaderboardActiveFilter !== LEADERBOARD_FILTER_CPU) return;
                leaderboardCpuLevelMenuOpen = !leaderboardCpuLevelMenuOpen;
                syncLeaderboardCpuLevelControl();
            });
        }

        const cpuLevelMenu = uiRefs.leaderboardPanel.querySelector('#leaderboardCpuLevelMenu');
        if (cpuLevelMenu && !(cpuLevelMenu as any).__leaderboardBound) {
            (cpuLevelMenu as any).__leaderboardBound = true;
            cpuLevelMenu.addEventListener('click', (event: any) => {
                const target = event && event.target && typeof event.target.closest === 'function'
                    ? event.target.closest('.leaderboard-cpu-level-option')
                    : null;
                if (!target || !target.dataset) return;
                leaderboardCpuLevelFilter = normalizeLeaderboardCpuLevel(target.dataset.cpuLevel);
                leaderboardCpuLevelMenuOpen = false;
                syncLeaderboardCpuLevelControl();
                refreshLeaderboardPanel({ force: true, mode: LEADERBOARD_FILTER_CPU });
            });
        }

        const detailBtn = uiRefs.leaderboardPanel.querySelector('#leaderboardDetailBtn');
        const infoBtn = uiRefs.leaderboardPanel.querySelector('#leaderboardInfoBtn') || detailBtn;
        if (infoBtn && !(infoBtn as any).__leaderboardBound) {
            (infoBtn as any).__leaderboardBound = true;
            infoBtn.addEventListener('click', () => {
                leaderboardDetailsOpen = !leaderboardDetailsOpen;
                syncLeaderboardDetailsVisibility();
            });
        }

        if (uiRefs.leaderboardCloseBtn) {
            uiRefs.leaderboardCloseBtn.addEventListener('click', () => {
                setLeaderboardOverlayVisible(false);
            });
        }

        uiRefs.leaderboardOverlay.addEventListener('click', (event: any) => {
            if (!event) return;
            if (event.target === uiRefs.leaderboardOverlay) {
                setLeaderboardOverlayVisible(false);
            }
        });

        if (typeof root.addEventListener === 'function') {
            root.addEventListener('keydown', (event: any) => {
                if (!event || event.key !== 'Escape') return;
                if (leaderboardProfilePopupOpen) {
                    closeLeaderboardProfilePopup();
                    return;
                }
                if (leaderboardCpuLevelMenuOpen) {
                    leaderboardCpuLevelMenuOpen = false;
                    syncLeaderboardCpuLevelControl();
                    return;
                }
                if (leaderboardModeMenuOpen) {
                    leaderboardModeMenuOpen = false;
                    syncLeaderboardModeControl();
                    return;
                }
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
            uiRefs.leaderboardNameInput.addEventListener('keydown', (event: any) => {
                if (!event || event.key !== 'Enter') return;
                event.preventDefault();
                applyName();
            });
        }

        if (uiRefs.leaderboardReloadBtn) {
            uiRefs.leaderboardReloadBtn.addEventListener('click', () => {
                refreshLeaderboardPanel({ force: true, mode: leaderboardActiveFilter });
            });
        }

        if (typeof root.addEventListener === 'function') {
            root.addEventListener('leaderboard:updated', () => {
                if (!isLeaderboardOverlayOpen()) return;
                refreshLeaderboardPanel({ force: true, mode: leaderboardActiveFilter });
            });
        }

        syncLeaderboardFilterButtons();
        syncLeaderboardModeControl();
        syncLeaderboardCpuLevelControl();
        syncLeaderboardArchiveContext();
        syncLeaderboardDetailsVisibility();
        setLeaderboardOverlayVisible(false);
    }


    return {
        bindControls: bindLeaderboardControls,
        isOverlayOpen: isLeaderboardOverlayOpen,
        setOverlayVisible: setLeaderboardOverlayVisible,
        openLeaderboard,
        refreshPanel: refreshLeaderboardPanel
    };
}

const MatchModeLeaderboardController = {
    createLeaderboardController
};

export = MatchModeLeaderboardController;
