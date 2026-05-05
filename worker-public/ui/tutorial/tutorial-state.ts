'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface TutorialPersonality {
  straight: number;
  bold: number;
  snark: number;
}

interface TutorialState {
  active: boolean;
  scenarioId: string | null;
  stepId: string | null;
  mode: string;
  allowAbort: boolean;
  personality: TutorialPersonality;
  flags: Record<string, any>;
  scenarioContext: any;
  observerDuel: {
    active: boolean;
    postResultPhase: string | null;
    previousCpuSmartness: any;
  };
}

function createInitialPersonality(): TutorialPersonality {
  return {
    straight: 0,
    bold: 0,
    snark: 0
  };
}

function createInitialState(): TutorialState {
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

const tutorialState: TutorialState = createInitialState();

function resetState(): TutorialState {
  const initial = createInitialState();
  Object.keys(tutorialState).forEach((key) => {
    delete (tutorialState as any)[key];
  });
  Object.assign(tutorialState, initial);
  return tutorialState;
}

function beginScenario(meta?: any): TutorialState {
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

function setActive(active: boolean): boolean {
  tutorialState.active = active === true;
  return tutorialState.active;
}

function setScenarioId(scenarioId: string | null): string | null {
  tutorialState.scenarioId = scenarioId || null;
  return tutorialState.scenarioId;
}

function setStep(stepId: string | null, mode?: string): string | null {
  tutorialState.stepId = stepId || null;
  if (mode) tutorialState.mode = String(mode);
  return tutorialState.stepId;
}

function setMode(mode: string): string {
  tutorialState.mode = mode ? String(mode) : 'idle';
  return tutorialState.mode;
}

function setAllowAbort(allowAbort: boolean): boolean {
  tutorialState.allowAbort = allowAbort === true;
  return tutorialState.allowAbort;
}

function replaceFlags(flags: any): Record<string, any> {
  tutorialState.flags = (flags && typeof flags === 'object') ? { ...flags } : {};
  return tutorialState.flags;
}

function mergeFlags(flags: any): Record<string, any> {
  if (!flags || typeof flags !== 'object') return tutorialState.flags;
  tutorialState.flags = Object.assign({}, tutorialState.flags || {}, flags);
  return tutorialState.flags;
}

function setFlag(key: string, value: any): any {
  if (!tutorialState.flags || typeof tutorialState.flags !== 'object') {
    tutorialState.flags = {};
  }
  tutorialState.flags[String(key)] = value;
  return value;
}

function getFlag(key: string, fallback?: any): any {
  if (!tutorialState.flags || typeof tutorialState.flags !== 'object') return fallback;
  return Object.prototype.hasOwnProperty.call(tutorialState.flags, key)
    ? tutorialState.flags[key]
    : fallback;
}

function addPersonality(delta: any): TutorialPersonality {
  if (!delta || typeof delta !== 'object') return tutorialState.personality;
  const keys = ['straight', 'bold', 'snark'];
  const next = Object.assign(createInitialPersonality(), tutorialState.personality || {});
  for (const key of keys) {
    const value = Number((delta as any)[key] || 0);
    if (!Number.isFinite(value) || value === 0) continue;
    (next as any)[key] += Math.trunc(value);
  }
  tutorialState.personality = next;
  return tutorialState.personality;
}

function setScenarioContext(context: any): any {
  tutorialState.scenarioContext = context && typeof context === 'object'
    ? { ...context }
    : null;
  return tutorialState.scenarioContext;
}

function mergeScenarioContext(patch: any): any {
  if (!patch || typeof patch !== 'object') return tutorialState.scenarioContext;
  const base = tutorialState.scenarioContext && typeof tutorialState.scenarioContext === 'object'
    ? tutorialState.scenarioContext
    : {};
  tutorialState.scenarioContext = Object.assign({}, base, patch);
  return tutorialState.scenarioContext;
}

function setObserverDuelState(patch: any): TutorialState['observerDuel'] {
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

function isActive(): boolean {
  return tutorialState.active === true;
}

function isObserverDuelActive(): boolean {
  return !!(tutorialState.observerDuel && tutorialState.observerDuel.active === true);
}

function getTutorialScenarioContext(): any {
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

const TutorialStateModule = {
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

export = TutorialStateModule;
