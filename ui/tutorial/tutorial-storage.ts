'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const STORAGE_KEY = 'cardOthello.tutorial.progress.v1';

interface ProgressData {
  tutorial: {
    clearedScenarioIds: Record<string, boolean>;
  };
  story: {
    unlockedChapterIds: Record<string, boolean>;
    clearedChapterIds: Record<string, boolean>;
  };
}

function createEmptyProgress(): ProgressData {
  return {
    tutorial: {
      clearedScenarioIds: {}
    },
    story: {
      unlockedChapterIds: {},
      clearedChapterIds: {}
    }
  };
}

function normalizeFlagRecord(value: any): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(value)) {
    if (!key) continue;
    out[String(key)] = flag === true;
  }
  return out;
}

function normalizeProgress(parsed: any): ProgressData {
  const base = createEmptyProgress();
  if (!parsed || typeof parsed !== 'object') return base;

  const hasNamespacedShape = parsed.tutorial || parsed.story;
  if (hasNamespacedShape) {
    base.tutorial.clearedScenarioIds = normalizeFlagRecord(
      parsed.tutorial && parsed.tutorial.clearedScenarioIds
    );
    base.story.unlockedChapterIds = normalizeFlagRecord(
      parsed.story && parsed.story.unlockedChapterIds
    );
    base.story.clearedChapterIds = normalizeFlagRecord(
      parsed.story && parsed.story.clearedChapterIds
    );
    return base;
  }

  base.tutorial.clearedScenarioIds = normalizeFlagRecord(parsed.clearedByScenario);
  return base;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (e) { /* ignore */ }
  return null;
}

function readProgress(): ProgressData {
  const storage = getStorage();
  if (!storage) return createEmptyProgress();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyProgress();
    const parsed = JSON.parse(raw);
    return normalizeProgress(parsed);
  } catch (e) {
    return createEmptyProgress();
  }
}

function writeProgress(progress: any): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const next = normalizeProgress(progress);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch (e) {
    return false;
  }
}

function isTutorialScenarioCleared(scenarioId: string): boolean {
  if (!scenarioId) return false;
  const progress = readProgress();
  return progress.tutorial.clearedScenarioIds[String(scenarioId)] === true;
}

function saveTutorialScenarioCleared(scenarioId: string, cleared?: boolean): boolean {
  if (!scenarioId) return false;
  const progress = readProgress();
  progress.tutorial.clearedScenarioIds[String(scenarioId)] = cleared !== false;
  return writeProgress(progress);
}

function isStoryChapterUnlocked(chapterId: string): boolean {
  if (!chapterId) return false;
  const progress = readProgress();
  return progress.story.unlockedChapterIds[String(chapterId)] === true;
}

function saveStoryChapterUnlocked(chapterId: string, unlocked?: boolean): boolean {
  if (!chapterId) return false;
  const progress = readProgress();
  progress.story.unlockedChapterIds[String(chapterId)] = unlocked !== false;
  return writeProgress(progress);
}

function isStoryChapterCleared(chapterId: string): boolean {
  if (!chapterId) return false;
  const progress = readProgress();
  return progress.story.clearedChapterIds[String(chapterId)] === true;
}

function saveStoryChapterCleared(chapterId: string, cleared?: boolean): boolean {
  if (!chapterId) return false;
  const progress = readProgress();
  progress.story.clearedChapterIds[String(chapterId)] = cleared !== false;
  return writeProgress(progress);
}

function isScenarioCleared(scenarioId: string): boolean {
  return isTutorialScenarioCleared(scenarioId);
}

function saveScenarioCleared(scenarioId: string, cleared?: boolean): boolean {
  return saveTutorialScenarioCleared(scenarioId, cleared);
}

const TutorialStorage = {
  STORAGE_KEY,
  createEmptyProgress,
  readProgress,
  writeProgress,
  isTutorialScenarioCleared,
  saveTutorialScenarioCleared,
  isStoryChapterUnlocked,
  saveStoryChapterUnlocked,
  isStoryChapterCleared,
  saveStoryChapterCleared,
  isScenarioCleared,
  saveScenarioCleared
};

export = TutorialStorage;
