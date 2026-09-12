'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function createStaticElement(docRef: Document, tagName: string, className?: string, text?: string): HTMLElement {
  const element = docRef.createElement(tagName);
  if (className) element.className = className;
  if (typeof text === 'string') element.textContent = text;
  return element;
}

function resolveGachaItemVisualsModule(): any {
  try {
    return _require('./gacha-item-visuals');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaItemVisualsModule) {
      return (globalThis as any).GachaItemVisualsModule;
    }
  } catch (e) { /* ignore */ }
  throw new Error('GachaItemVisualsModule is required before building the gacha reveal stage.');
}

function createParticleRow(docRef: Document, container: HTMLElement, className: string, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const particle = docRef.createElement('span');
    particle.className = className;
    particle.style.setProperty('--gacha-particle-index', String(i));
    container.appendChild(particle);
  }
}

function bindPreviewRecovery(image: HTMLImageElement, fallback: HTMLElement): void {
  image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; });
  image.addEventListener('load', () => { image.hidden = false; fallback.hidden = true; });
}

interface StageRefs {
  stage: HTMLElement;
  skipBtn: HTMLElement | null;
  headline: Element | null;
  subtitle: Element | null;
  hero: Element | null;
  heroRarity: Element | null;
  heroImage: Element | null;
  heroFallback: Element | null;
  heroKind: Element | null;
  heroName: Element | null;
  heroStatus: Element | null;
  grid: Element | null;
  canvas: HTMLCanvasElement | null;
  progress: Element | null;
}

