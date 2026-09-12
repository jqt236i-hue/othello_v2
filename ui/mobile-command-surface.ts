import {
  MOBILE_PANEL_COMMANDS,
  getMobileCommand,
  getMobilePanelCommand,
} from './mobile-command-surface/config';
import type {
  MobileCommandLayer,
  MobileNativePanelId,
  MobilePanelCommandDefinition,
} from './mobile-command-surface/config';
import {
  createMobileControlProxyController,
} from './mobile-command-surface/control-proxies';
import {
  createMobileDomMutationScope,
} from './mobile-command-surface/dom-mutations';
import type {
  MobileDomMutationScope,
} from './mobile-command-surface/dom-mutations';
import {
  createMobileHistoryController,
} from './mobile-command-surface/history';
import {
  createMobileStatusBridge,
} from './mobile-command-surface/status-bridge';
import {
  IDLE_MOBILE_SURFACE_STATE,
  getActiveLayer,
  getActivePanelId,
  reduceMobileSurfaceState,
} from './mobile-command-surface/state';
import type {
  MobileSurfaceState,
} from './mobile-command-surface/state';
import {
  createMobileCommandSurfaceView,
} from './mobile-command-surface/view';

interface MobileCommandSurfaceSetupOptions {
  root?: Window | null;
  document?: Document | null;
  confirmReset?: (message: string) => boolean;
}

interface MobileCommandSurfaceController {
  openDrawer(): void;
  openBattleStatus(): void;
  openQuickControls(): void;
  closeTop(): boolean;
  sync(): void;
  destroy(): void;
}

interface NativePanelChromeEntry {
  panel: HTMLElement;
  header: HTMLElement | null;
  scope: MobileDomMutationScope;
}

