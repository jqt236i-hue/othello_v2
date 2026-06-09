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
const CPU_LEVEL_SHORTCUT_ID = 'cpu-level-label';
const CPU_LEVEL_MENU_ID = 'cpu-level-menu';
const CPU_LEVEL_MENU_OFFSET_PX = 8;
const CPU_LEVEL_OPTIONS: SmartOption[] = [
  { v: '1', t: 'Lv1: 盤喰いの小鬼' },
  { v: '2', t: 'Lv2: 反転の影' },
  { v: '3', t: 'Lv3: 布石を紡ぐ者' },
  { v: '4', t: 'Lv4: 盤面支配者' },
  { v: '5', t: 'Lv5: 終局を告げる者' },
  { v: '6', t: 'Lv6: 盤理の観測者' }
];

function clampCpuLevel(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.floor(n)));
}

function getCpuLevelShortcutButton(): HTMLButtonElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(CPU_LEVEL_SHORTCUT_ID);
  const buttonCtor = (typeof window !== 'undefined' && window.HTMLButtonElement)
    ? window.HTMLButtonElement
    : null;
  return buttonCtor && el instanceof buttonCtor ? el : null;
}

function dispatchSelectChange(selectEl: HTMLSelectElement): void {
  const evt = new Event('change', { bubbles: true });
  selectEl.dispatchEvent(evt);
}

function getCpuLevelMenu(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(CPU_LEVEL_MENU_ID);
  const divCtor = (typeof window !== 'undefined' && window.HTMLDivElement)
    ? window.HTMLDivElement
    : null;
  return divCtor && el instanceof divCtor ? el : null;
}

function setCpuLevelShortcutExpanded(expanded: boolean): void {
  const shortcut = getCpuLevelShortcutButton();
  if (!shortcut) return;
  shortcut.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function hideCpuLevelMenu(): void {
  const menu = getCpuLevelMenu();
  if (!menu) {
    setCpuLevelShortcutExpanded(false);
    return;
  }
  menu.hidden = true;
  setCpuLevelShortcutExpanded(false);
}

function syncCpuLevelMenuSelection(menu: HTMLDivElement, level: number): void {
  menu.querySelectorAll<HTMLButtonElement>('.cpu-level-menu-item').forEach((item) => {
    const selected = clampCpuLevel(item.dataset.cpuLevel) === level;
    item.classList.toggle('is-selected', selected);
    item.setAttribute('aria-checked', selected ? 'true' : 'false');
  });
}

function clearCpuLevelMenuChildren(menu: HTMLDivElement): void {
  while (menu.firstChild) {
    menu.removeChild(menu.firstChild);
  }
}

function positionCpuLevelMenu(shortcut: HTMLButtonElement, menu: HTMLDivElement): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const rect = shortcut.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 720;
  const top = Math.min(
    Math.max(8, Math.round(rect.bottom + CPU_LEVEL_MENU_OFFSET_PX)),
    Math.max(8, viewportHeight - 8)
  );
  const right = Math.max(8, Math.round(viewportWidth - rect.right));
  menu.style.top = `${top}px`;
  menu.style.right = `${right}px`;
  menu.style.left = 'auto';
}

function ensureCpuLevelMenu(smartWhite: HTMLSelectElement): HTMLDivElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  let menu = getCpuLevelMenu();
  if (!menu) {
    menu = document.createElement('div');
    menu.id = CPU_LEVEL_MENU_ID;
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'CPUレベル一覧');
    menu.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    document.body.appendChild(menu);
  }

  clearCpuLevelMenuChildren(menu);
  CPU_LEVEL_OPTIONS.forEach((opt) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'cpu-level-menu-item';
    item.dataset.cpuLevel = opt.v;
    item.textContent = opt.t;
    item.setAttribute('role', 'menuitemradio');
    item.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      smartWhite.value = opt.v;
      dispatchSelectChange(smartWhite);
      hideCpuLevelMenu();
    });
    menu?.appendChild(item);
  });

  syncCpuLevelMenuSelection(menu, clampCpuLevel(smartWhite.value || localCpuLevels.white));
  return menu;
}

function bindCpuLevelDismissHandlers(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const root = window as Window & { __cpuLevelMenuDismissBound?: boolean };
  if (root.__cpuLevelMenuDismissBound) return;

  document.addEventListener('click', (event) => {
    const menu = getCpuLevelMenu();
    const shortcut = getCpuLevelShortcutButton();
    if (!menu || menu.hidden) return;
    const target = event.target;
    const nodeCtor = (typeof window !== 'undefined' && window.Node) ? window.Node : null;
    if (nodeCtor && target instanceof nodeCtor) {
      if (menu.contains(target)) return;
      if (shortcut && shortcut.contains(target)) return;
    }
    hideCpuLevelMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideCpuLevelMenu();
    }
  });

  window.addEventListener('resize', () => {
    const shortcut = getCpuLevelShortcutButton();
    const menu = getCpuLevelMenu();
    if (!shortcut || !menu || menu.hidden || shortcut.disabled) {
      hideCpuLevelMenu();
      return;
    }
    positionCpuLevelMenu(shortcut, menu);
  });

  root.__cpuLevelMenuDismissBound = true;
}

function observeCpuLevelShortcutState(): void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  const shortcut = getCpuLevelShortcutButton();
  if (!shortcut || shortcut.dataset.cpuLevelObserverBound === '1') return;

  const observer = new MutationObserver(() => {
    if (shortcut.disabled || shortcut.getAttribute('aria-disabled') === 'true') {
      hideCpuLevelMenu();
    }
  });
  observer.observe(shortcut, {
    attributes: true,
    attributeFilter: ['disabled', 'aria-disabled']
  });
  shortcut.dataset.cpuLevelObserverBound = '1';
}

function bindCpuLevelShortcut(smartWhite: HTMLSelectElement | null): void {
  const shortcut = getCpuLevelShortcutButton();
  if (!shortcut || !smartWhite || shortcut.dataset.cpuLevelShortcutBound === '1') return;
  shortcut.setAttribute('aria-haspopup', 'menu');
  shortcut.setAttribute('aria-expanded', 'false');
  bindCpuLevelDismissHandlers();
  observeCpuLevelShortcutState();
  shortcut.addEventListener('click', () => {
    if (shortcut.disabled) {
      hideCpuLevelMenu();
      return;
    }

    const existingMenu = getCpuLevelMenu();
    if (existingMenu && !existingMenu.hidden) {
      hideCpuLevelMenu();
      return;
    }

    const menu = ensureCpuLevelMenu(smartWhite);
    if (!menu) return;
    positionCpuLevelMenu(shortcut, menu);
    menu.hidden = false;
    setCpuLevelShortcutExpanded(true);
  });
  shortcut.dataset.cpuLevelShortcutBound = '1';
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
  if (smartBlack) {
    CPU_LEVEL_OPTIONS.forEach(opt => {
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
    CPU_LEVEL_OPTIONS.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.v;
      el.textContent = opt.t;
      smartWhite.appendChild(el);
    });
    localCpuLevels.white = clampCpuLevel(localCpuLevels.white || 1);
    syncRuntimeCpuLevel('white', localCpuLevels.white);
    smartWhite.value = String(localCpuLevels.white);
    bindCpuLevelShortcut(smartWhite);
    smartWhite.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const newLevel = clampCpuLevel(target.value);
      localCpuLevels.white = newLevel;
      syncRuntimeCpuLevel('white', newLevel);
      target.value = String(newLevel);
      const menu = getCpuLevelMenu();
      if (menu) syncCpuLevelMenuSelection(menu, newLevel);
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
