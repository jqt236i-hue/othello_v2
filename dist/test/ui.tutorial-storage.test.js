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
const TutorialStorageModule = __importStar(require("../ui/tutorial/tutorial-storage.js"));
describe('tutorial/story progress storage', () => {
    const storageBag = {};
    beforeEach(() => {
        Object.keys(storageBag).forEach((key) => delete storageBag[key]);
        global.localStorage = {
            getItem: jest.fn((key) => (Object.prototype.hasOwnProperty.call(storageBag, key) ? storageBag[key] : null)),
            setItem: jest.fn((key, value) => {
                storageBag[key] = String(value);
            })
        };
    });
    afterEach(() => {
        delete global.localStorage;
    });
    test('legacy clearedByScenario payload migrates into tutorial progress', () => {
        storageBag[TutorialStorageModule.STORAGE_KEY] = JSON.stringify({
            clearedByScenario: {
                chapter0: true
            }
        });
        const progress = TutorialStorageModule.readProgress();
        expect(progress).toEqual({
            tutorial: {
                clearedScenarioIds: {
                    chapter0: true
                }
            },
            story: {
                unlockedChapterIds: {},
                clearedChapterIds: {}
            }
        });
        expect(TutorialStorageModule.isTutorialScenarioCleared('chapter0')).toBe(true);
    });
    test('tutorial and story progress can be stored independently', () => {
        TutorialStorageModule.saveTutorialScenarioCleared('chapter0', true);
        TutorialStorageModule.saveStoryChapterUnlocked('chapter1', true);
        TutorialStorageModule.saveStoryChapterCleared('chapter1', true);
        const raw = JSON.parse(storageBag[TutorialStorageModule.STORAGE_KEY]);
        expect(raw).toEqual({
            tutorial: {
                clearedScenarioIds: {
                    chapter0: true
                }
            },
            story: {
                unlockedChapterIds: {
                    chapter1: true
                },
                clearedChapterIds: {
                    chapter1: true
                }
            }
        });
        expect(TutorialStorageModule.isScenarioCleared('chapter0')).toBe(true);
        expect(TutorialStorageModule.isStoryChapterUnlocked('chapter1')).toBe(true);
        expect(TutorialStorageModule.isStoryChapterCleared('chapter1')).toBe(true);
    });
});
//# sourceMappingURL=ui.tutorial-storage.test.js.map