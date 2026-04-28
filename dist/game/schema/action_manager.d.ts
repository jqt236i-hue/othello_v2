declare function setActionIdGenerator(fn: any): void;
declare function setTimeProvider(tp: any): void;
declare function setStorageAdapter(adapter: any): void;
declare function generateActionId(): string;
declare const _default: {
    generateActionId: typeof generateActionId;
    ActionManager: {
        _actions: never[];
        _currentTurnIndex: number;
        _storageKey: string;
        /**
         * Reset action log (new game)
         */
        reset(): void;
        /**
         * Get current turn index
         * @returns {number}
         */
        getTurnIndex(): number;
        /**
         * Increment turn index (after successful action)
         */
        incrementTurnIndex(): void;
        /**
         * Create a new action with required fields
         * @param {string} type - 'place' | 'pass' | 'use_card' | etc.
         * @param {string} playerKey - 'black' | 'white'
         * @param {Object} [data] - Additional action data (row, col, cardId, target, etc.)
         * @returns {Object} Action with actionId, turnIndex, playerKey, type, and data
         */
        createAction(type: any, playerKey: any, data: any): any;
        /**
         * Record an action (after it succeeds)
         * - persist to storage immediately for reliability across reloads
         * @param {Object} action - The action to record
         */
        recordAction(action: any): void;
        /**
         * Get all recorded actions
         * @returns {Array}
         */
        getActions(): never[];
        /**
         * Get recent action ids (most recent first)
         * @param {number} [limit]
         * @returns {Array<string>}
         */
        getRecentActionIds(limit: any): any[];
        /**
         * Get unacknowledged actions (for server sync)
         * @returns {Array}
         */
        getUnacknowledgedActions(): any[];
        /**
         * Mark an action as acknowledged by server
         * @param {string} actionId
         */
        acknowledgeAction(actionId: any): boolean;
        /**
         * Prune acknowledged actions older than keepRecent (keep number of most recent actions)
         * @param {number} keepRecent
         */
        pruneAcknowledged(keepRecent: any): void;
        /**
         * Reconcile local actions with server-known actionIds.
         * Marks locally-known actions that the server already has as acknowledged and
         * returns the local actions that are missing on the server (to be uploaded).
         * @param {Array<string>} serverActionIds
         * @returns {Array} local actions missing on server
         */
        reconcileWithServer(serverActionIds: any): any[];
        /**
         * Get actions for export (minimal format for replay)
         * @returns {Array}
         */
        exportActions(): {
            actionId: any;
            turnIndex: any;
            playerKey: any;
            type: any;
            row: any;
            col: any;
            useCardId: any;
            destroyTarget: any;
            swapTarget: any;
            positionSwapTarget: any;
            splitTarget: any;
            temptTarget: any;
            captureTarget: any;
            expansionTarget: any;
            blockadeTarget: any;
            meteorTarget: any;
            freezeTarget: any;
            seedTarget: any;
        }[];
        /**
         * Export actions as JSON string (minimal replay-facing format)
         * @returns {string}
         */
        exportAsJSON(): string;
        /**
         * Import actions from array (for replay)
         * @param {Array} actions
         */
        importActions(actions: any): void;
        /**
         * Save actions via storage adapter (if available)
         * Stores full internal actions (includes acknowledged/timestamp)
         */
        saveToStorage(): boolean;
        /**
         * Load actions via storage adapter (if available)
         * Supports older format (array) and new format ({actions, _maxHistory})
         * @returns {boolean} true if loaded successfully
         */
        loadFromStorage(): boolean;
        /**
         * Clear saved actions from storage
         */
        clearStorage(): void;
        /**
         * Get action count
         * @returns {number}
         */
        getActionCount(): number;
        /**
         * Get last action
         * @returns {Object|null}
         */
        getLastAction(): null;
    };
    setActionIdGenerator: typeof setActionIdGenerator;
    setTimeProvider: typeof setTimeProvider;
    setStorageAdapter: typeof setStorageAdapter;
};
export = _default;
//# sourceMappingURL=action_manager.d.ts.map