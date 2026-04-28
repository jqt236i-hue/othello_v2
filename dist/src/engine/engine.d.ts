export function run(seed: any, actions: any, opts?: {}): {
    state: {
        seed: any;
        turn: number;
        log: never[];
    };
    events: {
        type: any;
        phase: any;
        targets: any;
        after: any;
        createdSeq: any;
        turnIndex: any;
        eventIndex: any;
        batchKey: any;
        meta: any;
    }[];
};
export function defaultRng(seed: any): () => number;
//# sourceMappingURL=engine.d.ts.map