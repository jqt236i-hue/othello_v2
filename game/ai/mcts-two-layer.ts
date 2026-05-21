/**
 * @file mcts-two-layer.ts
 * @description Two-layer MCTS (Duelyst-style IMC) for Card Reversi.
 *
 * Layer 1: Card selection (NO_CARD or use a card)
 * Layer 2: Placement search (standard MCTS after card effect)
 *
 * This allows the model to evaluate card+placement combinations jointly
 * instead of deciding the card only at the root.
 */

'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const { MCTSTree, MCTSNode } = _require('./mcts-core');

class TwoLayerMCTS {
  gameInterface: any;
  network: any;
  cardSimulations: number;
  placementSimulations: number;
  maxCardOptions: number;
  c_puct: number;
  temperature: number;
  nodeMap: Map<string, any>;

  constructor({
    gameInterface,
    network,
    cardSimulations = 50,
    placementSimulations = 50,
    maxCardOptions = 6,
    c_puct = 1.5,
    temperature = 1.0,
  }: {
    gameInterface: any;
    network: any;
    cardSimulations?: number;
    placementSimulations?: number;
    maxCardOptions?: number;
    c_puct?: number;
    temperature?: number;
  }) {
    this.gameInterface = gameInterface;
    this.network = network;
    this.cardSimulations = cardSimulations;
    this.placementSimulations = placementSimulations;
    this.maxCardOptions = maxCardOptions;
    this.c_puct = c_puct;
    this.temperature = temperature;
    this.nodeMap = new Map();
  }

  async search(rootState: any, rootCardState: any, rootPlayerKey: string): Promise<{ cardId: string | null; placement: any }> {
    // Layer 1: Enumerate card options
    const cardOptions = this._getCardOptions(rootCardState, rootPlayerKey);
    if (cardOptions.length === 0) {
      return { cardId: null, placement: null };
    }

    // Evaluate each card option with Layer 2 MCTS
    let bestCard: string | null = null;
    let bestValue = -Infinity;
    const cardValues: { cardId: string | null; value: number }[] = [];

    for (const cardId of cardOptions) {
      const value = await this._evaluateCardOption(
        cardId, rootState, rootCardState, rootPlayerKey
      );
      cardValues.push({ cardId, value });

      if (value > bestValue) {
        bestValue = value;
        bestCard = cardId;
      }
    }

    // If NO_CARD is best, run standard placement MCTS
    if (bestCard === null || bestCard === '__no_card__') {
      const placement = await this._runPlacementMCTS(
        rootState, rootCardState, rootPlayerKey
      );
      return { cardId: null, placement };
    }

    // Apply selected card and then run placement MCTS
    const afterCard = this._applyCard(rootState, rootCardState, bestCard, rootPlayerKey);
    const placement = await this._runPlacementMCTS(
      afterCard.state, afterCard.cardState, rootPlayerKey
    );
    return { cardId: bestCard, placement };
  }

  _getCardOptions(cardState: any, playerKey: string): (string | null)[] {
    if (!cardState || !cardState.hand) {
      return [null]; // Only NO_CARD
    }
    const hand = cardState.hand[playerKey] || [];
    const options: (string | null)[] = [null]; // NO_CARD always available
    for (const card of hand.slice(0, this.maxCardOptions - 1)) {
      if (card && card.id) {
        options.push(card.id);
      }
    }
    return options;
  }

  async _evaluateCardOption(cardId: string | null, state: any, cardState: any, playerKey: string): Promise<number> {
    let nextState = state;
    let nextCardState = cardState;

    // Apply card effect if not NO_CARD
    if (cardId !== null && cardId !== '__no_card__') {
      const result = this._applyCard(state, cardState, cardId, playerKey);
      nextState = result.state;
      nextCardState = result.cardState;
    }

    // Check if game ended after card effect
    const terminal = this.gameInterface.isTerminal(nextState, nextCardState);
    if (terminal.isTerminal) {
      return terminal.value;
    }

    // Run placement MCTS to get value estimate
    const tree = new MCTSTree({
      gameInterface: this.gameInterface,
      network: this.network,
      numSimulations: this.placementSimulations,
      c_puct: this.c_puct,
      temperature: this.temperature,
    });

    const result = await tree.search(nextState, nextCardState, playerKey);
    if (!Array.isArray(result) || result.length === 0) {
      return 0;
    }

    // Return weighted average of top moves' values
    result.sort((a: any, b: any) => b.visitCount - a.visitCount);
    const topResult = result[0];
    return topResult.value - this._opportunityCost(cardId);
  }

  async _runPlacementMCTS(state: any, cardState: any, playerKey: string): Promise<any> {
    const tree = new MCTSTree({
      gameInterface: this.gameInterface,
      network: this.network,
      numSimulations: this.placementSimulations * 2, // More sims for final decision
      c_puct: this.c_puct,
      temperature: this.temperature,
    });

    const result = await tree.search(state, cardState, playerKey);
    if (!Array.isArray(result) || result.length === 0) {
      return null;
    }
    result.sort((a: any, b: any) => b.visitCount - a.visitCount);
    return result[0].action;
  }

  _applyCard(state: any, cardState: any, cardId: string, playerKey: string): { state: any; cardState: any } {
    // Delegates to gameInterface if available, otherwise does nothing
    if (this.gameInterface.applyCardEffect) {
      return this.gameInterface.applyCardEffect(state, cardState, cardId, playerKey);
    }
    // Fallback: just consume the card
    const newState = this.gameInterface.copyState(state);
    const newCardState = cardState ? this.gameInterface.copyCardState(cardState) : null;
    if (newCardState && newCardState.hand && newCardState.hand[playerKey]) {
      const hand = newCardState.hand[playerKey];
      const idx = hand.findIndex((c: any) => c && c.id === cardId);
      if (idx >= 0) {
        hand.splice(idx, 1);
      }
    }
    return { state: newState, cardState: newCardState };
  }

  _opportunityCost(cardId: string | null): number {
    if (!cardId || cardId === '__no_card__') return 0;
    // Simple heuristic: higher cost cards have higher opportunity cost
    // In a full implementation, this would use the card characteristic vector
    return 0.02; // Small penalty to encourage card usage when beneficial
  }
}

export = { TwoLayerMCTS };
