import * as TutorialStorageModule from '../ui/tutorial/tutorial-storage.js';

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
