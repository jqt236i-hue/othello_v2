'use strict';

const SURFACE_ID = 'network-presentation-reload-required';

function resolveDocument(root: any): Document | null {
  if (root && root.document) return root.document;
  try { return typeof document !== 'undefined' ? document : null; } catch (e) { return null; }
}

function clearReloadRequiredSurface(root?: any): boolean {
  const doc = resolveDocument(root);
  const current = doc && doc.getElementById(SURFACE_ID);
  if (!current || !current.parentNode) return false;
  current.parentNode.removeChild(current);
  return true;
}

function showReloadRequiredSurface(options?: any): HTMLElement | null {
  const opts = options && typeof options === 'object' ? options : {};
  const root = opts.root || (typeof window !== 'undefined' ? window : null);
  const doc = resolveDocument(root);
  if (!doc) return null;
  clearReloadRequiredSurface(root);

  const surface = doc.createElement('section');
  surface.id = SURFACE_ID;
  surface.className = 'network-presentation-recovery-alert';
  surface.setAttribute('role', 'alert');
  surface.setAttribute('aria-live', 'assertive');
  surface.setAttribute('data-reload-required', 'true');

  const message = doc.createElement('p');
  message.className = 'network-presentation-recovery-message';
  message.textContent = String(opts.message || '盤面表示を復旧できませんでした。再試行するか、ページを再読み込みしてください。');
  surface.appendChild(message);

  const actions = doc.createElement('div');
  actions.className = 'network-presentation-recovery-actions';
  if (typeof opts.onRetry === 'function') {
    const retryButton = doc.createElement('button');
    retryButton.type = 'button';
    retryButton.textContent = '再試行';
    retryButton.setAttribute('data-presentation-retry', 'true');
    retryButton.addEventListener('click', () => {
      retryButton.disabled = true;
      Promise.resolve(opts.onRetry())
        .catch(() => undefined)
        .finally(() => { retryButton.disabled = false; });
    });
    actions.appendChild(retryButton);
  }

  const reloadButton = doc.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = '再読み込み';
  reloadButton.setAttribute('data-presentation-reload', 'true');
  reloadButton.addEventListener('click', () => {
    try {
      if (root && root.location && typeof root.location.reload === 'function') root.location.reload();
    } catch (e) { /* the browser owns reload failures */ }
  });
  actions.appendChild(reloadButton);
  surface.appendChild(actions);

  const host = doc.getElementById('game-container') || doc.body;
  if (!host) return null;
  host.appendChild(surface);
  return surface;
}

export = {
  SURFACE_ID,
  showReloadRequiredSurface,
  clearReloadRequiredSurface
};
