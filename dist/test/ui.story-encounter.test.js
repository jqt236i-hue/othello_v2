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
const StoryEncounterModule = __importStar(require("../ui/story/story-encounter.js"));
describe('story encounter result overrides', () => {
    test('win result exposes continue action and story ranking exclusion', async () => {
        const stateStore = {
            setEncounterState: jest.fn()
        };
        const runtime = {
            restoreCpuTurns: jest.fn(),
            waitForResetReady: jest.fn(() => Promise.resolve(true)),
            updateCpuLabel: jest.fn()
        };
        const root = {
            cpuSmartness: { black: 1, white: 1 },
            resetGame: jest.fn(),
            emitLogAdded: jest.fn()
        };
        const encounter = StoryEncounterModule.createStoryEncounter({
            root,
            stateStore,
            runtime
        });
        const onWinContinue = jest.fn(() => Promise.resolve(true));
        await encounter.startEncounter({
            encounterId: 'chapter1_goblin',
            enemyName: '盤喰いの小鬼',
            enemyImageSrc: 'assets/story/cpu/level1.png',
            cpuLevel: 1,
            onWinContinue
        });
        const override = encounter.resolveStoryEncounterResult({ black: 40, white: 24 }, 'black');
        expect(override.title).toBe('勝利');
        expect(override.metaText).toBe('ストーリー対局: ランキング対象外');
        expect(override.primaryLabel).toBe('続ける');
        await override.onPrimary();
        expect(onWinContinue).toHaveBeenCalled();
        expect(root.resetGame).toHaveBeenCalled();
    });
    test('story result exit does not reset the game and preserves enemy portrait info', async () => {
        const stateStore = {
            setEncounterState: jest.fn()
        };
        const runtime = {
            restoreCpuTurns: jest.fn(),
            waitForResetReady: jest.fn(() => Promise.resolve(true)),
            updateCpuLabel: jest.fn()
        };
        const root = {
            cpuSmartness: { black: 1, white: 1 },
            resetGame: jest.fn(),
            emitLogAdded: jest.fn()
        };
        const encounter = StoryEncounterModule.createStoryEncounter({
            root,
            stateStore,
            runtime
        });
        const onAbort = jest.fn(() => Promise.resolve(true));
        await encounter.startEncounter({
            encounterId: 'chapter1_goblin',
            enemyName: '盤喰いの小鬼',
            enemyImageSrc: 'assets/story/cpu/level1.png',
            cpuLevel: 1,
            onAbort
        });
        root.resetGame.mockClear();
        const override = encounter.resolveStoryEncounterResult({ black: 40, white: 24 }, 'black');
        expect(override.layout).toBe('story');
        expect(override.enemyImageSrc).toBe('assets/story/cpu/level1.png');
        await override.onSecondary();
        expect(onAbort).toHaveBeenCalled();
        expect(root.resetGame).not.toHaveBeenCalled();
    });
    test('story encounter deck override is applied only during the encounter reset', async () => {
        const stateStore = {
            setEncounterState: jest.fn()
        };
        const runtime = {
            restoreCpuTurns: jest.fn(),
            waitForResetReady: jest.fn(() => Promise.resolve(true)),
            updateCpuLabel: jest.fn()
        };
        const fallbackDeckInitOptions = { initialDeckSpec: { cards: ['perma_01', 'observer_01', 'destroy_01'] } };
        const originalBuildCardInitOptions = jest.fn(() => fallbackDeckInitOptions);
        const resetSnapshots = [];
        const root = {
            cpuSmartness: { black: 1, white: 1 },
            __uiImpl_turn_manager: {
                buildCardInitOptions: originalBuildCardInitOptions
            },
            resetGame: jest.fn(function () {
                resetSnapshots.push(this.__uiImpl_turn_manager.buildCardInitOptions());
            }),
            emitLogAdded: jest.fn()
        };
        const encounter = StoryEncounterModule.createStoryEncounter({
            root,
            stateStore,
            runtime
        });
        const storyDeckIds = Array(15).fill('perma_01').concat(Array(15).fill('observer_01'));
        await encounter.startEncounter({
            encounterId: 'chapter1_goblin',
            enemyName: '盤喰いの小鬼',
            enemyImageSrc: 'assets/story/cpu/level1.png',
            cpuLevel: 1,
            initialDeckCardIdsByPlayer: {
                black: storyDeckIds
            }
        });
        expect(resetSnapshots).toEqual([
            {
                initialDeckCardIdsByPlayer: {
                    black: storyDeckIds
                }
            }
        ]);
        expect(root.__uiImpl_turn_manager.buildCardInitOptions).not.toBe(originalBuildCardInitOptions);
        const override = encounter.resolveStoryEncounterResult({ black: 40, white: 24 }, 'black');
        await override.onSecondary();
        expect(root.__uiImpl_turn_manager.buildCardInitOptions).toBe(originalBuildCardInitOptions);
        expect(root.__uiImpl_turn_manager.buildCardInitOptions()).toEqual(fallbackDeckInitOptions);
    });
    test('encounter-specific BGM switches on start and restores on exit', async () => {
        const stateStore = {
            setEncounterState: jest.fn()
        };
        const runtime = {
            restoreCpuTurns: jest.fn(),
            waitForResetReady: jest.fn(() => Promise.resolve(true)),
            updateCpuLabel: jest.fn()
        };
        const soundEngine = {
            currentTrackIndex: 1,
            playlist: [
                { name: 'c-othello', file: 'assets/audio/bgm/c-othello.mp3' },
                { name: 'c-othello-2', file: 'assets/audio/bgm/c-othello-2.mp3' },
                { name: '盤喰いの小鬼戦', file: 'assets/audio/bgm/盤喰いの小鬼戦.mp3' }
            ],
            init: jest.fn(),
            setBgmTrack: jest.fn(function (index) {
                this.currentTrackIndex = Number(index);
            })
        };
        const root = {
            cpuSmartness: { black: 1, white: 1 },
            resetGame: jest.fn(),
            emitLogAdded: jest.fn(),
            SoundEngine: soundEngine
        };
        const encounter = StoryEncounterModule.createStoryEncounter({
            root,
            stateStore,
            runtime
        });
        await encounter.startEncounter({
            encounterId: 'chapter1_goblin',
            enemyName: '盤喰いの小鬼',
            enemyImageSrc: 'assets/story/cpu/level1.png',
            cpuLevel: 1,
            bgmTrackFile: 'assets/audio/bgm/盤喰いの小鬼戦.mp3'
        });
        expect(soundEngine.setBgmTrack).toHaveBeenNthCalledWith(1, 2);
        expect(soundEngine.currentTrackIndex).toBe(2);
        const override = encounter.resolveStoryEncounterResult({ black: 40, white: 24 }, 'black');
        await override.onSecondary();
        expect(soundEngine.setBgmTrack).toHaveBeenNthCalledWith(2, 1);
        expect(soundEngine.currentTrackIndex).toBe(1);
    });
});
//# sourceMappingURL=ui.story-encounter.test.js.map