/**
 * Game Event System
 * Decouples game logic/controller from UI/animation layers
 * Uses Observer pattern for loose coupling
 */

// ES5 Compatible GameEventEmitter Constructor
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;


export class GameEventEmitter {
    listeners: Record<string, Function[]> = {};

    /**
     * Register an event listener
     * @param {string} eventType - Event name (e.g., 'gameStateChanged', 'boardUpdated')
     * @param {Function} callback - Handler function
     */
    on(eventType: string, callback: Function): void {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(callback);
    }

    /**
     * Unregister an event listener
     */
    off(eventType: string, callback: Function): void {
        if (!this.listeners[eventType]) return;
        this.listeners[eventType] = this.listeners[eventType].filter(function(cb) {
            return cb !== callback;
        });
    }

    /**
     * Emit an event to all registered listeners
     * @param {string} eventType - Event name
     * @param {*} data - Event data payload
     */
    emit(eventType: string, data?: any): void {
        if (!this.listeners[eventType]) return;
        this.listeners[eventType].forEach(function(callback) {
            try {
                callback(data);
            } catch (err) {
                console.error('Error in event handler for ' + eventType + ':', err);
            }
        });
    }

    /**
     * Remove all listeners for a given event type
     */
    removeAllListeners(eventType?: string): void {
        if (eventType) {
            delete this.listeners[eventType];
        } else {
            this.listeners = {};
        }
    }
}

// Global event emitter instance
export const gameEvents = new GameEventEmitter();

// Event type constants
export const EVENT_TYPES = {
    // Board and game state events
    GAME_STATE_CHANGED: 'gameStateChanged',
    BOARD_UPDATED: 'boardUpdated',
    TURN_STARTED: 'turnStarted',
    TURN_ENDED: 'turnEnded',
    MOVE_MADE: 'moveMade',
    GAME_OVER: 'gameOver',
    GAME_RESET: 'gameReset',
    
    // Card events
    CARD_STATE_CHANGED: 'cardStateChanged',
    CARD_USED: 'cardUsed',
    CARD_DRAWN: 'cardDrawn',
    CARD_EFFECT_APPLIED: 'cardEffectApplied',
    
    // Special effects
    BOMB_EXPLODED: 'bombExploded',
    DRAGON_ACTIVATED: 'dragonActivated',
    STONE_PROTECTED: 'stoneProtected',
    
    // Status updates
    STATUS_UPDATED: 'statusUpdated',
    LOG_ADDED: 'logAdded',
    
    // Debug logging
    DEBUG_LOG: 'debugLog',
    DEBUG_LOG_CLEARED: 'debugLogCleared'
} as const;

export default {
    gameEvents,
    GameEventEmitter,
    EVENT_TYPES
};
