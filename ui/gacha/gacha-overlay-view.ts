'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function resolveDocument(rootRef: any): Document | null {
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function resolveGachaHelpersModule(): any {
  try {
    return _require('../../shared/gacha-helpers');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaHelpersModule) return (globalThis as any).GachaHelpersModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaItemVisualsModule(): any {
  try {
    return _require('./gacha-item-visuals');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaItemVisualsModule) {
      return (globalThis as any).GachaItemVisualsModule;
    }
  } catch (e) { /* ignore */ }
  throw new Error('GachaItemVisualsModule is required before rendering gacha item previews.');
}

function resolveRefs(docRef: Document, options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const refs: any = {
    openBtn: opts.openBtn || docRef.getElementById('gachaOpenBtn'),
    overlay: opts.overlay || docRef.getElementById('gachaOverlay'),
    modal: opts.modal || docRef.getElementById('gachaModal'),
    closeBtn: opts.closeBtn || docRef.getElementById('gachaCloseBtn'),
    balanceValue: opts.balanceValue || docRef.getElementById('gachaBalanceValue'),
    detailToggleBtn: opts.detailToggleBtn || docRef.getElementById('gachaDetailToggleBtn'),
    detailsPanel: opts.detailsPanel || docRef.getElementById('gachaDetailsPanel'),
    singlePullBtn: opts.singlePullBtn || docRef.getElementById('gachaSinglePullBtn'),
    tenPullBtn: opts.tenPullBtn || docRef.getElementById('gachaTenPullBtn'),
    statusText: opts.statusText || docRef.getElementById('gachaStatusText'),
    results: opts.results || docRef.getElementById('gachaResults')
  };
  if (!refs.openBtn || !refs.overlay || !refs.modal || !refs.closeBtn || !refs.balanceValue || !refs.detailsPanel || !refs.singlePullBtn || !refs.tenPullBtn || !refs.statusText || !refs.results) {
    return null;
  }
  return refs;
}

function writeStatus(statusEl: HTMLElement | null, text: string, isError?: boolean): void {
  if (!statusEl) return;
  statusEl.textContent = String(text || '');
  statusEl.classList.toggle('is-error', isError === true);
}

function createRarityRow(docRef: Document, rateInfo: any, helpersModule: any): HTMLElement {
  const row = docRef.createElement('div');
  row.className = 'gacha-rate-row';
  row.setAttribute('data-gacha-rarity', String(rateInfo.rarity || '').trim().toLowerCase());
  if (!rateInfo.available) row.classList.add('is-unavailable');

  const rarity = docRef.createElement('span');
  rarity.className = 'gacha-rate-rarity';
  const rarityMark = docRef.createElement('span');
  rarityMark.className = 'gacha-rate-mark';
  rarityMark.setAttribute('aria-hidden', 'true');
  rarity.appendChild(rarityMark);
  const rarityText = docRef.createElement('span');
  rarityText.className = 'gacha-rate-rarity-text';
  rarityText.textContent = rateInfo.rarity;
  rarity.appendChild(rarityText);

  const probability = docRef.createElement('span');
  probability.className = 'gacha-rate-probability';
  const configured = helpersModule.formatRateBasisPoints(rateInfo.configuredRateBasisPoints);
  if (rateInfo.available) {
    const effective = helpersModule.formatRateBasisPoints(rateInfo.effectiveRateBasisPoints);
    probability.textContent = effective === configured
      ? configured
      : `${configured}（現在 ${effective}）`;
  } else {
    probability.textContent = `${configured}（未登録）`;
  }

  const count = docRef.createElement('span');
  count.className = 'gacha-rate-count';
  count.textContent = `${rateInfo.itemCount}種`;

  row.appendChild(rarity);
  row.appendChild(probability);
  row.appendChild(count);
  return row;
}