const PHONE_PROFILE = 'layout-profile-phone-portrait';
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
  const panelChromeEntries = new Map<MobileNativePanelId, NativePanelChromeEntry>();
  const observedPanelElements = new Set<HTMLElement>();
  let state: MobileSurfaceState = IDLE_MOBILE_SURFACE_STATE;
  let pendingPanelTimer: number | null = null;
  let focusReturnTarget: HTMLElement | null = null;
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

  const view = createMobileCommandSurfaceView(rootRef, documentRef);
  const statusBridge = createMobileStatusBridge({
    root: rootRef,
    document: documentRef,
    view,
  });
  const historyController = createMobileHistoryController(rootRef);
  const proxyController = createMobileControlProxyController({
    root: rootRef,
    document: documentRef,
    view,
    confirmReset,
  });

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

  const rememberFocus = (): void => {
    const current = documentRef.activeElement as HTMLElement | null;
    focusReturnTarget = current && typeof current.focus === 'function' && current.isConnected
      ? current
      : view.menuTrigger;
  };

  const restoreFocus = (): void => {
    if (!focusReturnTarget) return;
    const target = focusReturnTarget.isConnected
      ? focusReturnTarget
      : view.menuTrigger;
    focusReturnTarget = null;
    requestFrame(() => target.focus({ preventScroll: true }));
  };

  const renderState = (): void => {
    const activeLayer = getActiveLayer(state);
    const activePanel = getActivePanelId(state);
    view.root.classList.toggle('is-drawer-open', activeLayer === 'drawer');
    view.root.classList.toggle('is-status-open', activeLayer === 'status');
    view.root.classList.toggle('is-quick-open', activeLayer === 'quick');
    view.root.classList.toggle('has-native-panel', activePanel !== null);
    view.menuTrigger.setAttribute('aria-expanded', String(activeLayer === 'drawer'));
    view.statusTrigger.setAttribute('aria-expanded', String(activeLayer === 'status'));
    view.quickTrigger.setAttribute('aria-expanded', String(activeLayer === 'quick'));

    const drawerOpen = activeLayer === 'drawer';
    view.drawer.setAttribute('aria-hidden', String(!drawerOpen));
    view.drawer.toggleAttribute('inert', !drawerOpen);
    const statusOpen = activeLayer === 'status';
    view.statusPanel.setAttribute('aria-hidden', String(!statusOpen));
    view.statusPanel.toggleAttribute('inert', !statusOpen);
    statusBridge.setOpen(statusOpen);
    const quickOpen = activeLayer === 'quick';
    view.quickSheet.setAttribute('aria-hidden', String(!quickOpen));
    view.quickSheet.toggleAttribute('inert', !quickOpen);
    view.backdrop.hidden = activeLayer === null;
    view.backdrop.setAttribute('aria-hidden', String(activeLayer === null));

    [view.menuTrigger, view.statusTrigger, view.quickTrigger].forEach((trigger) => {
      const hidden = activePanel !== null;
      trigger.toggleAttribute('inert', hidden);
      trigger.setAttribute('aria-hidden', String(hidden));
    });

    const locked = isPhonePortrait() && (activeLayer !== null || activePanel !== null);
    documentRef.documentElement.classList.toggle('mobile-command-surface-locked', locked);
    documentRef.body.classList.toggle('mobile-command-surface-locked', locked);
  };

  const clearPendingPanelTimer = (): void => {
    if (pendingPanelTimer === null) return;
    rootRef.clearTimeout(pendingPanelTimer);
    pendingPanelTimer = null;
  };

  const restoreNativePanelChrome = (panelId: MobileNativePanelId): void => {
    const entry = panelChromeEntries.get(panelId);
    if (!entry) return;
    entry.scope.restore();
    panelChromeEntries.delete(panelId);
  };

  const restoreAllNativePanelChrome = (): void => {
    Array.from(panelChromeEntries.keys()).forEach(restoreNativePanelChrome);
  };

  const applyHelpFilterState = (
    scope: MobileDomMutationScope,
    layout: HTMLElement,
    toggle: HTMLButtonElement,
  ): void => {
    scope.setClass(layout, 'is-mobile-filters-collapsed', helpFiltersCollapsed);
    scope.setAttribute(toggle, 'aria-expanded', String(!helpFiltersCollapsed));
  };

  const ensureHelpFilterToggle = (scope: MobileDomMutationScope): void => {
    const layout = byId('rules-help-catalog-layout');
    const controls = byId('rules-help-catalog-controls');
    if (!layout || !controls) return;

    let toggle = byId<HTMLButtonElement>('mobile-command-help-filter-toggle');
    if (!toggle) {
      toggle = scope.ownNode(make('button', 'mobile-command-help-filter-toggle'));
      toggle.id = 'mobile-command-help-filter-toggle';
      toggle.type = 'button';
      toggle.textContent = '検索・絞り込み';
      toggle.setAttribute('aria-controls', controls.id);
      controls.parentElement?.insertBefore(toggle, controls);
    }
    scope.listen(toggle, 'click', (() => {
      helpFiltersCollapsed = !helpFiltersCollapsed;
      applyHelpFilterState(scope, layout, toggle!);
    }) as EventListener);
    applyHelpFilterState(scope, layout, toggle);
  };

  const expectedPanelHeader = (
    command: MobilePanelCommandDefinition,
  ): HTMLElement | null => byId(command.chrome.headerElementId);

  const ensureNativePanelChrome = (panelId: MobileNativePanelId): void => {
    if (!isPhonePortrait()) return;
    const command = getMobilePanelCommand(panelId);
    const panel = byId(command.panelElementId);
    if (!panel) return;

    const currentHeader = expectedPanelHeader(command);
    const existingEntry = panelChromeEntries.get(panelId);
    if (
      existingEntry
      && existingEntry.panel === panel
      && currentHeader !== null
      && existingEntry.header === currentHeader
    ) {
      return;
    }
    restoreNativePanelChrome(panelId);

    const scope = createMobileDomMutationScope();
    scope.setClass(panel, 'mobile-command-native-panel', true);
    scope.setAttribute(panel, 'role', 'dialog');
    scope.setAttribute(panel, 'aria-modal', 'true');

    let header: HTMLElement | null = currentHeader;
    if (command.chrome.kind === 'inject') {
      const container = byId(command.chrome.containerElementId);
      if (container && !header) {
        header = scope.ownNode(make('div', 'mobile-command-native-header'));
        header.id = command.chrome.headerElementId;
        const title = make('h2', 'mobile-command-native-title');
        title.textContent = command.panelLabel;
        const current = make('span', 'mobile-command-current-location');
        current.textContent = `メニュー / ${command.panelLabel}`;
        current.setAttribute('aria-label', `現在位置 ${command.panelLabel}`);
        const close = make('button', 'mobile-command-native-close');
        close.type = 'button';
        close.setAttribute('aria-label', `${command.panelLabel}を閉じる`);
        close.textContent = '×';
        scope.listen(close, 'click', (() => byId(command.closeButtonId)?.click()) as EventListener);
        header.append(title, current, close);
        container.prepend(header);
      }
    } else if (header) {
      scope.setClass(header, 'mobile-command-native-header', true);
      const close = byId(command.closeButtonId);
      if (close) scope.setClass(close, 'mobile-command-native-close', true);
      if (!header.querySelector('.mobile-command-current-location')) {
        const current = scope.ownNode(make('span', 'mobile-command-current-location'));
        current.textContent = `メニュー / ${command.panelLabel}`;
        current.setAttribute('aria-label', `現在位置 ${command.panelLabel}`);
        const closeInHeader = close && close.parentElement === header ? close : null;
        if (closeInHeader) header.insertBefore(current, closeInHeader);
        else header.appendChild(current);
      }
    }

    if (panelId === 'help') ensureHelpFilterToggle(scope);
    panelChromeEntries.set(panelId, { panel, header, scope });
  };

  const isNativePanelOpen = (panelId: MobileNativePanelId): boolean => {
    const panel = byId(getMobilePanelCommand(panelId).panelElementId);
    if (!panel) return false;
    return panel.classList.contains('is-open') || panel.getAttribute('aria-hidden') === 'false';
  };

  const findOpenNativePanel = (): MobileNativePanelId | null => (
    MOBILE_PANEL_COMMANDS.find((command) => isNativePanelOpen(command.id))?.id || null
  );

  const closeNativePanel = (panelId: MobileNativePanelId): void => {
    byId(getMobilePanelCommand(panelId).closeButtonId)?.click();
  };

  let scheduleSync = (): void => {};
  const panelObserver = new rootRef.MutationObserver(() => scheduleSync());

  const observePanel = (command: MobilePanelCommandDefinition): void => {
    const panel = byId(command.panelElementId);
    if (!panel || observedPanelElements.has(panel)) return;
    observedPanelElements.add(panel);
    panelObserver.observe(panel, {
      attributes: true,
      attributeFilter: ['class', 'aria-hidden'],
    });
  };

  const syncNativePanels = (): void => {
    MOBILE_PANEL_COMMANDS.forEach(observePanel);
    const openPanel = findOpenNativePanel();
    if (openPanel && isPhonePortrait()) ensureNativePanelChrome(openPanel);

    const previousState = state;
    state = reduceMobileSurfaceState(state, {
      type: 'SYNC_PANEL',
      panelId: openPanel,
    });

    if (
      previousState.kind === 'panel-pending'
      && state.kind === 'panel-open'
      && state.origin === 'mobile'
    ) {
      clearPendingPanelTimer();
      historyController.promote(`panel:${state.panelId}`);
    }

    if (previousState.kind === 'panel-open' && state.kind === 'idle') {
      if (previousState.origin === 'mobile') {
        if (historyController.owns(`panel:${previousState.panelId}`)) {
          historyController.consume();
        }
        restoreFocus();
      }
    }

    if (
      previousState.kind === 'layer'
      && state.kind === 'panel-open'
      && state.origin === 'external'
    ) {
      historyController.consume();
      focusReturnTarget = null;
    }

    renderState();
  };

  const sync = (): void => {
    if (destroyed) return;
    syncQueued = false;
    proxyController.sync();
    statusBridge.sync();
    syncNativePanels();
  };

  scheduleSync = (): void => {
    if (syncQueued || destroyed) return;
    syncQueued = true;
    requestFrame(sync);
  };

  MOBILE_PANEL_COMMANDS.forEach(observePanel);

  const closeCustomLayer = (consumeHistory = true, returnFocus = true): void => {
    if (state.kind !== 'layer') return;
    state = reduceMobileSurfaceState(state, { type: 'CLOSE_LAYER' });
    renderState();
    if (consumeHistory) historyController.consume();
    if (returnFocus) restoreFocus();
  };

  const cancelPendingPanel = (consumeHistory = true, returnFocus = true): void => {
    if (state.kind !== 'panel-pending') return;
    clearPendingPanelTimer();
    state = reduceMobileSurfaceState(state, { type: 'CANCEL_PENDING' });
    renderState();
    if (consumeHistory) historyController.consume();
    if (returnFocus) restoreFocus();
  };

  const focusOpenLayer = (): void => {
    const activeLayer = getActiveLayer(state);
    const layer = activeLayer === 'drawer'
      ? view.drawer
      : activeLayer === 'status'
        ? view.statusPanel
        : activeLayer === 'quick'
          ? view.quickSheet
          : null;
    getFocusable(layer)[0]?.focus({ preventScroll: true });
  };

  const openLayer = (layer: MobileCommandLayer): void => {
    if (!isPhonePortrait() || state.kind === 'panel-open' || state.kind === 'panel-pending') return;
    if (state.kind === 'layer' && state.layer === layer) return;
    if (state.kind === 'idle') rememberFocus();
    if (layer === 'quick') proxyController.sync();
    state = reduceMobileSurfaceState(state, { type: 'OPEN_LAYER', layer });
    renderState();
    historyController.promote(layer);
    requestFrame(focusOpenLayer);
  };

  const openDrawer = (): void => openLayer('drawer');
  const openBattleStatus = (): void => openLayer('status');
  const openQuickControls = (): void => openLayer('quick');

  const openNativePanel = (panelId: MobileNativePanelId): void => {
    if (!isPhonePortrait()) return;
    const command = getMobilePanelCommand(panelId);
    const trigger = byId(command.triggerId);
    if (!trigger) return;

    focusReturnTarget = view.menuTrigger;
    state = reduceMobileSurfaceState(state, { type: 'BEGIN_PANEL', panelId });
    renderState();
    clearPendingPanelTimer();
    trigger.click();
    observePanel(command);
    scheduleSync();
    pendingPanelTimer = rootRef.setTimeout(() => {
      if (
        state.kind !== 'panel-pending'
        || state.panelId !== panelId
        || isNativePanelOpen(panelId)
      ) {
        return;
      }
      pendingPanelTimer = null;
      cancelPendingPanel();
    }, 1200);
  };

  const closeTop = (): boolean => {
    if (!isPhonePortrait()) return false;
    if (state.kind === 'layer') {
      closeCustomLayer();
      return true;
    }
    if (state.kind === 'panel-pending') {
      cancelPendingPanel();
      return true;
    }
    if (state.kind === 'panel-open') {
      closeNativePanel(state.panelId);
      scheduleSync();
      return true;
    }
    return false;
  };

  listen(view.menuTrigger, 'click', openDrawer as EventListener);
  listen(view.statusTrigger, 'click', openBattleStatus as EventListener);
  listen(view.quickTrigger, 'click', openQuickControls as EventListener);
  listen(view.drawerClose, 'click', (() => closeCustomLayer()) as EventListener);
  listen(view.statusClose, 'click', (() => closeCustomLayer()) as EventListener);
  listen(view.quickClose, 'click', (() => closeCustomLayer()) as EventListener);
  listen(view.backdrop, 'pointerdown', (() => closeCustomLayer()) as EventListener);

  view.menuButtons.forEach((button) => {
    listen(button, 'click', (() => {
      const commandId = button.dataset.mobileCommand;
      const command = commandId ? getMobileCommand(commandId) : null;
      if (!command) return;
      if (command.kind === 'panel') {
        openNativePanel(command.id);
        return;
      }
      state = reduceMobileSurfaceState(state, { type: 'CLOSE_LAYER' });
      renderState();
      historyController.consume();
      focusReturnTarget = view.menuTrigger;
      byId(command.triggerId)?.click();
      restoreFocus();
    }) as EventListener);
  });

  listen(documentRef, 'keydown', ((event: KeyboardEvent) => {
    if (!isPhonePortrait()) return;
    // The active observation theatre owns Escape and Tab until its reveal settles.
    const eventTarget = event.target as HTMLElement | null;
    if (eventTarget?.closest?.('#gachaRevealStage.is-active')) return;
    if (event.key === 'Escape' && closeTop()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const activeLayer = getActiveLayer(state);
    if (event.key !== 'Tab' || activeLayer === null) return;
    const layer = activeLayer === 'drawer'
      ? view.drawer
      : activeLayer === 'status'
        ? view.statusPanel
        : view.quickSheet;
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
    if (!historyController.releaseOnPop()) return;
    clearPendingPanelTimer();
    if (state.kind === 'layer') {
      closeCustomLayer(false);
      return;
    }
    if (state.kind === 'panel-pending') {
      cancelPendingPanel(false);
      return;
    }
    if (state.kind === 'panel-open' && state.origin === 'mobile') {
      closeNativePanel(state.panelId);
      scheduleSync();
    }
  }) as EventListener);

  const handleProfileChange = (): void => {
    statusBridge.sync();
    if (isPhonePortrait()) {
      scheduleSync();
      return;
    }

    restoreAllNativePanelChrome();
    if (state.kind === 'layer') {
      focusReturnTarget = null;
      closeCustomLayer(true, false);
    } else if (state.kind === 'panel-pending') {
      focusReturnTarget = null;
      cancelPendingPanel(true, false);
    } else if (state.kind === 'panel-open' && state.origin === 'mobile') {
      focusReturnTarget = null;
      historyController.consume();
      closeNativePanel(state.panelId);
      scheduleSync();
    }
    renderState();
  };

  listen(rootRef, 'resize', handleProfileChange as EventListener, { passive: true });
  listen(rootRef, 'orientationchange', handleProfileChange as EventListener, { passive: true });

  const profileObserver = new rootRef.MutationObserver(handleProfileChange);
  profileObserver.observe(documentRef.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-layout-profile'],
  });

  const controller: MobileCommandSurfaceController = {
    openDrawer,
    openBattleStatus,
    openQuickControls,
    closeTop,
    sync,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearPendingPanelTimer();
      historyController.consume();
      panelObserver.disconnect();
      profileObserver.disconnect();
      proxyController.destroy();
      statusBridge.destroy();
      cleanupCallbacks.splice(0).reverse().forEach((cleanup) => cleanup());
      restoreAllNativePanelChrome();
      documentRef.documentElement.classList.remove('mobile-command-surface-locked');
      documentRef.body.classList.remove('mobile-command-surface-locked');
      view.destroy();
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
