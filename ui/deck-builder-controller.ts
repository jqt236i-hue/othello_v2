import type { CardState, GameState, PlayerKey } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

'use strict';

const DeckSpecHelpers = _require('../shared/deck-spec');
const DeckCodecModule = _require('../shared/deck-codec');
const DeckPresetStorage = _require('./storage/deck-presets');
const DeckBuilderStateModule = _require('./deck-builder-state');
const DeckBuilderRendererModule = _require('./deck-builder-renderer');
const SharedBoardUtilsModule = _require('../shared/shared-board-utils');
const SharedBoardUtils = SharedBoardUtilsModule && SharedBoardUtilsModule.default
    ? SharedBoardUtilsModule.default
    : SharedBoardUtilsModule;
const SharedUIBootstrap = _require('../shared/ui-bootstrap-shared');

    function ensureDependencies() {
        if (!DeckSpecHelpers || !DeckCodecModule || !DeckPresetStorage || !DeckBuilderStateModule || !DeckBuilderRendererModule || !SharedBoardUtils) {
            throw new Error('Deck builder dependencies are missing');
        }
    }

    function createDeckBuilderController(options: any) {
        ensureDependencies();

        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
        const uiBootstrapShared = SharedUIBootstrap || null;
        const refs = Object.assign({
            openBtn: null,
            controlSummary: null,
            overlay: null,
            closeBtn: null,
            headerSummary: null,
            body: null,
            boardSizeOpenBtn: null,
            boardSizeControlSummary: null,
            boardSizeEditor: null,
            boardSizeRowsInput: null,
            boardSizeColsInput: null,
            boardSizeCloseBtn: null,
            boardSizeEditorNote: null
        }, opts.refs || {});

        const state = {
            overlayOpen: false,
            boardSizeEditorOpen: false,
            view: 'presets',
            noticeText: '',
            noticeIsError: false,
            presetState: DeckPresetStorage.loadState(),
            activeLocalChoice: null as any,
            localBoardConfig: SharedBoardUtils.buildBoardConfig(),
            editor: {
                presetId: '',
                nameValue: '',
                draft: DeckBuilderStateModule.createEmptyDraft(),
                codeInputValue: ''
            }
        };

        function normalizeChoiceLabel(name: any, fallback: any) {
            const normalized = String(name || '').replace(/\s+/g, ' ').trim();
            return normalized || fallback;
        }

        function normalizeBoardConfig(value: any) {
            if (typeof SharedBoardUtils.resolveBoardConfig === 'function') {
                return SharedBoardUtils.resolveBoardConfig(value);
            }
            return SharedBoardUtils.buildBoardConfig(
                value && value.rows,
                value && value.cols
            );
        }

        function cloneBoardConfig(value: any) {
            const normalized = normalizeBoardConfig(value);
            return {
                rows: normalized.rows,
                cols: normalized.cols,
                standard8x8: normalized.standard8x8 === true,
                baseBounds: Object.assign({}, normalized.baseBounds || {}),
                outerBounds: Object.assign({}, normalized.outerBounds || {})
            };
        }

        function createDefaultBoardConfig() {
            return cloneBoardConfig(SharedBoardUtils.buildBoardConfig());
        }

        function resolveSharedUIBootstrapHelpers() {
            if (uiBootstrapShared && typeof uiBootstrapShared === 'object') {
                return uiBootstrapShared;
            }
            try {
                if (rootRef && rootRef.SharedUIBootstrap && typeof rootRef.SharedUIBootstrap === 'object') {
                    return rootRef.SharedUIBootstrap;
                }
            } catch (e: any) { /* ignore */ }
            return null;
        }

        function collectNetworkMatchClientRootsForDeckBuilder() {
            return [
                rootRef,
                rootRef && (rootRef as any).window,
                rootRef && (rootRef as any).document && (rootRef as any).document.defaultView,
                refs.body && refs.body.ownerDocument && refs.body.ownerDocument.defaultView,
                (typeof document !== 'undefined' ? document.defaultView : null),
                (typeof window !== 'undefined' ? window : null),
                (typeof globalThis !== 'undefined' ? (globalThis as any).window : null),
                (typeof globalThis !== 'undefined' ? (globalThis as any).document && (globalThis as any).document.defaultView : null),
                (typeof globalThis !== 'undefined' ? globalThis : null)
            ].filter((candidate, index, list) => candidate && list.indexOf(candidate) === index);
        }

        function isActiveNetworkMatchClientForDeckBuilder(client: any) {
            return !!client
                && typeof client === 'object'
                && typeof client.isActive === 'function'
                && client.isActive();
        }

        function snapshotActiveNetworkMatchClientForDeckBuilder() {
            const snapshots = [] as Array<{ root: any; client: any }>;
            for (const candidateRoot of collectNetworkMatchClientRootsForDeckBuilder()) {
                try {
                    const client = (candidateRoot as any).NetworkMatchClient;
                    if (isActiveNetworkMatchClientForDeckBuilder(client)) snapshots.push({ root: candidateRoot, client });
                } catch (e: any) { /* ignore */ }
            }
            return snapshots;
        }

        function restoreActiveNetworkMatchClientForDeckBuilder(snapshots: Array<{ root: any; client: any }>) {
            for (const snapshot of snapshots) {
                try {
                    const current = snapshot.root.NetworkMatchClient;
                    if (!isActiveNetworkMatchClientForDeckBuilder(current)) {
                        snapshot.root.NetworkMatchClient = snapshot.client;
                    }
                } catch (e: any) { /* ignore */ }
            }
        }

        function mergeTurnManagerUiImpl(payload: any) {
            const sharedHelpers = resolveSharedUIBootstrapHelpers();
            if (sharedHelpers && typeof sharedHelpers.mergeUIImpl === 'function') {
                const activeNetworkClient = snapshotActiveNetworkMatchClientForDeckBuilder();
                sharedHelpers.mergeUIImpl(rootRef, 'turn_manager', payload);
                restoreActiveNetworkMatchClientForDeckBuilder(activeNetworkClient);
                return;
            }
            try {
                rootRef.__uiImpl_turn_manager = Object.assign({}, rootRef.__uiImpl_turn_manager || {}, payload);
            } catch (e: any) { /* ignore */ }
            try {
                if (typeof globalThis !== 'undefined') {
                    (globalThis as any).__uiImpl_turn_manager = Object.assign({}, (globalThis as any).__uiImpl_turn_manager || {}, payload);
                }
            } catch (e: any) { /* ignore */ }
        }

        function formatBoardConfigLabel(boardConfig: any) {
            const normalized = normalizeBoardConfig(boardConfig);
            return `${normalized.rows}x${normalized.cols}`;
        }

        function parseBoardDimensionInput(value: any, fallbackValue: any) {
            const normalized = String(value || '').trim();
            if (!normalized) return fallbackValue;
            const numeric = Number(normalized);
            return Number.isFinite(numeric) ? numeric : fallbackValue;
        }

        function getBoardDimensionBounds(axis: any) {
            if (SharedBoardUtils && typeof SharedBoardUtils.getBoardDimensionBounds === 'function') {
                return SharedBoardUtils.getBoardDimensionBounds(axis);
            }
            return axis === 'col'
                ? { min: 4, max: 10 }
                : { min: 4, max: 10 };
        }

        function stepBoardDimensionValue(value: any, direction: any, fallbackValue: any, axis: any) {
            if (SharedBoardUtils && typeof SharedBoardUtils.stepBoardDimensionValue === 'function') {
                return SharedBoardUtils.stepBoardDimensionValue(value, direction, fallbackValue, axis);
            }
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

        function updateLocalBoardConfigFromInputs() {
            const fallback = getLocalBoardConfig();
            updateLocalBoardConfig({
                rows: parseBoardDimensionInput(refs.boardSizeRowsInput && refs.boardSizeRowsInput.value, fallback.rows),
                cols: parseBoardDimensionInput(refs.boardSizeColsInput && refs.boardSizeColsInput.value, fallback.cols)
            });
        }

        function compareCardDefsForDeckBuilder(left: any, right: any) {
            const leftDef = (left && typeof left === 'object') ? left : {};
            const rightDef = (right && typeof right === 'object') ? right : {};
            const leftCost = Number(leftDef.cost) || 0;
            const rightCost = Number(rightDef.cost) || 0;
            if (leftCost !== rightCost) {
                return rightCost - leftCost;
            }
            return String(leftDef.id || '').localeCompare(String(rightDef.id || ''), 'en');
        }

        function getDefaultDeckSize() {
            return (DeckSpecHelpers && typeof DeckSpecHelpers.getDefaultDeckSize === 'function')
                ? DeckSpecHelpers.getDefaultDeckSize()
                : 30;
        }

        function createStandardChoice(context: any) {
            const ctx = (context && typeof context === 'object') ? context : {};
            return {
                source: ctx.source || 'standard',
                mode: 'standard',
                name: normalizeChoiceLabel(ctx.name, 'デフォルトデッキ'),
                deckCode: '',
                deckSpec: null,
                deckSize: getDefaultDeckSize(),
                presetId: ctx.presetId || ''
            };
        }

        function createCustomChoice(deckSpec: any, context: any) {
            const ctx = (context && typeof context === 'object') ? context : {};
            const normalizedSpec = DeckSpecHelpers.normalizeDeckSpec(deckSpec);
            const summary = DeckSpecHelpers.summarizeDeckSpec(normalizedSpec);
            return {
                source: ctx.source || 'custom',
                mode: 'custom',
                name: normalizeChoiceLabel(ctx.name, 'カスタムデッキ'),
                deckCode: DeckCodecModule.encodeDeckSpec(normalizedSpec),
                deckSpec: normalizedSpec,
                deckSize: summary.deckSize,
                presetId: ctx.presetId || ''
            };
        }

        function decodeDeckSpecOrNull(deckCode: any) {
            const decoded = DeckCodecModule.safeDecodeDeckCode(deckCode);
            return decoded.ok ? decoded.deckSpec : null;
        }

        function createChoiceFromDeckCode(deckCode: any, context: any) {
            const deckSpec = decodeDeckSpecOrNull(deckCode);
            return deckSpec ? createCustomChoice(deckSpec, context) : null;
        }

        function getPresetDisplayName(preset: any, index: any) {
            return normalizeChoiceLabel(preset && preset.name, `プリセット ${index + 1}`);
        }

        function getPresetIndex(preset: any) {
            const index = DeckPresetStorage.PRESET_IDS.indexOf(preset && preset.id);
            return index >= 0 ? index : 0;
        }

        function getPresetChoiceName(preset: any) {
            return getPresetDisplayName(preset, getPresetIndex(preset));
        }

        function findPresetById(presetId: any) {
            return state.presetState.presets.find((preset: any) => preset.id === presetId) || null;
        }

        function savePresetState() {
            state.presetState = DeckPresetStorage.saveState(state.presetState);
        }

        function emitNotice(text: any, isError: any, alsoLog: any) {
            state.noticeText = String(text || '').trim();
            state.noticeIsError = !!isError;
            if (alsoLog && state.noticeText && typeof rootRef.addLog === 'function') {
                try {
                    rootRef.addLog(state.noticeText);
                } catch (e: any) { /* ignore */ }
            }
        }

        function clearNotice() {
            state.noticeText = '';
            state.noticeIsError = false;
        }

        function setLocalActiveChoice(choice: any, optionsOverride?: any) {
            const optsLocal = (optionsOverride && typeof optionsOverride === 'object') ? optionsOverride : {};
            state.activeLocalChoice = choice;

            if (optsLocal.persistActivePreset !== false) {
                state.presetState.activePresetId = choice && choice.presetId ? choice.presetId : '';
                savePresetState();
            }

            syncUrlFromLocalChoice();
        }

        function hydrateLocalChoiceFromStorage() {
            state.activeLocalChoice = createStandardChoice({ source: 'standard' });

            const activePresetId = String(state.presetState.activePresetId || '');
            if (!activePresetId) return;

            const activePreset = findPresetById(activePresetId);
            if (!activePreset || !activePreset.deckCode) {
                state.presetState.activePresetId = '';
                savePresetState();
                return;
            }

            const presetChoice = createChoiceFromDeckCode(activePreset.deckCode, {
                source: 'preset',
                name: getPresetChoiceName(activePreset),
                presetId: activePreset.id
            });
            if (!presetChoice) {
                state.presetState.activePresetId = '';
                savePresetState();
                emitNotice('保存済みデッキを読み込めなかったためデフォルトデッキを使います', true, true);
                return;
            }

            state.activeLocalChoice = presetChoice;
        }

        function readDeckParamFromLocation() {
            try {
                if (!rootRef.location || !rootRef.location.search) return '';
                const params = new URLSearchParams(rootRef.location.search);
                return String(params.get('deck') || '').trim();
            } catch (e: any) {
                return '';
            }
        }

        function syncUrlFromLocalChoice() {
            const localChoice = state.activeLocalChoice || createStandardChoice({ source: 'standard' });
            const nextDeckCode = localChoice.mode === 'custom' ? localChoice.deckCode : '';

            try {
                if (!rootRef.location || !rootRef.history || typeof rootRef.history.replaceState !== 'function') return;
                const url = new URL(rootRef.location.href);
                if (nextDeckCode) {
                    url.searchParams.set('deck', nextDeckCode);
                } else {
                    url.searchParams.delete('deck');
                }
                const nextUrl = `${url.pathname}${url.search}${url.hash}`;
                rootRef.history.replaceState(rootRef.history.state || null, '', nextUrl);
            } catch (e: any) { /* ignore */ }
        }

        function hydrateUrlChoice() {
            const rawDeckCode = readDeckParamFromLocation();
            if (!rawDeckCode) {
                syncUrlFromLocalChoice();
                return;
            }

            const urlChoice = createChoiceFromDeckCode(rawDeckCode, {
                source: 'url',
                name: 'URLデッキ',
                presetId: ''
            });
            if (!urlChoice) {
                emitNotice('URL の deckCode を読み込めなかったため保存済み設定へ戻しました', true, true);
                syncUrlFromLocalChoice();
                return;
            }

            setLocalActiveChoice(urlChoice, { persistActivePreset: false });
            emitNotice('URL の deckCode を読み込みました', false, false);
        }

        function getRoomDeckMetadata() {
            try {
                const networkClient = resolveNetworkMatchClientForDeckBuilder('getRoomDeck');
                if (!networkClient || typeof networkClient.getRoomDeck !== 'function') return null;
                if (typeof networkClient.isActive === 'function' && !networkClient.isActive()) return null;
                const roomDeck = networkClient.getRoomDeck();
                return (roomDeck && typeof roomDeck === 'object') ? roomDeck : null;
            } catch (e: any) {
                return null;
            }
        }

        function getRoomBoardConfigMetadata() {
            try {
                const networkClient = resolveNetworkMatchClientForDeckBuilder('getRoomBoardConfig');
                if (!networkClient || typeof networkClient.getRoomBoardConfig !== 'function') return null;
                if (typeof networkClient.isActive === 'function' && !networkClient.isActive()) return null;
                const roomBoardConfig = networkClient.getRoomBoardConfig();
                return roomBoardConfig ? normalizeBoardConfig(roomBoardConfig) : null;
            } catch (e: any) {
                return null;
            }
        }

        function resolveBoardConfigLockReason() {
            return resolveBoardConfigOwnership().reason;
        }

        function resolveBoardConfigOwnership() {
            const roomBoardConfig = getRoomBoardConfigMetadata();
            if (roomBoardConfig) {
                return {
                    reason: 'room',
                    boardConfig: cloneBoardConfig(roomBoardConfig)
                };
            }
            return {
                reason: '',
                boardConfig: cloneBoardConfig(state.localBoardConfig)
            };
        }

        function readBoardConfig() {
            return resolveBoardConfigOwnership().boardConfig;
        }

        function getLocalBoardConfig() {
            return cloneBoardConfig(state.localBoardConfig);
        }

        function updateLocalBoardConfig(nextBoardConfig: any) {
            state.localBoardConfig = normalizeBoardConfig(nextBoardConfig);
            renderBoardSizeControls();
        }

        function buildBoardSizeSummaryText() {
            const boardConfig = readBoardConfig();
            const label = formatBoardConfigLabel(boardConfig);
            const lockReason = resolveBoardConfigLockReason();
            if (lockReason === 'room') return `${label} / 部屋固定`;
            return label;
        }

        function buildBoardSizeNoteText() {
            const lockReason = resolveBoardConfigLockReason();
            if (lockReason === 'room') {
                return 'ネット対戦中は部屋で決めた盤面サイズを使います';
            }
            return '次のリセット / 新規対局で反映';
        }

        function renderBoardSizeControls() {
            const activeBoardConfig = readBoardConfig();
            const editableBoardConfig = resolveBoardConfigLockReason()
                ? activeBoardConfig
                : getLocalBoardConfig();
            const locked = !!resolveBoardConfigLockReason();

            if (refs.boardSizeOpenBtn) {
                refs.boardSizeOpenBtn.setAttribute('aria-expanded', state.boardSizeEditorOpen ? 'true' : 'false');
            }
            if (refs.boardSizeControlSummary) {
                refs.boardSizeControlSummary.textContent = buildBoardSizeSummaryText();
                refs.boardSizeControlSummary.classList.toggle('is-room-override', resolveBoardConfigLockReason() === 'room');
            }
            if (refs.boardSizeEditor) {
                refs.boardSizeEditor.hidden = !state.boardSizeEditorOpen;
                refs.boardSizeEditor.classList.toggle('is-locked', locked);
            }
            if (refs.boardSizeRowsInput) {
                applyBoardDimensionInputBounds(refs.boardSizeRowsInput, 'row');
                refs.boardSizeRowsInput.value = String(editableBoardConfig.rows);
                refs.boardSizeRowsInput.disabled = locked;
            }
            if (refs.boardSizeColsInput) {
                applyBoardDimensionInputBounds(refs.boardSizeColsInput, 'col');
                refs.boardSizeColsInput.value = String(editableBoardConfig.cols);
                refs.boardSizeColsInput.disabled = locked;
            }
            if (refs.boardSizeEditorNote) {
                refs.boardSizeEditorNote.textContent = buildBoardSizeNoteText();
                refs.boardSizeEditorNote.classList.toggle('is-room-override', resolveBoardConfigLockReason() === 'room');
            }
        }

        function readNetworkSeatKey() {
            try {
                const networkClient = resolveNetworkMatchClientForDeckBuilder('getSeatKey');
                if (networkClient && typeof networkClient.getSeatKey === 'function') {
                    const seatKey = String(networkClient.getSeatKey() || '').trim().toLowerCase();
                    if (seatKey === 'white') return 'white';
                }
            } catch (e: any) { /* ignore */ }
            return 'black';
        }

        type NetworkMatchClientMethod = 'getRoomDeck' | 'getRoomBoardConfig' | 'getSeatKey';

        function resolveNetworkMatchClientForDeckBuilder(requiredMethod?: NetworkMatchClientMethod) {
            const candidateRoots = [
                (typeof document !== 'undefined' ? document.defaultView : null),
                (typeof window !== 'undefined' ? window : null),
                (typeof globalThis !== 'undefined' ? (globalThis as any).window : null),
                (typeof globalThis !== 'undefined' ? (globalThis as any).document && (globalThis as any).document.defaultView : null),
                rootRef,
                rootRef && (rootRef as any).window,
                rootRef && (rootRef as any).document && (rootRef as any).document.defaultView,
                refs.body && refs.body.ownerDocument && refs.body.ownerDocument.defaultView,
                (typeof globalThis !== 'undefined' ? globalThis : null)
            ];
            for (const candidateRoot of candidateRoots) {
                try {
                    if (!candidateRoot) continue;
                    const candidates = [
                        (candidateRoot as any).NetworkMatchClient,
                        (typeof Reflect !== 'undefined' ? Reflect.get(candidateRoot as object, 'NetworkMatchClient') : null),
                        (candidateRoot as any).window && (candidateRoot as any).window.NetworkMatchClient
                    ];
                    for (const client of candidates) {
                        if (!client || typeof client !== 'object') continue;
                        if (requiredMethod && typeof client[requiredMethod] !== 'function') continue;
                        if (typeof client.isActive === 'function' && !client.isActive()) continue;
                        return client;
                    }
                } catch (e: any) { /* ignore */ }
            }
            return null;
        }

        function resolveRoomDeckInitOptions(roomDeck: any) {
            if (!roomDeck || typeof roomDeck !== 'object') return null;

            const deckCodeByPlayer = (roomDeck.deckCodeByPlayer && typeof roomDeck.deckCodeByPlayer === 'object')
                ? roomDeck.deckCodeByPlayer
                : null;
            if (deckCodeByPlayer && (roomDeck.mode === 'perPlayer' || deckCodeByPlayer.black || deckCodeByPlayer.white)) {
                const initialDeckSpecByPlayer = {} as any;
                const blackDeckSpec = decodeDeckSpecOrNull(deckCodeByPlayer.black);
                const whiteDeckSpec = decodeDeckSpecOrNull(deckCodeByPlayer.white);
                if (blackDeckSpec) initialDeckSpecByPlayer.black = blackDeckSpec;
                if (whiteDeckSpec) initialDeckSpecByPlayer.white = whiteDeckSpec;
                return Object.keys(initialDeckSpecByPlayer).length > 0
                    ? { initialDeckSpecByPlayer }
                    : {};
            }

            if (!roomDeck.deckCode) {
                return {};
            }

            const deckSpec = decodeDeckSpecOrNull(roomDeck.deckCode);
            return deckSpec ? { initialDeckSpec: deckSpec } : {};
        }

        function readRoomDeckSpec(roomDeck: any) {
            if (!roomDeck || typeof roomDeck !== 'object') return null;

            const deckCodeByPlayer = (roomDeck.deckCodeByPlayer && typeof roomDeck.deckCodeByPlayer === 'object')
                ? roomDeck.deckCodeByPlayer
                : null;
            if (deckCodeByPlayer && (roomDeck.mode === 'perPlayer' || deckCodeByPlayer.black || deckCodeByPlayer.white)) {
                const seatKey = readNetworkSeatKey();
                return decodeDeckSpecOrNull(deckCodeByPlayer[seatKey]) || null;
            }

            return roomDeck.deckCode ? (decodeDeckSpecOrNull(roomDeck.deckCode) || null) : null;
        }

        function getRoomDeckChoice() {
            const roomDeck = getRoomDeckMetadata();
            if (!roomDeck) return null;

            const fallbackChoice = createStandardChoice({ source: 'room', name: '部屋デッキ' });

            if (!roomDeck.deckCode) {
                return {
                    choice: fallbackChoice,
                    roomDeck
                };
            }

            const roomChoice = createChoiceFromDeckCode(roomDeck.deckCode, {
                source: 'room',
                name: '部屋デッキ'
            });
            if (!roomChoice) {
                return {
                    choice: fallbackChoice,
                    roomDeck
                };
            }

            return {
                choice: roomChoice,
                roomDeck
            };
        }

        function getEffectiveChoice() {
            const roomChoice = getRoomDeckChoice();
            if (roomChoice) {
                return {
                    choice: roomChoice.choice,
                    roomDeck: roomChoice.roomDeck,
                    roomOverrideActive: true
                };
            }

            return {
                choice: state.activeLocalChoice || createStandardChoice({ source: 'standard' }),
                roomDeck: null,
                roomOverrideActive: false
            };
        }

        function readCurrentMatchMode() {
            try {
                if (typeof rootRef.getCurrentMatchMode === 'function') {
                    const mode = String(rootRef.getCurrentMatchMode() || '').trim();
                    if (mode) return mode;
                }
            } catch (e: any) { /* ignore */ }

            try {
                if (rootRef.MatchMode && typeof rootRef.MatchMode.getCurrentMode === 'function') {
                    const mode = String(rootRef.MatchMode.getCurrentMode() || '').trim();
                    if (mode) return mode;
                }
            } catch (e: any) { /* ignore */ }

            const fallbackMode = String(rootRef.MATCH_MODE || rootRef.__MATCH_MODE || '').trim();
            return fallbackMode || 'cpu';
        }

        function readCpuLevel(playerKey: string) {
            try {
                const source = rootRef && rootRef.cpuSmartness && typeof rootRef.cpuSmartness === 'object'
                    ? rootRef.cpuSmartness
                    : null;
                const level = Number(source && source[playerKey]);
                if (source && Number.isFinite(level)) return Math.max(1, Math.min(6, Math.floor(level)));
            } catch (e: any) { /* ignore */ }

            try {
                const doc = (rootRef && rootRef.document)
                    || (typeof document !== 'undefined' ? document : null);
                const id = playerKey === 'white' ? 'smartWhite' : 'smartBlack';
                const select = doc && typeof doc.getElementById === 'function'
                    ? doc.getElementById(id)
                    : null;
                const level = Number(select && (select as HTMLSelectElement).value);
                return Number.isFinite(level) ? Math.max(1, Math.min(6, Math.floor(level))) : 1;
            } catch (e: any) { /* ignore */ }
            return 1;
        }

        function resolveCpuLv6WhiteDeckSpec() {
            if (readCurrentMatchMode() !== 'cpu') return null;
            if (readCpuLevel('white') < 6) return null;
            if (!DeckSpecHelpers || typeof DeckSpecHelpers.getCpuLv6WhiteDeckCode !== 'function') return null;
            return DeckCodecModule.decodeDeckCode(DeckSpecHelpers.getCpuLv6WhiteDeckCode());
        }

        function buildCpuDeckInitOptions(blackDeckSpec: any) {
            const whiteDeckSpec = resolveCpuLv6WhiteDeckSpec();
            const initialDeckSpecByPlayer: any = {};
            if (blackDeckSpec) initialDeckSpecByPlayer.black = blackDeckSpec;
            if (whiteDeckSpec) initialDeckSpecByPlayer.white = whiteDeckSpec;
            return Object.keys(initialDeckSpecByPlayer).length > 0
                ? { initialDeckSpecByPlayer }
                : {};
        }

        function buildCardInitOptions() {
            const roomDeck = getRoomDeckMetadata();
            const baseOptions = {
                boardConfig: readBoardConfig()
            };
            if (roomDeck) {
                return Object.assign(baseOptions, resolveRoomDeckInitOptions(roomDeck) || {});
            }

            const effective = getEffectiveChoice();
            if (effective.choice && effective.choice.mode === 'custom' && effective.choice.deckSpec) {
                if (effective.roomOverrideActive) {
                    return Object.assign(baseOptions, { initialDeckSpec: effective.choice.deckSpec });
                }
                if (readCurrentMatchMode() === 'cpu') {
                    return Object.assign(baseOptions, buildCpuDeckInitOptions(effective.choice.deckSpec));
                }
                return Object.assign(baseOptions, { initialDeckSpec: effective.choice.deckSpec });
            }
            return Object.assign(baseOptions, buildCpuDeckInitOptions(null));
        }

        function readActiveDeckSpec() {
            const roomDeck = getRoomDeckMetadata();
            if (roomDeck) {
                return readRoomDeckSpec(roomDeck);
            }

            const effective = getEffectiveChoice();
            return (effective.choice && effective.choice.deckSpec) || null;
        }

        function installTurnManagerBinding() {
            const payload = {
                buildCardInitOptions,
                readActiveDeckSpec,
                readBoardConfig,
                getLocalBoardConfig
            };

            mergeTurnManagerUiImpl(payload);

            try {
                if (rootRef.UIBootstrap && typeof rootRef.UIBootstrap.registerUIGlobals === 'function') {
                    rootRef.UIBootstrap.registerUIGlobals({ DeckBuilderController: api });
                }
            } catch (e: any) { /* ignore */ }
        }

        function formatLocalChoiceSummary(choice: any) {
            const targetChoice = choice || createStandardChoice({ source: 'standard' });
            if (targetChoice.mode === 'custom') {
                return `${normalizeChoiceLabel(targetChoice.name, 'カスタムデッキ')} / ${targetChoice.deckSize}枚`;
            }
            return `デフォルトデッキ / ${targetChoice.deckSize}枚`;
        }

        function formatEffectiveChoiceSummary(effective: any) {
            if (!effective.roomOverrideActive) {
                return `実対局に使うデッキ: ${formatLocalChoiceSummary(effective.choice)}`;
            }

            if (effective.choice.mode === 'custom') {
                return `実対局に使うデッキ: 部屋デッキ / ${effective.choice.deckSize}枚（退出後はローカル設定へ戻ります）`;
            }
            return `実対局に使うデッキ: 部屋デッキ / デフォルトデッキ（退出後はローカル設定へ戻ります）`;
        }

        function buildPresetViewModel() {
            return state.presetState.presets.map((preset: any, index: any) => {
                if (!preset.deckCode) {
                    return {
                        id: preset.id,
                        displayName: getPresetDisplayName(preset, index),
                        summaryText: '未保存',
                        noteText: '',
                        noteIsError: false,
                        canUse: false,
                        isActive: preset.id === state.presetState.activePresetId
                    };
                }

                const deckSpec = decodeDeckSpecOrNull(preset.deckCode);
                if (!deckSpec) {
                    return {
                        id: preset.id,
                        displayName: getPresetDisplayName(preset, index),
                        summaryText: '読み込み不可',
                        noteText: 'catalog 変更などで無効です',
                        noteIsError: true,
                        canUse: false,
                        isActive: false
                    };
                }

                const summary = DeckSpecHelpers.summarizeDeckSpec(deckSpec);
                return {
                    id: preset.id,
                    displayName: getPresetDisplayName(preset, index),
                    summaryText: `${summary.deckSize}枚 / ${summary.distinctCount}種`,
                    noteText: preset.id === state.presetState.activePresetId ? '現在使用中' : '',
                    noteIsError: false,
                    canUse: true,
                    isActive: preset.id === state.presetState.activePresetId
                };
            });
        }

        function buildEditorViewModel() {
            const draftSummary = DeckBuilderStateModule.getDraftSummary(state.editor.draft);
            const editorPreset = findPresetById(state.editor.presetId);
            const candidateCards = DeckBuilderRendererModule.getEnabledCardDefs()
                .slice()
                .sort(compareCardDefsForDeckBuilder)
                .map((cardDef: any) => {
                const selectedCount = DeckBuilderStateModule.getSelectedCount(state.editor.draft, cardDef.id);
                const willResetToZero = selectedCount >= DeckSpecHelpers.MAX_DUPLICATES_PER_CARD;
                const disabledAdd = !willResetToZero && !DeckBuilderStateModule.canAddCardToDraft(state.editor.draft, cardDef.id);
                return {
                    cardId: cardDef.id,
                    cardDef,
                    selectedCount,
                    willResetToZero,
                    disabledAdd,
                    footerText: disabledAdd
                        ? '30枚で満杯'
                        : (willResetToZero ? '次で0枚に戻す' : '押すと追加')
                };
            });

            const selectedCards = DeckBuilderStateModule.listSelectedCards(state.editor.draft)
                .slice()
                .sort((left: any, right: any) => compareCardDefsForDeckBuilder(left.cardDef, right.cardDef));

            return {
                titleText: normalizeChoiceLabel(editorPreset && editorPreset.name, 'プリセット編集'),
                nameValue: state.editor.nameValue,
                summaryText: `${draftSummary.totalCount}/${DeckSpecHelpers.CUSTOM_DECK_SIZE}枚 ・ 残り${draftSummary.remainingCount}枚`,
                canSave: draftSummary.canSave,
                canUse: draftSummary.canSave,
                canCopy: draftSummary.canSave,
                codeInputValue: state.editor.codeInputValue,
                selectedCards,
                candidateCards
            };
        }

        function buildViewModel() {
            const effective = getEffectiveChoice();
            return {
                overlayOpen: state.overlayOpen,
                view: state.view,
                roomOverrideActive: effective.roomOverrideActive,
                controlSummaryText: formatLocalChoiceSummary(state.activeLocalChoice),
                headerSummaryText: `ローカル設定: ${formatLocalChoiceSummary(state.activeLocalChoice)}`,
                effectiveSummaryText: formatEffectiveChoiceSummary(effective),
                noticeText: state.noticeText,
                noticeIsError: state.noticeIsError,
                standardSummaryText: `${getDefaultDeckSize()}枚 / 有効カードから重複なしランダム`,
                presets: buildPresetViewModel(),
                editor: buildEditorViewModel()
            };
        }

        function render(optionsOverride?: any) {
            const renderOptions = (optionsOverride && typeof optionsOverride === 'object') ? optionsOverride : {};
            DeckBuilderRendererModule.renderDeckBuilder(refs, buildViewModel(), {
                onUseStandard: useStandardDeck,
                onUsePreset: usePreset,
                onEditPreset: editPreset,
                onEditorBack: backToPresetList,
                onEditorNameInput: function (value: any) {
                    state.editor.nameValue = String(value || '');
                },
                onEditorCodeInput: function (value: any) {
                    state.editor.codeInputValue = String(value || '');
                },
                onEditorAddCard: addCardToEditor,
                onEditorRemoveCard: removeCardFromEditor,
                onEditorImportCode: importEditorCode,
                onEditorSave: saveEditorPreset,
                onEditorUse: useEditorDraft,
                onEditorCopyCode: copyEditorCode
            }, renderOptions);
            renderBoardSizeControls();
        }

        function renderPreservingEditorScroll(optionsOverride?: any) {
            const renderOptions = (optionsOverride && typeof optionsOverride === 'object') ? optionsOverride : {};
            render(Object.assign({ preserveBodyScroll: state.view === 'editor' }, renderOptions));
        }

        function escapeCardIdForSelector(cardId: any) {
            return String(cardId || '')
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"');
        }

        function buildEditorCardAnchorOptions(cardId: any, event: any, gridClassName: any) {
            const safeGridClassName = String(gridClassName || '').trim();
            const safeCardId = escapeCardIdForSelector(cardId);
            const selectorPrefix = safeGridClassName ? `.${safeGridClassName} ` : '';
            return {
                preserveBodyScroll: state.view === 'editor',
                anchorElement: event && event.currentTarget ? event.currentTarget : null,
                anchorSelector: `${selectorPrefix}.deck-builder-card[data-card-id="${safeCardId}"]`
            };
        }

        function syncEditorCodeFromDraft() {
            const draftSummary = DeckBuilderStateModule.getDraftSummary(state.editor.draft);
            if (!draftSummary.canSave) {
                state.editor.codeInputValue = '';
                return;
            }
            const deckSpec = DeckBuilderStateModule.createDeckSpecFromDraft(state.editor.draft);
            state.editor.codeInputValue = DeckCodecModule.encodeDeckSpec(deckSpec);
        }

        function open() {
            clearNotice();
            state.overlayOpen = true;
            state.view = 'presets';
            render();
        }

        function close() {
            state.overlayOpen = false;
            render();
        }

        function useStandardDeck() {
            setLocalActiveChoice(createStandardChoice({ source: 'standard' }));
            emitNotice('デフォルトデッキへ切り替えました', false, true);
            render();
        }

        function usePreset(presetId: any) {
            const preset = findPresetById(presetId);
            if (!preset || !preset.deckCode) {
                emitNotice('このプリセットはまだ保存されていません', true, false);
                render();
                return;
            }

            const presetName = getPresetChoiceName(preset);
            const presetChoice = createChoiceFromDeckCode(preset.deckCode, {
                source: 'preset',
                name: presetName,
                presetId: preset.id
            });
            if (!presetChoice) {
                emitNotice('このプリセットは現在の catalog では使えません', true, false);
                render();
                return;
            }

            setLocalActiveChoice(presetChoice);
            emitNotice(`${presetName} を使用中にしました`, false, true);
            render();
        }

        function editPreset(presetId: any) {
            const preset = findPresetById(presetId);
            state.editor.presetId = presetId;
            state.editor.nameValue = preset ? preset.name : '';

            if (preset && preset.deckCode) {
                const deckSpec = decodeDeckSpecOrNull(preset.deckCode);
                if (deckSpec) {
                    state.editor.draft = DeckBuilderStateModule.createDraftFromDeckSpec(deckSpec);
                    state.editor.codeInputValue = preset.deckCode;
                } else {
                    state.editor.draft = DeckBuilderStateModule.createEmptyDraft();
                    state.editor.codeInputValue = preset.deckCode;
                    emitNotice('保存済み code を読み込めなかったため空の編集画面で開きました', true, false);
                }
            } else {
                state.editor.draft = DeckBuilderStateModule.createEmptyDraft();
                state.editor.codeInputValue = '';
            }

            state.view = 'editor';
            render();
        }

        function backToPresetList() {
            state.view = 'presets';
            render();
        }

        function addCardToEditor(cardId: any, event: any) {
            state.editor.draft = DeckBuilderStateModule.advanceCardSelection(state.editor.draft, cardId);
            syncEditorCodeFromDraft();
            renderPreservingEditorScroll(buildEditorCardAnchorOptions(cardId, event, 'deck-builder-candidate-grid'));
        }

        function removeCardFromEditor(cardId: any, event: any) {
            state.editor.draft = DeckBuilderStateModule.removeCardFromDraft(state.editor.draft, cardId);
            syncEditorCodeFromDraft();
            renderPreservingEditorScroll(buildEditorCardAnchorOptions(cardId, event, 'deck-builder-selected-grid'));
        }

        function importEditorCode() {
            const deckSpec = decodeDeckSpecOrNull(state.editor.codeInputValue);
            if (!deckSpec) {
                emitNotice('deckCode を読み込めませんでした', true, false);
                render();
                return;
            }
            state.editor.draft = DeckBuilderStateModule.createDraftFromDeckSpec(deckSpec);
            state.editor.codeInputValue = DeckCodecModule.encodeDeckSpec(deckSpec);
            emitNotice('deckCode からデッキを読み込みました', false, false);
            renderPreservingEditorScroll();
        }

        function writePresetFromEditor() {
            const draftSummary = DeckBuilderStateModule.getDraftSummary(state.editor.draft);
            if (!draftSummary.canSave) {
                throw new Error('CUSTOM_DECK_INCOMPLETE');
            }
            const deckSpec = DeckBuilderStateModule.createDeckSpecFromDraft(state.editor.draft);
            const deckCode = DeckCodecModule.encodeDeckSpec(deckSpec);
            state.editor.codeInputValue = deckCode;

            state.presetState.presets = state.presetState.presets.map((preset: any) => {
                if (preset.id !== state.editor.presetId) return preset;
                return Object.assign({}, preset, {
                    name: String(state.editor.nameValue || '').replace(/\s+/g, ' ').trim(),
                    deckCode,
                    updatedAt: Date.now()
                });
            });
            savePresetState();
            return deckCode;
        }

        function saveEditorPreset() {
            try {
                writePresetFromEditor();
                emitNotice('プリセットを保存しました', false, false);
            } catch (e: any) {
                emitNotice('30枚そろえると保存できます', true, false);
            }
            renderPreservingEditorScroll();
        }

        function useEditorDraft() {
            try {
                writePresetFromEditor();
            } catch (e: any) {
                emitNotice('30枚そろえると使用できます', true, false);
                render();
                return;
            }

            usePreset(state.editor.presetId);
            state.view = 'presets';
            render();
        }

        async function copyEditorCode() {
            const draftSummary = DeckBuilderStateModule.getDraftSummary(state.editor.draft);
            if (!draftSummary.canSave) {
                emitNotice('30枚そろえると code をコピーできます', true, false);
                render();
                return;
            }

            const deckCode = state.editor.codeInputValue || DeckCodecModule.encodeDeckSpec(DeckBuilderStateModule.createDeckSpecFromDraft(state.editor.draft));
            state.editor.codeInputValue = deckCode;

            try {
                if (rootRef.navigator && rootRef.navigator.clipboard && typeof rootRef.navigator.clipboard.writeText === 'function') {
                    await rootRef.navigator.clipboard.writeText(deckCode);
                    emitNotice('deckCode をコピーしました', false, false);
                } else {
                    emitNotice('この環境ではクリップボードへ直接コピーできません', true, false);
                }
            } catch (e: any) {
                emitNotice('deckCode のコピーに失敗しました', true, false);
            }
            renderPreservingEditorScroll();
        }

        function bindStaticEvents() {
            if (refs.openBtn && refs.openBtn.dataset.deckBuilderBound !== '1') {
                refs.openBtn.addEventListener('click', open);
                refs.openBtn.dataset.deckBuilderBound = '1';
            }

            if (refs.closeBtn && refs.closeBtn.dataset.deckBuilderBound !== '1') {
                refs.closeBtn.addEventListener('click', close);
                refs.closeBtn.dataset.deckBuilderBound = '1';
            }

            if (refs.overlay && refs.overlay.dataset.deckBuilderBound !== '1') {
                refs.overlay.addEventListener('click', (event: any) => {
                    if (event && event.target === refs.overlay) {
                        close();
                    }
                });
                refs.overlay.dataset.deckBuilderBound = '1';
            }

            if (refs.boardSizeOpenBtn && refs.boardSizeOpenBtn.dataset.boardSizeBound !== '1') {
                refs.boardSizeOpenBtn.addEventListener('click', () => {
                    state.boardSizeEditorOpen = !state.boardSizeEditorOpen;
                    renderBoardSizeControls();
                });
                refs.boardSizeOpenBtn.dataset.boardSizeBound = '1';
            }

            if (refs.boardSizeCloseBtn && refs.boardSizeCloseBtn.dataset.boardSizeBound !== '1') {
                refs.boardSizeCloseBtn.addEventListener('click', () => {
                    state.boardSizeEditorOpen = false;
                    renderBoardSizeControls();
                });
                refs.boardSizeCloseBtn.dataset.boardSizeBound = '1';
            }

            const bindBoardSizeInput = (inputRef: any, axis: any) => {
                if (!inputRef || inputRef.dataset.boardSizeBound === '1') return;
                const onBoardSizeInput = () => {
                    if (resolveBoardConfigLockReason()) {
                        renderBoardSizeControls();
                        return;
                    }
                    updateLocalBoardConfigFromInputs();
                };
                inputRef.addEventListener('input', onBoardSizeInput);
                inputRef.addEventListener('change', onBoardSizeInput);
                inputRef.addEventListener('wheel', (event: any) => {
                    if (resolveBoardConfigLockReason() || inputRef.disabled) {
                        renderBoardSizeControls();
                        return;
                    }
                    const primaryDelta = readPrimaryWheelDelta(event);
                    if (!primaryDelta) return;
                    const fallback = getLocalBoardConfig();
                    const fallbackValue = axis === 'col' ? fallback.cols : fallback.rows;
                    inputRef.value = String(stepBoardDimensionValue(
                        inputRef.value,
                        primaryDelta < 0 ? 1 : -1,
                        fallbackValue,
                        axis
                    ));
                    if (event && event.cancelable) event.preventDefault();
                    updateLocalBoardConfigFromInputs();
                }, { passive: false });
                inputRef.dataset.boardSizeBound = '1';
            };

            bindBoardSizeInput(refs.boardSizeRowsInput, 'row');
            bindBoardSizeInput(refs.boardSizeColsInput, 'col');

            if (rootRef && typeof rootRef.addEventListener === 'function' && !rootRef.__deckBuilderEscBound) {
                rootRef.addEventListener('keydown', (event: any) => {
                    if (!event || event.key !== 'Escape') return;
                    if (state.boardSizeEditorOpen) {
                        event.preventDefault();
                        state.boardSizeEditorOpen = false;
                        renderBoardSizeControls();
                        return;
                    }
                    if (!state.overlayOpen) return;
                    event.preventDefault();
                    close();
                });
                rootRef.__deckBuilderEscBound = true;
            }
        }

        const api = {
            open,
            close,
            render,
            buildCardInitOptions,
            readActiveDeckSpec,
            readBoardConfig,
            getLocalBoardConfig,
            setLocalBoardConfig: updateLocalBoardConfig,
            getActiveLocalChoice: function () {
                return Object.assign({}, state.activeLocalChoice || createStandardChoice({ source: 'standard' }));
            }
        };

        hydrateLocalChoiceFromStorage();
        hydrateUrlChoice();
        installTurnManagerBinding();
        bindStaticEvents();
        render();

        return api;
    }

    const DeckBuilderController = {
        createDeckBuilderController
    };
export = DeckBuilderController;
