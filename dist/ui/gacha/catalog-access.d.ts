interface CatalogItem {
    id: string;
    label?: string;
    kind?: string;
    [key: string]: any;
}
interface Catalog {
    version: number;
    generatedAt: string;
    sourceDir: string;
    items: CatalogItem[];
}
interface AssetManifest {
    files: any[];
    generatedAt?: string;
    version?: string;
    [key: string]: any;
}
declare function readLoadedAssetManifest(rootRef: any, options?: any): AssetManifest | null;
declare function getObservationCatalog(options?: any): Catalog;
declare function getObservationCatalogItems(options?: any): CatalogItem[];
declare function getObservationCatalogItemsByKind(kind: string, options?: any): CatalogItem[];
declare const CatalogAccess: {
    readLoadedAssetManifest: typeof readLoadedAssetManifest;
    getObservationCatalog: typeof getObservationCatalog;
    getObservationCatalogItems: typeof getObservationCatalogItems;
    getObservationCatalogItemsByKind: typeof getObservationCatalogItemsByKind;
};
export = CatalogAccess;
//# sourceMappingURL=catalog-access.d.ts.map