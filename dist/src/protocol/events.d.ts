export function validateEvent(evt: any): {
    ok: boolean;
    reason: string;
} | {
    ok: boolean;
    reason?: undefined;
};
export function makeEvent(template: any): {
    type: any;
    phase: any;
    targets: any;
    after: any;
    createdSeq: any;
    turnIndex: any;
    eventIndex: any;
    batchKey: any;
    meta: any;
};
//# sourceMappingURL=events.d.ts.map