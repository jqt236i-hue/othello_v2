export class MCTSTree {
    /**
     * @param {object} opts
     * @param {object} opts.gameInterface
     * @param {object} opts.network
     * @param {number} [opts.c_puct]
     * @param {number} [opts.numSimulations]
     * @param {number} [opts.temperature]
     * @param {number} [opts.fpuReduction]
     */
    constructor({ gameInterface, network, c_puct, numSimulations, temperature, fpuReduction, }: {
        gameInterface: object;
        network: object;
        c_puct?: number | undefined;
        numSimulations?: number | undefined;
        temperature?: number | undefined;
        fpuReduction?: number | undefined;
    });
    gameInterface: object;
    network: object;
    c_puct: number;
    numSimulations: number;
    temperature: number;
    fpuReduction: number;
    /** @type {Map<string, MCTSNode>} */
    nodeMap: Map<string, MCTSNode>;
    /**
     * Run MCTS and return a distribution over root actions.
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
     * Expand a leaf node using the neural network and game interface.
     *
     * @param {MCTSNode} node
     * @param {object} state
     * @param {object|null} cardState
     * @returns {Promise<number>}  Value estimate from current player's perspective
     */
    _expandNode(node: MCTSNode, state: object, cardState: object | null): Promise<number>;
}
export class MCTSNode {
    /**
     * @param {object} opts
     * @param {string} opts.stateHash
     * @param {MCTSNode|null} [opts.parent]
     * @param {object|null} [opts.action]
     * @param {number} [opts.prior]
     * @param {string|null} [opts.playerKey]
     */
    constructor({ stateHash, parent, action, prior, playerKey }: {
        stateHash: string;
        parent?: MCTSNode | null | undefined;
        action?: object | null | undefined;
        prior?: number | undefined;
        playerKey?: string | null | undefined;
    });
    stateHash: string;
    parent: MCTSNode | null;
    action: object | null;
    prior: number;
    playerKey: string | null;
    /** @type {MCTSNode[]} */
    children: MCTSNode[];
    visitCount: number;
    valueSum: number;
    isExpanded: boolean;
    get value(): number;
    /**
     * @param {number} c_puct
     * @param {number} parentVisitCount
     * @param {number} [fpuValue]
     */
    ucbScore(c_puct: number, parentVisitCount: number, fpuValue?: number): number;
    /**
     * @param {number} c_puct
     * @param {number} [fpuValue]
     * @returns {MCTSNode|null}
     */
    selectChild(c_puct: number, fpuValue?: number): MCTSNode | null;
}
//# sourceMappingURL=mcts-core.d.ts.map