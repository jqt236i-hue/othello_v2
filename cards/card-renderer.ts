
declare const __non_webpack_require__: NodeRequire | undefined;
declare const CHARGE_MAX: any;
declare const isCardAnimating: any;
declare const onCardClick: any;
declare const updateCardDetailPanel: any;

type CardRendererRuntimeRoot = typeof globalThis & Record<string, any>;
type PlayerOwnerKey = 'black' | 'white';
type ChargeDeltaPopupOptions = {
    label?: string;
    placement?: string;
};

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

function _setTextContentIfChanged(el: any, value: any) {
    if (!el) return;
    const normalized = String(value ?? '');
    if (el.textContent !== normalized) {
        el.textContent = normalized;
    }
}

function _setDatasetValueIfChanged(el: any, key: string, value: any) {
    if (!el || !el.dataset) return;
    const normalized = String(value ?? '');
    if (el.dataset[key] !== normalized) {
        el.dataset[key] = normalized;
    }
}

function _setStylePropertyIfChanged(el: any, propertyName: string, value: any) {
    if (!el || !el.style || typeof el.style.getPropertyValue !== 'function') return;
    const normalized = String(value ?? '');
    if (el.style.getPropertyValue(propertyName) !== normalized) {
        el.style.setProperty(propertyName, normalized);
    }
}

// ===== Card Rendering =====
function _resolveCardRendererModule(requirePath: string, globalKey: string): any {
    try {
        const mod = _require(requirePath);
        if (mod) return mod;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined') {
            return (globalThis as CardRendererRuntimeRoot)[globalKey] || null;
        }
    }
    catch (e) { /* ignore */ }
    return null;
}

let PlaybackStateModule: any = _resolveCardRendererModule('../ui/playback-state-manager', 'PlaybackStateManager');
let OwnerHelpersModule: any = _resolveCardRendererModule('../utils/owner-helpers', 'OwnerHelpers');
let HandFadeStateModule: any = _resolveCardRendererModule('../ui/hand-animation/fade-state', 'HandFadeStateModule');
let PlayerSlotElementsModule: any = _resolveCardRendererModule('../ui/player-slot-elements', 'PlayerSlotElements');
let CardLogicModule: any = _resolveCardRendererModule('../game/logic/cards', 'CardLogic');
let CoreLogicModule: any = _resolveCardRendererModule('../game/logic/core', 'CoreLogic')
    || _resolveCardRendererModule('../game/logic/core', 'Core');
