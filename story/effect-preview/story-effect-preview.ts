import { storyEffectPresets } from '../effects/story-effect-presets';
import type { StoryEffectPreset, StoryEffectStep } from '../effects/story-effect-schema';

type StoryEffectPreviewElements = {
  list: HTMLElement;
  replayButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  stage: HTMLElement;
  background: HTMLElement;
  backgroundSelect: HTMLSelectElement;
  characterSelect: HTMLSelectElement;
  characterSlotSelect: HTMLSelectElement;
  characterXInput: HTMLInputElement;
  characterYInput: HTMLInputElement;
  characterSizeInput: HTMLInputElement;
  applyCharacterButton: HTMLButtonElement;
  flipCharacterButton: HTMLButtonElement;
  hideCharacterButton: HTMLButtonElement;
  characterLayer: HTMLElement;
  tone: HTMLElement;
  overlay: HTMLElement;
  noise: HTMLElement;
  scanline: HTMLElement;
  crack: HTMLElement;
  letterbox: HTMLElement;
  vignette: HTMLElement;
  text: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  authoringText: HTMLTextAreaElement;
  stepSummary: HTMLElement;
};

type StoryEffectCharacterPlacement = 'left' | 'center' | 'right';

type StoryEffectPreviewAsset = {
  id: string;
  label: string;
  path: string;
};

type StoryEffectPreviewCatalog = {
  backgrounds: StoryEffectPreviewAsset[];
  characters: StoryEffectPreviewAsset[];
};