function renderDetails(detailsPanel: HTMLElement | null, catalogItems: any[], helpersModule?: any): void {
  if (!detailsPanel) return;
  detailsPanel.innerHTML = '';

  const docRef = detailsPanel.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const gachaHelpers = helpersModule || resolveGachaHelpersModule();
  const itemVisuals = resolveGachaItemVisualsModule();
  if (!docRef || !gachaHelpers) return;

  const intro = docRef.createElement('div');
  intro.className = 'gacha-details-copy';
  intro.textContent = '観測石100で1回、1000で10連。手の見た目・配置音・背景が排出され、重複時は所持済みとして表示し、観測石の補填はありません。';
  detailsPanel.appendChild(intro);

  const handCount = catalogItems.filter((item) => itemVisuals.normalizeItemKind(item) === 'hand_skin').length;
  const backgroundCount = catalogItems.filter((item) => itemVisuals.normalizeItemKind(item) === 'background_skin').length;
  const soundCount = catalogItems.filter((item) => itemVisuals.normalizeItemKind(item) === 'placement_sound').length;
  const rateHeader = docRef.createElement('div');
  rateHeader.className = 'gacha-rate-header';
  const rateHeading = docRef.createElement('div');
  rateHeading.className = 'gacha-rate-heading';
  rateHeading.textContent = '排出率';
  rateHeader.appendChild(rateHeading);
  const kindSummary = docRef.createElement('div');
  kindSummary.className = 'gacha-rate-summary';
  kindSummary.textContent = `手の見た目 ${handCount}種 / 背景 ${backgroundCount}種 / 配置音 ${soundCount}種`;
  rateHeader.appendChild(kindSummary);
  detailsPanel.appendChild(rateHeader);

  const rateList = docRef.createElement('div');
  rateList.className = 'gacha-rate-list';
  const summary = gachaHelpers.summarizeRarityAvailability(catalogItems);
  gachaHelpers.computeEffectiveRarityRates(summary).forEach((rateInfo: any) => {
    rateList.appendChild(createRarityRow(docRef, rateInfo, gachaHelpers));
  });
  detailsPanel.appendChild(rateList);

  if (summary.missingRarities.length) {
    const note = docRef.createElement('div');
    note.className = 'gacha-details-note';
    note.textContent = `未登録 rarity は現在抽選対象外: ${summary.missingRarities.join(', ')}`;
    detailsPanel.appendChild(note);
  }
}

function createResultCard(docRef: Document, pull: any, newlyUnlockedIdSet: Set<string>): HTMLElement | null {
  const item = pull && pull.item ? pull.item : null;
  if (!item) return null;
  const rarityId = String(pull.rarity || '').trim().toLowerCase();
  const itemVisuals = resolveGachaItemVisualsModule();

  const card = docRef.createElement('div');
  card.className = `gacha-result-card rarity-${rarityId}`;
  card.setAttribute('data-gacha-rarity', rarityId);
  card.setAttribute('data-gacha-kind', itemVisuals.normalizeItemKind(item));

  const rarity = docRef.createElement('div');
  rarity.className = 'gacha-result-rarity';
  rarity.textContent = String(pull.rarity || '');
  card.appendChild(rarity);

  const image = docRef.createElement('img');
  image.className = 'gacha-result-image';
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  const fallback = itemVisuals.createSoundFallbackTile(docRef, 'gacha-result-fallback');
  itemVisuals.applyItemPreviewState(item, image, fallback);
  card.appendChild(image);
  card.appendChild(fallback);

  const name = docRef.createElement('div');
  name.className = 'gacha-result-name';
  name.textContent = item.label;
  card.appendChild(name);

  const kind = docRef.createElement('div');
  kind.className = 'gacha-result-kind';
  kind.textContent = itemVisuals.getItemKindLabel(item);
  card.appendChild(kind);

  const status = docRef.createElement('div');
  const isNew = newlyUnlockedIdSet.has(item.id);
  status.className = `gacha-result-status ${isNew ? 'is-new' : 'is-owned'}`;
  status.textContent = isNew ? 'NEW' : '所持済み';
  card.appendChild(status);

  return card;
}