let SpecialCardRegistryModule: any = _resolveCardRendererModule('../shared/special-card-registry', 'SpecialCardRegistry');
let CardArtMapModule: any = _resolveCardRendererModule('./card-art-map.generated', 'CardArtMap');
let CardDemoVideoModule: any = _resolveCardRendererModule('./card-demo-video', 'CardDemoVideo');
function getCardCostTier(cost: number): string {
    const safeCost = Number.isFinite(cost) ? cost : 0;
    if (safeCost === 0)
        return 'white';
    if (safeCost >= 31)
        return 'special';
    if (safeCost >= 21)
        return 'gold';
    if (safeCost >= 16)
        return 'purple';
    if (safeCost >= 11)
        return 'blue';
    if (safeCost >= 6)
        return 'red';
    return 'gray';
}
function _normalizeCardDisplayTypeLabel(label: any) {
    const normalized = String(label || '').trim();
    return normalized || '';
}
function _resolveCardDisplayTypeLabel(cardDef: any, fallbackCardId: any) {
    if (cardDef && typeof cardDef === 'object') {
        const directLabel = _normalizeCardDisplayTypeLabel(cardDef.display_type_ja || cardDef.displayTypeJa);
        if (directLabel)
            return directLabel;
    }
    const cardId = String(fallbackCardId || (cardDef && cardDef.id) || '').trim();
    if (!cardId)
        return '';
    try {
        if (typeof window !== 'undefined' && window.CardCatalog && Array.isArray(window.CardCatalog.cards)) {
            const catalogCard = window.CardCatalog.cards.find((entry: any) => entry && entry.id === cardId);
            if (catalogCard) {
                const catalogLabel = _normalizeCardDisplayTypeLabel(catalogCard.display_type_ja || catalogCard.displayTypeJa);
                if (catalogLabel)
                    return catalogLabel;
            }
        }
    }
    catch (e) { /* ignore */ }
    return '';
}
var _DISPLAY_TYPE_KEY_MAP: Record<string, string> = {
    '採掘': 'mining',
    '守護': 'guard',
    '戦闘': 'battle',
    '執行': 'judgment',
    '禁忌': 'taboo',
    '殲滅': 'annihilation',
    '繁栄': 'prosperity',
    '特殊': 'special'
};
var _CARD_FACE_SPECIAL_ART_OVERRIDES: Record<string, { effectKey: string; imagePath: string }> = {
    seed_01: {
        effectKey: 'seedStone',
        imagePath: 'assets/images/other/seed.png'
    },
    blockade_01: {
        effectKey: 'blockadeMark',
        imagePath: 'assets/images/other/X.png'
    }
};
function _resolveCardFaceArtFilenameById(cardId: any) {
    const map = CardArtMapModule && (
        CardArtMapModule.CARD_FACE_ART_FILENAME_BY_ID ||
        CardArtMapModule.default ||
        CardArtMapModule
    );
    if (!map || typeof map !== 'object') {
        return '';
    }
    return String(map[String(cardId || '').trim()] || '').trim();
}
function _resolveCardFaceArtPathById(cardId: any) {
    const map = CardArtMapModule && CardArtMapModule.CARD_FACE_ART_PATH_BY_ID;
    if (!map || typeof map !== 'object') {
        return '';
    }
    return String(map[String(cardId || '').trim()] || '').trim();
}
function _isSpecialCardFace(cardId: any) {
    return !!(
        SpecialCardRegistryModule &&
        typeof SpecialCardRegistryModule.isInviolableSpecialCardId === 'function' &&
        SpecialCardRegistryModule.isInviolableSpecialCardId(cardId)
    );
}
function _resolveSpecialCardCharacterArt(cardId: any) {
    if (
        !SpecialCardRegistryModule ||
        typeof SpecialCardRegistryModule.getSpecialCardPresentation !== 'function' ||
        !_isSpecialCardFace(cardId)
    ) {
        return null;
    }
    const meta = SpecialCardRegistryModule.getSpecialCardPresentation(cardId);
    const imagePath = String((meta && meta.characterImage) || '').trim();
    if (!imagePath) {
        return null;
    }
    return {
        effectKey: 'specialCardCharacter',
        imagePath
    };
}
function _resolveCardDisplayTypeKey(cardDef: any, fallbackCardId: any) {
    const typeLabel = _resolveCardDisplayTypeLabel(cardDef, fallbackCardId);
    return _DISPLAY_TYPE_KEY_MAP[typeLabel] || '';
}
function _getGameVisualEffectsMapForCardFaces() {
    try {
        const root: CardRendererRuntimeRoot | Window | null = (typeof globalThis !== 'undefined')
            ? (globalThis as CardRendererRuntimeRoot)
            : (typeof window !== 'undefined' ? window : null);
        if (root &&
            root.GameVisualEffectsMap &&
            root.GameVisualEffectsMap.STONE_VISUAL_EFFECTS &&
            typeof root.GameVisualEffectsMap.resolveCardVisualImagePath === 'function') {
            return root.GameVisualEffectsMap;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof require === 'function') {
        try {
            const mod = require('../game/visual-effects-map');
            if (mod && mod.STONE_VISUAL_EFFECTS && typeof mod.resolveCardVisualImagePath === 'function') {
                return mod;
            }
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function _normalizeCardFaceVisualSide(value: any) {
    if (value === 'white' || value === -1 || value === '-1')
        return '-1';
    if (value === 'black' || value === 1 || value === '1')
        return '1';
    return null;
}
function _resolveCardDefForFaceVisual(cardDef: any, fallbackCardId: any) {
    if (cardDef && typeof cardDef === 'object') {
        return cardDef;
    }
    const cardId = String(fallbackCardId || '').trim();
    if (!cardId) {
        return null;
    }
    try {
        if (typeof CARD_DEFS !== 'undefined' && Array.isArray(CARD_DEFS)) {
            const runtimeDef = CARD_DEFS.find((entry) => entry && entry.id === cardId);
            if (runtimeDef) {
                return runtimeDef;
            }
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.CardCatalog && Array.isArray(window.CardCatalog.cards)) {
            const catalogDef = window.CardCatalog.cards.find((entry: any) => entry && entry.id === cardId);
            if (catalogDef) {
                return catalogDef;
            }
        }
    }
    catch (e) { /* ignore */ }
    return null;
}
function _resolveCardBackgroundArt(cardDef: any, fallbackCardId: any) {
    const resolvedCardDef = _resolveCardDefForFaceVisual(cardDef, fallbackCardId);
    const resolvedCardId = String(resolvedCardDef && resolvedCardDef.id ? resolvedCardDef.id : (fallbackCardId || '')).trim();
    if (!resolvedCardId) {
        return null;
    }
    const stableArtPath = _resolveCardFaceArtPathById(resolvedCardId);
    if (stableArtPath) {
        return {
            imagePath: stableArtPath
        };
    }
    const stableArtFilename = _resolveCardFaceArtFilenameById(resolvedCardId);
    if (stableArtFilename) {
        return {
            imagePath: `assets/images/card/${stableArtFilename}`
        };
    }
    let sourceCards: any[] = [];
    try {
        if (typeof CARD_DEFS !== 'undefined' && Array.isArray(CARD_DEFS)) {
            sourceCards = CARD_DEFS;
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (
            typeof window !== 'undefined' &&
            window.CardCatalog &&
            Array.isArray(window.CardCatalog.cards) &&
            window.CardCatalog.cards.length
        ) {
            sourceCards = window.CardCatalog.cards;
        }
    }
    catch (e) { /* ignore */ }
    const cardIndex = sourceCards.findIndex((entry) => entry && String(entry.id || '').trim() === resolvedCardId);
    if (cardIndex < 0) {
        return null;
    }
    const sourceDef = sourceCards[cardIndex] || resolvedCardDef || {};
    const cardName = String(sourceDef.name_ja || sourceDef.name || resolvedCardDef?.name_ja || resolvedCardDef?.name || '').trim();
    if (!cardName) {
        return null;
    }
    const cardNumber = String(cardIndex + 1).padStart(2, '0');
    return {
        imagePath: `assets/images/card/${cardNumber}_${cardName}.png`
    };
}
function applyCardBackgroundArtToFace(cardEl: any, cardDef: any, options: any) {
    if (!cardEl || typeof cardEl !== 'object') {
        return cardEl;
    }
    const fallbackCardId = options && options.cardId ? options.cardId : (cardDef && cardDef.id);
    const art = _resolveCardBackgroundArt(cardDef, fallbackCardId);
    const existingArtEl = cardEl.querySelector('.card-background-art');
    if (!art) {
        cardEl.classList.remove('has-card-background');
        cardEl.style.removeProperty('--card-background-art-image');
        delete cardEl.dataset.cardBackgroundImage;
        if (existingArtEl && existingArtEl.parentElement) {
            existingArtEl.parentElement.removeChild(existingArtEl);
        }
        return cardEl;
    }
    let artEl = existingArtEl;
    if (!artEl) {
        artEl = document.createElement('div');
        artEl.className = 'card-background-art';
        artEl.setAttribute('aria-hidden', 'true');
        cardEl.insertBefore(artEl, cardEl.firstChild || null);
    }
    const escapedPath = String(art.imagePath).replace(/"/g, '\\"');
    cardEl.classList.add('has-card-background');
    cardEl.dataset.cardBackgroundImage = art.imagePath;
    cardEl.style.setProperty('--card-background-art-image', `url("${escapedPath}")`);
    return cardEl;
}
function resolveCardBackgroundArtPath(cardId: any, _options?: any) {
    const resolvedCardId = String(cardId || '').trim();
    if (!resolvedCardId) {
        return '';
    }
    const cardDef = CARD_DEFS.find((c: any) => c && String(c.id || '').trim() === resolvedCardId) || null;
    const art = _resolveCardBackgroundArt(cardDef, resolvedCardId);
    return art && art.imagePath ? art.imagePath : '';
}
function _resolveCardSpecialArt(cardDef: any, fallbackCardId: any, options: any) {
    const resolvedCardDef = _resolveCardDefForFaceVisual(cardDef, fallbackCardId);
    const resolvedCardId = String(resolvedCardDef && resolvedCardDef.id ? resolvedCardDef.id : (fallbackCardId || '')).trim();
    if (resolvedCardId && _CARD_FACE_SPECIAL_ART_OVERRIDES[resolvedCardId]) {
        return _CARD_FACE_SPECIAL_ART_OVERRIDES[resolvedCardId];
    }
    const specialCardCharacterArt = _resolveSpecialCardCharacterArt(resolvedCardId);
    if (specialCardCharacterArt) {
        return specialCardCharacterArt;
    }
    const cardType = String(resolvedCardDef && resolvedCardDef.type ? resolvedCardDef.type : '').trim();
    if (!cardType) {
        return null;
    }
    const map = _getGameVisualEffectsMapForCardFaces();
    if (!map) {
        return null;
    }
    const isSpecialCard = _isSpecialCardFace(resolvedCardId);
    const effectKey = (isSpecialCard && typeof map.getEffectKeyForSpecialType === 'function')
        ? map.getEffectKeyForSpecialType(cardType)
        : (typeof map.getEffectKeyForPendingType === 'function')
        ? map.getEffectKeyForPendingType(cardType)
        : (map.PENDING_TYPE_TO_EFFECT_KEY && map.PENDING_TYPE_TO_EFFECT_KEY[cardType]);
    if (!effectKey) {
        return null;
    }
    const ownerSide = _normalizeCardFaceVisualSide(options && options.ownerKey);
    const visualOptions = {
        owner: ownerSide,
        player: ownerSide,
        fallbackOwner: '1',
        fallbackPlayer: '1'
    };
    const imagePath = isSpecialCard && typeof map.resolveEffectImagePath === 'function'
        ? map.resolveEffectImagePath(map.STONE_VISUAL_EFFECTS && map.STONE_VISUAL_EFFECTS[effectKey], visualOptions)
        : map.resolveCardVisualImagePath(cardType, visualOptions);
    if (!imagePath) {
        return null;
    }
    if (typeof map.isNormalStoneImagePath === 'function' && map.isNormalStoneImagePath(imagePath)) {
        return null;
    }
    return {
        effectKey,
        imagePath
    };
}
function applyCardSpecialArtToFace(cardEl: any, cardDef: any, options: any) {
    if (!cardEl || typeof cardEl !== 'object') {
        return cardEl;
    }
    const fallbackCardId = options && options.cardId ? options.cardId : (cardDef && cardDef.id);
    const art = _resolveCardSpecialArt(cardDef, fallbackCardId, options);
    const existingArtEl = cardEl.querySelector('.card-special-art');
    if (!art) {
        cardEl.classList.remove('has-special-art');
        delete cardEl.dataset.cardVisualEffect;
        cardEl.style.removeProperty('--card-special-art-image');
        if (existingArtEl && existingArtEl.parentElement) {
            existingArtEl.parentElement.removeChild(existingArtEl);
        }
        return cardEl;
    }
    let artEl = existingArtEl;
    if (!artEl) {
        artEl = document.createElement('div');
        artEl.className = 'card-special-art';
        artEl.setAttribute('aria-hidden', 'true');
        const backgroundArtEl = cardEl.querySelector('.card-background-art');
        if (backgroundArtEl && backgroundArtEl.nextSibling) {
            cardEl.insertBefore(artEl, backgroundArtEl.nextSibling);
        }
        else {
            cardEl.appendChild(artEl);
        }
    }
    const escapedPath = String(art.imagePath).replace(/"/g, '\\"');
    cardEl.classList.add('has-special-art');
    cardEl.dataset.cardVisualEffect = art.effectKey;
    cardEl.style.setProperty('--card-special-art-image', `url("${escapedPath}")`);
    return cardEl;
}
function _getProjectedHandCostForRender(cardState: any, ownerKey: any, handIndex: any, fallbackCost: any): number | null {
    const fallback = Number.isFinite(Number(fallbackCost)) ? Number(fallbackCost) : 0;
    const owner = _normalizeOwnerKeyForRender(ownerKey);
    if (!cardState || typeof cardState !== 'object' || !owner || !Number.isInteger(Number(handIndex))) {
        return null;
    }
    const adjustmentsByPlayer = (cardState.handCostAdjustmentsByPlayer && typeof cardState.handCostAdjustmentsByPlayer === 'object')
        ? cardState.handCostAdjustmentsByPlayer
        : null;
    const adjustments = adjustmentsByPlayer && Array.isArray(adjustmentsByPlayer[owner])
        ? adjustmentsByPlayer[owner]
        : null;
    if (!adjustments)
        return null;
    const adjustment = adjustments[Math.max(0, Math.trunc(Number(handIndex)))];
    if (!adjustment || typeof adjustment !== 'object')
        return null;
    const overrideCost = Number(adjustment.overrideCost);
    let cost = Number.isFinite(overrideCost) ? overrideCost : fallback;
    const delta = Number(adjustment.delta);
    if (Number.isFinite(delta)) {
        cost += delta;
    }
    return Number.isFinite(cost) ? cost : fallback;
}
function _getEffectiveCardCostForRender(cardState: any, ownerKey: any, cardId: any, handIndex: any, fallbackCost: any): number {
    const fallback = Number.isFinite(Number(fallbackCost)) ? Number(fallbackCost) : 0;
    try {
        if (CardLogicModule && typeof CardLogicModule.getHandCopyIdAt === 'function' && typeof CardLogicModule.getEffectiveCardCostForCopy === 'function') {
            const copyId = CardLogicModule.getHandCopyIdAt(cardState, ownerKey, handIndex);
            const copyKey = String(Number(copyId || 0));
            const hasOverride = !!(
                copyKey !== '0'
                && cardState
                && cardState.cardCostOverridesByCopyId
                && Object.prototype.hasOwnProperty.call(cardState.cardCostOverridesByCopyId, copyKey)
            );
            const hasModifier = !!(
                copyKey !== '0'
                && cardState
                && cardState.cardCostModifiersByCopyId
                && Object.prototype.hasOwnProperty.call(cardState.cardCostModifiersByCopyId, copyKey)
            );
            if (hasOverride || hasModifier) {
                return CardLogicModule.getEffectiveCardCostForCopy(cardState, cardId, copyId);
            }
        }
    } catch (e) { /* ignore */ }
    const projectedCost = _getProjectedHandCostForRender(cardState, ownerKey, handIndex, fallback);
    if (projectedCost !== null && Number.isFinite(Number(projectedCost))) {
        return Number(projectedCost);
    }
    return fallback;
}
interface CardNameFitPlan {
    baseFontPx: number;
    minFontPx: number;
    prefersReadableFallback: boolean;
    usesDotFont: boolean;
}
function _readCardNameRootFontSkinId() {
    if (typeof document === 'undefined' || !document)
        return '';
    return String(document.body?.getAttribute('data-font-skin-id') || document.documentElement?.getAttribute('data-font-skin-id') || '').trim();
}
function _normalizeCardNameText(value: any) {
    return String(value || '').replace(/\s+/g, '').trim();
}
function _countKanjiCharacters(text: string) {
    return Array.from(text).filter((char) => /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(char)).length;
}
function _shouldUseReadableCardNameFallback(rootFontSkinId: string, normalizedText: string) {
    if (rootFontSkinId !== 'dot-gothic' || !normalizedText)
        return false;
    const kanjiCount = _countKanjiCharacters(normalizedText);
    return kanjiCount >= 4 || (kanjiCount >= 3 && normalizedText.length >= 5);
}
function _toggleReadableCardNameFallbackClass(nameEl: any, prefersReadableFallback: boolean) {
    if (!nameEl?.classList || typeof nameEl.classList.toggle !== 'function')
        return;
    nameEl.classList.toggle('card-name-readable-fallback', prefersReadableFallback);
}
function _resolveCardNameFitPlan(nameEl: any, computed: CSSStyleDeclaration | null, rootFontSkinId: string): CardNameFitPlan | null {
    const baseFontPx = computed ? parseFloat(computed.fontSize) : NaN;
    if (!Number.isFinite(baseFontPx) || baseFontPx <= 0)
        return null;
    const normalizedText = _normalizeCardNameText(nameEl?.textContent);
    const prefersReadableFallback = _shouldUseReadableCardNameFallback(rootFontSkinId, normalizedText);
    _toggleReadableCardNameFallbackClass(nameEl, prefersReadableFallback);
    const computedFontFamily = computed ? String(computed.fontFamily || '') : '';
    const usesDotFont = !prefersReadableFallback && (/DotGothic16/i.test(computedFontFamily) || rootFontSkinId === 'dot-gothic');
    const minFontPx = Math.max(
        prefersReadableFallback ? 11 : (usesDotFont ? 10 : 8),
        Math.ceil(baseFontPx * (prefersReadableFallback ? 0.78 : (usesDotFont ? 0.82 : 0.68)))
    );
    return {
        baseFontPx,
        minFontPx,
        prefersReadableFallback,
        usesDotFont
    };
}
function _applyCardNameFontSize(nameEl: any, fontPx: number, minFontPx: number) {
    const snappedFontPx = Math.max(minFontPx, Math.floor(fontPx));
    nameEl.style.fontSize = `${snappedFontPx}px`;
    return snappedFontPx;
}
function _shrinkCardNameToFitWidth(nameEl: any, availableWidth: number, startFontPx: number, minFontPx: number, maxAttempts: number) {
    let nextFontPx = startFontPx;
    let attempts = 0;
    while (nameEl.scrollWidth > availableWidth && nextFontPx > minFontPx && attempts < maxAttempts) {
        nextFontPx = _applyCardNameFontSize(nameEl, nextFontPx - 1, minFontPx);
        attempts += 1;
    }
    return nextFontPx;
}
function _fitCardNameElement(nameEl: any, retriesRemaining: any = 6) {
    if (!nameEl || typeof nameEl !== 'object')
        return;
    const retries = Number.isFinite(retriesRemaining) ? retriesRemaining : 6;
    const runFit = () => {
        try {
            const availableWidth = Math.max(0, nameEl.clientWidth || nameEl.offsetWidth || 0);
            if (!availableWidth) {
                if (retries > 0 && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(() => _fitCardNameElement(nameEl, retries - 1));
                }
                return;
            }
            nameEl.style.removeProperty('font-size');
            nameEl.style.removeProperty('letter-spacing');
            const rootFontSkinId = _readCardNameRootFontSkinId();
            const computed = (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function')
                ? window.getComputedStyle(nameEl)
                : null;
            const fitPlan = _resolveCardNameFitPlan(nameEl, computed, rootFontSkinId);
            if (!fitPlan)
                return;
            const { baseFontPx, minFontPx, prefersReadableFallback, usesDotFont } = fitPlan;
            let nextFontPx = _shrinkCardNameToFitWidth(nameEl, availableWidth, baseFontPx, minFontPx, 12);
            if (!usesDotFont && !prefersReadableFallback && nameEl.scrollWidth > availableWidth) {
                nameEl.style.letterSpacing = '-0.03em';
            }
            else {
                nameEl.style.letterSpacing = '0';
            }
            _shrinkCardNameToFitWidth(nameEl, availableWidth, nextFontPx, minFontPx, 8);
        }
        catch (e) { /* ignore */ }
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(runFit);
    }
    else {
        runFit();
    }
}
let _fontReadyRefitGeneration = 0;
let _fontReadyRefitSettledReady: Promise<any> | null = null;
let _fontReadyRefitPending: {
    ready: Promise<any>;
    generation: number;
    promise: Promise<boolean>;
} | null = null;
function refitAllCardNameElements(documentRef?: Document | null) {
    const docRef = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!docRef || typeof docRef.querySelectorAll !== 'function')
        return 0;
    const nameElements = Array.from(docRef.querySelectorAll('.card-name'));
    nameElements.forEach((nameEl) => _fitCardNameElement(nameEl));
    return nameElements.length;
}
function scheduleCardNameRefitAfterFontsReady(
    documentRef?: Document | null,
    forceCurrentCycle: boolean = false
): Promise<boolean> {
    const docRef = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!docRef)
        return Promise.resolve(false);
    const initialFontSet = (docRef as Document & { fonts?: { ready?: Promise<any> } }).fonts;
    const initialReady = initialFontSet && initialFontSet.ready;
    if (!initialReady || typeof initialReady.then !== 'function')
        return Promise.resolve(false);
    if (!forceCurrentCycle && !_fontReadyRefitPending && _fontReadyRefitSettledReady === initialReady)
        return Promise.resolve(false);
    const generation = ++_fontReadyRefitGeneration;
    return new Promise((resolve) => {
        const beginWait = () => {
            const fontSet = (docRef as Document & { fonts?: { ready?: Promise<any> } }).fonts;
            const ready = fontSet && fontSet.ready;
            if (!ready || typeof ready.then !== 'function') {
                resolve(false);
                return;
            }
            if (!forceCurrentCycle && !_fontReadyRefitPending && _fontReadyRefitSettledReady === ready) {
                resolve(false);
                return;
            }
            if (_fontReadyRefitPending && _fontReadyRefitPending.ready === ready) {
                _fontReadyRefitPending.generation = generation;
                _fontReadyRefitPending.promise.then(resolve);
                return;
            }
            const record = {
                ready,
                generation,
                promise: Promise.resolve(false)
            };
            record.promise = Promise.resolve(ready).then(() => {
                if (_fontReadyRefitPending !== record || record.generation !== _fontReadyRefitGeneration)
                    return false;
                _fontReadyRefitPending = null;
                if (fontSet && fontSet.ready && fontSet.ready !== ready) {
                    void scheduleCardNameRefitAfterFontsReady(docRef);
                    return false;
                }
                _fontReadyRefitSettledReady = ready;
                refitAllCardNameElements(docRef);
                return true;
            }, () => {
                if (_fontReadyRefitPending === record)
                    _fontReadyRefitPending = null;
                return false;
            });
            _fontReadyRefitPending = record;
            record.promise.then(resolve);
        };
        const view = docRef.defaultView;
        if (view && typeof view.requestAnimationFrame === 'function') {
            view.requestAnimationFrame(beginWait);
        }
        else {
            beginWait();
        }
    });
}
try {
    if (typeof window !== 'undefined') {
        window.fitCardNameElement = _fitCardNameElement;
        window.refitAllCardNameElements = refitAllCardNameElements;
        window.scheduleCardNameRefitAfterFontsReady = scheduleCardNameRefitAfterFontsReady;
        window.applyCardSpecialArtToFace = applyCardSpecialArtToFace;
        window.resolveCardBackgroundArtPath = resolveCardBackgroundArtPath;
    }
}
catch (e) { /* ignore */ }
function _syncCardDemoVideoButtonForRender(cardEl: any, cardId: any) {
    if (!CardDemoVideoModule) CardDemoVideoModule = _resolveCardRendererModule('./card-demo-video', 'CardDemoVideo');
    if (!CardDemoVideoModule || typeof CardDemoVideoModule.syncCardDemoVideoButton !== 'function') return;
    if (_isSpecialCardFace(cardId)) return;
    try {
        CardDemoVideoModule.syncCardDemoVideoButton(cardEl, cardId);
    }
    catch (e) { /* ignore */ }
}
function _createCardCostBadge(cost: any, tierClass: any) {
    const costBadge = document.createElement('div');
    costBadge.className = 'card-cost-badge';
    if (tierClass) {
        costBadge.classList.add(tierClass);
    }
    const valueSpan = document.createElement('span');
    valueSpan.className = 'cost-value';
    valueSpan.textContent = String(cost);
    const labelSpan = document.createElement('span');
    labelSpan.className = 'cost-label';
    labelSpan.textContent = 'cost';
    costBadge.appendChild(valueSpan);
    costBadge.appendChild(labelSpan);
    return costBadge;
}
function _removeCardCostTierClasses(el: any) {
    if (!el || !el.classList)
        return;
    Array.from(el.classList).forEach((className) => {
        if (typeof className === 'string' && className.indexOf('cost-tier-') === 0) {
            el.classList.remove(className);
        }
    });
}
function _findRootCardCostBadge(cardEl: any) {
    if (!cardEl || typeof cardEl.querySelectorAll !== 'function')
        return null;
    const badges = Array.from(cardEl.querySelectorAll('.card-cost-badge'));
    return badges.find((badge: any) => badge && badge.parentElement === cardEl) || null;
}
function _syncCardCostBadgeForRender(cardEl: any, cost: any) {
    if (!cardEl || !cardEl.classList || cardEl.classList.contains('special-card-face'))
        return;
    const safeCost = Number.isFinite(Number(cost)) ? Number(cost) : 0;
    const tierClass = `cost-tier-${getCardCostTier(safeCost)}`;
    _removeCardCostTierClasses(cardEl);
    cardEl.classList.add(tierClass);
    let costBadge: any = _findRootCardCostBadge(cardEl);
    if (!costBadge) {
        costBadge = _createCardCostBadge(safeCost, tierClass);
        cardEl.appendChild(costBadge);
    }
    _removeCardCostTierClasses(costBadge);
    costBadge.classList.add(tierClass);
    const valueSpan = costBadge.querySelector ? costBadge.querySelector('.cost-value') : null;
    if (valueSpan) {
        _setTextContentIfChanged(valueSpan, safeCost);
    }
    const labelSpan = costBadge.querySelector ? costBadge.querySelector('.cost-label') : null;
    if (labelSpan) {
        _setTextContentIfChanged(labelSpan, 'cost');
    }
    _setDatasetValueIfChanged(cardEl, 'effectiveCost', safeCost);
}
var _lastChargeForDelta = { black: null, white: null, turnIndex: null };
function _normalizeChargeValueForRender(value: any) {
    return Number.isFinite(Number(value))
        ? Number(value)
        : 0;
}
function _renderChargeDisplay(el: any, currentValue: any, maxValue: any) {
    if (!el)
        return;
    const safeCurrent = _normalizeChargeValueForRender(currentValue);
    const safeMax = _normalizeChargeValueForRender(maxValue);
    let labelEl = el.querySelector('.charge-label');
    let currentEl = el.querySelector('.charge-current');
    let separatorEl = el.querySelector('.charge-separator');
    let maxEl = el.querySelector('.charge-max');
    if (!labelEl && typeof document !== 'undefined') {
        labelEl = document.createElement('span');
        labelEl.className = 'charge-label';
    }
    if (!currentEl && typeof document !== 'undefined') {
        currentEl = document.createElement('span');
        currentEl.className = 'charge-current';
    }
    if (!separatorEl && typeof document !== 'undefined') {
        separatorEl = document.createElement('span');
        separatorEl.className = 'charge-separator';
    }
    if (!maxEl && typeof document !== 'undefined') {
        maxEl = document.createElement('span');
        maxEl.className = 'charge-max';
    }
    const badgeEl = el.querySelector('.time-stop-status-badge');
    const orderedNodes = [labelEl, currentEl, separatorEl, maxEl].filter(Boolean);
    let insertBeforeNode = badgeEl || null;
    for (let i = orderedNodes.length - 1; i >= 0; i -= 1) {
        const node = orderedNodes[i];
        if (node.parentElement !== el || node.nextSibling !== insertBeforeNode) {
            el.insertBefore(node, insertBeforeNode);
        }
        insertBeforeNode = node;
    }
    if (labelEl)
        _setTextContentIfChanged(labelEl, '布石: ');
    if (currentEl)
        _setTextContentIfChanged(currentEl, safeCurrent);
    if (separatorEl)
        _setTextContentIfChanged(separatorEl, ' / ');
    if (maxEl)
        _setTextContentIfChanged(maxEl, safeMax);
}
function _resetChargeDeltaBaseline() {
    _lastChargeForDelta.black = null;
    _lastChargeForDelta.white = null;
    _lastChargeForDelta.turnIndex = null;
}
function _shouldResetChargeDeltaBaseline(currentTurnIndex: any) {
    if (currentTurnIndex === null || _lastChargeForDelta.turnIndex === null)
        return false;
    if (currentTurnIndex < _lastChargeForDelta.turnIndex)
        return true;
    return currentTurnIndex === 0 && _lastChargeForDelta.turnIndex !== 0;
}
function _readChargeDeltaSnapshot(cardState: any) {
    const chargeState = (cardState && cardState.charge && typeof cardState.charge === 'object')
        ? cardState.charge
        : { black: 0, white: 0 };
    const currentTurnIndex = (cardState && typeof cardState.turnIndex === 'number')
        ? cardState.turnIndex
        : null;
    return {
        black: _normalizeChargeValueForRender(chargeState.black),
        white: _normalizeChargeValueForRender(chargeState.white),
        turnIndex: currentTurnIndex
    };
}
function _rememberChargeDeltaSnapshot(snapshot: any) {
    if (!snapshot || typeof snapshot !== 'object') {
        _resetChargeDeltaBaseline();
        return;
    }
    _lastChargeForDelta.black = snapshot.black;
    _lastChargeForDelta.white = snapshot.white;
    _lastChargeForDelta.turnIndex = snapshot.turnIndex;
}
function _allowsRawChargeDeltaFallback(matchMode: any) {
    return matchMode !== 'network';
}
function _consumeRawChargeDeltaFallback(chargeSnapshot: any, chargeDeltaHandler: any) {
    if (!chargeSnapshot || !chargeDeltaHandler)
        return false;
    let consumed = false;
    if (_lastChargeForDelta.black !== null) {
        const deltaBlack = chargeSnapshot.black - _lastChargeForDelta.black;
        if (deltaBlack !== 0) {
            chargeDeltaHandler('black', deltaBlack);
            consumed = true;
        }
    }
    if (_lastChargeForDelta.white !== null) {
        const deltaWhite = chargeSnapshot.white - _lastChargeForDelta.white;
        if (deltaWhite !== 0) {
            chargeDeltaHandler('white', deltaWhite);
            consumed = true;
        }
    }
    return consumed;
}
function _resolveChargeMaxForRender() {
    try {
        if (typeof CHARGE_MAX !== 'undefined' && Number.isFinite(Number(CHARGE_MAX))) {
            return Number(CHARGE_MAX);
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && Number.isFinite(Number(window.CHARGE_MAX))) {
            return Number(window.CHARGE_MAX);
        }
    }
    catch (e) { /* ignore */ }
    return 99;
}
function _getCurrentMatchMode() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.getCurrentMatchMode === 'function') {
            return OwnerHelpersModule.getCurrentMatchMode(typeof window !== 'undefined' ? window : null);
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function') {
            return window.getCurrentMatchMode();
        }
        if (typeof window !== 'undefined' && window.MATCH_MODE) {
            return String(window.MATCH_MODE);
        }
    }
    catch (e) { /* ignore */ }
    return 'cpu';
}
function _getLocalPlayerKeyForNetwork() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
        }
    }
    catch (e) { /* ignore */ }
    return 'black';
}
var TIME_STOP_ACTIVE_LABEL = '時間停止発動中';
function _normalizePlayerKeyForRender(playerKey: any) {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            return OwnerHelpersModule.normalizePlayerKeyOptional(playerKey);
        }
    }
    catch (e) { /* ignore */ }
    if (playerKey === 'black' || playerKey === 1 || playerKey === '1')
        return 'black';
    if (playerKey === 'white' || playerKey === -1 || playerKey === '-1')
        return 'white';
    return null;
}
function _normalizeOwnerKeyForRender(ownerKey: any): PlayerOwnerKey | null {
    return _normalizePlayerKeyForRender(ownerKey) as PlayerOwnerKey | null;
}
function _getOpposingPlayerKeyForRender(playerKey: any) {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.getOpposingPlayerKey === 'function') {
            return OwnerHelpersModule.getOpposingPlayerKey(playerKey);
        }
    }
    catch (e) { /* ignore */ }
    const normalizedPlayerKey = _normalizePlayerKeyForRender(playerKey);
    if (!normalizedPlayerKey)
        return null;
    return normalizedPlayerKey === 'black' ? 'white' : 'black';
}
function _resolveTimeStopStatusForRender(cardState: any, viewerPlayerKey: any, gameState: any) {
    const remainingByPlayer = (cardState && cardState.timeStopConsecutiveTurnsRemainingByPlayer && typeof cardState.timeStopConsecutiveTurnsRemainingByPlayer === 'object')
        ? cardState.timeStopConsecutiveTurnsRemainingByPlayer
        : null;
    if (!remainingByPlayer) {
        return { active: false, activeOwnerKey: null, victimKey: null, viewerRole: null };
    }
    const blackRemaining = Number(remainingByPlayer.black);
    const whiteRemaining = Number(remainingByPlayer.white);
    const blackActive = Number.isFinite(blackRemaining) && blackRemaining > 0;
    const whiteActive = Number.isFinite(whiteRemaining) && whiteRemaining > 0;
    let activeOwnerKey = null;
    if (blackActive && !whiteActive) {
        activeOwnerKey = 'black';
    }
    else if (whiteActive && !blackActive) {
        activeOwnerKey = 'white';
    }
    else if (blackActive && whiteActive) {
        const currentPlayerKey = _normalizePlayerKeyForRender(gameState && gameState.currentPlayer);
        activeOwnerKey = (currentPlayerKey && Number(remainingByPlayer[currentPlayerKey]) > 0)
            ? currentPlayerKey
            : 'black';
    }
    if (!activeOwnerKey) {
        return { active: false, activeOwnerKey: null, victimKey: null, viewerRole: null };
    }
    const viewerKey = _normalizePlayerKeyForRender(viewerPlayerKey);
    const victimKey = _getOpposingPlayerKeyForRender(activeOwnerKey);
    let viewerRole = null;
    if (viewerKey === activeOwnerKey) {
        viewerRole = 'controller';
    }
    else if (viewerKey === victimKey) {
        viewerRole = 'victim';
    }
    return { active: true, activeOwnerKey, victimKey, viewerRole };
}
function _syncTimeStopChargeBadgeForRender(chargeEl: any, active: any) {
    if (!chargeEl)
        return;
    const existingBadgeEl = chargeEl.querySelector('.time-stop-status-badge');
    if (!active) {
        if (existingBadgeEl && existingBadgeEl.parentElement) {
            existingBadgeEl.parentElement.removeChild(existingBadgeEl);
        }
        return;
    }
    if (typeof document === 'undefined')
        return;
    const badgeEl = existingBadgeEl || document.createElement('div');
    badgeEl.className = 'time-stop-status-badge';
    badgeEl.textContent = TIME_STOP_ACTIVE_LABEL;
    if (badgeEl.parentElement !== chargeEl) {
        chargeEl.appendChild(badgeEl);
    }
}
function _syncTimeStopHandOverlayForRender(containerEl: any, active: any) {
    if (!containerEl)
        return;
    const existingOverlayEl = containerEl.querySelector('.time-stop-hand-overlay');
    if (!active) {
        if (existingOverlayEl && existingOverlayEl.parentElement) {
            existingOverlayEl.parentElement.removeChild(existingOverlayEl);
        }
        return;
    }
    if (typeof document === 'undefined')
        return;
    const overlayEl = existingOverlayEl || document.createElement('div');
    overlayEl.className = 'time-stop-hand-overlay';
    overlayEl.textContent = TIME_STOP_ACTIVE_LABEL;
    if (overlayEl.parentElement !== containerEl) {
        containerEl.appendChild(overlayEl);
    }
    else if (containerEl.lastElementChild !== overlayEl) {
        containerEl.appendChild(overlayEl);
    }
}
function _syncObservedHandTagForRender(cardEl: any, observed: any) {
    if (!cardEl)
        return;
    const existingTagEl = cardEl.querySelector ? cardEl.querySelector('.observed-hand-tag') : null;
    if (!observed) {
        cardEl.classList.remove('observed-hand-card');
        if (existingTagEl && existingTagEl.parentElement) {
            existingTagEl.parentElement.removeChild(existingTagEl);
        }
        return;
    }
    cardEl.classList.add('observed-hand-card');
    if (typeof document === 'undefined')
        return;
    const tagEl = existingTagEl || document.createElement('div');
    tagEl.className = 'observed-hand-tag';
    tagEl.textContent = '観測済み';
    if (tagEl.parentElement !== cardEl) {
        cardEl.appendChild(tagEl);
    }
}
function _resolveCardRendererGameState() {
    try {
        if (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object')
            return gameState;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.gameState && typeof window.gameState === 'object')
            return window.gameState;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as CardRendererRuntimeRoot).gameState && typeof (globalThis as CardRendererRuntimeRoot).gameState === 'object')
            return (globalThis as CardRendererRuntimeRoot).gameState;
    }
    catch (e) { /* ignore */ }
    return null;
}
function _resolveCardRendererCardState() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
            return cardState;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object')
            return window.cardState;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as CardRendererRuntimeRoot).cardState && typeof (globalThis as CardRendererRuntimeRoot).cardState === 'object')
            return (globalThis as CardRendererRuntimeRoot).cardState;
    }
    catch (e) { /* ignore */ }
    return null;
}
function _getCardRendererPlaybackStaleMs() {
    try {
        if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackStaleMs === 'function') {
            return PlaybackStateModule.getPlaybackStaleMs({
                root: (typeof window !== 'undefined') ? window : null
            });
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            const ms = Number(window.PASS_STALE_PLAYBACK_MS);
            if (Number.isFinite(ms) && ms > 0)
                return ms;
        }
    }
    catch (e) { /* ignore */ }
    return 3500;
}
function _isStaleVisualPlaybackLockForRender() {
    try {
        if (PlaybackStateModule && typeof PlaybackStateModule.isPlaybackStale === 'function') {
            return PlaybackStateModule.isPlaybackStale({
                root: (typeof window !== 'undefined') ? window : null
            });
        }
        if (!_isVisualPlaybackActiveForRender())
            return false;
        if (typeof window !== 'undefined' && window.AnimationEngine && typeof window.AnimationEngine.isPlaying === 'boolean') {
            return window.AnimationEngine.isPlaying !== true;
        }
        const startedAt = _getPlaybackStartedAtForRender();
        if (Number.isFinite(startedAt)) {
            return (Date.now() - startedAt) > _getCardRendererPlaybackStaleMs();
        }
    }
    catch (e) { /* ignore */ }
    return false;
}
function _isVisualPlaybackActiveForRender() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return (typeof window !== 'undefined' && window.VisualPlaybackActive === true);
}
function _getPlaybackStartedAtForRender() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackStartedAt === 'function') {
        return PlaybackStateModule.getPlaybackStartedAt();
    }
    if (typeof window === 'undefined')
        return null;
    const startedAt = Number(window.__playbackActiveSince);
    return Number.isFinite(startedAt) ? startedAt : null;
}
function _isCardAnimatingForRender() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getCardAnimating === 'function') {
        return PlaybackStateModule.getCardAnimating() === true;
    }
    return ((typeof isCardAnimating !== 'undefined' && !!isCardAnimating) ||
        (typeof window !== 'undefined' && !!window.isCardAnimating) ||
        _isVisualPlaybackActiveForRender());
}
function _isHiddenHandTokenForRender(cardId: any) {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isHiddenHandToken === 'function') {
            return OwnerHelpersModule.isHiddenHandToken(cardId);
        }
    }
    catch (e) { /* ignore */ }
    return typeof cardId === 'string' && /^__hidden_hand__:(black|white):(\d+)$/.test(cardId);
}
function _isHandCardRevealedToViewerForRender(cardState: any, viewerKey: any, ownerKey: any, handIndex: any) {
    if (!cardState || typeof cardState !== 'object')
        return false;
    const viewer = _normalizeOwnerKeyForRender(viewerKey);
    const owner = _normalizeOwnerKeyForRender(ownerKey);
    if (!viewer || !owner || viewer === owner || !Number.isInteger(Number(handIndex)))
        return false;
    const normalizedHandIndex = Math.max(0, Math.trunc(Number(handIndex)));
    try {
        if (typeof CardLogic !== 'undefined'
            && CardLogic
            && typeof CardLogic.getHandCopyIdAt === 'function'
            && typeof CardLogic.isCardCopyIdRevealedToViewer === 'function') {
            const copyId = CardLogic.getHandCopyIdAt(cardState, owner, normalizedHandIndex);
            return Number.isInteger(copyId) && CardLogic.isCardCopyIdRevealedToViewer(cardState, viewer, copyId) === true;
        }
    }
    catch (e) { /* ignore */ }
    const handCopyIdsByPlayer = (cardState._handCopyIdsByPlayer && typeof cardState._handCopyIdsByPlayer === 'object')
        ? cardState._handCopyIdsByPlayer
        : null;
    const revealedHandCopyIdsByViewer = (cardState._revealedHandCopyIdsByViewer && typeof cardState._revealedHandCopyIdsByViewer === 'object')
        ? cardState._revealedHandCopyIdsByViewer
        : null;
    const handCopyIds = handCopyIdsByPlayer && Array.isArray(handCopyIdsByPlayer[owner])
        ? handCopyIdsByPlayer[owner]
        : null;
    const revealedCopyIds = revealedHandCopyIdsByViewer && Array.isArray(revealedHandCopyIdsByViewer[viewer])
        ? revealedHandCopyIdsByViewer[viewer]
        : null;
    if (!handCopyIds || !revealedCopyIds || normalizedHandIndex >= handCopyIds.length)
        return false;
    const copyId = handCopyIds[normalizedHandIndex];
    return Number.isInteger(copyId) && revealedCopyIds.includes(copyId);
}
function _isHandCardObservedForRender(cardState: any, ownerKey: any, handIndex: any, viewerKey: any) {
    if (!cardState || typeof cardState !== 'object')
        return false;
    const owner = _normalizeOwnerKeyForRender(ownerKey);
    if (!owner || !Number.isInteger(Number(handIndex)))
        return false;
    const normalizedHandIndex = Math.max(0, Math.trunc(Number(handIndex)));
    const observedSlotsByPlayer = (cardState.observedHandSlotsByPlayer && typeof cardState.observedHandSlotsByPlayer === 'object')
        ? cardState.observedHandSlotsByPlayer
        : null;
    const observedSlots = observedSlotsByPlayer && Array.isArray(observedSlotsByPlayer[owner])
        ? observedSlotsByPlayer[owner]
        : null;
    if (observedSlots && observedSlots.includes(normalizedHandIndex))
        return true;
    const viewer = _normalizeOwnerKeyForRender(viewerKey);
    if (viewer && viewer !== owner && _hasActiveObserverWillRevealForRender(cardState, viewer, owner))
        return true;
    const handCopyIdsByPlayer = (cardState._handCopyIdsByPlayer && typeof cardState._handCopyIdsByPlayer === 'object')
        ? cardState._handCopyIdsByPlayer
        : null;
    const revealedHandCopyIdsByViewer = (cardState._revealedHandCopyIdsByViewer && typeof cardState._revealedHandCopyIdsByViewer === 'object')
        ? cardState._revealedHandCopyIdsByViewer
        : null;
    const handCopyIds = handCopyIdsByPlayer && Array.isArray(handCopyIdsByPlayer[owner])
        ? handCopyIdsByPlayer[owner]
        : null;
    if (!handCopyIds || normalizedHandIndex >= handCopyIds.length || !revealedHandCopyIdsByViewer)
        return false;
    const copyId = handCopyIds[normalizedHandIndex];
    if (!Number.isInteger(copyId))
        return false;
    for (const observerKey of ['black', 'white']) {
        if (observerKey === owner)
            continue;
        const revealedCopyIds = Array.isArray(revealedHandCopyIdsByViewer[observerKey])
            ? revealedHandCopyIdsByViewer[observerKey]
            : [];
        if (revealedCopyIds.includes(copyId))
            return true;
    }
    return false;
}
function _hasActiveObserverWillRevealForRender(cardState: any, viewerKey: any, ownerKey: any) {
    if (!cardState || typeof cardState !== 'object')
        return false;
    const viewer = _normalizeOwnerKeyForRender(viewerKey);
    const owner = _normalizeOwnerKeyForRender(ownerKey);
    if (!viewer || !owner || viewer === owner)
        return false;
    try {
        if (typeof CardLogic !== 'undefined'
            && CardLogic
            && typeof CardLogic.hasActiveObserverWillReveal === 'function') {
            return CardLogic.hasActiveObserverWillReveal(cardState, viewer, owner) === true;
        }
    }
    catch (e) { /* ignore */ }
    const markers = Array.isArray(cardState.markers) ? cardState.markers : [];
    return markers.some((marker: any) => {
        if (!marker || marker.owner !== viewer || !marker.data)
            return false;
        if (String(marker.data.type || '').toUpperCase() !== 'OBSERVER_WILL')
            return false;
        const remaining = Number(marker.data.remainingOwnerTurns);
        return !Number.isFinite(remaining) || remaining > 0;
    });
}
function _hasOwnerUsedCardThisActiveTurnForRender(cardState: any, ownerKey: any) {
    const normalizedOwnerKey = _normalizeOwnerKeyForRender(ownerKey);
    if (!cardState || typeof cardState !== 'object' || !normalizedOwnerKey)
        return false;
    if (cardState.lastTurnStartedFor !== normalizedOwnerKey)
        return false;
    return !!(cardState.hasUsedCardThisTurnByPlayer
        && cardState.hasUsedCardThisTurnByPlayer[normalizedOwnerKey]);
}
function _createHiddenHandCardElement(cardId: any, ownerKey: any) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item hidden';
    cardEl.dataset.cardId = cardId;
    cardEl.dataset.ownerKey = ownerKey;
    cardEl.textContent = 'CARD';
    return cardEl;
}
function _createCaptureReservedSlotElement() {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item capture-reserved-slot';
    cardEl.style.opacity = '0';
    cardEl.style.pointerEvents = 'none';
    cardEl.setAttribute('aria-hidden', 'true');
    return cardEl;
}
function _detachHandCardClickHandler(cardEl: any) {
    if (!cardEl || typeof cardEl !== 'object' || !cardEl.__cardClickHandler)
        return;
    try {
        cardEl.removeEventListener('click', cardEl.__cardClickHandler);
    }
    catch (e) { /* ignore */ }
    cardEl.__cardClickHandler = null;
}
function _setHandCardClickHandler(cardEl: any, clickable: any, cardId: any, ownerKey: any, handIndex?: any) {
    if (!cardEl || typeof cardEl !== 'object')
        return;
    _detachHandCardClickHandler(cardEl);
    if (!clickable || typeof onCardClick !== 'function')
        return;
    const handler = () => onCardClick(cardId, ownerKey, handIndex);
    cardEl.__cardClickHandler = handler;
    cardEl.addEventListener('click', handler);
}
function _ensureHandTrackElement(containerEl: any) {
    if (!containerEl || typeof document === 'undefined')
        return null;
    let handTrackEl = containerEl.querySelector('.hand-track');
    if (!handTrackEl) {
        handTrackEl = document.createElement('div');
        handTrackEl.className = 'hand-track';
        const overlayEl = containerEl.querySelector('.time-stop-hand-overlay');
        containerEl.insertBefore(handTrackEl, overlayEl || null);
    }
    _ensureHandAvailabilityGlowLayer(containerEl, handTrackEl);
    return handTrackEl;
}
function _ensureHandAvailabilityGlowLayer(containerEl: any, handTrackEl: any) {
    if (!containerEl || typeof document === 'undefined')
        return null;
    let glowLayerEl = containerEl.querySelector('.hand-availability-glow-layer');
    if (!glowLayerEl) {
        glowLayerEl = document.createElement('div');
        glowLayerEl.className = 'hand-availability-glow-layer';
        glowLayerEl.setAttribute('aria-hidden', 'true');
    }
    if (glowLayerEl.parentElement !== containerEl) {
        containerEl.insertBefore(glowLayerEl, handTrackEl || containerEl.firstChild || null);
    }
    else if (handTrackEl && glowLayerEl.nextSibling !== handTrackEl) {
        containerEl.insertBefore(glowLayerEl, handTrackEl);
    }
    return glowLayerEl;
}
function _resolveHandAvailabilityGlowTierClass(cardEl: any) {
    if (!cardEl || !cardEl.classList)
        return '';
    const classes = Array.from(cardEl.classList);
    return classes.find((className: any) => /^cost-tier-/.test(String(className))) || '';
}
const handGlowLayoutCacheByContainer = new WeakMap<any, {
    signature: string;
    scrollKey: string;
    dirty: boolean;
}>();
const handGlowResizeObserverByContainer = new WeakMap<any, { handTrackEl: any; observer: any }>();
let handGlowResizeListenerInstalled = false;
function _markAllHandGlowLayoutsDirty() {
    try {
        const root = typeof document !== 'undefined' ? document : null;
        if (!root)
            return;
        ['hand-black', 'hand-white'].forEach((id) => {
            const el = root.getElementById(id);
            const cache = el ? handGlowLayoutCacheByContainer.get(el) : null;
            if (cache)
                cache.dirty = true;
        });
    } catch (e) { /* ignore */ }
}
function _ensureHandGlowResizeInvalidation() {
    if (handGlowResizeListenerInstalled)
        return;
    if (typeof window === 'undefined' || !window || typeof window.addEventListener !== 'function')
        return;
    window.addEventListener('resize', _markAllHandGlowLayoutsDirty);
    handGlowResizeListenerInstalled = true;
}
function _ensureHandGlowElementResizeInvalidation(containerEl: any, handTrackEl: any) {
    if (!containerEl || !handTrackEl)
        return;
    const resizeObserverCtor = typeof ResizeObserver === 'function' ? ResizeObserver : null;
    if (!resizeObserverCtor)
        return;
    const current = handGlowResizeObserverByContainer.get(containerEl);
    if (current && current.handTrackEl === handTrackEl)
        return;
    if (current && current.observer && typeof current.observer.disconnect === 'function') {
        current.observer.disconnect();
    }
    try {
        const observer = new resizeObserverCtor(() => {
            const cache = handGlowLayoutCacheByContainer.get(containerEl);
            if (cache)
                cache.dirty = true;
        });
        observer.observe(containerEl);
        if (handTrackEl !== containerEl)
            observer.observe(handTrackEl);
        handGlowResizeObserverByContainer.set(containerEl, { handTrackEl, observer });
    }
    catch (e) { /* ResizeObserver is an optional layout invalidation path. */ }
}
function _buildHandGlowLayoutSignature(ownerKey: any, entryStates: any[]) {
    return JSON.stringify({
        ownerKey,
        entries: (Array.isArray(entryStates) ? entryStates : [])
            .filter((state: any) => state && state.desiredKind === 'face' && state.availableGlow)
            .map((state: any) => ({
                visualIndex: state.visualIndex,
                cardId: state.cardId || null,
                availableGlow: !!state.availableGlow,
                cost: Number(state.cost) || 0
            }))
    });
}
// `scrollLeft` / `scrollTop` force a synchronous layout when read after the hand DOM was
// mutated in the same render. `renderCardUI` reads them once before its own mutations and the
// glow sync reuses those values within that render pass; other callers still read live.
const handGlowScrollPrefetchByTrack = new WeakMap<any, { left: number; top: number; pass: number }>();
let handGlowScrollPrefetchPass = 0;
let handGlowScrollPrefetchActive = false;
function _prefetchHandGlowScrollPositions(containerEls: any[]) {
    handGlowScrollPrefetchPass += 1;
    handGlowScrollPrefetchActive = true;
    for (const containerEl of containerEls) {
        const handTrackEl = containerEl && typeof containerEl.querySelector === 'function'
            ? containerEl.querySelector('.hand-track')
            : null;
        if (!handTrackEl) continue;
        handGlowScrollPrefetchByTrack.set(handTrackEl, {
            left: Number(handTrackEl.scrollLeft) || 0,
            top: Number(handTrackEl.scrollTop) || 0,
            pass: handGlowScrollPrefetchPass
        });
    }
}
function _endHandGlowScrollPrefetch() {
    handGlowScrollPrefetchActive = false;
}
function _buildHandGlowScrollKey(handTrackEl: any) {
    const prefetched = handGlowScrollPrefetchActive && handTrackEl ? handGlowScrollPrefetchByTrack.get(handTrackEl) : null;
    const usePrefetched = !!(prefetched && prefetched.pass === handGlowScrollPrefetchPass);
    return JSON.stringify({
        trackScrollLeft: usePrefetched ? prefetched!.left : (Number(handTrackEl && handTrackEl.scrollLeft) || 0),
        trackScrollTop: usePrefetched ? prefetched!.top : (Number(handTrackEl && handTrackEl.scrollTop) || 0),
        childCount: handTrackEl && handTrackEl.children ? handTrackEl.children.length : 0
    });
}
function _countExpectedHandAvailabilityGlows(renderEntries: any) {
    return (Array.isArray(renderEntries) ? renderEntries : [])
        .filter((entryState: any) => entryState && entryState.desiredKind === 'face' && entryState.availableGlow)
        .length;
}
function _syncHandAvailabilityGlowLayer(containerEl: any, handTrackEl: any, renderEntries: any, ownerKey: any) {
    const glowLayerEl = _ensureHandAvailabilityGlowLayer(containerEl, handTrackEl);
    if (!glowLayerEl || !handTrackEl || typeof document === 'undefined')
        return;
    _ensureHandGlowResizeInvalidation();
    _ensureHandGlowElementResizeInvalidation(containerEl, handTrackEl);
    const signature = _buildHandGlowLayoutSignature(ownerKey, renderEntries);
    const scrollKey = _buildHandGlowScrollKey(handTrackEl);
    const expectedGlowCount = _countExpectedHandAvailabilityGlows(renderEntries);
    const cached = handGlowLayoutCacheByContainer.get(containerEl);
    if (
        cached &&
        cached.signature === signature &&
        cached.scrollKey === scrollKey &&
        cached.dirty !== true &&
        glowLayerEl.children &&
        glowLayerEl.children.length === expectedGlowCount
    ) {
        return;
    }
    const containerRect = typeof containerEl.getBoundingClientRect === 'function'
        ? containerEl.getBoundingClientRect()
        : { left: 0, top: 0 };
    const existingGlows = Array.from(glowLayerEl.children);
    let glowIndex = 0;
    (Array.isArray(renderEntries) ? renderEntries : []).forEach((entryState: any) => {
        if (!entryState || entryState.desiredKind !== 'face' || !entryState.availableGlow)
            return;
        const cardEl = handTrackEl.children[entryState.visualIndex] || null;
        if (!cardEl || !cardEl.classList || !cardEl.classList.contains('visible'))
            return;
        let glowEl: any = existingGlows[glowIndex] || null;
        if (!glowEl) {
            glowEl = document.createElement('span');
        }
        const tierClass = _resolveHandAvailabilityGlowTierClass(cardEl);
        glowEl.className = tierClass
            ? `hand-availability-glow ${tierClass}`
            : 'hand-availability-glow';
        glowEl.setAttribute('aria-hidden', 'true');
        glowEl.dataset.ownerKey = ownerKey;
        glowEl.dataset.handIndex = String(entryState.visualIndex);
        if (entryState.cardId) {
            glowEl.dataset.cardId = entryState.cardId;
        }
        else {
            delete glowEl.dataset.cardId;
        }
        const cardRect = typeof cardEl.getBoundingClientRect === 'function'
            ? cardEl.getBoundingClientRect()
            : { left: 0, top: 0, width: 0, height: 0 };
        glowEl.style.setProperty('--hand-glow-x', `${cardRect.left - containerRect.left}px`);
        glowEl.style.setProperty('--hand-glow-y', `${cardRect.top - containerRect.top}px`);
        glowEl.style.setProperty('--hand-glow-width', `${cardRect.width}px`);
        glowEl.style.setProperty('--hand-glow-height', `${cardRect.height}px`);
        if (glowEl.parentElement !== glowLayerEl) {
            glowLayerEl.appendChild(glowEl);
        }
        glowIndex += 1;
    });
    while (glowLayerEl.children.length > glowIndex) {
        glowLayerEl.removeChild(glowLayerEl.lastElementChild);
    }
    handGlowLayoutCacheByContainer.set(containerEl, { signature, scrollKey, dirty: false });
}
const handSlotElementSignatureByContainer = new WeakMap<any, string>();
function _buildHandSlotElementSignature(
    ownerKey: any,
    entryStates: any[],
    shouldFade: any,
    ownerHandLength: any,
    showTimeStopVictimOverlay: any,
    canInteract: any,
    fadeCount: any
) {
    return JSON.stringify({
        ownerKey,
        shouldFade: !!shouldFade,
        ownerHandLength,
        showTimeStopVictimOverlay: !!showTimeStopVictimOverlay,
        canInteract: !!canInteract,
        fadeCount: Number(fadeCount) || 0,
        entries: (Array.isArray(entryStates) ? entryStates : []).map((state: any) => ({
            visualIndex: state.visualIndex,
            desiredKind: state.desiredKind,
            cardId: state.cardId || null,
            actualIndex: state.actualIndex,
            isCaptureReservedSlot: !!state.isCaptureReservedSlot,
            canInspectOwnerHand: !!state.canInspectOwnerHand,
            canAfford: !!state.canAfford,
            cost: Number(state.cost) || 0,
            usable: !!state.usable,
            availableGlow: !!state.availableGlow,
            dimmed: !!state.dimmed,
            isSelected: !!state.isSelected,
            isObserved: !!state.isObserved
        }))
    });
}
function _canSkipHandElementApplication(containerEl: any, handTrackEl: any, signature: string, expectedLength: number) {
    return !!(
        containerEl
        && handTrackEl
        && handSlotElementSignatureByContainer.get(containerEl) === signature
        && handTrackEl.children
        && handTrackEl.children.length === expectedLength
    );
}
function _markHandElementApplication(containerEl: any, signature: string) {
    if (containerEl) {
        handSlotElementSignatureByContainer.set(containerEl, signature);
    }
}
function _canReuseHandCardElement(cardEl: any, desiredKind: any, cardId: any, ownerKey: any) {
    if (!cardEl || !cardEl.classList)
        return false;
    if (desiredKind === 'placeholder') {
        return cardEl.classList.contains('capture-reserved-slot');
    }
    if (desiredKind === 'hidden') {
        return cardEl.classList.contains('hidden') && !cardEl.classList.contains('capture-reserved-slot');
    }
    if (desiredKind === 'face') {
        return (cardEl.classList.contains('visible')
            && !cardEl.classList.contains('hidden')
            && !cardEl.classList.contains('capture-reserved-slot')
            && cardEl.dataset.cardId === cardId
            && cardEl.dataset.ownerKey === ownerKey);
    }
    return false;
}
function _refreshDebugHandLayoutIfNeeded() {
    try {
        if (typeof window !== 'undefined' && typeof window.refreshDebugHandLayout === 'function') {
            window.refreshDebugHandLayout();
        }
    }
    catch (e) { /* ignore */ }
}
function createCardFaceElement(cardId: any, options: any) {
    const cardDef = CARD_DEFS.find((c: any) => c.id === cardId);
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item visible';
    const isSpecialCard = _isSpecialCardFace(cardId);
    const optionCost = options && Number.isFinite(Number(options.effectiveCost)) ? Number(options.effectiveCost) : null;
    const cost = optionCost !== null ? optionCost : (cardDef ? (cardDef.cost || 0) : 0);
    const costTier = getCardCostTier(cost);
    const tierClass = `cost-tier-${costTier}`;
    cardEl.classList.add(tierClass);
    if (isSpecialCard) {
        cardEl.classList.add('special-card-face');
        cardEl.dataset.specialCardId = String(cardId || '');
    }
    const typeKey = _resolveCardDisplayTypeKey(cardDef, cardId);
    if (typeKey) {
        cardEl.dataset.cardType = typeKey;
    }
    applyCardBackgroundArtToFace(cardEl, cardDef, { cardId });
    applyCardSpecialArtToFace(cardEl, cardDef, { cardId, ownerKey: options && options.ownerKey });
    if (isSpecialCard) {
        const sigilEl = document.createElement('div');
        sigilEl.className = 'special-card-sigil';
        sigilEl.setAttribute('aria-hidden', 'true');
        cardEl.appendChild(sigilEl);
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = isSpecialCard ? 'card-name special-card-title' : 'card-name';
    nameSpan.textContent = cardDef ? cardDef.name : '?';
    cardEl.appendChild(nameSpan);
    _fitCardNameElement(nameSpan);
    if (!isSpecialCard) {
        cardEl.appendChild(_createCardCostBadge(cost, tierClass));
    }
    cardEl.dataset.cardId = cardId;
    return cardEl;
}
function _normalizeCardStateForRender(state: any) {
    if (!state || typeof state !== 'object')
        return null;
    if (!state.charge || typeof state.charge !== 'object')
        state.charge = {};
    state.charge.black = _normalizeChargeValueForRender(state.charge.black);
    state.charge.white = _normalizeChargeValueForRender(state.charge.white);
    if (!state.hands || typeof state.hands !== 'object')
        state.hands = {};
    if (!Array.isArray(state.hands.black))
        state.hands.black = [];
    if (!Array.isArray(state.hands.white))
        state.hands.white = [];
    if (!state.decks || typeof state.decks !== 'object')
        state.decks = {};
    if (!Array.isArray(state.decks.black))
        state.decks.black = [];
    if (!Array.isArray(state.decks.white))
        state.decks.white = [];
    if (!Array.isArray(state.discard))
        state.discard = [];
    if (!Array.isArray(state.chargeDeltaEvents))
        state.chargeDeltaEvents = [];
    if (!state.pendingEffectByPlayer || typeof state.pendingEffectByPlayer !== 'object') {
        state.pendingEffectByPlayer = {};
    }
    if (!Object.prototype.hasOwnProperty.call(state.pendingEffectByPlayer, 'black'))
        state.pendingEffectByPlayer.black = null;
    if (!Object.prototype.hasOwnProperty.call(state.pendingEffectByPlayer, 'white'))
        state.pendingEffectByPlayer.white = null;
    if (!state.hasUsedCardThisTurnByPlayer || typeof state.hasUsedCardThisTurnByPlayer !== 'object') {
        state.hasUsedCardThisTurnByPlayer = {};
    }
    if (!Object.prototype.hasOwnProperty.call(state.hasUsedCardThisTurnByPlayer, 'black'))
        state.hasUsedCardThisTurnByPlayer.black = false;
    if (!Object.prototype.hasOwnProperty.call(state.hasUsedCardThisTurnByPlayer, 'white'))
        state.hasUsedCardThisTurnByPlayer.white = false;
    if (!state.hasDestroyedCardThisTurnByPlayer || typeof state.hasDestroyedCardThisTurnByPlayer !== 'object') {
        state.hasDestroyedCardThisTurnByPlayer = {};
    }
    if (!Object.prototype.hasOwnProperty.call(state.hasDestroyedCardThisTurnByPlayer, 'black'))
        state.hasDestroyedCardThisTurnByPlayer.black = false;
    if (!Object.prototype.hasOwnProperty.call(state.hasDestroyedCardThisTurnByPlayer, 'white'))
        state.hasDestroyedCardThisTurnByPlayer.white = false;
    if (!state.activeEffectsByPlayer || typeof state.activeEffectsByPlayer !== 'object') {
        state.activeEffectsByPlayer = {};
    }
    if (!Array.isArray(state.activeEffectsByPlayer.black))
        state.activeEffectsByPlayer.black = [];
    if (!Array.isArray(state.activeEffectsByPlayer.white))
        state.activeEffectsByPlayer.white = [];
    return state;
}
function _resolveTransientNetworkChargeDeltaEvents() {
    try {
        if (typeof globalThis !== 'undefined' && Array.isArray((globalThis as CardRendererRuntimeRoot).__networkTransientChargeDeltaEvents)) {
            return (globalThis as CardRendererRuntimeRoot).__networkTransientChargeDeltaEvents;
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && Array.isArray(window.__networkTransientChargeDeltaEvents)) {
            return window.__networkTransientChargeDeltaEvents;
        }
    }
    catch (e) { /* ignore */ }
    return null;
}
function _setTransientNetworkChargeDeltaEvents(events: any) {
    const nextEvents = Array.isArray(events) ? events : [];
    try {
        if (typeof globalThis !== 'undefined') {
            (globalThis as CardRendererRuntimeRoot).__networkTransientChargeDeltaEvents = nextEvents;
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            window.__networkTransientChargeDeltaEvents = nextEvents;
        }
    }
    catch (e) { /* ignore */ }
}
function _clearTransientNetworkChargeDeltaEvents() {
    _setTransientNetworkChargeDeltaEvents([]);
}
function _shouldRenderChargeDeltaOnHud(ev: any) {
    return !!ev;
}
function _normalizeChargeDeltaOwnerKey(playerKey: any) {
    return _normalizePlayerKeyForRender(playerKey) === 'white' ? 'white' : 'black';
}
function _mapChargeDeltaOwnerToVisibleSlot(ownerKey: any, bottomOwnerKey: any) {
    return ownerKey === bottomOwnerKey ? 'black' : 'white';
}
function _createVisibleChargeDeltaHandler(baseChargeDeltaHandler: any, bottomOwnerKey: any) {
    if (!baseChargeDeltaHandler)
        return null;
    return (playerKey: any, delta: any, popupOptions?: ChargeDeltaPopupOptions | null) => {
        const ownerKey = _normalizeChargeDeltaOwnerKey(playerKey);
        const slotKey = _mapChargeDeltaOwnerToVisibleSlot(ownerKey, bottomOwnerKey);
        if (popupOptions) {
            baseChargeDeltaHandler(slotKey, delta, popupOptions);
        } else {
            baseChargeDeltaHandler(slotKey, delta);
        }
    };
}
function _resolveChargeDeltaPopupOptions(events: any[], signKey: string): ChargeDeltaPopupOptions | null {
    if (signKey !== 'decrease' || !Array.isArray(events) || events.length === 0) {
        return null;
    }
    const isObserverRepaymentOnly = events.every((ev) => String(ev && ev.reason || '').trim() === 'observer_will_repayment');
    return isObserverRepaymentOnly
        ? { label: '観測の代償', placement: 'above' }
        : null;
}
function _collectHudChargeDeltaTotalsBySign(events: any) {
    const list = Array.isArray(events) ? events : [];
    const totals = { increase: 0, decrease: 0 };
    const eventsBySign: Record<string, any[]> = { increase: [], decrease: [] };
    const signOrder = [];
    for (const ev of list) {
        const delta = Number(ev && ev.delta ? ev.delta : 0);
        if (!Number.isFinite(delta) || delta === 0)
            continue;
        const signKey = delta > 0 ? 'increase' : 'decrease';
        if (totals[signKey] === 0)
            signOrder.push(signKey);
        totals[signKey] += delta;
        eventsBySign[signKey].push(ev);
    }
    return { totals, eventsBySign, signOrder };
}
function consumeChargeDeltaEventList(eventsSource: any, chargeDeltaHandler: any) {
    if (!Array.isArray(eventsSource) || eventsSource.length === 0) {
        return false;
    }
    if (!chargeDeltaHandler) {
        return false;
    }
    const events = eventsSource
        .filter((ev) => ev && Number.isFinite(Number(ev.delta)) && Number(ev.delta) !== 0)
        .sort((a, b) => {
        const sa = Number(a.seq || 0);
        const sb = Number(b.seq || 0);
        return sa - sb;
    });
    eventsSource.length = 0;
    if (events.length === 0)
        return events.length > 0;
    const hudEvents = events.filter((ev) => _shouldRenderChargeDeltaOnHud(ev));
    if (hudEvents.length === 0)
        return events.length > 0;
    const eventsByPlayer: Record<PlayerOwnerKey, any[]> = { black: [], white: [] };
    const playerOrder: PlayerOwnerKey[] = [];
    for (const ev of hudEvents) {
        const player = _normalizeChargeDeltaOwnerKey(ev.player) as PlayerOwnerKey;
        if (eventsByPlayer[player].length === 0)
            playerOrder.push(player);
        eventsByPlayer[player].push(ev);
    }
    for (const player of playerOrder) {
        const playerEvents = eventsByPlayer[player];
        const { totals, eventsBySign, signOrder } = _collectHudChargeDeltaTotalsBySign(playerEvents);
        for (const signKey of signOrder) {
            const totalDelta = totals[signKey as keyof typeof totals];
            if (totalDelta !== 0) {
                chargeDeltaHandler(player, totalDelta, _resolveChargeDeltaPopupOptions(eventsBySign[signKey], signKey));
            }
        }
    }
    return true;
}
function consumeChargeDeltaEvents(cardState: any, chargeDeltaHandler: any) {
    const events = (cardState && Array.isArray(cardState.chargeDeltaEvents))
        ? cardState.chargeDeltaEvents
        : null;
    return consumeChargeDeltaEventList(events, chargeDeltaHandler);
}
function consumeTransientNetworkChargeDeltaEvents(chargeDeltaHandler: any) {
    return consumeChargeDeltaEventList(_resolveTransientNetworkChargeDeltaEvents(), chargeDeltaHandler);
}
function consumeChargeDeltaSourcesForRender(cardState: any, matchMode: any, chargeDeltaHandler: any) {
    const consumedAuthoritativeQueue = consumeChargeDeltaEvents(cardState, chargeDeltaHandler);
    if (consumedAuthoritativeQueue) {
        _clearTransientNetworkChargeDeltaEvents();
        return {
            consumedAuthoritativeQueue: true,
            consumedTransientQueue: false,
            allowRawFallback: _allowsRawChargeDeltaFallback(matchMode)
        };
    }
    return {
        consumedAuthoritativeQueue: false,
        consumedTransientQueue: consumeTransientNetworkChargeDeltaEvents(chargeDeltaHandler),
        allowRawFallback: _allowsRawChargeDeltaFallback(matchMode)
    };
}
function _resolveVisibleChargeOwners(matchMode: any) {
    const isNetworkMode = matchMode === 'network';
    const localPlayerKey = isNetworkMode ? _getLocalPlayerKeyForNetwork() : null;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveVisibleOwnerLayout === 'function') {
            return OwnerHelpersModule.resolveVisibleOwnerLayout({
                bottomOwnerKey: isNetworkMode ? localPlayerKey : 'black',
                defaultBottomOwnerKey: 'black',
                defaultTopOwnerKey: 'white'
            });
        }
    }
    catch (e) { /* ignore */ }
    const bottomOwnerKey = isNetworkMode
        ? localPlayerKey
        : 'black';
    return {
        bottomOwnerKey,
        topOwnerKey: bottomOwnerKey === 'black' ? 'white' : 'black'
    };
}

