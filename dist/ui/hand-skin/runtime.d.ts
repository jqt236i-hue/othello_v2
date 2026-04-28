declare function resolveRootRef(rootRef: any): any;
declare function resolveDocument(rootRef: any): Document | null;
declare function isNetworkMode(rootRef: any): boolean;
declare function resolveNetworkMatchClient(rootRef: any): any;
declare function resolveHandVisualOptions(rootRef: any, ownerKey: any, options?: any): any;
declare function resolveHandAnimationContext(rootRef: any, preferredSkinId: any, options?: any): any;
declare function applyHandSkin(handImageEl: any, skinId: any, rootRef: any): any;
declare function syncDisplayedHandSkin(rootRef: any, preferredSkinId: any, handImageEl?: any, options?: any): any;
declare const HandSkinRuntimeModule: {
    resolveRootRef: typeof resolveRootRef;
    resolveDocument: typeof resolveDocument;
    resolveNetworkMatchClient: typeof resolveNetworkMatchClient;
    isNetworkMode: typeof isNetworkMode;
    resolveHandVisualOptions: typeof resolveHandVisualOptions;
    resolveHandAnimationContext: typeof resolveHandAnimationContext;
    applyHandSkin: typeof applyHandSkin;
    syncDisplayedHandSkin: typeof syncDisplayedHandSkin;
};
export = HandSkinRuntimeModule;
//# sourceMappingURL=runtime.d.ts.map