function renderPullResults(resultsEl: HTMLElement | null, pulls: any[], newlyUnlockedIds: string[]): void {
  if (!resultsEl) return;
  const docRef = resultsEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!docRef) return;

  resultsEl.innerHTML = '';
  const safePulls = Array.isArray(pulls) ? pulls : [];
  if (!safePulls.length) {
    const empty = docRef.createElement('div');
    empty.className = 'gacha-results-empty';
    empty.textContent = 'まだガチャ結果はありません';
    resultsEl.appendChild(empty);
    return;
  }

  const newlyUnlockedIdSet = new Set(Array.isArray(newlyUnlockedIds) ? newlyUnlockedIds : []);
  safePulls.forEach((pull) => {
    const card = createResultCard(docRef, pull, newlyUnlockedIdSet);
    if (card) resultsEl.appendChild(card);
  });
}

function setDetailsVisible(refs: any, visible: boolean): void {
  const open = visible === true;
  refs.detailsPanel.hidden = !open;
  if (refs.detailToggleBtn) {
    refs.detailToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    refs.detailToggleBtn.textContent = '詳細';
  }
}

function setOverlayVisible(refs: any, visible: boolean): void {
  const open = visible === true;
  refs.overlay.classList.toggle('is-open', open);
  refs.overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
  refs.openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (!open) refs.overlay.classList.remove('is-revealing');
}

function setBusyState(refs: any, visible: boolean): void {
  refs.overlay.classList.toggle('is-revealing', visible === true);
}

function setResultsBusy(refs: any, visible: boolean): void {
  if (visible === true) {
    refs.results.setAttribute('aria-busy', 'true');
    return;
  }
  refs.results.removeAttribute('aria-busy');
}

function syncBalanceAndButtons(refs: any, options?: any): void {
  const opts = (options && typeof options === 'object') ? options : {};
  const balance = Math.max(0, Math.floor(Number(opts.balance) || 0));
  const hasCatalog = opts.hasCatalog === true;
  const isAnimating = opts.isAnimating === true;
  const singlePullCost = Math.max(0, Math.floor(Number(opts.singlePullCost) || 0));
  const tenPullCost = Math.max(0, Math.floor(Number(opts.tenPullCost) || 0));

  refs.balanceValue.textContent = String(balance);
  refs.closeBtn.disabled = isAnimating;
  if (refs.detailToggleBtn) refs.detailToggleBtn.disabled = isAnimating;
  refs.singlePullBtn.disabled = isAnimating || !hasCatalog || balance < singlePullCost;
  refs.tenPullBtn.disabled = isAnimating || !hasCatalog || balance < tenPullCost;
}

function focusPrimaryAction(refs: any): void {
  try {
    refs.singlePullBtn.focus({ preventScroll: true });
  } catch (e) {
    try { refs.singlePullBtn.focus(); } catch (_e) { /* ignore */ }
  }
}

function createGachaOverlayView(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const docRef = opts.document || resolveDocument(rootRef);
  if (!docRef) return null;

  const refs = resolveRefs(docRef, opts);
  if (!refs) return null;

  return {
    refs,
    writeStatus: function (text: string, isError?: boolean) {
      writeStatus(refs.statusText, text, isError);
    },
    renderDetails: function (catalogItems: any[], helpersModule?: any) {
      renderDetails(refs.detailsPanel, catalogItems, helpersModule);
    },
    renderPullResults: function (pulls: any[], newlyUnlockedIds: string[]) {
      renderPullResults(refs.results, pulls, newlyUnlockedIds);
    },
    setDetailsVisible: function (visible: boolean) {
      setDetailsVisible(refs, visible);
    },
    isDetailsVisible: function () {
      return refs.detailsPanel.hidden !== true;
    },
    setOverlayVisible: function (visible: boolean) {
      setOverlayVisible(refs, visible);
    },
    setBusyState: function (visible: boolean) {
      setBusyState(refs, visible);
    },
    setResultsBusy: function (visible: boolean) {
      setResultsBusy(refs, visible);
    },
    syncBalanceAndButtons: function (state: any) {
      syncBalanceAndButtons(refs, state);
    },
    focusPrimaryAction: function () {
      focusPrimaryAction(refs);
    }
  };
}

const GachaOverlayView = {
  createGachaOverlayView,
  resolveRefs,
  writeStatus,
  renderDetails,
  renderPullResults
};

export = GachaOverlayView;
