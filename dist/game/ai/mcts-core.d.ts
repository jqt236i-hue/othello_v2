/**
 * @file mcts-core.ts
 * @description Neural-guided MCTS (AlphaZero-style, no rollouts).
 *
 * Pure algorithm module.  Game-specific logic (legal moves, state transitions)
 * is injected via the ``gameInterface`` constructor argument so this file stays
 * free of UI/DOM dependencies.
 */
declare class MCTSNode {
    stateHash: string;
    parent: MCTSNode | null;
    action: any;
    prior: number;
    playerKey: string | null;
    children: MCTSNode[];
    visitCount: number;
    valueSum: number;
    isExpanded: boolean;
    constructor({ stateHash, parent, action, prior, playerKey }: {
        stateHash: string;
        parent?: MCTSNode | null;
        action?: any;
        prior?: number;
        playerKey?: string | null;
    });
    get value(): number;
    ucbScore(c_puct: number, parentVisitCount: number, fpuValue?: number): number;
    selectChild(c_puct: number, fpuValue?: number): MCTSNode | null;
}
declare class MCTSTree {
    gameInterface: any;
    network: any;
    c_puct: number;
    numSimulations: number;
    temperature: number;
    fpuReduction: number;
    nodeMap: Map<string, MCTSNode>;
    constructor({ gameInterface, network, c_puct, numSimulations, temperature, fpuReduction, }: {
        gameInterface: any;
        network: any;
        c_puct?: number;
        numSimulations?: number;
        temperature?: number;
        fpuReduction?: number;
    });
    search(rootState: any, rootCardState: any, rootPlayerKey: string): Promise<any[]>;
    _expandNode(node: MCTSNode, state: any, cardState: any): Promise<number>;
}
declare const _default: {
    MCTSTree: typeof MCTSTree;
    MCTSNode: typeof MCTSNode;
};
export = _default;
//# sourceMappingURL=mcts-core.d.ts.map