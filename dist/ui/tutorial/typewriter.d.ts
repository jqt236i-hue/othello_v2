/**
 * @file typewriter.ts
 * @description Typewriter effect for tutorial text
 */
interface TypewriterOptions {
    charDelayMs?: number;
    punctuationDelayMs?: number;
    onUpdate?: (text: string, state: {
        typing: boolean;
        complete: boolean;
    }) => void;
    onComplete?: (text: string) => void;
}
interface TypewriterInstance {
    start: (text: string) => void;
    reveal: () => void;
    cancel: () => void;
    isTyping: () => boolean;
    getFullText: () => string;
}
declare function createTypewriter(options: TypewriterOptions): TypewriterInstance;
declare const _default: {
    createTypewriter: typeof createTypewriter;
};
export = _default;
//# sourceMappingURL=typewriter.d.ts.map