function ensureGachaRevealStage(docRef: Document, overlay: HTMLElement): StageRefs | null {
  if (!docRef || !overlay) return null;
  const itemVisuals = resolveGachaItemVisualsModule();

  let stage = docRef.getElementById('gachaRevealStage');
  if (!stage) {
    stage = docRef.createElement('div');
    stage.id = 'gachaRevealStage';
    stage.setAttribute('aria-hidden', 'true');
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-label', '観測ガチャの演出');

    const canvas = docRef.createElement('canvas');
    canvas.className = 'gacha-reveal-cosmos';
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);
    const masthead = createStaticElement(docRef, 'div', 'gacha-reveal-masthead');
    masthead.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-seal', '✦'));
    masthead.appendChild(createStaticElement(docRef, 'span', '', '観測ガチャ'));
    masthead.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-edition', 'THE OBSERVATORY'));
    stage.appendChild(masthead);

    const skipBtn = createStaticElement(docRef, 'button', 'btn-small', 'SKIP');
    skipBtn.id = 'gachaRevealSkipBtn';
    (skipBtn as HTMLButtonElement).type = 'button';
    skipBtn.setAttribute('aria-label', 'ガチャ演出をスキップ');
    stage.appendChild(skipBtn);

    const viewport = createStaticElement(docRef, 'div', 'gacha-reveal-viewport');
    stage.appendChild(viewport);

    const backdrop = createStaticElement(docRef, 'div', 'gacha-reveal-backdrop');
    viewport.appendChild(backdrop);

    const particles = createStaticElement(docRef, 'div', 'gacha-reveal-particles');
    particles.setAttribute('aria-hidden', 'true');
    createParticleRow(docRef, particles, 'gacha-reveal-particle', 24);
    viewport.appendChild(particles);

    const rings = createStaticElement(docRef, 'div', 'gacha-reveal-rings');
    rings.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-aurora'));
    rings.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-ring gacha-reveal-ring-a'));
    rings.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-ring gacha-reveal-ring-b'));
    rings.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-ring gacha-reveal-ring-c'));
    const core = createStaticElement(docRef, 'span', 'gacha-reveal-core');
    core.appendChild(createStaticElement(docRef, 'i', 'gacha-reveal-core-facet'));
    rings.appendChild(core);
    rings.setAttribute('aria-hidden', 'true');
    viewport.appendChild(rings);

    const impact = createStaticElement(docRef, 'div', 'gacha-reveal-impact');
    impact.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-impact-flash'));
    impact.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-impact-ray'));
    impact.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-impact-halo'));
    viewport.appendChild(impact);

    const copy = createStaticElement(docRef, 'div', 'gacha-reveal-copy');
    copy.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-label', '運命の、その先へ。'));
    copy.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-headline', '観測が収束しています'));
    copy.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-subtitle', '星の光を集めています'));
    copy.setAttribute('aria-live', 'polite');
    viewport.appendChild(copy);

    const hero = createStaticElement(docRef, 'div', 'gacha-reveal-hero');
    const heroImageWrap = createStaticElement(docRef, 'div', 'gacha-reveal-hero-image-wrap');
    heroImageWrap.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-hero-orbit'));
    const heroImage = docRef.createElement('img');
    heroImage.className = 'gacha-reveal-hero-image';
    heroImage.alt = '';
    heroImage.loading = 'eager';
    heroImage.decoding = 'async';
    heroImage.draggable = false;
    heroImageWrap.appendChild(heroImage);
    const heroFallback = itemVisuals.createHandFallbackTile(docRef, 'gacha-reveal-hero-fallback');
    heroImageWrap.appendChild(heroFallback);
    bindPreviewRecovery(heroImage, heroFallback);
    hero.appendChild(heroImageWrap);
    const heroInfo = createStaticElement(docRef, 'div', 'gacha-reveal-hero-info');
    heroInfo.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-hero-kind'));
    heroInfo.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-hero-rarity'));
    heroInfo.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-hero-name'));
    heroInfo.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-hero-status'));
    hero.appendChild(heroInfo);
    viewport.appendChild(hero);

    const grid = createStaticElement(docRef, 'div', 'gacha-reveal-grid');
    viewport.appendChild(grid);

    const footer = createStaticElement(docRef, 'div', 'gacha-reveal-footer');
    footer.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-progress', '光を集めています'));
    const track = createStaticElement(docRef, 'span', 'gacha-reveal-track');
    track.appendChild(createStaticElement(docRef, 'i'));
    footer.appendChild(track);
    footer.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-continue', 'タップで結果一覧へ  ›'));
    stage.appendChild(footer);

    overlay.appendChild(stage);
  }

  return {
    stage,
    skipBtn: docRef.getElementById('gachaRevealSkipBtn'),
    headline: stage.querySelector('.gacha-reveal-headline'),
    subtitle: stage.querySelector('.gacha-reveal-subtitle'),
    hero: stage.querySelector('.gacha-reveal-hero'),
    heroRarity: stage.querySelector('.gacha-reveal-hero-rarity'),
    heroImage: stage.querySelector('.gacha-reveal-hero-image'),
    heroFallback: stage.querySelector('.gacha-reveal-hero-fallback'),
    heroKind: stage.querySelector('.gacha-reveal-hero-kind'),
    heroName: stage.querySelector('.gacha-reveal-hero-name'),
    heroStatus: stage.querySelector('.gacha-reveal-hero-status'),
    grid: stage.querySelector('.gacha-reveal-grid'),
    canvas: stage.querySelector('.gacha-reveal-cosmos'),
    progress: stage.querySelector('.gacha-reveal-progress')
  };
}

function createSlotCard(docRef: Document, pull: any, isNew: boolean, index: number, spotlightId: string | null): HTMLElement {
  const rarityId = String((pull && pull.rarity) || '').trim().toLowerCase();
  const itemVisuals = resolveGachaItemVisualsModule();
  const card = docRef.createElement('div');
  card.className = `gacha-reveal-slot rarity-${rarityId}`;
  card.setAttribute('data-gacha-rarity', rarityId);
  card.setAttribute('aria-hidden', 'true');
  if (pull && pull.item && pull.item.id === spotlightId) {
    card.classList.add('is-spotlight');
  }
  card.style.setProperty('--gacha-slot-index', String(index));

  const rarity = createStaticElement(docRef, 'div', 'gacha-reveal-slot-rarity', String((pull && pull.rarity) || ''));
  const visual = createStaticElement(docRef, 'div', 'gacha-reveal-slot-visual');
  const image = docRef.createElement('img');
  image.className = 'gacha-reveal-slot-image';
  image.alt = '';
  image.loading = 'eager';
  image.decoding = 'async';
  image.draggable = false;
  const fallback = itemVisuals.createHandFallbackTile(docRef, 'gacha-reveal-slot-fallback');
  bindPreviewRecovery(image, fallback);
  itemVisuals.applyItemPreviewState(pull && pull.item ? pull.item : null, image, fallback);
  visual.appendChild(image);
  visual.appendChild(fallback);
  const name = createStaticElement(docRef, 'div', 'gacha-reveal-slot-name', pull && pull.item ? pull.item.label : '');
  const kind = createStaticElement(docRef, 'div', 'gacha-reveal-slot-kind', itemVisuals.getItemKindLabel(pull && pull.item ? pull.item : null));
  const status = createStaticElement(docRef, 'div', `gacha-reveal-slot-status ${isNew ? 'is-new' : 'is-owned'}`, isNew ? 'NEW' : '所持済み');

  card.appendChild(rarity);
  card.appendChild(visual);
  card.appendChild(name);
  card.appendChild(kind);
  card.appendChild(status);
  return card;
}

