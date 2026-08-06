function findDirectDiscChildByClass(disc: any, className: string): any {
  if (!disc || !disc.children) return null;
  for (const child of disc.children) {
    if (child && child.classList && child.classList.contains(className)) return child;
  }
  return null;
}

function resolveDiscOwnerDescriptor(owner: any) {
  const normalized = (owner === -1 || owner === 'white' || owner === '-1')
    ? 'white'
    : 'black';
  return normalized === 'white'
    ? {
      key: 'white',
      value: -1,
      className: 'white',
      baseImage: 'var(--normal-stone-white-image)',
      fallbackColor: '#ffffff'
    }
    : {
      key: 'black',
      value: 1,
      className: 'black',
      baseImage: 'var(--normal-stone-black-image)',
      fallbackColor: '#050505'
    };
}

function areStoneBaseImagesReady(): boolean {
  try {
    return !!(
      typeof document !== 'undefined'
      && document
      && document.documentElement
      && document.documentElement.classList
      && document.documentElement.classList.contains('stone-base-images-ready')
    );
  } catch (e: any) {
    return false;
  }
}

function resolveDiscImageState(renderState: any, baseImage: any): string {
  if (renderState && typeof renderState.imageState === 'string' && renderState.imageState) {
    return renderState.imageState;
  }
  const hasBaseImage = typeof baseImage === 'string' && baseImage.trim() && baseImage !== 'none';
  return (hasBaseImage && areStoneBaseImagesReady()) ? 'loaded' : 'fallback';
}

function ensureDiscSkeleton(disc: any) {
  if (!disc || typeof document === 'undefined' || typeof disc.appendChild !== 'function') {
    return { face: null, base: null, overlay: null, hud: null };
  }

  let face = findDirectDiscChildByClass(disc, 'disc__face');
  let hud = findDirectDiscChildByClass(disc, 'disc__hud');

  if (!face) {
    face = document.createElement('div');
    face.className = 'disc__face';
    if (disc.firstChild) disc.insertBefore(face, disc.firstChild);
    else disc.appendChild(face);
  }
  if (!hud) {
    hud = document.createElement('div');
    hud.className = 'disc__hud';
    disc.appendChild(hud);
  }

  let base = findDirectDiscChildByClass(face, 'disc__base-image');
  if (!base) {
    base = document.createElement('div');
    base.className = 'disc__base-image';
    face.appendChild(base);
  }

  let overlay = findDirectDiscChildByClass(face, 'disc__overlay-image');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'disc__overlay-image';
    face.appendChild(overlay);
  }

  const childrenToMove = [];
  for (const child of Array.from(disc.childNodes)) {
    if (child === face || child === hud) continue;
    childrenToMove.push(child);
  }
  for (const child of childrenToMove) {
    hud.appendChild(child);
  }

  return { face, base, overlay, hud };
}

function getDiscHudRoot(disc: any) {
  const skeleton = ensureDiscSkeleton(disc);
  return (skeleton && skeleton.hud) ? skeleton.hud : disc;
}

function applyDiscRenderState(disc: any, renderState: any = {}): void {
  if (!disc || !disc.style || typeof disc.style.setProperty !== 'function') return;

  const owner = (renderState.owner !== undefined && renderState.owner !== null)
    ? renderState.owner
    : (disc.classList && disc.classList.contains('white') ? -1 : 1);
  const ownerDescriptor = resolveDiscOwnerDescriptor(owner);
  const requestedRenderMode = renderState.renderMode || 'base-only';
  const baseImage = renderState.baseImage || ownerDescriptor.baseImage;
  const overlayImage = renderState.overlayImage || null;
  const overlayScale = Number(renderState.scale);
  const imageState = resolveDiscImageState(renderState, baseImage);
  const renderMode = ((requestedRenderMode === 'replace' || requestedRenderMode === 'overlay') && !overlayImage)
    ? 'base-only'
    : requestedRenderMode;
  const fallbackColor = imageState === 'fallback'
    ? (
      Object.prototype.hasOwnProperty.call(renderState, 'baseFallbackColor')
        ? renderState.baseFallbackColor
        : ownerDescriptor.fallbackColor
    )
    : 'transparent';

  ensureDiscSkeleton(disc);

  try { disc.dataset.renderMode = renderMode; } catch (e: any) { /* ignore */ }
  try { disc.dataset.effect = renderState.effectKey || 'normal'; } catch (e: any) { /* ignore */ }
  try { disc.dataset.imageState = imageState; } catch (e: any) { /* ignore */ }
  try { disc.style.setProperty('--disc-base-image', baseImage); } catch (e: any) { /* ignore */ }
  try { disc.style.setProperty('--stone-image', baseImage); } catch (e: any) { /* ignore */ }
  try { disc.style.setProperty('--disc-base-fallback-color', fallbackColor || 'transparent'); } catch (e: any) { /* ignore */ }
  try { disc.style.removeProperty('--disc-base-color'); } catch (e: any) { /* ignore */ }

  if (overlayImage) {
    try { disc.style.setProperty('--disc-overlay-image', overlayImage); } catch (e: any) { /* ignore */ }
    try { disc.style.setProperty('--special-stone-image', overlayImage); } catch (e: any) { /* ignore */ }
  } else {
    try { disc.style.removeProperty('--disc-overlay-image'); } catch (e: any) { /* ignore */ }
    try { disc.style.removeProperty('--special-stone-image'); } catch (e: any) { /* ignore */ }
  }

  if (Number.isFinite(overlayScale) && overlayScale > 0 && overlayScale !== 1) {
    try { disc.style.setProperty('--disc-overlay-scale', String(overlayScale)); } catch (e: any) { /* ignore */ }
  } else {
    try { disc.style.removeProperty('--disc-overlay-scale'); } catch (e: any) { /* ignore */ }
  }
}

function setDiscStoneImage(disc: any, value: any): void {
  applyDiscRenderState(disc, {
    owner: value,
    renderMode: 'base-only',
    effectKey: 'normal'
  });
}

export = {
  ensureDiscSkeleton,
  getDiscHudRoot,
  applyDiscRenderState,
  setDiscStoneImage
};
