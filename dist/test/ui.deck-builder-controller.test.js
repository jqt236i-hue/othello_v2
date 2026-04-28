"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
describe('deck builder controller', () => {
    let dom;
    function dispatchWheel(target, props) {
        const ev = new dom.window.Event('wheel', { bubbles: true, cancelable: true });
        const p = props || {};
        Object.defineProperty(ev, 'deltaX', { value: p.deltaX ?? 0 });
        Object.defineProperty(ev, 'deltaY', { value: p.deltaY ?? 0 });
        target.dispatchEvent(ev);
    }
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM(`<!doctype html><html><body>
      <button id="openBtn" type="button"></button>
      <div id="summary"></div>
      <div id="overlay"></div>
      <button id="closeBtn" type="button"></button>
      <div id="header"></div>
      <div id="body"></div>
      <button id="boardSizeOpenBtn" type="button"></button>
      <div id="boardSizeControlSummary"></div>
      <div id="boardSizeEditor"></div>
      <input id="boardSizeRowsInput" type="number" value="8" />
      <input id="boardSizeColsInput" type="number" value="8" />
      <button id="boardSizeCloseBtn" type="button"></button>
      <div id="boardSizeEditorNote"></div>
    </body></html>`, { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.location = dom.window.location;
        global.history = dom.window.history;
        global.localStorage = dom.window.localStorage;
        global.navigator = dom.window.navigator;
    });
    afterEach(() => {
        try {
            if (dom && dom.window && typeof dom.window.close === 'function') {
                dom.window.close();
            }
        }
        catch (e) {
            // ignore
        }
        delete global.window;
        delete global.document;
        delete global.location;
        delete global.history;
        delete global.localStorage;
        delete global.navigator;
        delete global.__uiImpl_turn_manager;
    });
    function openEditor(body) {
        const editButton = Array.from(body.querySelectorAll('button')).find((button) => button.textContent === '編集');
        expect(editButton).toBeTruthy();
        editButton.click();
    }
    function buildPresetState(presetId, name, deckCode) {
        return {
            version: 1,
            activePresetId: presetId || '',
            presets: [
                { id: 'preset_1', name: presetId === 'preset_1' ? name : '', deckCode: presetId === 'preset_1' ? deckCode : '', updatedAt: 1 },
                { id: 'preset_2', name: presetId === 'preset_2' ? name : '', deckCode: presetId === 'preset_2' ? deckCode : '', updatedAt: 2 },
                { id: 'preset_3', name: presetId === 'preset_3' ? name : '', deckCode: presetId === 'preset_3' ? deckCode : '', updatedAt: 3 }
            ]
        };
    }
    function createThirtyCardDeck(startIndex = 0) {
        import * as DeckSpecHelpers from '../shared/deck-spec.js';
        import * as DeckCodecModule from '../shared/deck-codec.js';
        const ids = DeckSpecHelpers.getEnabledCardDefs()
            .slice(startIndex, startIndex + 10)
            .map((cardDef) => cardDef.id);
        expect(ids).toHaveLength(10);
        const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(ids.flatMap((cardId) => [cardId, cardId, cardId]));
        return {
            deckSpec,
            deckCode: DeckCodecModule.encodeDeckSpec(deckSpec)
        };
    }
    function createController() {
        import { createDeckBuilderController } from '../ui/deck-builder-controller.js';
        return (0, deck_builder_controller_js_1.createDeckBuilderController)({
            root: window,
            refs: {
                openBtn: document.getElementById('openBtn'),
                controlSummary: document.getElementById('summary'),
                overlay: document.getElementById('overlay'),
                closeBtn: document.getElementById('closeBtn'),
                headerSummary: document.getElementById('header'),
                body: document.getElementById('body'),
                boardSizeOpenBtn: document.getElementById('boardSizeOpenBtn'),
                boardSizeControlSummary: document.getElementById('boardSizeControlSummary'),
                boardSizeEditor: document.getElementById('boardSizeEditor'),
                boardSizeRowsInput: document.getElementById('boardSizeRowsInput'),
                boardSizeColsInput: document.getElementById('boardSizeColsInput'),
                boardSizeCloseBtn: document.getElementById('boardSizeCloseBtn'),
                boardSizeEditorNote: document.getElementById('boardSizeEditorNote')
            }
        });
    }
    test('controlSummary が無くてもデッキ構築を開ける', () => {
        import { createDeckBuilderController } from '../ui/deck-builder-controller.js';
        const body = document.getElementById('body');
        document.getElementById('summary').remove();
        const controller = (0, deck_builder_controller_js_2.createDeckBuilderController)({
            root: window,
            refs: {
                openBtn: document.getElementById('openBtn'),
                controlSummary: null,
                overlay: document.getElementById('overlay'),
                closeBtn: document.getElementById('closeBtn'),
                headerSummary: document.getElementById('header'),
                body
            }
        });
        expect(() => controller.open()).not.toThrow();
        expect(document.getElementById('overlay').getAttribute('aria-hidden')).toBe('false');
        expect(document.getElementById('header').textContent).toContain('ローカル設定');
    });
    test('候補カードはコスト降順で表示する', () => {
        import * as DeckSpecHelpers from '../shared/deck-spec.js';
        import { createDeckBuilderController } from '../ui/deck-builder-controller.js';
        const body = document.getElementById('body');
        (0, deck_builder_controller_js_3.createDeckBuilderController)({
            root: window,
            refs: {
                openBtn: document.getElementById('openBtn'),
                controlSummary: document.getElementById('summary'),
                overlay: document.getElementById('overlay'),
                closeBtn: document.getElementById('closeBtn'),
                headerSummary: document.getElementById('header'),
                body
            }
        }).open();
        openEditor(body);
        const renderedIds = Array.from(body.querySelectorAll('.deck-builder-candidate-grid .deck-builder-card'))
            .map((element) => element.dataset.cardId);
        const expectedIds = DeckSpecHelpers.getEnabledCardDefs()
            .slice()
            .sort((left, right) => {
            const leftCost = Number(left.cost) || 0;
            const rightCost = Number(right.cost) || 0;
            if (leftCost !== rightCost)
                return rightCost - leftCost;
            return String(left.id || '').localeCompare(String(right.id || ''), 'en');
        })
            .map((cardDef) => cardDef.id);
        expect(renderedIds).toEqual(expectedIds);
    });
    test('候補カードのコストはカード直下、タイプは右下バッジ行に入る', () => {
        import { createDeckBuilderController } from '../ui/deck-builder-controller.js';
        const body = document.getElementById('body');
        (0, deck_builder_controller_js_4.createDeckBuilderController)({
            root: window,
            refs: {
                openBtn: document.getElementById('openBtn'),
                controlSummary: document.getElementById('summary'),
                overlay: document.getElementById('overlay'),
                closeBtn: document.getElementById('closeBtn'),
                headerSummary: document.getElementById('header'),
                body
            }
        }).open();
        openEditor(body);
        const firstCard = body.querySelector('.deck-builder-candidate-grid .deck-builder-card');
        expect(firstCard).toBeTruthy();
        const costBadge = firstCard.querySelector('.card-cost-badge');
        const badgeRow = firstCard.querySelector('.card-badge-row');
        expect(costBadge).toBeTruthy();
        expect(costBadge.parentElement).toBe(firstCard);
        expect(badgeRow).toBeTruthy();
        expect(badgeRow.querySelector('.card-type-badge')).toBeTruthy();
        expect(badgeRow.querySelector('.card-cost-badge')).toBeNull();
    });
    test('候補カードは4回目の押下で0枚に戻り、スクロール位置を保つ', () => {
        import * as DeckSpecHelpers from '../shared/deck-spec.js';
        import { createDeckBuilderController } from '../ui/deck-builder-controller.js';
        const body = document.getElementById('body');
        (0, deck_builder_controller_js_5.createDeckBuilderController)({
            root: window,
            refs: {
                openBtn: document.getElementById('openBtn'),
                controlSummary: document.getElementById('summary'),
                overlay: document.getElementById('overlay'),
                closeBtn: document.getElementById('closeBtn'),
                headerSummary: document.getElementById('header'),
                body
            }
        }).open();
        openEditor(body);
        const targetCardId = DeckSpecHelpers.getEnabledCardDefs()
            .slice()
            .sort((left, right) => {
            const leftCost = Number(left.cost) || 0;
            const rightCost = Number(right.cost) || 0;
            if (leftCost !== rightCost)
                return rightCost - leftCost;
            return String(left.id || '').localeCompare(String(right.id || ''), 'en');
        })[0].id;
        body.scrollTop = 180;
        for (let index = 0; index < 4; index += 1) {
            const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
            expect(card).toBeTruthy();
            card.click();
        }
        const refreshedCard = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
        const countBadge = refreshedCard.querySelector('.deck-builder-count-badge');
        const footer = refreshedCard.querySelector('.deck-builder-card-footer');
        expect(body.scrollTop).toBe(180);
        expect(countBadge.textContent).toBe('x0');
        expect(footer.textContent).toBe('押すと追加');
    });
    test('候補カード追加で上側の内容が伸びても見えている位置を維持する', () => {
        import * as DeckSpecHelpers from '../shared/deck-spec.js';
        import { createDeckBuilderController } from '../ui/deck-builder-controller.js';
        const body = document.getElementById('body');
        (0, deck_builder_controller_js_6.createDeckBuilderController)({
            root: window,
            refs: {
                openBtn: document.getElementById('openBtn'),
                controlSummary: document.getElementById('summary'),
                overlay: document.getElementById('overlay'),
                closeBtn: document.getElementById('closeBtn'),
                headerSummary: document.getElementById('header'),
                body
            }
        }).open();
        openEditor(body);
        const targetCardId = DeckSpecHelpers.getEnabledCardDefs()
            .slice()
            .sort((left, right) => {
            const leftCost = Number(left.cost) || 0;
            const rightCost = Number(right.cost) || 0;
            if (leftCost !== rightCost)
                return rightCost - leftCost;
            return String(left.id || '').localeCompare(String(right.id || ''), 'en');
        })[0].id;
        const makeRect = (top) => ({
            top,
            left: 0,
            right: 120,
            bottom: top + 140,
            width: 120,
            height: 140
        });
        const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect;
        window.HTMLElement.prototype.getBoundingClientRect = function () {
            if (this === body) {
                return makeRect(0);
            }
            const isTargetCandidate = this.classList &&
                this.classList.contains('deck-builder-card') &&
                this.dataset.cardId === targetCardId &&
                typeof this.closest === 'function' &&
                this.closest('.deck-builder-candidate-grid');
            if (isTargetCandidate) {
                const selectedCount = body.querySelectorAll('.deck-builder-selected-grid .deck-builder-card').length;
                return makeRect(selectedCount > 0 ? 320 : 220);
            }
            return makeRect(0);
        };
        try {
            body.scrollTop = 180;
            const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
            expect(card).toBeTruthy();
            card.click();
            expect(body.scrollTop).toBe(280);
        }
        finally {
            window.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        }
    });
    test('候補カードが3枚のときは次の押下が0枚戻しになる案内を出す', () => {
        import * as DeckSpecHelpers from '../shared/deck-spec.js';
        import { createDeckBuilderController } from '../ui/deck-builder-controller.js';
        const body = document.getElementById('body');
        (0, deck_builder_controller_js_7.createDeckBuilderController)({
            root: window,
            refs: {
                openBtn: document.getElementById('openBtn'),
                controlSummary: document.getElementById('summary'),
                overlay: document.getElementById('overlay'),
                closeBtn: document.getElementById('closeBtn'),
                headerSummary: document.getElementById('header'),
                body
            }
        }).open();
        openEditor(body);
        const targetCardId = DeckSpecHelpers.getEnabledCardDefs()
            .slice()
            .sort((left, right) => {
            const leftCost = Number(left.cost) || 0;
            const rightCost = Number(right.cost) || 0;
            if (leftCost !== rightCost)
                return rightCost - leftCost;
            return String(left.id || '').localeCompare(String(right.id || ''), 'en');
        })[0].id;
        for (let index = 0; index < 3; index += 1) {
            const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
            expect(card).toBeTruthy();
            card.click();
        }
        const refreshedCard = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
        const countBadge = refreshedCard.querySelector('.deck-builder-count-badge');
        const footer = refreshedCard.querySelector('.deck-builder-card-footer');
        expect(countBadge.textContent).toBe('x3');
        expect(footer.textContent).toBe('次で0枚に戻す');
        expect(refreshedCard.classList.contains('deck-builder-card-disabled')).toBe(false);
    });
    test('無効なURL deckCode は保存済みプリセットへ戻し、URLもローカル設定へ戻す', () => {
        const { deckSpec, deckCode } = createThirtyCardDeck(0);
        localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', '保存デッキ', deckCode)));
        history.replaceState(null, '', '/?deck=broken-deck-code');
        const controller = createController();
        expect(controller.getActiveLocalChoice()).toMatchObject({
            mode: 'custom',
            source: 'preset',
            presetId: 'preset_1',
            deckCode
        });
        expect(controller.readActiveDeckSpec()).toEqual(deckSpec);
        expect(new URLSearchParams(window.location.search).get('deck')).toBe(deckCode);
    });
    test('room deck はローカル choice を残したまま実対局用の初期デッキを上書きする', () => {
        const localDeck = createThirtyCardDeck(0);
        const roomDeck = createThirtyCardDeck(10);
        localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', 'ローカル', localDeck.deckCode)));
        window.NetworkMatchClient = {
            isActive: () => true,
            getRoomDeck: () => ({
                mode: 'shared',
                deckCode: roomDeck.deckCode,
                deckSize: 30,
                source: 'room'
            })
        };
        try {
            const controller = createController();
            expect(controller.getActiveLocalChoice()).toMatchObject({
                mode: 'custom',
                source: 'preset',
                deckCode: localDeck.deckCode
            });
            expect(controller.buildCardInitOptions()).toMatchObject({
                initialDeckSpec: roomDeck.deckSpec,
                boardConfig: expect.objectContaining({
                    rows: 8,
                    cols: 8,
                    standard8x8: true
                })
            });
            expect(controller.readActiveDeckSpec()).toEqual(roomDeck.deckSpec);
        }
        finally {
            delete window.NetworkMatchClient;
        }
    });
    test('network room deck が player別なら黒白それぞれの初期デッキを返す', () => {
        const blackDeck = createThirtyCardDeck(0);
        const whiteDeck = createThirtyCardDeck(10);
        localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', 'ローカル', blackDeck.deckCode)));
        window.NetworkMatchClient = {
            isActive: () => true,
            getSeatKey: () => 'black',
            getRoomDeck: () => ({
                mode: 'perPlayer',
                deckCodeByPlayer: {
                    black: blackDeck.deckCode,
                    white: whiteDeck.deckCode
                },
                deckSizeByPlayer: {
                    black: 30,
                    white: 30
                },
                source: 'room'
            })
        };
        try {
            const controller = createController();
            expect(controller.buildCardInitOptions()).toMatchObject({
                initialDeckSpecByPlayer: {
                    black: blackDeck.deckSpec,
                    white: whiteDeck.deckSpec
                },
                boardConfig: expect.objectContaining({
                    rows: 8,
                    cols: 8,
                    standard8x8: true
                })
            });
            expect(controller.readActiveDeckSpec()).toEqual(blackDeck.deckSpec);
        }
        finally {
            delete window.NetworkMatchClient;
        }
    });
    test('CPU対戦ではプレイヤー黒だけにカスタムデッキを渡し、CPU白はデフォルトデッキを維持する', () => {
        const localDeck = createThirtyCardDeck(0);
        localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', 'ローカル', localDeck.deckCode)));
        window.getCurrentMatchMode = () => 'cpu';
        const controller = createController();
        expect(controller.buildCardInitOptions()).toMatchObject({
            initialDeckSpecByPlayer: {
                black: localDeck.deckSpec
            },
            boardConfig: expect.objectContaining({
                rows: 8,
                cols: 8,
                standard8x8: true
            })
        });
        expect(controller.readActiveDeckSpec()).toEqual(localDeck.deckSpec);
    });
    test('network room boardConfig はローカル設定より優先される', () => {
        window.NetworkMatchClient = {
            isActive: () => true,
            getRoomBoardConfig: () => ({ rows: 7, cols: 9 })
        };
        try {
            const controller = createController();
            expect(controller.getLocalBoardConfig()).toMatchObject({
                rows: 8,
                cols: 8,
                standard8x8: true
            });
            expect(controller.readBoardConfig()).toMatchObject({
                rows: 7,
                cols: 9,
                standard8x8: false
            });
            expect(controller.buildCardInitOptions()).toMatchObject({
                boardConfig: expect.objectContaining({
                    rows: 7,
                    cols: 9,
                    standard8x8: false
                })
            });
        }
        finally {
            delete window.NetworkMatchClient;
        }
    });
    test('SharedUIBootstrap helper 経由で turn_manager binding を同期する', () => {
        window.SharedUIBootstrap = require('../shared/ui-bootstrap-shared');
        createController();
        expect(window.__uiImpl_turn_manager).toEqual(expect.objectContaining({
            buildCardInitOptions: expect.any(Function),
            readBoardConfig: expect.any(Function),
            getLocalBoardConfig: expect.any(Function)
        }));
        expect(global.__uiImpl_turn_manager).toEqual(expect.objectContaining({
            buildCardInitOptions: expect.any(Function),
            readBoardConfig: expect.any(Function),
            getLocalBoardConfig: expect.any(Function)
        }));
        expect(window.__uiImpl_turn_manager.readBoardConfig()).toMatchObject({
            rows: 8,
            cols: 8,
            standard8x8: true
        });
    });
    test.each([
        ['Story', 'ストーリー固定'],
        ['Tutorial', 'チュートリアル固定']
    ])('%s mode はローカル設定を残したまま実対局用 boardConfig を標準盤に固定する', (moduleKey, expectedLabel) => {
        window[moduleKey] = {
            State: {
                isActive: () => true
            }
        };
        const controller = createController();
        controller.setLocalBoardConfig({ rows: 7, cols: 9 });
        expect(controller.getLocalBoardConfig()).toMatchObject({
            rows: 7,
            cols: 9,
            standard8x8: false
        });
        expect(controller.readBoardConfig()).toMatchObject({
            rows: 8,
            cols: 8,
            standard8x8: true
        });
        expect(document.getElementById('boardSizeControlSummary').textContent).toContain(expectedLabel);
    });
    test('setLocalBoardConfig はローカル盤面サイズを 10x10 上限で更新する', () => {
        const controller = createController();
        controller.setLocalBoardConfig({ rows: 11, cols: 12 });
        expect(controller.getLocalBoardConfig()).toMatchObject({
            rows: 10,
            cols: 10,
            standard8x8: false
        });
        expect(controller.readBoardConfig()).toMatchObject({
            rows: 10,
            cols: 10,
            standard8x8: false
        });
    });
    test('盤面サイズ入力はホイールで 10x10 まで増減できる', () => {
        const controller = createController();
        const rowsInput = document.getElementById('boardSizeRowsInput');
        const colsInput = document.getElementById('boardSizeColsInput');
        expect(rowsInput.max).toBe('10');
        expect(colsInput.max).toBe('10');
        dispatchWheel(rowsInput, { deltaY: -100 });
        dispatchWheel(rowsInput, { deltaY: -100 });
        dispatchWheel(rowsInput, { deltaY: -100 });
        dispatchWheel(colsInput, { deltaY: -100 });
        expect(rowsInput.value).toBe('10');
        expect(colsInput.value).toBe('9');
        expect(controller.getLocalBoardConfig()).toMatchObject({
            rows: 10,
            cols: 9,
            standard8x8: false
        });
    });
    test('CPU対戦の片側カスタム指定でも白はデフォルトデッキ枚数を維持する', () => {
        const localDeck = createThirtyCardDeck(0);
        import * as CardLogic from '../game/logic/cards.js';
        import * as DeckSpecHelpers from '../shared/deck-spec.js';
        const prng = { shuffle: (arr) => arr, random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng, {
            initialDeckSpecByPlayer: {
                black: localDeck.deckSpec
            }
        });
        expect(cardState.decks.black).toEqual(DeckSpecHelpers.expandDeckSpec(localDeck.deckSpec));
        expect(cardState.initialDeckSizeByPlayer.black).toBe(30);
        expect(cardState.initialDeckSizeByPlayer.white).toBe(DeckSpecHelpers.getDefaultDeckSize());
        expect(cardState.decks.white).toHaveLength(DeckSpecHelpers.getDefaultDeckSize());
    });
    test('無効な保存済みプリセットは activePresetId を外してデフォルトデッキへ戻す', () => {
        localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', '壊れたプリセット', 'broken-deck-code')));
        const controller = createController();
        expect(controller.getActiveLocalChoice()).toMatchObject({ mode: 'standard', source: 'standard' });
        expect(controller.buildCardInitOptions()).toMatchObject({
            boardConfig: expect.objectContaining({
                rows: 8,
                cols: 8,
                standard8x8: true
            })
        });
        const stored = JSON.parse(localStorage.getItem('deck_builder_presets_v1'));
        expect(stored.activePresetId).toBe('');
    });
});
//# sourceMappingURL=ui.deck-builder-controller.test.js.map