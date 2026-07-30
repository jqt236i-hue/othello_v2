type MobileCommandLayer = 'drawer' | 'quick';

type MobileNativePanelId =
  | 'settings'
  | 'appearance'
  | 'help'
  | 'ranking'
  | 'profile'
  | 'gacha'
  | 'deck'
  | 'network'
  | 'rated';

type MobileMenuGroupId = 'game' | 'collection' | 'information' | 'settings';

interface MobileMenuItem {
  id: string;
  label: string;
  group: MobileMenuGroupId;
  triggerId: string;
  panelId?: MobileNativePanelId;
}

interface MobileNativePanelConfig {
  label: string;
  triggerId: string;
  panelElementId: string;
  headerElementId: string;
  closeButtonId: string;
}

interface MobileHistoryMarker {
  token: string;
  kind: string;
}

interface MobileCommandSurfaceSetupOptions {
  root?: Window | null;
  document?: Document | null;
  confirmReset?: (message: string) => boolean;
}

interface MobileCommandSurfaceController {
  openDrawer(): void;
  openQuickControls(): void;
  closeTop(): boolean;
  sync(): void;
  destroy(): void;
}

const HISTORY_STATE_KEY = '__cardReversiMobileCommandSurface';
const PHONE_PROFILE = 'layout-profile-phone-portrait';

const MENU_GROUP_LABELS: Record<MobileMenuGroupId, string> = {
  game: 'ゲーム',
  collection: 'コレクション',
  information: '情報',
  settings: '設定',
};

const MENU_ITEMS: readonly MobileMenuItem[] = [
  { id: 'cpu', label: 'CPU', group: 'game', triggerId: 'modeCpuBtn' },
  { id: 'network', label: 'ネット対戦', group: 'game', triggerId: 'modeNetworkBtn', panelId: 'network' },
  { id: 'rated', label: 'レート戦', group: 'game', triggerId: 'ratedMatchOpenBtn', panelId: 'rated' },
  { id: 'action', label: '2Dアクション', group: 'game', triggerId: 'reversiDestinyOpenLink' },
  { id: 'deck', label: 'デッキ', group: 'collection', triggerId: 'deckBuilderOpenBtn', panelId: 'deck' },
  { id: 'gacha', label: 'ガチャ', group: 'collection', triggerId: 'gachaOpenBtn', panelId: 'gacha' },
  { id: 'appearance', label: '見た目設定', group: 'collection', triggerId: 'handSkinBtn', panelId: 'appearance' },
  { id: 'ranking', label: 'ランキング', group: 'information', triggerId: 'leaderboardOpenBtn', panelId: 'ranking' },
  { id: 'profile', label: 'プロフィール', group: 'information', triggerId: 'profileOpenBtn', panelId: 'profile' },
  { id: 'help', label: 'ヘルプ', group: 'information', triggerId: 'rulesHelpBtn', panelId: 'help' },
  { id: 'settings', label: '設定', group: 'settings', triggerId: 'sidePanelToggleBtn', panelId: 'settings' },
];

const PANEL_CONFIGS: Record<MobileNativePanelId, MobileNativePanelConfig> = {
  settings: {
    label: '設定',
    triggerId: 'sidePanelToggleBtn',
    panelElementId: 'side-panel',
    headerElementId: 'mobile-command-settings-header',
    closeButtonId: 'sidePanelToggleBtn',
  },
  appearance: {
    label: '見た目設定',
    triggerId: 'handSkinBtn',
    panelElementId: 'handSkinPanel',
    headerElementId: 'handSkinPanelHeader',
    closeButtonId: 'handSkinCloseBtn',
  },
  help: {
    label: 'ヘルプ',
    triggerId: 'rulesHelpBtn',
    panelElementId: 'rules-help-panel',
    headerElementId: 'rules-help-title-row',
    closeButtonId: 'rules-help-close-btn',
  },
  ranking: {
    label: 'ランキング',
    triggerId: 'leaderboardOpenBtn',
    panelElementId: 'leaderboardOverlay',
    headerElementId: 'leaderboardModalHeader',
    closeButtonId: 'leaderboardCloseBtn',
  },
  profile: {
    label: 'プロフィール',
    triggerId: 'profileOpenBtn',
    panelElementId: 'profileOverlay',
    headerElementId: 'profileModalHeader',
    closeButtonId: 'profileCloseBtn',
  },
  gacha: {
    label: 'ガチャ',
    triggerId: 'gachaOpenBtn',
    panelElementId: 'gachaOverlay',
    headerElementId: 'gachaModalHeader',
    closeButtonId: 'gachaCloseBtn',
  },
  deck: {
    label: 'デッキ構築',
    triggerId: 'deckBuilderOpenBtn',
    panelElementId: 'deckBuilderOverlay',
    headerElementId: 'deckBuilderModalHeader',
    closeButtonId: 'deckBuilderCloseBtn',
  },
  network: {
    label: 'ネット対戦',
    triggerId: 'modeNetworkBtn',
    panelElementId: 'networkOverlay',
    headerElementId: 'networkModalHeader',
    closeButtonId: 'networkCloseBtn',
  },
  rated: {
    label: 'レート戦',
    triggerId: 'ratedMatchOpenBtn',
    panelElementId: 'ratedMatchOverlay',
    headerElementId: 'ratedMatchModalHeader',
    closeButtonId: 'ratedMatchCloseBtn',
  },
};

