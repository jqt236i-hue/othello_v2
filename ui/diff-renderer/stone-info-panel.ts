export function ensureStoneInfoPanel(doc: Document): HTMLElement | null {
  if (!doc) return null;
  let panel = doc.getElementById('stone-info-panel') as HTMLElement | null;
  if (panel) return panel;

  panel = doc.createElement('div');
  panel.id = 'stone-info-panel';
  panel.className = 'stone-info-panel';
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-atomic', 'true');
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = [
    '<div id="stone-info-name" class="stone-info-name"></div>',
    '<div id="stone-info-desc" class="stone-info-desc"></div>',
    '<div id="stone-info-meta" class="stone-info-meta is-empty"></div>'
  ].join('');

  const manifestPanel = doc.getElementById('manifest-effect-panel');
  const effectPanel = doc.getElementById('effect-live-panel');
  if (manifestPanel && manifestPanel.parentNode) {
    manifestPanel.parentNode.insertBefore(panel, manifestPanel);
  } else if (effectPanel && effectPanel.parentNode) {
    effectPanel.parentNode.insertBefore(panel, effectPanel.nextSibling);
  } else {
    doc.body.appendChild(panel);
  }
  return panel;
}

export function hideStoneInfoPanel(doc: Document): boolean {
  const panel = doc ? doc.getElementById('stone-info-panel') : null;
  if (!panel) return false;
  panel.classList.remove('visible');
  panel.setAttribute('aria-hidden', 'true');
  return true;
}

export function isHoverPointerEvent(root: any, ev: any): boolean {
  if (ev && ev.pointerType === 'touch') return false;
  if (ev && (ev.pointerType === 'mouse' || ev.pointerType === 'pen')) return true;
  try {
    if (root && typeof root.matchMedia === 'function') {
      return root.matchMedia('(hover: hover)').matches;
    }
  } catch (e: any) { /* ignore */ }
  return true;
}

export function isTouchStoneInfoEvent(root: any, ev: any): boolean {
  if (ev && ev.pointerType === 'touch') return true;
  try {
    if (root && typeof root.matchMedia === 'function') {
      return root.matchMedia('(hover: none)').matches;
    }
  } catch (e: any) { /* ignore */ }
  return false;
}

export function attachStoneInfoPanelDismissHandlers(doc: Document, options: any = {}): void {
  if (!doc || (doc as any).__stoneInfoPanelDismissBound === true) return;
  (doc as any).__stoneInfoPanelDismissBound = true;
  if (typeof options.bindTagAutoDismiss === 'function') {
    try { options.bindTagAutoDismiss(); } catch (e: any) { /* ignore */ }
  }
  doc.addEventListener('pointerdown', (ev: PointerEvent) => {
    const panel = doc.getElementById('stone-info-panel');
    if (!panel || !panel.classList.contains('visible')) return;
    const target = ev.target as Node | null;
    if (panel.contains(target)) return;
    const board = doc.getElementById('board');
    if (board && board.contains(target)) return;
    if (typeof options.hideStoneInfoPanel === 'function') {
      options.hideStoneInfoPanel();
    }
  }, true);
}

module.exports = {
  ensureStoneInfoPanel,
  hideStoneInfoPanel,
  isHoverPointerEvent,
  isTouchStoneInfoEvent,
  attachStoneInfoPanelDismissHandlers
};
