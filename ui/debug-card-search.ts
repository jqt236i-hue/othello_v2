type DebugCardSearchOwnerKey = 'black' | 'white';

type DebugCardSearchDeps = {
    getDocumentRef?: () => Document | null;
    getWindowRef?: () => any;
    getCardStateValue?: () => any;
    getCardDef?: (cardId: string) => any;
    isDebugEnabled?: () => boolean;
    selectCard?: (cardId: string, ownerKey: DebugCardSearchOwnerKey, handIndex: number) => void;
    useSelectedCard?: () => void;
};

type DebugCardSearchResult = {
    cardId: string;
    name: string;
    cost: number | null;
    ownerKey: DebugCardSearchOwnerKey;
    handIndex: number;
};

type DebugCardSearchControlRefs = {
    ownerKey: DebugCardSearchOwnerKey;
    root: HTMLElement;
    button: HTMLButtonElement;
    panel: HTMLElement;
    input: HTMLInputElement;
    list: HTMLElement;
    activeIndex: number;
    currentResults: DebugCardSearchResult[];
};

const RESULT_LIMIT = 12;
const SHORTCUT_BY_OWNER: Record<DebugCardSearchOwnerKey, string> = Object.freeze({
    black: '/',
    white: '?'
});

const CARD_NAME_READING_OVERRIDES: Record<string, string> = Object.freeze({
    '宝箱': 'たからばこ',
    '自由の意志': 'じゆうのいし',
    '最後の切り札': 'さいごのきりふだ',
    '狙撃の意志': 'そげきのいし',
    '弱い意志': 'よわいいし',
    '幽霊の意志': 'ゆうれいのいし',
    '避ける意志': 'よけるいし',
    '交換の意志': 'こうかんのいし',
    '入替の意志': 'いれかえのいし',
    '強い意志': 'つよいいし',
    '強風の意志': 'きょうふうのいし',
    '超浮力': 'ちょうふりょく',
    '浮力': 'ふりょく',
    '超重力': 'ちょうじゅうりょく',
    '超引力': 'ちょういんりょく',
    '重力': 'じゅうりょく',
    '罠の意志': 'わなのいし',
    '意志の反転': 'いしのはんてん',
    '捕獲の意志': 'ほかくのいし',
    '二連鎖の意志': 'にれんさのいし',
    '三連鎖の意志': 'さんれんさのいし',
    '四連鎖の意志': 'よんれんさのいし',
    '無限連鎖の意志': 'むげんれんさのいし',
    '禁忌の反転': 'きんきのはんてん',
    '反転の意志': 'はんてんのいし',
    '復活の意志': 'ふっかつのいし',
    '破壊の意志': 'はかいのいし',
    '時限爆弾': 'じげんばくだん',
    '時間停石': 'じかんていし',
    '究極反転龍': 'きゅうきょくはんてんりゅう',
    '繁殖の意志': 'はんしょくのいし',
    '増殖の意志': 'ぞうしょくのいし',
    '複製の意志': 'ふくせいのいし',
    '種まきの意志': 'たねまきのいし',
    'テレポート': 'てれぽーと',
    'マステレポート': 'ますてれぽーと',
    '十字爆弾': 'じゅうじばくだん',
    'クロス爆弾': 'くろすばくだん',
    '多動の意志': 'たどうのいし',
    '極悪多動魔': 'ごくあくたどうま',
    '逃げる意志': 'にげるいし',
    'ロボット掃除機': 'ろぼっとそうじき',
    '悪食の意志': 'あくじきのいし',
    '意志狩りの王': 'いしがりのおう',
    '瞬間多動': 'しゅんかんたどう',
    '再構築の意志': 'さいこうちくのいし',
    '出稼ぎの意志': 'でかせぎのいし',
    'リボ払いの意志': 'りぼばらいのいし',
    '意志の喪失': 'いしのそうしつ',
    '二連投石': 'にれんとうせき',
    '三連投石': 'さんれんとうせき',
    '四連投石': 'よんれんとうせき',
    '無限投石': 'むげんとうせき',
    '天の恵み': 'てんのめぐみ',
    '観測の意志': 'かんそくのいし',
    '理論の化身': 'りろんのけしん',
    '混沌召喚': 'こんとんしょうかん',
    '盤界の執行者': 'ばんかいのしっこうしゃ',
    '盤理の観測者': 'ばんりのかんそくしゃ',
    '断罪の意志': 'だんざいのいし',
    '執行の意志': 'しっこうのいし',
    '金の意志': 'きんのいし',
    '虹の意志': 'にじのいし',
    '銀の意志': 'ぎんのいし',
    '演算の意志': 'えんざんのいし',
    '延命の意志': 'えんめいのいし',
    '延命神': 'えんめいしん',
    '腐食の意志': 'ふしょくのいし',
    '守る意志': 'まもるいし',
    '守護神': 'しゅごしん',
    '救済神': 'きゅうさいしん',
    '破壊龍': 'はかいりゅう',
    '雷の意志': 'かみなりのいし',
    '究極破壊神': 'きゅうきょくはかいしん',
    '究極多動神': 'きゅうきょくたどうしん',
    '盤面拡張': 'ばんめんかくちょう',
    '盤面拡張神': 'ばんめんかくちょうしん',
    '盤面縮小': 'ばんめんしゅくしょう',
    '盤面縮小神': 'ばんめんしゅくしょうしん',
    '封鎖の意志': 'ふうさのいし',
    '因果抹消': 'いんがまっしょう',
    '凍結の意志': 'とうけつのいし',
    '犠牲の意志': 'ぎせいのいし',
    '救済の意志': 'きゅうさいのいし',
    '生きる意志': 'いきるいし',
    '増援の意志': 'ぞうえんのいし',
    '援軍の意志': 'えんぐんのいし',
    '平等の意志': 'びょうどうのいし',
    '運命の意志': 'うんめいのいし',
    '因果抹消神': 'いんがまっしょうしん'
});

