(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.TutorialStorageModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const STORAGE_KEY = 'cardOthello.tutorial.progress.v1';

    function createEmptyProgress() {
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

    function normalizeFlagRecord(value) {
        if (!value || typeof value !== 'object') return {};
        const out = {};
        for (const [key, flag] of Object.entries(value)) {
            if (!key) continue;
            out[String(key)] = flag === true;
        }
        return out;
    }

    function normalizeProgress(parsed) {
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

    function getStorage() {
        try {
            if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
        } catch (e) { /* ignore */ }
        return null;
    }

    function readProgress() {
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

    function writeProgress(progress) {
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

    function isTutorialScenarioCleared(scenarioId) {
        if (!scenarioId) return false;
        const progress = readProgress();
        return progress.tutorial.clearedScenarioIds[String(scenarioId)] === true;
    }

    function saveTutorialScenarioCleared(scenarioId, cleared) {
        if (!scenarioId) return false;
        const progress = readProgress();
        progress.tutorial.clearedScenarioIds[String(scenarioId)] = cleared !== false;
        return writeProgress(progress);
    }

    function isStoryChapterUnlocked(chapterId) {
        if (!chapterId) return false;
        const progress = readProgress();
        return progress.story.unlockedChapterIds[String(chapterId)] === true;
    }

    function saveStoryChapterUnlocked(chapterId, unlocked) {
        if (!chapterId) return false;
        const progress = readProgress();
        progress.story.unlockedChapterIds[String(chapterId)] = unlocked !== false;
        return writeProgress(progress);
    }

    function isStoryChapterCleared(chapterId) {
        if (!chapterId) return false;
        const progress = readProgress();
        return progress.story.clearedChapterIds[String(chapterId)] === true;
    }

    function saveStoryChapterCleared(chapterId, cleared) {
        if (!chapterId) return false;
        const progress = readProgress();
        progress.story.clearedChapterIds[String(chapterId)] = cleared !== false;
        return writeProgress(progress);
    }

    function isScenarioCleared(scenarioId) {
        return isTutorialScenarioCleared(scenarioId);
    }

    function saveScenarioCleared(scenarioId, cleared) {
        return saveTutorialScenarioCleared(scenarioId, cleared);
    }

    return {
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
}));
