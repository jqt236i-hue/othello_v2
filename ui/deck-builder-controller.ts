
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
const CardInteractionEffectsModule = _require('../cards/card-interaction-effects');
const SharedBoardUtilsModule = _require('../shared/shared-board-utils');
const SharedBoardUtils = SharedBoardUtilsModule && SharedBoardUtilsModule.default
    ? SharedBoardUtilsModule.default
    : SharedBoardUtilsModule;
const SharedUIBootstrap = _require('../shared/ui-bootstrap-shared');
const CpuOpponentStartupOptions = _require('../shared/cpu-opponent-startup-options');
const CpuProfileSelection = _require('./cpu-profile-selection');
const FeatureStylesheetLoader = _require('./assets/feature-stylesheet-loader');

type CpuDeckRule = 'default' | 'all-cards' | 'random-30';

function normalizeCpuDeckRule(value: any): CpuDeckRule {
    return value === 'all-cards' || value === 'random-30' ? value : 'default';
}

    function ensureDependencies() {
        if (!DeckSpecHelpers || !DeckCodecModule || !DeckPresetStorage || !DeckBuilderStateModule || !DeckBuilderRendererModule || !SharedBoardUtils) {
            throw new Error('Deck builder dependencies are missing');
        }
    }

    function createDeckBuilderController(options: any) {
        ensureDependencies();

        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
        const featureStylesheetLoader = opts.featureStylesheetLoader || FeatureStylesheetLoader;
        const ensureSurface = typeof opts.ensureSurface === 'function'
            ? opts.ensureSurface
            : null;
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
            boardShapeSelect: null,
            boardSizeRowsInput: null,
            boardSizeColsInput: null,
            boardSizeCloseBtn: null,
            boardSizeEditorNote: null,
            stoneSupplyCheckbox: null
        }, opts.refs || {});

        const state = {
            overlayOpen: false,
            boardSizeEditorOpen: false,
            view: 'presets',
            noticeText: '',
            noticeIsError: false,
            presetState: DeckPresetStorage.loadState(),
            activeLocalChoice: null as any,
            networkDeckSyncChain: Promise.resolve({ ok: true, skipped: true }) as any,
            networkDeckSyncBusy: false,
            networkDeckSyncLatestDeckCode: null as any,
            networkDeckSyncLatestPromise: null as any,
            localBoardConfig: SharedBoardUtils.buildBoardConfig(),
            localStoneSupplyEnabled: true,
            localCpuDeckRule: 'default' as CpuDeckRule,
            editor: {
                presetId: '',
                sourceName: '',
                nameValue: '',
                draft: DeckBuilderStateModule.createEmptyDraft(),
                codeInputValue: '',
                detailCardId: ''
            }
        };
        let surfaceReadyPromise: Promise<any> | null = null;
        let persistedPresetState = DeckPresetStorage.normalizeState(state.presetState);

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
                shape: normalized.shape === 'circle' ? 'circle' : 'rectangle',
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
            if (normalized.shape !== 'circle') return `${normalized.rows}x${normalized.cols}`;
            const playableCount = typeof SharedBoardUtils.collectMainBoardCoordinates === 'function'
                ? SharedBoardUtils.collectMainBoardCoordinates(normalized).length
                : 0;
            return `円形 ${normalized.rows}x${normalized.cols} / ${playableCount}マス`;
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
            const columnAxis = axis === 'col' || axis === 'cols' || axis === 'column';
            const minValue = columnAxis ? SharedBoardUtils && SharedBoardUtils.MIN_BOARD_COLS : SharedBoardUtils && SharedBoardUtils.MIN_BOARD_ROWS;
            const maxValue = columnAxis ? SharedBoardUtils && SharedBoardUtils.MAX_BOARD_COLS : SharedBoardUtils && SharedBoardUtils.MAX_BOARD_ROWS;
            return {
                min: minValue != null && Number.isFinite(Number(minValue)) ? Number(minValue) : 4,
                max: maxValue != null && Number.isFinite(Number(maxValue)) ? Number(maxValue) : 16
            };
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
            const circle = refs.boardShapeSelect && refs.boardShapeSelect.value === 'circle';
            const bounds = circle
                ? { min: SharedBoardUtils.MIN_CIRCLE_BOARD_SIZE, max: SharedBoardUtils.MAX_CIRCLE_BOARD_SIZE }
                : getBoardDimensionBounds(axis);
            inputRef.min = String(bounds.min);
            inputRef.max = String(bounds.max);
            inputRef.step = String(circle ? SharedBoardUtils.CIRCLE_BOARD_SIZE_STEP : 1);
        }

        function syncCircleBoardSizeInputs(inputRef: any, commitInvalid: boolean) {
            if (!refs.boardShapeSelect || refs.boardShapeSelect.value !== 'circle') return true;
            const rawValue = Number(inputRef && inputRef.value);
            const min = Number(SharedBoardUtils.MIN_CIRCLE_BOARD_SIZE);
            const max = Number(SharedBoardUtils.MAX_CIRCLE_BOARD_SIZE);
            const step = Number(SharedBoardUtils.CIRCLE_BOARD_SIZE_STEP) || 2;
            const valid = Number.isInteger(rawValue) && rawValue >= min && rawValue <= max && (rawValue - min) % step === 0;
            if (!valid && !commitInvalid) return false;
            const fallback = getLocalBoardConfig();
            const normalized = SharedBoardUtils.normalizeCircleBoardSize(rawValue, fallback.rows);
            if (refs.boardSizeRowsInput) refs.boardSizeRowsInput.value = String(normalized);
            if (refs.boardSizeColsInput) refs.boardSizeColsInput.value = String(normalized);
            return true;
        }

        function updateLocalBoardConfigFromInputs() {
            const fallback = getLocalBoardConfig();
            updateLocalBoardConfig({
                shape: refs.boardShapeSelect ? refs.boardShapeSelect.value : fallback.shape,
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

        function normalizeDeckBuilderEffectText(text: any) {
            return String(text || '').replace(/\r\n?/g, '\n').trim();
        }

        function resolveDeckBuilderCardDetail(cardDef: any) {
            if (!cardDef || typeof cardDef !== 'object') return null;

            const cardId = String(cardDef.id || '').trim();
            const cardName = normalizeChoiceLabel(cardDef.name || cardDef.name_ja, cardId || 'カード');
            let descriptionTexts: any = null;

            try {
                if (CardInteractionEffectsModule && typeof CardInteractionEffectsModule.resolveCardDescriptionTexts === 'function') {
                    descriptionTexts = CardInteractionEffectsModule.resolveCardDescriptionTexts(cardDef, {
                        resolveChargeMaxText: () => '99',
                        quickTextMaxLength: 42
                    });
                }
            } catch (e: any) {
                descriptionTexts = null;
            }

            const fallbackDesc = normalizeDeckBuilderEffectText(cardDef.desc || cardDef.desc_ja || '');
            const quickText = normalizeDeckBuilderEffectText(
                descriptionTexts && descriptionTexts.quickText
                    ? descriptionTexts.quickText
                    : fallbackDesc
            ) || '効果説明は準備中';
            const distinctDetailText = normalizeDeckBuilderEffectText(descriptionTexts && descriptionTexts.distinctDetailText);
            const detailText = distinctDetailText || normalizeDeckBuilderEffectText(
                descriptionTexts && descriptionTexts.detailText
                    ? descriptionTexts.detailText
                    : fallbackDesc
            );

            return {
                cardId,
                cardName,
                quickText,
                detailText: detailText && detailText !== quickText ? detailText : '',
                effectTags: Array.isArray(descriptionTexts && descriptionTexts.effectTags)
                    ? descriptionTexts.effectTags
                    : []
            };
        }

        function getDefaultDeckSize() {
            return (DeckSpecHelpers && typeof DeckSpecHelpers.getDefaultDeckSize === 'function')
                ? DeckSpecHelpers.getDefaultDeckSize()
                : 30;
        }

        function getAllCardsDeckCardIds(): string[] {
            let cardIds: any[] = [];
            if (DeckSpecHelpers && typeof DeckSpecHelpers.getAllCardsDeckCardIds === 'function') {
                cardIds = DeckSpecHelpers.getAllCardsDeckCardIds();
            } else if (DeckSpecHelpers && typeof DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds === 'function') {
                cardIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();
            }
            return Array.from(new Set((Array.isArray(cardIds) ? cardIds : [])
                .map((cardId: any) => String(cardId || '').trim())
                .filter((cardId: string) => !!cardId)));
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

        function createAllCardsChoice(context: any) {
            const ctx = (context && typeof context === 'object') ? context : {};
            const deckCardIds = getAllCardsDeckCardIds();
            return {
                source: ctx.source || 'all-cards',
                mode: 'all-cards',
                name: normalizeChoiceLabel(ctx.name, '全カードデッキ'),
                deckCode: '',
                deckSpec: null,
                deckCardIds,
                deckSize: deckCardIds.length,
                presetId: ''
            };
        }

        function createCustomChoice(deckSpec: any, context: any) {
            const ctx = (context && typeof context === 'object') ? context : {};
            const normalizedSpec = DeckSpecHelpers.normalizeDeckSpec(deckSpec, { requireFullDeck: false });
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

        const CARD_DISPLAY_TYPE_KEY_MAP: Record<string, string> = Object.freeze({
            '採掘': 'mining',
            '守護': 'guard',
            '戦闘': 'battle',
            '執行': 'judgment',
            '禁忌': 'taboo',
            '殲滅': 'annihilation',
            '繁栄': 'prosperity',
            '特殊': 'special'
        });

        function getCardDisplayTypeKeyFromDef(cardDef: any): string {
            const label = String(
                (cardDef && cardDef.display_type_ja)
                || (cardDef && cardDef.displayTypeJa)
                || (cardDef && cardDef.displayTypeLabel)
                || ''
            ).trim();
            return CARD_DISPLAY_TYPE_KEY_MAP[label] || '';
        }

        function getCardDisplayTypeLabelFromDef(cardDef: any): string {
            const label = String(
                (cardDef && cardDef.display_type_ja)
                || (cardDef && cardDef.displayTypeJa)
                || (cardDef && cardDef.displayTypeLabel)
                || ''
            ).trim();
            return label;
        }

        function summarizeDeckTypeBreakdown(deckSpec: any) {
            const emptyResult = {
                dominantTypeKey: '',
                breakdown: [] as Array<{ typeKey: string; label: string; count: number; proportion: number }>
            };
            if (!deckSpec || typeof deckSpec !== 'object' || !Array.isArray(deckSpec.cards)) {
                return emptyResult;
            }

            const cardDefMap = (DeckSpecHelpers && typeof DeckSpecHelpers.getEnabledCardDefMap === 'function')
                ? DeckSpecHelpers.getEnabledCardDefMap()
                : new Map<string, any>();

            const typeStatsMap = new Map<string, { typeKey: string; label: string; count: number }>();
            let totalCount = 0;

            for (const entry of deckSpec.cards) {
                if (!entry || typeof entry !== 'object') continue;
                const cardId = String(entry.cardId || '').trim();
                const count = Math.max(0, Math.floor(Number(entry.count)));
                if (!cardId || count <= 0) continue;
                const def = cardDefMap.get(cardId);
                if (!def) continue;

                const typeKey = getCardDisplayTypeKeyFromDef(def);
                if (!typeKey) continue;
                const label = getCardDisplayTypeLabelFromDef(def) || typeKey;
                const existing = typeStatsMap.get(typeKey);
                if (existing) {
                    existing.count += count;
                } else {
                    typeStatsMap.set(typeKey, { typeKey, label, count });
                }
                totalCount += count;
            }

            const ordered = Array.from(typeStatsMap.values())
                .sort((left, right) => {
                    if (right.count !== left.count) return right.count - left.count;
                    return String(left.typeKey || '').localeCompare(String(right.typeKey || ''), 'en');
                });

            const breakdown = ordered.map((entry) => ({
                typeKey: entry.typeKey,
                label: entry.label,
                count: entry.count,
                proportion: totalCount > 0 ? entry.count / totalCount : 0
            }));

            const dominantTypeKey = ordered.length > 0 ? ordered[0].typeKey : '';
            return { dominantTypeKey, breakdown };
        }

        function createChoiceFromDeckCode(deckCode: any, context: any) {
            const deckSpec = decodeDeckSpecOrNull(deckCode);
            return deckSpec ? createCustomChoice(deckSpec, context) : null;
        }

        function getPresetDisplayName(preset: any, index: any) {
            const fallbackLabel = preset && preset.deckCode
                ? `保存スロット ${index + 1}`
                : `空きスロット ${index + 1}`;
            return normalizeChoiceLabel(preset && preset.name, fallbackLabel);
        }

        function getPresetSlotLabel(preset: any, index: any) {
            const slotName = preset && preset.deckCode
                ? `保存スロット ${index + 1}`
                : `空きスロット ${index + 1}`;
            const presetName = String(preset && preset.name || '').replace(/\s+/g, ' ').trim();
            return presetName ? `${slotName}（${presetName}）` : slotName;
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

        function findFirstEmptyPresetId() {
            const emptyPreset = state.presetState.presets.find((preset: any) => !preset || !preset.deckCode);
            return emptyPreset && emptyPreset.id ? emptyPreset.id : DeckPresetStorage.PRESET_IDS[0];
        }

        function savePresetState() {
            const result = DeckPresetStorage.trySaveState(state.presetState);
            if (!result.ok) {
                state.presetState = DeckPresetStorage.normalizeState(persistedPresetState);
                emitNotice('保存できませんでした。編集中のデッキは残っています。空き容量や保存設定を確認して再度お試しください', true, false);
                return false;
            }
            state.presetState = result.state;
            persistedPresetState = DeckPresetStorage.normalizeState(result.state);
            return true;
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
            if (optsLocal.persistActivePreset !== false) {
                state.presetState.activePresetId = choice && choice.presetId ? choice.presetId : '';
                if (!savePresetState()) return false;
            }
            state.activeLocalChoice = choice;
            syncUrlFromLocalChoice();
            if (optsLocal.syncNetworkDeck !== false) {
                syncNetworkDeckSelection(choice);
            }
            return true;
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

        function getNetworkDeckCodeForChoice(choice: any) {
            return choice && choice.mode === 'custom'
                ? String(choice.deckCode || '').trim()
                : '';
        }

        function syncNetworkDeckSelection(choice: any) {
            if (choice && choice.mode === 'all-cards') {
                return Promise.resolve({ ok: true, skipped: true, reason: 'ALL_CARDS_DECK_LOCAL_ONLY' });
            }
            const networkClient = resolveNetworkMatchClientForDeckBuilder('updateDeckSelection');
            if (!networkClient || typeof networkClient.updateDeckSelection !== 'function') {
                return Promise.resolve({ ok: true, skipped: true, reason: 'NO_NETWORK_CLIENT' });
            }
            if (typeof networkClient.isSpectator === 'function' && networkClient.isSpectator()) {
                return Promise.resolve({ ok: false, reason: 'SPECTATOR_READ_ONLY' });
            }

            const deckCode = getNetworkDeckCodeForChoice(choice);
            if (state.networkDeckSyncLatestDeckCode === deckCode && state.networkDeckSyncLatestPromise) {
                return state.networkDeckSyncLatestPromise;
            }

            const performSync = () => {
                state.networkDeckSyncBusy = true;
                return Promise.resolve(networkClient.updateDeckSelection(deckCode))
                    .then((result: any) => {
                        if (!result || result.ok !== true) {
                            const reason = result && result.reason ? String(result.reason) : '';
                            if (reason !== 'INACTIVE' && reason !== 'SPECTATOR_READ_ONLY') {
                                emitNotice('ネット対戦: デッキ同期に失敗しました', true, true);
                            }
                        }
                        render();
                        return result || { ok: false, reason: 'DECK_SYNC_FAILED' };
                    })
                    .catch(() => {
                        emitNotice('ネット対戦: デッキ同期に失敗しました', true, true);
                        render();
                        return { ok: false, reason: 'DECK_SYNC_FAILED' };
                    });
            };
            const queued = state.networkDeckSyncBusy
                ? Promise.resolve(state.networkDeckSyncChain).catch(() => null).then(performSync)
                : performSync();
            state.networkDeckSyncLatestDeckCode = deckCode;
            state.networkDeckSyncLatestPromise = queued;
            state.networkDeckSyncChain = queued;
            queued.finally(() => {
                if (state.networkDeckSyncChain === queued) {
                    state.networkDeckSyncBusy = false;
                }
                if (state.networkDeckSyncLatestPromise === queued) {
                    state.networkDeckSyncLatestPromise = null;
                }
            }).catch(() => null);
            return queued;
        }

        function syncActiveNetworkDeckSelection() {
            return syncNetworkDeckSelection(state.activeLocalChoice || createStandardChoice({ source: 'standard' }));
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

            setLocalActiveChoice(urlChoice, { persistActivePreset: false, syncNetworkDeck: false });
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

        function getLocalStoneSupplyEnabled() {
            return state.localStoneSupplyEnabled === true;
        }

        function setLocalStoneSupplyEnabled(enabled: any) {
            state.localStoneSupplyEnabled = enabled === true;
            renderBoardSizeControls();
        }

        function getLocalCpuDeckRule(): CpuDeckRule {
            return state.localCpuDeckRule;
        }

        function setLocalCpuDeckRule(rule: any) {
            state.localCpuDeckRule = normalizeCpuDeckRule(rule);
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
                return 'ネット対戦中は部屋で決めた盤面形状とサイズを使います';
            }
            if (readBoardConfig().shape === 'circle') return '円形は6〜16の偶数・正方形固定 / 次のリセットで反映';
            return '次のリセット / 新規対局で反映';
        }

        function renderBoardSizeControls() {
            const activeBoardConfig = readBoardConfig();
            const editableBoardConfig = resolveBoardConfigLockReason()
                ? activeBoardConfig
                : getLocalBoardConfig();
            const locked = !!resolveBoardConfigLockReason();
            const circle = editableBoardConfig.shape === 'circle';

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
            if (refs.boardShapeSelect) {
                refs.boardShapeSelect.value = circle ? 'circle' : 'rectangle';
                refs.boardShapeSelect.disabled = locked;
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
            if (refs.stoneSupplyCheckbox) {
                refs.stoneSupplyCheckbox.checked = state.localStoneSupplyEnabled;
                refs.stoneSupplyCheckbox.disabled = locked;
            }
            if (refs.boardSizeEditorNote) {
                refs.boardSizeEditorNote.textContent = buildBoardSizeNoteText();
                refs.boardSizeEditorNote.classList.toggle('is-room-override', resolveBoardConfigLockReason() === 'room');
            }
        }

        type NetworkMatchClientMethod = 'getRoomDeck' | 'getRoomBoardConfig' | 'updateDeckSelection';

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

        function resolveRoomDeckInitOptions(_roomDeck: any) {
            return {};
        }

        function readRoomDeckSpec(_roomDeck: any) {
            return null;
        }

        function getRoomDeckChoice() {
            const roomDeck = getRoomDeckMetadata();
            if (!roomDeck) return null;

            const fallbackChoice = createStandardChoice({ source: 'room', name: '部屋デッキ' });
            const roomDeckSpec = readRoomDeckSpec(roomDeck);
            const roomChoice = roomDeckSpec
                ? createCustomChoice(roomDeckSpec, {
                    source: 'room',
                    name: '部屋デッキ'
                })
                : null;
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

        function readCpuProfileValue(playerKey: string) {
            try {
                const doc = (rootRef && rootRef.document)
                    || (typeof document !== 'undefined' ? document : null);
                if (CpuProfileSelection && typeof CpuProfileSelection.readCpuProfileValueFromSelect === 'function') {
                    const value = String(CpuProfileSelection.readCpuProfileValueFromSelect(playerKey, doc) || '');
                    if (value) return value;
                }
            } catch (e: any) { /* ignore */ }
            try {
                const source = rootRef && rootRef.cpuSmartness && typeof rootRef.cpuSmartness === 'object'
                    ? rootRef.cpuSmartness
                    : null;
                if (source && typeof source[playerKey] !== 'undefined') {
                    return String(source[playerKey] || '');
                }
            } catch (e: any) { /* ignore */ }
            return '';
        }

        function resolveCpuStartupOptions(playerKey: string) {
            if (readCurrentMatchMode() !== 'cpu') return null;
            if (!CpuOpponentStartupOptions || typeof CpuOpponentStartupOptions.getCpuOpponentStartupOptions !== 'function') return null;
            return CpuOpponentStartupOptions.getCpuOpponentStartupOptions(readCpuProfileValue(playerKey), playerKey);
        }

        function resolveCpuDeckSpec(startupOptions: any) {
            if (!startupOptions || !startupOptions.deckCode) return null;
            if (!DeckCodecModule || typeof DeckCodecModule.decodeDeckCode !== 'function') return null;
            return DeckCodecModule.decodeDeckCode(startupOptions.deckCode);
        }

        function resolveCpuDeckCardIds(startupOptions: any) {
            const cardIds = startupOptions && Array.isArray(startupOptions.deckCardIds)
                ? startupOptions.deckCardIds
                : null;
            if (!cardIds || cardIds.length <= 0) return null;
            return cardIds
                .map((cardId: any) => String(cardId || '').trim())
                .filter((cardId: string) => !!cardId);
        }

        function resolveCpuInitialCharge(startupOptions: any) {
            const value = startupOptions && startupOptions.initialCharge;
            if (Number.isFinite(Number(value)) && Number(value) > 0) return Math.floor(Number(value));
            return null;
        }

        function resolveCpuChargeGainMultiplier(startupOptions: any) {
            const value = startupOptions && startupOptions.chargeGainMultiplier;
            if (Number.isFinite(Number(value)) && Number(value) > 1) return Math.floor(Number(value));
            return null;
        }

        function buildCpuDeckInitOptions(blackDeckSpec: any, blackDeckCardIds?: any) {
            const blackStartupOptions = resolveCpuStartupOptions('black');
            const whiteStartupOptions = resolveCpuStartupOptions('white');
            const profileBlackDeckCardIds = resolveCpuDeckCardIds(blackStartupOptions);
            const whiteDeckCardIds = resolveCpuDeckCardIds(whiteStartupOptions);
            const profileBlackDeckSpec = resolveCpuDeckSpec(blackStartupOptions);
            const whiteDeckSpec = resolveCpuDeckSpec(whiteStartupOptions);
            const localBlackDeckCardIds = Array.isArray(blackDeckCardIds)
                ? blackDeckCardIds.slice()
                : null;
            const initialDeckCardIdsByPlayer: any = {};
            const initialDeckSpecByPlayer: any = {};
            if (profileBlackDeckCardIds) initialDeckCardIdsByPlayer.black = profileBlackDeckCardIds;
            else if (profileBlackDeckSpec) initialDeckSpecByPlayer.black = profileBlackDeckSpec;
            else if (localBlackDeckCardIds) initialDeckCardIdsByPlayer.black = localBlackDeckCardIds;
            else if (blackDeckSpec) initialDeckSpecByPlayer.black = blackDeckSpec;
            if (whiteDeckCardIds) initialDeckCardIdsByPlayer.white = whiteDeckCardIds;
            else if (whiteDeckSpec) initialDeckSpecByPlayer.white = whiteDeckSpec;
            const initialChargeByPlayer: any = {};
            const blackInitialCharge = resolveCpuInitialCharge(blackStartupOptions);
            const whiteInitialCharge = resolveCpuInitialCharge(whiteStartupOptions);
            if (blackInitialCharge !== null) initialChargeByPlayer.black = blackInitialCharge;
            if (whiteInitialCharge !== null) initialChargeByPlayer.white = whiteInitialCharge;
            const chargeGainMultiplierByPlayer: any = {};
            const blackChargeGainMultiplier = resolveCpuChargeGainMultiplier(blackStartupOptions);
            const whiteChargeGainMultiplier = resolveCpuChargeGainMultiplier(whiteStartupOptions);
            if (blackChargeGainMultiplier !== null) chargeGainMultiplierByPlayer.black = blackChargeGainMultiplier;
            if (whiteChargeGainMultiplier !== null) chargeGainMultiplierByPlayer.white = whiteChargeGainMultiplier;
            const options: any = {};
            if (Object.keys(initialDeckCardIdsByPlayer).length > 0) {
                options.initialDeckCardIdsByPlayer = initialDeckCardIdsByPlayer;
            }
            if (Object.keys(initialDeckSpecByPlayer).length > 0) options.initialDeckSpecByPlayer = initialDeckSpecByPlayer;
            if (initialChargeByPlayer && Object.keys(initialChargeByPlayer).length > 0) {
                options.initialChargeByPlayer = initialChargeByPlayer;
            }
            if (chargeGainMultiplierByPlayer && Object.keys(chargeGainMultiplierByPlayer).length > 0) {
                options.chargeGainMultiplierByPlayer = chargeGainMultiplierByPlayer;
            }
            return options;
        }

        function buildCpuDeckRuleCardIds(rule: CpuDeckRule): string[] | null {
            if (rule === 'all-cards') {
                const cardIds = getAllCardsDeckCardIds();
                return cardIds.length > 0 ? cardIds : null;
            }
            if (rule === 'random-30') {
                try {
                    const draft = DeckBuilderStateModule.createRandomFullDraft(opts.randomSource);
                    return DeckBuilderStateModule.createExpandedCardIdsFromDraft(draft);
                } catch (e: any) {
                    return null;
                }
            }
            return null;
        }

        // CPU対戦の「盤面・ルール設定」で選んだ両者共通デッキ。山札順は黒白それぞれ別にシャッフルされ、
        // ランダム30枚は黒白それぞれ別に生成する。CPU固有の初期布石・獲得倍率はそのまま使う。
        function buildCpuDeckRuleInitOptions() {
            if (state.localCpuDeckRule === 'default' || readCurrentMatchMode() !== 'cpu') return null;
            const blackDeckCardIds = buildCpuDeckRuleCardIds(state.localCpuDeckRule);
            const whiteDeckCardIds = buildCpuDeckRuleCardIds(state.localCpuDeckRule);
            if (!blackDeckCardIds || !whiteDeckCardIds) return null;
            const options = buildCpuDeckInitOptions(null);
            delete options.initialDeckSpecByPlayer;
            options.initialDeckCardIdsByPlayer = {
                black: blackDeckCardIds,
                white: whiteDeckCardIds
            };
            return options;
        }

        function buildCardInitOptions() {
            const roomDeck = getRoomDeckMetadata();
            const baseOptions = {
                boardConfig: readBoardConfig(),
                stoneSupplyEnabled: state.localStoneSupplyEnabled
            };
            if (roomDeck) {
                return Object.assign(baseOptions, resolveRoomDeckInitOptions(roomDeck) || {});
            }

            const cpuDeckRuleOptions = buildCpuDeckRuleInitOptions();
            if (cpuDeckRuleOptions) {
                return Object.assign(baseOptions, cpuDeckRuleOptions);
            }

            const effective = getEffectiveChoice();
            if (effective.choice && effective.choice.mode === 'all-cards' && Array.isArray(effective.choice.deckCardIds)) {
                const deckCardIds = effective.choice.deckCardIds.slice();
                if (readCurrentMatchMode() === 'cpu') {
                    return Object.assign(baseOptions, buildCpuDeckInitOptions(null, deckCardIds));
                }
                return Object.assign(baseOptions, { initialDeckCardIds: deckCardIds });
            }
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
            if (targetChoice.mode === 'all-cards') {
                return `全カードデッキ / ${targetChoice.deckSize}枚`;
            }
            if (targetChoice.mode === 'custom') {
                return `${normalizeChoiceLabel(targetChoice.name, 'カスタムデッキ')} / ${targetChoice.deckSize}枚`;
            }
            return `デフォルトデッキ / ${targetChoice.deckSize}枚`;
        }

        function buildPresetViewModel() {
            return state.presetState.presets.map((preset: any, index: any) => {
                const slotNumberLabel = `No.${String(index + 1).padStart(2, '0')}`;
                if (!preset.deckCode) {
                    return {
                        id: preset.id,
                        displayName: '空きスロット',
                        summaryText: 'クリックして構築',
                        noteText: '',
                        noteIsError: false,
                        canUse: false,
                        isActive: false,
                        dominantTypeKey: '',
                        typeBreakdown: [],
                        slotNumberLabel,
                        isEmpty: true
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
                        isActive: false,
                        dominantTypeKey: '',
                        typeBreakdown: [],
                        slotNumberLabel,
                        isEmpty: false
                    };
                }

                const summary = DeckSpecHelpers.summarizeDeckSpec(deckSpec);
                const breakdown = summarizeDeckTypeBreakdown(deckSpec);
                const isActive = preset.id === state.presetState.activePresetId;
                return {
                    id: preset.id,
                    displayName: getPresetDisplayName(preset, index),
                    summaryText: `${summary.deckSize}枚 / ${summary.distinctCount}種`,
                    noteText: '',
                    noteIsError: false,
                    canUse: true,
                    isActive,
                    dominantTypeKey: breakdown.dominantTypeKey,
                    typeBreakdown: breakdown.breakdown,
                    deckSize: summary.deckSize,
                    distinctCount: summary.distinctCount,
                    slotNumberLabel,
                    isEmpty: false
                };
            });
        }

        function buildBuiltInPresetViewModel() {
            const presets = DeckSpecHelpers && typeof DeckSpecHelpers.getBuiltInDeckPresets === 'function'
                ? DeckSpecHelpers.getBuiltInDeckPresets()
                : [];
            return presets.map((preset: any) => {
                const deckSpec = decodeDeckSpecOrNull(preset && preset.deckCode);
                const presetId = String(preset && preset.id || '').trim();
                const displayName = normalizeChoiceLabel(preset && preset.displayName, '固定プリセット');
                if (!deckSpec) {
                    return {
                        id: presetId,
                        displayName,
                        summaryText: '読み込み不可',
                        noteText: 'catalog 変更などで無効です',
                        noteIsError: true,
                        canUse: false,
                        isActive: false,
                        dominantTypeKey: '',
                        typeBreakdown: []
                    };
                }

                const summary = DeckSpecHelpers.summarizeDeckSpec(deckSpec);
                const breakdown = summarizeDeckTypeBreakdown(deckSpec);
                const active = state.activeLocalChoice
                    && state.activeLocalChoice.source === 'built-in-preset'
                    && state.activeLocalChoice.presetId === presetId;
                return {
                    id: presetId,
                    displayName,
                    summaryText: `${summary.deckSize}枚 / ${summary.distinctCount}種`,
                    noteText: active ? '現在使用中' : '',
                    noteIsError: false,
                    canUse: true,
                    isActive: active,
                    dominantTypeKey: breakdown.dominantTypeKey,
                    typeBreakdown: breakdown.breakdown
                };
            });
        }

        function buildEditorViewModel() {
            const draftSummary = DeckBuilderStateModule.getDraftSummary(state.editor.draft);
            const editorPreset = findPresetById(state.editor.presetId);
            const presetOptions = state.presetState.presets.map((preset: any, index: any) => ({
                id: preset.id,
                label: getPresetSlotLabel(preset, index)
            }));
            const enabledCardDefs = DeckBuilderRendererModule.getEnabledCardDefs()
                .slice()
                .sort(compareCardDefsForDeckBuilder);
            const candidateCards = enabledCardDefs.map((cardDef: any) => {
                const selectedCount = DeckBuilderStateModule.getSelectedCount(state.editor.draft, cardDef.id);
                const maxCopies = typeof DeckBuilderStateModule.getMaxCopiesForCardId === 'function'
                    ? DeckBuilderStateModule.getMaxCopiesForCardId(cardDef.id)
                    : DeckSpecHelpers.MAX_DUPLICATES_PER_CARD;
                const willResetToZero = selectedCount >= maxCopies;
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
            const detailCardId = String(state.editor.detailCardId || '').trim();
            const detailCardDef = detailCardId
                ? enabledCardDefs.find((cardDef: any) => String(cardDef && cardDef.id || '') === detailCardId)
                : null;

            return {
                titleText: state.editor.sourceName
                    ? `${normalizeChoiceLabel(state.editor.sourceName, '固定プリセット')} を編集`
                    : normalizeChoiceLabel(editorPreset && editorPreset.name, 'プリセット編集'),
                destinationPresetId: state.editor.presetId,
                presetOptions,
                nameValue: state.editor.nameValue,
                summaryText: `${draftSummary.totalCount}/${DeckSpecHelpers.CUSTOM_DECK_SIZE}枚 ・ 残り${draftSummary.remainingCount}枚`,
                canSave: true,
                canUse: true,
                canCopy: true,
                codeInputValue: state.editor.codeInputValue,
                detailCard: resolveDeckBuilderCardDetail(detailCardDef),
                selectedCards,
                candidateCards
            };
        }

        function buildHeaderSummaryText() {
            if (state.view === 'editor') {
                const draftSummary = DeckBuilderStateModule.getDraftSummary(state.editor.draft);
                return `編集中: ${draftSummary.totalCount}/${DeckSpecHelpers.CUSTOM_DECK_SIZE}枚`;
            }
            return `ローカル設定: ${formatLocalChoiceSummary(state.activeLocalChoice)}`;
        }

        function buildViewModel() {
            const effective = getEffectiveChoice();
            return {
                overlayOpen: state.overlayOpen,
                view: state.view,
                roomOverrideActive: effective.roomOverrideActive,
                controlSummaryText: formatLocalChoiceSummary(state.activeLocalChoice),
                headerSummaryText: buildHeaderSummaryText(),
                noticeText: state.noticeText,
                noticeIsError: state.noticeIsError,
                standardSummaryText: `${getDefaultDeckSize()}枚 / 有効カードから重複なしランダム`,
                allCardsDeckSize: getAllCardsDeckCardIds().length,
                allCardsDeckActive: !!(state.activeLocalChoice && state.activeLocalChoice.mode === 'all-cards'),
                builtInPresets: buildBuiltInPresetViewModel(),
                presets: buildPresetViewModel(),
                editor: buildEditorViewModel()
            };
        }

        function buildShellViewModel() {
            const effective = getEffectiveChoice();
            return {
                overlayOpen: state.overlayOpen,
                roomOverrideActive: effective.roomOverrideActive,
                controlSummaryText: formatLocalChoiceSummary(state.activeLocalChoice),
                headerSummaryText: buildHeaderSummaryText()
            };
        }

        function render(optionsOverride?: any) {
            const renderOptions = (optionsOverride && typeof optionsOverride === 'object') ? optionsOverride : {};
            const viewModel = refs.body ? buildViewModel() : buildShellViewModel();
            DeckBuilderRendererModule.renderDeckBuilder(refs, viewModel, {
                onUseStandard: useStandardDeck,
                onUseAllCards: useAllCardsDeck,
                onUseBuiltInPreset: useBuiltInDeckPreset,
                onUsePreset: usePreset,
                onEditPreset: editPreset,
                onEditBuiltInPreset: editBuiltInDeckPreset,
                onEditorDestinationChange: function (presetId: any) {
                    if (findPresetById(presetId)) {
                        state.editor.presetId = String(presetId || '').trim();
                    }
                },
                onEditorBack: backToPresetList,
                onEditorNameInput: function (value: any) {
                    state.editor.nameValue = String(value || '');
                },
                onEditorCodeInput: function (value: any) {
                    state.editor.codeInputValue = String(value || '');
                },
                onEditorAddCard: addCardToEditor,
                onEditorRemoveCard: removeCardFromEditor,
                onEditorShowCardDetail: showEditorCardDetail,
                onEditorCloseCardDetail: closeEditorCardDetail,
                onEditorImportCode: importEditorCode,
                onEditorRandomize: randomizeEditorDraft,
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
            const deckSpec = DeckBuilderStateModule.createDeckSpecFromDraft(state.editor.draft);
            state.editor.codeInputValue = DeckCodecModule.encodeDeckSpec(deckSpec);
        }

        function openReadySurface() {
            clearNotice();
            state.overlayOpen = true;
            state.view = 'presets';
            render();
        }

        function open() {
            if (!refs.body && ensureSurface) {
                if (!surfaceReadyPromise) {
                    surfaceReadyPromise = Promise.resolve(ensureSurface())
                        .finally(() => {
                            surfaceReadyPromise = null;
                        });
                }
                void surfaceReadyPromise
                    .then(() => {
                        if (refs.body) openReadySurface();
                    })
                    .catch(() => undefined);
                return;
            }
            try {
                if (
                    !ensureSurface
                    && featureStylesheetLoader
                    && typeof featureStylesheetLoader.ensureFeatureStylesheet === 'function'
                ) {
                    void featureStylesheetLoader.ensureFeatureStylesheet(
                        'deck-builder',
                        rootRef && rootRef.document
                    );
                }
            } catch (e) { /* fallback styling must not block the panel */ }
            openReadySurface();
        }

        function close() {
            const wasOpen = state.overlayOpen;
            state.overlayOpen = false;
            render();
            if (wasOpen && refs.openBtn && typeof refs.openBtn.focus === 'function') {
                try { refs.openBtn.focus({ preventScroll: true }); } catch (_error) { /* detached/legacy host */ }
            }
        }

        function useStandardDeck() {
            if (setLocalActiveChoice(createStandardChoice({ source: 'standard' }))) clearNotice();
            render();
        }

        function useAllCardsDeck() {
            const choice = createAllCardsChoice({ source: 'all-cards' });
            if (!choice.deckCardIds.length) {
                emitNotice('全カードデッキを作れませんでした', true, false);
                render();
                return;
            }

            const networkMatchActive = !!resolveNetworkMatchClientForDeckBuilder('updateDeckSelection');
            if (!setLocalActiveChoice(choice)) { render(); return; }
            if (networkMatchActive) {
                emitNotice('全カードデッキはローカル対戦用に設定しました。ネット対戦では部屋作成時の「両者全カードデッキ」を使います。', false, false);
            } else {
                clearNotice();
            }
            render();
        }

        function useBuiltInDeckPreset(presetId: any) {
            const normalizedPresetId = String(presetId || '').trim();
            const presets = DeckSpecHelpers && typeof DeckSpecHelpers.getBuiltInDeckPresets === 'function'
                ? DeckSpecHelpers.getBuiltInDeckPresets()
                : [];
            const preset = presets.find((candidate: any) => String(candidate && candidate.id || '') === normalizedPresetId);
            if (!preset || !preset.deckCode) {
                emitNotice('この固定プリセットは現在使えません', true, false);
                render();
                return;
            }

            const displayName = normalizeChoiceLabel(preset.displayName, '固定プリセット');
            const choice = createChoiceFromDeckCode(preset.deckCode, {
                source: 'built-in-preset',
                name: displayName,
                presetId: normalizedPresetId
            });
            if (!choice) {
                emitNotice('この固定プリセットは現在の catalog では使えません', true, false);
                render();
                return;
            }

            if (setLocalActiveChoice(choice)) clearNotice();
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

            if (setLocalActiveChoice(presetChoice)) clearNotice();
            render();
        }

        function editPreset(presetId: any) {
            const preset = findPresetById(presetId);
            state.editor.presetId = presetId;
            state.editor.sourceName = '';
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

            state.editor.detailCardId = '';
            state.view = 'editor';
            render();
        }

        function editBuiltInDeckPreset(presetId: any) {
            const normalizedPresetId = String(presetId || '').trim();
            const presets = DeckSpecHelpers && typeof DeckSpecHelpers.getBuiltInDeckPresets === 'function'
                ? DeckSpecHelpers.getBuiltInDeckPresets()
                : [];
            const preset = presets.find((candidate: any) => String(candidate && candidate.id || '') === normalizedPresetId);
            const displayName = normalizeChoiceLabel(preset && preset.displayName, '固定プリセット');
            if (!preset || !preset.deckCode) {
                emitNotice('この固定プリセットは現在編集できません', true, false);
                render();
                return;
            }

            const deckSpec = decodeDeckSpecOrNull(preset.deckCode);
            if (!deckSpec) {
                emitNotice('この固定プリセットは現在の catalog では編集できません', true, false);
                render();
                return;
            }

            state.editor.presetId = findFirstEmptyPresetId();
            state.editor.sourceName = displayName;
            state.editor.nameValue = displayName;
            state.editor.draft = DeckBuilderStateModule.createDraftFromDeckSpec(deckSpec);
            state.editor.codeInputValue = DeckCodecModule.encodeDeckSpec(deckSpec);
            state.editor.detailCardId = '';
            state.view = 'editor';
            render();
        }

        function backToPresetList() {
            state.editor.detailCardId = '';
            state.editor.sourceName = '';
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

        function showEditorCardDetail(cardId: any, event: any, gridClassName: any) {
            const normalizedCardId = String(cardId || '').trim();
            if (!normalizedCardId) return;
            state.editor.detailCardId = normalizedCardId;
            renderPreservingEditorScroll(buildEditorCardAnchorOptions(
                normalizedCardId,
                event,
                gridClassName || 'deck-builder-candidate-grid'
            ));
        }

        function closeEditorCardDetail() {
            state.editor.detailCardId = '';
            renderPreservingEditorScroll();
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

        function randomizeEditorDraft() {
            try {
                state.editor.draft = DeckBuilderStateModule.createRandomFullDraft(opts.randomSource);
                state.editor.detailCardId = '';
                syncEditorCodeFromDraft();
                emitNotice('30枚のランダムデッキを生成しました（未保存）', false, false);
            } catch (e: any) {
                emitNotice('ランダムデッキを生成できませんでした', true, false);
            }
            renderPreservingEditorScroll();
        }

        function writePresetFromEditor() {
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
            if (!savePresetState()) return null;
            return deckCode;
        }

        function saveEditorPreset() {
            if (writePresetFromEditor() !== null) emitNotice('プリセットを保存しました', false, false);
            renderPreservingEditorScroll();
        }

        function useEditorDraft() {
            if (writePresetFromEditor() === null) {
                renderPreservingEditorScroll();
                return;
            }
            usePreset(state.editor.presetId);
            state.view = 'presets';
            render();
        }

        async function copyEditorCode() {
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

        function bindStaticEvents(context?: any) {
            if (refs.openBtn && refs.openBtn.dataset.deckBuilderBound !== '1') {
                refs.openBtn.addEventListener('click', open);
                refs.openBtn.dataset.deckBuilderBound = '1';
                context?.recordListenerBinding?.();
            }

            if (refs.closeBtn && refs.closeBtn.dataset.deckBuilderBound !== '1') {
                refs.closeBtn.addEventListener('click', close);
                refs.closeBtn.dataset.deckBuilderBound = '1';
                context?.recordListenerBinding?.();
            }

            if (refs.overlay && refs.overlay.dataset.deckBuilderBound !== '1') {
                refs.overlay.addEventListener('click', (event: any) => {
                    if (event && event.target === refs.overlay) {
                        close();
                    }
                });
                refs.overlay.dataset.deckBuilderBound = '1';
                context?.recordListenerBinding?.();
            }

            if (refs.boardSizeOpenBtn && refs.boardSizeOpenBtn.dataset.boardSizeBound !== '1') {
                refs.boardSizeOpenBtn.addEventListener('click', () => {
                    state.boardSizeEditorOpen = !state.boardSizeEditorOpen;
                    renderBoardSizeControls();
                });
                refs.boardSizeOpenBtn.dataset.boardSizeBound = '1';
                context?.recordListenerBinding?.();
            }

            if (refs.boardSizeCloseBtn && refs.boardSizeCloseBtn.dataset.boardSizeBound !== '1') {
                refs.boardSizeCloseBtn.addEventListener('click', () => {
                    state.boardSizeEditorOpen = false;
                    renderBoardSizeControls();
                });
                refs.boardSizeCloseBtn.dataset.boardSizeBound = '1';
                context?.recordListenerBinding?.();
            }

            const bindBoardSizeInput = (inputRef: any, axis: any) => {
                if (!inputRef || inputRef.dataset.boardSizeBound === '1') return;
                const onBoardSizeInput = (event: any) => {
                    if (resolveBoardConfigLockReason()) {
                        renderBoardSizeControls();
                        return;
                    }
                    // Keep incomplete digits editable; normalize only when the edit is committed.
                    if (event && event.type === 'input'
                        && (!String(inputRef.value || '').trim() || inputRef.validity?.valid === false)) return;
                    if (!syncCircleBoardSizeInputs(inputRef, event && event.type === 'change')) return;
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
                    const direction = primaryDelta < 0 ? 1 : -1;
                    inputRef.value = String(refs.boardShapeSelect && refs.boardShapeSelect.value === 'circle'
                        ? SharedBoardUtils.normalizeCircleBoardSize(Number(inputRef.value) + direction * SharedBoardUtils.CIRCLE_BOARD_SIZE_STEP, fallbackValue)
                        : stepBoardDimensionValue(inputRef.value, direction, fallbackValue, axis));
                    syncCircleBoardSizeInputs(inputRef, true);
                    if (event && event.cancelable) event.preventDefault();
                    updateLocalBoardConfigFromInputs();
                }, { passive: false });
                inputRef.dataset.boardSizeBound = '1';
                context?.recordListenerBinding?.(3);
            };

            bindBoardSizeInput(refs.boardSizeRowsInput, 'row');
            bindBoardSizeInput(refs.boardSizeColsInput, 'col');
            if (refs.boardShapeSelect && refs.boardShapeSelect.dataset.boardShapeBound !== '1') {
                refs.boardShapeSelect.addEventListener('change', () => {
                    if (resolveBoardConfigLockReason()) {
                        renderBoardSizeControls();
                        return;
                    }
                    updateLocalBoardConfigFromInputs();
                });
                refs.boardShapeSelect.dataset.boardShapeBound = '1';
                context?.recordListenerBinding?.();
            }

            if (refs.stoneSupplyCheckbox && refs.stoneSupplyCheckbox.dataset.boardSizeBound !== '1') {
                refs.stoneSupplyCheckbox.addEventListener('change', () => {
                    if (!resolveBoardConfigLockReason()) {
                        state.localStoneSupplyEnabled = refs.stoneSupplyCheckbox.checked === true;
                    }
                    renderBoardSizeControls();
                });
                refs.stoneSupplyCheckbox.dataset.boardSizeBound = '1';
            }

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
                context?.recordListenerBinding?.();
            }
        }

        function attachSurfaceRefs(nextRefs: any, context?: any) {
            const next = (nextRefs && typeof nextRefs === 'object') ? nextRefs : {};
            if (!next.closeBtn || !next.headerSummary || !next.body) {
                throw new Error('Deck builder inner surface refs are incomplete');
            }
            refs.closeBtn = next.closeBtn;
            refs.headerSummary = next.headerSummary;
            refs.body = next.body;
            bindStaticEvents(context);
            render();
            return Object.freeze({
                closeBtn: refs.closeBtn,
                headerSummary: refs.headerSummary,
                body: refs.body
            });
        }

        function detachSurfaceRefs(expectedRefs?: any) {
            const expected = expectedRefs && typeof expectedRefs === 'object'
                ? expectedRefs
                : null;
            if (expected && (
                (expected.closeBtn && refs.closeBtn !== expected.closeBtn)
                || (expected.headerSummary && refs.headerSummary !== expected.headerSummary)
                || (expected.body && refs.body !== expected.body)
            )) {
                return false;
            }
            state.overlayOpen = false;
            refs.closeBtn = null;
            refs.headerSummary = null;
            refs.body = null;
            render();
            return true;
        }

        const api = {
            open,
            close,
            render,
            attachSurfaceRefs,
            detachSurfaceRefs,
            buildCardInitOptions,
            readActiveDeckSpec,
            syncActiveNetworkDeckSelection,
            readBoardConfig,
            getLocalBoardConfig,
            setLocalBoardConfig: updateLocalBoardConfig,
            getLocalStoneSupplyEnabled,
            setLocalStoneSupplyEnabled,
            getLocalCpuDeckRule,
            setLocalCpuDeckRule,
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
