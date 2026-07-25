/** Non-board world and manifestation presentation applied only after board-frame settlement. */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const cardState: any;

declare const SoundEngine: any;

const DiffRendererWorldEffects = _require('./manifest-world-effects');

const WorldStatePresenterModule = _require('./world-state-presenter');

const DiffRendererWorldStatePresenter = WorldStatePresenterModule.createWorldStatePresenter();

let LastUsedPanelCopyModuleForDiff: any = null;

let CardCatalogModuleForDiff: any = null;

let CardInteractionEffectsModuleForDiff: any = null;

let GameTermGlossaryModuleForDiff: any = null;

let ManifestEffectTagPopoverElForDiff: any = null;

let manifestEffectTagPopoverDismissBoundForDiff = false;

const FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF = Object.freeze([
    'THEORY_INCARNATION',
    'BOARD_EXECUTOR',
    'OBSERVER_WILL'
]);

var SpecialCardRegistryModule: any = null;

if (typeof require === 'function') {
    try { SpecialCardRegistryModule = require('../../shared/special-card-registry'); } catch (e: any) { /* ignore */ }
}

function _getGlobalScopeForDiff() {
    return (typeof globalThis !== 'undefined')
        ? globalThis
        : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : ({} as any)));
}

function _getSpecialCardRegistryForDiff() {
    if (SpecialCardRegistryModule) return SpecialCardRegistryModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.SpecialCardRegistry || null;
}

function _getSpecialCardPresentationByMarkerTypeForDiff(specialCardRegistry: any, markerType: any) {
    const typeKey = String(markerType || '').trim().toUpperCase();
    if (!specialCardRegistry || !typeKey) return null;
    if (typeof specialCardRegistry.getSpecialCardPresentationByMarkerType === 'function') {
        return specialCardRegistry.getSpecialCardPresentationByMarkerType(typeKey);
    }
    if (
        typeof specialCardRegistry.getSpecialCardPresentation !== 'function' ||
        typeof specialCardRegistry.getInviolableSpecialCardIds !== 'function'
    ) {
        return null;
    }
    const specialIds = specialCardRegistry.getInviolableSpecialCardIds();
    if (!Array.isArray(specialIds)) return null;
    for (const cardId of specialIds) {
        const meta = specialCardRegistry.getSpecialCardPresentation(cardId);
        if (meta && String(meta.markerType || '').trim().toUpperCase() === typeKey) {
            return meta;
        }
    }
    return null;
}

function _isActiveManifestStoneMarkerForDiff(marker: any) {
    if (!marker || typeof marker !== 'object') return false;
    const data = marker.data && typeof marker.data === 'object' ? marker.data : marker;
    const typeKey = String((data && data.type) || (marker && marker.type) || '').trim().toUpperCase();
    if (!typeKey) return false;
    const kind = String((marker && marker.kind) || '').trim();
    if (kind && kind !== 'manifestStone') return false;
    const remainingRaw = data.remainingOwnerTurns ?? data.remainingTurns ?? marker.remainingOwnerTurns ?? marker.remainingTurns;
    if (remainingRaw == null) return true;
    const remaining = Number(remainingRaw);
    return !Number.isFinite(remaining) || remaining > 0;
}