type StoryEffectCharacterDragState = {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

type StoryEffectCharacterState = {
  characters: Map<string, HTMLImageElement>;
  selectedId: string | null;
  nextId: number;
  nextZIndex: number;
  drag: StoryEffectCharacterDragState | null;
};

const defaultCharacterXByPlacement: Record<StoryEffectCharacterPlacement, number> = {
  left: 28,
  center: 50,
  right: 72
};

export function initStoryEffectPreview(doc: Document = document): void {
  const elements: StoryEffectPreviewElements = {
    list: requireElement(doc, 'storyEffectPresetList'),
    replayButton: requireElement<HTMLButtonElement>(doc, 'storyEffectReplayBtn'),
    stopButton: requireElement<HTMLButtonElement>(doc, 'storyEffectStopBtn'),
    stage: requireElement(doc, 'storyEffectStage'),
    background: requireElement(doc, 'storyEffectBackground'),
    backgroundSelect: requireElement<HTMLSelectElement>(doc, 'storyEffectBackgroundSelect'),
    characterSelect: requireElement<HTMLSelectElement>(doc, 'storyEffectCharacterSelect'),
    characterSlotSelect: requireElement<HTMLSelectElement>(doc, 'storyEffectCharacterSlotSelect'),
    characterXInput: requireElement<HTMLInputElement>(doc, 'storyEffectCharacterXInput'),
    characterYInput: requireElement<HTMLInputElement>(doc, 'storyEffectCharacterYInput'),
    characterSizeInput: requireElement<HTMLInputElement>(doc, 'storyEffectCharacterSizeInput'),
    applyCharacterButton: requireElement<HTMLButtonElement>(doc, 'storyEffectApplyCharacterBtn'),
    flipCharacterButton: requireElement<HTMLButtonElement>(doc, 'storyEffectFlipCharacterBtn'),
    hideCharacterButton: requireElement<HTMLButtonElement>(doc, 'storyEffectHideCharacterBtn'),
    characterLayer: requireElement(doc, 'storyEffectCharacterLayer'),
    tone: requireElement(doc, 'storyEffectTone'),
    overlay: requireElement(doc, 'storyEffectOverlay'),
    noise: requireElement(doc, 'storyEffectNoise'),
    scanline: requireElement(doc, 'storyEffectScanline'),
    crack: requireElement(doc, 'storyEffectCrack'),
    letterbox: requireElement(doc, 'storyEffectLetterbox'),
    vignette: requireElement(doc, 'storyEffectVignette'),
    text: requireElement(doc, 'storyEffectText'),
    title: requireElement(doc, 'storyEffectTitle'),
    description: requireElement(doc, 'storyEffectDescription'),
    authoringText: requireElement<HTMLTextAreaElement>(doc, 'storyEffectAuthoringText'),
    stepSummary: requireElement(doc, 'storyEffectStepSummary')
  };

  let assetCatalog: StoryEffectPreviewCatalog = { backgrounds: [], characters: [] };
  let activePreset: StoryEffectPreset = storyEffectPresets[0];
  let runToken = 0;
  const characterState: StoryEffectCharacterState = {
    characters: new Map(),
    selectedId: null,
    nextId: 1,
    nextZIndex: 1,
    drag: null
  };

  const stop = (): void => {
    runToken += 1;
    resetStage(elements);
  };

  const play = (): void => {
    runToken += 1;
    const token = runToken;
    void playPreset(elements, activePreset, () => token === runToken);
  };

  const selectPreset = (preset: StoryEffectPreset): void => {
    activePreset = preset;
    renderPresetList(elements.list, activePreset.id, selectPreset);
    renderPresetInfo(elements, activePreset);
    play();
  };

  elements.replayButton.addEventListener('click', play);
  elements.stopButton.addEventListener('click', stop);
  elements.backgroundSelect.addEventListener('change', () => applyBackground(elements, assetCatalog));
  elements.characterSlotSelect.addEventListener('change', () => applyCharacterPlacement(elements, characterState));
  elements.characterXInput.addEventListener('input', () => applySelectedCharacterControls(elements, characterState));
  elements.characterYInput.addEventListener('input', () => applySelectedCharacterControls(elements, characterState));
  elements.characterSizeInput.addEventListener('input', () => applySelectedCharacterControls(elements, characterState));
  elements.applyCharacterButton.addEventListener('click', () => addCharacter(elements, characterState, assetCatalog));
  elements.flipCharacterButton.addEventListener('click', () => flipSelectedCharacter(elements, characterState));
  elements.hideCharacterButton.addEventListener('click', () => removeSelectedCharacter(elements, characterState));

  renderPresetList(elements.list, activePreset.id, selectPreset);
  renderPresetInfo(elements, activePreset);
  syncCharacterControlsFromPlacement(elements, characterState);
  void loadEffectPreviewAssets().then((catalog) => {
    assetCatalog = catalog;
    renderAssetOptions(elements, assetCatalog);
    applyBackground(elements, assetCatalog);
  });
  play();
}

async function loadEffectPreviewAssets(): Promise<StoryEffectPreviewCatalog> {
  const [backgrounds, characters] = await Promise.all([
    loadDirectoryAssets('/assets/story/bg/'),
    loadDirectoryAssets('/assets/story/chars/')
  ]);
  return { backgrounds, characters };
}

async function loadDirectoryAssets(directoryPath: string): Promise<StoryEffectPreviewAsset[]> {
  try {
    const response = await fetch(directoryPath, { cache: 'no-store' });
    if (!response.ok) return [];
    const html = await response.text();
    return parseDirectoryListing(html, directoryPath);
  } catch (error) {
    console.warn(`[story-effect-preview] 素材フォルダを読み込めませんでした: ${directoryPath}`, error);
    return [];
  }
}

function parseDirectoryListing(html: string, directoryPath: string): StoryEffectPreviewAsset[] {
  const assets: StoryEffectPreviewAsset[] = [];
  const hrefPattern = /href="([^"]+)"/gi;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(html)) !== null) {
    const rawHref = match[1];
    if (!rawHref || rawHref === '../' || rawHref.endsWith('/')) continue;
    const fileName = decodeURIComponent(rawHref.split('/').pop() ?? rawHref);
    if (!/\.(png|jpe?g|webp|gif)$/i.test(fileName)) continue;
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const label = fileName.replace(/\.[^.]+$/, '');
    assets.push({
      id: label,
      label,
      path: `${directoryPath}${encodeURIComponent(fileName).replace(/%2F/gi, '/')}`
    });
  }
  return assets.sort((a, b) => a.label.localeCompare(b.label, 'ja'));
}

