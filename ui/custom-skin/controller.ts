/**
 * @file controller.ts
 * @description Shared local custom-skin image picker and editor UI
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

type CustomSkinKind = 'background' | 'board' | 'board-frame' | 'stone';

interface CustomSkinStorageModule {
  isCustomSkin: (value: unknown, kind?: CustomSkinKind) => boolean;
  getCustomSkinRecord: (rootRef: Window, skinId: string) => CustomSkinRecord | null;
  saveCustomSkin: (rootRef: Window, input: SaveCustomSkinInput) => Promise<CustomSkinDefinition>;
  deleteCustomSkin: (rootRef: Window, skinId: string) => Promise<boolean>;
}

interface CustomSkinRecord {
  id: string;
  kind: CustomSkinKind;
  label: string;
  backgroundImage?: Blob;
  boardImage?: Blob;
  boardFrameImage?: Blob;
  blackImage?: Blob;
  whiteImage?: Blob;
}

interface SaveCustomSkinInput {
  id?: string;
  kind: CustomSkinKind;
  label?: string;
  backgroundImage?: Blob;
  boardImage?: Blob;
  boardFrameImage?: Blob;
  blackImage?: Blob;
  whiteImage?: Blob;
}

interface CustomSkinDefinition {
  id: string;
  label: string;
  imagePath?: string;
  blackImagePath?: string;
  whiteImagePath?: string;
}

interface CustomSkinUploaderOptions {
  root: Window;
  document: Document;
  host: HTMLElement;
  kind: CustomSkinKind;
  getSelectedSkinId: () => string;
  useSkin?: (skinId: string) => unknown;
  onSaved: (definition: CustomSkinDefinition) => void;
  onDeleted: (skinId: string) => void;
}

interface CustomSkinUploaderApi {
  refreshSelectedState: () => void;
  setStatus: (message: string, isError?: boolean) => void;
}

function resolveStorageModule(rootRef: Window): CustomSkinStorageModule | null {
  try {
    const ctx = rootRef as Window & { CustomSkinStorageModule?: CustomSkinStorageModule };
    if (ctx && ctx.CustomSkinStorageModule) return ctx.CustomSkinStorageModule;
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule) {
      return (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule ?? null;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('./storage');
  } catch (e) { /* ignore */ }
  return null;
}

