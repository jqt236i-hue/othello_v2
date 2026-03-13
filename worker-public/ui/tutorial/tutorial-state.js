(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const api = factory();
        root.TutorialStateModule = api;
        root.Tutorial = root.Tutorial || {};
        root.Tutorial.State = api.publicApi;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function createInitialPersonality() {
        return {
            straight: 0,
            bold: 0,
            snark: 0
        };
    }

    function createInitialState() {
        return {
            active: false,
            scenarioId: null,
            stepId: null,
            mode: 'idle',
            allowAbort: false,
            personality: createInitialPersonality(),
            flags: {},
            scenarioContext: null,
            observerDuel: {
                active: false,
                postResultPhase: null,
                previousCpuSmartness: null
            }
        };
    }

    const tutorialState = createInitialState();

    function resetState() {
        const initial = createInitialState();
        Object.keys(tutorialState).forEach((key) => {
            delete tutorialState[key];
        });
        Object.assign(tutorialState, initial);
        return tutorialState;
    }

    function beginScenario(meta) {
        const next = meta && typeof meta === 'object' ? meta : {};
        tutorialState.active = true;
        tutorialState.scenarioId = next.scenarioId || null;
        tutorialState.stepId = next.stepId || null;
        tutorialState.mode = next.mode || 'dialogue';
        tutorialState.allowAbort = next.allowAbort === true;
        tutorialState.personality = createInitialPersonality();
        tutorialState.flags = {};
        tutorialState.scenarioContext = next.scenarioContext ? { ...next.scenarioContext } : null;
        tutorialState.observerDuel = {
            active: false,
            postResultPhase: null,
            previousCpuSmartness: null
        };
        return tutorialState;
    }

    function setActive(active) {
        tutorialState.active = active === true;
        return tutorialState.active;
    }

    function setScenarioId(scenarioId) {
        tutorialState.scenarioId = scenarioId || null;
        return tutorialState.scenarioId;
    }

    function setStep(stepId, mode) {
        tutorialState.stepId = stepId || null;
        if (mode) tutorialState.mode = String(mode);
        return tutorialState.stepId;
    }

    function setMode(mode) {
        tutorialState.mode = mode ? String(mode) : 'idle';
        return tutorialState.mode;
    }

    function setAllowAbort(allowAbort) {
        tutorialState.allowAbort = allowAbort === true;
        return tutorialState.allowAbort;
    }

    function replaceFlags(flags) {
        tutorialState.flags = (flags && typeof flags === 'object') ? { ...flags } : {};
        return tutorialState.flags;
    }

    function mergeFlags(flags) {
        if (!flags || typeof flags !== 'object') return tutorialState.flags;
        tutorialState.flags = Object.assign({}, tutorialState.flags || {}, flags);
        return tutorialState.flags;
    }

    function setFlag(key, value) {
        if (!tutorialState.flags || typeof tutorialState.flags !== 'object') {
            tutorialState.flags = {};
        }
        tutorialState.flags[String(key)] = value;
        return value;
    }

    function getFlag(key, fallback) {
        if (!tutorialState.flags || typeof tutorialState.flags !== 'object') return fallback;
        return Object.prototype.hasOwnProperty.call(tutorialState.flags, key)
            ? tutorialState.flags[key]
            : fallback;
    }

    function addPersonality(delta) {
        if (!delta || typeof delta !== 'object') return tutorialState.personality;
        const keys = ['straight', 'bold', 'snark'];
        const next = Object.assign(createInitialPersonality(), tutorialState.personality || {});
        for (const key of keys) {
            const value = Number(delta[key] || 0);
            if (!Number.isFinite(value) || value === 0) continue;
            next[key] += Math.trunc(value);
        }
        tutorialState.personality = next;
        return tutorialState.personality;
    }

    function setScenarioContext(context) {
        tutorialState.scenarioContext = context && typeof context === 'object'
            ? { ...context }
            : null;
        return tutorialState.scenarioContext;
    }

    function mergeScenarioContext(patch) {
        if (!patch || typeof patch !== 'object') return tutorialState.scenarioContext;
        const base = tutorialState.scenarioContext && typeof tutorialState.scenarioContext === 'object'
            ? tutorialState.scenarioContext
            : {};
        tutorialState.scenarioContext = Object.assign({}, base, patch);
        return tutorialState.scenarioContext;
    }

    function setObserverDuelState(patch) {
        const nextPatch = patch && typeof patch === 'object' ? patch : {};
        const prev = tutorialState.observerDuel && typeof tutorialState.observerDuel === 'object'
            ? tutorialState.observerDuel
            : { active: false, postResultPhase: null, previousCpuSmartness: null };
        tutorialState.observerDuel = Object.assign({}, prev, nextPatch);
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'active')) {
            mergeScenarioContext({
                observerDuelActive: nextPatch.active === true
            });
        }
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'postResultPhase')) {
            mergeScenarioContext({
                observerDuelPostResultPhase: nextPatch.postResultPhase || null
            });
        }
        return tutorialState.observerDuel;
    }

    function isActive() {
        return tutorialState.active === true;
    }

    function isObserverDuelActive() {
        return !!(tutorialState.observerDuel && tutorialState.observerDuel.active === true);
    }

    function getTutorialScenarioContext() {
        return tutorialState.scenarioContext
            ? { ...tutorialState.scenarioContext }
            : null;
    }

    const publicApi = {
        getState: () => tutorialState,
        isActive,
        isObserverDuelActive,
        getTutorialScenarioContext
    };

    return {
        tutorialState,
        resetState,
        beginScenario,
        setActive,
        setScenarioId,
        setStep,
        setMode,
        setAllowAbort,
        replaceFlags,
        mergeFlags,
        setFlag,
        getFlag,
        addPersonality,
        setScenarioContext,
        mergeScenarioContext,
        setObserverDuelState,
        publicApi
    };
}));
