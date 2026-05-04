declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

declare var SoundEngineAccessModule: any;
declare var SoundEngine: any;

'use strict';

const TutorialStepsModule = _require('./tutorial-steps');
const TutorialStateModule = _require('./tutorial-state');
const TutorialStorageModule = _require('./tutorial-storage');
const TutorialTypewriterModule = _require('./typewriter');
const TutorialOverlayModule = _require('./tutorial-overlay');
const TutorialActionWaitModule = _require('./tutorial-action-wait');
const TutorialScenarioDuelModule = _require('./tutorial-scenario-duel');
const TutorialRuntimeModule = _require('./tutorial-runtime');

const controllerCache = typeof WeakMap === 'function' ? new WeakMap() : null;
const TUTORIAL_TEXT_CLICK_SOUND = 'assets/story/sound-ef/テキストをクリックするとき.mp3';
const TUTORIAL_CHOICE_SELECT_SOUND = 'assets/story/sound-ef/自分視点選択肢を選ぶとき.mp3';

function resolveSoundEngineAccessModule(rootRef: any): any {
  if (typeof _require === 'function') {
    try {
      return _require('../sound-engine-access.js');
    } catch (e) { /* ignore */ }
  }
  return (rootRef && rootRef.SoundEngineAccessModule)
    || (typeof (SoundEngineAccessModule as any) !== 'undefined' ? (SoundEngineAccessModule as any) : null)
    || (typeof globalThis !== 'undefined' ? (globalThis as any).SoundEngineAccessModule : null);
}

function composeText(textValue: any): string {
  if (Array.isArray(textValue)) return textValue.join('\n');
  return String(textValue || '');
}

function resolveModeByStepType(stepType: string): string {
  switch (stepType) {
  case 'choice':
    return 'choice';
  case 'action_wait':
    return 'action_wait';
  case 'completed':
    return 'completed';
  default:
    return 'dialogue';
  }
}

