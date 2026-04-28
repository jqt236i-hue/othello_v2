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
const helpers = __importStar(require("../shared/playback-event-helpers.js"));
const adapter = __importStar(require("../game/turn/pipeline_ui_adapter.js"));
describe('PlaybackEventHelpers', () => {
    test('maps raw place events into canonical place hand playback events', () => {
        const playbackEvents = helpers.mapRawPlaceEventsToPlayback([
            { type: 'place', row: 2, col: 3, player: 'white', actionId: 'place-1', turnIndex: 9 }
        ], {
            fallbackPlayerKey: 'black',
            fallbackTurnIndex: 7
        });
        expect(playbackEvents).toEqual([
            {
                type: 'place_hand_animation',
                phase: 0,
                rawType: 'place',
                actionId: 'place-1',
                turnIndex: 9,
                targets: [{ r: 2, col: 3, player: 'white', owner: 'white' }]
            }
        ]);
    });
    test('local adapter place playback stays aligned with shared helper contract', () => {
        const board = Array(8).fill(null).map(() => Array(8).fill(0));
        const rawEvents = [{ type: 'place', row: 2, col: 3, player: 'white', actionId: 'place-1', turnIndex: 9 }];
        const turnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: true,
                cardState: { markers: [], turnIndex: 9 },
                gameState: { board },
                events: rawEvents,
                presentationEvents: []
            }))
        };
        const expected = helpers.mapRawPlaceEventsToPlayback(rawEvents, {
            fallbackPlayerKey: 'white',
            fallbackTurnIndex: 9
        });
        const out = adapter.runTurnWithAdapter({ markers: [], turnIndex: 9 }, { board }, 'white', { type: 'place', row: 2, col: 3 }, turnPipeline);
        expect(out.ok).toBe(true);
        expect(out.playbackEvents).toEqual(expected);
    });
    test('appends independent playback bundles after the base phase range', () => {
        const out = helpers.appendPlaybackEventsAfter([
            { type: 'flip', phase: 1, targets: [{ r: 4, col: 4 }] },
            { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'card_use_button' }] }
        ], [
            { type: 'flip', phase: 1, targets: [{ r: 3, col: 3 }] },
            { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'card_effect_flip' }] },
            { type: 'draw', phase: 2, targets: [{ player: 'white' }] }
        ]);
        expect(out).toEqual([
            { type: 'flip', phase: 1, targets: [{ r: 4, col: 4 }] },
            { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'card_use_button' }] },
            { type: 'flip', phase: 3, targets: [{ r: 3, col: 3 }] },
            { type: 'sound_effect', phase: 3, targets: [{ soundKey: 'card_effect_flip' }] },
            { type: 'draw', phase: 4, targets: [{ player: 'white' }] }
        ]);
    });
});
//# sourceMappingURL=shared.playback-event-helpers.test.js.map