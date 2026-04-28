'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const StoryDeckSpecHelpers = _require('../../shared/story-deck-spec');
const StoryDeckCodecModule = _require('../../shared/story-deck-codec');
const StoryDeckLabStateModule = _require('./story-deck-lab-state');
const StoryDeckLabRendererModule = _require('./story-deck-lab-renderer');

if (!StoryDeckSpecHelpers || !StoryDeckCodecModule || !StoryDeckLabStateModule || !StoryDeckLabRendererModule) {
  throw new Error('Story deck lab dependencies are missing');
}

const STORAGE_KEY = 'story_deck_lab_draft_v1';

function loadDraft(rootRef: any): any {
  const storage = rootRef && rootRef.localStorage;
  if (!storage || typeof storage.getItem !== 'function') {
    return StoryDeckLabStateModule.createEmptyDraft();
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return StoryDeckLabStateModule.createEmptyDraft();
    return StoryDeckLabStateModule.normalizeDraft(JSON.parse(raw));
  } catch (e) {
    return StoryDeckLabStateModule.createEmptyDraft();
  }
}

function saveDraft(rootRef: any, draft: any): void {
  const storage = rootRef && rootRef.localStorage;
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(StoryDeckLabStateModule.normalizeDraft(draft)));
  } catch (e) { /* ignore */ }
}

function setNotice(state: any, text: string, isError?: boolean): void {
  state.noticeText = String(text || '').trim();
  state.noticeIsError = !!isError;
}

function clearNotice(state: any): void {
  state.noticeText = '';
  state.noticeIsError = false;
}

function trySyncCodeFromDraft(state: any, silent?: boolean): boolean {
  const summary = StoryDeckLabStateModule.getDraftSummary(state.draft);
  if (!summary.canExport) {
    state.codeInputValue = '';
    if (!silent) {
      setNotice(state, `コードは ${summary.deckSize} 枚そろうと生成できます`, true);
    }
    return false;
  }
  try {
    const deckSpec = StoryDeckLabStateModule.createStoryDeckSpecFromDraft(state.draft);
    state.codeInputValue = StoryDeckCodecModule.encodeStoryDeckSpec(deckSpec);
    if (!silent) {
      setNotice(state, 'storyDeckCode を更新しました', false);
    }
    return true;
  } catch (error: any) {
    setNotice(state, error && error.message ? error.message : 'storyDeckCode の更新に失敗しました', true);
    return false;
  }
}

async function copyText(rootRef: any, text: string, fallbackElement: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    if (rootRef.navigator && rootRef.navigator.clipboard && typeof rootRef.navigator.clipboard.writeText === 'function') {
      await rootRef.navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* ignore */ }

  if (!fallbackElement || typeof fallbackElement.select !== 'function') {
    return false;
  }

  try {
    fallbackElement.focus();
    fallbackElement.select();
    fallbackElement.setSelectionRange(0, text.length);
    return typeof document !== 'undefined' && typeof document.execCommand === 'function'
      ? document.execCommand('copy')
      : false;
  } catch (e) {
    return false;
  }
}

function compareCardDefs(left: any, right: any): number {
  const leftCost = Number(left && left.cost) || 0;
  const rightCost = Number(right && right.cost) || 0;
  if (leftCost !== rightCost) return rightCost - leftCost;
  const leftName = String((left && (left.name || left.name_ja)) || '');
  const rightName = String((right && (right.name || right.name_ja)) || '');
  const byName = leftName.localeCompare(rightName, 'ja');
  if (byName !== 0) return byName;
  return String(left && left.id || '').localeCompare(String(right && right.id || ''), 'en');
}

function buildViewModel(state: any): any {
  const normalizedDraft = StoryDeckLabStateModule.normalizeDraft(state.draft);
  const summary = StoryDeckLabStateModule.getDraftSummary(normalizedDraft);
  const ruleSet = StoryDeckSpecHelpers.getRuleSet(normalizedDraft.ruleSetId);
  const allCardDefs = StoryDeckSpecHelpers.getEnabledCardDefs().slice().sort(compareCardDefs);
  const query = String(state.searchText || '').trim().toLowerCase();

  const filteredDefs = !query
    ? allCardDefs
    : allCardDefs.filter((cardDef: any) => {
      const haystacks = [
        cardDef.id,
        cardDef.name,
        cardDef.name_ja,
        cardDef.type,
        cardDef.desc,
        cardDef.desc_ja
      ];
      return haystacks.some((value) => String(value || '').toLowerCase().includes(query));
    });

  return {
    ruleSetId: normalizedDraft.ruleSetId,
    ruleSetDescription: ruleSet ? ruleSet.description : '',
    searchText: state.searchText,
    summary,
    noticeText: state.noticeText,
    noticeIsError: state.noticeIsError,
    codeValue: String(state.codeInputValue || ''),
    codePlaceholder: summary.canExport
      ? ''
      : `${summary.deckSize} 枚そろうと storyDeckCode を生成できます`,
    canCopyCode: summary.canExport && !!String(state.codeInputValue || '').trim(),
    canImportCode: !!String(state.codeInputValue || '').trim(),
    headerSummaryText: `ローカル設定: ${ruleSet ? ruleSet.label : normalizedDraft.ruleSetId} / ${summary.deckSize}枚`,
    selectedCards: StoryDeckLabStateModule.listSelectedCards(normalizedDraft)
      .sort((left: any, right: any) => compareCardDefs(left.cardDef, right.cardDef))
      .map((entry: any) => ({
        cardId: entry.cardId,
        count: entry.count,
        cardDef: entry.cardDef,
        addDisabled: !StoryDeckLabStateModule.canAddCardToDraft(normalizedDraft, entry.cardId)
      })),
    candidateCards: filteredDefs.map((cardDef: any) => ({
      cardId: cardDef.id,
      cardDef,
      selectedCount: StoryDeckLabStateModule.getSelectedCount(normalizedDraft, cardDef.id),
      addDisabled: !StoryDeckLabStateModule.canAddCardToDraft(normalizedDraft, cardDef.id)
    }))
  };
}

