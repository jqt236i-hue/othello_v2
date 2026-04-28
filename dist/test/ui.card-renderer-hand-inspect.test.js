"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const jsdom_1 = require("jsdom");
function createBoard(rows = 8, cols = 8) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}
function createRendererContext(options = {}) {
    const { matchMode = 'cpu', seatKey = 'black', includeNetworkClient = (matchMode === 'network'), networkClientIsActive = false, currentPlayer = 1, hands = { black: [], white: [] }, boardRows = 8, boardCols = 8 } = options;
    const dom = new jsdom_1.JSDOM(`<!doctype html><html><body>
      <div id="deck-black"><div class="deck-count"></div></div>
      <div id="deck-white"><div class="deck-count"></div></div>
      <div id="hand-black"></div>
      <div id="hand-white"></div>
      <div id="charge-black"></div>
      <div id="charge-white"></div>
      <div id="charge-delta-black-increase"></div>
      <div id="charge-delta-black-decrease"></div>
      <div id="charge-delta-white-increase"></div>
      <div id="charge-delta-white-decrease"></div>
      <div id="discard-count"></div>
      <div id="active-black"><div class="effect-slot-content"></div></div>
      <div id="active-white"><div class="effect-slot-content"></div></div>
    </body></html>`, { runScripts: 'outside-only' });
    const { window } = dom;
    window.BLACK = 1;
    window.WHITE = -1;
    window.gameState = {
        currentPlayer,
        board: createBoard(boardRows, boardCols)
    };
    window.cardState = {
        turnIndex: 1,
        charge: { black: 0, white: 0 },
        chargeDeltaEvents: [],
        hands: {
            black: Array.isArray(hands.black) ? hands.black.slice() : [],
            white: Array.isArray(hands.white) ? hands.white.slice() : []
        },
        decks: { black: [], white: [] },
        discard: [],
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        activeEffectsByPlayer: { black: [], white: [] },
        selectedCardId: null,
        selectedCardOwnerKey: null
    };
    window.CARD_DEFS = [
        { id: 'own_card', name: 'Own Card', desc: 'd', cost: 1 },
        { id: 'opp_card', name: 'Opp Card', desc: 'd', cost: 1 }
    ];
    window.onCardClick = jest.fn();
    window.updateCardDetailPanel = jest.fn();
    window.StoneVisuals = {
        showChargeDelta: jest.fn()
    };
    window.OwnerHelpers = require('../utils/owner-helpers');
    window.MATCH_MODE = matchMode;
    if (matchMode === 'network' && includeNetworkClient) {
        window.NetworkMatchClient = {
            getSeatKey: () => seatKey,
            isActive: () => networkClientIsActive
        };
    }
    const rendererCode = fs.readFileSync(path.resolve(__dirname, '../cards/card-renderer.js'), 'utf8');
    window.eval(rendererCode);
    return dom;
}
describe('card renderer hand inspection', () => {
    test('custom boards still update the charge HUD', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            boardRows: 7,
            boardCols: 7
        });
        const { window } = dom;
        window.cardState.charge.black = 3;
        window.cardState.charge.white = 1;
        window.renderCardUI();
        expect(window.document.getElementById('charge-black').textContent).toBe('布石: 3 / 99');
        expect(window.document.getElementById('charge-white').textContent).toBe('布石: 1 / 99');
        dom.window.close();
    });
    test('cpu mode keeps black hand clickable during white turn for effect inspection', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: -1,
            hands: { black: ['own_card'], white: ['opp_card'] }
        });
        const { window } = dom;
        window.renderCardUI();
        const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
        expect(ownCardEl).not.toBeNull();
        expect(ownCardEl.classList.contains('clickable')).toBe(true);
        expect(ownCardEl.classList.contains('usable')).toBe(false);
        ownCardEl.click();
        expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'black');
        dom.window.close();
    });
    test('stale visual playback lock does not remove hand clickability', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: [] }
        });
        const { window } = dom;
        window.VisualPlaybackActive = true;
        window.isCardAnimating = true;
        window.AnimationEngine = { isPlaying: false };
        window.renderCardUI();
        const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
        expect(ownCardEl).not.toBeNull();
        expect(ownCardEl.classList.contains('clickable')).toBe(true);
        ownCardEl.click();
        expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'black');
        dom.window.close();
    });
    test('visible hand cards keep cost at the card root and type in the badge row', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: [] }
        });
        const { window } = dom;
        window.CARD_DEFS = [
            { id: 'own_card', name: 'Own Card', desc: 'd', cost: 11, display_type_ja: '採掘' }
        ];
        window.renderCardUI();
        const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
        expect(ownCardEl).not.toBeNull();
        const rootChildren = Array.from(ownCardEl.children);
        const costBadge = rootChildren.find((el) => el.classList.contains('card-cost-badge'));
        const badgeRow = rootChildren.find((el) => el.classList.contains('card-badge-row'));
        expect(costBadge).toBeTruthy();
        expect(costBadge.textContent).toBe('11cost');
        expect(badgeRow).toBeTruthy();
        expect(badgeRow.querySelector('.card-type-badge').textContent).toBe('\u26CF\uFE0E 採掘');
        expect(badgeRow.querySelector('.card-cost-badge')).toBeNull();
        dom.window.close();
    });
    test('living will hand cards use the guard display type label', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['living_will_01'], white: [] }
        });
        const { window } = dom;
        window.CARD_DEFS = [
            {
                id: 'living_will_01',
                name: '生きる意志',
                desc: 'd',
                cost: 20,
                type: 'LIVING_WILL',
                display_type_ja: '守護'
            }
        ];
        window.renderCardUI();
        const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
        expect(ownCardEl).not.toBeNull();
        expect(ownCardEl.dataset.cardType).toBe('guard');
        expect(ownCardEl.querySelector('.card-type-badge').textContent).toBe('\u26E8\uFE0E 守護');
        dom.window.close();
    });
    test('createCardFaceElement composites owner-specific special art for special-stone cards', () => {
        const dom = createRendererContext();
        const { window } = dom;
        window.GameVisualEffectsMap = require('../game/visual-effects-map');
        window.CARD_DEFS = [
            {
                id: 'dragon_card',
                name: '究極反転龍',
                desc: 'd',
                cost: 30,
                type: 'ULTIMATE_REVERSE_DRAGON',
                display_type_ja: '特殊'
            }
        ];
        const blackCardEl = window.createCardFaceElement('dragon_card', { ownerKey: 'black' });
        const whiteCardEl = window.createCardFaceElement('dragon_card', { ownerKey: 'white' });
        expect(blackCardEl.classList.contains('has-special-art')).toBe(true);
        expect(whiteCardEl.classList.contains('has-special-art')).toBe(true);
        expect(blackCardEl.querySelector('.card-special-art')).toBeTruthy();
        expect(whiteCardEl.querySelector('.card-special-art')).toBeTruthy();
        expect(blackCardEl.style.getPropertyValue('--card-special-art-image')).toContain('ultimate_reverse_dragon-black.png');
        expect(whiteCardEl.style.getPropertyValue('--card-special-art-image')).toContain('ultimate_reverse_dragon-white.png');
        dom.window.close();
    });
    test('createCardFaceElement uses blockade image override for blockade will cards', () => {
        const dom = createRendererContext();
        const { window } = dom;
        window.CARD_DEFS = [
            {
                id: 'blockade_01',
                name: '封鎖の意志',
                desc: 'd',
                cost: 1,
                type: 'BLOCKADE_WILL',
                display_type_ja: '特殊'
            }
        ];
        const cardEl = window.createCardFaceElement('blockade_01', { ownerKey: 'black' });
        expect(cardEl.classList.contains('has-special-art')).toBe(true);
        expect(cardEl.querySelector('.card-special-art')).toBeTruthy();
        expect(cardEl.style.getPropertyValue('--card-special-art-image')).toContain('assets/images/other/X.png');
        expect(cardEl.dataset.cardVisualEffect).toBe('blockadeMark');
        dom.window.close();
    });
    test('fitCardNameElement snaps reduced names to integer pixels to avoid blurry text', () => {
        const dom = createRendererContext();
        const { window } = dom;
        const nameEl = window.document.createElement('div');
        window.document.body.appendChild(nameEl);
        window.requestAnimationFrame = (callback) => callback();
        window.getComputedStyle = jest.fn(() => ({ fontSize: '15.5px' }));
        Object.defineProperty(nameEl, 'clientWidth', {
            configurable: true,
            get: () => 96
        });
        Object.defineProperty(nameEl, 'offsetWidth', {
            configurable: true,
            get: () => 96
        });
        Object.defineProperty(nameEl, 'scrollWidth', {
            configurable: true,
            get: () => {
                const fontPx = parseFloat(nameEl.style.fontSize || '15.5');
                return Math.ceil(fontPx * 7.4);
            }
        });
        window.fitCardNameElement(nameEl, 0);
        expect(nameEl.style.fontSize).toBe('12px');
        expect(nameEl.style.fontSize).toMatch(/^\d+px$/);
        dom.window.close();
    });
    test('cpu mode shows only locally revealed opponent hand copies face-up', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: ['opp_card', 'opp_card'] }
        });
        const { window } = dom;
        window.cardState._handCopyIdsByPlayer = {
            black: [1],
            white: [101, 102]
        };
        window.cardState._revealedHandCopyIdsByViewer = {
            black: [101],
            white: []
        };
        window.renderCardUI();
        expect(window.document.querySelectorAll('#hand-white .card-item.visible')).toHaveLength(1);
        expect(window.document.querySelectorAll('#hand-white .card-item.hidden')).toHaveLength(1);
        dom.window.close();
    });
    test('cpu mode shows all opponent hand cards face-up after reveal hand marks every copy', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: ['opp_card', 'own_card', 'opp_card'] }
        });
        const { window } = dom;
        window.cardState._handCopyIdsByPlayer = {
            black: [1],
            white: [201, 202, 203]
        };
        window.cardState._revealedHandCopyIdsByViewer = {
            black: [201, 202, 203],
            white: []
        };
        window.renderCardUI();
        expect(window.document.querySelectorAll('#hand-white .card-item.visible')).toHaveLength(3);
        expect(window.document.querySelectorAll('#hand-white .card-item.hidden')).toHaveLength(0);
        dom.window.close();
    });
    test('network mode keeps local hand clickable during opponent turn without making it usable', () => {
        const dom = createRendererContext({
            matchMode: 'network',
            seatKey: 'white',
            currentPlayer: 1,
            hands: { black: ['__hidden_hand__:black:0'], white: ['own_card'] }
        });
        const { window } = dom;
        window.renderCardUI();
        const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
        const oppCardEl = window.document.querySelector('#hand-white .card-item.hidden');
        expect(ownCardEl).not.toBeNull();
        expect(ownCardEl.classList.contains('clickable')).toBe(true);
        expect(ownCardEl.classList.contains('usable')).toBe(false);
        expect(oppCardEl).not.toBeNull();
        expect(oppCardEl.classList.contains('clickable')).toBe(false);
        ownCardEl.click();
        expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'white');
        dom.window.close();
    });
    test('network mode shows revealed opponent cards face-up while keeping hidden tokens concealed', () => {
        const dom = createRendererContext({
            matchMode: 'network',
            seatKey: 'black',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: ['opp_card', '__hidden_hand__:white:1'] }
        });
        const { window } = dom;
        window.renderCardUI();
        const revealedOppCardEl = window.document.querySelector('#hand-white .card-item.visible');
        const hiddenOppCardEl = window.document.querySelector('#hand-white .card-item.hidden');
        expect(revealedOppCardEl).not.toBeNull();
        expect(revealedOppCardEl.classList.contains('clickable')).toBe(true);
        expect(hiddenOppCardEl).not.toBeNull();
        revealedOppCardEl.click();
        expect(window.onCardClick).toHaveBeenCalledWith('opp_card', 'white');
        dom.window.close();
    });
    test('debug HvH keeps both visible hands clickable while only current turn hand stays usable', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: ['opp_card'] }
        });
        const { window } = dom;
        window.DEBUG_HUMAN_VS_HUMAN = true;
        window.DEBUG_UNLIMITED_USAGE = true;
        window.renderCardUI();
        const blackCardEl = window.document.querySelector('#hand-black .card-item.visible');
        const whiteCardEl = window.document.querySelector('#hand-white .card-item.visible');
        expect(blackCardEl).not.toBeNull();
        expect(whiteCardEl).not.toBeNull();
        expect(blackCardEl.classList.contains('clickable')).toBe(true);
        expect(blackCardEl.classList.contains('usable')).toBe(true);
        expect(whiteCardEl.classList.contains('clickable')).toBe(true);
        expect(whiteCardEl.classList.contains('usable')).toBe(false);
        whiteCardEl.click();
        expect(window.onCardClick).toHaveBeenCalledWith('opp_card', 'white');
        dom.window.close();
    });
    test('capture will pending keeps the used hand slot reserved before target selection completes', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card', 'opp_card'], white: [] }
        });
        const { window } = dom;
        window.cardState.pendingEffectByPlayer.black = {
            type: 'CAPTURE_WILL',
            stage: 'selectTarget',
            sourceHandIndex: 1,
            cardId: 'capture_01'
        };
        window.renderCardUI();
        const blackHandSlots = window.document.querySelectorAll('#hand-black .card-item');
        const reservedSlot = window.document.querySelector('#hand-black .card-item[data-hand-index="1"]');
        const shiftedCard = window.document.querySelector('#hand-black .card-item[data-hand-index="2"]');
        expect(blackHandSlots).toHaveLength(3);
        expect(reservedSlot).not.toBeNull();
        expect(reservedSlot.classList.contains('capture-reserved-slot')).toBe(true);
        expect(reservedSlot.style.opacity).toBe('0');
        expect(shiftedCard).not.toBeNull();
        expect(shiftedCard.dataset.cardId).toBe('opp_card');
        dom.window.close();
    });
    test('capture animation state can reserve an appended target slot before reveal render catches up', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: [] }
        });
        const { window } = dom;
        window.__captureReservedHandSlotState = {
            playerKey: 'black',
            handIndex: 1,
            token: 'capture-slot-test'
        };
        window.renderCardUI();
        const blackHandSlots = window.document.querySelectorAll('#hand-black .card-item');
        const reservedSlot = window.document.querySelector('#hand-black .card-item[data-hand-index="1"]');
        expect(blackHandSlots).toHaveLength(2);
        expect(reservedSlot).not.toBeNull();
        expect(reservedSlot.classList.contains('capture-reserved-slot')).toBe(true);
        dom.window.close();
    });
    test('steady-state rerender reuses the hand track and unchanged visible cards', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card', 'opp_card'], white: [] }
        });
        const { window } = dom;
        window.renderCardUI();
        const handEl = window.document.getElementById('hand-black');
        const handTrackBefore = handEl.querySelector('.hand-track');
        const firstCardBefore = handEl.querySelector('.card-item[data-hand-index="0"]');
        const secondCardBefore = handEl.querySelector('.card-item[data-hand-index="1"]');
        window.cardState.selectedCardId = 'own_card';
        window.cardState.selectedCardOwnerKey = 'black';
        window.renderCardUI();
        expect(handEl.querySelector('.hand-track')).toBe(handTrackBefore);
        expect(handEl.querySelector('.card-item[data-hand-index="0"]')).toBe(firstCardBefore);
        expect(handEl.querySelector('.card-item[data-hand-index="1"]')).toBe(secondCardBefore);
        expect(firstCardBefore.classList.contains('selected')).toBe(true);
        dom.window.close();
    });
    test('adding a card keeps existing hand DOM and only appends the new slot', () => {
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: [] }
        });
        const { window } = dom;
        window.renderCardUI();
        const handEl = window.document.getElementById('hand-black');
        const handTrackBefore = handEl.querySelector('.hand-track');
        const firstCardBefore = handEl.querySelector('.card-item[data-hand-index="0"]');
        window.cardState.hands.black.push('opp_card');
        window.renderCardUI();
        expect(handEl.querySelector('.hand-track')).toBe(handTrackBefore);
        expect(handEl.querySelector('.card-item[data-hand-index="0"]')).toBe(firstCardBefore);
        expect(handEl.querySelectorAll('.card-item')).toHaveLength(2);
        expect(handEl.querySelector('.card-item[data-hand-index="1"]').dataset.cardId).toBe('opp_card');
        dom.window.close();
    });
    test('network mode infers white local hand from projected hidden black hand when seat client is unavailable', () => {
        const dom = createRendererContext({
            matchMode: 'network',
            includeNetworkClient: false,
            currentPlayer: 1,
            hands: {
                black: ['__hidden_hand__:black:0'],
                white: ['own_card']
            }
        });
        const { window } = dom;
        window.renderCardUI();
        const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
        const oppCardEl = window.document.querySelector('#hand-white .card-item.hidden');
        expect(window.document.getElementById('hand-black').dataset.ownerKey).toBe('white');
        expect(ownCardEl).not.toBeNull();
        expect(ownCardEl.classList.contains('clickable')).toBe(true);
        expect(oppCardEl).not.toBeNull();
        ownCardEl.click();
        expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'white');
        dom.window.close();
    });
    test('network mode hides leaked hidden token instead of rendering ? in the local hand', () => {
        const dom = createRendererContext({
            matchMode: 'network',
            seatKey: 'black',
            networkClientIsActive: true,
            currentPlayer: 1,
            hands: {
                black: ['__hidden_hand__:black:0'],
                white: ['opp_card']
            }
        });
        const { window } = dom;
        window.renderCardUI();
        expect(window.document.getElementById('hand-black').dataset.ownerKey).toBe('black');
        expect(window.document.querySelector('#hand-black .card-item.visible')).toBeNull();
        expect(window.document.querySelector('#hand-black .card-item.hidden')).not.toBeNull();
        expect(Array.from(window.document.querySelectorAll('#hand-black .card-name')).some((el) => el.textContent === '?')).toBe(false);
        dom.window.close();
    });
});
describe('card renderer FATE_WILL hand visibility', () => {
    test('network mode: controller sees victim hand face-up and usable during controlled turn', () => {
        // Black controls white's turn (FATE_WILL). Local player is black (the controller).
        const dom = createRendererContext({
            matchMode: 'network',
            seatKey: 'black',
            networkClientIsActive: true,
            currentPlayer: -1, // white's turn
            hands: { black: ['own_card'], white: ['opp_card'] }
        });
        const { window } = dom;
        window.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
        window.cardState.charge = { black: 5, white: 5 };
        window.renderCardUI();
        // Controller sees victim (white) hand face-up
        const victimCardEl = window.document.querySelector('#hand-white .card-item.visible');
        expect(victimCardEl).not.toBeNull();
        expect(victimCardEl.classList.contains('clickable')).toBe(true);
        expect(victimCardEl.classList.contains('usable')).toBe(true);
        dom.window.close();
    });
    test('network mode: victim sees own hand face-up but cannot use it (locked out)', () => {
        // Black controls white's turn. Local player is white (the victim).
        const dom = createRendererContext({
            matchMode: 'network',
            seatKey: 'white',
            networkClientIsActive: true,
            currentPlayer: -1, // white's turn
            hands: { black: ['__hidden_hand__:black:0'], white: ['own_card'] }
        });
        const { window } = dom;
        window.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
        window.cardState.charge = { black: 5, white: 5 };
        window.renderCardUI();
        // Victim's own hand is still face-up (they can see their cards)
        const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
        expect(ownCardEl).not.toBeNull();
        // But it is NOT usable (victim is locked out)
        expect(ownCardEl.classList.contains('usable')).toBe(false);
        dom.window.close();
    });
    test('network mode: victim sees time stop active overlay above the local hand', () => {
        const dom = createRendererContext({
            matchMode: 'network',
            seatKey: 'white',
            networkClientIsActive: true,
            currentPlayer: 1,
            hands: { black: ['__hidden_hand__:black:0'], white: ['own_card'] }
        });
        const { window } = dom;
        window.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 2, white: 0 };
        window.renderCardUI();
        const ownHandOverlayEl = window.document.querySelector('#hand-black .time-stop-hand-overlay');
        expect(ownHandOverlayEl).not.toBeNull();
        expect(ownHandOverlayEl.textContent).toBe('時間停止発動中');
        expect(window.document.querySelector('#hand-white .time-stop-hand-overlay')).toBeNull();
        dom.window.close();
    });
    test('cpu mode: controller (black) sees victim (white) hand face-up and usable during controlled turn', () => {
        // Black controls white's turn in local/cpu mode.
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: -1, // white's turn
            hands: { black: ['own_card'], white: ['opp_card'] }
        });
        const { window } = dom;
        window.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
        window.cardState.charge = { black: 5, white: 5 };
        window.renderCardUI();
        // White's hand (topOwnerKey) should now be face-up and usable for controller (black)
        const victimCardEl = window.document.querySelector('#hand-white .card-item.visible');
        expect(victimCardEl).not.toBeNull();
        expect(victimCardEl.classList.contains('clickable')).toBe(true);
        expect(victimCardEl.classList.contains('usable')).toBe(true);
        dom.window.close();
    });
    test('cpu mode: victim (black) hand is NOT usable when white controls black turn', () => {
        // White controls black's turn in local/cpu mode. Black (always input in cpu mode) is the victim.
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1, // black's turn
            hands: { black: ['own_card'], white: [] }
        });
        const { window } = dom;
        window.cardState.fateWillControllerByTurnOwner = { black: 'white', white: null };
        window.cardState.charge = { black: 5, white: 5 };
        window.renderCardUI();
        // Black's hand is still face-up (in cpu mode bottomOwnerKey=black, revealByDefault=true)
        // but must NOT be usable since black is the victim
        const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
        expect(ownCardEl).not.toBeNull();
        expect(ownCardEl.classList.contains('usable')).toBe(false);
        dom.window.close();
    });
    test('HvH mode: controller sees victim hand face-up and usable; victim hand locked out', () => {
        // Black controls white's turn in HvH mode.
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: -1, // white's turn
            hands: { black: ['own_card'], white: ['opp_card'] }
        });
        const { window } = dom;
        window.DEBUG_HUMAN_VS_HUMAN = true;
        window.DEBUG_UNLIMITED_USAGE = true;
        window.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
        window.cardState.charge = { black: 5, white: 5 };
        window.renderCardUI();
        // inputPlayerKey in HvH during FATE_WILL should be the controller (black)
        // White's hand (victim) is visible and usable (controlled by black)
        const victimCardEl = window.document.querySelector('#hand-white .card-item.visible');
        expect(victimCardEl).not.toBeNull();
        expect(victimCardEl.classList.contains('usable')).toBe(true);
        dom.window.close();
    });
    test('normal turns: FATE_WILL absent does not affect existing render behavior', () => {
        // No FATE_WILL — black's turn, cpu mode, basic hand render unchanged.
        const dom = createRendererContext({
            matchMode: 'cpu',
            currentPlayer: 1,
            hands: { black: ['own_card'], white: ['opp_card'] }
        });
        const { window } = dom;
        // fateWillControllerByTurnOwner absent — should not crash and behave as before
        window.renderCardUI();
        const blackCardEl = window.document.querySelector('#hand-black .card-item.visible');
        const whiteCardEl = window.document.querySelector('#hand-white .card-item.hidden');
        expect(blackCardEl).not.toBeNull();
        expect(blackCardEl.classList.contains('clickable')).toBe(true);
        expect(whiteCardEl).not.toBeNull();
        dom.window.close();
    });
});
//# sourceMappingURL=ui.card-renderer-hand-inspect.test.js.map