interface SkinDefinition {
    id: string;
    label: string;
    note?: string;
    imagePath?: string;
    cssBackground?: string;
    [key: string]: any;
}
interface ControllerApi {
    refreshOptions: (preferredSkinId?: string) => void;
    getSelectedSkinId: () => string;
    selectSkin: (skinId: string) => SkinDefinition | null;
}
declare function setupBackgroundSkinControls(options?: any): ControllerApi | null;
declare const BackgroundSkinController: {
    setupBackgroundSkinControls: typeof setupBackgroundSkinControls;
};
export = BackgroundSkinController;
//# sourceMappingURL=controller.d.ts.map