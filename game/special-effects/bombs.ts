// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

async function processBombs(precomputedEvents: any = null): Promise<void> {
    const bombMarkers = (typeof (globalThis as any).MarkersAdapter !== 'undefined' && (globalThis as any).MarkersAdapter && typeof (globalThis as any).MarkersAdapter.getBombMarkers === 'function')
        ? (globalThis as any).MarkersAdapter.getBombMarkers((globalThis as any).cardState)
        : ((globalThis as any).cardState && (globalThis as any).cardState.markers ? (globalThis as any).cardState.markers.filter((m: any) => m.kind === 'specialStone' && m.data && m.data.category === 'bomb') : []);
    if (!bombMarkers || bombMarkers.length === 0) return;

    const bombOwnerValByPos = new Map<string, number>();
    for (const b of bombMarkers) {
        const ownerVal = b.owner === 'black' ? (globalThis as any).BLACK : (globalThis as any).WHITE;
        bombOwnerValByPos.set(String(b.row) + ',' + String(b.col), ownerVal);
    }

    const activeKey = (typeof (globalThis as any).getPlayerKey === 'function') ? (globalThis as any).getPlayerKey((globalThis as any).gameState.currentPlayer) : ((globalThis as any).gameState.currentPlayer === (globalThis as any).BLACK ? 'black' : 'white');
    const events = Array.isArray(precomputedEvents) ? precomputedEvents.slice() : [];
    if (events.length === 0) {
        if (typeof (globalThis as any).TurnPipelinePhases !== 'undefined' && typeof (globalThis as any).TurnPipelinePhases.applyTurnStartPhase === 'function') {
            (globalThis as any).TurnPipelinePhases.applyTurnStartPhase((globalThis as any).CardLogic, (globalThis as any).Core, (globalThis as any).cardState, (globalThis as any).gameState, activeKey, events);
        } else {
            console.error('[PROCESS-BOMBS] TurnPipelinePhases.applyTurnStartPhase not available; skipping bomb processing');
            return;
        }
    }

    const bombEvents = events.filter((e: any) => e.type === 'bombs_exploded');
    if (!bombEvents || bombEvents.length === 0) {
        try { if (typeof (globalThis as any).emitGameStateChange === 'function') (globalThis as any).emitGameStateChange(); } catch (e) { /* ignore */ }
        return;
    }

    const hasPlayback = (typeof globalThis !== 'undefined' && (globalThis as any).PlaybackEngine && typeof (globalThis as any).PlaybackEngine.playPresentationEvents === 'function');

    const alreadyAnimated = new Set<string>();

    for (const bombEvent of bombEvents) {
        const result = (bombEvent && bombEvent.details) ? bombEvent.details : null;
        if (!result || !result.exploded || result.exploded.length === 0) continue;

        for (const pos of result.exploded) {
            if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.bombExploded((globalThis as any).posToNotation(pos.row, pos.col)));
        }

        if (hasPlayback) {
            try { if (typeof (globalThis as any).emitBoardUpdate === 'function') (globalThis as any).emitBoardUpdate(); } catch (e) { /* ignore */ }
            continue;
        }

        const explodedKeySet = new Set((result.exploded || []).map((p: any) => String(p.row) + ',' + String(p.col)));
        const batch: Promise<any>[] = [];
        for (const pos of (result.destroyed || [])) {
            const key = String(pos.row) + ',' + String(pos.col);
            if (alreadyAnimated.has(key)) continue;
            alreadyAnimated.add(key);

            if (explodedKeySet.has(key)) {
                batch.push((globalThis as any).animateFadeOutAt(pos.row, pos.col, {
                    createGhost: true,
                    color: bombOwnerValByPos.get(key)
                }));
            } else {
                batch.push((globalThis as any).animateFadeOutAt(pos.row, pos.col));
            }
        }
        if (batch.length > 0) await Promise.all(batch);
    }

    if (!hasPlayback) {
        try { if (typeof (globalThis as any).emitBoardUpdate === 'function') (globalThis as any).emitBoardUpdate(); } catch (e) { /* ignore */ }
        try { if (typeof (globalThis as any).emitGameStateChange === 'function') (globalThis as any).emitGameStateChange(); } catch (e) { /* ignore */ }
    }
}

async function explodeBombUI(row: number, col: number): Promise<void> {
    if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.bombExploded((globalThis as any).posToNotation(row, col)));

    const hasCellAt = (targetRow: number, targetCol: number): boolean => {
        if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) return true;

        const expansion = (typeof (globalThis as any).gameState !== 'undefined' && (globalThis as any).gameState && (globalThis as any).gameState.boardExpansion && typeof (globalThis as any).gameState.boardExpansion === 'object')
            ? (globalThis as any).gameState.boardExpansion
            : null;
        if (!expansion) return false;

        const cells = Array.isArray(expansion.cells)
            ? expansion.cells
            : (expansion.active ? [expansion] : []);
        return cells.some((cell: any) => {
            if (!cell || typeof cell !== 'object') return false;
            const cellRow = Number(cell.row);
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
            return cellRow === targetRow && cellCol === targetCol;
        });
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

    if (typeof (globalThis as any).AnimationEngine !== 'undefined' && (globalThis as any).AnimationEngine && typeof (globalThis as any).AnimationEngine.play === 'function') {
        await (globalThis as any).AnimationEngine.play([{ type: 'destroy', phase: 3, targets }]);
    } else {
        const tasks = targets.map((t: any) => (globalThis as any).animateDestroyAt(t.r, t.col));
        await Promise.all(tasks);
    }
}

const Bombs = {
    processBombs,
    explodeBombUI
};

export = Bombs;
