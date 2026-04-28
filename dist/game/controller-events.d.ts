/**
 * Emit a game event with optional fallback handlers
 * @param {string} eventType - The event type (from GameEvents.EVENT_TYPES)
 * @param {Array<Function>} fallbackHandlers - Functions to call if event system is unavailable
 * @param {*} data - Optional event payload
 */
export function emitGameEvent(eventType: string, fallbackHandlers: Array<Function> | undefined, data: any): boolean;
export function emitBoardUpdate(options: any): boolean;
export function emitGameStateChange(): boolean;
export function emitCardStateChange(options: any): boolean;
export function emitGameReset(data: any): boolean;
export function emitLogAdded(message: any, kind: any): void;
export function emitEffectLog(message: any): void;
export function emitNormalLog(message: any): void;
//# sourceMappingURL=controller-events.d.ts.map