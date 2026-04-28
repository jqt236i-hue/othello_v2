declare function normalizeCatalogItemId(value: any): string;
interface CatalogItem {
    id: string;
    label: string;
    note: string;
    imagePath: string;
    previewImagePath?: string;
    assetPath?: string;
    cssBackground?: string;
    cssClass?: string;
    [key: string]: any;
}
interface CosmeticCatalogApi {
    ALL_ITEMS: CatalogItem[];
    DEFAULT_ID: string;
    normalizeCatalogItemId: (value: any) => string;
    getAllItems: (rootRef: any) => CatalogItem[];
    listOwnedIds: (rootRef: any) => string[];
    isOwned: (rootRef: any, itemId: string) => boolean;
    getOwnedItems: (rootRef: any) => CatalogItem[];
    normalizeSelectedId: (value: any, rootRef: any, optionsArg?: any) => string;
    getDefinition: (itemId: string, rootRef: any, optionsArg?: any) => CatalogItem | null;
}
declare function createOwnedCosmeticCatalogApi(options?: any): CosmeticCatalogApi;
declare const CosmeticCatalogShared: {
    createOwnedCosmeticCatalogApi: typeof createOwnedCosmeticCatalogApi;
    normalizeCatalogItemId: typeof normalizeCatalogItemId;
};
export = CosmeticCatalogShared;
//# sourceMappingURL=catalog-shared.d.ts.map