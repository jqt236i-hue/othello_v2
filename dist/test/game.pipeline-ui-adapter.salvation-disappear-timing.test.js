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
const adapter = __importStar(require("../game/turn/pipeline_ui_adapter.js"));
describe('pipeline_ui_adapter SALVATION_WILL disappear timing', () => {
    test('salvation_will_resolved defers the first spawn and breeding_spawn cue to card_use_animation disappear timing', () => {
        const base = [
            {
                type: 'card_use_animation',
                phase: 5,
                targets: [{ cardId: 'salvation_01', owner: 'black' }]
            },
            {
                type: 'spawn',
                phase: 5,
                targets: [{ r: 3, col: 2, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
            },
            {
                type: 'spawn',
                phase: 6,
                targets: [{ r: 3, col: 3, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
            },
            {
                type: 'spawn',
                phase: 7,
                targets: [{ r: 3, col: 4, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
            }
        ];
        const raw = [{ type: 'salvation_will_resolved', player: 'black', spawnedCount: 3 }];
        const pres = [{ type: 'CARD_USED', player: 'black', cardId: 'salvation_01' }];
        const out = adapter.appendSoundEffectPlaybackEvents(base, raw, pres);
        const cardUseEv = out.find((ev) => ev && ev.type === 'card_use_animation');
        const disappearEvents = cardUseEv && cardUseEv.targets && cardUseEv.targets[0]
            ? cardUseEv.targets[0].disappearPlaybackEvents
            : null;
        const topLevelSalvationSpawns = out.filter((ev) => ev && ev.type === 'spawn' && ev.targets && ev.targets[0] && ev.targets[0].cause === 'SALVATION_WILL');
        const topLevelSalvationCues = out.filter((ev) => (ev &&
            ev.type === 'sound_effect' &&
            ev.meta &&
            ev.meta.sourceType === 'salvation_spawn'));
        expect(cardUseEv).toBeTruthy();
        expect(disappearEvents).toEqual([
            expect.objectContaining({
                type: 'spawn',
                targets: [expect.objectContaining({ cause: 'SALVATION_WILL', reason: 'salvation_spawn', r: 3, col: 2 })]
            }),
            expect.objectContaining({
                type: 'sound_effect',
                targets: [expect.objectContaining({ soundKey: 'breeding_spawn' })],
                meta: expect.objectContaining({ sourceType: 'salvation_spawn' })
            })
        ]);
        expect(topLevelSalvationSpawns.map((ev) => ev.phase)).toEqual([6, 7]);
        expect(topLevelSalvationCues.map((ev) => ev.phase)).toEqual([6, 7]);
    });
});
//# sourceMappingURL=game.pipeline-ui-adapter.salvation-disappear-timing.test.js.map