function renderAssetOptions(elements: StoryEffectPreviewElements, catalog: StoryEffectPreviewCatalog): void {
  renderSelectOptions(elements.backgroundSelect, catalog.backgrounds, '背景なし');
  renderSelectOptions(elements.characterSelect, catalog.characters, '立ち絵を選択');
}

function renderSelectOptions(select: HTMLSelectElement, assets: StoryEffectPreviewAsset[], emptyLabel: string): void {
  select.innerHTML = '';
  const emptyOption = select.ownerDocument.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = assets.length > 0 ? emptyLabel : `${emptyLabel}（素材なし）`;
  select.append(emptyOption);
  for (const asset of assets) {
    const option = select.ownerDocument.createElement('option');
    option.value = asset.id;
    option.textContent = asset.label;
    select.append(option);
  }
}

function applyBackground(elements: StoryEffectPreviewElements, catalog: StoryEffectPreviewCatalog): void {
  const asset = catalog.backgrounds.find((item) => item.id === elements.backgroundSelect.value);
  if (!asset) {
    elements.background.style.backgroundImage = '';
    elements.stage.classList.remove('has-custom-background');
    return;
  }
  elements.background.style.backgroundImage = `url("${asset.path}")`;
  elements.stage.classList.add('has-custom-background');
}

function addCharacter(
  elements: StoryEffectPreviewElements,
  state: StoryEffectCharacterState,
  catalog: StoryEffectPreviewCatalog
): void {
  const asset = catalog.characters.find((item) => item.id === elements.characterSelect.value);
  if (!asset) return;
  const id = `character-${state.nextId}`;
  state.nextId += 1;
  const image = elements.characterLayer.ownerDocument.createElement('img');
  const x = Number(elements.characterXInput.value);
  const y = Number(elements.characterYInput.value);
  const size = Number(elements.characterSizeInput.value);
  image.id = `storyEffectCharacter-${id}`;
  image.className = 'story-effect-character';
  image.src = asset.path;
  image.alt = asset.label;
  image.dataset.id = id;
  image.dataset.x = String(x);
  image.dataset.y = String(y);
  image.dataset.size = String(size);
  image.dataset.flipped = 'false';
  image.style.left = `${x}%`;
  image.style.bottom = `${y}%`;
  image.style.height = `${size}%`;
  image.style.zIndex = String(state.nextZIndex);
  state.nextZIndex += 1;
  bindCharacterPointerEvents(elements, state, image);
  elements.characterLayer.append(image);
  state.characters.set(id, image);
  selectCharacter(elements, state, id);
}

function removeSelectedCharacter(elements: StoryEffectPreviewElements, state: StoryEffectCharacterState): void {
  const image = getSelectedCharacter(state);
  if (!image || !state.selectedId) return;
  const removedId = state.selectedId;
  image.remove();
  state.characters.delete(removedId);
  state.selectedId = null;
  const lastCharacter = Array.from(state.characters.keys()).pop() ?? null;
  if (lastCharacter) {
    selectCharacter(elements, state, lastCharacter);
  }
}

function flipSelectedCharacter(elements: StoryEffectPreviewElements, state: StoryEffectCharacterState): void {
  const image = getSelectedCharacter(state);
  if (!image) return;
  const flipped = image.dataset.flipped !== 'true';
  image.dataset.flipped = flipped ? 'true' : 'false';
  image.style.setProperty('--story-effect-character-flip', flipped ? '-1' : '1');
  markSelectedCharacter(state);
}

