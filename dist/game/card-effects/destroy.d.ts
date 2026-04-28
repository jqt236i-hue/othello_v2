declare function handleDestroySelection(row: number, col: number, playerKey: string): Promise<any>;
declare function executeDestroy(row: number, col: number, playerKey: string): Promise<any>;
declare const DestroyEffects: {
    handleDestroySelection: typeof handleDestroySelection;
    executeDestroy: typeof executeDestroy;
};
export = DestroyEffects;
//# sourceMappingURL=destroy.d.ts.map