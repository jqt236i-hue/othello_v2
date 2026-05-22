export interface ProtocolAction {
  type: string;
  playerId: unknown;
  [key: string]: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Actions should be plain objects describing an input from a player.
export function isValidAction(action: unknown): action is ProtocolAction {
  if (!isObject(action)) return false;
  if (typeof action.type !== 'string') return false;
  if (typeof action.playerId === 'undefined') return false;
  return true;
}
