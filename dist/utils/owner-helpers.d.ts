declare function getOwnerDisplayName(owner: any): "black" | "white" | null;
declare function parseSeatKeyOptional(value: any): "black" | "white" | null;
declare function normalizePlayerKey(value: any, fallbackKey: any): "black" | "white";
declare function normalizePlayerKeyOptional(value: any): "black" | "white" | null;
declare function getOpposingPlayerKey(playerKey: any): "black" | "white" | null;
declare function resolveVisibleOwnerLayout(layout: any): {
    bottomOwnerKey: string;
    topOwnerKey: string;
};
declare function getElementOwnerKey(element: any): "black" | "white" | null;
declare function filterOwnerMatchedElements(elements: any, ownerKey: any): any[];
declare function resolveOwnerMatchedElement(elements: any, ownerKey: any, fallbackElement: any): any;
declare function resolveVisibleOwnerLayoutFromElements(bottomElement: any, topElement: any, layout: any): {
    bottomOwnerKey: string;
    topOwnerKey: string;
};
declare function isOwnerOnBottomSlot(ownerKey: any, bottomElement: any, topElement: any, layout: any): boolean;
declare function isHiddenHandToken(value: any): boolean;
declare function resolveLocalPlayerKey(rootRef: any): string | null;
declare function getFateWillControllerForTurnOwner(cardState: any, turnOwnerKey: any): "black" | "white" | null;
declare function getFateWillControlledTurnOwnerForPlayer(cardState: any, gameState: any, playerKey: any): "black" | "white" | null;
declare function getCurrentMatchMode(rootRef: any): string;
declare function isNetworkMode(rootRef: any): boolean;
declare function isValidOwner(owner: any): boolean;
declare var OwnerHelpers: {
    getOwnerDisplayName: typeof getOwnerDisplayName;
    isValidOwner: typeof isValidOwner;
    parseSeatKeyOptional: typeof parseSeatKeyOptional;
    normalizePlayerKey: typeof normalizePlayerKey;
    normalizePlayerKeyOptional: typeof normalizePlayerKeyOptional;
    getOpposingPlayerKey: typeof getOpposingPlayerKey;
    resolveVisibleOwnerLayout: typeof resolveVisibleOwnerLayout;
    getElementOwnerKey: typeof getElementOwnerKey;
    filterOwnerMatchedElements: typeof filterOwnerMatchedElements;
    resolveOwnerMatchedElement: typeof resolveOwnerMatchedElement;
    resolveVisibleOwnerLayoutFromElements: typeof resolveVisibleOwnerLayoutFromElements;
    isOwnerOnBottomSlot: typeof isOwnerOnBottomSlot;
    isHiddenHandToken: typeof isHiddenHandToken;
    resolveLocalPlayerKey: typeof resolveLocalPlayerKey;
    getFateWillControllerForTurnOwner: typeof getFateWillControllerForTurnOwner;
    getFateWillControlledTurnOwnerForPlayer: typeof getFateWillControlledTurnOwnerForPlayer;
    getCurrentMatchMode: typeof getCurrentMatchMode;
    isNetworkMode: typeof isNetworkMode;
};
export = OwnerHelpers;
//# sourceMappingURL=owner-helpers.d.ts.map