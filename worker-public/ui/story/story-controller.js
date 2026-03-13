(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./story-steps'),
            require('./story-state'),
            require('../tutorial/tutorial-storage'),
            require('../tutorial/typewriter'),
            require('../tutorial/tutorial-overlay'),
            require('../tutorial/tutorial-runtime'),
            require('./story-encounter')
        );
    } else {
        root.StoryControllerModule = factory(
            root.StoryStepsModule,
            root.StoryStateModule,
            root.TutorialStorageModule,
            root.TutorialTypewriterModule,
            root.TutorialOverlayModule,
            root.TutorialRuntimeModule,
            root.StoryEncounterModule
        );
    }
}(typeof self !== 'undefined' ? self : this, function (
    StoryStepsModule,
    StoryStateModule,
    TutorialStorageModule,
    TutorialTypewriterModule,
    TutorialOverlayModule,
    TutorialRuntimeModule,
    StoryEncounterModule
) {
    'use strict';

    const controllerCache = typeof WeakMap === 'function' ? new WeakMap() : null;
    const STORY_TEXT_CLICK_SOUND = 'assets/story/sound-ef/テキストをクリックするとき.mp3';
    const STORY_CHOICE_SELECT_SOUND = 'assets/story/sound-ef/自分視点選択肢を選ぶとき.mp3';

    function composeText(textValue) {
        if (Array.isArray(textValue)) return textValue.join('\n');
        return String(textValue || '');
    }

    function resolveModeByStepType(stepType) {
        switch (stepType) {
        case 'choice':
            return 'choice';
        case 'completed':
            return 'completed';
        case 'game_over':
            return 'game_over';
        default:
            return 'dialogue';
        }
    }

    function createStoryController(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const overlayRoot = opts.overlay;
        const button = opts.button || null;
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);

        if (!overlayRoot) {
            throw new Error('story overlay is required');
        }
        if (controllerCache && controllerCache.has(overlayRoot)) {
            return controllerCache.get(overlayRoot);
        }

        if (
            !StoryStepsModule ||
            !StoryStateModule ||
            !TutorialStorageModule ||
            !TutorialTypewriterModule ||
            !TutorialOverlayModule ||
            !TutorialRuntimeModule ||
            !StoryEncounterModule
        ) {
            throw new Error('story modules are not fully available');
        }

        const stateStore = StoryStateModule;
        const runtime = TutorialRuntimeModule.createTutorialRuntime({ root: rootRef });
        const storyOverlay = TutorialOverlayModule.createTutorialOverlay({ overlay: overlayRoot });
        let currentPrimaryAction = null;
        let renderToken = 0;

        rootRef.Story = rootRef.Story || {};
        rootRef.Story.State = stateStore.publicApi;

        const typewriter = TutorialTypewriterModule.createTypewriter({
            onUpdate: (visibleText, meta) => {
                storyOverlay.setBodyText(visibleText);
                storyOverlay.setAdvanceHint(meta && meta.typing ? 'クリックで全文表示' : 'クリックで次へ');
            },
            onComplete: () => {
                storyOverlay.setAdvanceHint('クリックで次へ');
            }
        });

        function setButtonState(active) {
            if (!button) return;
            button.setAttribute('aria-expanded', active ? 'true' : 'false');
            button.dataset.storyState = active ? 'active' : 'ready';
        }

        function emitInfo(message) {
            try {
                if (typeof rootRef.emitLogAdded === 'function') {
                    rootRef.emitLogAdded(message, 'normal');
                    return;
                }
            } catch (e) { /* ignore */ }
            try { if (typeof console !== 'undefined' && console.log) console.log('[story]', message); } catch (e) { /* ignore */ }
        }

        function playStoryEffect(filePath) {
            const soundEngine =
                (typeof SoundEngine !== 'undefined' && SoundEngine)
                || (rootRef && rootRef.SoundEngine)
                || (typeof globalThis !== 'undefined' ? globalThis.SoundEngine : null);
            if (!soundEngine || typeof soundEngine.playEffectByKey !== 'function') return false;
            try {
                if (typeof soundEngine.init === 'function') soundEngine.init();
            } catch (e) { /* ignore */ }
            try {
                return soundEngine.playEffectByKey('tutorial_story_effect', { filePath });
            } catch (e) {
                return false;
            }
        }

        function runFlow(promiseLike) {
            try {
                return Promise.resolve(promiseLike).catch(() => {
                    emitInfo('story の進行中にエラーが発生しました');
                    closeInternal(true);
                });
            } catch (e) {
                emitInfo('story の進行中にエラーが発生しました');
                closeInternal(true);
                return Promise.resolve(false);
            }
        }

        function getCurrentChapter() {
            return StoryStepsModule.getChapter(stateStore.storyState.chapterId);
        }

        function clearInteractions() {
            currentPrimaryAction = null;
            typewriter.cancel();
            storyOverlay.clearChoices();
        }

        function setEncounterExitShell(active) {
            if (typeof storyOverlay.setExitOnlyMode === 'function') {
                storyOverlay.setExitOnlyMode(active === true);
            }
            if (active !== true) return;
            storyOverlay.renderFrame({
                chapterLabel: '',
                speaker: '',
                bodyText: '',
                instruction: '',
                advanceHint: '',
                observerVisible: false,
                observerImageSrc: '',
                observerImageAlt: '',
                sceneBackgroundSrc: '',
                headBubbleText: '',
                supportVisible: false,
                supportImageSrc: '',
                supportImageAlt: '',
                supportStage: 'right',
                emotion: 'normal'
            });
            storyOverlay.clearChoices();
            storyOverlay.setPassthrough(true);
        }

        function closeInternal(forceResetState) {
            renderToken += 1;
            clearInteractions();
            setEncounterExitShell(false);
            storyOverlay.close();
            setButtonState(false);
            if (forceResetState !== false) {
                stateStore.resetState();
            }
        }

        async function closeByUser() {
            if (!stateStore.publicApi.isActive()) return false;
            renderToken += 1;
            clearInteractions();
            setEncounterExitShell(false);
            storyOverlay.close();
            setButtonState(false);
            if (stateStore.publicApi.isEncounterActive() && storyEncounter && typeof storyEncounter.abortEncounter === 'function') {
                await storyEncounter.abortEncounter();
            }
            stateStore.resetState();
            emitInfo('story を終了しました');
            return true;
        }

        function isTutorialBusy() {
            try {
                const tutorialStateApi = rootRef && rootRef.Tutorial && rootRef.Tutorial.State;
                if (!tutorialStateApi) return false;
                if (typeof tutorialStateApi.isObserverDuelActive === 'function' && tutorialStateApi.isObserverDuelActive()) {
                    return true;
                }
                if (typeof tutorialStateApi.isActive === 'function' && tutorialStateApi.isActive()) {
                    return true;
                }
            } catch (e) { /* ignore */ }
            return false;
        }

        function ensureChapterUnlocked(chapterId) {
            const chapter = StoryStepsModule.getChapter(chapterId);
            if (!chapter) {
                return { chapter: null, unlocked: false, cleared: false, message: '章データが見つかりません' };
            }
            if (TutorialStorageModule.isStoryChapterUnlocked(chapterId)) {
                return {
                    chapter,
                    unlocked: true,
                    cleared: TutorialStorageModule.isStoryChapterCleared(chapterId),
                    message: ''
                };
            }
            const requirementTutorialId = chapter.unlockRequirementTutorialId || null;
            if (requirementTutorialId && TutorialStorageModule.isTutorialScenarioCleared(requirementTutorialId)) {
                TutorialStorageModule.saveStoryChapterUnlocked(chapterId, true);
                return {
                    chapter,
                    unlocked: true,
                    cleared: TutorialStorageModule.isStoryChapterCleared(chapterId),
                    message: ''
                };
            }
            return {
                chapter,
                unlocked: false,
                cleared: TutorialStorageModule.isStoryChapterCleared(chapterId),
                message: chapter.lockMessage || 'プレイするにはチュートリアルをクリアしてください。'
            };
        }

        function getChapterAvailability(chapterId) {
            return ensureChapterUnlocked(chapterId);
        }

        async function finishStoryAfterEncounter() {
            closeInternal(true);
            emitInfo('story を終了しました');
        }

        async function resumeChapterAt(stepId) {
            setEncounterExitShell(false);
            storyOverlay.open();
            setButtonState(true);
            stateStore.setStep(stepId, 'dialogue');
            await renderCurrentStep();
        }

        const storyEncounter = StoryEncounterModule.createStoryEncounter({
            root: rootRef,
            stateStore,
            runtime
        });
        rootRef.Story.Encounter = storyEncounter;

        async function startGoblinEncounter() {
            const chapter = getCurrentChapter();
            if (!chapter) return { continueFlow: false };
            setEncounterExitShell(true);
            setButtonState(true);
            await storyEncounter.startEncounter({
                encounterId: 'chapter1_goblin',
                enemyName: StoryStepsModule.GOBLIN_NAME,
                enemyImageSrc: StoryStepsModule.GOBLIN_IMAGE_SRC,
                cpuLevel: 1,
                winDialogueLines: ['ぐっ……！ こんなやつに負けるなんて聞いてねえぞ！'],
                loseDialogueLines: ['へへへっ！ その程度でこの森を生き残れると思うなよ！'],
                drawDialogueLines: ['まだだ……まだ決着はついてねえ！'],
                onWinContinue: () => resumeChapterAt('CHAPTER1_STEP_020'),
                onAbort: () => finishStoryAfterEncounter()
            });
            stateStore.setMode('encounter');
            return { continueFlow: false };
        }

        const choiceActionHandlers = Object.freeze({
            start_goblin_encounter: () => startGoblinEncounter()
        });

        async function performChoiceAction(actionKey) {
            const handler = choiceActionHandlers[String(actionKey || '')];
            if (!handler) return { continueFlow: true };
            return handler();
        }

        async function advanceTo(stepId) {
            if (!stepId) {
                closeInternal(true);
                return;
            }
            stateStore.setStep(stepId, 'dialogue');
            await renderCurrentStep();
        }

        function renderStepFrame(step, extra) {
            const view = extra && typeof extra === 'object' ? extra : {};
            storyOverlay.renderFrame({
                chapterLabel: step.chapterLabel || '',
                speaker: view.speaker !== undefined ? view.speaker : (step.speaker || ''),
                bodyText: view.bodyText !== undefined ? view.bodyText : '',
                instruction: view.instruction !== undefined ? view.instruction : (step.instruction || ''),
                advanceHint: view.advanceHint !== undefined ? view.advanceHint : '',
                observerVisible: view.characterVisible !== undefined
                    ? view.characterVisible
                    : (step.characterVisible !== undefined ? step.characterVisible : true),
                observerImageSrc: view.characterImageSrc || step.characterImageSrc || '',
                observerImageAlt: view.characterImageAlt || step.characterImageAlt || 'キャラクター',
                observerStage: step.observerStage || 'top',
                sceneBackgroundSrc: view.sceneBackgroundSrc !== undefined ? view.sceneBackgroundSrc : (step.sceneBackgroundSrc || ''),
                headBubbleText: view.headBubbleText !== undefined ? view.headBubbleText : (step.headBubbleText || ''),
                supportVisible: view.supportVisible !== undefined ? view.supportVisible : (step.supportVisible === true),
                supportImageSrc: view.supportImageSrc !== undefined ? view.supportImageSrc : (step.supportImageSrc || ''),
                supportImageAlt: view.supportImageAlt !== undefined ? view.supportImageAlt : (step.supportImageAlt || ''),
                supportStage: view.supportStage !== undefined ? view.supportStage : (step.supportStage || 'right'),
                emotion: view.emotion !== undefined ? view.emotion : (step.emotion || 'normal')
            });
        }

        function renderDialoguePayload(step, payload, onAdvance) {
            const response = payload && typeof payload === 'object' ? payload : {};
            renderStepFrame(step, {
                speaker: response.speaker !== undefined ? response.speaker : step.speaker,
                characterVisible: response.characterVisible !== undefined ? response.characterVisible : step.characterVisible,
                characterImageSrc: response.characterImageSrc !== undefined ? response.characterImageSrc : step.characterImageSrc,
                characterImageAlt: response.characterImageAlt !== undefined ? response.characterImageAlt : step.characterImageAlt,
                supportVisible: response.supportVisible !== undefined ? response.supportVisible : step.supportVisible,
                supportImageSrc: response.supportImageSrc !== undefined ? response.supportImageSrc : step.supportImageSrc,
                supportImageAlt: response.supportImageAlt !== undefined ? response.supportImageAlt : step.supportImageAlt,
                supportStage: response.supportStage !== undefined ? response.supportStage : step.supportStage,
                headBubbleText: response.headBubbleText !== undefined ? response.headBubbleText : (step.headBubbleText || ''),
                emotion: response.emotion !== undefined ? response.emotion : (step.emotion || 'normal'),
                bodyText: '',
                instruction: response.instruction !== undefined ? response.instruction : (step.instruction || ''),
                advanceHint: 'クリックで全文表示'
            });
            storyOverlay.clearChoices();
            storyOverlay.setPassthrough(false);
            const text = composeText(response.text !== undefined ? response.text : step.text);
            const pages = typeof storyOverlay.paginateBodyText === 'function'
                ? storyOverlay.paginateBodyText(text)
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

        async function handleChoiceSelection(step, choice) {
            playStoryEffect(STORY_CHOICE_SELECT_SOUND);
            storyOverlay.clearChoices();
            const response = step.responseMap && choice ? step.responseMap[choice.id] : null;
            const afterResponse = async () => {
                const actionKey = step.actionByChoice && choice ? step.actionByChoice[choice.id] : null;
                const actionResult = actionKey ? await performChoiceAction(actionKey) : { continueFlow: true };
                if (actionResult && actionResult.continueFlow === false) return;
                const nextId = (step.nextByChoice && choice && Object.prototype.hasOwnProperty.call(step.nextByChoice, choice.id))
                    ? step.nextByChoice[choice.id]
                    : step.next;
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

        async function renderChoiceStep(step) {
            renderStepFrame(step, {
                speaker: '',
                bodyText: '',
                instruction: '',
                advanceHint: ''
            });
            currentPrimaryAction = null;
            storyOverlay.showChoices(step.prompt || '', step.choices || [], (choice) => {
                handleChoiceSelection(step, choice);
            });
        }

        async function renderCompletedStep(step) {
            const chapter = getCurrentChapter();
            const result = step.result && typeof step.result === 'object' ? step.result : {};
            const chapterId = chapter ? chapter.progressionId || chapter.id : null;
            if (result.saveStoryChapterCleared === true && chapterId) {
                TutorialStorageModule.saveStoryChapterCleared(chapterId, true);
            }
            const unlockIds = [];
            if (Array.isArray(chapter && chapter.unlocksChapterIds)) {
                unlockIds.push.apply(unlockIds, chapter.unlocksChapterIds);
            }
            if (Array.isArray(result.unlockStoryChapterIds)) {
                unlockIds.push.apply(unlockIds, result.unlockStoryChapterIds);
            }
            for (const unlockId of unlockIds) {
                if (!unlockId) continue;
                TutorialStorageModule.saveStoryChapterUnlocked(unlockId, true);
            }
            emitInfo(`${chapter && chapter.title ? chapter.title : 'story'} を完了しました`);
            closeInternal(true);
        }

        async function renderGameOverStep() {
            closeInternal(true);
            emitInfo('story を終了しました');
        }

        const stepRendererHandlers = Object.freeze({
            dialogue: function (step) {
                renderDialoguePayload(step, step, () => { runFlow(advanceTo(step.next)); });
            },
            choice: function (step) {
                return renderChoiceStep(step);
            },
            completed: function (step) {
                return renderCompletedStep(step);
            },
            game_over: function () {
                return renderGameOverStep();
            }
        });

        async function renderPreparedStep(step, token) {
            const handler = stepRendererHandlers[String(step.type || '')];
            if (!handler) {
                closeInternal(true);
                return;
            }
            if (token !== renderToken) return;
            await handler(step, token);
        }

        async function renderCurrentStep() {
            const chapterId = stateStore.storyState.chapterId;
            const stepId = stateStore.storyState.stepId;
            const step = StoryStepsModule.getChapterStep(chapterId, stepId);
            if (!step) {
                closeInternal(true);
                return;
            }
            const token = ++renderToken;
            clearInteractions();
            setEncounterExitShell(false);
            stateStore.setMode(resolveModeByStepType(step.type));
            stateStore.setAllowAbort(true);

            const renderStep = async () => {
                await renderPreparedStep(step, token);
            };

            if (step.sceneTransition && typeof storyOverlay.playSceneTransition === 'function') {
                await storyOverlay.playSceneTransition(step.sceneTransition, renderStep);
                return;
            }
            await renderStep();
        }

        async function open(openOptions) {
            const chapterId = openOptions && openOptions.chapterId
                ? String(openOptions.chapterId)
                : StoryStepsModule.CHAPTER1_ID;
            const availability = runtime.getStartAvailability();
            if (!availability.ok) {
                emitInfo((availability.message || 'story を開始できません').replace(/tutorial/g, 'story'));
                return false;
            }
            if (isTutorialBusy()) {
                emitInfo('tutorial 進行中は story を開始できません');
                return false;
            }
            if (stateStore.publicApi.isActive()) {
                return true;
            }

            const chapterAvailability = ensureChapterUnlocked(chapterId);
            if (!chapterAvailability.chapter) {
                emitInfo(chapterAvailability.message || 'story 章データが見つかりません');
                return false;
            }
            if (!chapterAvailability.unlocked) {
                emitInfo(chapterAvailability.message || 'プレイするにはチュートリアルをクリアしてください。');
                return false;
            }

            const chapter = chapterAvailability.chapter;
            stateStore.beginChapter({
                chapterId,
                stepId: chapter.entryStepId,
                mode: 'dialogue',
                allowAbort: true,
                sceneContext: {
                    chapterTitle: chapter.title
                }
            });

            setButtonState(true);
            setEncounterExitShell(false);
            storyOverlay.open();
            await renderCurrentStep();
            return true;
        }

        async function close() {
            return closeByUser();
        }

        function isActive() {
            return stateStore.publicApi.isActive();
        }

        const onDialogClick = () => {
            if (typeof currentPrimaryAction === 'function') {
                const actionResult = currentPrimaryAction();
                if (actionResult) {
                    playStoryEffect(STORY_TEXT_CLICK_SOUND);
                }
            }
        };

        const onKeyDown = (event) => {
            if (!event) return;
            if (event.key === 'Escape') return;
            if ((event.key === 'Enter' || event.key === ' ') && typeof currentPrimaryAction === 'function') {
                event.preventDefault();
                const actionResult = currentPrimaryAction();
                if (actionResult) {
                    playStoryEffect(STORY_TEXT_CLICK_SOUND);
                }
            }
        };

        if (storyOverlay.refs.dialogWindow) {
            storyOverlay.refs.dialogWindow.addEventListener('click', onDialogClick);
        }
        if (storyOverlay.refs.exitButton) {
            storyOverlay.refs.exitButton.addEventListener('click', () => {
                runFlow(closeByUser());
            });
        }
        if (rootRef.document && typeof rootRef.document.addEventListener === 'function') {
            rootRef.document.addEventListener('keydown', onKeyDown);
        }

        const controller = {
            open,
            close,
            isActive,
            getChapterAvailability
        };

        if (controllerCache) {
            controllerCache.set(overlayRoot, controller);
        }
        return controller;
    }

    return {
        createStoryController
    };
}));
