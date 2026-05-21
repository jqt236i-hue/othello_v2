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
  characterSizeInput: HTMLInputElement;
  applyCharacterButton: HTMLButtonElement;
  hideCharacterButton: HTMLButtonElement;
  characterImages: Record<StoryEffectCharacterSlot, HTMLImageElement>;
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

type StoryEffectCharacterSlot = 'left' | 'center' | 'right';

type StoryEffectPreviewAsset = {
  id: string;
  label: string;
  path: string;
};

type StoryEffectPreviewCatalog = {
  backgrounds: StoryEffectPreviewAsset[];
  characters: StoryEffectPreviewAsset[];
};

const defaultCharacterXBySlot: Record<StoryEffectCharacterSlot, number> = {
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
    characterSizeInput: requireElement<HTMLInputElement>(doc, 'storyEffectCharacterSizeInput'),
    applyCharacterButton: requireElement<HTMLButtonElement>(doc, 'storyEffectApplyCharacterBtn'),
    hideCharacterButton: requireElement<HTMLButtonElement>(doc, 'storyEffectHideCharacterBtn'),
    characterImages: {
      left: requireElement<HTMLImageElement>(doc, 'storyEffectCharacterLeft'),
      center: requireElement<HTMLImageElement>(doc, 'storyEffectCharacterCenter'),
      right: requireElement<HTMLImageElement>(doc, 'storyEffectCharacterRight')
    },
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
  elements.characterSlotSelect.addEventListener('change', () => syncCharacterControlsFromSlot(elements));
  elements.applyCharacterButton.addEventListener('click', () => applyCharacter(elements, assetCatalog));
  elements.hideCharacterButton.addEventListener('click', () => hideSelectedCharacter(elements));

  renderPresetList(elements.list, activePreset.id, selectPreset);
  renderPresetInfo(elements, activePreset);
  syncCharacterControlsFromSlot(elements);
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

function applyCharacter(elements: StoryEffectPreviewElements, catalog: StoryEffectPreviewCatalog): void {
  const asset = catalog.characters.find((item) => item.id === elements.characterSelect.value);
  if (!asset) return;
  const slot = readCharacterSlot(elements);
  const image = elements.characterImages[slot];
  const x = Number(elements.characterXInput.value);
  const size = Number(elements.characterSizeInput.value);
  image.src = asset.path;
  image.alt = asset.label;
  image.dataset.x = String(x);
  image.dataset.size = String(size);
  image.style.left = `${x}%`;
  image.style.height = `${size}%`;
  image.classList.add('is-visible');
  image.hidden = false;
}

function hideSelectedCharacter(elements: StoryEffectPreviewElements): void {
  const image = elements.characterImages[readCharacterSlot(elements)];
  image.classList.remove('is-visible');
  image.hidden = true;
  image.removeAttribute('src');
  image.alt = '';
}

function syncCharacterControlsFromSlot(elements: StoryEffectPreviewElements): void {
  const slot = readCharacterSlot(elements);
  const image = elements.characterImages[slot];
  elements.characterXInput.value = image.dataset.x ?? String(defaultCharacterXBySlot[slot]);
  elements.characterSizeInput.value = image.dataset.size ?? '82';
}

function readCharacterSlot(elements: StoryEffectPreviewElements): StoryEffectCharacterSlot {
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
