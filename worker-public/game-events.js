/**
 * Game Event System
 * Decouples game logic/controller from UI/animation layers
 * Uses Observer pattern for loose coupling
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.GameEvents = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    
    // ES5 Compatible GameEventEmitter Constructor
    function GameEventEmitter() {
        this.listeners = {};
    }

    /**
     * Register an event listener
     * @param {string} eventType - Event name (e.g., 'gameStateChanged', 'boardUpdated')
     * @param {Function} callback - Handler function
     */
    GameEventEmitter.prototype.on = function(eventType, callback) {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(callback);
    };

    /**
     * Unregister an event listener
     */
    GameEventEmitter.prototype.off = function(eventType, callback) {
        if (!this.listeners[eventType]) return;
        this.listeners[eventType] = this.listeners[eventType].filter(function(cb) {
            return cb !== callback;
        });
    };

    /**
     * Emit an event to all registered listeners
     * @param {string} eventType - Event name
     * @param {*} data - Event data payload
     */
    GameEventEmitter.prototype.emit = function(eventType, data) {
        if (!this.listeners[eventType]) return;
        this.listeners[eventType].forEach(function(callback) {
            try {
                callback(data);
            } catch (err) {
                console.error('Error in event handler for ' + eventType + ':', err);
            }
        });
    };

    /**
     * Remove all listeners for a given event type
     */
    GameEventEmitter.prototype.removeAllListeners = function(eventType) {
        if (eventType) {
            delete this.listeners[eventType];
        } else {
            this.listeners = {};
        }
    };

    // Global event emitter instance
    const gameEvents = new GameEventEmitter();

    // Event type constants
    const EVENT_TYPES = {
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
    };

    return {
        gameEvents,
        GameEventEmitter,
        EVENT_TYPES
    };
});
