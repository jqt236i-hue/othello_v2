"use strict";
/**
 * @file gacha-item-visuals.ts
 * @description Gacha item visual rendering utilities
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function normalizeItemKind(item) {
    return String(item && item.kind || '').trim().toLowerCase();
}
function getItemKindLabel(item) {
    const normalizedKind = normalizeItemKind(item);
    if (normalizedKind === 'placement_sound')
        return '配置音';
    if (normalizedKind === 'background_skin')
        return '背景';
    return '手の見た目';
}
function getItemPreviewPath(item) {
    return String(item && (item.previewImagePath || item.imagePath) || '').trim();
}
function createSoundFallbackTile(docRef, className) {
    const tile = docRef.createElement('div');
    tile.className = `gacha-item-fallback ${className}`.trim();
    const icon = docRef.createElement('div');
    icon.className = 'gacha-item-fallback-icon';
    icon.textContent = 'SOUND';
    tile.appendChild(icon);
    const note = docRef.createElement('div');
    note.className = 'gacha-item-fallback-note';
    note.textContent = '配置音';
    tile.appendChild(note);
    return tile;
}
function applyItemPreviewState(item, imageEl, fallbackEl) {
    const previewPath = getItemPreviewPath(item);
    if (imageEl) {
        if (previewPath) {
            imageEl.src = previewPath;
            imageEl.hidden = false;
        }
        else {
            imageEl.removeAttribute('src');
            imageEl.hidden = true;
        }
    }
    if (fallbackEl) {
        fallbackEl.hidden = !!previewPath;
    }
}
module.exports = {
    normalizeItemKind,
    getItemKindLabel,
    getItemPreviewPath,
    createSoundFallbackTile,
    applyItemPreviewState
};
//# sourceMappingURL=gacha-item-visuals.js.map