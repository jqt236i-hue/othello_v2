/**
 * @file gumbel-mcts.ts
 * @description Gumbel AlphaZero MCTS with Sequential Halving.
 *
 * Based on "Policy Improvement by Planning with Gumbel" (Danihelka et al., 2022).
 * Designed for low-simulation environments (2-500 sims).
 */
declare class GumbelMCTS {
    gameInterface: any;
    network: any;
    numSimulations: number;
    maxActions: number;
    c_visit: number;
    c_scale: number;
    nodeMap: Map<string, any>;
    constructor({ gameInterface, network, numSimulations, maxActions, c_visit, c_scale, }: {
        gameInterface: any;
        network: any;
        numSimulations?: number;
        maxActions?: number;
        c_visit?: number;
        c_scale?: number;
    });
    _sampleGumbel(n: number): Float32Array;
    search(rootState: any, rootCardState: any, rootPlayerKey: string): Promise<any[]>;
    _simulate(child: any, rootState: any, rootCardState: any, rootPlayerKey: string): Promise<number>;
    _computeImprovedPolicy(root: any): any[];
    _expandNode(node: any, state: any, cardState: any): Promise<number>;
}
declare const _default: {
    GumbelMCTS: typeof GumbelMCTS;
};
export = _default;
//# sourceMappingURL=gumbel-mcts.d.ts.map