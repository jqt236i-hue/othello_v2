(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../shared/deck-spec'),
            require('../shared/deck-codec'),
            require('./storage/deck-presets'),
            require('./deck-builder-state'),
            require('./deck-builder-renderer')
        );
    } else {
        root.DeckBuilderControllerModule = factory(
            root.DeckSpecHelpers,
            root.DeckCodecModule,
            root.DeckPresetStorage,
            root.DeckBuilderStateModule,
            root.DeckBuilderRendererModule
        );
    }
}(typeof self !== 'undefined' ? self : this, function (
    DeckSpecHelpers,
    DeckCodecModule,
    DeckPresetStorage,
    DeckBuilderStateModule,
    DeckBuilderRendererModule
) {
    'use strict';

    function ensureDependencies() {
        if (!DeckSpecHelpers || !DeckCodecModule || !DeckPresetStorage || !DeckBuilderStateModule || !DeckBuilderRendererModule) {
            throw new Error('Deck builder dependencies are missing');
        }
    }

    function createDeckBuilderController(options) {
        ensureDependencies();

        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
        const refs = Object.assign({
            openBtn: null,
            controlSummary: null,
            overlay: null,
            closeBtn: null,
            headerSummary: null,
            body: null
        }, opts.refs || {});

        const state = {
            overlayOpen: false,
            view: 'presets',
            noticeText: '',
            noticeIsError: false,
            presetState: DeckPresetStorage.loadState(),
            activeLocalChoice: null,
            editor: {
                presetId: '',
                nameValue: '',
                draft: DeckBuilderStateModule.createEmptyDraft(),
                codeInputValue: ''
            }
        };

        function normalizeChoiceLabel(name, fallback) {
            const normalized = String(name || '').replace(/\s+/g, ' ').trim();
            return normalized || fallback;
        }

        function compareCardDefsForDeckBuilder(left, right) {
            const leftDef = (left && typeof left === 'object') ? left : {};
            const rightDef = (right && typeof right === 'object') ? right : {};
            const leftCost = Number(leftDef.cost) || 0;
            const rightCost = Number(rightDef.cost) || 0;
            if (leftCost !== rightCost) {
                return rightCost - leftCost;
            }
            return String(leftDef.id || '').localeCompare(String(rightDef.id || ''), 'en');
        }

        function createStandardChoice(context) {
            const ctx = (context && typeof context === 'object') ? context : {};
            return {
                source: ctx.source || 'standard',
                mode: 'standard',
                name: normalizeChoiceLabel(ctx.name, '標準デッキ'),
                deckCode: '',
                deckSpec: null,
                deckSize: DeckSpecHelpers.getStandardDeckSize(),
                presetId: ctx.presetId || ''
            };
        }

        function createCustomChoice(deckSpec, context) {
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

        function decodeDeckSpecOrNull(deckCode) {
            const decoded = DeckCodecModule.safeDecodeDeckCode(deckCode);
            return decoded.ok ? decoded.deckSpec : null;
        }

        function createChoiceFromDeckCode(deckCode, context) {
            const deckSpec = decodeDeckSpecOrNull(deckCode);
            return deckSpec ? createCustomChoice(deckSpec, context) : null;
        }

        function getPresetDisplayName(preset, index) {
            return normalizeChoiceLabel(preset && preset.name, `プリセット ${index + 1}`);
        }

        function getPresetIndex(preset) {
            const index = DeckPresetStorage.PRESET_IDS.indexOf(preset && preset.id);
            return index >= 0 ? index : 0;
        }

        function getPresetChoiceName(preset) {
            return getPresetDisplayName(preset, getPresetIndex(preset));
        }

        function findPresetById(presetId) {
            return state.presetState.presets.find((preset) => preset.id === presetId) || null;
        }

        function savePresetState() {
            state.presetState = DeckPresetStorage.saveState(state.presetState);
        }

        function emitNotice(text, isError, alsoLog) {
            state.noticeText = String(text || '').trim();
            state.noticeIsError = !!isError;
            if (alsoLog && state.noticeText && typeof rootRef.addLog === 'function') {
                try {
                    rootRef.addLog(state.noticeText);
                } catch (e) { /* ignore */ }
            }
        }

        function clearNotice() {
            state.noticeText = '';
            state.noticeIsError = false;
        }

        function setLocalActiveChoice(choice, optionsOverride) {
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
                emitNotice('保存済みデッキを読み込めなかったため標準デッキを使います', true, true);
                return;
            }

            state.activeLocalChoice = presetChoice;
        }

        function readDeckParamFromLocation() {
            try {
                if (!rootRef.location || !rootRef.location.search) return '';
                const params = new URLSearchParams(rootRef.location.search);
                return String(params.get('deck') || '').trim();
            } catch (e) {
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
            } catch (e) { /* ignore */ }
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
                if (!rootRef.NetworkMatchClient || typeof rootRef.NetworkMatchClient.getRoomDeck !== 'function') return null;
                if (typeof rootRef.NetworkMatchClient.isActive === 'function' && !rootRef.NetworkMatchClient.isActive()) return null;
                const roomDeck = rootRef.NetworkMatchClient.getRoomDeck();
                return (roomDeck && typeof roomDeck === 'object') ? roomDeck : null;
            } catch (e) {
                return null;
            }
        }

        function readNetworkSeatKey() {
            try {
                if (rootRef.NetworkMatchClient && typeof rootRef.NetworkMatchClient.getSeatKey === 'function') {
                    const seatKey = String(rootRef.NetworkMatchClient.getSeatKey() || '').trim().toLowerCase();
                    if (seatKey === 'white') return 'white';
                }
            } catch (e) { /* ignore */ }
            return 'black';
        }

        function resolveRoomDeckInitOptions(roomDeck) {
            if (!roomDeck || typeof roomDeck !== 'object') return null;

            const deckCodeByPlayer = (roomDeck.deckCodeByPlayer && typeof roomDeck.deckCodeByPlayer === 'object')
                ? roomDeck.deckCodeByPlayer
                : null;
            if (deckCodeByPlayer && (roomDeck.mode === 'perPlayer' || deckCodeByPlayer.black || deckCodeByPlayer.white)) {
                const initialDeckSpecByPlayer = {};
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

        function readRoomDeckSpec(roomDeck) {
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
            } catch (e) { /* ignore */ }

            try {
                if (rootRef.MatchMode && typeof rootRef.MatchMode.getCurrentMode === 'function') {
                    const mode = String(rootRef.MatchMode.getCurrentMode() || '').trim();
                    if (mode) return mode;
                }
            } catch (e) { /* ignore */ }

            const fallbackMode = String(rootRef.MATCH_MODE || rootRef.__MATCH_MODE || '').trim();
            return fallbackMode || 'cpu';
        }

        function buildCardInitOptions() {
            const roomDeck = getRoomDeckMetadata();
            if (roomDeck) {
                return resolveRoomDeckInitOptions(roomDeck) || {};
            }

            const effective = getEffectiveChoice();
            if (effective.choice && effective.choice.mode === 'custom' && effective.choice.deckSpec) {
                if (effective.roomOverrideActive) {
                    return { initialDeckSpec: effective.choice.deckSpec };
                }
                if (readCurrentMatchMode() === 'cpu') {
                    return {
                        initialDeckSpecByPlayer: {
                            black: effective.choice.deckSpec
                        }
                    };
                }
                return { initialDeckSpec: effective.choice.deckSpec };
            }
            return {};
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
                readActiveDeckSpec
            };

            try {
                rootRef.__uiImpl_turn_manager = Object.assign({}, rootRef.__uiImpl_turn_manager || {}, payload);
            } catch (e) { /* ignore */ }

            try {
                if (typeof globalThis !== 'undefined') {
                    globalThis.__uiImpl_turn_manager = Object.assign({}, globalThis.__uiImpl_turn_manager || {}, payload);
                }
            } catch (e) { /* ignore */ }

            try {
                if (rootRef.UIBootstrap && typeof rootRef.UIBootstrap.registerUIGlobals === 'function') {
                    rootRef.UIBootstrap.registerUIGlobals({ DeckBuilderController: api });
                }
            } catch (e) { /* ignore */ }
        }

        function formatLocalChoiceSummary(choice) {
            const targetChoice = choice || createStandardChoice({ source: 'standard' });
            if (targetChoice.mode === 'custom') {
                return `${normalizeChoiceLabel(targetChoice.name, 'カスタムデッキ')} / ${targetChoice.deckSize}枚`;
            }
            return `標準デッキ / ${targetChoice.deckSize}枚`;
        }

        function formatEffectiveChoiceSummary(effective) {
            if (!effective.roomOverrideActive) {
                return `実対局に使うデッキ: ${formatLocalChoiceSummary(effective.choice)}`;
            }

            if (effective.choice.mode === 'custom') {
                return `実対局に使うデッキ: 部屋デッキ / ${effective.choice.deckSize}枚（退出後はローカル設定へ戻ります）`;
            }
            return `実対局に使うデッキ: 部屋デッキ / 標準デッキ（退出後はローカル設定へ戻ります）`;
        }

        function buildPresetViewModel() {
            return state.presetState.presets.map((preset, index) => {
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
                .map((cardDef) => {
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
                .sort((left, right) => compareCardDefsForDeckBuilder(left.cardDef, right.cardDef));

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
                standardSummaryText: `${DeckSpecHelpers.getStandardDeckSize()}枚 / 有効カード各1枚`,
                presets: buildPresetViewModel(),
                editor: buildEditorViewModel()
            };
        }

        function render(optionsOverride) {
            const renderOptions = (optionsOverride && typeof optionsOverride === 'object') ? optionsOverride : {};
            DeckBuilderRendererModule.renderDeckBuilder(refs, buildViewModel(), {
                onUseStandard: useStandardDeck,
                onUsePreset: usePreset,
                onEditPreset: editPreset,
                onEditorBack: backToPresetList,
                onEditorNameInput: function (value) {
                    state.editor.nameValue = String(value || '');
                },
                onEditorCodeInput: function (value) {
                    state.editor.codeInputValue = String(value || '');
                },
                onEditorAddCard: addCardToEditor,
                onEditorRemoveCard: removeCardFromEditor,
                onEditorImportCode: importEditorCode,
                onEditorSave: saveEditorPreset,
                onEditorUse: useEditorDraft,
                onEditorCopyCode: copyEditorCode
            }, renderOptions);
        }

        function renderPreservingEditorScroll() {
            const renderOptions = (arguments.length > 0 && arguments[0] && typeof arguments[0] === 'object')
                ? arguments[0]
                : {};
            render(Object.assign({ preserveBodyScroll: state.view === 'editor' }, renderOptions));
        }

        function escapeCardIdForSelector(cardId) {
            return String(cardId || '')
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"');
        }

        function buildEditorCardAnchorOptions(cardId, event, gridClassName) {
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
            emitNotice('標準デッキへ切り替えました', false, true);
            render();
        }

        function usePreset(presetId) {
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

        function editPreset(presetId) {
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

        function addCardToEditor(cardId, event) {
            state.editor.draft = DeckBuilderStateModule.advanceCardSelection(state.editor.draft, cardId);
            syncEditorCodeFromDraft();
            renderPreservingEditorScroll(buildEditorCardAnchorOptions(cardId, event, 'deck-builder-candidate-grid'));
        }

        function removeCardFromEditor(cardId, event) {
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

            state.presetState.presets = state.presetState.presets.map((preset) => {
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
            } catch (e) {
                emitNotice('30枚そろえると保存できます', true, false);
            }
            renderPreservingEditorScroll();
        }

        function useEditorDraft() {
            try {
                writePresetFromEditor();
            } catch (e) {
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
            } catch (e) {
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
                refs.overlay.addEventListener('click', (event) => {
                    if (event && event.target === refs.overlay) {
                        close();
                    }
                });
                refs.overlay.dataset.deckBuilderBound = '1';
            }

            if (rootRef && typeof rootRef.addEventListener === 'function' && !rootRef.__deckBuilderEscBound) {
                rootRef.addEventListener('keydown', (event) => {
                    if (!state.overlayOpen) return;
                    if (event && event.key === 'Escape') {
                        event.preventDefault();
                        close();
                    }
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

    return {
        createDeckBuilderController
    };
}));