const controllers = new WeakMap<Document, MobileCommandSurfaceController>();

function setupMobileCommandSurface(
  options: MobileCommandSurfaceSetupOptions = {},
): MobileCommandSurfaceController | null {
  const rootRef = options.root || (
    typeof window !== 'undefined' ? window : null
  );
  const documentRef = options.document || rootRef?.document || (
    typeof document !== 'undefined' ? document : null
  );
  if (!rootRef || !documentRef || !documentRef.body) return null;

  const existingController = controllers.get(documentRef);
  if (existingController) return existingController;

  const confirmReset = options.confirmReset || ((message: string) => rootRef.confirm(message));
  const cleanupCallbacks: Array<() => void> = [];
  const observers: MutationObserver[] = [];
  let activeLayer: MobileCommandLayer | null = null;
  let activePanel: MobileNativePanelId | null = null;
  let pendingPanel: MobileNativePanelId | null = null;
  let pendingPanelTimer: number | null = null;
  let focusReturnTarget: HTMLElement | null = null;
  let ownedHistory: MobileHistoryMarker | null = null;
  let historySequence = 0;
  let syncQueued = false;
  let destroyed = false;
  let helpFiltersCollapsed = true;

  const byId = <T extends HTMLElement>(id: string): T | null => (
    documentRef.getElementById(id) as T | null
  );

  const make = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
  ): HTMLElementTagNameMap[K] => {
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    return element;
  };

  const listen = (
    target: EventTarget | null,
    type: string,
    listener: EventListener,
    eventOptions?: AddEventListenerOptions | boolean,
  ): void => {
    if (!target) return;
    target.addEventListener(type, listener, eventOptions);
    cleanupCallbacks.push(() => target.removeEventListener(type, listener, eventOptions));
  };

  const requestFrame = (callback: () => void): void => {
    if (typeof rootRef.requestAnimationFrame === 'function') {
      rootRef.requestAnimationFrame(() => callback());
      return;
    }
    rootRef.setTimeout(callback, 0);
  };

  const isPhonePortrait = (): boolean => {
    const html = documentRef.documentElement;
    return html.classList.contains(PHONE_PROFILE)
      || html.getAttribute('data-layout-profile') === PHONE_PROFILE;
  };

  const root = make('div', 'mobile-command-surface');
  root.id = 'mobile-command-surface';
  root.setAttribute('aria-label', 'スマホ用操作');

  const menuTrigger = make('button', 'mobile-command-trigger mobile-command-menu-trigger');
  menuTrigger.id = 'mobile-command-menu-trigger';
  menuTrigger.type = 'button';
  menuTrigger.setAttribute('aria-haspopup', 'dialog');
  menuTrigger.setAttribute('aria-controls', 'mobile-command-drawer');
  menuTrigger.setAttribute('aria-expanded', 'false');
  menuTrigger.setAttribute('aria-label', 'メニューを開く');
  const menuTriggerIcon = make('span', 'mobile-command-menu-trigger-icon');
  menuTriggerIcon.setAttribute('aria-hidden', 'true');
  const menuTriggerLabel = make('span', 'mobile-command-trigger-label');
  menuTriggerLabel.textContent = 'メニュー';
  menuTrigger.append(menuTriggerIcon, menuTriggerLabel);

  const quickTrigger = make('button', 'mobile-command-trigger mobile-command-quick-trigger');
  quickTrigger.id = 'mobile-command-quick-trigger';
  quickTrigger.type = 'button';
  quickTrigger.setAttribute('aria-haspopup', 'dialog');
  quickTrigger.setAttribute('aria-controls', 'mobile-command-quick-sheet');
  quickTrigger.setAttribute('aria-expanded', 'false');
  quickTrigger.setAttribute('aria-label', '操作を開く');
  quickTrigger.textContent = '操作';

  const backdrop = make('div', 'mobile-command-backdrop');
  backdrop.id = 'mobile-command-backdrop';
  backdrop.hidden = true;
  backdrop.setAttribute('aria-hidden', 'true');

  const drawer = make('aside', 'mobile-command-drawer');
  drawer.id = 'mobile-command-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-labelledby', 'mobile-command-drawer-title');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('inert', '');

  const drawerHeader = make('div', 'mobile-command-layer-header');
  const drawerHeading = make('div');
  const drawerTitle = make('h2', 'mobile-command-layer-title');
  drawerTitle.id = 'mobile-command-drawer-title';
  drawerTitle.textContent = 'メニュー';
  const drawerSubtitle = make('p', 'mobile-command-layer-subtitle');
  drawerSubtitle.textContent = 'ゲームの入口を選択してください';
  drawerHeading.append(drawerTitle, drawerSubtitle);
  const drawerClose = make('button', 'mobile-command-layer-close');
  drawerClose.id = 'mobile-command-drawer-close';
  drawerClose.type = 'button';
  drawerClose.setAttribute('aria-label', 'メニューを閉じる');
  drawerClose.textContent = '×';
  drawerHeader.append(drawerHeading, drawerClose);

  const menuNav = make('nav', 'mobile-command-menu-nav');
  menuNav.setAttribute('aria-label', 'ゲームメニュー');

  const copyMenuIcon = (source: HTMLElement): HTMLElement | null => {
    const sourceIcon = source.querySelector<HTMLElement>('.left-action-icon');
    if (!sourceIcon) return null;
    const icon = sourceIcon.cloneNode(true) as HTMLElement;
    icon.removeAttribute('id');
    icon.classList.add('mobile-command-menu-icon');
    try {
      const mask = rootRef.getComputedStyle(sourceIcon).getPropertyValue('--left-action-icon-mask');
      if (mask.trim()) icon.style.setProperty('--left-action-icon-mask', mask.trim());
    } catch (_error) {
      // The text label remains the accessible and visible fallback.
    }
    return icon;
  };

  (Object.keys(MENU_GROUP_LABELS) as MobileMenuGroupId[]).forEach((groupId) => {
    const availableItems = MENU_ITEMS.filter((item) => (
      item.group === groupId && byId(item.triggerId)
    ));
    if (availableItems.length === 0) return;

    const section = make('section', 'mobile-command-menu-group');
    const heading = make('h3', 'mobile-command-menu-group-title');
    heading.id = `mobile-command-group-${groupId}`;
    heading.textContent = MENU_GROUP_LABELS[groupId];
    section.setAttribute('aria-labelledby', heading.id);
    section.appendChild(heading);

    availableItems.forEach((item) => {
      const source = byId(item.triggerId);
      if (!source) return;
      const button = make('button', 'mobile-command-menu-item');
      button.id = `mobile-command-menu-${item.id}`;
      button.type = 'button';
      button.dataset.mobileCommandTrigger = item.triggerId;
      if (item.panelId) button.dataset.mobilePanel = item.panelId;
      button.setAttribute('aria-label', item.label);

      const icon = copyMenuIcon(source);
      if (icon) button.appendChild(icon);
      const label = make('span', 'mobile-command-menu-label');
      label.textContent = item.label;
      const chevron = make('span', 'mobile-command-menu-chevron');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      button.append(label, chevron);
      section.appendChild(button);
    });
    menuNav.appendChild(section);
  });
  drawer.append(drawerHeader, menuNav);

  const quickSheet = make('section', 'mobile-command-quick-sheet');
  quickSheet.id = 'mobile-command-quick-sheet';
  quickSheet.setAttribute('role', 'dialog');
  quickSheet.setAttribute('aria-modal', 'true');
  quickSheet.setAttribute('aria-labelledby', 'mobile-command-quick-title');
  quickSheet.setAttribute('aria-hidden', 'true');
  quickSheet.setAttribute('inert', '');

  const quickHeader = make('div', 'mobile-command-layer-header');
  const quickHeading = make('div');
  const quickTitle = make('h2', 'mobile-command-layer-title');
  quickTitle.id = 'mobile-command-quick-title';
  quickTitle.textContent = '操作';
  const quickSubtitle = make('p', 'mobile-command-layer-subtitle');
  quickSubtitle.textContent = '対局中の操作と音量設定';
  quickHeading.append(quickTitle, quickSubtitle);
  const quickClose = make('button', 'mobile-command-layer-close');
  quickClose.id = 'mobile-command-quick-close';
  quickClose.type = 'button';
  quickClose.setAttribute('aria-label', '操作を閉じる');
  quickClose.textContent = '×';
  quickHeader.append(quickHeading, quickClose);

  const quickGrid = make('div', 'mobile-command-quick-grid');
  const quickButtonIds = ['resetBtn', 'quickBgmToggleBtn', 'autoToggleBtn', 'muteBtn'] as const;
  quickButtonIds.forEach((sourceId) => {
    const source = byId<HTMLButtonElement>(sourceId);
    if (!source) return;
    const button = make('button', 'mobile-command-quick-action');
    button.type = 'button';
    button.dataset.mobileProxy = sourceId;
    button.textContent = source.textContent?.trim() || source.getAttribute('aria-label') || sourceId;
    quickGrid.appendChild(button);
  });

  const sourceBgmSelect = byId<HTMLSelectElement>('bgmTrackSelect');
  let mobileBgmSelect: HTMLSelectElement | null = null;
  if (sourceBgmSelect) {
    mobileBgmSelect = make('select', 'mobile-command-bgm-select');
    mobileBgmSelect.id = 'mobile-command-bgm-select';
    mobileBgmSelect.setAttribute('aria-label', 'BGM選択');
    quickGrid.appendChild(mobileBgmSelect);
  }

  const sourceVolume = byId<HTMLInputElement>('seVolSlider');
  let mobileVolume: HTMLInputElement | null = null;
  if (sourceVolume) {
    const volume = make('label', 'mobile-command-volume');
    volume.htmlFor = 'mobile-command-volume-slider';
    const volumeLabel = make('span');
    volumeLabel.textContent = '全体音量';
    mobileVolume = make('input');
    mobileVolume.id = 'mobile-command-volume-slider';
    mobileVolume.type = 'range';
    mobileVolume.min = sourceVolume.min;
    mobileVolume.max = sourceVolume.max;
    mobileVolume.step = sourceVolume.step;
    mobileVolume.value = sourceVolume.value;
    volume.append(volumeLabel, mobileVolume);
    quickGrid.appendChild(volume);
  }

  const quickNote = make('p', 'mobile-command-sheet-note');
  quickNote.textContent = '設定値はゲーム本体の操作と同期します。';
  quickSheet.append(quickHeader, quickGrid, quickNote);
  root.append(menuTrigger, quickTrigger, backdrop, drawer, quickSheet);
  documentRef.body.appendChild(root);

  const currentHistoryMarker = (): MobileHistoryMarker | null => {
    const historyState = rootRef.history.state;
    if (!historyState || typeof historyState !== 'object') return null;
    const marker = (historyState as Record<string, unknown>)[HISTORY_STATE_KEY];
    if (!marker || typeof marker !== 'object') return null;
    const value = marker as Partial<MobileHistoryMarker>;
    if (typeof value.token !== 'string' || typeof value.kind !== 'string') return null;
    return { token: value.token, kind: value.kind };
  };

  const nextHistoryState = (marker: MobileHistoryMarker): Record<string, unknown> => {
    const currentState = rootRef.history.state;
    const base = currentState && typeof currentState === 'object'
      ? { ...(currentState as Record<string, unknown>) }
      : {};
    base[HISTORY_STATE_KEY] = marker;
    return base;
  };

  const pushOwnedHistory = (kind: string): void => {
    if (ownedHistory) return;
    const marker = {
      token: `mobile-command-${Date.now()}-${historySequence += 1}`,
      kind,
    };
    try {
      rootRef.history.pushState(nextHistoryState(marker), '');
      ownedHistory = marker;
    } catch (_error) {
      ownedHistory = null;
    }
  };

  const promoteOwnedHistory = (kind: string): void => {
    if (!ownedHistory) {
      pushOwnedHistory(kind);
      return;
    }
    const marker = { ...ownedHistory, kind };
    const currentMarker = currentHistoryMarker();
    if (!currentMarker || currentMarker.token !== ownedHistory.token) {
      ownedHistory = null;
      pushOwnedHistory(kind);
      return;
    }
    try {
      rootRef.history.replaceState(nextHistoryState(marker), '');
      ownedHistory = marker;
    } catch (_error) {
      ownedHistory = null;
    }
  };

  const consumeOwnedHistory = (): void => {
    const marker = ownedHistory;
    ownedHistory = null;
    if (!marker) return;
    const currentMarker = currentHistoryMarker();
    if (!currentMarker || currentMarker.token !== marker.token) return;
    try {
      rootRef.history.back();
    } catch (_error) {
      // The visual state is already closed; never navigate an unowned entry.
    }
  };

  const getFocusable = (container: HTMLElement | null): HTMLElement[] => {
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), '
      + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => {
      if (element.closest('[inert]')) return false;
      let current: HTMLElement | null = element;
      while (current && current !== container.parentElement) {
        if (current.hidden || current.getAttribute('aria-hidden') === 'true') return false;
        current = current.parentElement;
      }
      return true;
    });
  };

  const restoreFocus = (): void => {
    const target = focusReturnTarget?.isConnected
      ? focusReturnTarget
      : menuTrigger;
    focusReturnTarget = null;
    requestFrame(() => target.focus({ preventScroll: true }));
  };

  const setBodyLock = (): void => {
    const locked = isPhonePortrait() && (activeLayer !== null || activePanel !== null);
    documentRef.documentElement.classList.toggle('mobile-command-surface-locked', locked);
    documentRef.body.classList.toggle('mobile-command-surface-locked', locked);
  };

  const applyLayerState = (layer: MobileCommandLayer | null): void => {
    activeLayer = layer;
    root.classList.toggle('is-drawer-open', layer === 'drawer');
    root.classList.toggle('is-quick-open', layer === 'quick');
    menuTrigger.setAttribute('aria-expanded', String(layer === 'drawer'));
    quickTrigger.setAttribute('aria-expanded', String(layer === 'quick'));

    const drawerOpen = layer === 'drawer';
    drawer.setAttribute('aria-hidden', String(!drawerOpen));
    drawer.toggleAttribute('inert', !drawerOpen);
    const quickOpen = layer === 'quick';
    quickSheet.setAttribute('aria-hidden', String(!quickOpen));
    quickSheet.toggleAttribute('inert', !quickOpen);
    backdrop.hidden = layer === null;
    backdrop.setAttribute('aria-hidden', String(layer === null));
    setBodyLock();
  };

  const closeCustomLayer = (consumeHistory = true, returnFocus = true): void => {
    if (!activeLayer) return;
    applyLayerState(null);
    if (consumeHistory) consumeOwnedHistory();
    if (returnFocus) restoreFocus();
  };

  const focusOpenLayer = (): void => {
    const layer = activeLayer === 'drawer' ? drawer : activeLayer === 'quick' ? quickSheet : null;
    getFocusable(layer)[0]?.focus({ preventScroll: true });
  };

  const syncQuickControls = (): void => {
    root.querySelectorAll<HTMLButtonElement>('[data-mobile-proxy]').forEach((proxy) => {
      const sourceId = proxy.dataset.mobileProxy;
      const source = sourceId ? byId<HTMLButtonElement>(sourceId) : null;
      if (!source) {
        proxy.disabled = true;
        return;
      }
      const label = source.textContent?.trim() || source.getAttribute('aria-label') || '';
      if (label && proxy.textContent !== label) proxy.textContent = label;
      proxy.disabled = source.disabled;
      const pressed = source.getAttribute('aria-pressed');
      if (pressed === null) proxy.removeAttribute('aria-pressed');
      else proxy.setAttribute('aria-pressed', pressed);
      proxy.classList.toggle('is-active', source.classList.contains('btn-active') || pressed === 'true');
    });

    if (sourceBgmSelect && mobileBgmSelect) {
      const signature = Array.from(sourceBgmSelect.options)
        .map((option) => `${option.value}\u0000${option.textContent || ''}`)
        .join('\u0001');
      if (mobileBgmSelect.dataset.optionSignature !== signature) {
        mobileBgmSelect.dataset.optionSignature = signature;
        mobileBgmSelect.replaceChildren(...Array.from(sourceBgmSelect.options).map((sourceOption) => {
          const option = make('option');
          option.value = sourceOption.value;
          option.textContent = sourceOption.textContent;
          option.disabled = sourceOption.disabled;
          return option;
        }));
      }
      if (documentRef.activeElement !== mobileBgmSelect) {
        mobileBgmSelect.value = sourceBgmSelect.value;
      }
    }

    if (sourceVolume && mobileVolume && documentRef.activeElement !== mobileVolume) {
      mobileVolume.value = sourceVolume.value;
    }
  };

  const isNativePanelOpen = (panelId: MobileNativePanelId): boolean => {
    const panel = byId(PANEL_CONFIGS[panelId].panelElementId);
    if (!panel) return false;
    return panel.classList.contains('is-open') || panel.getAttribute('aria-hidden') === 'false';
  };

  const ensureHelpFilterToggle = (): void => {
    const layout = byId('rules-help-catalog-layout');
    const controls = byId('rules-help-catalog-controls');
    if (!layout || !controls) return;

    let toggle = byId<HTMLButtonElement>('mobile-command-help-filter-toggle');
    if (!toggle) {
      toggle = make('button', 'mobile-command-help-filter-toggle');
      toggle.id = 'mobile-command-help-filter-toggle';
      toggle.type = 'button';
      toggle.textContent = '検索・絞り込み';
      toggle.setAttribute('aria-controls', controls.id);
      controls.parentElement?.insertBefore(toggle, controls);
      listen(toggle, 'click', (() => {
        helpFiltersCollapsed = !helpFiltersCollapsed;
        layout.classList.toggle('is-mobile-filters-collapsed', helpFiltersCollapsed);
        toggle!.setAttribute('aria-expanded', String(!helpFiltersCollapsed));
      }) as EventListener);
    }
    layout.classList.toggle('is-mobile-filters-collapsed', helpFiltersCollapsed);
    toggle.setAttribute('aria-expanded', String(!helpFiltersCollapsed));
  };

  const ensureNativePanelChrome = (panelId: MobileNativePanelId): void => {
    const config = PANEL_CONFIGS[panelId];
    const panel = byId(config.panelElementId);
    if (!panel) return;
    panel.classList.add('mobile-command-native-panel');
    panel.setAttribute('role', 'dialog');
    if (isPhonePortrait()) panel.setAttribute('aria-modal', 'true');

    if (panelId === 'settings') {
      let settingsHeader = byId('mobile-command-settings-header');
      if (!settingsHeader) {
        const controlPanel = byId('control-panel');
        if (!controlPanel) return;
        settingsHeader = make('div', 'mobile-command-native-header');
        settingsHeader.id = 'mobile-command-settings-header';
        settingsHeader.dataset.mobileCommandInjected = 'true';
        const title = make('h2', 'mobile-command-native-title');
        title.textContent = config.label;
        const current = make('span', 'mobile-command-current-location');
        current.textContent = `メニュー / ${config.label}`;
        current.setAttribute('aria-label', `現在位置 ${config.label}`);
        const close = make('button', 'mobile-command-native-close');
        close.type = 'button';
        close.setAttribute('aria-label', `${config.label}を閉じる`);
        close.textContent = '×';
        listen(close, 'click', (() => byId(config.closeButtonId)?.click()) as EventListener);
        settingsHeader.append(title, current, close);
        controlPanel.prepend(settingsHeader);
      }
      return;
    }

    const header = byId(config.headerElementId);
    if (!header) return;
    header.classList.add('mobile-command-native-header');
    const close = byId(config.closeButtonId);
    close?.classList.add('mobile-command-native-close');

    if (!header.querySelector('.mobile-command-current-location')) {
      const current = make('span', 'mobile-command-current-location');
      current.dataset.mobileCommandInjected = 'true';
      current.textContent = `メニュー / ${config.label}`;
      current.setAttribute('aria-label', `現在位置 ${config.label}`);
      const closeInHeader = close && close.parentElement === header ? close : null;
      if (closeInHeader) header.insertBefore(current, closeInHeader);
      else header.appendChild(current);
    }
    if (panelId === 'help') ensureHelpFilterToggle();
  };

  const findOpenNativePanel = (): MobileNativePanelId | null => (
    (Object.keys(PANEL_CONFIGS) as MobileNativePanelId[])
      .find((panelId) => isNativePanelOpen(panelId)) || null
  );

  const clearPendingPanelTimer = (): void => {
    if (pendingPanelTimer === null) return;
    rootRef.clearTimeout(pendingPanelTimer);
    pendingPanelTimer = null;
  };

  const closeNativePanel = (panelId: MobileNativePanelId): void => {
    byId(PANEL_CONFIGS[panelId].closeButtonId)?.click();
  };

  const syncNativePanels = (): void => {
    const openPanel = findOpenNativePanel();
    if (openPanel) ensureNativePanelChrome(openPanel);

    const panelChanged = openPanel !== activePanel;
    const previousPanel = activePanel;
    activePanel = openPanel;
    root.classList.toggle('has-native-panel', openPanel !== null);
    [menuTrigger, quickTrigger].forEach((trigger) => {
      const hidden = openPanel !== null;
      trigger.toggleAttribute('inert', hidden);
      trigger.setAttribute('aria-hidden', String(hidden));
    });
    setBodyLock();

    if (!panelChanged) return;
    if (openPanel) {
      if (pendingPanel === openPanel) {
        clearPendingPanelTimer();
        pendingPanel = null;
        promoteOwnedHistory(`panel:${openPanel}`);
      }
      return;
    }

    if (previousPanel) {
      if (ownedHistory?.kind === `panel:${previousPanel}`) consumeOwnedHistory();
      restoreFocus();
    }
  };

  const sync = (): void => {
    if (destroyed) return;
    syncQueued = false;
    syncQuickControls();
    syncNativePanels();
  };

  const scheduleSync = (): void => {
    if (syncQueued || destroyed) return;
    syncQueued = true;
    requestFrame(sync);
  };

  const rememberFocus = (): void => {
    const current = documentRef.activeElement as HTMLElement | null;
    focusReturnTarget = current && typeof current.focus === 'function' && current.isConnected
      ? current
      : menuTrigger;
  };

  const openLayer = (layer: MobileCommandLayer): void => {
    if (!isPhonePortrait() || activePanel) return;
    if (activeLayer === layer) return;
    rememberFocus();
    if (activeLayer) applyLayerState(null);
    if (layer === 'quick') syncQuickControls();
    applyLayerState(layer);
    promoteOwnedHistory(layer);
    requestFrame(focusOpenLayer);
  };

  const openDrawer = (): void => openLayer('drawer');
  const openQuickControls = (): void => openLayer('quick');

  const openNativePanel = (panelId: MobileNativePanelId): void => {
    if (!isPhonePortrait()) return;
    const trigger = byId(PANEL_CONFIGS[panelId].triggerId);
    if (!trigger) return;

    focusReturnTarget = menuTrigger;
    if (activeLayer) applyLayerState(null);
    pendingPanel = panelId;
    clearPendingPanelTimer();
    trigger.click();
    scheduleSync();
    pendingPanelTimer = rootRef.setTimeout(() => {
      if (pendingPanel !== panelId || isNativePanelOpen(panelId)) return;
      pendingPanel = null;
      pendingPanelTimer = null;
      consumeOwnedHistory();
      setBodyLock();
      restoreFocus();
    }, 1200);
  };

  const closeTop = (): boolean => {
    if (!isPhonePortrait()) return false;
    if (activeLayer) {
      closeCustomLayer();
      return true;
    }
    if (activePanel) {
      closeNativePanel(activePanel);
      scheduleSync();
      return true;
    }
    return false;
  };

  listen(menuTrigger, 'click', openDrawer as EventListener);
  listen(quickTrigger, 'click', openQuickControls as EventListener);
  listen(drawerClose, 'click', (() => closeCustomLayer()) as EventListener);
  listen(quickClose, 'click', (() => closeCustomLayer()) as EventListener);
  listen(backdrop, 'pointerdown', (() => closeCustomLayer()) as EventListener);

  menuNav.querySelectorAll<HTMLButtonElement>('[data-mobile-command-trigger]').forEach((button) => {
    listen(button, 'click', (() => {
      const triggerId = button.dataset.mobileCommandTrigger;
      const panelId = button.dataset.mobilePanel as MobileNativePanelId | undefined;
      if (!triggerId) return;
      if (panelId) {
        openNativePanel(panelId);
        return;
      }
      applyLayerState(null);
      consumeOwnedHistory();
      focusReturnTarget = menuTrigger;
      byId(triggerId)?.click();
      restoreFocus();
    }) as EventListener);
  });

  quickGrid.querySelectorAll<HTMLButtonElement>('[data-mobile-proxy]').forEach((button) => {
    listen(button, 'click', (() => {
      const sourceId = button.dataset.mobileProxy;
      const source = sourceId ? byId<HTMLButtonElement>(sourceId) : null;
      if (!source) return;
      if (
        sourceId === 'resetBtn'
        && source.dataset.rematchState !== 'network'
        && !confirmReset('現在の対局をリセットしますか？')
      ) {
        return;
      }
      source.click();
      scheduleSync();
    }) as EventListener);
  });

  if (sourceBgmSelect && mobileBgmSelect) {
    listen(mobileBgmSelect, 'change', (() => {
      sourceBgmSelect.value = mobileBgmSelect!.value;
      sourceBgmSelect.dispatchEvent(new rootRef.Event('change', { bubbles: true }));
      scheduleSync();
    }) as EventListener);
  }

  if (sourceVolume && mobileVolume) {
    listen(mobileVolume, 'input', (() => {
      sourceVolume.value = mobileVolume!.value;
      sourceVolume.dispatchEvent(new rootRef.Event('input', { bubbles: true }));
      scheduleSync();
    }) as EventListener);
    listen(mobileVolume, 'change', (() => {
      sourceVolume.value = mobileVolume!.value;
      sourceVolume.dispatchEvent(new rootRef.Event('change', { bubbles: true }));
      scheduleSync();
    }) as EventListener);
  }

  listen(documentRef, 'keydown', ((event: KeyboardEvent) => {
    if (!isPhonePortrait()) return;
    if (event.key === 'Escape' && closeTop()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key !== 'Tab' || !activeLayer) return;
    const layer = activeLayer === 'drawer' ? drawer : quickSheet;
    const focusable = getFocusable(layer);
    if (focusable.length === 0) return;
    const currentIndex = focusable.indexOf(documentRef.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex]?.focus({ preventScroll: true });
  }) as EventListener, true);

  listen(rootRef, 'popstate', (() => {
    if (!ownedHistory) return;
    ownedHistory = null;
    clearPendingPanelTimer();
    pendingPanel = null;
    if (activeLayer) {
      closeCustomLayer(false);
      return;
    }
    if (activePanel) {
      const panelToClose = activePanel;
      closeNativePanel(panelToClose);
      scheduleSync();
    }
  }) as EventListener);

  const handleProfileChange = (): void => {
    if (isPhonePortrait()) {
      scheduleSync();
      return;
    }
    if (activeLayer) closeCustomLayer();
    if (activePanel && ownedHistory?.kind === `panel:${activePanel}`) {
      closeNativePanel(activePanel);
      scheduleSync();
    }
    documentRef.documentElement.classList.remove('mobile-command-surface-locked');
    documentRef.body.classList.remove('mobile-command-surface-locked');
  };
  listen(rootRef, 'resize', handleProfileChange as EventListener, { passive: true });
  listen(rootRef, 'orientationchange', handleProfileChange as EventListener, { passive: true });

  const profileObserver = new rootRef.MutationObserver(handleProfileChange);
  profileObserver.observe(documentRef.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-layout-profile'],
  });
  observers.push(profileObserver);

  const observedElements = new Set<HTMLElement>();
  (Object.keys(PANEL_CONFIGS) as MobileNativePanelId[]).forEach((panelId) => {
    const panel = byId(PANEL_CONFIGS[panelId].panelElementId);
    if (panel) observedElements.add(panel);
  });
  quickButtonIds.forEach((id) => {
    const source = byId(id);
    if (source) observedElements.add(source);
  });
  if (sourceBgmSelect) observedElements.add(sourceBgmSelect);
  if (sourceVolume) observedElements.add(sourceVolume);

  observedElements.forEach((element) => {
    const observer = new rootRef.MutationObserver(scheduleSync);
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'aria-hidden', 'aria-pressed', 'disabled', 'data-rematch-state'],
      childList: true,
      subtree: true,
      characterData: true,
    });
    observers.push(observer);
    listen(element, 'click', scheduleSync as EventListener);
    listen(element, 'change', scheduleSync as EventListener);
    listen(element, 'input', scheduleSync as EventListener);
  });

  const controller: MobileCommandSurfaceController = {
    openDrawer,
    openQuickControls,
    closeTop,
    sync,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearPendingPanelTimer();
      if (activeLayer) applyLayerState(null);
      consumeOwnedHistory();
      observers.forEach((observer) => observer.disconnect());
      cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
      documentRef.querySelectorAll<HTMLElement>('[data-mobile-command-injected="true"]')
        .forEach((element) => element.remove());
      documentRef.documentElement.classList.remove('mobile-command-surface-locked');
      documentRef.body.classList.remove('mobile-command-surface-locked');
      root.remove();
      controllers.delete(documentRef);
    },
  };

  controllers.set(documentRef, controller);
  sync();
  return controller;
}

export {
  setupMobileCommandSurface,
};

export type {
  MobileCommandSurfaceController,
  MobileCommandSurfaceSetupOptions,
};
