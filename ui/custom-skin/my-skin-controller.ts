/**
 * @file my-skin-controller.ts
 * @description Saved custom skin list and temporary/persistent actions
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

type CustomSkinKind = 'background' | 'board' | 'stone';

interface CustomSkinDefinition {
  id: string;
  kind: CustomSkinKind;
  label: string;
  note?: string;
  imagePath?: string;
  blackImagePath?: string;
  whiteImagePath?: string;
}

interface CustomSkinStorageModule {
  getCustomSkinDefinitions: (rootRef: Window) => CustomSkinDefinition[];
  loadCustomSkins: (rootRef: Window) => Promise<CustomSkinDefinition[]>;
  deleteCustomSkin: (rootRef: Window, skinId: string) => Promise<boolean>;
  subscribeCustomSkins: (rootRef: Window, listener: () => void) => () => void;
}

interface SkinControllerApi {
  useSkin?: (skinId: string) => unknown;
  saveSkin?: (skinId: string) => unknown;
  getSelectedSkinId?: () => string;
}

interface MySkinControllerOptions {
  root: Window;
  document: Document;
  optionsEl: HTMLElement;
  backgroundControllerApi?: SkinControllerApi | null;
  boardControllerApi?: SkinControllerApi | null;
  stoneControllerApi?: SkinControllerApi | null;
}

interface MySkinControllerApi {
  refreshOptions: () => void;
}

function resolveStorageModule(rootRef: Window): CustomSkinStorageModule | null {
  try {
    const ctx = rootRef as Window & { CustomSkinStorageModule?: CustomSkinStorageModule };
    if (ctx && ctx.CustomSkinStorageModule) return ctx.CustomSkinStorageModule;
    if (
      typeof globalThis !== 'undefined'
      && (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule
    ) {
      return (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule ?? null;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('./storage');
  } catch (e) { /* ignore */ }
  return null;
}