function normalizeOwnerKey(value: any): DebugCardSearchOwnerKey {
    return value === 'white' ? 'white' : 'black';
}

function toHiragana(value: string): string {
    return value.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeSearchText(value: any): string {
    return toHiragana(String(value || '').normalize('NFKC').trim().toLowerCase())
        .replace(/\s+/g, '');
}

function resolveCardName(cardId: string, cardDef: any): string {
    return String(cardDef && (cardDef.name || cardDef.name_ja) || '').trim();
}

function resolveCardCost(cardDef: any): number | null {
    const cost = Number(cardDef && cardDef.cost);
    return Number.isFinite(cost) ? cost : null;
}

function getWindowFallback(): any {
    return typeof window !== 'undefined' ? window : null;
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
    const element = target && (target as HTMLElement);
    if (!element || !element.tagName) return false;
    const tagName = String(element.tagName || '').toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
    return element.isContentEditable === true;
}

function createDebugCardSearchController(deps?: DebugCardSearchDeps) {
    const cfg = (deps && typeof deps === 'object') ? deps : {};
    const refsByOwner: Record<string, DebugCardSearchControlRefs | null> = { black: null, white: null };
    let shortcutsBound = false;

    function getDocumentRef(): Document | null {
        if (typeof cfg.getDocumentRef === 'function') return cfg.getDocumentRef();
        const root = getWindowRef();
        return root && root.document ? root.document : null;
    }

    function getWindowRef(): any {
        if (typeof cfg.getWindowRef === 'function') return cfg.getWindowRef();
        return getWindowFallback();
    }

    function getCardStateValue(): any {
        if (typeof cfg.getCardStateValue === 'function') return cfg.getCardStateValue();
        const root = getWindowRef();
        return root ? root.cardState : null;
    }

    function getCardDef(cardId: string): any {
        if (typeof cfg.getCardDef === 'function') return cfg.getCardDef(cardId);
        const root = getWindowRef();
        const cardLogic = root && root.CardLogic;
        return cardLogic && typeof cardLogic.getCardDef === 'function' ? cardLogic.getCardDef(cardId) : null;
    }

    function isDebugEnabled(): boolean {
        if (typeof cfg.isDebugEnabled === 'function') return cfg.isDebugEnabled() === true;
        const root = getWindowRef();
        if (root && root.DEBUG_UNLIMITED_USAGE === true) return true;
        if (root && root.__uiImpl && root.__uiImpl.DEBUG_UNLIMITED_USAGE === true) return true;
        if (root && root.__uiImpl_turn_manager && root.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE === true) return true;
        const doc = getDocumentRef();
        const body = doc && doc.body;
        const html = doc && doc.documentElement;
        if ((body && body.classList && body.classList.contains('debug-layout'))
            || (html && html.classList && html.classList.contains('debug-layout'))) {
            return true;
        }
        const debugModeBtn = doc ? doc.getElementById('debugModeBtn') : null;
        if (debugModeBtn) {
            if (debugModeBtn.getAttribute('aria-pressed') === 'true') return true;
            if ((debugModeBtn as HTMLElement).dataset && (debugModeBtn as HTMLElement).dataset.active === 'true') return true;
            if (String(debugModeBtn.textContent || '').indexOf('ON') >= 0) return true;
        }
        return false;
    }

    function selectCard(cardId: string, ownerKey: DebugCardSearchOwnerKey, handIndex: number): void {
        if (typeof cfg.selectCard === 'function') {
            cfg.selectCard(cardId, ownerKey, handIndex);
            return;
        }
        const root = getWindowRef();
        if (root && typeof root.onCardClick === 'function') {
            root.onCardClick(cardId, ownerKey, handIndex);
        }
    }

    function useSelectedCard(): void {
        if (typeof cfg.useSelectedCard === 'function') {
            cfg.useSelectedCard();
            return;
        }
        const root = getWindowRef();
        if (root && typeof root.useSelectedCard === 'function') {
            root.useSelectedCard();
        }
    }

    function search(ownerKey: any, query: any): DebugCardSearchResult[] {
        const owner = normalizeOwnerKey(ownerKey);
        const normalizedQuery = normalizeSearchText(query);
        if (!normalizedQuery) return [];
        const state = getCardStateValue();
        const hand = state && state.hands && Array.isArray(state.hands[owner]) ? state.hands[owner] : [];
        const results: DebugCardSearchResult[] = [];
        for (let i = 0; i < hand.length; i += 1) {
            const cardId = String(hand[i] || '');
            if (!cardId || cardId.indexOf('__hidden_hand__:') === 0) continue;
            const cardDef = getCardDef(cardId);
            const name = resolveCardName(cardId, cardDef);
            if (!name) continue;
            const normalizedName = normalizeSearchText(name);
            const normalizedReading = normalizeSearchText(CARD_NAME_READING_OVERRIDES[name] || '');
            const matches = normalizedName.indexOf(normalizedQuery) >= 0
                || (!!normalizedReading && normalizedReading.indexOf(normalizedQuery) >= 0);
            if (!matches) continue;
            results.push({
                cardId,
                name,
                cost: resolveCardCost(cardDef),
                ownerKey: owner,
                handIndex: i
            });
            if (results.length >= RESULT_LIMIT) break;
        }
        return results;
    }

    function setOpen(refs: DebugCardSearchControlRefs, open: boolean): void {
        refs.root.classList.toggle('is-open', open);
        refs.button.setAttribute('aria-expanded', open ? 'true' : 'false');
        refs.panel.hidden = !open;
        refs.input.hidden = !open;
        refs.list.hidden = !open;
        if (!open) {
            refs.activeIndex = -1;
            refs.currentResults = [];
            refs.input.removeAttribute('aria-activedescendant');
            clearResults(refs);
        }
        if (open) {
            try {
                refs.input.focus({ preventScroll: true } as any);
                refs.input.select();
            } catch (e) { /* ignore */ }
            renderResults(refs);
        }
    }

    function openOwnerSearch(ownerKey: DebugCardSearchOwnerKey): void {
        const refs = refsByOwner[ownerKey];
        if (!refs || !isDebugEnabled()) return;
        setOpen(refs, true);
    }

    function handleShortcutKeydown(event: KeyboardEvent): void {
        if (!event || event.defaultPrevented) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (isEditableShortcutTarget(event.target)) return;
        if (!isDebugEnabled()) return;
        if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
            event.preventDefault();
            openOwnerSearch('white');
            return;
        }
        if (event.key === '/') {
            event.preventDefault();
            openOwnerSearch('black');
        }
    }

    function clearResults(refs: DebugCardSearchControlRefs): void {
        refs.list.replaceChildren();
        refs.list.hidden = true;
        refs.currentResults = [];
        refs.activeIndex = -1;
        refs.input.removeAttribute('aria-activedescendant');
    }

    function useResult(refs: DebugCardSearchControlRefs, result: DebugCardSearchResult): void {
        if (!isDebugEnabled()) return;
        selectCard(result.cardId, result.ownerKey, result.handIndex);
        useSelectedCard();
        setOpen(refs, false);
    }

    function moveActiveResult(refs: DebugCardSearchControlRefs, delta: number): void {
        const length = refs.currentResults.length;
        if (length <= 0) return;
        const current = refs.activeIndex >= 0 ? refs.activeIndex : 0;
        refs.activeIndex = (current + delta + length) % length;
        renderResults(refs);
    }

    function useActiveResult(refs: DebugCardSearchControlRefs): void {
        const index = refs.activeIndex >= 0 ? refs.activeIndex : 0;
        const result = refs.currentResults[index];
        if (result) useResult(refs, result);
    }

    function handleInputKeydown(refs: DebugCardSearchControlRefs, event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            setOpen(refs, false);
            refs.button.focus();
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActiveResult(refs, 1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActiveResult(refs, -1);
            return;
        }
        if (event.key === 'Enter') {
            if (refs.currentResults.length <= 0) return;
            event.preventDefault();
            useActiveResult(refs);
        }
    }

    function renderResults(refs: DebugCardSearchControlRefs): void {
        refs.list.replaceChildren();
        if (!isDebugEnabled()) {
            clearResults(refs);
            return;
        }
        const results = search(refs.ownerKey, refs.input.value);
        if (results.length <= 0) {
            clearResults(refs);
            return;
        }
        refs.currentResults = results;
        if (refs.activeIndex < 0 || refs.activeIndex >= results.length) {
            refs.activeIndex = 0;
        }
        refs.list.hidden = false;
        const doc = getDocumentRef();
        if (!doc) return;
        results.forEach((result, index) => {
            const row = doc.createElement('div');
            row.className = 'debug-card-search-result';
            if (index === refs.activeIndex) row.classList.add('is-active');
            row.id = `debug-card-search-option-${refs.ownerKey}-${index}`;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', index === refs.activeIndex ? 'true' : 'false');
            if (index === refs.activeIndex) {
                refs.input.setAttribute('aria-activedescendant', row.id);
            }

            const name = doc.createElement('span');
            name.className = 'debug-card-search-name';
            name.textContent = result.name;
            row.appendChild(name);

            if (result.cost !== null) {
                const cost = doc.createElement('span');
                cost.className = 'debug-card-search-cost';
                cost.textContent = String(result.cost);
                row.appendChild(cost);
            }

            const useButton = doc.createElement('button');
            useButton.type = 'button';
            useButton.className = 'debug-card-search-use';
            useButton.textContent = '使用';
            useButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                useResult(refs, result);
            });
            row.appendChild(useButton);
            refs.list.appendChild(row);
        });
    }

    function createControl(ownerKey: DebugCardSearchOwnerKey): DebugCardSearchControlRefs | null {
        const doc = getDocumentRef();
        if (!doc) return null;
        const boardStack = doc.getElementById('board-stack');
        if (!boardStack) return null;
        const existing = boardStack.querySelector(`.debug-card-search-control[data-owner-key="${ownerKey}"]`) as HTMLElement | null;
        if (existing) existing.remove();

        const root = doc.createElement('div');
        root.className = `debug-card-search-control debug-card-search-control--${ownerKey}`;
        root.dataset.ownerKey = ownerKey;

        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'debug-card-search-button';
        button.textContent = `カード検索 ${SHORTCUT_BY_OWNER[ownerKey]}キー`;
        button.title = `ショートカット: ${SHORTCUT_BY_OWNER[ownerKey]}`;
        button.setAttribute('aria-label', `${ownerKey === 'white' ? '白' : '黒'}カード検索 ${SHORTCUT_BY_OWNER[ownerKey]}`);
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', `debug-card-search-panel-${ownerKey}`);
        root.appendChild(button);

        const panel = doc.createElement('div');
        panel.id = `debug-card-search-panel-${ownerKey}`;
        panel.className = 'debug-card-search-panel';
        panel.hidden = true;

        const input = doc.createElement('input');
        input.type = 'search';
        input.className = 'debug-card-search-input';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.inputMode = 'search';
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-label', `${ownerKey === 'white' ? '白' : '黒'}カード検索`);
        input.hidden = true;
        panel.appendChild(input);

        const list = doc.createElement('div');
        list.className = 'debug-card-search-results';
        list.setAttribute('role', 'listbox');
        list.hidden = true;
        panel.appendChild(list);
        root.appendChild(panel);

        const refs: DebugCardSearchControlRefs = {
            ownerKey,
            root,
            button,
            panel,
            input,
            list,
            activeIndex: -1,
            currentResults: []
        };
        button.addEventListener('click', () => setOpen(refs, refs.panel.hidden === true));
        input.addEventListener('input', () => {
            refs.activeIndex = 0;
            renderResults(refs);
        });
        input.addEventListener('keydown', (event) => handleInputKeydown(refs, event));
        boardStack.appendChild(root);
        refsByOwner[ownerKey] = refs;
        return refs;
    }

    function init(): void {
        createControl('white');
        createControl('black');
        const doc = getDocumentRef();
        if (!shortcutsBound && doc && typeof doc.addEventListener === 'function') {
            doc.addEventListener('keydown', handleShortcutKeydown);
            shortcutsBound = true;
        }
    }

    return {
        init,
        search,
        openOwnerSearch,
        renderResults,
        normalizeSearchText
    };
}

function initDebugCardSearch(deps?: DebugCardSearchDeps) {
    const controller = createDebugCardSearchController(deps);
    controller.init();
    return controller;
}

if (typeof window !== 'undefined') {
    try {
        (window as any).DebugCardSearchModule = {
            createDebugCardSearchController,
            initDebugCardSearch,
            normalizeSearchText
        };
    } catch (e) { /* ignore */ }
}

export = {
    createDebugCardSearchController,
    initDebugCardSearch,
    normalizeSearchText
};
