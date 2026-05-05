/**
 * @file init-game.ts
 * @description ゲーム初期化（公開APIのみ）
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const loadCpuPolicy: (() => void) | undefined;
declare const CpuPolicy: {
  loadPolicyForLevel?: (level: number) => Promise<unknown>;
} | undefined;
declare const initPolicyOnnxModel: (() => Promise<void>) | undefined;
declare const initPolicyTableModel: (() => Promise<void>) | undefined;
declare const initLvMaxModels: (() => void) | undefined;
declare const loadLvMaxModels: (() => void) | undefined;
declare const resetGame: (() => void) | undefined;
declare const initWorkVisualsHelpers: (() => void) | undefined;
declare const initWorkVisualDiagnosticsAuto: (() => void) | undefined;

async function initGameSystems(): Promise<void> {
  if (typeof loadCpuPolicy === 'function' && typeof CpuPolicy !== 'undefined' && CpuPolicy && typeof CpuPolicy.loadPolicyForLevel === 'function') {
    loadCpuPolicy();
  }
  if (typeof initPolicyOnnxModel === 'function') {
    await initPolicyOnnxModel();
  }
  if (typeof initPolicyTableModel === 'function') {
    await initPolicyTableModel();
  }
  if (typeof initLvMaxModels === 'function' && typeof loadLvMaxModels === 'function') {
    initLvMaxModels();
  }
  try {
    if (typeof resetGame === 'function') resetGame();
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[init] resetGame threw', err && err.message);
  }

  try {
    if (typeof initWorkVisualsHelpers === 'function') initWorkVisualsHelpers();
    if (typeof initWorkVisualDiagnosticsAuto === 'function') initWorkVisualDiagnosticsAuto();
  } catch (e) { /* defensive */ }
}

const InitGame = {
  initGameSystems
};

if (typeof window !== 'undefined') {
  (window as any).InitGame = InitGame;
}

export = InitGame;
