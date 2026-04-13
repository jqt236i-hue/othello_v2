(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaHandCatalogModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const catalog = {
    "version": 1,
    "generatedAt": "2026-04-13T00:22:31.234Z",
    "sourceDir": "assets/images/Gacha",
    "items": [
        {
            "id": "gacha__exr__意志",
            "label": "意志",
            "note": "レアリティ EXR",
            "rarity": "EXR",
            "imagePath": "assets/images/Gacha/EXR/意志.png"
        },
        {
            "id": "gacha__ssr__邪悪な手",
            "label": "邪悪な手",
            "note": "レアリティ SSR",
            "rarity": "SSR",
            "imagePath": "assets/images/Gacha/SSR/邪悪な手.png"
        },
        {
            "id": "gacha__sr__虹の手",
            "label": "虹の手",
            "note": "レアリティ SR",
            "rarity": "SR",
            "imagePath": "assets/images/Gacha/SR/虹の手.png"
        },
        {
            "id": "gacha__r__支配の手",
            "label": "支配の手",
            "note": "レアリティ R",
            "rarity": "R",
            "imagePath": "assets/images/Gacha/R/支配の手.png"
        },
        {
            "id": "gacha__r__猫の手",
            "label": "猫の手",
            "note": "レアリティ R",
            "rarity": "R",
            "imagePath": "assets/images/Gacha/R/猫の手.png"
        },
        {
            "id": "gacha__n__魚眼ハンド",
            "label": "魚眼ハンド",
            "note": "レアリティ N",
            "rarity": "N",
            "imagePath": "assets/images/Gacha/N/魚眼ハンド.png"
        },
        {
            "id": "gacha__n__小鬼の手",
            "label": "小鬼の手",
            "note": "レアリティ N",
            "rarity": "N",
            "imagePath": "assets/images/Gacha/N/小鬼の手.png"
        },
        {
            "id": "gacha__n__人の手",
            "label": "人の手",
            "note": "レアリティ N",
            "rarity": "N",
            "imagePath": "assets/images/Gacha/N/人の手.png"
        },
        {
            "id": "gacha__n__陽気な手",
            "label": "陽気な手",
            "note": "レアリティ N",
            "rarity": "N",
            "imagePath": "assets/images/Gacha/N/陽気な手.png"
        }
    ]
};
    const frozenItems = Array.isArray(catalog.items)
        ? catalog.items.map((item) => Object.freeze(item))
        : [];
    catalog.items = Object.freeze(frozenItems);
    return Object.freeze(catalog);
}));