function syncCharacterControlsFromPlacement(elements: StoryEffectPreviewElements, state: StoryEffectCharacterState): void {
  const selected = getSelectedCharacter(state);
  if (selected) {
    syncCharacterControlsFromImage(elements, selected);
    return;
  }
  const placement = readCharacterPlacement(elements);
  elements.characterXInput.value = String(defaultCharacterXByPlacement[placement]);
  elements.characterYInput.value = '0';
  elements.characterSizeInput.value = '82';
}

function applyCharacterPlacement(elements: StoryEffectPreviewElements, state: StoryEffectCharacterState): void {
  const placement = readCharacterPlacement(elements);
  elements.characterXInput.value = String(defaultCharacterXByPlacement[placement]);
  if (!getSelectedCharacter(state)) {
    elements.characterYInput.value = '0';
    elements.characterSizeInput.value = '82';
  }
}

function syncCharacterControlsFromImage(elements: StoryEffectPreviewElements, image: HTMLImageElement): void {
  elements.characterXInput.value = image.dataset.x ?? '50';
  elements.characterYInput.value = image.dataset.y ?? '0';
  elements.characterSizeInput.value = image.dataset.size ?? '82';
}

function bindCharacterPointerEvents(
  elements: StoryEffectPreviewElements,
  state: StoryEffectCharacterState,
  image: HTMLImageElement
): void {
  image.addEventListener('pointerdown', (event) => {
    const id = image.dataset.id;
    if (!id) return;
    event.preventDefault();
    selectCharacter(elements, state, id);
    state.drag = {
      id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: readNumberDataset(image, 'x', 50),
      startY: readNumberDataset(image, 'y', 0)
    };
    image.classList.add('is-dragging');
    image.setPointerCapture(event.pointerId);
  });
  image.addEventListener('pointermove', (event) => {
    if (!state.drag || state.drag.pointerId !== event.pointerId || state.drag.id !== image.dataset.id) return;
    event.preventDefault();
    updateCharacterPositionFromDrag(elements, state, image, event.clientX, event.clientY);
  });
  const finishDrag = (event: PointerEvent): void => {
    if (!state.drag || state.drag.pointerId !== event.pointerId || state.drag.id !== image.dataset.id) return;
    image.classList.remove('is-dragging');
    if (image.hasPointerCapture(event.pointerId)) {
      image.releasePointerCapture(event.pointerId);
    }
    state.drag = null;
  };
  image.addEventListener('pointerup', finishDrag);
  image.addEventListener('pointercancel', finishDrag);
}

function selectCharacter(elements: StoryEffectPreviewElements, state: StoryEffectCharacterState, id: string): void {
  const image = state.characters.get(id);
  if (!image) return;
  state.selectedId = id;
  image.style.zIndex = String(state.nextZIndex);
  state.nextZIndex += 1;
  syncCharacterControlsFromImage(elements, image);
  markSelectedCharacter(state);
}

function markSelectedCharacter(state: StoryEffectCharacterState): void {
  for (const [id, image] of state.characters) {
    image.classList.toggle('is-selected', id === state.selectedId);
  }
}

function applySelectedCharacterControls(elements: StoryEffectPreviewElements, state: StoryEffectCharacterState): void {
  const image = getSelectedCharacter(state);
  if (!image) return;
  const x = clampNumber(Number(elements.characterXInput.value), Number(elements.characterXInput.min), Number(elements.characterXInput.max));
  const y = clampNumber(Number(elements.characterYInput.value), Number(elements.characterYInput.min), Number(elements.characterYInput.max));
  const size = clampNumber(Number(elements.characterSizeInput.value), Number(elements.characterSizeInput.min), Number(elements.characterSizeInput.max));
  image.dataset.x = String(x);
  image.dataset.y = String(y);
  image.dataset.size = String(size);
  image.style.left = `${x}%`;
  image.style.bottom = `${y}%`;
  image.style.height = `${size}%`;
  markSelectedCharacter(state);
}

