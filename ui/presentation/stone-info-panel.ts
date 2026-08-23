function ensureStoneInfoListShell(panel: HTMLElement): void {
  const title = panel.querySelector('#stone-info-list-title');
  const instruction = panel.querySelector('#stone-info-list-instruction');
  const list = panel.querySelector('#stone-info-list');
  if (title && instruction && list) return;

  panel.innerHTML = [
    '<div id="stone-info-list-title" class="stone-info-name">盤上の石</div>',
    '<div id="stone-info-list-instruction" class="stone-info-desc">石を選ぶと情報を表示</div>',
    '<div id="stone-info-list" class="stone-info-list" role="group" aria-label="盤上の石"></div>'
  ].join('');
}

function attachStoneInfoListWheelHandler(list: HTMLElement): void {
  if (list.dataset.stoneInfoWheelBound === '1') return;
  list.dataset.stoneInfoWheelBound = '1';
  list.addEventListener('wheel', (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) return;
    if (!Number.isFinite(event.deltaY) || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const maxScrollLeft = Math.max(0, list.scrollWidth - list.clientWidth);
    if (maxScrollLeft <= 0) return;
    const deltaScale = event.deltaMode === 1
      ? 16
      : (event.deltaMode === 2 ? Math.max(1, list.clientWidth) : 1);
    const currentScrollLeft = Math.min(maxScrollLeft, Math.max(0, list.scrollLeft));
    const nextScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, currentScrollLeft + (event.deltaY * deltaScale))
    );
    if (nextScrollLeft === currentScrollLeft) return;

    list.scrollLeft = nextScrollLeft;
    event.preventDefault();
  }, { passive: false });
}

export function ensureStoneInfoPanel(doc: Document): HTMLElement | null {
  if (!doc) return null;
  let panel = doc.getElementById('stone-info-panel') as HTMLElement | null;
  if (!panel) {
    panel = doc.createElement('div');
    panel.id = 'stone-info-panel';
    panel.className = 'stone-info-panel';
    const manifestPanel = doc.getElementById('manifest-effect-panel');
    const effectPanel = doc.getElementById('effect-live-panel');
    if (manifestPanel && manifestPanel.parentNode) {
      manifestPanel.parentNode.insertBefore(panel, manifestPanel.nextSibling);
    } else if (effectPanel && effectPanel.parentNode) {
      effectPanel.parentNode.insertBefore(panel, effectPanel.nextSibling);
    } else {
      doc.body.appendChild(panel);
    }
  }
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-atomic', 'true');
  panel.setAttribute('aria-hidden', 'false');
  ensureStoneInfoListShell(panel);
  const list = panel.querySelector('#stone-info-list') as HTMLElement | null;
  if (list) attachStoneInfoListWheelHandler(list);
  return panel;
}

export function ensureStoneInfoDetailPanel(doc: Document): HTMLElement | null {
  if (!doc) return null;
  let backdrop = doc.getElementById('stone-info-detail-backdrop') as HTMLElement | null;
  if (!backdrop) {
    backdrop = doc.createElement('div');
    backdrop.id = 'stone-info-detail-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(backdrop);
  }

  let detail = doc.getElementById('stone-info-detail-panel') as HTMLElement | null;
  if (!detail) {
    detail = doc.createElement('div');
    detail.id = 'stone-info-detail-panel';
    detail.setAttribute('role', 'dialog');
    detail.setAttribute('aria-modal', 'true');
    detail.setAttribute('aria-hidden', 'true');
    detail.setAttribute('aria-labelledby', 'stone-info-name');
    detail.tabIndex = -1;
    detail.innerHTML = [
      '<div id="stone-info-detail-header">',
      '  <div id="stone-info-name" class="stone-info-name">石情報</div>',
      '  <button id="stone-info-detail-close-btn" type="button" aria-label="石情報を閉じる">×</button>',
      '</div>',
      '<div id="stone-info-detail-content">',
      '  <img id="stone-info-detail-image" alt="" aria-hidden="true">',
      '  <div id="stone-info-detail-copy">',
      '    <div id="stone-info-desc" class="stone-info-desc"></div>',
      '    <div id="stone-info-meta" class="stone-info-meta is-empty"></div>',
      '  </div>',
      '</div>'
    ].join('');
    doc.body.appendChild(detail);
  }
  return detail;
}

export function attachStoneInfoDetailDismissHandlers(doc: Document, options: any = {}): void {
  if (!doc || (doc as any).__stoneInfoDetailDismissBound === true) return;
  (doc as any).__stoneInfoDetailDismissBound = true;

  doc.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target) return;
    if (
      target.id === 'stone-info-detail-backdrop'
      || target.closest('#stone-info-detail-close-btn')
    ) {
      options.hideStoneInfoDetailPanel?.();
    }
  });
  doc.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    options.hideStoneInfoDetailPanel?.();
  });
}

module.exports = {
  ensureStoneInfoPanel,
  ensureStoneInfoDetailPanel,
  attachStoneInfoDetailDismissHandlers
};
