// Minimal actions definition and helper utilities for tests
// Actions should be plain objects describing an input from a player.

function isValidAction(action) {
  if (!action || typeof action !== 'object') return false;
  if (typeof action.type !== 'string') return false;
  if (typeof action.playerId === 'undefined') return false;
  return true;
}

module.exports = { isValidAction };
