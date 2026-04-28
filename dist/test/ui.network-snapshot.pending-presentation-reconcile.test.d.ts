declare function createBoard(rows?: number, cols?: number): any[][];
declare function createPlaybackBatch(phase: any): {
    type: string;
    events: {
        type: string;
        phase: any;
        targets: {
            r: number;
            col: number;
        }[];
    }[];
}[];
//# sourceMappingURL=ui.network-snapshot.pending-presentation-reconcile.test.d.ts.map