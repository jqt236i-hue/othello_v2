/**
 * @file gumbel-mcts.ts
 * @description Gumbel AlphaZero MCTS with Sequential Halving.
 *
 * Based on "Policy Improvement by Planning with Gumbel" (Danihelka et al., 2022).
 * Designed for low-simulation environments (2-500 sims).
 */

'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const { MCTSNode } = _require('./mcts-core');

type RandomSource = { random: () => number };

function resolveRandomSource(candidate: any): RandomSource {
  return candidate && typeof candidate.random === 'function'
    ? candidate
    : Math;
}

function readRandomUnit(rng: RandomSource): number {
  const value = Number(rng.random());
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1 - 1e-8, Math.max(1e-8, value));
}

class GumbelMCTS {
  gameInterface: any;
  network: any;
  numSimulations: number;
  maxActions: number;
  c_visit: number;
  c_scale: number;
  nodeMap: Map<string, any>;
  rng: RandomSource;

  constructor({
    gameInterface,
    network,
    numSimulations = 100,
    maxActions = 8,
    c_visit = 50.0,
    c_scale = 1.0,
    rng = null,
  }: {
    gameInterface: any;
    network: any;
    numSimulations?: number;
    maxActions?: number;
    c_visit?: number;
    c_scale?: number;
    rng?: RandomSource | null;
  }) {
    this.gameInterface = gameInterface;
    this.network = network;
    this.numSimulations = numSimulations;
    this.maxActions = maxActions;
    this.c_visit = c_visit;
    this.c_scale = c_scale;
    this.rng = resolveRandomSource(rng);
    this.nodeMap = new Map();
  }

  _sampleGumbel(n: number): Float32Array {
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = readRandomUnit(this.rng);
      noise[i] = -Math.log(-Math.log(u) + 1e-8);
    }
    return noise;
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

    // If no children, return empty
    if (root.children.length === 0) {
      return [];
    }

    // 1. Gumbel noise + policy to select top-k actions
    const gumbelNoise = this._sampleGumbel(root.children.length);
    const scoredChildren = root.children.map((child: any, i: number) => ({
      child,
      score: Math.log(Math.max(child.prior, 1e-8)) + gumbelNoise[i],
    }));
    scoredChildren.sort((a: any, b: any) => b.score - a.score);

    const k = Math.min(this.maxActions, scoredChildren.length);
    const topChildren = scoredChildren.slice(0, k).map((s: any) => s.child);

    // 2. Sequential Halving
    const budget = this.numSimulations;
    let remainingBudget = budget;
    let activeChildren = [...topChildren];

    while (activeChildren.length > 1 && remainingBudget > 0) {
      const simsPerAction = Math.max(1, Math.floor(remainingBudget / activeChildren.length));

      for (const child of activeChildren) {
        for (let s = 0; s < simsPerAction && remainingBudget > 0; s++) {
          const value = await this._simulate(child, rootState, rootCardState, rootPlayerKey);
          child.visitCount += 1;
          child.valueSum += value;
          remainingBudget--;
        }
      }

      // Sort by value and keep top half
      activeChildren.sort((a: any, b: any) => b.value - a.value);
      activeChildren = activeChildren.slice(0, Math.max(1, Math.ceil(activeChildren.length / 2)));
    }

    // 3. Compute improved policy from visit counts
    return this._computeImprovedPolicy(root);
  }

  async _simulate(child: any, rootState: any, rootCardState: any, rootPlayerKey: string): Promise<number> {
    let state = this.gameInterface.copyState(rootState);
    let cardState = rootCardState ? this.gameInterface.copyCardState(rootCardState) : null;
    let playerKey = rootPlayerKey;

    // Apply child action
    const result = this.gameInterface.applyAction(state, cardState, child.action, playerKey);
    state = result.state;
    cardState = result.cardState;
    playerKey = result.nextPlayer;

    // Check terminal
    const terminal = this.gameInterface.isTerminal(state, cardState);
    if (terminal.isTerminal) {
      return terminal.value;
    }

    // Expand and get value estimate
    const childHash = this.gameInterface.hashState(state, cardState, playerKey);
    let node = this.nodeMap.get(childHash);
    if (!node) {
      node = new MCTSNode({ stateHash: childHash, parent: child, playerKey });
      this.nodeMap.set(childHash, node);
    }

    if (!node.isExpanded) {
      const value = await this._expandNode(node, state, cardState);
      return -value; // Flip because it's from next player's perspective
    }

    return -node.value;
  }

  _computeImprovedPolicy(root: any): any[] {
    const visits = root.children.map((c: any) => c.visitCount);
    const totalVisits = visits.reduce((a: number, b: number) => a + b, 0);

    if (totalVisits === 0) {
      // Fallback to priors
      const totalPrior = root.children.reduce((sum: number, c: any) => sum + c.prior, 0);
      return root.children.map((child: any) => ({
        action: child.action,
        visitCount: 0,
        prior: child.prior,
        value: child.value,
        probability: totalPrior > 0 ? child.prior / totalPrior : 1.0 / root.children.length,
      }));
    }

    return root.children.map((child: any) => ({
      action: child.action,
      visitCount: child.visitCount,
      prior: child.prior,
      value: child.value,
      probability: child.visitCount / totalVisits,
    }));
  }

  async _expandNode(node: any, state: any, cardState: any): Promise<number> {
    const netResult = await this.network.evaluate(state, cardState, node.playerKey);
    const policy = netResult.policy;
    const value = netResult.value;

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

export = { GumbelMCTS };