function render(refs: any, state: any, rootRef: any): void {
  const viewModel = buildViewModel(state);
  StoryDeckLabRendererModule.renderStoryDeckLab(refs, viewModel, {
    onAddCard: (cardId: string) => {
      state.draft = StoryDeckLabStateModule.addCardToDraft(state.draft, cardId);
      clearNotice(state);
      trySyncCodeFromDraft(state, true);
      saveDraft(rootRef, state.draft);
      render(refs, state, rootRef);
    },
    onRemoveCard: (cardId: string) => {
      state.draft = StoryDeckLabStateModule.removeCardFromDraft(state.draft, cardId);
      clearNotice(state);
      trySyncCodeFromDraft(state, true);
      saveDraft(rootRef, state.draft);
      render(refs, state, rootRef);
    },
    onClearCard: (cardId: string) => {
      state.draft = StoryDeckLabStateModule.clearCardFromDraft(state.draft, cardId);
      clearNotice(state);
      trySyncCodeFromDraft(state, true);
      saveDraft(rootRef, state.draft);
      render(refs, state, rootRef);
    }
  });
}

function bindEvents(refs: any, state: any, rootRef: any): void {
  if (refs.ruleSetSelect) {
    refs.ruleSetSelect.addEventListener('change', () => {
      state.draft = StoryDeckLabStateModule.setRuleSetId(state.draft, refs.ruleSetSelect.value);
      clearNotice(state);
      trySyncCodeFromDraft(state, true);
      saveDraft(rootRef, state.draft);
      render(refs, state, rootRef);
    });
  }

  if (refs.searchInput) {
    refs.searchInput.addEventListener('input', () => {
      state.searchText = String(refs.searchInput.value || '');
      render(refs, state, rootRef);
    });
  }

  if (refs.codeTextarea) {
    refs.codeTextarea.addEventListener('input', () => {
      state.codeInputValue = String(refs.codeTextarea.value || '');
      render(refs, state, rootRef);
    });
  }

  if (refs.clearBtn) {
    refs.clearBtn.addEventListener('click', () => {
      state.draft = StoryDeckLabStateModule.clearDraft(state.draft);
      state.codeInputValue = '';
      setNotice(state, 'デッキを空にしました', false);
      saveDraft(rootRef, state.draft);
      render(refs, state, rootRef);
    });
  }

  if (refs.importBtn) {
    refs.importBtn.addEventListener('click', () => {
      const rawCode = String(refs.codeTextarea ? refs.codeTextarea.value : state.codeInputValue || '').trim();
      const decoded = StoryDeckCodecModule.safeDecodeStoryDeckCode(rawCode);
      if (!decoded.ok) {
        setNotice(state, decoded.error && decoded.error.message ? decoded.error.message : 'storyDeckCode を読み込めませんでした', true);
        render(refs, state, rootRef);
        return;
      }
      state.draft = StoryDeckLabStateModule.createDraftFromStoryDeckSpec(decoded.deckSpec);
      state.codeInputValue = StoryDeckCodecModule.encodeStoryDeckSpec(decoded.deckSpec);
      setNotice(state, 'storyDeckCode を読み込みました', false);
      saveDraft(rootRef, state.draft);
      render(refs, state, rootRef);
    });
  }

  if (refs.copyBtn) {
    refs.copyBtn.addEventListener('click', async () => {
      const synced = trySyncCodeFromDraft(state, true);
      if (!synced) {
        render(refs, state, rootRef);
        return;
      }
      const nextCode = String(state.codeInputValue || '').trim();
      if (!nextCode) {
        setNotice(state, 'コピーできる code がありません', true);
        render(refs, state, rootRef);
        return;
      }
      const copied = await copyText(rootRef, nextCode, refs.codeTextarea);
      setNotice(state, copied ? 'storyDeckCode をコピーしました' : 'storyDeckCode のコピーに失敗しました', !copied);
      render(refs, state, rootRef);
    });
  }

  if (refs.closeBtn) {
    refs.closeBtn.addEventListener('click', () => {
      try {
        if (rootRef.history && typeof rootRef.history.back === 'function' && rootRef.history.length > 1) {
          rootRef.history.back();
          return;
        }
      } catch (e) { /* ignore */ }
      if (rootRef.location) {
        rootRef.location.href = 'index.html';
      }
    });
  }
}

function bootstrap(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
  const refs = opts.refs || {};
  const state = {
    draft: loadDraft(rootRef),
    searchText: '',
    noticeText: '',
    noticeIsError: false,
    codeInputValue: ''
  };

  trySyncCodeFromDraft(state, true);
  bindEvents(refs, state, rootRef);
  render(refs, state, rootRef);

  return {
    getDraft: () => StoryDeckLabStateModule.cloneDraft(state.draft),
    getCode: () => String(state.codeInputValue || ''),
    setCode: (nextCode: string) => {
      state.codeInputValue = String(nextCode || '');
      render(refs, state, rootRef);
    }
  };
}

const StoryDeckLabController = {
  bootstrap
};

export = StoryDeckLabController;