function populateHero(refs: StageRefs, pull: any, newlyUnlockedIdSet: Set<string>): void {
  const item = pull && pull.item ? pull.item : null;
  if (!refs || !item) return;
  const rarityId = String(pull.rarity || '').trim().toLowerCase();
  const isNew = newlyUnlockedIdSet.has(item.id);
  const itemVisuals = resolveGachaItemVisualsModule();
  refs.hero!.setAttribute('data-gacha-rarity', rarityId);
  refs.heroRarity!.textContent = String(pull.rarity || '');
  refs.hero!.setAttribute('data-gacha-kind', itemVisuals.normalizeItemKind(item));
  itemVisuals.applyItemPreviewState(item, refs.heroImage as HTMLImageElement, refs.heroFallback as HTMLElement);
  refs.heroKind!.textContent = itemVisuals.getItemKindLabel(item);
  refs.heroName!.textContent = item.label;
  refs.heroStatus!.textContent = isNew ? 'NEW' : '所持済み';
  refs.heroStatus!.className = `gacha-reveal-hero-status ${isNew ? 'is-new' : 'is-owned'}`;
}

function populateGrid(refs: StageRefs, pulls: any[], newlyUnlockedIdSet: Set<string>, spotlightPull: any): void {
  if (!refs || !refs.grid) return;
  const grid = refs.grid as HTMLElement;
  grid.innerHTML = '';
  const docRef = grid.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!docRef) return;

  const spotlightId = spotlightPull && spotlightPull.item ? spotlightPull.item.id : null;
  pulls.forEach((pull, index) => {
    const itemId = pull && pull.item ? pull.item.id : '';
    grid.appendChild(createSlotCard(docRef, pull, newlyUnlockedIdSet.has(itemId), index, spotlightId));
  });
}

function resetStageVisualState(stage: HTMLElement, isTenPull: boolean): void {
  if (!stage) return;
  stage.classList.remove(
    'is-active',
    'is-charging',
    'is-anticipating',
    'is-opening',
    'is-hero-visible',
    'is-grid-visible',
    'is-impact-visible',
    'is-finishing',
    'is-skip-requested',
    'is-awaiting-dismiss',
    'is-single-pull',
    'is-ten-pull'
  );
  stage.classList.add(isTenPull ? 'is-ten-pull' : 'is-single-pull');
  stage.setAttribute('aria-hidden', 'false');
}

function hideStage(stage: HTMLElement): void {
  if (!stage) return;
  stage.classList.remove(
    'is-active',
    'is-charging',
    'is-anticipating',
    'is-opening',
    'is-hero-visible',
    'is-grid-visible',
    'is-impact-visible',
    'is-finishing',
    'is-skip-requested',
    'is-awaiting-dismiss',
    'is-single-pull',
    'is-ten-pull'
  );
  stage.setAttribute('aria-hidden', 'true');
  stage.removeAttribute('data-rarity');
  stage.removeAttribute('data-gacha-rarity');
  stage.removeAttribute('data-reveal-effect');
}

const GachaRevealStage = {
  ensureGachaRevealStage,
  populateHero,
  populateGrid,
  resetStageVisualState,
  hideStage
};

export = GachaRevealStage;
