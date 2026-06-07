export {};

type CardInteractionDetailPanelDeps = {
    effectsModule?: any;
    getQuickCardEffect: (cardDef: any) => any;
    getDetailCardEffect: (cardDef: any) => any;
    resolveChargeMaxText: () => any;
    isHiddenHandToken: (cardId: any) => boolean;
    getDocumentRef: () => any;
    getCardStateValue: () => any;
    getGameStateValue: () => any;
    getCardLogic: () => any;
    getRiboWillUnlockTurnIndex: () => number;
};

export function createCardInteractionDetailPanel(deps: CardInteractionDetailPanelDeps) {
    const cfg = (deps && typeof deps === 'object') ? deps : {} as CardInteractionDetailPanelDeps;

    function resolveCardDescriptionTextsForCardUi(cardDef: any) {
        const effectsModule = cfg.effectsModule;
        if (effectsModule && typeof effectsModule.resolveCardDescriptionTexts === 'function') {
            return effectsModule.resolveCardDescriptionTexts(cardDef, {
                resolveChargeMaxText: cfg.resolveChargeMaxText,
                quickTextMaxLength: 32
            });
        }

        const quickText = effectsModule && typeof effectsModule.getQuickCardEffect === 'function'
            ? effectsModule.getQuickCardEffect(cardDef, { maxLength: 32 })
            : cfg.getQuickCardEffect(cardDef);
        const detailText = effectsModule && typeof effectsModule.getDetailCardEffect === 'function'
            ? effectsModule.getDetailCardEffect(cardDef, cfg.resolveChargeMaxText)
            : cfg.getDetailCardEffect(cardDef);
        const distinctDetailText = effectsModule && typeof effectsModule.resolveNonDuplicateDetailText === 'function'
            ? effectsModule.resolveNonDuplicateDetailText(quickText, detailText)
            : detailText;
        const effectTags = effectsModule && typeof effectsModule.resolveCardEffectTags === 'function'
            ? effectsModule.resolveCardEffectTags(cardDef)
            : (effectsModule && typeof effectsModule.resolveCardNumericTags === 'function'
                ? effectsModule.resolveCardNumericTags(cardDef)
                : []);
        const numericTags = effectsModule && typeof effectsModule.resolveCardNumericTags === 'function'
            ? effectsModule.resolveCardNumericTags(cardDef)
            : [];
        return {
            quickText,
            detailText,
            distinctDetailText,
            effectTags,
            numericTags
        };
    }

    function stripCardDetailTagPhrases(text: any) {
        let normalized = String(text || '');
        if (!normalized) return '';
        const patterns = [
            /反転保護を持つ特殊石として扱われ、/g,
            /反転保護を持つ特殊石として扱う。?/g,
            /反転保護を持つ特殊石。?/g,
            /反転保護を持つ。?/g,
            /特殊石として扱われ、/g,
            /特殊石として扱う。?/g
        ];
        for (const pattern of patterns) {
            normalized = normalized.replace(pattern, '');
        }
        normalized = normalized
            .replace(/\s+/g, ' ')
            .replace(/。{2,}/g, '。')
            .replace(/^\s*[、。]+/, '')
            .replace(/[、。]+\s*$/, '')
            .trim();
        if (!normalized) return '';
        if (!/[。！？!?]$/.test(normalized)) normalized = `${normalized}。`;
        return normalized;
    }

    function getSalvationWillLiveStateText(ownerKey: any) {
        const cardLogic = cfg.getCardLogic();
        const cardStateValue = cfg.getCardStateValue();
        if (!ownerKey || !cardLogic || typeof cardLogic.getSalvationWillTargetCount !== 'function') return '';
        const count = Math.max(0, Number(cardLogic.getSalvationWillTargetCount(cardStateValue, ownerKey)) || 0);
        return count <= 0 ? '救済不可能' : `${count}個救済可能`;
    }

    function getEqualityWillLiveStateText() {
        const cardLogic = cfg.getCardLogic();
        const gameStateValue = cfg.getGameStateValue();
        if (!cardLogic || typeof cardLogic.getEqualityWillBoardCounts !== 'function') return '';
        const counts = cardLogic.getEqualityWillBoardCounts(gameStateValue);
        const black = Math.max(0, Number(counts && counts.black) || 0);
        const white = Math.max(0, Number(counts && counts.white) || 0);
        return `（黒${black}／白${white}）`;
    }

    function getReinforcementWillLiveStateText(ownerKey: any) {
        const cardLogic = cfg.getCardLogic();
        const cardStateValue = cfg.getCardStateValue();
        const gameStateValue = cfg.getGameStateValue();
        if (!ownerKey || !cardLogic || typeof cardLogic.getReinforcementWillTargetCount !== 'function') return '';
        const count = Math.max(0, Number(cardLogic.getReinforcementWillTargetCount(cardStateValue, gameStateValue, ownerKey)) || 0);
        return count <= 0 ? '増援不可能' : `${count}マス候補`;
    }

    function getSupportTroopsWillLiveStateText(ownerKey: any) {
        const cardLogic = cfg.getCardLogic();
        const cardStateValue = cfg.getCardStateValue();
        const gameStateValue = cfg.getGameStateValue();
        if (!ownerKey || !cardLogic || typeof cardLogic.getSupportTroopsWillTargetCount !== 'function') return '';
        const count = Math.max(0, Number(cardLogic.getSupportTroopsWillTargetCount(cardStateValue, gameStateValue, ownerKey)) || 0);
        return count <= 0 ? '援軍不可能' : `${count}マス候補`;
    }

    function getCardDetailLiveStateText(cardDef: any, ownerKey: any) {
        if (!cardDef || !ownerKey) return '';
        if (cardDef.type === 'THEORY_INCARNATION') {
            const cardStateValue = cfg.getCardStateValue();
            const totals = cardStateValue && cardStateValue.numberCellCollectedTotalByPlayer;
            const collected = Number(totals && totals[ownerKey] || 0);
            const safeCollected = Number.isFinite(collected) ? Math.max(0, Math.floor(collected)) : 0;
            return `数字合計 ${safeCollected}/42`;
        }
        if (cardDef.type === 'SALVATION_WILL') {
            return getSalvationWillLiveStateText(ownerKey);
        }
        if (cardDef.type === 'REINFORCEMENT_WILL') {
            return getReinforcementWillLiveStateText(ownerKey);
        }
        if (cardDef.type === 'SUPPORT_TROOPS_WILL') {
            return getSupportTroopsWillLiveStateText(ownerKey);
        }
        if (cardDef.type === 'EQUALITY_WILL') {
            return getEqualityWillLiveStateText();
        }
        if (cardDef.type === 'RIBO_WILL') {
            const cardStateValue = cfg.getCardStateValue();
            const turnIndex = Number(cardStateValue && cardStateValue.turnIndex);
            return Number.isFinite(turnIndex) && turnIndex < cfg.getRiboWillUnlockTurnIndex()
                ? '18手後使用可能'
                : '';
        }
        return '';
    }

    function normalizeResolvedCardEffectTags(tags: any) {
        if (!Array.isArray(tags)) return [];
        const normalizedTags = [];
        const seen = new Set();
        for (const rawTag of tags) {
            if (!rawTag || typeof rawTag !== 'object') continue;
            const label = String(rawTag.label || '').trim();
            if (!label) continue;
            const kind = String(rawTag.kind || '').trim().toLowerCase();
            const dedupeKey = `${kind}:${label}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            normalizedTags.push({ kind, label });
        }
        return normalizedTags;
    }

    function getCardEffectTagKindClass(kind: any) {
        const normalizedKind = String(kind || '').trim().toLowerCase();
        if (!normalizedKind) return '';
        return `is-${normalizedKind.replace(/[^a-z0-9]+/g, '-')}`;
    }

    function renderCardDetailLiveState(stateEl: any, text: any) {
        if (!stateEl) return;
        const normalized = String(text || '').trim();
        stateEl.textContent = normalized;
        stateEl.style.display = normalized ? 'block' : 'none';
    }

    function renderCardDetailEffectTags(tagsEl: any, tags: any) {
        if (!tagsEl) return;
        const documentRef = cfg.getDocumentRef();
        if (!documentRef) return;
        tagsEl.textContent = '';
        const normalizedTags = normalizeResolvedCardEffectTags(tags);
        if (normalizedTags.length === 0) {
            tagsEl.style.display = 'none';
            return;
        }

        for (const tag of normalizedTags) {
            const chip = documentRef.createElement('button');
            chip.type = 'button';
            chip.className = 'card-detail-effect-tag card-detail-effect-tag-button';
            const kindClass = getCardEffectTagKindClass(tag.kind);
            if (kindClass) chip.classList.add(kindClass);
            chip.textContent = tag.label;
            chip.setAttribute('data-card-tag-kind', tag.kind || '');
            chip.setAttribute('data-card-tag-label', tag.label);
            chip.setAttribute('aria-label', `${tag.label}の説明を表示`);
            tagsEl.appendChild(chip);
        }
        tagsEl.style.display = 'flex';
    }

    function ensureCardDetailEffectTagsElement() {
        const documentRef = cfg.getDocumentRef();
        if (!documentRef) return null;
        let tagsEl = documentRef.getElementById('card-detail-effect-tags');
        if (tagsEl) return tagsEl;
        const panelEl = documentRef.getElementById('card-detail-panel');
        if (!panelEl) return null;
        tagsEl = documentRef.createElement('div');
        tagsEl.id = 'card-detail-effect-tags';
        tagsEl.setAttribute('aria-label', 'カード効果タグ');
        const detailMoreEl = documentRef.getElementById('card-detail-more');
        if (detailMoreEl && detailMoreEl.parentElement === panelEl) {
            panelEl.insertBefore(tagsEl, detailMoreEl);
        } else {
            panelEl.appendChild(tagsEl);
        }
        return tagsEl;
    }

    function ensureCardDetailLiveStateElement() {
        const documentRef = cfg.getDocumentRef();
        if (!documentRef) return null;
        let stateEl = documentRef.getElementById('card-detail-live-state');
        if (stateEl) return stateEl;
        const panelEl = documentRef.getElementById('card-detail-panel');
        if (!panelEl) return null;
        stateEl = documentRef.createElement('div');
        stateEl.id = 'card-detail-live-state';
        stateEl.setAttribute('aria-live', 'polite');
        const tagsEl = ensureCardDetailEffectTagsElement();
        if (tagsEl && tagsEl.parentElement === panelEl) {
            panelEl.insertBefore(stateEl, tagsEl);
        } else {
            const detailMoreEl = documentRef.getElementById('card-detail-more');
            if (detailMoreEl && detailMoreEl.parentElement === panelEl) {
                panelEl.insertBefore(stateEl, detailMoreEl);
            } else {
                panelEl.appendChild(stateEl);
            }
        }
        return stateEl;
    }

    function buildCardDetailDisplayModel(cardDef: any, ownerKey: any) {
        if (!cardDef) {
            return {
                cardName: '-',
                summaryText: 'カードを選択してください',
                detailText: '',
                detailPanelText: '',
                liveStateText: '',
                tags: []
            };
        }

        const descriptionTexts = resolveCardDescriptionTextsForCardUi(cardDef);
        const quickText = String(descriptionTexts && descriptionTexts.quickText ? descriptionTexts.quickText : '');
        const detailText = String(descriptionTexts && descriptionTexts.detailText ? descriptionTexts.detailText : '');
        const distinctDetailText = String(descriptionTexts && descriptionTexts.distinctDetailText ? descriptionTexts.distinctDetailText : '');

        return {
            cardName: cardDef.name || '?',
            summaryText: stripCardDetailTagPhrases(quickText) || quickText,
            detailText,
            detailPanelText: distinctDetailText || detailText,
            liveStateText: getCardDetailLiveStateText(cardDef, ownerKey),
            tags: Array.isArray(descriptionTexts && descriptionTexts.effectTags)
                ? descriptionTexts.effectTags
                : (Array.isArray(descriptionTexts && descriptionTexts.numericTags)
                    ? descriptionTexts.numericTags
                    : [])
        };
    }

    function applyCardDetailDisplayModel(nameEl: any, descEl: any, detailStateEl: any, detailMoreEl: any, detailTagsEl: any, displayModel: any) {
        if (!nameEl || !descEl) return;
        const model = displayModel || buildCardDetailDisplayModel(null, null);
        nameEl.textContent = model.cardName;
        descEl.textContent = model.summaryText;
        renderCardDetailLiveState(detailStateEl, model.liveStateText);
        if (detailMoreEl) detailMoreEl.textContent = model.detailPanelText;
        renderCardDetailEffectTags(detailTagsEl, model.tags);
    }

    function getOverlayCardDescriptionText(cardDef: any, cardId: any) {
        if (cardDef && cardDef.desc) return cardDef.desc;
        if (cfg.isHiddenHandToken(cardId)) return 'この対戦モードでは詳細は非公開です';
        if (!cardDef) return '説明なし';

        const descriptionTexts = resolveCardDescriptionTextsForCardUi(cardDef);
        return String(
            (descriptionTexts && (descriptionTexts.detailText || descriptionTexts.quickText))
            || '説明なし'
        );
    }

    return {
        resolveCardDescriptionTextsForCardUi,
        ensureCardDetailEffectTagsElement,
        ensureCardDetailLiveStateElement,
        renderCardDetailLiveState,
        renderCardDetailEffectTags,
        buildCardDetailDisplayModel,
        applyCardDetailDisplayModel,
        getOverlayCardDescriptionText
    };
}

module.exports = {
    createCardInteractionDetailPanel
};
