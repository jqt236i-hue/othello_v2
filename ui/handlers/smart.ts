/**
 * @file smart.ts
 * @description AI level select handlers
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const updateCpuCharacter: (() => void) | undefined;
declare const addLog: ((msg: string) => void) | undefined;
declare const CpuPolicy: {
  loadPolicyForLevel?: (level: number) => Promise<unknown>;
} | undefined;
declare let mccfrPolicy: unknown;

interface SmartOption {
  v: string;
  t: string;
}

const localCpuLevels: Record<string, number> = { black: 1, white: 1 };

function clampCpuLevel(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.floor(n)));
}

function syncRuntimeCpuLevel(playerKey: 'black' | 'white', level: number): void {
  try {
    if (typeof globalThis === 'undefined') return;
    const root = globalThis as typeof globalThis & { cpuSmartness?: Record<string, number> };
    if (!root.cpuSmartness || typeof root.cpuSmartness !== 'object') {
      root.cpuSmartness = { black: 1, white: 1 };
    }
    root.cpuSmartness[playerKey] = clampCpuLevel(level);
  } catch (e) {
    // UI select remains the source of truth; legacy global sync is best-effort.
  }
}

function setupSmartSelects(smartBlack: HTMLSelectElement | null, smartWhite: HTMLSelectElement | null): void {
  const smartOptions: SmartOption[] = [
    { v: '1', t: 'Lv1: 盤喰いの小鬼' },
    { v: '2', t: 'Lv2: 反転の影' },
    { v: '3', t: 'Lv3: 布石を紡ぐ者' },
    { v: '4', t: 'Lv4: 盤面支配者' },
    { v: '5', t: 'Lv5: 終局を告げる者' },
    { v: '6', t: 'Lv6: 盤理の観測者' }
  ];

  if (smartBlack) {
    smartOptions.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.v;
      el.textContent = opt.t;
      smartBlack.appendChild(el);
    });
    localCpuLevels.black = clampCpuLevel(localCpuLevels.black || 1);
    syncRuntimeCpuLevel('black', localCpuLevels.black);
    smartBlack.value = String(localCpuLevels.black);
    smartBlack.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const newLevel = clampCpuLevel(target.value);
      localCpuLevels.black = newLevel;
      syncRuntimeCpuLevel('black', newLevel);
      target.value = String(newLevel);
      console.log(`[CPU Level] Black changed to level ${localCpuLevels.black}`);
      // Reload policy if MCCFR is available
      if (typeof CpuPolicy !== 'undefined' && CpuPolicy && CpuPolicy.loadPolicyForLevel) {
        try {
          mccfrPolicy = await CpuPolicy.loadPolicyForLevel(localCpuLevels.black);
          if (typeof addLog === 'function') {
            addLog(`黒レベル ${localCpuLevels.black} のポリシーを読み込みました`);
          }
        } catch (err) {
          console.warn('Policy reload failed:', err);
        }
      }
    });
  }

  if (smartWhite) {
    smartOptions.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.v;
      el.textContent = opt.t;
      smartWhite.appendChild(el);
    });
    localCpuLevels.white = clampCpuLevel(localCpuLevels.white || 1);
    syncRuntimeCpuLevel('white', localCpuLevels.white);
    smartWhite.value = String(localCpuLevels.white);
    smartWhite.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const newLevel = clampCpuLevel(target.value);
      localCpuLevels.white = newLevel;
      syncRuntimeCpuLevel('white', newLevel);
      target.value = String(newLevel);
      console.log(`[CPU Level] White changed to level ${localCpuLevels.white}`);
      if (typeof updateCpuCharacter === 'function') {
        updateCpuCharacter();
      }
      // Reload policy for new level
      if (typeof CpuPolicy !== 'undefined' && CpuPolicy && CpuPolicy.loadPolicyForLevel) {
        try {
          mccfrPolicy = await CpuPolicy.loadPolicyForLevel(localCpuLevels.white);
          if (typeof addLog === 'function') {
            addLog(`レベル ${localCpuLevels.white} のポリシーを読み込みました`);
          }
        } catch (err) {
          console.warn('Policy reload failed:', err);
        }
      }
    });
  }
}

if (typeof window !== 'undefined') {
  (window as Window & { setupSmartSelects?: typeof setupSmartSelects }).setupSmartSelects = setupSmartSelects;
}

export = {
  setupSmartSelects
};
