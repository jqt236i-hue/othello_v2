declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const SharedConstants = _require('../../shared-constants');
const SharedBoardUtils = _require('../../shared/shared-board-utils');
const MarkersAdapter = _require('../logic/markers_adapter');
const TurnPipelinePhases = _require('../turn/turn_pipeline_phases');
const CardLogic = _require('../logic/cards');
const Core = _require('../logic/core');
const LOG_MESSAGES = _require('../log-messages');
const { getPlayerKey } = _require('../card-effects/helpers');
const GameControllerSlim = _require('../game-controller-slim');
const SpecialEffectsPresentationBridge = _require('./presentation-bridge');

function setUIImpl(impl: any): void {
    SpecialEffectsPresentationBridge.setUIImpl('bombs', impl);
}

async function processBombs(precomputedEvents: any = null): Promise<void> {
    const bombMarkers = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function')
        ? MarkersAdapter.getBombMarkers(cardState)
        : (cardState && cardState.markers ? cardState.markers.filter((m: any) => m.kind === 'specialStone' && m.data && m.data.category === 'bomb') : []);
    if (!bombMarkers || bombMarkers.length === 0) return;

    const bombOwnerValByPos = new Map<string, number>();
    for (const b of bombMarkers) {
        const ownerVal = b.owner === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        bombOwnerValByPos.set(String(b.row) + ',' + String(b.col), ownerVal);
    }

    const events = Array.isArray(precomputedEvents) ? precomputedEvents.slice() : [];
    if (events.length === 0) {
        console.error('[PROCESS-BOMBS] No precomputed pipeline events provided; skipping bomb presentation');
        return;
    }

    const bombEvents = events.filter((e: any) => e.type === 'bombs_exploded');
    if (!bombEvents || bombEvents.length === 0) {
        try { SpecialEffectsPresentationBridge.emitGameStateChange('bombs'); } catch (e) { /* ignore */ }
        return;
    }

    const hasPlayback = SpecialEffectsPresentationBridge.hasPlaybackEngine('bombs');

    const alreadyAnimated = new Set<string>();

    for (const bombEvent of bombEvents) {
        const result = (bombEvent && bombEvent.details) ? bombEvent.details : null;
        if (!result || !result.exploded || result.exploded.length === 0) continue;

        for (const pos of result.exploded) {
            SpecialEffectsPresentationBridge.emitLogAdded('bombs', LOG_MESSAGES.bombExploded(GameControllerSlim.posToNotation(pos.row, pos.col)));
        }

        if (hasPlayback) {
            try { SpecialEffectsPresentationBridge.emitBoardUpdate('bombs'); } catch (e) { /* ignore */ }
            continue;
        }

        const explodedKeySet = new Set((result.exploded || []).map((p: any) => String(p.row) + ',' + String(p.col)));
        const batch: Promise<any>[] = [];
        for (const pos of (result.destroyed || [])) {
            const key = String(pos.row) + ',' + String(pos.col);
            if (alreadyAnimated.has(key)) continue;
            alreadyAnimated.add(key);

            if (explodedKeySet.has(key)) {
                batch.push(SpecialEffectsPresentationBridge.animateFadeOutAt('bombs', pos.row, pos.col, {
                    createGhost: true,
                    color: bombOwnerValByPos.get(key)
                }));
            } else {
                batch.push(SpecialEffectsPresentationBridge.animateFadeOutAt('bombs', pos.row, pos.col));
            }
        }
        if (batch.length > 0) await Promise.all(batch);
    }

    if (!hasPlayback) {
        try { SpecialEffectsPresentationBridge.emitBoardUpdate('bombs'); } catch (e) { /* ignore */ }
        try { SpecialEffectsPresentationBridge.emitGameStateChange('bombs'); } catch (e) { /* ignore */ }
    }
}

async function explodeBombUI(row: number, col: number): Promise<void> {
    SpecialEffectsPresentationBridge.emitLogAdded('bombs', LOG_MESSAGES.bombExploded(GameControllerSlim.posToNotation(row, col)));

    if (!SharedBoardUtils || typeof SharedBoardUtils.createBoardView !== 'function') {
        throw new Error('SharedBoardUtils.createBoardView is required by SpecialEffectsBombs');
    }
    const boardView = SharedBoardUtils.createBoardView(gameState, {
        cardState,
        strict: false
    });
    const hasCellAt = (targetRow: number, targetCol: number): boolean => {
        return boardView.has(targetRow, targetCol);
    };

    const targets: any[] = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (hasCellAt(r, c)) {
                targets.push({ r, col: c, after: { color: 0, special: null, timer: null } });
            }
        }
    }

    const playAnimationEvents = SpecialEffectsPresentationBridge.readFunction('bombs', 'playAnimationEvents');
    if (typeof playAnimationEvents === 'function') {
        await SpecialEffectsPresentationBridge.playAnimationEvents('bombs', [{ type: 'destroy', phase: 3, targets }]);
    } else {
        const tasks = targets.map((t: any) => SpecialEffectsPresentationBridge.animateDestroyAt('bombs', t.r, t.col));
        await Promise.all(tasks);
    }
}

const Bombs = {
    setUIImpl,
    processBombs,
    explodeBombUI
};

export = Bombs;
