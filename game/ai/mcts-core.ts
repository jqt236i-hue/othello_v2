/**
 * @file mcts-core.ts
 * @description Neural-guided MCTS (AlphaZero-style, no rollouts).
 *
 * Pure algorithm module.  Game-specific logic (legal moves, state transitions)
 * is injected via the ``gameInterface`` constructor argument so this file stays
 * free of UI/DOM dependencies.
 */

'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

class MCTSNode {
  stateHash: string;
  parent: MCTSNode | null;
  action: any;
  prior: number;
  playerKey: string | null;
  children: MCTSNode[];
  visitCount: number;
  valueSum: number;
  isExpanded: boolean;

  constructor({ stateHash, parent = null, action = null, prior = 0.0, playerKey = null }: {
    stateHash: string;
    parent?: MCTSNode | null;
    action?: any;
    prior?: number;
    playerKey?: string | null;
  }) {
    this.stateHash = stateHash;
    this.parent = parent;
    this.action = action;
    this.prior = prior;
    this.playerKey = playerKey;
    this.children = [];
    this.visitCount = 0;
    this.valueSum = 0.0;
    this.isExpanded = false;
  }

  get value(): number {
    return this.visitCount === 0 ? 0.0 : this.valueSum / this.visitCount;
  }

  ucbScore(c_puct: number, parentVisitCount: number, fpuValue = 0.0): number {
    const q = this.visitCount === 0 ? fpuValue : this.value;
    const u = c_puct * this.prior * Math.sqrt(parentVisitCount) / (1 + this.visitCount);
    return q + u;
  }

  selectChild(c_puct: number, fpuValue = 0.0): MCTSNode | null {
    let best: MCTSNode | null = null;
    let bestScore = -Infinity;
    for (const child of this.children) {
      const score = child.ucbScore(c_puct, this.visitCount, fpuValue);
      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }
    return best;
  }
}

class MCTSTree {
  gameInterface: any;
  network: any;
  c_puct: number;
  numSimulations: number;
  temperature: number;
  fpuReduction: number;
  nodeMap: Map<string, MCTSNode>;

  constructor({
    gameInterface,
    network,
    c_puct = 1.5,
    numSimulations = 400,
    temperature = 1.0,
    fpuReduction = 0.2,
  }: {
    gameInterface: any;
    network: any;
    c_puct?: number;
    numSimulations?: number;
    temperature?: number;
    fpuReduction?: number;
  }) {
    this.gameInterface = gameInterface;
    this.network = network;
    this.c_puct = c_puct;
    this.numSimulations = numSimulations;
    this.temperature = temperature;
    this.fpuReduction = fpuReduction;
    this.nodeMap = new Map();
  }

  async search(rootState: any, rootCardState: any, rootPlayerKey: string): Promise<any[]> {
    const rootHash = this.gameInterface.hashState(rootState, rootCardState, rootPlayerKey);
    let root = this.nodeMap.get(rootHash);
    if (!root) {
      root = new MCTSNode({ stateHash: rootHash, playerKey: rootPlayerKey });
      this.nodeMap.set(rootHash, root);
    }

    if (!root.isExpanded) {
      await this._expandNode(root, rootState, rootCardState);
    }

    for (let sim = 0; sim < this.numSimulations; sim++) {
      let node: MCTSNode = root;
      const path = [node];
      let state = this.gameInterface.copyState(rootState);
      let cardState = rootCardState ? this.gameInterface.copyCardState(rootCardState) : null;
      let playerKey = rootPlayerKey;

      // Selection
      while (node.isExpanded && node.children.length > 0) {
        const parentQ = node.value;
        const fpu = parentQ - this.fpuReduction;
        node = node.selectChild(this.c_puct, fpu)!;
        if (!node) break;
        path.push(node);
        const result = this.gameInterface.applyAction(state, cardState, node.action, playerKey);
        state = result.state;
        cardState = result.cardState;
        playerKey = result.nextPlayer;
      }

      // Expansion / Evaluation
      let value = 0.0;
      if (!node.isExpanded) {
        const terminal = this.gameInterface.isTerminal(state, cardState);
        if (terminal.isTerminal) {
          value = terminal.value;
        } else {
          value = await this._expandNode(node, state, cardState);
        }
      } else {
        value = node.value;
      }

      // Backup
      for (let i = path.length - 1; i >= 0; i--) {
        const n = path[i];
        n.visitCount += 1;
        if (i === path.length - 1) {
          n.valueSum += value;
        } else {
          // Flip because the value is from the perspective of the player who just moved
          n.valueSum += (-value);
          value = -value;
        }
      }
    }

    // Build visit-count distribution
    const visits = root.children.map((c: MCTSNode) => c.visitCount);
    const totalVisits = visits.reduce((a: number, b: number) => a + b, 0);
    if (totalVisits === 0) {
      return root.children.map((child: MCTSNode) => ({
        action: child.action,
        visitCount: 0,
        prior: child.prior,
        value: child.value,
        probability: child.prior,
      }));
    }

    const temp = this.temperature;
    const denom = visits.reduce((sum: number, v: number) => sum + Math.pow(Math.max(0, v), 1.0 / temp), 0);

    return root.children.map((child: MCTSNode) => {
      const prob = denom > 0 ? Math.pow(Math.max(0, child.visitCount), 1.0 / temp) / denom : 0;
      return {
        action: child.action,
        visitCount: child.visitCount,
        prior: child.prior,
        value: child.value,
        probability: prob,
      };
    });
  }

  async _expandNode(node: MCTSNode, state: any, cardState: any): Promise<number> {
    const netResult = await this.network.evaluate(state, cardState, node.playerKey);
    const policy = netResult.policy; // Map<string, number>
    const value = netResult.value;   // number in [-1, 1]

    const actions = this.gameInterface.listActions(state, cardState, node.playerKey);
    let policySum = 0.0;
    const matched: { action: any; prior: number }[] = [];
    for (const action of actions) {
      const key = this.gameInterface.actionToKey(action);
      const prior = policy.get(key) || 0.0;
      matched.push({ action, prior });
      policySum += prior;
    }

    const uniformPrior = matched.length > 0 ? 1.0 / matched.length : 0.0;
    for (const m of matched) {
      const prior = policySum > 0 ? m.prior / policySum : uniformPrior;
      const childHash = this.gameInterface.hashAfterAction(node.stateHash, m.action);
      let child = this.nodeMap.get(childHash);
      if (!child) {
        child = new MCTSNode({
          stateHash: childHash,
          parent: node,
          action: m.action,
          prior,
          playerKey: this.gameInterface.nextPlayer(node.playerKey),
        });
        this.nodeMap.set(childHash, child);
      }
      node.children.push(child);
    }

    node.isExpanded = true;
    return value;
  }
}

export = { MCTSTree, MCTSNode };