function createTutorialController(options?: any): any {
  const opts = options && typeof options === 'object' ? options : {};
  const overlayRoot = opts.overlay;
  const button = opts.button || null;
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);

  if (!overlayRoot) {
    throw new Error('tutorial overlay is required');
  }
  if (controllerCache && controllerCache.has(overlayRoot)) {
    return controllerCache.get(overlayRoot);
  }

  if (
    !TutorialStepsModule ||
    !TutorialStateModule ||
    !TutorialStorageModule ||
    !TutorialTypewriterModule ||
    !TutorialOverlayModule ||
    !TutorialActionWaitModule ||
    !TutorialScenarioDuelModule ||
    !TutorialRuntimeModule
  ) {
    throw new Error('tutorial modules are not fully available');
  }

  const stateStore = TutorialStateModule;
  const runtime = TutorialRuntimeModule.createTutorialRuntime({ root: rootRef });
  const tutorialOverlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
  const defaultScenario = TutorialStepsModule.getScenario(TutorialStepsModule.getDefaultScenarioId());
  const scenarioDuel = TutorialScenarioDuelModule.createTutorialScenarioDuel({
    root: rootRef,
    stateStore,
    runtime,
    observerName: defaultScenario ? defaultScenario.observerName : '盤理の観測者',
    observerImageSrc: defaultScenario ? defaultScenario.observerImageSrc : 'assets/images/cpu/level6.png'
  });

  let currentPrimaryAction: any = null;
  let renderToken = 0;

  const typewriter = TutorialTypewriterModule.createTypewriter({
    onUpdate: (visibleText: string, meta: any) => {
      tutorialOverlay.setBodyText(visibleText);
      tutorialOverlay.setAdvanceHint(meta && meta.typing ? 'クリックで全文表示' : 'クリックで次へ');
    },
    onComplete: () => {
      tutorialOverlay.setAdvanceHint('クリックで次へ');
    }
  });

  const actionWait = TutorialActionWaitModule.createTutorialActionWait({
    root: rootRef.document,
    overlay: overlayRoot,
    resolveDescriptorTargets: (descriptor: any) => resolveDescriptorTargets(descriptor)
  });

  rootRef.Tutorial = rootRef.Tutorial || {};
  rootRef.Tutorial.State = stateStore.publicApi;
  rootRef.Tutorial.ScenarioDuel = scenarioDuel;

  const stepSetupHandlers = Object.freeze({
    ensure_observer_card_ready: () => runtime.ensureObserverCardReady(),
    prepare_numeric_demo: () => runtime.prepareNumericDemo(stateStore),
    prepare_observer_use_demo: () => runtime.prepareObserverUseDemo()
  } as any);

  const choiceActionHandlers = Object.freeze({
    start_main_tutorial: () => startMainTutorialChoiceAction(),
    start_observer_duel: () => startObserverDuelChoiceAction()
  } as any);

  function setButtonState(active: boolean): void {
    if (!button) return;
    button.setAttribute('aria-expanded', active ? 'true' : 'false');
    button.dataset.tutorialState = active ? 'active' : 'ready';
  }

  function emitInfo(message: string): void {
    try {
      if (typeof rootRef.emitLogAdded === 'function') {
        rootRef.emitLogAdded(message, 'normal');
        return;
      }
    } catch (e) { /* ignore */ }
    try { if (typeof console !== 'undefined' && console.log) console.log('[tutorial]', message); } catch (e) { /* ignore */ }
  }

  function playTutorialEffect(filePath: string): boolean {
    const accessModule = resolveSoundEngineAccessModule(rootRef);
    const soundEngine =
      (accessModule && typeof accessModule.resolveSoundEngine === 'function'
        ? accessModule.resolveSoundEngine(rootRef)
        : null)
      || (typeof (SoundEngine as any) !== 'undefined' && (SoundEngine as any))
      || (rootRef && rootRef.SoundEngine)
      || (typeof globalThis !== 'undefined' ? (globalThis as any).SoundEngine : null);
    if (!soundEngine || typeof soundEngine.playEffectByKey !== 'function') return false;
    try {
      if (typeof soundEngine.init === 'function') soundEngine.init();
    } catch (e) { /* ignore */ }
    try {
      return soundEngine.playEffectByKey('tutorial_story_effect', {
        filePath
      });
    } catch (e) {
      return false;
    }
  }

  function runFlow(promiseLike: any): Promise<any> {
    try {
      return Promise.resolve(promiseLike).catch(() => {
        emitInfo('tutorial の進行中にエラーが発生しました');
        closeInternal(true);
      });
    } catch (e) {
      emitInfo('tutorial の進行中にエラーが発生しました');
      closeInternal(true);
      return Promise.resolve(false);
    }
  }

  function resolveDescriptorTargets(descriptor: string): HTMLElement[] {
    const doc = rootRef.document;
    if (!doc || !descriptor) return [];
    const queryAll = (selector: string) => Array.prototype.slice.call(doc.querySelectorAll(selector));
    const queryCellByPosition = (position: any) => {
      if (!position || !Number.isInteger(position.row) || !Number.isInteger(position.col)) return [];
      const selector = `#board .cell[data-row="${position.row}"][data-col="${position.col}"]`;
      return queryAll(selector);
    };
    switch (descriptor) {
    case 'board.validMoves':
      return queryAll('#board .cell.legal, #board .cell.legal-free');
    case 'board.numericValidMove': {
      const target = stateStore.getFlag('numericTargetCell', null);
      if (target) return queryCellByPosition(target);
      return queryAll('#board .cell.has-board-bonus.legal, #board .cell.has-board-bonus.legal-free');
    }
    case 'tutorialTargetCard':
    case 'hand.observer_01':
      return queryAll('#hand-black .card-item[data-card-id="observer_01"], #handWrapper .card-item[data-card-id="observer_01"]');
    case 'cardDetailPanel': {
      const panel = doc.getElementById('card-detail-panel');
      return panel ? [panel] : [];
    }
    case 'useButton': {
      const buttonEl = doc.getElementById('use-card-btn');
      return buttonEl ? [buttonEl] : [];
    }
    case 'destroyButton': {
      const buttonEl = doc.getElementById('destroy-card-btn');
      return buttonEl ? [buttonEl] : [];
    }
    case 'passButton': {
      const buttonEl = doc.getElementById('pass-btn');
      return buttonEl ? [buttonEl] : [];
    }
    case 'hand':
      return queryAll('#handWrapper .card-item');
    case 'board':
      return queryAll('#board .cell');
    default:
      return [];
    }
  }

  function getTutorialState(): any {
    return stateStore.publicApi.getState();
  }

  function getCurrentScenario(): any {
    return TutorialStepsModule.getScenario(
      getTutorialState().scenarioId || TutorialStepsModule.getDefaultScenarioId()
    ) || defaultScenario;
  }

  function getCurrentScenarioProgression(): any {
    const scenario = getCurrentScenario();
    if (!scenario) return null;
    return {
      scenarioId: scenario.id || null,
      progressionGroup: scenario.progressionGroup || TutorialStepsModule.getScenarioKind(scenario.id) || 'tutorial',
      progressionId: scenario.progressionId || scenario.id || null
    };
  }

  function clearInteractions(): void {
    currentPrimaryAction = null;
    typewriter.cancel();
    actionWait.cleanup();
    tutorialOverlay.clearChoices();
  }

  function closeInternal(forceResetState: boolean): void {
    renderToken += 1;
    clearInteractions();
    tutorialOverlay.close();
    setButtonState(false);
    if (forceResetState !== false) {
      stateStore.resetState();
    }
  }

  async function closeByUser(): Promise<boolean> {
    if (!stateStore.publicApi.isActive()) return false;

    renderToken += 1;
    clearInteractions();
    tutorialOverlay.close();
    setButtonState(false);

    try {
      if (stateStore.getFlag('mainTutorialBooted', false) === true) {
        await runtime.completeMainTutorial();
      }
    } finally {
      stateStore.resetState();
    }

    emitInfo('tutorial を終了しました');
    return true;
  }

  async function performStepSetup(setupKey: string): Promise<void> {
    const handler = (stepSetupHandlers as any)[String(setupKey || '')];
    if (!handler) return;
    await handler();
  }

  async function startMainTutorialChoiceAction(): Promise<any> {
    await runtime.startMainTutorial();
    stateStore.setFlag('mainTutorialBooted', true);
    const activeScenario = getCurrentScenario();
    stateStore.mergeScenarioContext({
      observerName: activeScenario.observerName,
      observerImageSrc: activeScenario.observerImageSrc,
      observerDuelActive: false,
      observerDuelPostResultPhase: null
    });
    return { continueFlow: true };
  }

  async function startObserverDuelChoiceAction(): Promise<any> {
    await scenarioDuel.startObserverDuel();
    stateStore.setActive(false);
    stateStore.setMode('observer_duel');
    stateStore.setStep(null, 'observer_duel');
    stateStore.setAllowAbort(false);
    clearInteractions();
    tutorialOverlay.close();
    setButtonState(false);
    return { continueFlow: false };
  }

  async function performChoiceAction(actionKey: string): Promise<any> {
    const handler = (choiceActionHandlers as any)[String(actionKey || '')];
    if (!handler) return { continueFlow: true };
    return handler();
  }

  async function advanceTo(stepId: string): Promise<void> {
    if (!stepId) {
      closeInternal(true);
      return;
    }
    stateStore.setStep(stepId, 'dialogue');
    await renderCurrentStep();
  }

  function renderStepFrame(step: any, extra?: any): void {
    const view = extra && typeof extra === 'object' ? extra : {};
    const activeScenario = getCurrentScenario();
    const characterVisible = view.characterVisible !== undefined
      ? view.characterVisible
      : (step.characterVisible !== undefined ? step.characterVisible : (step.observerVisible !== false));
    const characterImageSrc = view.characterImageSrc
      || step.characterImageSrc
      || (activeScenario && activeScenario.observerImageSrc)
      || 'assets/images/cpu/level6.png';
    const characterImageAlt = view.characterImageAlt
      || step.characterImageAlt
      || view.speaker
      || step.speaker
      || (activeScenario && activeScenario.observerName)
      || 'キャラクター';
    tutorialOverlay.renderFrame({
      chapterLabel: step.chapterLabel || '',
      speaker: view.speaker !== undefined ? view.speaker : (step.speaker || ''),
      bodyText: view.bodyText !== undefined ? view.bodyText : '',
      instruction: view.instruction !== undefined ? view.instruction : (step.instruction || ''),
      advanceHint: view.advanceHint !== undefined ? view.advanceHint : '',
      observerVisible: characterVisible,
      observerImageSrc: characterImageSrc,
      observerImageAlt: characterImageAlt,
      observerStage: step.observerStage || 'top',
      sceneBackgroundSrc: view.sceneBackgroundSrc !== undefined ? view.sceneBackgroundSrc : (step.sceneBackgroundSrc || ''),
      headBubbleText: view.headBubbleText !== undefined ? view.headBubbleText : (step.headBubbleText || ''),
      emotion: view.emotion !== undefined ? view.emotion : (step.emotion || 'normal')
    });
  }

  function renderDialoguePayload(step: any, payload: any, onAdvance?: () => void): void {
    const response = payload && typeof payload === 'object' ? payload : {};
    renderStepFrame(step, {
      speaker: response.speaker !== undefined ? response.speaker : step.speaker,
      headBubbleText: response.headBubbleText !== undefined ? response.headBubbleText : (step.headBubbleText || ''),
      emotion: response.emotion !== undefined ? response.emotion : (step.emotion || 'normal'),
      bodyText: '',
      instruction: response.instruction !== undefined ? response.instruction : (step.instruction || ''),
      advanceHint: 'クリックで全文表示'
    });
    tutorialOverlay.clearChoices();
    tutorialOverlay.setPassthrough(step.overlayMode === 'passthrough');
    const text = composeText(response.text !== undefined ? response.text : step.text);
    const pages = typeof tutorialOverlay.paginateBodyText === 'function'
      ? tutorialOverlay.paginateBodyText(text)
      : [text];
    let pageIndex = 0;
    const startPage = function () {
      const pageText = Array.isArray(pages) && pages[pageIndex] !== undefined
        ? pages[pageIndex]
        : '';
      typewriter.start(pageText);
    };

    startPage();
    currentPrimaryAction = function () {
      if (typewriter.isTyping()) {
        typewriter.reveal();
        return 'reveal';
      }
      if (Array.isArray(pages) && pageIndex < (pages.length - 1)) {
        pageIndex += 1;
        startPage();
        return 'page';
      }
      currentPrimaryAction = null;
      if (typeof onAdvance === 'function') onAdvance();
      return 'advance';
    };
  }

  async function handleChoiceSelection(step: any, choice: any): Promise<void> {
    playTutorialEffect(TUTORIAL_CHOICE_SELECT_SOUND);
    tutorialOverlay.clearChoices();
    if (choice && choice.addPersonality) {
      stateStore.addPersonality(choice.addPersonality);
    }
    const response = step.responseMap && choice ? step.responseMap[choice.id] : null;
    const afterResponse = async () => {
      const actionKey = step.actionByChoice && choice ? step.actionByChoice[choice.id] : null;
      const actionResult = actionKey ? await performChoiceAction(actionKey) : { continueFlow: true };
      if (actionResult && actionResult.continueFlow === false) return;
      const nextId = (step.nextByChoice && choice) ? step.nextByChoice[choice.id] : step.next;
      if (nextId) {
        await advanceTo(nextId);
      }
    };

    if (response) {
      stateStore.setMode('dialogue');
      renderDialoguePayload(step, response, () => { runFlow(afterResponse()); });
    } else {
      await runFlow(afterResponse());
    }
  }

  async function renderChoiceStep(step: any): Promise<void> {
    tutorialOverlay.setPassthrough(false);
    renderStepFrame(step, {
      speaker: '',
      bodyText: '',
      instruction: '',
      advanceHint: ''
    });
    currentPrimaryAction = null;
    tutorialOverlay.showChoices(step.prompt || '', step.choices || [], (choice: any) => {
      handleChoiceSelection(step, choice);
    });
  }

  async function renderActionWaitStep(step: any, token: number): Promise<void> {
    tutorialOverlay.setPassthrough(true);
    renderStepFrame(step, {
      speaker: '',
      bodyText: '',
      instruction: step.instruction || '',
      advanceHint: '指定の操作を行う'
    });
    currentPrimaryAction = null;
    await actionWait.waitFor(step, {
      root: rootRef,
      getFlag: (key: string, fallback: any) => stateStore.getFlag(key, fallback),
      blackValue: runtime.blackValue
    });
    if (token !== renderToken) return;
    await advanceTo(step.next);
  }

  async function renderCompletedStep(step: any, token: number): Promise<void> {
    const result = step.result && typeof step.result === 'object' ? step.result : {};
    const progression = getCurrentScenarioProgression();
    if (result.saveTutorialCleared === true && progression && progression.progressionGroup === 'tutorial') {
      TutorialStorageModule.saveTutorialScenarioCleared(progression.progressionId, true);
    }
    if (result.saveStoryChapterCleared === true && progression && progression.progressionGroup === 'story') {
      TutorialStorageModule.saveStoryChapterCleared(progression.progressionId, true);
    }
    if (result.openMatchStartModal === true) {
      await runtime.completeMainTutorial();
    }
    if (token !== renderToken) return;
    emitInfo('tutorial を完了しました');
    closeInternal(true);
  }

  const stepRendererHandlers = Object.freeze({
    dialogue: function (step: any) {
      tutorialOverlay.setPassthrough(step.overlayMode === 'passthrough');
      renderDialoguePayload(step, step, () => { runFlow(advanceTo(step.next)); });
    },
    choice: function (step: any) {
      return renderChoiceStep(step);
    },
    action_wait: function (step: any, token: number) {
      return renderActionWaitStep(step, token);
    },
    completed: function (step: any, token: number) {
      return renderCompletedStep(step, token);
    }
  } as any);

  async function renderPreparedStep(step: any, token: number): Promise<void> {
    const handler = (stepRendererHandlers as any)[String(step.type || '')];
    if (!handler) {
      closeInternal(true);
      return;
    }
    await handler(step, token);
  }

  async function renderCurrentStep(): Promise<void> {
    const tutorialState = getTutorialState();
    const currentScenarioId = tutorialState.scenarioId || TutorialStepsModule.getDefaultScenarioId();
    const currentStepId = tutorialState.stepId;
    const step = TutorialStepsModule.getScenarioStep(currentScenarioId, currentStepId);
    if (!step) {
      closeInternal(true);
      return;
    }
    const token = ++renderToken;
    clearInteractions();
    stateStore.setMode(resolveModeByStepType(step.type));
    stateStore.setAllowAbort(/^INTRO_/.test(step.id));

    const prepareAndRender = async () => {
      if (step.enterSetupKey) {
        await performStepSetup(step.enterSetupKey);
        if (token !== renderToken) return;
      }
      await renderPreparedStep(step, token);
    };

    if (step.sceneTransition && typeof tutorialOverlay.playSceneTransition === 'function') {
      await tutorialOverlay.playSceneTransition(step.sceneTransition, prepareAndRender);
      return;
    }

    await prepareAndRender();
  }

  async function open(openOptions?: any): Promise<boolean> {
    const availability = runtime.getStartAvailability();
    if (!availability.ok) {
      emitInfo(availability.message || 'tutorial を開始できません');
      return false;
    }
    if (stateStore.publicApi.isObserverDuelActive()) {
      emitInfo('観測者対局中は tutorial を開始できません');
      return false;
    }
    if (stateStore.publicApi.isActive()) {
      return true;
    }
    const scenarioId = openOptions && openOptions.scenarioId
      ? String(openOptions.scenarioId)
      : TutorialStepsModule.getDefaultScenarioId();
    const nextScenario = TutorialStepsModule.getScenario(scenarioId);
    if (!nextScenario) {
      emitInfo('tutorial step 定義が見つかりません');
      return false;
    }
    if (typeof TutorialStepsModule.isTutorialScenario === 'function' && !TutorialStepsModule.isTutorialScenario(scenarioId)) {
      emitInfo('story シナリオは tutorial controller では開始できません');
      return false;
    }

    stateStore.beginScenario({
      scenarioId,
      stepId: nextScenario.entryStepId,
      mode: 'dialogue',
      allowAbort: true,
      scenarioContext: {
        observerName: nextScenario.observerName,
        observerImageSrc: nextScenario.observerImageSrc,
        observerDuelActive: false,
        observerDuelPostResultPhase: null
      }
    });

    setButtonState(true);
    tutorialOverlay.open();
    await renderCurrentStep();
    return true;
  }

  async function close(): Promise<boolean> {
    return closeByUser();
  }

  const onDialogClick = () => {
    if (typeof currentPrimaryAction === 'function') {
      const actionResult = currentPrimaryAction();
      if (actionResult) {
        playTutorialEffect(TUTORIAL_TEXT_CLICK_SOUND);
      }
    }
  };

  const onBackdropClick = () => {};

  const onKeyDown = (event: KeyboardEvent) => {
    if (!event) return;
    if (event.key === 'Escape') {
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && typeof currentPrimaryAction === 'function') {
      event.preventDefault();
      const actionResult = currentPrimaryAction();
      if (actionResult) {
        playTutorialEffect(TUTORIAL_TEXT_CLICK_SOUND);
      }
    }
  };

  if (tutorialOverlay.refs.dialogWindow) {
    tutorialOverlay.refs.dialogWindow.addEventListener('click', onDialogClick);
  }
  if (tutorialOverlay.refs.backdrop) {
    tutorialOverlay.refs.backdrop.addEventListener('click', onBackdropClick);
  }
  if (tutorialOverlay.refs.exitButton) {
    tutorialOverlay.refs.exitButton.addEventListener('click', () => {
      runFlow(closeByUser());
    });
  }
  if (rootRef.document && typeof rootRef.document.addEventListener === 'function') {
    rootRef.document.addEventListener('keydown', onKeyDown);
  }

  const controller = {
    open,
    close
  };

  if (controllerCache) {
    controllerCache.set(overlayRoot, controller);
  }
  return controller;
}

const TutorialControllerModule = {
  createTutorialController
};

export = TutorialControllerModule;
