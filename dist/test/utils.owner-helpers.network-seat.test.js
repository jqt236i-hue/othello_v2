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
const OwnerHelpers = __importStar(require("../utils/owner-helpers.js"));
describe('OwnerHelpers network seat helpers', () => {
    test('normalizePlayerKey normalizes white/black variants', () => {
        expect(OwnerHelpers.normalizePlayerKey('white')).toBe('white');
        expect(OwnerHelpers.normalizePlayerKey(-1)).toBe('white');
        expect(OwnerHelpers.normalizePlayerKey('black')).toBe('black');
        expect(OwnerHelpers.normalizePlayerKey(1)).toBe('black');
    });
    test('normalizePlayerKey normalizes case and whitespace variants', () => {
        expect(OwnerHelpers.normalizePlayerKey(' WHITE ')).toBe('white');
        expect(OwnerHelpers.normalizePlayerKey(' Black ')).toBe('black');
        expect(OwnerHelpers.normalizePlayerKey(' -1 ')).toBe('white');
        expect(OwnerHelpers.normalizePlayerKey(' +1 ')).toBe('black');
    });
    test('normalizePlayerKey falls back to provided fallback seat', () => {
        expect(OwnerHelpers.normalizePlayerKey('unknown', 'white')).toBe('white');
        expect(OwnerHelpers.normalizePlayerKey(null, 'black')).toBe('black');
    });
    test('normalizePlayerKeyOptional returns null instead of forcing fallback', () => {
        expect(OwnerHelpers.normalizePlayerKeyOptional(' WHITE ')).toBe('white');
        expect(OwnerHelpers.normalizePlayerKeyOptional(' +1 ')).toBe('black');
        expect(OwnerHelpers.normalizePlayerKeyOptional('unknown')).toBeNull();
        expect(OwnerHelpers.normalizePlayerKeyOptional(null)).toBeNull();
    });
    test('getOpposingPlayerKey returns the other seat', () => {
        expect(OwnerHelpers.getOpposingPlayerKey('black')).toBe('white');
        expect(OwnerHelpers.getOpposingPlayerKey(-1)).toBe('black');
        expect(OwnerHelpers.getOpposingPlayerKey('unknown')).toBeNull();
    });
    test('resolveVisibleOwnerLayout keeps a valid two-seat mapping', () => {
        expect(OwnerHelpers.resolveVisibleOwnerLayout({ bottomOwnerKey: 'white' })).toEqual({
            bottomOwnerKey: 'white',
            topOwnerKey: 'black'
        });
        expect(OwnerHelpers.resolveVisibleOwnerLayout({ topOwnerKey: 'black' })).toEqual({
            bottomOwnerKey: 'black',
            topOwnerKey: 'white'
        });
        expect(OwnerHelpers.resolveVisibleOwnerLayout({ bottomOwnerKey: 'white', topOwnerKey: 'white' })).toEqual({
            bottomOwnerKey: 'white',
            topOwnerKey: 'black'
        });
    });
    test('owner-matched element helpers read ownerKey datasets safely', () => {
        const bottomElement = { dataset: { ownerKey: 'white' } };
        const topElement = { dataset: { ownerKey: 'black' } };
        const elements = [
            { id: 'hand-black', dataset: { ownerKey: 'white' } },
            { id: 'hand-white', dataset: { ownerKey: 'black' } }
        ];
        expect(OwnerHelpers.resolveVisibleOwnerLayoutFromElements(bottomElement, topElement)).toEqual({
            bottomOwnerKey: 'white',
            topOwnerKey: 'black'
        });
        expect(OwnerHelpers.filterOwnerMatchedElements(elements, 'black')).toEqual([elements[1]]);
        expect(OwnerHelpers.resolveOwnerMatchedElement(elements, 'white', null)).toBe(elements[0]);
        expect(OwnerHelpers.isOwnerOnBottomSlot('white', bottomElement, topElement)).toBe(true);
        expect(OwnerHelpers.isOwnerOnBottomSlot('black', bottomElement, topElement)).toBe(false);
    });
    test('resolveLocalPlayerKey prioritizes NetworkMatchClient seat', () => {
        const root = {
            LOCAL_PLAYER_KEY: 'black',
            BOARD_VIEWER_KEY: 'black',
            NetworkMatchClient: {
                getSeatKey: () => 'white'
            }
        };
        expect(OwnerHelpers.resolveLocalPlayerKey(root)).toBe('white');
    });
    test('resolveLocalPlayerKey falls back to direct globals in order', () => {
        expect(OwnerHelpers.resolveLocalPlayerKey({ LOCAL_PLAYER_KEY: 'white' })).toBe('white');
        expect(OwnerHelpers.resolveLocalPlayerKey({ __LOCAL_PLAYER_KEY: 'white' })).toBe('white');
        expect(OwnerHelpers.resolveLocalPlayerKey({ BOARD_VIEWER_KEY: 'white' })).toBe('white');
        expect(OwnerHelpers.resolveLocalPlayerKey({})).toBe('black');
    });
    test('resolveLocalPlayerKey infers white seat from projected hidden black hand', () => {
        const root = {
            cardState: {
                hands: {
                    black: ['__hidden_hand__:black:0', '__hidden_hand__:black:1'],
                    white: ['own_card']
                },
                pendingEffectByPlayer: { black: null, white: null }
            }
        };
        expect(OwnerHelpers.resolveLocalPlayerKey(root)).toBe('white');
    });
    test('resolveLocalPlayerKey lets projected hidden-hand evidence override stale black seat', () => {
        const root = {
            NetworkMatchClient: {
                getSeatKey: () => 'black',
                isActive: () => false
            },
            cardState: {
                hands: {
                    black: ['__hidden_hand__:black:0'],
                    white: ['own_card']
                },
                pendingEffectByPlayer: { black: null, white: null }
            }
        };
        expect(OwnerHelpers.resolveLocalPlayerKey(root)).toBe('white');
    });
    test('resolveLocalPlayerKey keeps active client seat when projected hands disagree', () => {
        const root = {
            NetworkMatchClient: {
                getSeatKey: () => 'black',
                isActive: () => true
            },
            cardState: {
                hands: {
                    black: ['__hidden_hand__:black:0'],
                    white: ['own_card']
                },
                pendingEffectByPlayer: { black: null, white: null }
            }
        };
        expect(OwnerHelpers.resolveLocalPlayerKey(root)).toBe('black');
    });
    test('getFateWillControllerForTurnOwner reads the controller map safely', () => {
        const cardState = {
            fateWillControllerByTurnOwner: { black: null, white: 'black' }
        };
        expect(OwnerHelpers.getFateWillControllerForTurnOwner(cardState, 'white')).toBe('black');
        expect(OwnerHelpers.getFateWillControllerForTurnOwner(cardState, 'black')).toBeNull();
        expect(OwnerHelpers.getFateWillControllerForTurnOwner(null, 'white')).toBeNull();
    });
    test('getFateWillControlledTurnOwnerForPlayer returns the victim turn owner only for the controller', () => {
        const cardState = {
            fateWillControllerByTurnOwner: { black: null, white: 'black' }
        };
        const gameState = { currentPlayer: -1 };
        expect(OwnerHelpers.getFateWillControlledTurnOwnerForPlayer(cardState, gameState, 'black')).toBe('white');
        expect(OwnerHelpers.getFateWillControlledTurnOwnerForPlayer(cardState, gameState, 'white')).toBeNull();
        expect(OwnerHelpers.getFateWillControlledTurnOwnerForPlayer(cardState, { currentPlayer: 1 }, 'black')).toBeNull();
    });
    test('isNetworkMode reflects current mode getter/fallback', () => {
        expect(OwnerHelpers.isNetworkMode({ getCurrentMatchMode: () => 'network' })).toBe(true);
        expect(OwnerHelpers.isNetworkMode({ MATCH_MODE: 'network' })).toBe(true);
        expect(OwnerHelpers.isNetworkMode({ MATCH_MODE: 'cpu' })).toBe(false);
    });
});
//# sourceMappingURL=utils.owner-helpers.network-seat.test.js.map