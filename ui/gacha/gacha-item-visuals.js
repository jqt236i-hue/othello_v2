(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaItemVisualsModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function normalizeItemKind(item) {
        return String(item && item.kind || '').trim().toLowerCase();
    }

    function getItemKindLabel(item) {
        return normalizeItemKind(item) === 'placement_sound' ? '配置音' : '手の見た目';
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
            } else {
                imageEl.removeAttribute('src');
                imageEl.hidden = true;
            }
        }
        if (fallbackEl) {
            fallbackEl.hidden = !!previewPath;
        }
    }

    return {
        normalizeItemKind,
        getItemKindLabel,
        getItemPreviewPath,
        createSoundFallbackTile,
        applyItemPreviewState
    };
}));
