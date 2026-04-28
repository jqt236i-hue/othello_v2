declare const engine: {
    isEnabled: () => boolean;
    setConfig: (nextConfig: any) => {
        mode: string;
        enabled: boolean;
        maxChars: number;
        regularTurnInterval: number;
        unchangedThreshold: number;
        behindThreshold: number;
    };
    getStatus: () => {
        mode: string;
        enabled: boolean;
        maxChars: number;
        regularTurnInterval: number;
        unchangedThreshold: number;
        behindThreshold: number;
    };
    requestCommentary: (context: any) => Promise<string | null>;
    resetState: () => void;
    _buildCommentaryForTest: (context: any) => string;
};
export = engine;
//# sourceMappingURL=fixed-commentary-engine.d.ts.map