function canShowSelectableFriendlyForState(state: any): boolean {
    if (!state || !state.isSelectableFriendly || state.frozen) return false;
    if (!state.blockade) return true;
    return String(state.blockade.type || '').toUpperCase() === 'METEOR_HOLE';
}

const TRANSIENT_CELL_HIGHLIGHT_CLASSES = Object.freeze([
    'effect-target-highlight',
    'effect-target-highlight-positive',
    'effect-target-highlight-placement'
]);

function getActiveTransientCellHighlightClass(cell: any): string | null {
    const value = String(
        cell &&
        cell.dataset &&
        cell.dataset.transientCellHighlightClass ||
        ''
    ).trim();
    return TRANSIENT_CELL_HIGHLIGHT_CLASSES.indexOf(value) >= 0 ? value : null;
}

function applyActiveTransientCellHighlight(cell: any): void {
    const className = getActiveTransientCellHighlightClass(cell);
    if (!className || !cell || !cell.classList) return;
    cell.classList.add(className);
}

function updateCellDOM(capabilities: any, cell: any, state: any, row: any, col: any, prevState: any) {
    const {
        board: boardCapabilities,
        playback: playbackCapabilities,
        runtime: runtimeCapabilities,
        markers: markerCapabilities,
        stones: stoneCapabilities
    } = capabilities || {};
    const {
        getBoardShape: _getBoardShapeForDiff,
        resolveGameState: _resolveGameStateForDiffRender,
        isExpansionCoordinate: _isExpansionCoordinateForDiff,
        isExpansionCell: _isExpansionCellForDiff,
        resolveExpansionSide: _resolveExpansionSideForDiff,
        applyExpansionCellPosition: _applyExpansionCellPositionForDiff,
        applyBoardGridPosition: _applyBoardGridPositionForDiff,
        applyBoardEdgeClasses: _applyBoardEdgeClassesForDiff,
        applyBoardContourEdgeClasses: _applyBoardContourEdgeClassesForDiff,
        applyTimeStopLegalEmphasis: _applyTimeStopLegalEmphasisForDiff,
        constants: { EMPTY } = {}
    } = boardCapabilities || {};
    const {
        isVisualPlaybackActive: _isVisualPlaybackActiveForDiff,
        hasPendingMoveSourceAt: _hasPendingMoveSourceAtForDiff,
        hasHyperactiveLikeState: _hasHyperactiveLikeStateForDiff,
        tryPatchTimedMarkerLabels: _tryPatchTimedMarkerLabelsForDiff,
        suppressFallbackFlip: suppressFallbackFlipThisRender,
        hasPendingFlipTargetAt: _hasPendingFlipTargetAtForDiff,
        hasRecentPlaybackFlipMarker: _hasRecentPlaybackFlipMarkerForDiff
    } = playbackCapabilities || {};
    const {
        animationShared: AnimationShared,
        window,
        location,
        sharedConstants: SharedConstants,
        timerRegistry: TimerRegistry,
        boardUpdateDispatch: BoardUpdateDispatch,
        emitBoardUpdate,
        document
    } = runtimeCapabilities || {};
    const {
        createSpecialMarkerRenderer: _createSpecialMarkerRendererForDiff
    } = markerCapabilities || {};
    const {
        constants: { BLACK, WHITE } = {},
        getDiscStoneHelper: _getDiscStoneHelperForDiff,
        createSpecialStoneStatusSnapshot: _createSpecialStoneStatusSnapshotForDiff,
        shouldShowFlipProtectionBadge: _shouldShowFlipProtectionBadgeForDiff,
        createFlipProtectionBadge: _createFlipProtectionBadgeForDiff,
        getEffectKeyForType,
        applyStoneVisualEffect,
        applyTrapStoneFallbackVisual,
        resolveSpecialDisplayTurns: _resolveSpecialDisplayTurnsForDiff,
        applyDoubleDigitTimerClass: _applyDoubleDigitTimerClassForDiff,
        getManifestAuraOwnerClass: _getManifestAuraOwnerClassForDiff
    } = stoneCapabilities || {};

    const gameState = _resolveGameStateForDiffRender();
    const boardShape = _getBoardShapeForDiff(gameState);
    const isExpansionCell = typeof _isExpansionCellForDiff === 'function'
        ? _isExpansionCellForDiff(row, col, gameState)
        : _isExpansionCoordinateForDiff(row, col, gameState);
    const expansionSide = _resolveExpansionSideForDiff(state && state.side ? state.side : null, row, col, gameState);
    const markerRenderer = _createSpecialMarkerRendererForDiff();

    // If a destroy-fade is actively running on this disc, skip re-rendering this cell
    // so we don't interrupt the disappearance animation.
    const currentDisc = cell.querySelector('.disc');
    if (currentDisc && currentDisc.classList.contains('destroy-fade')) {
        return;
    }

    // Recover from stale hidden classes/styles that can remain after playback race conditions.
    // During active playback we still skip to avoid clobbering in-flight transitions.
    if (currentDisc && (
        currentDisc.classList.contains('stone-hidden') ||
        currentDisc.classList.contains('stone-hidden-all') ||
        currentDisc.classList.contains('stone-instant')
    )) {
        const isPlaybackActive = _isVisualPlaybackActiveForDiff();
        if (isPlaybackActive) return;
        try {
            currentDisc.classList.remove('stone-hidden', 'stone-hidden-all', 'stone-instant');
            currentDisc.style.opacity = '';
            currentDisc.style.visibility = '';
        } catch (e: any) { /* ignore */ }
    }

    // Also skip if an animation overlay is active in this cell
    if (cell.querySelector('.stone-fade-overlay')) {
        return;
    }

    // If a stone is being removed and playback didn't handle it, apply a fallback destroy-fade.
    // Source cells for queued move playback become EMPTY before the motion starts, so they must
    // sync directly to empty instead of being misclassified as destroy-fades.
    if (prevState && prevState.value !== EMPTY && state.value === EMPTY && currentDisc) {
        if (_hasPendingMoveSourceAtForDiff(row, col) || _hasHyperactiveLikeStateForDiff(prevState)) {
            cell.classList.remove('has-disc');
            cell.innerHTML = '';
            return;
        }
        const noAnim = (AnimationShared && typeof AnimationShared.isNoAnim === 'function') ? AnimationShared.isNoAnim() : ((typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true) || (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)));
        if (!noAnim) {
            currentDisc.classList.add('destroy-fade');
            const fadeMs = (typeof SharedConstants !== 'undefined' && SharedConstants.DESTROY_FADE_MS)
                ? SharedConstants.DESTROY_FADE_MS
                : ((typeof window !== 'undefined' && window.DESTROY_FADE_MS) ? window.DESTROY_FADE_MS : 500);
            const timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer() : (typeof TimerRegistry !== 'undefined' ? TimerRegistry : { setTimeout: (fn: any, ms: any) => setTimeout(fn, ms) });
            timer.setTimeout(() => {
                try {
                    cell.classList.remove('has-disc');
                    cell.innerHTML = '';
                } catch (e: any) { /* ignore */ }
                try {
                    if (typeof BoardUpdateDispatch !== 'undefined' && BoardUpdateDispatch && typeof BoardUpdateDispatch.requestBoardUpdate === 'function') {
                        BoardUpdateDispatch.requestBoardUpdate();
                    } else if (typeof emitBoardUpdate === 'function') {
                        emitBoardUpdate();
                    }
                } catch (e: any) { /* ignore */ }
            }, fadeMs + 50);
            return;
        }
    }

    if (prevState && _tryPatchTimedMarkerLabelsForDiff(cell, prevState, state)) {
        return;
    }

    if (
        prevState
        && prevState.value !== EMPTY
        && state.value !== EMPTY
        && prevState.value !== state.value
        && !suppressFallbackFlipThisRender
        && (_isVisualPlaybackActiveForDiff() || _hasPendingFlipTargetAtForDiff(row, col))
    ) {
        return;
    }

    // Clear existing classes and content
    cell.className = 'cell';
    cell.innerHTML = '';
    if (isExpansionCell) {
        cell.classList.add('cell-expanded');
        if (expansionSide) {
            cell.classList.add(`cell-expanded-${expansionSide}`);
        }
        if (typeof _applyBoardGridPositionForDiff === 'function') {
            _applyBoardGridPositionForDiff(cell, row, col, gameState);
        } else {
            _applyExpansionCellPositionForDiff(cell, row, col, boardShape);
        }
    } else {
        _applyBoardEdgeClassesForDiff(cell, row, col, boardShape);
        if (typeof _applyBoardGridPositionForDiff === 'function') {
            _applyBoardGridPositionForDiff(cell, row, col, gameState);
        } else {
            cell.style.top = '';
            cell.style.left = '';
            cell.style.right = '';
            cell.style.bottom = '';
        }
    }
    if (typeof _applyBoardContourEdgeClassesForDiff === 'function') {
        _applyBoardContourEdgeClassesForDiff(cell, row, col, gameState);
    }

    // Add legal move indicators
    if (state.isLegalFree && !state.blockade && !state.frozen) {
        cell.classList.add('legal-free');
    } else if (state.isLegal && !state.blockade && !state.frozen) {
        cell.classList.add('legal');
    }
    if (state.isSelectedTargetHighlighted) {
        cell.classList.add('effect-target-highlight-positive');
    }
    if (state.isSuperAttractionPathPreview) {
        cell.classList.add('super-attraction-path-preview');
    }
    if (state.isSuperAttractionPreviewDestination) {
        cell.classList.add('super-attraction-preview-destination');
    }
    if (state.isTabooLegal && !state.blockade && !state.frozen) {
        cell.classList.add('effect-target-highlight-positive');
    }
    if (state.isRandomSpawnPreview && !state.blockade && !state.frozen) {
        cell.classList.add('random-spawn-preview');
    }
    if (canShowSelectableFriendlyForState(state)) {
        cell.classList.add('selectable-friendly');
    }
    if (state.isExtendLifeTarget && !state.blockade && !state.frozen) {
        cell.classList.add('selectable-friendly-no-circle');
    }
    applyActiveTransientCellHighlight(cell);
    _applyTimeStopLegalEmphasisForDiff(cell);

    if (state.poisonCell) {
        cell.classList.add('poison-cell');
        const poisonCellMark = markerRenderer
            ? markerRenderer.createPoisonCellMark(state.poisonCell.remainingTurns)
            : document.createElement('div');
        if (!markerRenderer) poisonCellMark.className = 'poison-cell-mark';
        cell.appendChild(poisonCellMark);
    }

    if (state.blockade) {
        cell.classList.add('blocked-cell');
        const blockedType = String(state.blockade.type || '').toUpperCase();
        const blockedVisualVariant = String(state.blockade.visualVariant || '').toUpperCase();
        if (blockedType === 'METEOR_HOLE') {
            if (blockedVisualVariant === 'BOARD_FRAME') {
                cell.classList.add('board-shrink-hole-cell');
                const innerBoundaryMask = typeof state.blockade.innerBoundaryMask === 'string'
                    ? state.blockade.innerBoundaryMask.split(',').map((edge: any) => String(edge || '').trim()).filter((edge: any) => !!edge)
                    : [];
                const holeMark = markerRenderer
                    ? markerRenderer.createHoleMark('board-shrink', innerBoundaryMask)
                    : document.createElement('div');
                if (!markerRenderer) holeMark.className = 'board-shrink-hole-mark';
                cell.appendChild(holeMark);
            } else {
                cell.classList.add('meteor-hole-cell');
                const holeMark = markerRenderer
                    ? markerRenderer.createHoleMark('meteor')
                    : document.createElement('div');
                if (!markerRenderer) holeMark.className = 'meteor-hole-mark';
                cell.appendChild(holeMark);
            }
        } else {
            const blockadeMark = markerRenderer
                ? markerRenderer.createBlockadeMark(state.blockade.remainingOwnerTurns)
                : document.createElement('div');
            if (!markerRenderer) blockadeMark.className = 'blockade-mark';
            cell.appendChild(blockadeMark);
        }
    }

    if (state.seed && state.value === EMPTY && !state.blockade) {
        cell.classList.add('seeded-cell');
        const seedMark = markerRenderer
            ? markerRenderer.createSeedMark(state.seed.remainingOwnerTurns)
            : document.createElement('div');
        if (!markerRenderer) seedMark.className = 'seed-mark';
        cell.appendChild(seedMark);
    }

    if (state.value === EMPTY && Number.isFinite(state.boardBonus) && state.boardBonus > 0) {
        cell.classList.add('has-board-bonus');
        if (state.theoryNumberCell) {
            cell.classList.add('has-theory-number-cell');
        }
        const bonusLabel = markerRenderer
            ? markerRenderer.createBonusLabel(state.boardBonus)
            : document.createElement('div');
        if (!markerRenderer) {
            bonusLabel.className = 'board-bonus-number';
            bonusLabel.textContent = String(state.boardBonus);
        }
        cell.appendChild(bonusLabel);
    }

    // Create disc if occupied
    if (state.value !== EMPTY) {
        cell.classList.add('has-disc');
        const disc = document.createElement('div');
        disc.className = 'disc ' + (state.value === BLACK ? 'black' : 'white');
        const ensureDiscSkeletonForDiff = _getDiscStoneHelperForDiff('ensureDiscSkeleton');
        const setDiscStoneImageForDiff = _getDiscStoneHelperForDiff('setDiscStoneImage');
        const getDiscHudRootForDiff = _getDiscStoneHelperForDiff('getDiscHudRoot');
        if (ensureDiscSkeletonForDiff) ensureDiscSkeletonForDiff(disc);
        const discHud = getDiscHudRootForDiff ? getDiscHudRootForDiff(disc) : disc;

        // Ensure the canonical render state for a normal stone is present before special overlays apply.
        try {
            if (setDiscStoneImageForDiff) {
                setDiscStoneImageForDiff(disc, state.value);
            } else {
                try {
                    disc.style.setProperty('--stone-image', (state.value === BLACK ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)'));
                    disc.style.setProperty('--disc-base-image', (state.value === BLACK ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)'));
                    disc.dataset.renderMode = 'base-only';
                    disc.dataset.effect = 'normal';
                } catch (e: any) { /* ignore */ }
            }
        } catch (e: any) { /* ignore */ }

        const normalizeOwnerVal = (owner: any) => {
            if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
            return WHITE;
        };
        const specialStatusSnapshot = state.special
            ? _createSpecialStoneStatusSnapshotForDiff({
                type: state.special.type,
                remainingOwnerTurns: state.special.remainingOwnerTurns,
                regenRemaining: state.special.regenRemaining,
                flipEvadeRemaining: state.special.flipEvadeRemaining,
                destroyEvadeRemaining: state.special.destroyEvadeRemaining,
                hasGuard: !!state.guard
            }, { mode: 'raw' })
            : null;
        const flipProtectionStatusInput = state.special
            ? {
                type: state.special.type,
                remainingOwnerTurns: state.special.remainingOwnerTurns,
                regenRemaining: state.special.regenRemaining,
                flipEvadeRemaining: state.special.flipEvadeRemaining,
                destroyEvadeRemaining: state.special.destroyEvadeRemaining,
                hasGuard: !!state.guard
            }
            : (state.guard ? { type: null, hasGuard: true } : null);
        if (flipProtectionStatusInput && _shouldShowFlipProtectionBadgeForDiff(flipProtectionStatusInput)) {
            const flipProtectionBadge = _createFlipProtectionBadgeForDiff(markerRenderer);
            if (flipProtectionBadge) discHud.appendChild(flipProtectionBadge);
        }
        const canShowSpecialFlipEvade = !!(
            specialStatusSnapshot &&
            specialStatusSnapshot.hasFlipEvade &&
            Number.isFinite(state.special.flipEvadeRemaining)
        );
        const canShowDestroyEvade = !!(
            specialStatusSnapshot &&
            specialStatusSnapshot.hasDestroyEvade &&
            Number.isFinite(state.special.destroyEvadeRemaining)
        );
        const canShowRegenBadge = !!(
            state.special &&
            ['REGEN', 'ZOMBIE'].includes(String(state.special.type || '').toUpperCase()) &&
            Number.isFinite(Number(state.special.regenRemaining))
        );
        if (canShowRegenBadge) {
            cell.classList.add('has-regen-badge');
        }

        // Unified special stone visual effect
        if (state.special) {
            const effectKey = getEffectKeyForType(state.special.type);
            if (effectKey) {
                applyStoneVisualEffect(disc, effectKey, { owner: normalizeOwnerVal(state.special.owner) });
            }
            // Robust fallback: ensure reveal-only trap image is visible if visual-map lookup/DI fails.
            if (state.special.type === 'TRAP_REVEAL' && typeof applyTrapStoneFallbackVisual === 'function') {
                applyTrapStoneFallbackVisual(disc, normalizeOwnerVal(state.special.owner));
            }

            // Ensure WORK visuals are applied even if mapping lookup fails
            if (state.special.type === 'WORK') {
                applyStoneVisualEffect(disc, 'workStone', { owner: normalizeOwnerVal(state.special.owner) });
            }

            // Add timer for effects with remaining turns
            const displayTurns = _resolveSpecialDisplayTurnsForDiff({
                type: state.special.type,
                remainingOwnerTurns: state.special.remainingOwnerTurns,
                regenRemaining: state.special.regenRemaining
            });
            if (displayTurns !== undefined) {
                const timerClass = (specialStatusSnapshot && specialStatusSnapshot.timerClass)
                    ? specialStatusSnapshot.timerClass
                    : 'special-timer';
                const remaining = Math.max(0, Math.trunc(Number(displayTurns)));
                const timer = markerRenderer
                    ? markerRenderer.createTimedMarkerLabel(timerClass, remaining)
                    : document.createElement('div');
                if (!markerRenderer) {
                    timer.className = timerClass;
                    timer.textContent = String(remaining);
                    _applyDoubleDigitTimerClassForDiff(timer, remaining);
                }
                discHud.appendChild(timer);
            }

            if (canShowRegenBadge) {
                const regenRemaining = Math.max(0, Math.trunc(Number(state.special.regenRemaining)));
                const isZombieRegenBadge = String(state.special.type || '').toUpperCase() === 'ZOMBIE';
                const regenBadge = markerRenderer
                    ? markerRenderer.createRegenBadgeLabel(regenRemaining, { specialType: state.special.type })
                    : document.createElement('div');
                if (!markerRenderer) {
                    regenBadge.className = 'stone-regen-badge';
                    if (isZombieRegenBadge) regenBadge.classList.add('stone-regen-badge--zombie');
                    regenBadge.setAttribute('data-count', String(regenRemaining));
                    const regenValue = document.createElement('span');
                    regenValue.className = 'stone-regen-badge-value';
                    regenValue.textContent = String(regenRemaining);
                    regenBadge.appendChild(regenValue);
                    _applyDoubleDigitTimerClassForDiff(regenBadge, regenRemaining);
                }
                discHud.appendChild(regenBadge);
            }

            if (canShowSpecialFlipEvade) {
                const specialEvadeRemaining = Math.max(0, Math.trunc(state.special.flipEvadeRemaining));
                const evadeTimer = markerRenderer
                    ? markerRenderer.createTimedMarkerLabel('stone-timer flip-evade-timer', specialEvadeRemaining)
                    : document.createElement('div');
                if (!markerRenderer) {
                    evadeTimer.className = 'stone-timer flip-evade-timer';
                    evadeTimer.textContent = String(specialEvadeRemaining);
                    _applyDoubleDigitTimerClassForDiff(evadeTimer, specialEvadeRemaining);
                }
                discHud.appendChild(evadeTimer);
            }

            if (canShowDestroyEvade) {
                const destroyEvadeRemaining = Math.max(0, Math.trunc(state.special.destroyEvadeRemaining));
                const destroyEvadeTimer = markerRenderer
                    ? markerRenderer.createTimedMarkerLabel('stone-timer destroy-evade-timer', destroyEvadeRemaining)
                    : document.createElement('div');
                if (!markerRenderer) {
                    destroyEvadeTimer.className = 'stone-timer destroy-evade-timer';
                    destroyEvadeTimer.textContent = String(destroyEvadeRemaining);
                    _applyDoubleDigitTimerClassForDiff(destroyEvadeTimer, destroyEvadeRemaining);
                }
                discHud.appendChild(destroyEvadeTimer);
            }
        }

        if (state.livingWillAura) {
            disc.classList.add('living-will-aura');
        }

        if (state.manifestAura) {
            disc.classList.add('manifest-stone-aura', `manifest-stone-aura-${_getManifestAuraOwnerClassForDiff(state.manifestAura.owner)}`);
        }

        // Add bomb UI (independent of special effects)
        if (state.bomb) {
            const bombOwnerClass = state.bomb.owner === BLACK ? 'bomb-black' : 'bomb-white';
            if (typeof applyStoneVisualEffect === 'function') {
                applyStoneVisualEffect(disc, 'timeBombStone', { owner: state.bomb.owner });
            }
            disc.classList.add('bomb', 'special-stone', bombOwnerClass);
            const bombRemaining = Math.max(0, Math.trunc(Number(state.bomb.remainingTurns)));
            const timeLabel = markerRenderer
                ? markerRenderer.createTimedMarkerLabel('bomb-timer countdown-timer', bombRemaining)
                : document.createElement('div');
            if (!markerRenderer) {
                timeLabel.className = 'bomb-timer countdown-timer';
                timeLabel.textContent = String(bombRemaining);
                _applyDoubleDigitTimerClassForDiff(timeLabel, bombRemaining);
            }
            discHud.appendChild(timeLabel);
        }

        if (state.guard && typeof state.guard.remainingOwnerTurns === 'number') {
            const guardRemaining = Math.max(0, Math.trunc(state.guard.remainingOwnerTurns));
            const guardTimer = markerRenderer
                ? markerRenderer.createGuardTimerLabel(guardRemaining)
                : document.createElement('div');
            if (!markerRenderer) {
                guardTimer.className = 'guard-timer';
                guardTimer.textContent = String(guardRemaining);
                _applyDoubleDigitTimerClassForDiff(guardTimer, guardRemaining);
            }
            discHud.appendChild(guardTimer);
        }

        if (state.poisoned && Number.isFinite(Number(state.poisoned.remainingTurns))) {
            disc.classList.add('disc-poisoned');
            const poisonBadge = markerRenderer
                ? markerRenderer.createPoisonLethalTimer(state.poisoned.remainingTurns)
                : document.createElement('div');
            if (!markerRenderer) {
                poisonBadge.className = 'poison-lethal-timer';
                poisonBadge.textContent = String(Math.max(0, Math.trunc(Number(state.poisoned.remainingTurns))));
                poisonBadge.setAttribute('aria-hidden', 'true');
            }
            discHud.appendChild(poisonBadge);
        }

        if (state.breedingSprout) {
            disc.classList.add('breeding-sprout');
            const sproutIcon = document.createElement('div');
            sproutIcon.className = 'breeding-sprout-icon';
            discHud.appendChild(sproutIcon);
        }

        cell.appendChild(disc);

        // Fallback flip animation in case PlaybackEngine path fails:
        // when a stone stays occupied but owner changes, add a quick flip class.
        const noAnim = (AnimationShared && typeof AnimationShared.isNoAnim === 'function') ? AnimationShared.isNoAnim() : ((typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true) || (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)));
        const suppressRecentPlaybackFlip = _hasRecentPlaybackFlipMarkerForDiff(currentDisc);
        if (!suppressFallbackFlipThisRender && !suppressRecentPlaybackFlip && !noAnim && prevState && prevState.value !== EMPTY && prevState.value !== state.value) {
            const flipMs = (typeof window !== 'undefined' && window.AnimationConstants && window.AnimationConstants.FLIP_MS) ? window.AnimationConstants.FLIP_MS : 600;
            try {
                if (AnimationShared && AnimationShared.triggerFlip) AnimationShared.triggerFlip(disc);
                const timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer() : (typeof TimerRegistry !== 'undefined' ? TimerRegistry : { setTimeout: (fn: any, ms: any) => setTimeout(fn, ms) });
                timer.setTimeout(() => { try { if (AnimationShared && AnimationShared.removeFlip) AnimationShared.removeFlip(disc); else disc.classList.remove('flip'); } catch (e: any) { /* Intentionally empty: DOM cleanup guard */ } }, flipMs);
            } catch (e: any) { /* ignore */ }
        }

    }

    if (state.frozen) {
        cell.classList.add('frozen-cell');
        const freezeMark = markerRenderer
            ? markerRenderer.createFreezeMark(state.frozen.remainingOwnerTurns)
            : document.createElement('div');
        if (!markerRenderer) freezeMark.className = 'freeze-mark';
        cell.appendChild(freezeMark);
    }
}

const DiffRendererDomPatcher = {
  updateCellDOM
};

export = DiffRendererDomPatcher;
