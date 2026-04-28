export class GumbelMCTS {
    /**
     * @param {object} opts
     * @param {object} opts.gameInterface
     * @param {object} opts.network
     * @param {number} [opts.numSimulations]
     * @param {number} [opts.maxActions] - Top-k actions for Sequential Halving (default 8)
     * @param {number} [opts.c_visit] - UCB constant for local search (default 50.0)
     * @param {number} [opts.c_scale] - UCB scale (default 1.0)
     */
    constructor({ gameInterface, network, numSimulations, maxActions, c_visit, c_scale, }: {
        gameInterface: object;
        network: object;
        numSimulations?: number | undefined;
        maxActions?: number | undefined;
        c_visit?: number | undefined;
        c_scale?: number | undefined;
    });
    gameInterface: object;
    network: object;
    numSimulations: number;
    maxActions: number;
    c_visit: number;
    c_scale: number;
    /** @type {Map<string, MCTSNode>} */
    nodeMap: Map<string, MCTSNode>;
    /**
     * Sample Gumbel noise for Gumbel-Top-k trick.
     * @param {number} n
     * @returns {Float32Array}
     */
    _sampleGumbel(n: number): Float32Array;
    /**
     * Run Gumbel AlphaZero search.
     *
     * @param {object} rootState
     * @param {object|null} rootCardState
     * @param {string} rootPlayerKey
     * @returns {Promise<Array<{action:object, visitCount:number, prior:number, value:number, probability:number}>>}
     */
    search(rootState: object, rootCardState: object | null, rootPlayerKey: string): Promise<Array<{
        action: object;
        visitCount: number;
        prior: number;
        value: number;
        probability: number;
    }>>;
    /**
     * Simulate a single playout from a child node.
     * @param {MCTSNode} child
     * @param {object} rootState
     * @param {object|null} rootCardState
     * @param {string} rootPlayerKey
     * @returns {Promise<number>} Value from root player's perspective
     */
    _simulate(child: MCTSNode, rootState: object, rootCardState: object | null, rootPlayerKey: string): Promise<number>;
    /**
     * Compute improved policy from visit counts.
     * @param {MCTSNode} root
     * @returns {Array<{action:object, visitCount:number, prior:number, value:number, probability:number}>}
     */
    _computeImprovedPolicy(root: MCTSNode): Array<{
        action: object;
        visitCount: number;
        prior: number;
        value: number;
        probability: number;
    }>;
    /**
     * Expand a leaf node using the neural network.
     * @param {MCTSNode} node
     * @param {object} state
     * @param {object|null} cardState
     * @returns {Promise<number>} Value estimate from current player's perspective
     */
    _expandNode(node: MCTSNode, state: object, cardState: object | null): Promise<number>;
}
import { MCTSNode } from "./mcts-core";
//# sourceMappingURL=gumbel-mcts.d.ts.map