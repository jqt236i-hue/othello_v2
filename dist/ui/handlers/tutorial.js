"use strict";
/**
 * @file tutorial.ts
 * @description Tutorial UI handler
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function resolveController(rootRef, tutorialOverlay, tutorialBtn) {
    const controllerModule = rootRef && rootRef.TutorialControllerModule;
    if (!controllerModule || typeof controllerModule.createTutorialController !== 'function') {
        return null;
    }
    try {
        return controllerModule.createTutorialController({
            root: rootRef,
            overlay: tutorialOverlay,
            button: tutorialBtn
        });
    }
    catch (e) {
        return null;
    }
}
function markUnavailable(tutorialBtn, tutorialOverlay) {
    if (tutorialBtn) {
        tutorialBtn.disabled = true;
        tutorialBtn.setAttribute('aria-disabled', 'true');
        tutorialBtn.setAttribute('aria-label', 'tutorial 準備中');
        tutorialBtn.title = 'tutorial は準備中です';
        tutorialBtn.dataset.tutorialState = 'unavailable';
    }
    if (tutorialOverlay) {
        tutorialOverlay.setAttribute('aria-hidden', 'true');
        tutorialOverlay.textContent = '';
    }
}
function setupTutorialControls(tutorialBtn, tutorialOverlay, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
    const controller = resolveController(rootRef, tutorialOverlay, tutorialBtn);
    if (!controller || typeof controller.open !== 'function') {
        markUnavailable(tutorialBtn, tutorialOverlay);
        return null;
    }
    if (!tutorialBtn)
        return controller;
    tutorialBtn.disabled = false;
    tutorialBtn.removeAttribute('aria-disabled');
    tutorialBtn.removeAttribute('title');
    tutorialBtn.dataset.tutorialState = 'ready';
    if (tutorialBtn.dataset.tutorialBound !== '1') {
        tutorialBtn.addEventListener('click', () => {
            controller.open();
        });
        tutorialBtn.dataset.tutorialBound = '1';
    }
    return controller;
}
module.exports = {
    resolveController,
    markUnavailable,
    setupTutorialControls
};
//# sourceMappingURL=tutorial.js.map