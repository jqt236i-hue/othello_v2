'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const StoryControllerModule = _require('../story/story-controller');
const TutorialControllerModule = _require('../tutorial/tutorial-controller');
const StoryStepsModule = _require('../story/story-steps');
const TutorialStepsModule = _require('../tutorial/tutorial-steps');
const TutorialStorageModule = _require('../tutorial/tutorial-storage');
const DEFAULT_TUTORIAL_SCENARIO_ID = 'chapter0';
const DEFAULT_TUTORIAL_MENU_ENTRY = Object.freeze({
    scenarioId: DEFAULT_TUTORIAL_SCENARIO_ID,
    menuLabel: '第零章 チュートリアル',
    menuDescription: '盤理の観測者と基本ルールを学ぶ導入章。',
    unavailableMessage: 'この build ではチュートリアルを開始できません。'
});
const STORY_UNAVAILABLE_MESSAGE = 'story は準備中です';
const TEMPLATE = [
    '<div class="story-menu-backdrop"></div>',
    '<div class="story-menu-panel" role="dialog" aria-modal="false" aria-label="story menu">',
    '  <div class="story-menu-header">',
    '    <div class="story-menu-title">story</div>',
    '    <button class="story-menu-close" type="button" aria-label="story menu を閉じる">×</button>',
    '  </div>',
    '  <div class="story-menu-subtitle">章を選んで開始します。未解放の章は表示されますが開始できません。</div>',
    '  <div class="story-menu-list"></div>',
    '  <div class="story-menu-note"></div>',
    '</div>'
].join('');
function resolveStoryController(rootRef, tutorialOverlay, storyBtn) {
    if (!StoryControllerModule || typeof StoryControllerModule.createStoryController !== 'function') {
        return null;
    }
    try {
        return StoryControllerModule.createStoryController({
            root: rootRef,
            overlay: tutorialOverlay,
            button: storyBtn
        });
    }
    catch (e) {
        return null;
    }
}
function resolveTutorialController(rootRef, tutorialOverlay) {
    if (!TutorialControllerModule || typeof TutorialControllerModule.createTutorialController !== 'function') {
        return null;
    }
    try {
        return TutorialControllerModule.createTutorialController({
            root: rootRef,
            overlay: tutorialOverlay,
            button: null
        });
    }
    catch (e) {
        return null;
    }
}
function markUnavailable(storyBtn, storyMenuOverlay) {
    if (storyBtn) {
        storyBtn.disabled = true;
        storyBtn.setAttribute('aria-disabled', 'true');
        storyBtn.setAttribute('aria-label', 'story 準備中');
        storyBtn.title = 'story は準備中です';
        storyBtn.dataset.storyState = 'unavailable';
    }
    if (storyMenuOverlay) {
        storyMenuOverlay.setAttribute('aria-hidden', 'true');
        storyMenuOverlay.textContent = '';
    }
}
function mountMenu(menuRoot) {
    if (!menuRoot || menuRoot.dataset.storyMenuMounted === '1')
        return;
    menuRoot.innerHTML = TEMPLATE;
    menuRoot.dataset.storyMenuMounted = '1';
}
function setMenuOpen(menuRoot, button, open) {
    if (!menuRoot)
        return;
    const isOpen = open === true;
    menuRoot.classList.toggle('is-open', isOpen);
    menuRoot.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (button) {
        button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
}
function isTutorialBusy(rootRef) {
    try {
        const tutorialStateApi = rootRef && rootRef.Tutorial && rootRef.Tutorial.State;
        if (!tutorialStateApi)
            return false;
        if (typeof tutorialStateApi.isObserverDuelActive === 'function' && tutorialStateApi.isObserverDuelActive()) {
            return true;
        }
        if (typeof tutorialStateApi.isActive === 'function' && tutorialStateApi.isActive()) {
            return true;
        }
    }
    catch (e) { /* ignore */ }
    return false;
}
function getTutorialScenarioIds() {
    if (TutorialStepsModule && typeof TutorialStepsModule.getTutorialScenarioIds === 'function') {
        const scenarioIds = TutorialStepsModule.getTutorialScenarioIds();
        if (Array.isArray(scenarioIds) && scenarioIds.length > 0) {
            return scenarioIds;
        }
    }
    return [DEFAULT_TUTORIAL_SCENARIO_ID];
}
function getTutorialMenuEntry(scenarioId, tutorialController) {
    const scenario = TutorialStepsModule && typeof TutorialStepsModule.getScenario === 'function'
        ? TutorialStepsModule.getScenario(scenarioId)
        : null;
    const cleared = !!(TutorialStorageModule
        && typeof TutorialStorageModule.isTutorialScenarioCleared === 'function'
        && TutorialStorageModule.isTutorialScenarioCleared(scenarioId));
    const canOpen = !!(tutorialController && scenario);
    return {
        id: scenarioId,
        kind: 'tutorial',
        menuLabel: (scenario && scenario.menuLabel) || DEFAULT_TUTORIAL_MENU_ENTRY.menuLabel,
        menuDescription: (scenario && scenario.menuDescription) || DEFAULT_TUTORIAL_MENU_ENTRY.menuDescription,
        availability: {
            unlocked: canOpen,
            cleared,
            message: canOpen
                ? ''
                : ((scenario && scenario.menuUnavailableMessage) || DEFAULT_TUTORIAL_MENU_ENTRY.unavailableMessage)
        },
        open: canOpen
            ? function () {
                return tutorialController.open({ scenarioId });
            }
            : null
    };
}
function getStoryChapterIds() {
    if (!StoryStepsModule || typeof StoryStepsModule.getChapterIds !== 'function') {
        return [];
    }
    return StoryStepsModule.getChapterIds();
}
function getStoryMenuEntry(chapterId, storyController) {
    const chapter = StoryStepsModule && typeof StoryStepsModule.getChapter === 'function'
        ? StoryStepsModule.getChapter(chapterId)
        : null;
    if (!chapter)
        return null;
    const availability = storyController && typeof storyController.getChapterAvailability === 'function'
        ? storyController.getChapterAvailability(chapterId)
        : {
            unlocked: false,
            cleared: !!(TutorialStorageModule
                && typeof TutorialStorageModule.isStoryChapterCleared === 'function'
                && TutorialStorageModule.isStoryChapterCleared(chapterId)),
            message: STORY_UNAVAILABLE_MESSAGE
        };
    return {
        id: chapterId,
        kind: 'story',
        menuLabel: chapter.menuLabel || chapter.title || chapterId,
        menuDescription: chapter.menuDescription || '開始できます。',
        availability,
        open: availability.unlocked && storyController
            ? function () {
                return storyController.open({ chapterId });
            }
            : null
    };
}
function getMenuEntries(storyController, tutorialController) {
    const entries = [];
    for (const scenarioId of getTutorialScenarioIds()) {
        entries.push(getTutorialMenuEntry(scenarioId, tutorialController));
    }
    for (const chapterId of getStoryChapterIds()) {
        const entry = getStoryMenuEntry(chapterId, storyController);
        if (entry)
            entries.push(entry);
    }
    return entries;
}
function createMenuButton(menuRoot, entry, onOpen) {
    const availability = entry && entry.availability ? entry.availability : {};
    const button = menuRoot.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'story-chapter-btn';
    button.dataset.storyEntryKind = entry && entry.kind ? entry.kind : 'story';
    const stateLabel = availability.cleared
        ? 'clear'
        : (availability.unlocked ? 'playable' : 'locked');
    if (!availability.unlocked)
        button.classList.add('is-locked');
    if (!availability.unlocked)
        button.disabled = true;
    const nameEl = menuRoot.ownerDocument.createElement('div');
    nameEl.className = 'story-chapter-name';
    nameEl.textContent = (entry && entry.menuLabel) || '';
    const stateEl = menuRoot.ownerDocument.createElement('div');
    stateEl.className = 'story-chapter-state';
    stateEl.textContent = stateLabel;
    const descEl = menuRoot.ownerDocument.createElement('div');
    descEl.className = 'story-chapter-desc';
    descEl.textContent = availability.unlocked
        ? ((entry && entry.menuDescription) || '開始できます。')
        : (availability.message || '開始できません。');
    button.appendChild(nameEl);
    button.appendChild(stateEl);
    button.appendChild(descEl);
    if (availability.unlocked && typeof onOpen === 'function') {
        button.addEventListener('click', onOpen);
    }
    return button;
}
function setupStoryControls(storyBtn, storyMenuOverlay, tutorialOverlay, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
    const storyController = resolveStoryController(rootRef, tutorialOverlay, storyBtn);
    const tutorialController = resolveTutorialController(rootRef, tutorialOverlay);
    if (!storyMenuOverlay) {
        markUnavailable(storyBtn, storyMenuOverlay);
        return null;
    }
    const _overlay = storyMenuOverlay;
    mountMenu(_overlay);
    const closeButton = _overlay.querySelector('.story-menu-close');
    const backdrop = _overlay.querySelector('.story-menu-backdrop');
    const list = _overlay.querySelector('.story-menu-list');
    const note = _overlay.querySelector('.story-menu-note');
    function renderMenu() {
        if (!list)
            return;
        list.innerHTML = '';
        const entries = getMenuEntries(storyController, tutorialController);
        for (const entry of entries) {
            const button = createMenuButton(_overlay, entry, () => {
                setMenuOpen(_overlay, storyBtn, false);
                if (typeof entry.open === 'function') {
                    entry.open();
                }
            });
            list.appendChild(button);
        }
        if (note) {
            note.textContent = '第零章クリア後に第一章が解放されます。各章クリアで次章が解放されます。';
        }
    }
    function toggleMenu() {
        const isOpen = _overlay.classList.contains('is-open');
        if (isOpen) {
            setMenuOpen(_overlay, storyBtn, false);
            return;
        }
        if (storyController && typeof storyController.isActive === 'function' && storyController.isActive()) {
            return;
        }
        if (isTutorialBusy(rootRef)) {
            return;
        }
        renderMenu();
        setMenuOpen(_overlay, storyBtn, true);
    }
    if (storyBtn) {
        storyBtn.disabled = false;
        storyBtn.removeAttribute('aria-disabled');
        storyBtn.removeAttribute('title');
        storyBtn.dataset.storyState = 'ready';
    }
    if (storyBtn && storyBtn.dataset.storyBound !== '1') {
        storyBtn.addEventListener('click', () => {
            toggleMenu();
        });
        storyBtn.dataset.storyBound = '1';
    }
    if (closeButton && closeButton.dataset.storyBound !== '1') {
        closeButton.addEventListener('click', () => {
            setMenuOpen(_overlay, storyBtn, false);
        });
        closeButton.dataset.storyBound = '1';
    }
    if (backdrop && backdrop.dataset.storyBound !== '1') {
        backdrop.addEventListener('click', () => {
            setMenuOpen(_overlay, storyBtn, false);
        });
        backdrop.dataset.storyBound = '1';
    }
    return storyController || tutorialController;
}
const StoryHandler = {
    resolveController: resolveStoryController,
    resolveStoryController,
    resolveTutorialController,
    markUnavailable,
    setupStoryControls
};
module.exports = StoryHandler;
//# sourceMappingURL=story.js.map