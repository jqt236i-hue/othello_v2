(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const api = factory();
        root.StoryStateModule = api;
        root.Story = root.Story || {};
        root.Story.State = api.publicApi;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const listeners = typeof Set === 'function' ? new Set() : [];

    function createInitialEncounterState() {
        return {
            active: false,
            encounterId: null,
            enemyName: null,
            enemyImageSrc: null,
            cpuLevel: null
        };
    }

    function createInitialState() {
        return {
            active: false,
            chapterId: null,
            stepId: null,
            mode: 'idle',
            allowAbort: false,
            sceneContext: null,
            encounter: createInitialEncounterState()
        };
    }

    const storyState = createInitialState();

    function emitChange() {
        const snapshot = storyState;
        if (listeners instanceof Set) {
            listeners.forEach((listener) => {
                try { listener(snapshot); } catch (e) { /* ignore */ }
            });
            return;
        }
        for (let i = 0; i < listeners.length; i += 1) {
            try { listeners[i](snapshot); } catch (e) { /* ignore */ }
        }
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') {
            return function noop() {};
        }
        if (listeners instanceof Set) {
            listeners.add(listener);
            return function unsubscribe() {
                listeners.delete(listener);
            };
        }
        listeners.push(listener);
        return function unsubscribe() {
            const index = listeners.indexOf(listener);
            if (index >= 0) listeners.splice(index, 1);
        };
    }

    function resetState() {
        const initial = createInitialState();
        Object.keys(storyState).forEach((key) => {
            delete storyState[key];
        });
        Object.assign(storyState, initial);
        emitChange();
        return storyState;
    }

    function beginChapter(meta) {
        const next = meta && typeof meta === 'object' ? meta : {};
        storyState.active = true;
        storyState.chapterId = next.chapterId || null;
        storyState.stepId = next.stepId || null;
        storyState.mode = next.mode || 'dialogue';
        storyState.allowAbort = next.allowAbort === true;
        storyState.sceneContext = next.sceneContext ? { ...next.sceneContext } : null;
        storyState.encounter = createInitialEncounterState();
        emitChange();
        return storyState;
    }

    function setActive(active) {
        storyState.active = active === true;
        emitChange();
        return storyState.active;
    }

    function setChapterId(chapterId) {
        storyState.chapterId = chapterId || null;
        emitChange();
        return storyState.chapterId;
    }

    function setStep(stepId, mode) {
        storyState.stepId = stepId || null;
        if (mode) storyState.mode = String(mode);
        emitChange();
        return storyState.stepId;
    }

    function setMode(mode) {
        storyState.mode = mode ? String(mode) : 'idle';
        emitChange();
        return storyState.mode;
    }

    function setAllowAbort(allowAbort) {
        storyState.allowAbort = allowAbort === true;
        emitChange();
        return storyState.allowAbort;
    }

    function setSceneContext(context) {
        storyState.sceneContext = context && typeof context === 'object'
            ? { ...context }
            : null;
        emitChange();
        return storyState.sceneContext;
    }

    function mergeSceneContext(patch) {
        if (!patch || typeof patch !== 'object') return storyState.sceneContext;
        const base = storyState.sceneContext && typeof storyState.sceneContext === 'object'
            ? storyState.sceneContext
            : {};
        storyState.sceneContext = Object.assign({}, base, patch);
        emitChange();
        return storyState.sceneContext;
    }

    function setEncounterState(patch) {
        const nextPatch = patch && typeof patch === 'object' ? patch : {};
        const prev = storyState.encounter && typeof storyState.encounter === 'object'
            ? storyState.encounter
            : createInitialEncounterState();
        storyState.encounter = Object.assign({}, prev, nextPatch);
        emitChange();
        return storyState.encounter;
    }

    function isActive() {
        return storyState.active === true;
    }

    function isEncounterActive() {
        return !!(storyState.encounter && storyState.encounter.active === true);
    }

    function getStorySceneContext() {
        return storyState.sceneContext
            ? { ...storyState.sceneContext }
            : null;
    }

    const publicApi = {
        getState: () => storyState,
        isActive,
        isEncounterActive,
        getStorySceneContext,
        subscribe
    };

    return {
        storyState,
        resetState,
        beginChapter,
        setActive,
        setChapterId,
        setStep,
        setMode,
        setAllowAbort,
        setSceneContext,
        mergeSceneContext,
        setEncounterState,
        publicApi
    };
}));
