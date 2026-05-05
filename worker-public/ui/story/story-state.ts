'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface StoryState {
  active: boolean;
  chapterId: string | null;
  stepId: string | null;
  mode: string;
  allowAbort: boolean;
  sceneContext: any;
  encounter: {
    active: boolean;
    encounterId: string | null;
    enemyName: string | null;
    enemyImageSrc: string | null;
    cpuLevel: number | null;
  };
}

const listeners: Set<any> | any[] = typeof Set === 'function' ? new Set() : [];

function createInitialEncounterState(): StoryState['encounter'] {
  return {
    active: false,
    encounterId: null,
    enemyName: null,
    enemyImageSrc: null,
    cpuLevel: null
  };
}

function createInitialState(): StoryState {
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

const storyState: StoryState = createInitialState();

function emitChange(): void {
  const snapshot = storyState;
  if (listeners instanceof Set) {
    listeners.forEach((listener) => {
      try { listener(snapshot); } catch (e) { /* ignore */ }
    });
    return;
  }
  for (let i = 0; i < (listeners as any[]).length; i += 1) {
    try { (listeners as any[])[i](snapshot); } catch (e) { /* ignore */ }
  }
}

function subscribe(listener: any): () => void {
  if (typeof listener !== 'function') {
    return function noop() {};
  }
  if (listeners instanceof Set) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }
  (listeners as any[]).push(listener);
  return function unsubscribe() {
    const index = (listeners as any[]).indexOf(listener);
    if (index >= 0) (listeners as any[]).splice(index, 1);
  };
}

function resetState(): StoryState {
  const initial = createInitialState();
  Object.keys(storyState).forEach((key) => {
    delete (storyState as any)[key];
  });
  Object.assign(storyState, initial);
  emitChange();
  return storyState;
}

function beginChapter(meta?: any): StoryState {
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

function setActive(active: boolean): boolean {
  storyState.active = active === true;
  emitChange();
  return storyState.active;
}

function setChapterId(chapterId: string | null): string | null {
  storyState.chapterId = chapterId || null;
  emitChange();
  return storyState.chapterId;
}

function setStep(stepId: string | null, mode?: string): string | null {
  storyState.stepId = stepId || null;
  if (mode) storyState.mode = String(mode);
  emitChange();
  return storyState.stepId;
}

function setMode(mode: string): string {
  storyState.mode = mode ? String(mode) : 'idle';
  emitChange();
  return storyState.mode;
}

function setAllowAbort(allowAbort: boolean): boolean {
  storyState.allowAbort = allowAbort === true;
  emitChange();
  return storyState.allowAbort;
}

function setSceneContext(context: any): any {
  storyState.sceneContext = context && typeof context === 'object'
    ? { ...context }
    : null;
  emitChange();
  return storyState.sceneContext;
}

function mergeSceneContext(patch: any): any {
  if (!patch || typeof patch !== 'object') return storyState.sceneContext;
  const base = storyState.sceneContext && typeof storyState.sceneContext === 'object'
    ? storyState.sceneContext
    : {};
  storyState.sceneContext = Object.assign({}, base, patch);
  emitChange();
  return storyState.sceneContext;
}

function setEncounterState(patch: any): StoryState['encounter'] {
  const nextPatch = patch && typeof patch === 'object' ? patch : {};
  const prev = storyState.encounter && typeof storyState.encounter === 'object'
    ? storyState.encounter
    : createInitialEncounterState();
  storyState.encounter = Object.assign({}, prev, nextPatch);
  emitChange();
  return storyState.encounter;
}

function isActive(): boolean {
  return storyState.active === true;
}

function isEncounterActive(): boolean {
  return !!(storyState.encounter && storyState.encounter.active === true);
}

function getStorySceneContext(): any {
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

const StoryStateModule = {
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

export = StoryStateModule;
