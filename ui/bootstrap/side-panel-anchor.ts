interface SidePanelAnchorOptions {
  sidePanel: HTMLElement | null;
  sidePanelToggleBtn: HTMLElement | null;
  initialCollapsed?: boolean;
  root?: Window | null;
}

function syncSidePanelAnchorPosition(panelEl: HTMLElement, toggleEl: HTMLElement, root: Window | null): void {
  if (!root) return;
  if (typeof panelEl.getBoundingClientRect !== 'function' || typeof toggleEl.getBoundingClientRect !== 'function') return;

  const toggleRect = toggleEl.getBoundingClientRect();
  const panelRect = panelEl.getBoundingClientRect();
  if (!Number.isFinite(toggleRect.right) || !Number.isFinite(toggleRect.top)) return;

  const gapPx = 12;
  const viewportMargin = 12;
  const panelWidth = Number.isFinite(panelRect.width) && panelRect.width > 0 ? panelRect.width : 240;
  const panelHeight = Number.isFinite(panelRect.height) && panelRect.height > 0 ? panelRect.height : 280;
  const desiredLeft = toggleRect.right + gapPx;
  const desiredTop = toggleRect.top + (toggleRect.height * 0.5) - (panelHeight * 0.5);
  const maxLeft = Math.max(viewportMargin, root.innerWidth - panelWidth - viewportMargin);
  const maxTop = Math.max(viewportMargin, root.innerHeight - panelHeight - viewportMargin);
  const anchoredLeft = Math.min(Math.max(viewportMargin, desiredLeft), maxLeft);
  const anchoredTop = Math.min(Math.max(viewportMargin, desiredTop), maxTop);

  panelEl.style.left = `${Math.round(anchoredLeft)}px`;
  panelEl.style.top = `${Math.round(anchoredTop)}px`;
  panelEl.style.right = 'auto';
  panelEl.style.bottom = 'auto';
}

function applySidePanelCollapsedState(panelEl: HTMLElement, toggleEl: HTMLElement, collapsed: boolean, root: Window | null): void {
  const isCollapsed = collapsed === true;
  const sidePanelToggleLabel = toggleEl.querySelector('.left-action-label') as HTMLElement | null;

  panelEl.classList.toggle('side-panel-collapsed', isCollapsed);
  toggleEl.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  if (sidePanelToggleLabel) sidePanelToggleLabel.textContent = '設定';
  else toggleEl.textContent = '設定';
  toggleEl.classList.toggle('is-active', !isCollapsed);

  const label = isCollapsed ? '設定を開く' : '設定を閉じる';
  toggleEl.setAttribute('aria-label', label);
  toggleEl.title = label;
  syncSidePanelAnchorPosition(panelEl, toggleEl, root);
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
    applySidePanelCollapsedState(panelEl, toggleEl, !panelEl.classList.contains('side-panel-collapsed'), root);
  });

  if (root && toggleEl.dataset.sidePanelViewportBound !== '1') {
    root.addEventListener('resize', sync);
    toggleEl.dataset.sidePanelViewportBound = '1';
  }
  toggleEl.dataset.sidePanelToggleBound = '1';
}

export {
  applySidePanelCollapsedState,
  setupSidePanelAnchor,
  syncSidePanelAnchorPosition,
};
