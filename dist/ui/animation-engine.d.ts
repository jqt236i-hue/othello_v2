declare class PlaybackEngine {
    constructor();
    _registerPlaybackAbortHandle(runId: any, runState: any): {
        runId: any;
        abort: () => boolean;
    } | null;
    _clearPlaybackAbortHandle(handle: any): void;
    _isPlaybackStateActive(): boolean;
    _toBoardIndex(value: any): number | null;
    _normalizeCellRef(ref: any): any;
    _normalizeTarget(target: any, eventType: any): any;
    _normalizeEvent(ev: any): any;
    _resolveSniperSource(target: any): {
        row: number;
        col: number;
    } | null;
    _resolveRobotVacuumSource(target: any): {
        row: number;
        col: number;
    } | null;
    _resolveDestroyDragonSource(target: any): {
        row: number;
        col: number;
    } | null;
    _getTargetCause(target: any): string;
    _getTargetReason(target: any): string;
    _isSuperCrushCause(cause: any): boolean;
    _resolveSuperCrushCollisionDelayMs(target: any): number;
    _resolveOwnerColorFromBefore(ownerBefore: any): any;
    _resolveOwnerClassFromColor(ownerColor: any): "black" | "white";
    _resolveVisualColorFromState(state: any, fallbackDisc: any, fallbackOwner: any): any;
    _normalizePlayerKeyOptional(value: any): any;
    _normalizePlayerKey(value: any): any;
    _getCurrentMatchMode(): string;
    _resolveLocalSeatKey(): any;
    _resolveCardUseOwnerKey(target: any): any;
    _resolveCardType(cardId: any): any;
    _resolvePlaceHandDescriptor(target: any): {
        r: any;
        col: any;
        playerKey: any;
    } | null;
    _shouldPlayPlaceHandAnimation(target: any): boolean;
    _resolvePlayerValue(playerKey: any): any;
    _isCardEffectCause(cause: any): boolean;
    _isPositiveSpawnLikeEffectTarget(eventType: any, target: any, cause: any, reason: any): boolean;
    _resolveEffectTargetHighlightTone(eventType: any, target: any): "positive" | "negative" | null;
    _shouldPreserveDiscOnDestroy(target: any): boolean;
    _resolveDestroyTargetHighlightMinimumMs(target: any): number;
    _resolveSpawnTargetHighlightMinimumMs(target: any): any;
    _resolveStatusChangeHighlightMinimumMs(highlightTone: any): any;
    _runWithEffectTargetHighlight(cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any): Promise<any>;
    _resolveStatusChangeHighlightTone(ev: any, target: any): "positive" | "negative" | null;
    _runWithTransientCellHighlight(cell: any, highlightTone: any, runner: any, minimumVisibleMs: any, extraClasses: any): Promise<any>;
    _waitForAnimationFinish(anim: any, durationMs: any, timeoutPaddingMs: any): Promise<void>;
    _waitForOpacityTransition(element: any, durationMs: any, timeoutPaddingMs: any, startTransition: any, cleanup: any): Promise<void>;
    _resolveSniperProjectileOwner(target: any): any;
    animateSniperProjectile(target: any): Promise<void>;
    animateRobotVacuumSuction(target: any): Promise<void>;
    animateDestroyDragonBreath(target: any): Promise<void>;
    animateUdgLightningStrike(target: any): Promise<void>;
    /**
     * Play a sequence of PlaybackEvents.
     * @param {Array} events - Ordered PlaybackEvents
     * @returns {Promise<void>}
     */
    play(events: any): Promise<void>;
    groupByPhase(events: any): any;
    _isSuperCrushMoveTarget(target: any): boolean;
    _buildPhaseContext(events: any): {
        superCrushDestinations: Map<any, any>;
    };
    _getSuperCrushDestinationContext(row: any, col: any): any;
    _withPhaseContext(context: any, runner: any): Promise<any>;
    _animateDestroyGhostAtCell(cell: any, ownerColor: any): Promise<void>;
    _removeDiscFromCell(cell: any, disc: any): void;
    executePhase(phaseEvents: any): Promise<void>;
    _sleep(ms: any): Promise<unknown>;
    handleWatchdog(): Promise<void>;
    abortAndSync(): void;
    executeEvent(ev: any): Promise<any>;
    handleRoundBonusBanner(ev: any): Promise<void>;
    handleSoundEffect(ev: any): Promise<void>;
    handleObserverBubble(ev: any): Promise<void>;
    handlePlace(ev: any): Promise<void>;
    handleFlip(ev: any): Promise<void>;
    executeFlipBatch(flipEvents: any): Promise<void>;
    handleDestroy(ev: any): Promise<void>;
    animateWillHunterKingSlash(target: any): Promise<void>;
    handleSpawn(ev: any): Promise<void>;
    isBreedingSpawnTarget(t: any): boolean;
    getSpawnFadeInMs(t: any): any;
    _getMoveSemantics(target: any): {
        cause: string;
        reason: string;
        isPositionSwapMove: boolean;
        isFlipEvadeMove: boolean;
        isDestroyEvadeMove: boolean;
        isTeleportMove: boolean;
        isCloneMove: boolean;
        isOverlapReturnMove: boolean;
        isExtremeForcedSwapMove: boolean;
        isHyperactiveLikeMove: boolean;
        shouldHighlightBothCells: boolean;
        shouldHideDestinationDiscDuringGhostPlayback: boolean;
        useGhostOnlyByDefault: boolean;
    };
    _getMoveHighlightCells(fromCell: any, toCell: any, moveSemantics: any): any[];
    _ensureMoveDiscVisible(discEl: any): void;
    _buildMoveGhostAnimationSpec(moveSemantics: any, deltaX: any, deltaY: any): {
        keyframes: {
            transform: string;
        }[];
        easing: string;
    };
    _resolveMoveFallbackState(target: any): any;
    _resolveMoveDiscContext(fromCell: any, toCell: any, target: any, moveSemantics: any): {
        disc: any;
        sourceCell: any;
        useGhostOnly: boolean;
    } | null;
    _moveLiveDiscToDestination(fromCell: any, toCell: any, sourceCell: any, disc: any): any;
    _applyImmediateGhostOnlyMoveTarget(target: any, toCell: any, disc: any): any;
    _setCellDiscFromState(cell: any, state: any): HTMLDivElement | null;
    _ensureAnimatedCloneMoveTarget(target: any, toCell: any): any;
    _hideMoveDestinationDiscForGhostPlayback(toCell: any, disc: any, moveSemantics: any): any;
    _hideMoveSourceDiscForGhostPlayback(disc: any, useGhostOnly: any, moveSemantics: any): boolean;
    _createMoveGhost(disc: any, fromRect: any): any;
    _createMoveGhostFromState(state: any, fromRect: any): HTMLDivElement | null;
    _settleMoveGhostIntoCell(ghost: any, cell: any, after: any): any;
    _cleanupMoveGhostPlayback(ghost: any, hiddenTargetDisc: any, discHidden: any, disc: any): void;
    _isValidMoveCellPosition(position: any): boolean;
    _hasRenderableDiscState(state: any): boolean;
    _canApplyExtremeForcedSwapFinalState(lead: any, follow: any): boolean;
    _applyExtremeForcedSwapFinalState(returnCell: any, overlapCell: any, leadAfter: any, followAfter: any): void;
    _isExtremeForcedSwapMoveEvent(ev: any): any;
    _resolveExtremeForcedSwapMoveTargets(ev: any): {
        lead: any;
        follow: any;
    } | null;
    _handleExtremeForcedSwapMove(ev: any): Promise<boolean>;
    handleMove(ev: any): Promise<void>;
    handleStatusChange(ev: any): Promise<void>;
    fadeOutFreezeOverlay(cell: any, durationMs: any): Promise<void>;
    crossfadeDiscToState(disc: any, after: any, durationMs: any): Promise<void>;
    getCellEl(r: any, c: any): any;
    waitForDisc(r: any, c: any, attempts: any): Promise<any>;
    createDisc(state: any): HTMLDivElement;
    syncDiscVisual(disc: any, state: any): void;
    syncDiscTimerOnly(disc: any, state: any): void;
    applyFinalStates(ev: any): void;
    setGlobalInteractionLock(locked: any): void;
    log(msg: any): void;
}
declare const AnimationEngine: PlaybackEngine;
export = AnimationEngine;
//# sourceMappingURL=animation-engine.d.ts.map