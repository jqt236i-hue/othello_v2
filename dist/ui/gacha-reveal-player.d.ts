declare function isInstantPlayback(rootRef: any): boolean;
declare function resolveSpotlightPull(pulls: any[], helpersModule: any): any;
declare function resolveRevealEffectKey(rarity: any, helpersModule: any): string;
declare function createGachaRevealPlayer(options?: any): any;
declare const GachaRevealPlayerModule: {
    createGachaRevealPlayer: typeof createGachaRevealPlayer;
    resolveRevealEffectKey: typeof resolveRevealEffectKey;
    resolveSpotlightPull: typeof resolveSpotlightPull;
    isInstantPlayback: typeof isInstantPlayback;
};
export = GachaRevealPlayerModule;
//# sourceMappingURL=gacha-reveal-player.d.ts.map