function renderVisibleChargeDisplays(cardStateOverride?: any, options?: any) {
    const state = _normalizeCardStateForRender(cardStateOverride || _resolveCardRendererCardState());
    if (!state) return false;

    const opts = (options && typeof options === 'object') ? options : {};
    const matchMode = opts.matchMode || _getCurrentMatchMode();
    const visibleOwners = _resolveVisibleChargeOwners(matchMode);
    const chargeBlackEl = document.getElementById('charge-black');
    const chargeWhiteEl = document.getElementById('charge-white');
    const chargeMax = _resolveChargeMaxForRender();

    if (chargeBlackEl) {
        _renderChargeDisplay(chargeBlackEl, state.charge[visibleOwners.bottomOwnerKey] || 0, chargeMax);
    }
    if (chargeWhiteEl) {
        _renderChargeDisplay(chargeWhiteEl, state.charge[visibleOwners.topOwnerKey] || 0, chargeMax);
    }
    return true;
}

function _drainChargeDeltaPopups(cardState: any, options: any) {
    const state = _normalizeCardStateForRender(cardState);
    if (!state) {
        return {
            consumedAuthoritativeQueue: false,
            consumedTransientQueue: false,
            consumedRawFallback: false
        };
    }
    const opts = (options && typeof options === 'object') ? options : {};
    const matchMode = opts.matchMode || _getCurrentMatchMode();
    const visibleOwners = _resolveVisibleChargeOwners(matchMode);
    const baseChargeDeltaHandler = (typeof window !== 'undefined' && window.StoneVisuals && typeof window.StoneVisuals.showChargeDelta === 'function')
        ? window.StoneVisuals.showChargeDelta
        : null;
    const chargeDeltaHandler = _createVisibleChargeDeltaHandler(baseChargeDeltaHandler, visibleOwners.bottomOwnerKey);
    const chargeSnapshot = _readChargeDeltaSnapshot(state);
    if (_shouldResetChargeDeltaBaseline(chargeSnapshot.turnIndex)) {
        _resetChargeDeltaBaseline();
    }
    const consumedChargeDeltaSources = consumeChargeDeltaSourcesForRender(state, matchMode, chargeDeltaHandler);
    let consumedRawFallback = false;
    if (opts.allowRawFallback !== false
        && consumedChargeDeltaSources.allowRawFallback
        && !consumedChargeDeltaSources.consumedAuthoritativeQueue
        && !consumedChargeDeltaSources.consumedTransientQueue) {
        consumedRawFallback = _consumeRawChargeDeltaFallback(chargeSnapshot, chargeDeltaHandler);
    }
    const shouldRememberSnapshot = opts.allowRawFallback !== false
        || consumedChargeDeltaSources.consumedAuthoritativeQueue
        || consumedChargeDeltaSources.consumedTransientQueue
        || consumedRawFallback;
    if (shouldRememberSnapshot) {
        _rememberChargeDeltaSnapshot(chargeSnapshot);
    }
    return {
        consumedAuthoritativeQueue: consumedChargeDeltaSources.consumedAuthoritativeQueue,
        consumedTransientQueue: consumedChargeDeltaSources.consumedTransientQueue,
        consumedRawFallback
    };
}
function drainVisibleChargeDeltaPopups(options: any) {
    return _drainChargeDeltaPopups(_resolveCardRendererCardState(), options);
}
let _playerSlotElementResolverForRender: any = null;
function _getPlayerSlotElementResolverForRender() {
    if (_playerSlotElementResolverForRender) return _playerSlotElementResolverForRender;
    if (PlayerSlotElementsModule && typeof PlayerSlotElementsModule.createPlayerSlotElementResolver === 'function') {
        _playerSlotElementResolverForRender = PlayerSlotElementsModule.createPlayerSlotElementResolver({
            getDocumentRef: () => (typeof document !== 'undefined' ? document : null),
            getOwnerHelpersModule: () => OwnerHelpersModule
        });
        return _playerSlotElementResolverForRender;
    }
    return null;
}
function _getPlayerSlotElementsForRender() {
    const resolver = _getPlayerSlotElementResolverForRender();
    if (resolver && typeof resolver.getPlayerSlotElements === 'function') {
        return resolver.getPlayerSlotElements();
    }
    return {
        deckBlackEl: document.getElementById('deck-black'),
        deckWhiteEl: document.getElementById('deck-white'),
        handBlackEl: document.getElementById('hand-black'),
        handWhiteEl: document.getElementById('hand-white')
    };
}
// 手番側に置けるマスが無いか（配置封じを含む）。card-interaction のパスボタン判定と同じ。判定できない時は false（暗くしない）。
function _resolveTurnWithoutPlacementForRender(cardState: any, gameState: any, turnOwnerKey: string): boolean {
    try {
        if (CardLogicModule && typeof CardLogicModule.isPlacementLockedForPlayer === 'function'
            && CardLogicModule.isPlacementLockedForPlayer(cardState, turnOwnerKey) === true) {
            return true;
        }
        if (!gameState || !CoreLogicModule || typeof CoreLogicModule.getLegalMoves !== 'function') {
            return false;
        }
        const context = (CardLogicModule && typeof CardLogicModule.getCardContext === 'function')
            ? CardLogicModule.getCardContext(cardState)
            : { protectedStones: [], permaProtectedStones: [], bombs: [] };
        const moves = CoreLogicModule.getLegalMoves(gameState, gameState.currentPlayer, context);
        return Array.isArray(moves) && moves.length === 0;
    }
    catch (e) { /* 判定できない時は暗くしない */ }
    return false;
}
function renderCardUI() {
    const gameState = _resolveCardRendererGameState();
    const cardState = _normalizeCardStateForRender(_resolveCardRendererCardState());
    if (!gameState || !Array.isArray(gameState.board) || gameState.board.length <= 0 || !cardState) {
        return;
    }
    const slotElements = _getPlayerSlotElementsForRender();
    _prefetchHandGlowScrollPositions([slotElements.handBlackEl, slotElements.handWhiteEl]);
    try {
        return _renderCardUIWithPrefetchedLayout(gameState, cardState, slotElements);
    } finally {
        _endHandGlowScrollPrefetch();
    }
}
function _renderCardUIWithPrefetchedLayout(gameState: any, cardState: any, slotElements: any) {
    const { deckBlackEl, deckWhiteEl, handBlackEl, handWhiteEl } = slotElements;
    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    const matchMode = _getCurrentMatchMode();
    const visibleOwners = _resolveVisibleChargeOwners(matchMode);
    const isNetworkMode = matchMode === 'network';
    const bottomOwnerKey = visibleOwners.bottomOwnerKey;
    const topOwnerKey = visibleOwners.topOwnerKey;
    const localPlayerKey = isNetworkMode ? bottomOwnerKey : null;
    if (deckBlackEl)
        _setDatasetValueIfChanged(deckBlackEl, 'ownerKey', bottomOwnerKey);
    if (deckWhiteEl)
        _setDatasetValueIfChanged(deckWhiteEl, 'ownerKey', topOwnerKey);
    const chargeBlackEl = document.getElementById('charge-black');
    const chargeWhiteEl = document.getElementById('charge-white');
    renderVisibleChargeDisplays(cardState, { matchMode });
    _drainChargeDeltaPopups(cardState, { matchMode });
    const decks = (cardState && cardState.decks && typeof cardState.decks === 'object') ? cardState.decks : null;
    const deckCountBlack = (decks && Array.isArray(decks.black))
        ? decks.black.length
        : (Array.isArray(cardState.deck) ? cardState.deck.length : 0);
    const deckCountWhite = (decks && Array.isArray(decks.white))
        ? decks.white.length
        : (Array.isArray(cardState.deck) ? cardState.deck.length : 0);
    const initialByPlayer = (cardState && cardState.initialDeckSizeByPlayer && typeof cardState.initialDeckSizeByPlayer === 'object')
        ? cardState.initialDeckSizeByPlayer
        : null;
    const totalBlack = Number.isFinite(initialByPlayer && initialByPlayer.black)
        ? initialByPlayer.black
        : (Number.isFinite(cardState.initialDeckSize) ? cardState.initialDeckSize : 30);
    const totalWhite = Number.isFinite(initialByPlayer && initialByPlayer.white)
        ? initialByPlayer.white
        : (Number.isFinite(cardState.initialDeckSize) ? cardState.initialDeckSize : 30);
    const deckRatioBlack = Math.max(0, Math.min(1, deckCountBlack / Math.max(1, totalBlack)));
    const deckRatioWhite = Math.max(0, Math.min(1, deckCountWhite / Math.max(1, totalWhite)));
    const deckVisualByOwner = {
        black: { count: deckCountBlack, total: totalBlack, ratio: deckRatioBlack },
        white: { count: deckCountWhite, total: totalWhite, ratio: deckRatioWhite }
    };
    const bottomDeckVisual = deckVisualByOwner[bottomOwnerKey as PlayerOwnerKey] || deckVisualByOwner.black;
    const topDeckVisual = deckVisualByOwner[topOwnerKey as PlayerOwnerKey] || deckVisualByOwner.white;
    // Set visuals for Black deck
    if (deckBlackEl) {
        _setStylePropertyIfChanged(deckBlackEl, '--deck-ratio', bottomDeckVisual.ratio);
        const countLabel = deckBlackEl.querySelector('.deck-count');
        if (countLabel)
            _setTextContentIfChanged(countLabel, `${bottomDeckVisual.count}/${bottomDeckVisual.total}`);
    }
    // Set visuals for White deck
    if (deckWhiteEl) {
        _setStylePropertyIfChanged(deckWhiteEl, '--deck-ratio', topDeckVisual.ratio);
        const countLabel = deckWhiteEl.querySelector('.deck-count');
        if (countLabel)
            _setTextContentIfChanged(countLabel, `${topDeckVisual.count}/${topDeckVisual.total}`);
    }
    const isBlackTurn = gameState.currentPlayer === BLACK;
    // 終局は連続パス 2 だけ（Core.isGameOver と同じ判定）。
    const isTerminalForRender = Number(gameState.consecutivePasses) >= 2;
    // パスできる場面（手番側に置けるマスが無い）は、パスボタンと同じ判定で一度だけ求める（01-rulebook.md §8.4）。
    let currentTurnHasNoPlacementForRender: boolean | null = null;
    function _isCurrentTurnWithoutPlacementForRender() {
        if (currentTurnHasNoPlacementForRender === null) {
            currentTurnHasNoPlacementForRender = _resolveTurnWithoutPlacementForRender(cardState, gameState, isBlackTurn ? 'black' : 'white');
        }
        return currentTurnHasNoPlacementForRender === true;
    }
    const isAnimating = _isCardAnimatingForRender();
    const staleVisualPlaybackLock = _isStaleVisualPlaybackLockForRender();
    const isDebugUnlimited = (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true);
    const currentTurnOwnerKey = isBlackTurn ? 'black' : 'white';
    const fateWillControllerKey = (cardState.fateWillControllerByTurnOwner && cardState.fateWillControllerByTurnOwner[currentTurnOwnerKey]) || null;
    const fateWillVictimKey = fateWillControllerKey ? currentTurnOwnerKey : null;
    const fateWillIsActive = !!fateWillControllerKey;
    const inputPlayerKey = isNetworkMode
        ? localPlayerKey
        : (isDebugHvH ? (fateWillControllerKey || (isBlackTurn ? 'black' : 'white')) : 'black');
    const localRevealViewerKey = isNetworkMode ? null : _getLocalPlayerKeyForNetwork();
    const pendingOwnerKey = fateWillControllerKey && inputPlayerKey === fateWillControllerKey
        ? currentTurnOwnerKey
        : inputPlayerKey;
    const pending = cardState.pendingEffectByPlayer[pendingOwnerKey];
    const canInteract = !isAnimating || staleVisualPlaybackLock || isDebugUnlimited;
    const timeStopStatus = _resolveTimeStopStatusForRender(cardState, inputPlayerKey, gameState);
    const fadeState = (HandFadeStateModule && typeof HandFadeStateModule.getQueuedHandFadeInState === 'function')
        ? HandFadeStateModule.getQueuedHandFadeInState()
        : ((typeof window !== 'undefined')
            ? (window.__handFadeInState || window.__handFadeInHint || null)
            : null);
    const fadePlayerKey = fadeState && fadeState.playerKey ? fadeState.playerKey : null;
    const fadeCount = fadeState && Number.isFinite(fadeState.count) ? fadeState.count : 0;
    const handRevealState = (typeof window !== 'undefined' && window.__handSequentialRevealState && typeof window.__handSequentialRevealState === 'object')
        ? window.__handSequentialRevealState
        : null;
    const revealPlayerKey = handRevealState ? _normalizeOwnerKeyForRender(handRevealState.playerKey) : null;
    const revealVisibleCount = (handRevealState && Number.isFinite(handRevealState.visibleCount))
        ? Math.max(0, Math.trunc(handRevealState.visibleCount))
        : null;
    const captureReservedState = (typeof window !== 'undefined' && window.__captureReservedHandSlotState && typeof window.__captureReservedHandSlotState === 'object')
        ? window.__captureReservedHandSlotState
        : null;
    const reservedPlayerKey = captureReservedState ? _normalizeOwnerKeyForRender(captureReservedState.playerKey) : null;
    const reservedHandIndex = (captureReservedState && Number.isInteger(captureReservedState.handIndex))
        ? captureReservedState.handIndex
        : null;
    function _getOwnerHandForRender(ownerKey: any) {
        const ownerHandRaw = (cardState.hands && Array.isArray(cardState.hands[ownerKey])) ? cardState.hands[ownerKey] : [];
        return (revealPlayerKey === ownerKey && Number.isFinite(revealVisibleCount))
            ? ownerHandRaw.slice(0, Math.min(ownerHandRaw.length, Number(revealVisibleCount)))
            : ownerHandRaw;
    }
    function _resolveInsertedReservedHandIndex(ownerKey: any, ownerHandLength: any) {
        const ownerPending = cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[ownerKey];
        if (ownerPending
            && ownerPending.type === 'CAPTURE_WILL'
            && ownerPending.stage === 'selectTarget'
            && Number.isInteger(ownerPending.sourceHandIndex)) {
            return Math.max(0, Math.trunc(ownerPending.sourceHandIndex));
        }
        if (reservedPlayerKey === ownerKey
            && Number.isInteger(reservedHandIndex)
            && reservedHandIndex >= ownerHandLength) {
            return reservedHandIndex;
        }
        return null;
    }
    function _buildHandRenderEntries(ownerHand: any, insertedReservedHandIndex: any) {
        const renderEntries = [];
        for (let idx = 0; idx < ownerHand.length; idx += 1) {
            if (Number.isInteger(insertedReservedHandIndex) && insertedReservedHandIndex === renderEntries.length) {
                renderEntries.push({ kind: 'capture_reserved_placeholder', visualIndex: renderEntries.length });
            }
            renderEntries.push({
                kind: 'card',
                cardId: ownerHand[idx],
                actualIndex: idx,
                visualIndex: renderEntries.length
            });
        }
        if (Number.isInteger(insertedReservedHandIndex) && insertedReservedHandIndex === renderEntries.length) {
            renderEntries.push({ kind: 'capture_reserved_placeholder', visualIndex: renderEntries.length });
        }
        return renderEntries;
    }
    const selectedOwnerKey = (cardState.selectedCardOwnerKey === 'white' || cardState.selectedCardOwnerKey === 'black')
        ? cardState.selectedCardOwnerKey
        : inputPlayerKey;
    const ruleUsableCardIdSetByOwner: Record<string, Set<string> | null | undefined> = {};
    function _isCatalogCardKnownToRuleLogicForRender(cardId: any) {
        if (!CardLogicModule || typeof CardLogicModule.getCardType !== 'function') {
            return false;
        }
        try {
            return !!CardLogicModule.getCardType(cardId);
        }
        catch (e) { /* ignore */ }
        return false;
    }
    function _getRuleUsableCardIdSetForRender(ownerKey: any) {
        const owner = _normalizeOwnerKeyForRender(ownerKey) || 'black';
        if (Object.prototype.hasOwnProperty.call(ruleUsableCardIdSetByOwner, owner)) {
            return ruleUsableCardIdSetByOwner[owner] || null;
        }
        if (!CardLogicModule || typeof CardLogicModule.getUsableCardIds !== 'function') {
            ruleUsableCardIdSetByOwner[owner] = null;
            return null;
        }
        try {
            const opts = (isDebugUnlimited || isNetworkMode) ? { skipCostAndTurnLimit: true } : undefined;
            const usableIds = CardLogicModule.getUsableCardIds(cardState, gameState, owner, opts);
            ruleUsableCardIdSetByOwner[owner] = new Set(Array.isArray(usableIds) ? usableIds : []);
            return ruleUsableCardIdSetByOwner[owner] || null;
        }
        catch (e) { /* ignore */ }
        ruleUsableCardIdSetByOwner[owner] = null;
        return null;
    }
    function _isHandCardRuleUsableForRender(ownerKey: any, cardId: any) {
        if (!cardId) {
            return false;
        }
        if (!_isCatalogCardKnownToRuleLogicForRender(cardId)) {
            return true;
        }
        const usableIdSet = _getRuleUsableCardIdSetForRender(ownerKey);
        if (usableIdSet) {
            return usableIdSet.has(cardId);
        }
        try {
            if (CardLogicModule && typeof CardLogicModule.canUseCard === 'function') {
                return !!CardLogicModule.canUseCard(cardState, ownerKey, cardId);
            }
        }
        catch (e) { /* ignore */ }
        return true;
    }
    function _resolveHandEntryViewState(entry: any, ownerKey: any, revealByDefault: any) {
        const visualIndex = entry && Number.isInteger(entry.visualIndex)
            ? entry.visualIndex
            : 0;
        const isPlaceholderOnly = !!(entry && entry.kind === 'capture_reserved_placeholder');
        const cardId = entry && entry.kind === 'card'
            ? entry.cardId
            : null;
        const actualIndex = entry && entry.kind === 'card' && Number.isInteger(entry.actualIndex)
            ? entry.actualIndex
            : null;
        const isCaptureReservedSlot = isPlaceholderOnly
            || (reservedPlayerKey === ownerKey && reservedHandIndex === visualIndex);
        const state = {
            visualIndex,
            isPlaceholderOnly,
            isCaptureReservedSlot,
            cardId,
            actualIndex,
            desiredKind: isPlaceholderOnly ? 'placeholder' : 'face',
            canInspectOwnerHand: false,
            canAfford: false,
            cost: 0,
            usable: false,
            availableGlow: false,
            dimmed: false,
            isSelected: false,
            isObserved: false
        };
        if (isPlaceholderOnly) {
            return state;
        }
        const isHiddenToken = _isHiddenHandTokenForRender(cardId);
        const isLocallyRevealedOpponentCard = !isNetworkMode
            && !revealByDefault
            && !isHiddenToken
            && (_isHandCardRevealedToViewerForRender(cardState, localRevealViewerKey, ownerKey, actualIndex)
                || _hasActiveObserverWillRevealForRender(cardState, localRevealViewerKey, ownerKey));
        const fateWillIsViewingVictim = fateWillIsActive
            && ownerKey === fateWillVictimKey
            && inputPlayerKey === fateWillControllerKey;
        const fateWillVictimLockedOut = fateWillIsActive
            && ownerKey === fateWillVictimKey
            && inputPlayerKey === fateWillVictimKey;
        const canShowFace = isNetworkMode
            ? (ownerKey === localPlayerKey || fateWillIsViewingVictim || !isHiddenToken)
            : (revealByDefault || isLocallyRevealedOpponentCard || fateWillIsViewingVictim);
        if (state.isCaptureReservedSlot) {
            state.desiredKind = 'placeholder';
            return state;
        }
        if (!canShowFace || isHiddenToken) {
            state.desiredKind = 'hidden';
            return state;
        }
        const cardDef = CARD_DEFS.find((c: any) => c.id === cardId);
        const baseCost = cardDef ? (cardDef.cost || 0) : 0;
        const cost = _getEffectiveCardCostForRender(cardState, ownerKey, cardId, state.actualIndex, baseCost);
        state.cost = cost;
        state.isObserved = _isHandCardObservedForRender(cardState, ownerKey, actualIndex, localRevealViewerKey);
        const hasNotUsedThisTurn = isDebugUnlimited ? true : !_hasOwnerUsedCardThisActiveTurnForRender(cardState, ownerKey);
        // Local non-debug play exposes controls from the black hand; this is a UI control branch, not owner normalization.
        const isOwnerTurn = ownerKey === 'black' ? isBlackTurn : !isBlackTurn;
        const canControlOwnerHand = isNetworkMode
            ? ((ownerKey === localPlayerKey && isOwnerTurn && !fateWillVictimLockedOut) || (fateWillIsViewingVictim && isOwnerTurn))
            : (isDebugHvH
                ? (isOwnerTurn && !fateWillVictimLockedOut)
                : ((ownerKey === 'black' && isOwnerTurn && !fateWillVictimLockedOut) || (fateWillIsViewingVictim && isOwnerTurn)));
        const canShowAvailabilityGlow = isNetworkMode
            ? ((ownerKey === localPlayerKey && !fateWillVictimLockedOut) || fateWillIsViewingVictim)
            : (isDebugHvH
                ? (isOwnerTurn && !fateWillVictimLockedOut)
                : ((ownerKey === 'black' && !fateWillVictimLockedOut) || fateWillIsViewingVictim));
        state.canAfford = isDebugUnlimited ? true : ((cardState.charge[ownerKey] || 0) >= cost);
        state.canInspectOwnerHand = isNetworkMode
            ? canShowFace
            : (isDebugHvH ? true : (ownerKey === 'black' || fateWillIsViewingVictim));
        // 終局後は手札を「使える」と見せない（01-rulebook.md §8.4）。
        const isRuleUsable = !isTerminalForRender && _isHandCardRuleUsableForRender(ownerKey, cardId);
        state.availableGlow = canShowAvailabilityGlow
            && hasNotUsedThisTurn
            && state.canAfford
            && isRuleUsable;
        state.usable = canControlOwnerHand
            && canInteract
            && hasNotUsedThisTurn
            && state.canAfford
            && isRuleUsable;
        // 使えないカードを暗くするのは、終局後と、自分の手番でパスできる場面だけ（01-rulebook.md §8.4）。
        const ownerPending = cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[ownerKey];
        const isOwnerSelectingTarget = !!(ownerPending && ownerPending.stage === 'selectTarget');
        state.dimmed = canShowAvailabilityGlow
            && !state.availableGlow
            && (isTerminalForRender
                || (isOwnerTurn && !isOwnerSelectingTarget && _isCurrentTurnWithoutPlacementForRender()));
        const selectedHandIndex = Number(cardState.selectedCardHandIndex);
        const hasSelectedHandIndex = Number.isInteger(selectedHandIndex) && selectedHandIndex >= 0;
        state.isSelected = cardState.selectedCardId === cardId
            && selectedOwnerKey === ownerKey
            && (!hasSelectedHandIndex || Math.trunc(selectedHandIndex) === state.actualIndex);
        return state;
    }
    function _ensureRenderedHandElement(handTrackEl: any, existingChildren: any, entryState: any, ownerKey: any) {
        let cardEl = existingChildren[entryState.visualIndex] || null;
        if (_canReuseHandCardElement(cardEl, entryState.desiredKind, entryState.cardId, ownerKey)) {
            return cardEl;
        }
        if (cardEl) {
            _detachHandCardClickHandler(cardEl);
        }
        if (entryState.desiredKind === 'placeholder') {
            cardEl = _createCaptureReservedSlotElement();
        }
        else if (entryState.desiredKind === 'hidden') {
            cardEl = _createHiddenHandCardElement(entryState.cardId, ownerKey);
        }
        else {
            cardEl = createCardFaceElement(entryState.cardId, { ownerKey, effectiveCost: entryState.cost });
        }
        const currentChild = handTrackEl.children[entryState.visualIndex] || null;
        if (currentChild) {
            handTrackEl.replaceChild(cardEl, currentChild);
        }
        else {
            handTrackEl.appendChild(cardEl);
        }
        return cardEl;
    }
    function _applyRenderedHandElementState(cardEl: any, entryState: any, ownerKey: any, shouldFade: any, ownerHandLen: any) {
        if (entryState.desiredKind === 'placeholder') {
            _detachHandCardClickHandler(cardEl);
            cardEl.className = 'card-item capture-reserved-slot';
            _syncObservedHandTagForRender(cardEl, false);
            cardEl.style.opacity = '0';
            cardEl.style.pointerEvents = 'none';
            cardEl.setAttribute('aria-hidden', 'true');
            delete cardEl.dataset.cardId;
        }
        else if (entryState.desiredKind === 'hidden') {
            _detachHandCardClickHandler(cardEl);
            cardEl.className = 'card-item hidden';
            cardEl.textContent = 'CARD';
            _syncObservedHandTagForRender(cardEl, false);
            cardEl.style.removeProperty('opacity');
            cardEl.style.removeProperty('pointer-events');
            cardEl.removeAttribute('aria-hidden');
            if (entryState.cardId) {
                cardEl.dataset.cardId = entryState.cardId;
            }
        }
        else {
            const canClick = entryState.canInspectOwnerHand && canInteract;
            _syncCardCostBadgeForRender(cardEl, entryState.cost);
            _syncCardDemoVideoButtonForRender(cardEl, entryState.cardId);
            _setHandCardClickHandler(cardEl, canClick, entryState.cardId, ownerKey, entryState.actualIndex);
            cardEl.classList.toggle('clickable', canClick);
            cardEl.classList.toggle('affordable', entryState.canAfford);
            cardEl.classList.toggle('usable', entryState.usable);
            cardEl.classList.toggle('selected', entryState.isSelected);
            cardEl.classList.toggle('hand-card-dimmed', !!entryState.dimmed);
            _syncObservedHandTagForRender(cardEl, entryState.isObserved);
            cardEl.style.removeProperty('opacity');
            cardEl.style.removeProperty('pointer-events');
            cardEl.removeAttribute('aria-hidden');
            if (entryState.cardId) {
                cardEl.dataset.cardId = entryState.cardId;
            }
        }
        cardEl.dataset.ownerKey = ownerKey;
        cardEl.dataset.handIndex = String(entryState.visualIndex);
        if (Number.isInteger(entryState.actualIndex) && entryState.actualIndex >= 0) {
            cardEl.dataset.actualHandIndex = String(entryState.actualIndex);
        }
        else {
            delete cardEl.dataset.actualHandIndex;
        }
        if (!entryState.cardId) {
            delete cardEl.dataset.cardId;
        }
        if (!entryState.isPlaceholderOnly
            && shouldFade
            && entryState.actualIndex >= Math.max(0, ownerHandLen - fadeCount)) {
            cardEl.classList.add('card-fade-prep');
        }
        else {
            cardEl.classList.remove('card-fade-prep');
        }
    }
    function renderHandSlot(containerEl: any, ownerKey: any, revealByDefault: any, visibleSlotKey: any) {
        if (!containerEl)
            return;
        _setDatasetValueIfChanged(containerEl, 'ownerKey', ownerKey);
        const showTimeStopVictimOverlay = !!(timeStopStatus.active
            && timeStopStatus.viewerRole === 'victim'
            && visibleSlotKey === 'bottom');
        containerEl.classList.toggle('time-stop-hand-overlay-active', showTimeStopVictimOverlay);
        const handTrackEl = _ensureHandTrackElement(containerEl);
        if (!handTrackEl)
            return;
        const ownerHand = _getOwnerHandForRender(ownerKey);
        const shouldFade = fadePlayerKey === ownerKey && fadeCount > 0;
        const renderEntries = _buildHandRenderEntries(ownerHand, _resolveInsertedReservedHandIndex(ownerKey, ownerHand.length));
        const existingChildren = Array.from(handTrackEl.children);
        const entryStates = renderEntries.map((entry: any) => _resolveHandEntryViewState(entry, ownerKey, revealByDefault));
        const elementSignature = _buildHandSlotElementSignature(
            ownerKey,
            entryStates,
            shouldFade,
            ownerHand.length,
            showTimeStopVictimOverlay,
            canInteract,
            fadeCount
        );
        const canSkipElementApplication = _canSkipHandElementApplication(
            containerEl,
            handTrackEl,
            elementSignature,
            entryStates.length
        );
        if (!canSkipElementApplication) {
            entryStates.forEach((entryState: any) => {
                const cardEl = _ensureRenderedHandElement(handTrackEl, existingChildren, entryState, ownerKey);
                _applyRenderedHandElementState(cardEl, entryState, ownerKey, shouldFade, ownerHand.length);
            });
            while (handTrackEl.children.length > entryStates.length) {
                const extraChild = handTrackEl.lastElementChild;
                if (!extraChild)
                    break;
                _detachHandCardClickHandler(extraChild);
                handTrackEl.removeChild(extraChild);
            }
            _markHandElementApplication(containerEl, elementSignature);
        }
        _syncHandAvailabilityGlowLayer(containerEl, handTrackEl, entryStates, ownerKey);
        _syncTimeStopHandOverlayForRender(containerEl, showTimeStopVictimOverlay);
    }
    renderHandSlot(handBlackEl, bottomOwnerKey, true, 'bottom');
    renderHandSlot(handWhiteEl, topOwnerKey, isDebugHvH === true, 'top');
    _syncTimeStopChargeBadgeForRender(chargeWhiteEl, timeStopStatus.active && timeStopStatus.viewerRole === 'controller');
    _refreshDebugHandLayoutIfNeeded();
    // Update Card Detail Panel
    updateCardDetailPanel();
    // Update Discard Display
    const discardCountEl = document.getElementById('discard-count');
    if (discardCountEl) {
        _setTextContentIfChanged(discardCountEl, cardState.discard.length);
    }
    // Update Active Effect Slots (Phase 2: always empty)
    const activeBlackEl = document.getElementById('active-black');
    const activeWhiteEl = document.getElementById('active-white');
    if (activeBlackEl) {
        const content = activeBlackEl.querySelector('.effect-slot-content');
        if (content) {
            const effects = (cardState.activeEffectsByPlayer && cardState.activeEffectsByPlayer.black) || [];
            _setTextContentIfChanged(content, effects.length > 0 ? effects.map((e: any) => e.name).join(', ') : 'なし');
        }
    }
    if (activeWhiteEl) {
        const content = activeWhiteEl.querySelector('.effect-slot-content');
        if (content) {
            const effects = cardState.activeEffectsByPlayer.white;
            _setTextContentIfChanged(content, effects.length > 0 ? effects.map((e: any) => e.name).join(', ') : 'なし');
        }
    }
    void scheduleCardNameRefitAfterFontsReady(document);
}
try {
    if (typeof window !== 'undefined') {
        window.drainVisibleChargeDeltaPopups = drainVisibleChargeDeltaPopups;
        window.renderVisibleChargeDisplays = renderVisibleChargeDisplays;
    }
}
catch (e) { /* ignore */ }
export = {
    getCardCostTier,
    applyCardSpecialArtToFace,
    resolveCardBackgroundArtPath,
    createCardFaceElement,
    consumeChargeDeltaEventList,
    consumeChargeDeltaEvents,
    consumeTransientNetworkChargeDeltaEvents,
    consumeChargeDeltaSourcesForRender,
    drainVisibleChargeDeltaPopups,
    renderVisibleChargeDisplays,
    refitAllCardNameElements,
    scheduleCardNameRefitAfterFontsReady,
    renderCardUI
};
