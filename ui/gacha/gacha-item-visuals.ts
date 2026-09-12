/**
 * @file gacha-item-visuals.ts
 * @description Gacha item visual rendering utilities
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface GachaItem {
  kind?: string;
  previewImagePath?: string;
  imagePath?: string;
}

function normalizeItemKind(item: GachaItem | null | undefined): string {
  return String(item && item.kind || '').trim().toLowerCase();
}

function getItemKindLabel(item: GachaItem | null | undefined): string {
  return '手の見た目';
}

function getItemPreviewPath(item: GachaItem | null | undefined): string {
  return String(item && (item.previewImagePath || item.imagePath) || '').trim();
}

function createHandFallbackTile(docRef: Document, className: string): HTMLElement {
  const tile = docRef.createElement('div');
  tile.className = `gacha-item-fallback ${className}`.trim();

  const icon = docRef.createElement('div');
  icon.className = 'gacha-item-fallback-icon';
  icon.textContent = 'HAND';
  tile.appendChild(icon);

  const note = docRef.createElement('div');
  note.className = 'gacha-item-fallback-note';
  note.textContent = '手の見た目';
  tile.appendChild(note);

  return tile;
}

function applyItemPreviewState(item: GachaItem, imageEl: HTMLImageElement | null | undefined, fallbackEl: HTMLElement | null | undefined): void {
  const previewPath = getItemPreviewPath(item);
  if (imageEl) {
    if (previewPath) {
      imageEl.src = previewPath;
      imageEl.hidden = false;
    } else {
      imageEl.removeAttribute('src');
      imageEl.hidden = true;
    }
  }
  if (fallbackEl) {
    fallbackEl.hidden = !!previewPath;
  }
}

export = {
  normalizeItemKind,
  getItemKindLabel,
  getItemPreviewPath,
  createHandFallbackTile,
  applyItemPreviewState
};