function createElement<T extends keyof HTMLElementTagNameMap>(
  docRef: Document,
  tagName: T,
  className?: string
): HTMLElementTagNameMap[T] {
  const element = docRef.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function createButton(docRef: Document, label: string, className: string, ariaLabel: string): HTMLButtonElement {
  const button = createElement(docRef, 'button', className);
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}

function getKindLabel(kind: CustomSkinKind): string {
  if (kind === 'background') return '背景';
  if (kind === 'board') return '盤面デザイン';
  return '石';
}

function getController(options: MySkinControllerOptions, kind: CustomSkinKind): SkinControllerApi | null {
  if (kind === 'background') return options.backgroundControllerApi || null;
  if (kind === 'board') return options.boardControllerApi || null;
  return options.stoneControllerApi || null;
}

function createPreview(docRef: Document, definition: CustomSkinDefinition): HTMLElement {
  if (definition.kind === 'stone') {
    const preview = createElement(docRef, 'span', 'my-skin-card-stone-preview');
    const blackImage = createElement(docRef, 'img', 'my-skin-card-preview my-skin-card-preview--black');
    blackImage.src = definition.blackImagePath || '';
    blackImage.alt = '';
    blackImage.loading = 'lazy';
    blackImage.decoding = 'async';
    blackImage.draggable = false;
    preview.appendChild(blackImage);
    const whiteImage = createElement(docRef, 'img', 'my-skin-card-preview my-skin-card-preview--white');
    whiteImage.src = definition.whiteImagePath || '';
    whiteImage.alt = '';
    whiteImage.loading = 'lazy';
    whiteImage.decoding = 'async';
    whiteImage.draggable = false;
    preview.appendChild(whiteImage);
    return preview;
  }
  const image = createElement(docRef, 'img', 'my-skin-card-preview');
  image.src = definition.imagePath || '';
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  return image;
}

function setupMySkinControls(options?: MySkinControllerOptions): MySkinControllerApi | null {
  const optsInput = options && typeof options === 'object' ? options : null;
  if (!optsInput || !optsInput.root || !optsInput.document || !optsInput.optionsEl) return null;
  const opts: MySkinControllerOptions = optsInput;
  const storage = resolveStorageModule(opts.root);
  if (!storage) return null;
  const storageApi = storage;

  const docRef = opts.document;
  const optionsEl = opts.optionsEl;
  let statusEl: HTMLElement | null = null;

  function setStatus(message: string, isError = false): void {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', isError);
  }

  function createCard(definition: CustomSkinDefinition): HTMLElement {
    const card = createElement(docRef, 'article', 'my-skin-card');
    card.setAttribute('data-custom-skin-id', definition.id);
    card.setAttribute('data-custom-skin-kind', definition.kind);

    const main = createElement(docRef, 'div', 'my-skin-card-main');
    main.appendChild(createPreview(docRef, definition));

    const copy = createElement(docRef, 'div', 'my-skin-card-copy');
    const label = createElement(docRef, 'div', 'my-skin-card-label');
    label.textContent = definition.label || 'マイスキン';
    copy.appendChild(label);
    const note = createElement(docRef, 'div', 'my-skin-card-note');
    note.textContent = definition.note || '個人保存';
    copy.appendChild(note);
    const controller = getController(opts, definition.kind);
    if (controller && typeof controller.getSelectedSkinId === 'function' && controller.getSelectedSkinId() === definition.id) {
      const current = createElement(docRef, 'span', 'my-skin-card-current');
      current.textContent = '現在使用中';
      copy.appendChild(current);
      card.classList.add('is-current');
    }
    main.appendChild(copy);
    card.appendChild(main);

    const actions = createElement(docRef, 'div', 'my-skin-card-actions');
    const useButton = createButton(docRef, '使用', 'my-skin-use', `${definition.label}を一時使用`);
    useButton.addEventListener('click', (event: Event) => {
      event.preventDefault();
      const api = getController(opts, definition.kind);
      if (!api) {
        setStatus('このスキンを使用できません', true);
        return;
      }
      try {
        const result = typeof api.useSkin === 'function' ? api.useSkin(definition.id) : null;
        if (!result) {
          setStatus('このスキンを使用できません', true);
          return;
        }
        refreshOptions();
        setStatus(`「${definition.label}」を一時使用しました（選択は保存していません）`);
      } catch (error: any) {
        setStatus(String(error && error.message || '一時使用できませんでした'), true);
      }
    });
    actions.appendChild(useButton);

    const saveButton = createButton(docRef, '保存', 'my-skin-save', `${definition.label}を保存`);
    saveButton.addEventListener('click', (event: Event) => {
      event.preventDefault();
      const api = getController(opts, definition.kind);
      if (!api || typeof api.saveSkin !== 'function') {
        setStatus('このスキンを保存できません', true);
        return;
      }
      try {
        const result = api.saveSkin(definition.id);
        if (!result) {
          setStatus('このスキンを保存できません', true);
          return;
        }
        refreshOptions();
        setStatus(`「${definition.label}」を保存しました`);
      } catch (error: any) {
        setStatus(String(error && error.message || '保存できませんでした'), true);
      }
    });
    actions.appendChild(saveButton);

    const deleteButton = createButton(docRef, '削除', 'my-skin-delete', `${definition.label}を削除`);
    deleteButton.addEventListener('click', (event: Event) => {
      event.preventDefault();
      deleteButton.disabled = true;
      let deleteResult: Promise<boolean>;
      try {
        deleteResult = storageApi.deleteCustomSkin(opts.root, definition.id);
      } catch (error: any) {
        deleteButton.disabled = false;
        setStatus(String(error && error.message || '削除できませんでした'), true);
        return;
      }
      Promise.resolve(deleteResult).then((deleted) => {
        if (!deleted) throw new Error('削除対象が見つかりません');
        refreshOptions();
        setStatus(`「${definition.label}」を削除しました`);
      }).catch((error: any) => {
        deleteButton.disabled = false;
        setStatus(String(error && error.message || '削除できませんでした'), true);
      });
    });
    actions.appendChild(deleteButton);
    card.appendChild(actions);
    return card;
  }

  function renderOptions(): void {
    optionsEl.innerHTML = '';
    statusEl = createElement(docRef, 'div', 'my-skin-status');
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    optionsEl.appendChild(statusEl);

    const definitions = storageApi.getCustomSkinDefinitions(opts.root) || [];
    const validDefinitions = definitions.filter((definition) => (
      definition && (definition.kind === 'background' || definition.kind === 'board' || definition.kind === 'stone')
    ));
    if (!validDefinitions.length) {
      const empty = createElement(docRef, 'div', 'my-skin-empty');
      empty.textContent = '保存済みマイスキンなし';
      optionsEl.appendChild(empty);
      return;
    }

    (['background', 'board', 'stone'] as CustomSkinKind[]).forEach((kind) => {
      const kindDefinitions = validDefinitions.filter((definition) => definition.kind === kind);
      if (!kindDefinitions.length) return;
      const group = createElement(docRef, 'section', 'my-skin-group');
      const title = createElement(docRef, 'h3', 'my-skin-group-title');
      title.textContent = getKindLabel(kind);
      group.appendChild(title);
      const grid = createElement(docRef, 'div', 'my-skin-card-grid');
      kindDefinitions.forEach((definition) => grid.appendChild(createCard(definition)));
      group.appendChild(grid);
      optionsEl.appendChild(group);
    });
  }

  function refreshOptions(): void {
    renderOptions();
  }

  if (typeof storageApi.subscribeCustomSkins === 'function') {
    storageApi.subscribeCustomSkins(opts.root, refreshOptions);
  }
  refreshOptions();
  if (typeof storageApi.loadCustomSkins === 'function') {
    storageApi.loadCustomSkins(opts.root).then(refreshOptions).catch((error: any) => {
      setStatus(String(error && error.message || '保存済みマイスキンを読み込めませんでした'), true);
    });
  }

  return { refreshOptions };
}

export = {
  setupMySkinControls
};
