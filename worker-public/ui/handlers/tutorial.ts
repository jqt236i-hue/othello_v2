/**
 * @file tutorial.ts
 * @description Tutorial UI handler
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface TutorialController {
  open: () => void;
}

interface TutorialControllerModule {
  createTutorialController: (config: {
    root: Window;
    overlay: HTMLElement | null;
    button: HTMLElement | null;
  }) => TutorialController | null;
}

interface TutorialOptions {
  root?: Window;
}

function resolveController(rootRef: Window & { TutorialControllerModule?: TutorialControllerModule }, tutorialOverlay: HTMLElement | null, tutorialBtn: HTMLElement | null): TutorialController | null {
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
  } catch (e) {
    return null;
  }
}

function markUnavailable(tutorialBtn: HTMLElement | null, tutorialOverlay: HTMLElement | null): void {
  if (tutorialBtn) {
    (tutorialBtn as HTMLButtonElement).disabled = true;
    tutorialBtn.setAttribute('aria-disabled', 'true');
    tutorialBtn.setAttribute('aria-label', 'tutorial 準備中');
    tutorialBtn.title = 'tutorial は準備中です';
    (tutorialBtn as HTMLElement & { dataset: DOMStringMap }).dataset.tutorialState = 'unavailable';
  }
  if (tutorialOverlay) {
    tutorialOverlay.setAttribute('aria-hidden', 'true');
    tutorialOverlay.textContent = '';
  }
}

function setupTutorialControls(tutorialBtn: HTMLElement | null, tutorialOverlay: HTMLElement | null, options: TutorialOptions): TutorialController | null {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis as unknown) as Window & { TutorialControllerModule?: TutorialControllerModule };
  const controller = resolveController(rootRef, tutorialOverlay, tutorialBtn);

  if (!controller || typeof controller.open !== 'function') {
    markUnavailable(tutorialBtn, tutorialOverlay);
    return null;
  }

  if (!tutorialBtn) return controller;

  (tutorialBtn as HTMLButtonElement).disabled = false;
  tutorialBtn.removeAttribute('aria-disabled');
  tutorialBtn.removeAttribute('title');
  (tutorialBtn as HTMLElement & { dataset: DOMStringMap }).dataset.tutorialState = 'ready';

  if ((tutorialBtn as HTMLElement & { dataset: DOMStringMap }).dataset.tutorialBound !== '1') {
    tutorialBtn.addEventListener('click', () => {
      controller.open();
    });
    (tutorialBtn as HTMLElement & { dataset: DOMStringMap }).dataset.tutorialBound = '1';
  }

  return controller;
}

export = {
  resolveController,
  markUnavailable,
  setupTutorialControls
};
