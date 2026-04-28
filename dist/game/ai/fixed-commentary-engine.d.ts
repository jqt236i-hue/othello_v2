export function isEnabled(): boolean;
export function setConfig(nextConfig: any): {
    mode: string;
    enabled: boolean;
    maxChars: number;
    regularTurnInterval: number;
    unchangedThreshold: number;
    behindThreshold: number;
};
export function getStatus(): {
    mode: string;
    enabled: boolean;
    maxChars: number;
    regularTurnInterval: number;
    unchangedThreshold: number;
    behindThreshold: number;
};
export function requestCommentary(context: any): Promise<string | null>;
export function resetState(): void;
declare function buildCommentary(context: any): string;
export { buildCommentary as _buildCommentaryForTest };
//# sourceMappingURL=fixed-commentary-engine.d.ts.map