function updateCharacterPositionFromDrag(
  elements: StoryEffectPreviewElements,
  state: StoryEffectCharacterState,
  image: HTMLImageElement,
  clientX: number,
  clientY: number
): void {
  if (!state.drag) return;
  const stageRect = elements.stage.getBoundingClientRect();
  const xMin = Number(elements.characterXInput.min);
  const xMax = Number(elements.characterXInput.max);
  const yMin = Number(elements.characterYInput.min);
  const yMax = Number(elements.characterYInput.max);
  const deltaX = ((clientX - state.drag.startClientX) / stageRect.width) * 100;
  const deltaY = ((state.drag.startClientY - clientY) / stageRect.height) * 100;
  const x = Math.round(clampNumber(state.drag.startX + deltaX, xMin, xMax));
  const y = Math.round(clampNumber(state.drag.startY + deltaY, yMin, yMax));
  image.dataset.x = String(x);
  image.dataset.y = String(y);
  image.style.left = `${x}%`;
  image.style.bottom = `${y}%`;
  elements.characterXInput.value = String(x);
  elements.characterYInput.value = String(y);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getSelectedCharacter(state: StoryEffectCharacterState): HTMLImageElement | null {
  if (!state.selectedId) return null;
  return state.characters.get(state.selectedId) ?? null;
}

function readNumberDataset(element: HTMLElement, key: string, fallback: number): number {
  const value = Number(element.dataset[key]);
  return Number.isFinite(value) ? value : fallback;
}

function readCharacterPlacement(elements: StoryEffectPreviewElements): StoryEffectCharacterPlacement {
  const value = elements.characterSlotSelect.value;
  if (value === 'left' || value === 'right') return value;
  return 'center';
}

function renderPresetList(
  root: HTMLElement,
  activePresetId: string,
  onSelect: (preset: StoryEffectPreset) => void
): void {
  root.innerHTML = '';
  storyEffectPresets.forEach((preset) => {
    const button = root.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = preset.id === activePresetId ? 'story-effect-preset-button is-active' : 'story-effect-preset-button';
    const title = root.ownerDocument.createElement('strong');
    title.textContent = preset.title;
    const description = root.ownerDocument.createElement('span');
    description.textContent = preset.description;
    button.append(title, description);
    button.addEventListener('click', () => onSelect(preset));
    root.append(button);
  });
}

function renderPresetInfo(elements: StoryEffectPreviewElements, preset: StoryEffectPreset): void {
  elements.title.textContent = preset.title;
  elements.description.textContent = preset.description;
  elements.authoringText.value = preset.authoringLabel;
  elements.stepSummary.innerHTML = '';
  preset.steps.forEach((step) => {
    const pill = elements.stepSummary.ownerDocument.createElement('div');
    pill.className = 'story-effect-step-pill';
    pill.textContent = `${step.id} / ${step.durationMs}ms`;
    elements.stepSummary.append(pill);
  });
}

async function playPreset(
  elements: StoryEffectPreviewElements,
  preset: StoryEffectPreset,
  isCurrent: () => boolean
): Promise<void> {
  resetStage(elements);
  for (const step of preset.steps) {
    if (!isCurrent()) return;
    applyStep(elements, step);
    await delay(step.durationMs);
  }
}

function applyStep(elements: StoryEffectPreviewElements, step: StoryEffectStep): void {
  elements.stage.classList.toggle('is-shaking-soft', step.shake === 'soft');
  elements.stage.classList.toggle('is-shaking-hard', step.shake === 'hard');
  elements.stage.classList.toggle('is-pulsing-soft', step.pulse === 'soft');
  elements.stage.classList.toggle('is-pulsing-heartbeat', step.pulse === 'heartbeat');
  elements.stage.classList.toggle('is-chromatic', step.chromatic === true);
  elements.stage.style.setProperty('--story-effect-blur', `${step.blurPx ?? 0}px`);
  elements.stage.style.setProperty('--story-effect-zoom', String(step.zoom ?? 1));

  elements.tone.style.background = resolveToneBackground(step.tone);
  elements.tone.style.opacity = step.tone && step.tone !== 'normal' ? '1' : '0';
  elements.tone.style.transition = `opacity ${Math.max(80, step.durationMs)}ms ease`;

  elements.overlay.style.background = resolveOverlayColor(step.overlay, step.flash);
  elements.overlay.style.opacity = String(step.overlayOpacity ?? 0);
  elements.overlay.style.transition = `opacity ${Math.max(80, step.durationMs)}ms ease`;

  elements.noise.style.opacity = step.overlay === 'noise' ? String(step.overlayOpacity ?? 0.35) : '0';
  elements.noise.style.transition = `opacity ${Math.max(80, step.durationMs)}ms ease`;
  elements.noise.classList.toggle('is-active', step.overlay === 'noise');

  elements.scanline.style.opacity = String(step.scanlineOpacity ?? 0);
  elements.scanline.style.transition = `opacity ${Math.max(80, step.durationMs)}ms ease`;

  elements.crack.style.opacity = String(step.crackOpacity ?? 0);
  elements.crack.style.transition = `opacity ${Math.max(80, step.durationMs)}ms ease`;

  elements.letterbox.style.opacity = String(step.letterboxOpacity ?? 0);
  elements.letterbox.style.transition = `opacity ${Math.max(80, step.durationMs)}ms ease`;

  elements.vignette.style.opacity = String(step.vignetteOpacity ?? 0);
  elements.vignette.style.transition = `opacity ${Math.max(80, step.durationMs)}ms ease`;

  elements.text.classList.remove('is-falling', 'is-fading', 'is-title');
  elements.text.textContent = step.text ?? '';
  elements.text.style.opacity = step.text ? '1' : '0';
  if (step.textMotion === 'fall') {
    restartAnimation(elements.text, 'is-falling');
  } else if (step.textMotion === 'title') {
    restartAnimation(elements.text, 'is-title');
  } else if (step.textMotion === 'fade' || step.textMotion === 'type') {
    restartAnimation(elements.text, 'is-fading');
  }
}

function resetStage(elements: StoryEffectPreviewElements): void {
  elements.stage.classList.remove('is-shaking-soft', 'is-shaking-hard', 'is-pulsing-soft', 'is-pulsing-heartbeat', 'is-chromatic');
  elements.stage.style.setProperty('--story-effect-blur', '0px');
  elements.stage.style.setProperty('--story-effect-zoom', '1');
  elements.tone.style.opacity = '0';
  elements.overlay.style.background = '#000';
  elements.overlay.style.opacity = '0';
  elements.noise.style.opacity = '0';
  elements.noise.classList.remove('is-active');
  elements.scanline.style.opacity = '0';
  elements.crack.style.opacity = '0';
  elements.letterbox.style.opacity = '0';
  elements.vignette.style.opacity = '0';
  elements.text.classList.remove('is-falling', 'is-fading', 'is-title');
  elements.text.textContent = '';
  elements.text.style.opacity = '0';
}

function resolveOverlayColor(overlay: StoryEffectStep['overlay'], flash: StoryEffectStep['flash']): string {
  if (flash === 'white' || overlay === 'white') return '#fff';
  if (flash === 'red' || overlay === 'red') return '#b60022';
  return '#000';
}

function resolveToneBackground(tone: StoryEffectStep['tone']): string {
  switch (tone) {
    case 'warm':
      return 'linear-gradient(135deg, rgba(255, 214, 150, 0.2), rgba(255, 154, 108, 0.1))';
    case 'cold':
      return 'linear-gradient(135deg, rgba(106, 202, 255, 0.16), rgba(90, 96, 255, 0.12))';
    case 'ominous':
      return 'linear-gradient(135deg, rgba(100, 0, 18, 0.24), rgba(0, 0, 0, 0.18))';
    case 'normal':
    case undefined:
      return 'transparent';
    default:
      return 'transparent';
  }
}

function restartAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function requireElement<T extends HTMLElement = HTMLElement>(doc: Document, id: string): T {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Missing story effect preview element: ${id}`);
  return element as T;
}