function _getManifestPresentationOverrideForDiff() {
    try {
        const root = (typeof window !== 'undefined' && window)
            ? window
            : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
        const pending = root && (root as any).__manifestPresentationOverride;
        return pending && typeof pending === 'object' ? pending : null;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _setManifestPresentationOverrideForDiff(value: any) {
    try {
        const root = (typeof window !== 'undefined' && window)
            ? window
            : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
        if (root) (root as any).__manifestPresentationOverride = value || null;
    } catch (e: any) { /* ignore */ }
}

function _markManifestPresentationOverrideResolvedForDiff(active: any) {
    const pending = _getManifestPresentationOverrideForDiff();
    if (!pending || pending.resolvedByMarker === true) return;
    const pendingBackgroundKey = String(pending.manifestBackgroundKey || '').trim();
    const pendingBgmKey = String(pending.manifestBgmKey || '').trim();
    const activeBackgroundKey = String(active && active.key ? active.key : '').trim();
    const activeBgmKey = String(active && active.bgmKey ? active.bgmKey : '').trim();
    const matchesBackground = pendingBackgroundKey && activeBackgroundKey && pendingBackgroundKey === activeBackgroundKey;
    const matchesBgm = pendingBgmKey && activeBgmKey && pendingBgmKey === activeBgmKey;
    if (!matchesBackground && !matchesBgm) return;
    pending.resolvedByMarker = true;
    _setManifestPresentationOverrideForDiff(pending);
}

function _consumeResolvedManifestPresentationOverrideForDiff() {
    const pending = _getManifestPresentationOverrideForDiff();
    if (pending && pending.resolvedByMarker === true) {
        _setManifestPresentationOverrideForDiff(null);
        return true;
    }
    return false;
}

function _findPendingManifestBgmForDiff() {
    const pending = _getManifestPresentationOverrideForDiff();
    if (!pending || pending.resolvedByMarker === true) return null;
    const key = String(pending.manifestBgmKey || '').trim();
    const track = pending.manifestBgmTrack && typeof pending.manifestBgmTrack === 'object'
        ? Object.assign({}, pending.manifestBgmTrack)
        : null;
    if (!key || !track) return null;
    return { key, track };
}

function _findPendingManifestBackgroundForDiff() {
    const pending = _getManifestPresentationOverrideForDiff();
    if (!pending || pending.resolvedByMarker === true) return null;
    const imagePath = String(pending.manifestBackgroundImage || '').trim();
    if (!imagePath) return null;
    return {
        key: String(pending.manifestBackgroundKey || pending.cinematicKey || pending.cardId || 'manifest_world'),
        imagePath,
        source: 'special_card_use'
    };
}

function _findActiveManifestBgmForDiff(cardStateValue: any) {
    const markers = Array.isArray(cardStateValue && cardStateValue.markers) ? cardStateValue.markers : [];
    if (!markers.length) return _findPendingManifestBgmForDiff();
    const specialCardRegistry = _getSpecialCardRegistryForDiff();
    if (!specialCardRegistry) return _findPendingManifestBgmForDiff();
    for (const marker of markers) {
        if (!_isActiveManifestStoneMarkerForDiff(marker)) continue;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : marker;
        const typeKey = String((data && data.type) || (marker && marker.type) || '').trim().toUpperCase();
        const meta = _getSpecialCardPresentationByMarkerTypeForDiff(specialCardRegistry, typeKey);
        if (!meta || !meta.markerType || !meta.manifestBgmTrack) continue;
        const active = {
            key: meta.manifestBgmKey || meta.cinematicKey || meta.cardId,
            bgmKey: meta.manifestBgmKey || '',
            track: meta.manifestBgmTrack
        };
        _markManifestPresentationOverrideResolvedForDiff(active);
        return active;
    }
    return _findPendingManifestBgmForDiff();
}

function _findActiveManifestBackgroundForDiff(cardStateValue: any) {
    const markers = Array.isArray(cardStateValue && cardStateValue.markers) ? cardStateValue.markers : [];
    if (!markers.length) {
        if (_consumeResolvedManifestPresentationOverrideForDiff()) return null;
        return _findPendingManifestBackgroundForDiff();
    }
    const specialCardRegistry = _getSpecialCardRegistryForDiff();
    if (!specialCardRegistry) {
        if (_consumeResolvedManifestPresentationOverrideForDiff()) return null;
        return _findPendingManifestBackgroundForDiff();
    }
    for (const marker of markers) {
        if (!_isActiveManifestStoneMarkerForDiff(marker)) continue;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : marker;
        const typeKey = String((data && data.type) || (marker && marker.type) || '').trim().toUpperCase();
        const meta = _getSpecialCardPresentationByMarkerTypeForDiff(specialCardRegistry, typeKey);
        if (!meta || !meta.markerType || !meta.manifestBackgroundImage) continue;
        const active = {
            key: meta.manifestBackgroundKey || meta.cinematicKey || meta.cardId,
            imagePath: meta.manifestBackgroundImage,
            source: 'marker'
        };
        _markManifestPresentationOverrideResolvedForDiff(active);
        return active;
    }
    if (_consumeResolvedManifestPresentationOverrideForDiff()) return null;
    return _findPendingManifestBackgroundForDiff();
}

function _findActiveManifestMarkerForEffectPanel(cardStateValue: any) {
    const markers = Array.isArray(cardStateValue && cardStateValue.markers) ? cardStateValue.markers : [];
    for (const marker of markers) {
        if (!_isActiveManifestStoneMarkerForDiff(marker)) continue;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : marker;
        const typeKey = String((data && data.type) || (marker && marker.type) || '').trim().toUpperCase();
        if (!typeKey) continue;
        if (!FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF.includes(typeKey)) continue;
        return { marker, data, typeKey, source: 'marker' };
    }
    return null;
}

function _findPendingManifestReservationForEffectPanel(cardStateValue: any) {
    if (!cardStateValue || typeof cardStateValue !== 'object') return null;
    const sources = [
        { key: 'nextBoardExecutorStoneByPlayer', typeKey: 'BOARD_EXECUTOR' },
        { key: 'nextObserverWillStoneByPlayer', typeKey: 'OBSERVER_WILL' },
        { key: 'nextTheoryIncarnationStoneByPlayer', typeKey: 'THEORY_INCARNATION' }
    ];
    for (const source of sources) {
        const reservations = cardStateValue[source.key];
        if (!reservations || typeof reservations !== 'object') continue;
        for (const ownerKey of ['black', 'white']) {
            const reservation = reservations[ownerKey];
            if (!reservation || typeof reservation !== 'object') continue;
            const typeKey = String(reservation.sourceType || source.typeKey || '').trim().toUpperCase();
            if (typeKey !== source.typeKey) continue;
            if (!FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF.includes(typeKey)) continue;
            return {
                marker: null,
                data: reservation,
                typeKey,
                ownerKey,
                source: 'pending-placement'
            };
        }
    }
    return null;
}

function _findManifestEffectPanelEntry(cardStateValue: any) {
    return _findActiveManifestMarkerForEffectPanel(cardStateValue)
        || _findPendingManifestReservationForEffectPanel(cardStateValue);
}

function _ensureManifestEffectPanelForDiff() {
    if (typeof document === 'undefined' || !document || !document.body) return null;
    let panel = document.getElementById('manifest-effect-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'manifest-effect-panel';
        panel.setAttribute('aria-live', 'polite');
        panel.setAttribute('aria-atomic', 'true');
        panel.setAttribute('aria-hidden', 'true');
        panel.innerHTML = [
            '<div id="manifest-effect-title"></div>',
            '<div id="manifest-effect-lines"></div>',
            '<div id="manifest-effect-tags" aria-label="カード効果タグ"></div>'
        ].join('');
        const effectPanel = document.getElementById('effect-live-panel');
        if (effectPanel && effectPanel.parentNode) {
            effectPanel.parentNode.insertBefore(panel, effectPanel.nextSibling);
        } else {
            document.body.appendChild(panel);
        }
    }
    const title = panel.querySelector('#manifest-effect-title');
    const lines = panel.querySelector('#manifest-effect-lines');
    let tags = panel.querySelector('#manifest-effect-tags');
    if (!tags) {
        tags = document.createElement('div');
        tags.id = 'manifest-effect-tags';
        tags.setAttribute('aria-label', 'カード効果タグ');
        panel.appendChild(tags);
    }
    _bindManifestEffectTagClickEvents(tags);
    if (!title || !lines || !tags) return null;
    return { panel, title, lines, tags };
}

function _showEmptyManifestEffectPanelForDiff() {
    const refs = _ensureManifestEffectPanelForDiff();
    if (!refs) return;
    refs.panel.classList.add('is-visible');
    refs.panel.setAttribute('aria-hidden', 'false');
    refs.title.textContent = '';
    refs.lines.textContent = '';
    const emptyLine = document.createElement('div');
    emptyLine.className = 'manifest-effect-line manifest-effect-line--empty';
    _renderManifestEffectLineText(emptyLine, '最後に使ったカードがここに表示されます');
    refs.lines.appendChild(emptyLine);
    _renderManifestEffectTagsForDiff(refs.tags, []);
    refs.panel.removeAttribute('data-manifest-effect-type');
    refs.panel.removeAttribute('data-manifest-effect-source');
}

function _getManifestEffectHandCount(cardStateValue: any, ownerKey: string) {
    const hands = cardStateValue && cardStateValue.hands && typeof cardStateValue.hands === 'object'
        ? cardStateValue.hands
        : null;
    const hand = hands && Array.isArray(hands[ownerKey]) ? hands[ownerKey] : [];
    return hand.length;
}

function _getBoardExecutorHandTaxAmount(handCount: number) {
    const taxableHandCount = Math.max(0, Math.trunc(Number(handCount) || 0) - 1);
    return taxableHandCount * taxableHandCount;
}

function _formatManifestEffectTitleWithRemainingTurns(title: string, active: any) {
    const data = active && active.data && typeof active.data === 'object' ? active.data : null;
    const rawTurns = data && Object.prototype.hasOwnProperty.call(data, 'remainingOwnerTurns')
        ? Number(data.remainingOwnerTurns)
        : NaN;
    if (!Number.isFinite(rawTurns)) return title;
    const turns = Math.max(0, Math.trunc(rawTurns));
    return `${title}　残り${turns}ターン`;
}

function _normalizeManifestCardEffectTagsForDiff(rawTags: any) {
    if (!Array.isArray(rawTags)) return [];
    const seen = new Set<string>();
    const tags = [];
    for (const rawTag of rawTags) {
        if (!rawTag || typeof rawTag !== 'object') continue;
        const label = String(rawTag.label || '').trim();
        if (!label) continue;
        const kind = String(rawTag.kind || '').trim().toLowerCase();
        const dedupeKey = `${kind}:${label}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        tags.push({ kind, label });
    }
    return tags;
}

function _resolveCardTagsForTypeKeyForDiff(typeKey: string) {
    const normalizedTypeKey = String(typeKey || '').trim().toUpperCase();
    if (!normalizedTypeKey) return [];
    const effectsModule = _getCardInteractionEffectsForDiff();
    if (!effectsModule || typeof effectsModule.resolveCardEffectTags !== 'function') return [];
    return _normalizeManifestCardEffectTagsForDiff(effectsModule.resolveCardEffectTags({ type: normalizedTypeKey }));
}

function _buildManifestEffectPanelContent(cardStateValue: any, active: any) {
    const typeKey = String(active && active.typeKey || '').trim().toUpperCase();
    if (typeKey === 'BOARD_EXECUTOR') {
        const blackHandCount = _getManifestEffectHandCount(cardStateValue, 'black');
        const whiteHandCount = _getManifestEffectHandCount(cardStateValue, 'white');
        return {
            title: _formatManifestEffectTitleWithRemainingTurns('執行領域', active),
            lines: [
                '両者: カード使用不可',
                '両者: 手札が多いほど布石を失う',
                `黒: 手札${blackHandCount}枚 → 次開始 -${_getBoardExecutorHandTaxAmount(blackHandCount)}`,
                `白: 手札${whiteHandCount}枚 → 次開始 -${_getBoardExecutorHandTaxAmount(whiteHandCount)}`
            ],
            tags: _resolveCardTagsForTypeKeyForDiff(typeKey),
            dynamicStartIndex: 2
        };
    }
    if (typeKey === 'OBSERVER_WILL') {
        return {
            title: _formatManifestEffectTitleWithRemainingTurns('観測領域', active),
            lines: [
                '所有者: 相手手札を常時観測',
                '観測済みカード: コスト +5'
            ],
            tags: _resolveCardTagsForTypeKeyForDiff(typeKey),
            dynamicStartIndex: -1
        };
    }
    if (typeKey === 'THEORY_INCARNATION') {
        return {
            title: _formatManifestEffectTitleWithRemainingTurns('理論領域', active),
            lines: [
                '所有者: カード使用不可',
                '空きマスを理論数字マス化',
                '所有者の通常配置後に特殊石が出現'
            ],
            tags: _resolveCardTagsForTypeKeyForDiff(typeKey),
            dynamicStartIndex: -1
        };
    }
    return null;
}

function _getLastUsedPanelCopyModuleForDiff() {
    if (LastUsedPanelCopyModuleForDiff) return LastUsedPanelCopyModuleForDiff;
    try {
        LastUsedPanelCopyModuleForDiff = _require('../../cards/card-last-used-panel-copy');
        return LastUsedPanelCopyModuleForDiff;
    } catch (e: any) { /* ignore */ }
    try {
        const globalScope = _getGlobalScopeForDiff();
        if (globalScope && globalScope.LastUsedPanelCopy) {
            LastUsedPanelCopyModuleForDiff = globalScope.LastUsedPanelCopy;
            return LastUsedPanelCopyModuleForDiff;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getCardCatalogForDiff() {
    if (CardCatalogModuleForDiff) return CardCatalogModuleForDiff;
    try {
        CardCatalogModuleForDiff = _require('../../cards/catalog');
        return CardCatalogModuleForDiff;
    } catch (e: any) { /* ignore */ }
    try {
        const globalScope = _getGlobalScopeForDiff();
        if (globalScope && globalScope.CardCatalog) {
            CardCatalogModuleForDiff = globalScope.CardCatalog;
            return CardCatalogModuleForDiff;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getCardInteractionEffectsForDiff() {
    if (CardInteractionEffectsModuleForDiff) return CardInteractionEffectsModuleForDiff;
    try {
        CardInteractionEffectsModuleForDiff = _require('../../cards/card-interaction-effects');
        return CardInteractionEffectsModuleForDiff;
    } catch (e: any) { /* ignore */ }
    try {
        const globalScope = _getGlobalScopeForDiff();
        if (globalScope && globalScope.CardInteractionEffects) {
            CardInteractionEffectsModuleForDiff = globalScope.CardInteractionEffects;
            return CardInteractionEffectsModuleForDiff;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getGameTermGlossaryForDiff() {
    if (GameTermGlossaryModuleForDiff) return GameTermGlossaryModuleForDiff;
    try {
        GameTermGlossaryModuleForDiff = _require('../../shared/game-term-glossary');
        return GameTermGlossaryModuleForDiff;
    } catch (e: any) { /* ignore */ }
    try {
        const globalScope = _getGlobalScopeForDiff();
        if (globalScope && globalScope.GameTermGlossary) {
            GameTermGlossaryModuleForDiff = globalScope.GameTermGlossary;
            return GameTermGlossaryModuleForDiff;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _normalizeLastUsedCardIdForDiff(value: any): string {
    if (!value) return '';
    if (typeof value === 'object') {
        return String(value.id || value.cardId || '').trim();
    }
    return String(value).trim();
}

function _normalizeLastUsedOwnerKeyForDiff(value: any): string {
    if (value && typeof value === 'object') {
        return _normalizeLastUsedOwnerKeyForDiff(
            value.ownerKey || value.useCardOwnerKey || value.playerKey || value.owner || value.player || value.color
        );
    }
    const key = String(value || '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'black' || key === 'b' || key === '1' || key === '黒') return 'black';
    if (key === 'white' || key === 'w' || key === '-1' || key === '白') return 'white';
    return '';
}

function _findLastUsedCardByPlayerEntryInfoForDiff(cardStateValue: any, cardId: string) {
    const byPlayer = cardStateValue && cardStateValue.lastUsedCardByPlayer && typeof cardStateValue.lastUsedCardByPlayer === 'object'
        ? cardStateValue.lastUsedCardByPlayer
        : null;
    if (!byPlayer) return null;
    const entries = ['black', 'white']
        .map((ownerKey) => ({ ownerKey, entry: byPlayer[ownerKey] }))
        .filter((item) => !!_normalizeLastUsedCardIdForDiff(item.entry));
    if (!entries.length) return null;
    if (cardId) {
        return entries.find((item) => _normalizeLastUsedCardIdForDiff(item.entry) === cardId) || null;
    }
    return entries.length === 1 ? entries[0] : null;
}

function _findLastDiscardCardEntryForDiff(cardStateValue: any) {
    const discard = Array.isArray(cardStateValue && cardStateValue.discard) ? cardStateValue.discard : [];
    for (let i = discard.length - 1; i >= 0; i -= 1) {
        const entry = discard[i];
        const cardId = _normalizeLastUsedCardIdForDiff(entry);
        if (cardId) return entry;
    }
    return null;
}

function _cloneCommittedManifestValueForDiff(value: any, seen?: WeakMap<object, any>): any {
    if (!value || typeof value !== 'object') return value;
    const visited = seen || new WeakMap<object, any>();
    const existing = visited.get(value);
    if (existing) return existing;
    if (Array.isArray(value)) {
        const clone: any[] = [];
        visited.set(value, clone);
        value.forEach((entry) => clone.push(_cloneCommittedManifestValueForDiff(entry, visited)));
        return Object.freeze(clone);
    }
    const clone: Record<string, any> = {};
    visited.set(value, clone);
    Object.keys(value).forEach((key) => {
        clone[key] = _cloneCommittedManifestValueForDiff(value[key], visited);
    });
    return Object.freeze(clone);
}

function _cloneCommittedManifestOwnerRecordForDiff(value: any) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.freeze({
        black: _cloneCommittedManifestValueForDiff(source.black),
        white: _cloneCommittedManifestValueForDiff(source.white)
    });
}

/**
 * Capture only the card-state fields consumed by manifestation world effects
 * and the manifestation/last-used-card panel.  The returned graph is detached
 * and frozen so a canonical state object can continue advancing while the
 * corresponding board frame is awaiting visual settlement.
 */
function createCommittedManifestPresentationState(cardStateValue: any) {
    const source = cardStateValue && typeof cardStateValue === 'object' ? cardStateValue : {};
    const lastDiscardEntry = _findLastDiscardCardEntryForDiff(source);
    return Object.freeze({
        markers: _cloneCommittedManifestValueForDiff(
            Array.isArray(source.markers) ? source.markers : []
        ),
        hands: Object.freeze({
            black: _cloneCommittedManifestValueForDiff(
                source.hands && Array.isArray(source.hands.black) ? source.hands.black : []
            ),
            white: _cloneCommittedManifestValueForDiff(
                source.hands && Array.isArray(source.hands.white) ? source.hands.white : []
            )
        }),
        nextBoardExecutorStoneByPlayer: _cloneCommittedManifestOwnerRecordForDiff(
            source.nextBoardExecutorStoneByPlayer
        ),
        nextObserverWillStoneByPlayer: _cloneCommittedManifestOwnerRecordForDiff(
            source.nextObserverWillStoneByPlayer
        ),
        nextTheoryIncarnationStoneByPlayer: _cloneCommittedManifestOwnerRecordForDiff(
            source.nextTheoryIncarnationStoneByPlayer
        ),
        lastUsedCardByPlayer: _cloneCommittedManifestOwnerRecordForDiff(
            source.lastUsedCardByPlayer
        ),
        discard: Object.freeze(lastDiscardEntry
            ? [_cloneCommittedManifestValueForDiff(lastDiscardEntry)]
            : [])
    });
}

function _resolveLastUsedPanelCopyForDiff(cardId: string): string {
    const copyModule = _getLastUsedPanelCopyModuleForDiff();
    if (copyModule && typeof copyModule.getLastUsedPanelCopy === 'function') {
        return String(copyModule.getLastUsedPanelCopy(cardId) || '').trim();
    }
    const copyMap = copyModule && copyModule.LAST_USED_PANEL_COPY_BY_CARD_ID && typeof copyModule.LAST_USED_PANEL_COPY_BY_CARD_ID === 'object'
        ? copyModule.LAST_USED_PANEL_COPY_BY_CARD_ID
        : null;
    return copyMap ? String(copyMap[cardId] || '').trim() : '';
}

function _resolveCardDefForDiff(cardId: string) {
    const normalizedCardId = String(cardId || '').trim();
    if (!normalizedCardId) return null;
    const catalogModule = _getCardCatalogForDiff();
    const catalog = catalogModule && (catalogModule.default || catalogModule.CardCatalog || catalogModule);
    const cards = catalog && Array.isArray(catalog.cards) ? catalog.cards : [];
    return cards.find((entry: any) => entry && String(entry.id || '').trim() === normalizedCardId) || null;
}

function _resolveCardNameForDiff(cardId: string, lastUsedEntry: any): string {
    if (lastUsedEntry && typeof lastUsedEntry === 'object') {
        const directName = String(lastUsedEntry.name || lastUsedEntry.name_ja || '').trim();
        if (directName) return directName;
    }
    const card = _resolveCardDefForDiff(cardId);
    const catalogName = String((card && (card.name_ja || card.name)) || '').trim();
    return catalogName || cardId;
}

function _resolveLastUsedCardTagsForDiff(cardId: string) {
    const cardDef = _resolveCardDefForDiff(cardId);
    if (!cardDef) return [];
    const effectsModule = _getCardInteractionEffectsForDiff();
    if (!effectsModule || typeof effectsModule.resolveCardEffectTags !== 'function') return [];
    return _normalizeManifestCardEffectTagsForDiff(effectsModule.resolveCardEffectTags(cardDef));
}

function _buildLastUsedCardPanelContentForDiff(cardStateValue: any) {
    const lastDiscardEntry = _findLastDiscardCardEntryForDiff(cardStateValue);
    let cardId = _normalizeLastUsedCardIdForDiff(lastDiscardEntry);
    let ownerKey = _normalizeLastUsedOwnerKeyForDiff(lastDiscardEntry);
    let lastUsedInfo = _findLastUsedCardByPlayerEntryInfoForDiff(cardStateValue, cardId);
    let lastUsedEntry = lastUsedInfo && lastUsedInfo.entry;
    if (!ownerKey && lastUsedInfo && lastUsedInfo.ownerKey) {
        ownerKey = lastUsedInfo.ownerKey;
    }
    if (!cardId && lastUsedEntry) {
        cardId = _normalizeLastUsedCardIdForDiff(lastUsedEntry);
    }
    if (!cardId) return null;
    const copy = _resolveLastUsedPanelCopyForDiff(cardId);
    if (!copy) return null;
    const name = _resolveCardNameForDiff(cardId, lastUsedEntry);
    return {
        title: '最後に使ったカード',
        lines: [
            `カード: ${name}`,
            `効果: ${copy}`
        ],
        tags: _resolveLastUsedCardTagsForDiff(cardId),
        ownerKey,
        dynamicStartIndex: -1,
        typeKey: 'LAST_USED_CARD',
        source: 'last-used-card'
    };
}

function _appendManifestEffectValueText(parent: HTMLElement, text: string): void {
    const source = String(text || '');
    const strongPattern = /(x\d+|[+-]\d+|手札\d+枚|コスト\s*[+＋]\d+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = strongPattern.exec(source)) !== null) {
        if (match.index > lastIndex) {
            parent.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
        }
        const strong = document.createElement('span');
        strong.className = 'manifest-effect-value-strong';
        strong.textContent = match[0];
        parent.appendChild(strong);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < source.length) {
        parent.appendChild(document.createTextNode(source.slice(lastIndex)));
    }
}

function _renderManifestEffectLineText(el: HTMLElement, line: string): void {
    const source = String(line || '');
    const match = source.match(/^([^:：]+[:：])\s*(.*)$/);
    if (!match) {
        const valueOnly = document.createElement('span');
        valueOnly.className = 'manifest-effect-value';
        _appendManifestEffectValueText(valueOnly, source);
        el.appendChild(valueOnly);
        return;
    }
    const label = document.createElement('span');
    label.className = 'manifest-effect-label';
    label.textContent = match[1];
    const value = document.createElement('span');
    value.className = 'manifest-effect-value';
    _appendManifestEffectValueText(value, match[2] || '');
    el.appendChild(label);
    el.appendChild(document.createTextNode(' '));
    el.appendChild(value);
}

function _renderManifestEffectTitleForDiff(titleEl: any, content: any) {
    if (!titleEl || typeof document === 'undefined') return;
    titleEl.textContent = '';
    titleEl.appendChild(document.createTextNode(String(content && content.title || '')));
    const ownerKey = _normalizeLastUsedOwnerKeyForDiff(content && content.ownerKey);
    if (!ownerKey) return;
    const stone = document.createElement('span');
    stone.className = `manifest-effect-owner-stone is-${ownerKey}`;
    stone.setAttribute('aria-hidden', 'true');
    titleEl.appendChild(stone);
}

function _getManifestEffectTagKindClassForDiff(kind: any) {
    const normalizedKind = String(kind || '').trim().toLowerCase();
    if (!normalizedKind) return '';
    return `is-${normalizedKind.replace(/[^a-z0-9]+/g, '-')}`;
}

function _renderManifestEffectTagsForDiff(tagsEl: any, tags: any) {
    if (!tagsEl || typeof document === 'undefined') return;
    tagsEl.textContent = '';
    const normalizedTags = Array.isArray(tags) ? tags : [];
    if (normalizedTags.length === 0) {
        tagsEl.style.display = 'none';
        _closeManifestEffectTagPopoverForDiff();
        return;
    }
    for (const tag of normalizedTags) {
        if (!tag || typeof tag !== 'object') continue;
        const label = String(tag.label || '').trim();
        if (!label) continue;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'card-detail-effect-tag card-detail-effect-tag-button';
        const kindClass = _getManifestEffectTagKindClassForDiff(tag.kind);
        if (kindClass) chip.classList.add(kindClass);
        chip.textContent = label;
        chip.setAttribute('data-card-tag-kind', String(tag.kind || ''));
        chip.setAttribute('data-card-tag-label', label);
        chip.setAttribute('aria-label', `${label}の説明を表示`);
        tagsEl.appendChild(chip);
    }
    tagsEl.style.display = tagsEl.childNodes.length > 0 ? 'flex' : 'none';
}

function _ensureManifestEffectTagPopoverForDiff() {
    if (typeof document === 'undefined' || !document || !document.body) return null;
    if (ManifestEffectTagPopoverElForDiff && ManifestEffectTagPopoverElForDiff.isConnected) {
        return ManifestEffectTagPopoverElForDiff;
    }
    let popover = document.getElementById('manifest-effect-tag-popover');
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'manifest-effect-tag-popover';
        popover.className = 'card-detail-tag-popover';
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-modal', 'false');
        popover.setAttribute('aria-hidden', 'true');
        popover.setAttribute('aria-labelledby', 'manifest-effect-tag-popover-title');
        popover.innerHTML = [
            '<div class="card-detail-tag-popover-header">',
            '  <div id="manifest-effect-tag-popover-title" class="card-detail-tag-popover-title"></div>',
            '  <button type="button" class="card-detail-tag-popover-close" aria-label="効果タグ説明を閉じる">×</button>',
            '</div>',
            '<div id="manifest-effect-tag-popover-body" class="card-detail-tag-popover-body"></div>'
        ].join('');
        document.body.appendChild(popover);
    }
    const closeButton = popover.querySelector('.card-detail-tag-popover-close');
    if (closeButton && closeButton.dataset.boundManifestEffectTagClose !== '1') {
        closeButton.addEventListener('click', () => {
            _closeManifestEffectTagPopoverForDiff();
        });
        closeButton.dataset.boundManifestEffectTagClose = '1';
    }
    ManifestEffectTagPopoverElForDiff = popover;
    _bindManifestEffectTagPopoverAutoDismissForDiff();
    return popover;
}

function _closeManifestEffectTagPopoverForDiff() {
    const popover = ManifestEffectTagPopoverElForDiff;
    if (!popover || !popover.classList) return false;
    popover.classList.remove('is-open');
    popover.setAttribute('aria-hidden', 'true');
    popover.removeAttribute('data-card-tag-key');
    return true;
}

function _isManifestEffectTagPopoverOpenForDiff(key: any) {
    const popover = ManifestEffectTagPopoverElForDiff;
    return !!(
        popover &&
        popover.classList &&
        popover.classList.contains('is-open') &&
        String(popover.getAttribute('data-card-tag-key') || '') === String(key || '')
    );
}

function _resolveManifestEffectTagMeaningKeyForDiff(tag: any) {
    const key = String(tag || '').trim();
    if (!key) return '';
    if (key.indexOf('反転回避') === 0) return '反転回避';
    if (key.indexOf('破壊回避') === 0) return '破壊回避';
    if (/^\d+ターン持続$/.test(key)) return '持続ターン';
    return key;
}

function _resolveManifestEffectTagMeaningTextForDiff(meaningKey: any, fallbackKey: any) {
    const key = String(meaningKey || '').trim();
    const glossaryModule = _getGameTermGlossaryForDiff();
    if (key && glossaryModule && typeof glossaryModule.resolveGameTermDescriptionByLabel === 'function') {
        const sharedDescription = glossaryModule.resolveGameTermDescriptionByLabel(key);
        if (String(sharedDescription || '').trim()) return String(sharedDescription);
    }
    return `${String(fallbackKey || key || '').trim()}の説明は未登録です。`;
}

function _toggleManifestEffectTagExplanationForDiff(tag: any) {
    const key = String(tag || '').trim();
    if (!key) return false;
    if (_isManifestEffectTagPopoverOpenForDiff(key)) {
        return _closeManifestEffectTagPopoverForDiff();
    }
    const popover = _ensureManifestEffectTagPopoverForDiff();
    if (!popover) return false;
    const titleEl = document.getElementById('manifest-effect-tag-popover-title');
    const bodyEl = document.getElementById('manifest-effect-tag-popover-body');
    const meaningKey = _resolveManifestEffectTagMeaningKeyForDiff(key);
    const meaning = _resolveManifestEffectTagMeaningTextForDiff(meaningKey, key);
    if (titleEl) titleEl.textContent = key;
    if (bodyEl) bodyEl.textContent = meaning;
    popover.setAttribute('data-card-tag-key', key);
    popover.setAttribute('aria-hidden', 'false');
    popover.classList.add('is-open');
    return true;
}

function _bindManifestEffectTagClickEvents(tagsEl: any) {
    if (!tagsEl || tagsEl.dataset.boundManifestEffectTagClick === '1') return;
    tagsEl.addEventListener('click', (event: any) => {
        const rawTarget = event ? event.target : null;
        const targetEl = rawTarget && rawTarget.nodeType === 1
            ? rawTarget
            : (rawTarget && rawTarget.parentElement ? rawTarget.parentElement : null);
        const chip = targetEl && typeof targetEl.closest === 'function'
            ? targetEl.closest('.card-detail-effect-tag-button')
            : null;
        if (!chip || !tagsEl.contains(chip)) return;
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        const label = String(chip.getAttribute('data-card-tag-label') || chip.textContent || '').trim();
        _toggleManifestEffectTagExplanationForDiff(label);
    });
    tagsEl.dataset.boundManifestEffectTagClick = '1';
}

function _bindManifestEffectTagPopoverAutoDismissForDiff() {
    if (manifestEffectTagPopoverDismissBoundForDiff || typeof document === 'undefined') return;
    document.addEventListener('pointerdown', (event: any) => {
        const popover = ManifestEffectTagPopoverElForDiff;
        if (!popover || !popover.classList || !popover.classList.contains('is-open')) return;
        const rawTarget = event ? event.target : null;
        const targetEl = rawTarget && rawTarget.nodeType === 1
            ? rawTarget
            : (rawTarget && rawTarget.parentElement ? rawTarget.parentElement : null);
        if (targetEl && typeof targetEl.closest === 'function') {
            if (targetEl.closest('#manifest-effect-tag-popover')) return;
            if (targetEl.closest('#manifest-effect-tags')) return;
        }
        _closeManifestEffectTagPopoverForDiff();
    }, true);
    document.addEventListener('keydown', (event: any) => {
        if (!event || event.key !== 'Escape') return;
        _closeManifestEffectTagPopoverForDiff();
    });
    manifestEffectTagPopoverDismissBoundForDiff = true;
}

function _syncManifestEffectPanelForDiff(cardStateValue: any) {
    const refs = _ensureManifestEffectPanelForDiff();
    if (!refs) return;
    const active = _findManifestEffectPanelEntry(cardStateValue);
    let content: any = _buildManifestEffectPanelContent(cardStateValue, active);
    let panelEntry: any = active;
    if (!content) {
        content = _buildLastUsedCardPanelContentForDiff(cardStateValue);
        panelEntry = content;
    }
    if (!content) {
        _showEmptyManifestEffectPanelForDiff();
        return;
    }

    _renderManifestEffectTitleForDiff(refs.title, content);
    refs.lines.textContent = '';
    const dynamicStartIndex = Number(content.dynamicStartIndex);
    content.lines.forEach((line: string, index: number) => {
        const el = document.createElement('div');
        el.className = 'manifest-effect-line';
        if (Number.isFinite(dynamicStartIndex) && dynamicStartIndex >= 0 && index >= dynamicStartIndex) {
            el.classList.add('manifest-effect-line--dynamic');
        }
        _renderManifestEffectLineText(el, line);
        refs.lines.appendChild(el);
    });
    _renderManifestEffectTagsForDiff(refs.tags, content.tags);
    refs.panel.classList.add('is-visible');
    refs.panel.setAttribute('aria-hidden', 'false');
    refs.panel.setAttribute('data-manifest-effect-type', String(panelEntry && panelEntry.typeKey || ''));
    refs.panel.setAttribute('data-manifest-effect-source', String(panelEntry && panelEntry.source || 'marker'));
}

function _getManifestWorldEffectsTimerForDiff() {
    return (AnimationShared && typeof AnimationShared.getTimer === 'function')
        ? AnimationShared.getTimer()
        : (typeof TimerRegistry !== 'undefined' ? TimerRegistry : null);
}

function _syncManifestWorldEffectsForDiff(cardStateValue: any) {
    if (!DiffRendererWorldEffects || typeof DiffRendererWorldEffects.syncManifestWorldEffects !== 'function') {
        throw new Error('[DiffRenderer] world effects capability unavailable');
    }
    DiffRendererWorldEffects.syncManifestWorldEffects({
        cardState: cardStateValue,
        document: (typeof document !== 'undefined' ? document : null),
        soundEngine: (typeof SoundEngine !== 'undefined' ? SoundEngine : null),
        findActiveManifestBgm: _findActiveManifestBgmForDiff,
        findActiveManifestBackground: _findActiveManifestBackgroundForDiff,
        getTimer: _getManifestWorldEffectsTimerForDiff
    });
}

/**
 * Present non-board manifestation UI only after the controller has proved
 * that the corresponding board frame rendered successfully.  Keeping this
 * entry point outside renderBoardDiff makes the contract backend-neutral:
 * DOM compatibility and Pixi commits use the same settled-frame callback.
 */
function presentCommittedWorldState(cardStateValue: any) {
    DiffRendererWorldStatePresenter.presentManifest({
        cardState: cardStateValue,
        syncWorldEffects: _syncManifestWorldEffectsForDiff,
        syncEffectPanel: _syncManifestEffectPanelForDiff
    });
}

// Shared animation helpers (normalized)
var AnimationShared = (typeof require === 'function') ? require('../animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);

if (typeof _require === 'function') {
    try { _require('../../shared-constants'); } catch (e: any) { /* ignore */ }
}

export = { createCommittedManifestPresentationState, presentCommittedWorldState };