function createElement<T extends keyof HTMLElementTagNameMap>(docRef: Document, tagName: T, className?: string): HTMLElementTagNameMap[T] {
  const element = docRef.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function createButton(docRef: Document, label: string, className: string): HTMLButtonElement {
  const button = createElement(docRef, 'button', className);
  button.type = 'button';
  button.textContent = label;
  return button;
}

function createFileInput(docRef: Document): HTMLInputElement {
  const input = createElement(docRef, 'input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.hidden = true;
  return input;
}

function createImagePreview(docRef: Document): HTMLImageElement {
  const image = createElement(docRef, 'img', 'custom-skin-editor-preview-image');
  image.alt = '';
  image.draggable = false;
  image.hidden = true;
  return image;
}

function getUrlApi(rootRef: Window): any {
  try {
    if (rootRef && (rootRef as any).URL) return (rootRef as any).URL;
  } catch (e) { /* ignore */ }
  try {
    if (typeof URL !== 'undefined') return URL;
  } catch (e) { /* ignore */ }
  return null;
}

function setupCustomSkinUploader(options: CustomSkinUploaderOptions): CustomSkinUploaderApi | null {
  if (!options || typeof options !== 'object' || !options.root || !options.document || !options.host) return null;
  const opts = options;
  const storage = resolveStorageModule(opts.root);
  if (!storage) return null;
  const storageApi = storage;

  const docRef = opts.document;
  const editor = createElement(docRef, 'div', `custom-skin-editor custom-skin-editor--${opts.kind}`);
  editor.setAttribute('data-custom-skin-kind', opts.kind);

  const title = createElement(docRef, 'div', 'custom-skin-editor-title');
  title.textContent = '自分の画像でスキンを作る';
  editor.appendChild(title);

  const nameRow = createElement(docRef, 'div', 'custom-skin-editor-name-row');
  const nameLabel = createElement(docRef, 'label', 'custom-skin-editor-name-label');
  nameLabel.textContent = 'スキン名';
  const nameInput = createElement(docRef, 'input', 'custom-skin-editor-name-input');
  nameInput.type = 'text';
  nameInput.maxLength = 24;
  nameInput.placeholder = 'マイスキン';
  nameInput.autocomplete = 'off';
  nameLabel.htmlFor = `custom-skin-name-${opts.kind}`;
  nameInput.id = nameLabel.htmlFor;
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  editor.appendChild(nameRow);

  const imageRow = createElement(docRef, 'div', 'custom-skin-editor-image-row');
  const previewMap: Record<string, HTMLImageElement> = {};
  const draft: { backgroundImage?: Blob; boardImage?: Blob; boardFrameImage?: Blob; blackImage?: Blob; whiteImage?: Blob } = {};
  const previewUrls: string[] = [];

  function revokePreviewUrls(): void {
    const urlApi = getUrlApi(opts.root);
    if (urlApi && typeof urlApi.revokeObjectURL === 'function') {
      previewUrls.splice(0).forEach((url) => {
        try { urlApi.revokeObjectURL(url); } catch (e) { /* ignore */ }
      });
    } else {
      previewUrls.length = 0;
    }
  }

  function setPreview(key: string, blob: Blob | undefined): void {
    const image = previewMap[key];
    if (!image) return;
    if (!blob) {
      image.hidden = true;
      image.removeAttribute('src');
      return;
    }
    const urlApi = getUrlApi(opts.root);
    if (!urlApi || typeof urlApi.createObjectURL !== 'function') {
      image.hidden = true;
      return;
    }
    try {
      const url = String(urlApi.createObjectURL(blob) || '').trim();
      if (!url) throw new Error('empty object URL');
      previewUrls.push(url);
      image.src = url;
      image.hidden = false;
    } catch (e) {
      image.hidden = true;
    }
  }

  function createImagePicker(key: 'backgroundImage' | 'boardImage' | 'boardFrameImage' | 'blackImage' | 'whiteImage', labelText: string): void {
    const picker = createElement(docRef, 'div', 'custom-skin-editor-picker');
    const input = createFileInput(docRef);
    const button = createButton(docRef, labelText, 'custom-skin-editor-load-button');
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;
      draft[key] = file;
      revokePreviewUrls();
      if (opts.kind === 'stone') {
        setPreview('blackImage', draft.blackImage);
        setPreview('whiteImage', draft.whiteImage);
      } else {
        setPreview(key, draft[key]);
      }
      syncButtons();
      setStatus('未保存の画像を読み込みました');
    });
    picker.appendChild(button);
    picker.appendChild(input);
    imageRow.appendChild(picker);
    const preview = createImagePreview(docRef);
    previewMap[key] = preview;
    picker.appendChild(preview);
  }

  if (opts.kind === 'stone') {
    createImagePicker('blackImage', '黒石画像読み込み');
    createImagePicker('whiteImage', '白石画像読み込み');
  } else {
    const imageKey = opts.kind === 'background'
      ? 'backgroundImage'
      : opts.kind === 'board-frame' ? 'boardFrameImage' : 'boardImage';
    createImagePicker(imageKey, '画像読み込み');
  }
  editor.appendChild(imageRow);

  const actionRow = createElement(docRef, 'div', 'custom-skin-editor-action-row');
  const useButton = createButton(docRef, '使用', 'custom-skin-editor-use-button');
  const saveButton = createButton(docRef, '保存', 'custom-skin-editor-save-button');
  const deleteButton = createButton(docRef, '削除', 'custom-skin-editor-delete-button');
  actionRow.appendChild(useButton);
  actionRow.appendChild(saveButton);
  actionRow.appendChild(deleteButton);
  editor.appendChild(actionRow);

  const status = createElement(docRef, 'div', 'custom-skin-editor-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  editor.appendChild(status);

  const parent = opts.host.parentElement;
  if (parent) parent.insertBefore(editor, opts.host);
  else opts.host.appendChild(editor);

  let saving = false;
  let currentEditorSkinId = '';

  function setStatus(message: string, isError = false): void {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function hasDraft(): boolean {
    if (opts.kind === 'background') return !!draft.backgroundImage;
    if (opts.kind === 'board') return !!draft.boardImage;
    if (opts.kind === 'board-frame') return !!draft.boardFrameImage;
    return !!draft.blackImage && !!draft.whiteImage;
  }

  function syncButtons(): void {
    const selectedId = String(opts.getSelectedSkinId() || '').trim();
    const isCustom = storageApi.isCustomSkin(selectedId, opts.kind);
    useButton.disabled = saving || !isCustom || typeof opts.useSkin !== 'function';
    saveButton.disabled = saving || !hasDraft();
    deleteButton.disabled = saving || !isCustom;
    useButton.setAttribute('aria-disabled', useButton.disabled ? 'true' : 'false');
    saveButton.setAttribute('aria-disabled', saveButton.disabled ? 'true' : 'false');
    deleteButton.setAttribute('aria-disabled', deleteButton.disabled ? 'true' : 'false');
  }

  function loadRecordIntoDraft(record: CustomSkinRecord | null): void {
    revokePreviewUrls();
    delete draft.backgroundImage;
    delete draft.boardImage;
    delete draft.boardFrameImage;
    delete draft.blackImage;
    delete draft.whiteImage;
    if (!record || record.kind !== opts.kind) {
      nameInput.value = '';
      Object.keys(previewMap).forEach((key) => setPreview(key, undefined));
      return;
    }
    nameInput.value = record.label || '';
    draft.backgroundImage = record.backgroundImage;
    draft.boardImage = record.boardImage;
    draft.boardFrameImage = record.boardFrameImage;
    draft.blackImage = record.blackImage;
    draft.whiteImage = record.whiteImage;
    Object.keys(previewMap).forEach((key) => setPreview(key, draft[key as keyof typeof draft]));
  }

  function refreshSelectedState(): void {
    const selectedId = String(opts.getSelectedSkinId() || '').trim();
    const isCustom = storageApi.isCustomSkin(selectedId, opts.kind);
    if (selectedId !== currentEditorSkinId) {
      currentEditorSkinId = selectedId;
      loadRecordIntoDraft(isCustom ? storageApi.getCustomSkinRecord(opts.root, selectedId) : null);
      if (!isCustom) setStatus('画像を読み込んで保存できます');
    }
    syncButtons();
  }

  useButton.addEventListener('click', () => {
    if (saving || useButton.disabled || typeof opts.useSkin !== 'function') return;
    const selectedId = String(opts.getSelectedSkinId() || '').trim();
    if (!storageApi.isCustomSkin(selectedId, opts.kind)) return;
    try {
      const result = opts.useSkin(selectedId);
      if (!result) {
        setStatus('このスキンを一時使用できませんでした', true);
        return;
      }
      setStatus('一時使用しました（選択は保存していません）');
    } catch (error: any) {
      setStatus(String(error && error.message || '一時使用できませんでした'), true);
    }
  });

  saveButton.addEventListener('click', () => {
    if (saving || !hasDraft()) return;
    saving = true;
    syncButtons();
    const selectedId = String(opts.getSelectedSkinId() || '').trim();
    const input: SaveCustomSkinInput = {
      id: storageApi.isCustomSkin(selectedId, opts.kind) ? selectedId : undefined,
      kind: opts.kind,
      label: nameInput.value,
      backgroundImage: draft.backgroundImage,
      boardImage: draft.boardImage,
      boardFrameImage: draft.boardFrameImage,
      blackImage: draft.blackImage,
      whiteImage: draft.whiteImage
    };
    storageApi.saveCustomSkin(opts.root, input).then((definition) => {
      setStatus('保存しました');
      opts.onSaved(definition);
    }).catch((error: any) => {
      setStatus(String(error && error.message || '保存できませんでした'), true);
    }).finally(() => {
      saving = false;
      syncButtons();
    });
  });

  deleteButton.addEventListener('click', () => {
    if (saving) return;
    const selectedId = String(opts.getSelectedSkinId() || '').trim();
    if (!storageApi.isCustomSkin(selectedId, opts.kind)) return;
    saving = true;
    syncButtons();
    storageApi.deleteCustomSkin(opts.root, selectedId).then((deleted) => {
      if (!deleted) throw new Error('削除対象が見つかりません');
      setStatus('削除しました');
      opts.onDeleted(selectedId);
    }).catch((error: any) => {
      setStatus(String(error && error.message || '削除できませんでした'), true);
    }).finally(() => {
      saving = false;
      syncButtons();
    });
  });

  refreshSelectedState();
  return { refreshSelectedState, setStatus };
}

export = {
  setupCustomSkinUploader
};
