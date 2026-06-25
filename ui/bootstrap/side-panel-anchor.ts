interface SidePanelAnchorOptions {
  sidePanel: HTMLElement | null;
  sidePanelToggleBtn: HTMLElement | null;
  initialCollapsed?: boolean;
  root?: Window | null;
}

const SIDE_PANEL_TRANSITION_MS = 180;

type SidePanelElement = HTMLElement & {
  __sidePanelCloseTimer?: ReturnType<typeof setTimeout> | null;
};

function getFiniteRectSize(rect: DOMRect, key: 'width' | 'height', fallback: number): number {
  const value = Number(rect && rect[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolvePhonePortraitTargetRect(panelEl: HTMLElement, fallbackRect: DOMRect): DOMRect {
  const controlPanel = panelEl.querySelector<HTMLElement>('#control-panel');
  if (!controlPanel || typeof controlPanel.getBoundingClientRect !== 'function') return fallbackRect;

  const controlRect = controlPanel.getBoundingClientRect();
  if (
    Number.isFinite(controlRect.width) && controlRect.width > 0
    && Number.isFinite(controlRect.height) && controlRect.height > 0
  ) {
    return controlRect;
  }
  return fallbackRect;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function syncSidePanelAnchorPosition(panelEl: HTMLElement, toggleEl: HTMLElement, root: Window | null): void {
  if (!root) return;
  if (!panelEl.classList.contains('side-panel-collapsed')) {
    panelEl.style.left = '';
    panelEl.style.top = '';
    panelEl.style.right = '';
    panelEl.style.bottom = '';
    return;
  }
  if (typeof panelEl.getBoundingClientRect !== 'function' || typeof toggleEl.getBoundingClientRect !== 'function') return;

  const toggleRect = toggleEl.getBoundingClientRect();
  const panelRect = panelEl.getBoundingClientRect();
  if (!Number.isFinite(toggleRect.right) || !Number.isFinite(toggleRect.top)) return;

  const gapPx = 12;
  const viewportMargin = 12;
  const panelWidth = getFiniteRectSize(panelRect, 'width', 240);
  const panelHeight = getFiniteRectSize(panelRect, 'height', 280);
  const maxLeft = Math.max(viewportMargin, root.innerWidth - panelWidth - viewportMargin);
  const maxTop = Math.max(viewportMargin, root.innerHeight - panelHeight - viewportMargin);

  const docEl = root.document && root.document.documentElement ? root.document.documentElement : null;
  const layoutProfile = docEl ? String(docEl.getAttribute('data-layout-profile') || '') : '';
  const isPhonePortrait = !!docEl && (
    docEl.classList.contains('layout-profile-phone-portrait')
    || layoutProfile === 'layout-profile-phone-portrait'
  );

  if (isPhonePortrait) {
    const targetRect = resolvePhonePortraitTargetRect(panelEl, panelRect);
    const targetWidth = getFiniteRectSize(targetRect, 'width', panelWidth);
    const targetHeight = getFiniteRectSize(targetRect, 'height', panelHeight);
    const targetOffsetLeft = Number.isFinite(targetRect.left) && Number.isFinite(panelRect.left)
      ? targetRect.left - panelRect.left
      : 0;
    const targetOffsetTop = Number.isFinite(targetRect.top) && Number.isFinite(panelRect.top)
      ? targetRect.top - panelRect.top
      : 0;
    const minPanelLeft = viewportMargin - targetOffsetLeft;
    const minPanelTop = viewportMargin - targetOffsetTop;
    const maxPanelLeft = Math.max(minPanelLeft, root.innerWidth - targetWidth - targetOffsetLeft - viewportMargin);
    const maxPanelTop = Math.max(minPanelTop, root.innerHeight - targetHeight - targetOffsetTop - viewportMargin);
    const centeredLeft = clamp((root.innerWidth - targetWidth) * 0.5 - targetOffsetLeft, minPanelLeft, maxPanelLeft);
    const centeredTop = clamp((root.innerHeight - targetHeight) * 0.5 - targetOffsetTop, minPanelTop, maxPanelTop);
    panelEl.style.left = `${Math.round(centeredLeft)}px`;
    panelEl.style.top = `${Math.round(centeredTop)}px`;
    panelEl.style.right = 'auto';
    panelEl.style.bottom = 'auto';
    return;
  }

  const desiredLeft = toggleRect.right + gapPx;
  const desiredTop = toggleRect.top + (toggleRect.height * 0.5) - (panelHeight * 0.5);
  const anchoredLeft = Math.min(Math.max(viewportMargin, desiredLeft), maxLeft);
  const anchoredTop = Math.min(Math.max(viewportMargin, desiredTop), maxTop);

  panelEl.style.left = `${Math.round(anchoredLeft)}px`;
  panelEl.style.top = `${Math.round(anchoredTop)}px`;
  panelEl.style.right = 'auto';
  panelEl.style.bottom = 'auto';
}

function syncSidePanelToggleState(toggleEl: HTMLElement, collapsed: boolean): void {
  const isCollapsed = collapsed === true;
  const sidePanelToggleLabel = toggleEl.querySelector('.left-action-label') as HTMLElement | null;

  toggleEl.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  if (sidePanelToggleLabel) sidePanelToggleLabel.textContent = '設定';
  else toggleEl.textContent = '設定';
  toggleEl.classList.toggle('is-active', !isCollapsed);

  const label = isCollapsed ? '設定を開く' : '設定を閉じる';
  toggleEl.setAttribute('aria-label', label);
  toggleEl.title = label;
}

function applySidePanelCollapsedState(panelEl: HTMLElement, toggleEl: HTMLElement, collapsed: boolean, root: Window | null): void {
  const sidePanel = panelEl as SidePanelElement;
  const isCollapsed = collapsed === true;
  const wasCollapsed = panelEl.classList.contains('side-panel-collapsed');
  const wasOpen = panelEl.classList.contains('is-open') && !wasCollapsed;

  if (sidePanel.__sidePanelCloseTimer) {
    clearTimeout(sidePanel.__sidePanelCloseTimer);
    sidePanel.__sidePanelCloseTimer = null;
  }

  syncSidePanelToggleState(toggleEl, isCollapsed);

  if (!isCollapsed) {
    panelEl.style.visibility = '';
    panelEl.classList.remove('side-panel-collapsed', 'is-closing');
    panelEl.setAttribute('aria-hidden', 'false');
    syncSidePanelAnchorPosition(panelEl, toggleEl, root);
    const scheduleOpen = root && typeof root.requestAnimationFrame === 'function'
      ? root.requestAnimationFrame.bind(root)
      : (callback: FrameRequestCallback) => { callback(0); return 0; };
    scheduleOpen(() => {
      panelEl.classList.add('is-open');
    });
    return;
  }

  panelEl.classList.remove('is-open');
  panelEl.setAttribute('aria-hidden', 'true');
  if (wasCollapsed || !wasOpen) {
    panelEl.classList.add('side-panel-collapsed');
    panelEl.classList.remove('is-closing');
    panelEl.style.visibility = 'hidden';
    syncSidePanelAnchorPosition(panelEl, toggleEl, root);
    return;
  }

  panelEl.classList.add('is-closing');
  sidePanel.__sidePanelCloseTimer = setTimeout(() => {
    panelEl.classList.add('side-panel-collapsed');
    panelEl.classList.remove('is-closing');
    panelEl.style.visibility = 'hidden';
    sidePanel.__sidePanelCloseTimer = null;
    syncSidePanelAnchorPosition(panelEl, toggleEl, root);
  }, SIDE_PANEL_TRANSITION_MS);
}

function closeSidePanel(panelEl: HTMLElement, toggleEl: HTMLElement, root: Window | null): void {
  if (panelEl.classList.contains('side-panel-collapsed')) return;
  applySidePanelCollapsedState(panelEl, toggleEl, true, root);
}

function setupSidePanelAnchor(options: SidePanelAnchorOptions): void {
  const panelEl = options.sidePanel;
  const toggleEl = options.sidePanelToggleBtn;
  if (!panelEl || !toggleEl) return;

  const root = options.root || (typeof window !== 'undefined' ? window : null);
  const sync = (): void => syncSidePanelAnchorPosition(panelEl, toggleEl, root);

  applySidePanelCollapsedState(panelEl, toggleEl, options.initialCollapsed !== false, root);
  if (toggleEl.dataset.sidePanelToggleBound === '1') return;

  toggleEl.addEventListener('click', () => {
    applySidePanelCollapsedState(panelEl, toggleEl, panelEl.classList.contains('is-open'), root);
  });

  panelEl.addEventListener('click', (event: MouseEvent) => {
    if (event.target !== panelEl) return;
    closeSidePanel(panelEl, toggleEl, root);
  });

  if (root && toggleEl.dataset.sidePanelViewportBound !== '1') {
    root.addEventListener('resize', sync);
    root.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeSidePanel(panelEl, toggleEl, root);
    });
    toggleEl.dataset.sidePanelViewportBound = '1';
  }
  toggleEl.dataset.sidePanelToggleBound = '1';
}

export {
  applySidePanelCollapsedState,
  setupSidePanelAnchor,
  syncSidePanelAnchorPosition,
};
