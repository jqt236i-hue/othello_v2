/**
 * Capabilities of the normal browser ONNX gate (benchmark-policy-onnx-gate ->
 * scripts/run-ui-level-match -> game/ai/policy-onnx-runtime getStatus()).
 *
 * Each supported head names the run-ui-level-match flag that waits for it and
 * the runtime status field that proves it loaded. The card head is research
 * only (01-rulebook.md 14.1): the production browser runtime has no card head,
 * so a gate request for it is rejected up front instead of being ignored.
 */
export type BrowserGateHead = 'primary' | 'target' | 'value';

export type BrowserGateHeadDescriptor = {
    readonly head: BrowserGateHead;
    readonly requireFlag: string;
    readonly statusField: 'loaded' | 'targetModelLoaded' | 'valueModelLoaded';
    readonly modelFile: string;
};

export const BROWSER_GATE_HEADS: readonly BrowserGateHeadDescriptor[] = Object.freeze([
    Object.freeze({ head: 'primary', requireFlag: '--require-onnx-loaded', statusField: 'loaded', modelFile: 'policy-net.onnx' }),
    Object.freeze({ head: 'target', requireFlag: '--require-target-model-loaded', statusField: 'targetModelLoaded', modelFile: 'policy-target.onnx' }),
    Object.freeze({ head: 'value', requireFlag: '--require-value-model-loaded', statusField: 'valueModelLoaded', modelFile: 'policy-value.onnx' })
] as BrowserGateHeadDescriptor[]);

export const UNSUPPORTED_BROWSER_GATE_HEADS: Readonly<Record<string, string>> = Object.freeze({
    card: 'the card ONNX head is a research asset (01-rulebook.md 14.1); the production browser runtime has no card head, so the browser gate cannot verify it'
});

export function getBrowserGateHead(head: string): BrowserGateHeadDescriptor | null {
    return BROWSER_GATE_HEADS.find((descriptor) => descriptor.head === head) || null;
}

/** Throws for any head the browser gate cannot verify (unknown or research-only). */
export function assertBrowserGateHeadsSupported(heads: readonly string[], context = 'browser ONNX gate'): void {
    for (const head of heads) {
        if (getBrowserGateHead(head)) continue;
        const reason = UNSUPPORTED_BROWSER_GATE_HEADS[head] || 'unknown model head';
        throw new Error(`[${context}] unsupported head "${head}": ${reason}`);
    }
}

/** run-ui-level-match flags that wait for the requested heads. */
export function buildBrowserGateRequireFlags(heads: readonly string[]): string[] {
    assertBrowserGateHeadsSupported(heads);
    return BROWSER_GATE_HEADS.filter((descriptor) => heads.includes(descriptor.head)).map((descriptor) => descriptor.requireFlag);
}
