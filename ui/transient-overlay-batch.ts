type OverlayRootOptions = {
  className?: string;
  zIndex?: number;
};

function createTransientOverlayBatch(options?: { documentRef?: Document | null }) {
  const documentRef = options && options.documentRef
    ? options.documentRef
    : (typeof document !== 'undefined' ? document : null);
  let root: HTMLElement | null = null;

  function getRoot(rootOptions?: OverlayRootOptions): HTMLElement | null {
    if (!documentRef || !documentRef.body) return null;
    if (root && root.parentElement) return root;

    root = documentRef.createElement('div');
    root.className = (rootOptions && rootOptions.className) || 'transient-overlay-batch';
    root.setAttribute('aria-hidden', 'true');
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.width = '100vw';
    root.style.height = '100vh';
    root.style.pointerEvents = 'none';
    root.style.overflow = 'hidden';
    root.style.zIndex = String((rootOptions && Number.isFinite(rootOptions.zIndex)) ? rootOptions.zIndex : 1250);
    documentRef.body.appendChild(root);
    return root;
  }

  function append(element: HTMLElement): boolean {
    const targetRoot = getRoot();
    if (!targetRoot || !element) return false;
    targetRoot.appendChild(element);
    return true;
  }

  function cleanup(): boolean {
    if (root && root.parentElement) root.parentElement.removeChild(root);
    root = null;
    return true;
  }

  return { getRoot, append, cleanup };
}

const TransientOverlayBatch = {
  createTransientOverlayBatch
};

try {
  if (typeof globalThis !== 'undefined' && globalThis) {
    (globalThis as any).TransientOverlayBatch = (globalThis as any).TransientOverlayBatch || TransientOverlayBatch;
  }
} catch (e) { /* ignore */ }

export = TransientOverlayBatch;
