'use strict';

/**
 * Create a deterministic PRNG for tests.
 *
 * The returned object provides `shuffle` (identity) and `random` (returns
 * values from the sequence cyclically).  Useful when card logic needs a PRNG
 * but the test controls the outcome.
 *
 * @param {number[]} [sequence] - Array of numbers to cycle through.
 *   Defaults to [0].
 * @returns {{ shuffle: function, random: function }} PRNG object
 */
function createPrng(sequence) {
  sequence = Array.isArray(sequence) ? sequence : [0];
  var index = 0;
  return {
    shuffle: function (arr) { return arr; },
    random: function () {
      var i = Math.min(index, sequence.length - 1);
      index += 1;
      return sequence[i];
    }
  };
}

/**
 * Create a realistic CardState with sensible defaults.
 *
 * Delegates to `CardLogic.createCardState(prng)` internally so the returned
 * state has all the standard fields (decks, hands, charge, markers, stoneIdMap,
 * pendingEffectByPlayer, etc.).  After creation, overrides are applied.
 *
 * @param {object} CardLogic - card logic module (must export createCardState)
 * @param {object} [prng] - Optional PRNG.  A deterministic default is used
 *   when omitted.
 * @param {object} [overrides] - Optional fields to merge into the state
 *   after creation.  Useful for injecting specific hand contents, charge
 *   amounts, etc.
 * @returns {object} CardState
 */
function createCardState(CardLogic, prng, overrides) {
  if (!prng || typeof prng !== 'object') {
    prng = createPrng();
  }
  var cardState = CardLogic.createCardState(prng);

  if (overrides && typeof overrides === 'object') {
    for (var key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        cardState[key] = overrides[key];
      }
    }
  }

  return cardState;
}

/**
 * Add a card to the specified player's hand.
 *
 * @param {object} cardState
 * @param {string} playerKey - 'black' or 'white'
 * @param {string} cardId - Card identifier (e.g. 'salvation_will')
 */
function addCardToHand(cardState, playerKey, cardId) {
  if (!cardState.hands) {
    cardState.hands = {};
  }
  if (!Array.isArray(cardState.hands[playerKey])) {
    cardState.hands[playerKey] = [];
  }
  cardState.hands[playerKey].push(cardId);
}

/**
 * Remove a card from the specified player's hand by index.
 *
 * @param {object} cardState
 * @param {string} playerKey - 'black' or 'white'
 * @param {number} index - Index in the hand array
 * @returns {string|null} The removed card ID, or null if the index is invalid
 */
function removeCardFromHand(cardState, playerKey, index) {
  var hand = cardState.hands && cardState.hands[playerKey];
  if (!Array.isArray(hand) || index < 0 || index >= hand.length) {
    return null;
  }
  return hand.splice(index, 1)[0] || null;
}

/**
 * Set the charge amount for a player.
 *
 * @param {object} cardState
 * @param {string} playerKey - 'black' or 'white'
 * @param {number} amount - New charge value
 */
function setCharge(cardState, playerKey, amount) {
  if (!cardState.charge) {
    cardState.charge = {};
  }
  cardState.charge[playerKey] = amount;
}

/**
 * Add a marker to the card state.
 *
 * @param {object} cardState
 * @param {string} kind - Marker type (e.g. 'bomb', 'trap', 'freeze')
 * @param {number} row
 * @param {number} col
 * @param {string} owner - 'black' or 'white'
 * @param {object} [data] - Optional extra data attached to the marker
 * @returns {object} The created marker object
 */
function addMarker(cardState, kind, row, col, owner, data) {
  if (!Array.isArray(cardState.markers)) {
    cardState.markers = [];
  }
  if (typeof cardState._nextMarkerId !== 'number') {
    cardState._nextMarkerId = 1;
  }
  if (typeof cardState._nextCreatedSeq !== 'number') {
    cardState._nextCreatedSeq = 1;
  }

  var marker = {
    id: cardState._nextMarkerId++,
    type: kind,
    row: row,
    col: col,
    owner: owner,
    data: data && typeof data === 'object' ? data : {},
    createdSeq: cardState._nextCreatedSeq++
  };

  cardState.markers.push(marker);
  return marker;
}

module.exports = {
  createPrng: createPrng,
  createCardState: createCardState,
  addCardToHand: addCardToHand,
  removeCardFromHand: removeCardFromHand,
  setCharge: setCharge,
  addMarker: addMarker
};
