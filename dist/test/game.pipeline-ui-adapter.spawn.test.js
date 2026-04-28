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
function mapPlaybackEvents(pres) {
    return adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array.from({ length: 8 }, () => Array(8).fill(0)) });
}
describe('pipeline_ui_adapter spawn mapping', () => {
    test('maps SPAWN cause/reason to playback target for animation branching', () => {
        const pres = [{
                type: 'SPAWN',
                row: 3,
                col: 4,
                stoneId: 's12',
                ownerAfter: 'black',
                cause: 'BREEDING',
                reason: 'breeding_spawn_immediate',
                meta: {}
            }];
        const out = mapPlaybackEvents(pres);
        expect(Array.isArray(out)).toBe(true);
        expect(out).toHaveLength(1);
        expect(out[0].type).toBe('spawn');
        expect(out[0].targets[0]).toMatchObject({
            r: 3,
            col: 4,
            stoneId: 's12',
            cause: 'BREEDING',
            reason: 'breeding_spawn_immediate'
        });
    });
    test('gives Equality Will spawns sequential phases so each stone appears one by one', () => {
        const out = mapPlaybackEvents([
            {
                type: 'SPAWN',
                row: 2,
                col: 2,
                stoneId: 'eq-1',
                ownerAfter: 'black',
                cause: 'EQUALITY_WILL',
                reason: 'equality_will_spawn',
                meta: { spawnIndex: 1 }
            },
            {
                type: 'SPAWN',
                row: 2,
                col: 3,
                stoneId: 'eq-2',
                ownerAfter: 'black',
                cause: 'EQUALITY_WILL',
                reason: 'equality_will_spawn',
                meta: { spawnIndex: 2 }
            },
            {
                type: 'SPAWN',
                row: 2,
                col: 4,
                stoneId: 'eq-3',
                ownerAfter: 'black',
                cause: 'EQUALITY_WILL',
                reason: 'equality_will_spawn',
                meta: { spawnIndex: 3 }
            }
        ]);
        expect(out.map((ev) => ({
            type: ev.type,
            phase: ev.phase,
            target: {
                r: ev.targets[0].r,
                col: ev.targets[0].col,
                stoneId: ev.targets[0].stoneId,
                cause: ev.targets[0].cause,
                reason: ev.targets[0].reason
            }
        }))).toEqual([
            {
                type: 'spawn',
                phase: 1,
                target: {
                    r: 2,
                    col: 2,
                    stoneId: 'eq-1',
                    cause: 'EQUALITY_WILL',
                    reason: 'equality_will_spawn'
                }
            },
            {
                type: 'spawn',
                phase: 2,
                target: {
                    r: 2,
                    col: 3,
                    stoneId: 'eq-2',
                    cause: 'EQUALITY_WILL',
                    reason: 'equality_will_spawn'
                }
            },
            {
                type: 'spawn',
                phase: 3,
                target: {
                    r: 2,
                    col: 4,
                    stoneId: 'eq-3',
                    cause: 'EQUALITY_WILL',
                    reason: 'equality_will_spawn'
                }
            }
        ]);
    });
    test('gives Salvation Will spawns sequential phases so each stone appears one by one', () => {
        const out = mapPlaybackEvents([
            {
                type: 'SPAWN',
                row: 3,
                col: 2,
                stoneId: 'sv-1',
                ownerAfter: 'black',
                cause: 'SALVATION_WILL',
                reason: 'salvation_spawn',
                meta: { spawnIndex: 1 }
            },
            {
                type: 'SPAWN',
                row: 3,
                col: 3,
                stoneId: 'sv-2',
                ownerAfter: 'black',
                cause: 'SALVATION_WILL',
                reason: 'salvation_spawn',
                meta: { spawnIndex: 2 }
            },
            {
                type: 'SPAWN',
                row: 3,
                col: 4,
                stoneId: 'sv-3',
                ownerAfter: 'black',
                cause: 'SALVATION_WILL',
                reason: 'salvation_spawn',
                meta: { spawnIndex: 3 }
            }
        ]);
        const mapped = out.map((ev) => ({
            type: ev.type,
            phase: ev.phase,
            target: {
                r: ev.targets[0].r,
                col: ev.targets[0].col,
                stoneId: ev.targets[0].stoneId,
                cause: ev.targets[0].cause,
                reason: ev.targets[0].reason
            }
        }));
        // Each spawn must be in its own strictly sequential phase so stones appear one by one
        // after the card-use animation ends (spec §10.38).
        // With no preceding CARD_USED the phase counter starts at 1; spawnIndex>=1 now always
        // increments, so phases are 2, 3, 4.
        expect(mapped).toHaveLength(3);
        expect(mapped[0]).toEqual({ type: 'spawn', phase: 2, target: { r: 3, col: 2, stoneId: 'sv-1', cause: 'SALVATION_WILL', reason: 'salvation_spawn' } });
        expect(mapped[1]).toEqual({ type: 'spawn', phase: 3, target: { r: 3, col: 3, stoneId: 'sv-2', cause: 'SALVATION_WILL', reason: 'salvation_spawn' } });
        expect(mapped[2]).toEqual({ type: 'spawn', phase: 4, target: { r: 3, col: 4, stoneId: 'sv-3', cause: 'SALVATION_WILL', reason: 'salvation_spawn' } });
        // Phases must be strictly increasing (serial order guaranteed)
        expect(mapped[1].phase).toBeGreaterThan(mapped[0].phase);
        expect(mapped[2].phase).toBeGreaterThan(mapped[1].phase);
    });
    test('keeps breeding, clone, split, proliferation, and normal spawns on their current mapping', () => {
        const out = mapPlaybackEvents([
            {
                type: 'SPAWN',
                row: 1,
                col: 1,
                stoneId: 'breed-1',
                ownerAfter: 'black',
                cause: 'BREEDING',
                reason: 'breeding_spawn_immediate',
                meta: {}
            },
            {
                type: 'SPAWN',
                row: 1,
                col: 2,
                stoneId: 'clone-1',
                ownerAfter: 'black',
                cause: 'CLONE_WILL',
                reason: 'clone_spawn',
                meta: { fromRow: 4, fromCol: 4 }
            },
            {
                type: 'SPAWN',
                row: 1,
                col: 3,
                stoneId: 'split-1',
                ownerAfter: 'white',
                cause: 'SPLIT_WILL',
                reason: 'split_spawn',
                meta: { fromRow: 4, fromCol: 5 }
            },
            {
                type: 'SPAWN',
                row: 1,
                col: 4,
                stoneId: 'prolif-1',
                ownerAfter: 'white',
                cause: 'PROLIFERATION_WILL',
                reason: 'proliferation_spawn',
                meta: { fromRow: 5, fromCol: 5 }
            },
            {
                type: 'SPAWN',
                row: 1,
                col: 5,
                stoneId: 'normal-1',
                ownerAfter: 'black',
                cause: 'SYSTEM',
                reason: 'standard_spawn',
                meta: {}
            }
        ]);
        expect(out.map((ev) => ({
            type: ev.type,
            phase: ev.phase,
            cause: ev.targets[0].cause,
            reason: ev.targets[0].reason,
            clone: !!ev.targets[0].clone
        }))).toEqual([
            {
                type: 'spawn',
                phase: 1,
                cause: 'BREEDING',
                reason: 'breeding_spawn_immediate',
                clone: false
            },
            {
                type: 'move',
                phase: 1,
                cause: 'CLONE_WILL',
                reason: 'clone_spawn',
                clone: true
            },
            {
                type: 'move',
                phase: 1,
                cause: 'SPLIT_WILL',
                reason: 'split_spawn',
                clone: true
            },
            {
                type: 'move',
                phase: 1,
                cause: 'PROLIFERATION_WILL',
                reason: 'proliferation_spawn',
                clone: true
            },
            {
                type: 'spawn',
                phase: 1,
                cause: 'SYSTEM',
                reason: 'standard_spawn',
                clone: false
            }
        ]);
    });
    test('SALVATION_WILL spawns all appear after card_use_animation phase (card-disappear timing, spec §10.38)', () => {
        // Simulate a realistic turn: CARD_USED followed by three SALVATION_WILL spawns.
        const out = mapPlaybackEvents([
            {
                type: 'CARD_USED',
                player: 'black',
                cardId: 'salvation_01',
                meta: { owner: 'black', cardType: 'SALVATION_WILL', cost: 17, name: '救済の意志',
                    salvationWillResolved: true, spawnedCount: 3 }
            },
            {
                type: 'SPAWN',
                row: 2, col: 2,
                stoneId: 'sv-a',
                ownerAfter: 'black',
                cause: 'SALVATION_WILL',
                reason: 'salvation_spawn',
                meta: { spawnIndex: 1 }
            },
            {
                type: 'SPAWN',
                row: 4, col: 4,
                stoneId: 'sv-b',
                ownerAfter: 'black',
                cause: 'SALVATION_WILL',
                reason: 'salvation_spawn',
                meta: { spawnIndex: 2 }
            },
            {
                type: 'SPAWN',
                row: 6, col: 6,
                stoneId: 'sv-c',
                ownerAfter: 'black',
                cause: 'SALVATION_WILL',
                reason: 'salvation_spawn',
                meta: { spawnIndex: 3 }
            }
        ]);
        const cardUseEv = out.find((ev) => ev && ev.type === 'card_use_animation');
        const spawnEvs = out.filter((ev) => ev && ev.type === 'spawn' &&
            Array.isArray(ev.targets) && ev.targets[0] && ev.targets[0].cause === 'SALVATION_WILL');
        expect(cardUseEv).toBeTruthy();
        expect(spawnEvs).toHaveLength(3);
        // Every spawn must be in a phase strictly AFTER the card_use_animation (card-disappear timing).
        for (const spawnEv of spawnEvs) {
            expect(spawnEv.phase).toBeGreaterThan(cardUseEv.phase);
        }
        // Spawns must still be in strictly increasing sequential phases (one-by-one appearance).
        expect(spawnEvs[1].phase).toBeGreaterThan(spawnEvs[0].phase);
        expect(spawnEvs[2].phase).toBeGreaterThan(spawnEvs[1].phase);
    });
});
//# sourceMappingURL=game.pipeline-ui-adapter.spawn.test.js.map