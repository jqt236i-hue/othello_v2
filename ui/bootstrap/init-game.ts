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
declare const initOthelloPolicyTableModel: (() => Promise<void>) | undefined;
declare const initLvMaxModels: (() => void) | undefined;
declare const loadLvMaxModels: (() => void) | undefined;
declare const resetGame: ((options?: any) => void) | undefined;
declare const initWorkVisualsHelpers: (() => void) | undefined;
declare const initWorkVisualDiagnosticsAuto: (() => void) | undefined;

function shouldEagerLoadCpuPolicyOnBoot(): boolean {
  try {
    if (typeof window !== 'undefined' && (window as any).CARD_REVERSI_EAGER_CPU_POLICY_BOOT === true) return true;
  } catch (e) { /* ignore */ }
  try {
    const search = (typeof location !== 'undefined' && location && typeof location.search === 'string') ? location.search : '';
    return /[?&]eagerCpuPolicy=1\b/i.test(search) || /[?&]eagerCpuPolicy=true\b/i.test(search);
  } catch (e) { /* ignore */ }
  return false;
}

async function initGameSystems(): Promise<void> {
  if (shouldEagerLoadCpuPolicyOnBoot()) {
    if (typeof loadCpuPolicy === 'function' && typeof CpuPolicy !== 'undefined' && CpuPolicy && typeof CpuPolicy.loadPolicyForLevel === 'function') {
      loadCpuPolicy();
    }
    if (typeof initPolicyOnnxModel === 'function') {
      await initPolicyOnnxModel();
    }
    if (typeof initPolicyTableModel === 'function') {
      await initPolicyTableModel();
    }
    if (typeof initOthelloPolicyTableModel === 'function') {
      await initOthelloPolicyTableModel();
    }
    if (typeof initLvMaxModels === 'function' && typeof loadLvMaxModels === 'function') {
      initLvMaxModels();
    }
  }
  try {
    if (typeof resetGame === 'function') resetGame({ skipNetworkPublish: true, source: 'bootstrap_init' });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[init] resetGame threw', err && err.message);
  }

  try {
    if (typeof initWorkVisualsHelpers === 'function') initWorkVisualsHelpers();
    if (typeof initWorkVisualDiagnosticsAuto === 'function') initWorkVisualDiagnosticsAuto();
  } catch (e) { /* defensive */ }
}

export = {
  initGameSystems
};
