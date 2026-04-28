declare function applyStoneVisualState(disc: HTMLElement, options?: any): void;
declare function animateStoneVisualTransition(disc: HTMLElement, options?: any): Promise<void>;
declare function crossfadeStoneVisual(disc: HTMLElement, options?: any): Promise<void>;
declare function setDiscColorAt(row: number, col: number, color: number): void;
declare function removeBombOverlayAt(row: number, col: number): void;
declare function clearAllStoneVisualEffectsAt(row: number, col: number): void;
declare function syncDiscVisualToCurrentState(row: number, col: number): void;
declare function applyPendingSpecialstoneVisual(move: any, pendingType: string): void;
declare function showChargeDelta(playerKey: string, delta: number): void;
declare const StoneVisualsModule: {
    applyStoneVisualState: typeof applyStoneVisualState;
    animateStoneVisualTransition: typeof animateStoneVisualTransition;
    crossfadeStoneVisual: typeof crossfadeStoneVisual;
    setDiscColorAt: typeof setDiscColorAt;
    removeBombOverlayAt: typeof removeBombOverlayAt;
    clearAllStoneVisualEffectsAt: typeof clearAllStoneVisualEffectsAt;
    syncDiscVisualToCurrentState: typeof syncDiscVisualToCurrentState;
    applyPendingSpecialstoneVisual: typeof applyPendingSpecialstoneVisual;
    showChargeDelta: typeof showChargeDelta;
};
export = StoneVisualsModule;
//# sourceMappingURL=stone-visuals.d.ts.map