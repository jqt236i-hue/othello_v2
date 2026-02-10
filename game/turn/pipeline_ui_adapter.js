/**
 * @file pipeline_ui_adapter.js
 * @description Bridge TurnPipeline event log -> browser UI via Canonical Playback Events.
 * aligns with 03-visual-rulebook.v2.txt.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TurnPipelineUIAdapter = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('../logic/markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;
    const REGEN_CAUSE = 'REGEN';
    const REGEN_TRIGGER_REASON = 'regen_triggered';
    const REGEN_CONSUMED_REASON = 'regen_consumed';
    const BATCH_DESTROY_CAUSES = new Set(['TIME_BOMB', 'ULTIMATE_DESTROY_GOD', 'CROSS_BOMB']);

    function isRegenTriggeredChange(ev) {
        return !!(ev && ev.cause === REGEN_CAUSE && ev.reason === REGEN_TRIGGER_REASON);
    }

    function isRegenConsumedStatus(ev) {
        return !!(ev && ev.meta && ev.meta.special === REGEN_CAUSE && ev.meta.reason === REGEN_CONSUMED_REASON);
    }

    function isRegenFlipStep(target, eventMeta) {
        if (!target) return false;
        const isPrimaryFlipOnRegenStone = target.reason === 'standard_flip' && eventMeta && eventMeta.special === REGEN_CAUSE;
        const isRegenBackFlip = target.cause === REGEN_CAUSE && target.reason === REGEN_TRIGGER_REASON;
        return !!(isPrimaryFlipOnRegenStone || isRegenBackFlip);
    }

    function isChainFlipPresentationEvent(ev) {
        if (!ev) return false;
        const reason = String(ev.reason || '').toLowerCase();
        const cause = String(ev.cause || '').toUpperCase();
        return reason === 'chain_flip' || cause === 'CHAIN_WILL';
    }

    /**
     * Helper to get visual state of a cell from game/card state.
     */
    function getVisualStateAt(r, c, cardState, gameState) {
        if (!gameState || !gameState.board) return { color: 0, special: null, timer: null };
        const color = gameState.board[r][c];

        // Find special stone
        let special = null;
        let timer = null;
        let owner = null;

        if (cardState && cardState.markers) {
            const s = MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function'
                ? MarkersAdapter.findSpecialMarkerAt(cardState, r, c)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.row === r && m.col === c);
            if (s) {
                special = (s.data && s.data.type) || null;
                timer = (s.data && s.data.remainingOwnerTurns) || null;
                owner = (s.owner !== undefined && s.owner !== null) ? s.owner : null;
            }
        }

        // Bomb check
        if (!special && cardState && cardState.markers) {
            const b = MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                ? MarkersAdapter.findBombMarkerAt(cardState, r, c)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === r && m.col === c);
            if (b) {
                special = 'TIME_BOMB';
                timer = (b.data && b.data.remainingTurns) || null;
                owner = (b.owner !== undefined && b.owner !== null) ? b.owner : null;
            }
        }

        return { color, special, timer, owner };
    }

    /**
     * Converts presentation events (BoardOps output) into PlaybackEvents.
     * This expects events to be JSON-safe presentationEvents as emitted by BoardOps.
     */
    function mapToPlaybackEvents(presEvents, finalCardState, finalGameState) {
        const playbackEvents = [];
        let currentPhase = 1;
        let prevWasChainFlip = false;
        let prevDestroyCause = null;

        for (const ev of presEvents || []) {
            const pEvent = {
                type: null,
                phase: currentPhase,
                targets: [],
                meta: ev.meta || null,
                rawType: ev.type,
                actionId: ev.actionId || null,
                turnIndex: (typeof ev.turnIndex === 'number') ? ev.turnIndex : (finalCardState && typeof finalCardState.turnIndex === 'number' ? finalCardState.turnIndex : 0),
                plyIndex: (typeof ev.plyIndex === 'number') ? ev.plyIndex : null
            };

            switch (ev.type) {
                case 'SPAWN':
                    prevWasChainFlip = false;
                    prevDestroyCause = null;
                    pEvent.type = 'spawn';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        stoneId: ev.stoneId,
                        ownerAfter: ev.ownerAfter,
                        cause: ev.cause || null,
                        reason: ev.reason || null
                    }];
                    break;
                case 'DESTROY':
                    prevWasChainFlip = false;
                    pEvent.type = 'destroy';
                    pEvent.targets = [{ r: ev.row, col: ev.col, stoneId: ev.stoneId, ownerBefore: ev.ownerBefore }];
                    // For area-destroy effects, keep all destroys in the same phase so UI can animate simultaneously.
                    const destroyCause = String(ev.cause || '');
                    if (BATCH_DESTROY_CAUSES.has(destroyCause)) {
                        if (prevDestroyCause !== destroyCause) {
                            currentPhase++;
                        }
                        pEvent.phase = currentPhase;
                    } else {
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    prevDestroyCause = destroyCause;
                    break;
                case 'CHANGE':
                    prevDestroyCause = null;
                    // Map CHANGE -> flip to match UI AnimationEngine expectations (Spec B)
                    pEvent.type = 'flip';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        ownerBefore: ev.ownerBefore,
                        ownerAfter: ev.ownerAfter,
                        cause: ev.cause || null,
                        reason: ev.reason || null
                    }];
                    if (isChainFlipPresentationEvent(ev) && !prevWasChainFlip) {
                        // 7.1 CHAIN_WILL: primary flips (batch) -> gap -> chain flips (batch)
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    if (isRegenTriggeredChange(ev)) {
                        // Keep "normal flip -> regen back" readable by separating phases.
                        // Without this, both flips can be batched together for the same cell.
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    prevWasChainFlip = isChainFlipPresentationEvent(ev);
                    break;
                case 'MOVE':
                    prevWasChainFlip = false;
                    prevDestroyCause = null;
                    pEvent.type = 'move';
                    pEvent.targets = [{ from: { r: ev.prevRow, col: ev.prevCol }, to: { r: ev.row, col: ev.col }, stoneId: ev.stoneId }];
                    currentPhase++;
                    pEvent.phase = currentPhase;
                    break;
                case 'STATUS_APPLIED':
                    prevWasChainFlip = false;
                    prevDestroyCause = null;
                    pEvent.type = 'status_applied';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                case 'STATUS_TICK':
                    prevWasChainFlip = false;
                    prevDestroyCause = null;
                    pEvent.type = 'status_applied';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                case 'STATUS_REMOVED':
                    prevWasChainFlip = false;
                    prevDestroyCause = null;
                    pEvent.type = 'status_removed';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    if (isRegenConsumedStatus(ev)) {
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    break;
                case 'DRAW_CARD':
                    prevWasChainFlip = false;
                    prevDestroyCause = null;
                    pEvent.type = 'hand_add';
                    pEvent.targets = [{
                        player: ev.player || null,
                        cardId: ev.cardId || null,
                        count: Number.isFinite(ev.count) ? ev.count : 1
                    }];
                    // Draw animation should run as its own readable step.
                    currentPhase++;
                    pEvent.phase = currentPhase;
                    break;
                case 'CARD_USED':
                    prevWasChainFlip = false;
                    prevDestroyCause = null;
                    pEvent.type = 'card_use_animation';
                    pEvent.targets = [{
                        player: ev.player || null,
                        owner: (ev.meta && ev.meta.owner) ? ev.meta.owner : (ev.player || null),
                        cardId: ev.cardId || null,
                        cost: (ev.meta && Number.isFinite(ev.meta.cost)) ? ev.meta.cost : null,
                        name: (ev.meta && ev.meta.name) ? ev.meta.name : null
                    }];
                    // Card-use transport is also a readable step.
                    currentPhase++;
                    pEvent.phase = currentPhase;
                    break;
                default:
                    // Unknown presentation event:
                    // keep playback resilient by ignoring silently in player-facing logs.
                    pEvent.type = null;
                    prevWasChainFlip = false;
                    prevDestroyCause = null;
                    continue;
            }

            // NOTE: Do not populate 'after' using a final snapshot. Adapter is a thin transform.
            // Instead, include minimal per-target 'after' info derived from the presentation event itself
            // so that visual writers can render based on event payload without requiring snapshots.
            if (pEvent.type !== 'log' && pEvent.type !== 'card_use_animation') {
                for (const t of pEvent.targets) {
                    // Add a best-effort 'after' using event-sourced owner fields (no final snapshot)
                    if (t.ownerAfter !== undefined) {
                        const regenFlipStep = isRegenFlipStep(t, ev.meta);
                        t.after = {
                            color: (t.ownerAfter === 'black') ? 1 : -1,
                            // For regen flow, show as normal stone between/after flips for readability.
                            special: regenFlipStep ? null : ((ev.meta && ev.meta.special) || null),
                            timer: regenFlipStep ? null : ((ev.meta && ev.meta.timer) || null),
                            owner: (ev.meta && ev.meta.owner) || null
                        };
                    } else if (pEvent.type === 'spawn') {
                        t.after = {
                            color: (t.ownerAfter === 'black') ? 1 : -1,
                            special: (ev.meta && ev.meta.special) || null,
                            timer: (ev.meta && ev.meta.timer) || null,
                            owner: (ev.meta && ev.meta.owner) || null
                        };
                    } else if (pEvent.type === 'move') {
                        t.after = {
                            color: 0,
                            special: (ev.meta && ev.meta.special) || null,
                            timer: (ev.meta && ev.meta.timer) || null,
                            owner: (ev.meta && ev.meta.owner) || null
                        };
                    } else if (pEvent.type === 'destroy') {
                        t.after = { color: 0, special: null, timer: null };
                    } else if (pEvent.type === 'status_applied' || pEvent.type === 'status_removed') {
                        const visual = getVisualStateAt(t.r, t.col, finalCardState, finalGameState);
                        const specialFromEvent = (ev.meta && ev.meta.special) || null;
                        const ownerFromEvent = (ev.meta && ev.meta.owner) || null;
                        let color = visual.color || 0;
                        if (color === 0 && (specialFromEvent === 'TRAP' || specialFromEvent === 'TRAP_REVEAL')) {
                            if (ownerFromEvent === 'black' || ownerFromEvent === 1 || ownerFromEvent === '1') color = 1;
                            if (ownerFromEvent === 'white' || ownerFromEvent === -1 || ownerFromEvent === '-1') color = -1;
                        }
                        t.after = {
                            color,
                            special: specialFromEvent || visual.special || null,
                            timer: (ev.meta && ev.meta.timer) || visual.timer || null,
                            owner: ownerFromEvent || visual.owner || null
                        };
                    } else {
                        t.after = { color: 0, special: null, timer: null };
                    }
                }
            }

            if (pEvent.type) playbackEvents.push(pEvent);
        }

        return playbackEvents;
    }

    function _playerLabel(playerKey) {
        return playerKey === 'black' ? '黒' : '白';
    }

    function _toPosText(pos) {
        if (!pos || !Number.isInteger(pos.row) || !Number.isInteger(pos.col)) return '';
        const file = String.fromCharCode('A'.charCodeAt(0) + pos.col);
        return `${file}${pos.row + 1}`;
    }

    function _specialLabelJa(rawSpecial) {
        const s = String(rawSpecial || '').toUpperCase();
        if (s === 'BREEDING') return '繁殖石';
        if (s === 'TIME_BOMB') return '時限爆弾';
        if (s === 'DRAGON') return '究極反転龍';
        if (s === 'ULTIMATE_DESTROY_GOD') return '究極破壊神';
        if (s === 'HYPERACTIVE') return '多動石';
        if (s === 'REGEN') return '復活石';
        if (s === 'WORK') return '労働石';
        if (s === 'PROTECTED') return '反転保護';
        if (s === 'PERMA_PROTECTED') return '永続反転保護';
        if (s === 'GUARD') return '守る石';
        if (s === 'TRAP' || s === 'TRAP_REVEAL') return '罠石';
        return rawSpecial || '';
    }

    function _detailCount(ev) {
        return (ev && Array.isArray(ev.details)) ? ev.details.length : 0;
    }

    function _pushCountLog(logs, ev, label, suffix) {
        logs.push(`${label}${_detailCount(ev)}${suffix}`);
    }

    function _normalizePlayerKey(v) {
        if (v === 'black' || v === 1 || v === '1') return 'black';
        if (v === 'white' || v === -1 || v === '-1') return 'white';
        return null;
    }

    function _resolveEventActorKey(ev, fallbackPlayerKey) {
        const byPlayer = _normalizePlayerKey(ev && ev.player);
        if (byPlayer) return byPlayer;
        const details = ev && Array.isArray(ev.details) ? ev.details : null;
        if (details && details.length > 0) {
            const byDetailOwner = _normalizePlayerKey(details[0] && details[0].owner);
            if (byDetailOwner) return byDetailOwner;
            const byDetailOwnerKey = _normalizePlayerKey(details[0] && details[0].ownerKey);
            if (byDetailOwnerKey) return byDetailOwnerKey;
        }
        return _normalizePlayerKey(fallbackPlayerKey) || 'black';
    }

    function _withActorPrefix(line, actorKey) {
        const text = String(line || '').trim();
        if (!text) return '';
        if (/^(黒|白):/.test(text)) return text;
        return `${_playerLabel(actorKey)}: ${text}`;
    }

    function mapEffectLogsFromPipeline(rawEvents, presEvents, playerKey) {
        const logs = [];
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        const seenStatusTick = new Set();

        for (const ev of events) {
            if (!ev || !ev.type) continue;
            const actorKey = _resolveEventActorKey(ev, playerKey);
            const push = (line) => {
                const msg = _withActorPrefix(line, actorKey);
                if (msg) logs.push(msg);
            };
            switch (ev.type) {
                case 'bombs_exploded':
                    push(`時限爆弾が${(ev.details && Array.isArray(ev.details.exploded)) ? ev.details.exploded.length : 0}箇所で爆発`);
                    break;
                case 'chain_flipped':
                    push(`連鎖: ${_detailCount(ev)}枚を追加反転`);
                    break;
                case 'dragon_converted_start':
                case 'dragon_converted_immediate':
                    push(`究極反転龍: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'dragon_destroyed_anchor_start':
                case 'dragon_destroyed_anchor_immediate':
                    push(`究極反転龍: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'breeding_spawned_start':
                case 'breeding_spawned_immediate':
                    push(`繁殖石: ${_detailCount(ev)}個を生成`);
                    break;
                case 'breeding_flipped_start':
                case 'breeding_flipped_immediate':
                    push(`繁殖石: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'breeding_destroyed_anchor_start':
                    push(`繁殖石: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'hyperactive_moved_start':
                case 'hyperactive_moved_immediate':
                    push(`多動石: ${_detailCount(ev)}回移動`);
                    break;
                case 'hyperactive_destroyed_start':
                case 'hyperactive_destroyed_immediate':
                    push(`多動石: ${_detailCount(ev)}個が消滅`);
                    break;
                case 'hyperactive_flipped_start':
                case 'hyperactive_flipped_immediate':
                    push(`多動石: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'regen_triggered_start':
                case 'regen_triggered':
                    push(`復活石: ${_detailCount(ev)}個が再生`);
                    break;
                case 'regen_capture_flipped_start':
                case 'regen_capture_flipped':
                    push(`復活石: 再生後に${_detailCount(ev)}枚を反転`);
                    break;
                case 'udg_destroyed_start':
                case 'udg_destroyed_immediate':
                    push(`究極破壊神: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'udg_expired_start':
                case 'udg_expired_immediate':
                    push(`究極破壊神: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'destroy_selected':
                    if (ev.destroyed) push(`破壊神で${_toPosText(ev.target)}を破壊`);
                    break;
                case 'strong_wind_selected':
                    if (ev.applied) push(`強風で${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動`);
                    break;
                case 'sacrifice_selected':
                    if (ev.applied) push(`生贄で${_toPosText(ev.target)}を破壊（布石+${ev.gained || 0}）`);
                    break;
                case 'sell_selected':
                    if (ev.applied) push(`売却で+${ev.gained || 0}`);
                    break;
                case 'heaven_blessing_selected':
                    if (ev.applied) push('天の恵みでカード獲得');
                    break;
                case 'condemn_selected':
                    if (ev.applied) push('断罪で相手カードを破壊');
                    break;
                case 'tempt_selected':
                    if (ev.applied) push('誘惑で特殊石を奪取');
                    break;
                case 'inherit_selected':
                    if (ev.applied) push('継承で強い石へ変換');
                    break;
                case 'swap_selected':
                    if (ev.swapped) push(`交換で${_toPosText({ row: ev.row, col: ev.col })}を変換`);
                    break;
                case 'trap_selected':
                    if (ev.applied) push('罠石がどこかに潜んでいる...');
                    break;
                case 'guard_selected':
                    if (ev.applied) push('守る意志で完全保護を付与');
                    break;
                case 'treasure_box_gain':
                    push(`宝箱: 布石+${Number(ev.gained) || 0}`);
                    break;
                case 'trap_triggered': {
                    const details = Array.isArray(ev.details) ? ev.details : [];
                    if (details.length > 0) {
                        const stolenHand = details.reduce((sum, d) => sum + (Number(d && d.stolenHandCount) || 0), 0);
                        push(`罠石が発動: 布石全没収 / 手札${stolenHand}枚没収`);
                    }
                    break;
                }
                case 'trap_expired':
                    if (_detailCount(ev) > 0) push('罠石は不発で消滅');
                    break;
                case 'trap_disarmed':
                    if (_detailCount(ev) > 0) push('罠石は不発で解除');
                    break;
                case 'placement_effects':
                    if (ev.effects) {
                        const e = ev.effects;
                        if (e.doublePlaceActivated) push('二連投石: 追加手を獲得');
                        if (e.freePlacementUsed) push('自由の意志:自由な空きマスに配置');
                        if (e.silverStoneUsed) push('銀石: 獲得布石3倍');
                        if (e.goldStoneUsed) push('金石: 獲得布石4倍');
                        if (e.protected) push('反転保護を付与');
                        if (e.permaProtected) push('永続反転保護を付与');
                        if (e.bombPlaced) push('時限爆弾を設置');
                        if (e.dragonPlaced) push('究極反転龍を設置');
                        if (e.ultimateDestroyGodPlaced) push('究極破壊神を設置');
                        if (e.hyperactivePlaced) push('多動石を設置');
                        if (e.crossBombExploded) push(`十字爆弾: ${e.crossBombDestroyed || 0}個を破壊`);
                        if (e.plunderAmount > 0) push(`吸収の意志: 布石を${e.plunderAmount}吸収`);
                        if (e.stolenCount > 0) push(`略奪: カード${e.stolenCount}枚`);
                    }
                    break;
                case 'extra_place_consumed':
                    push('二連投石: 追加手を消費');
                    break;
                default:
                    break;
            }
        }

        const pres = Array.isArray(presEvents) ? presEvents : [];
        for (const ev of pres) {
            if (!ev) continue;
            const actorKey = _resolveEventActorKey(ev, playerKey);
            const push = (line) => {
                const msg = _withActorPrefix(line, actorKey);
                if (msg) logs.push(msg);
            };
            if (ev.type === 'WORK_INCOME') {
                const gained = Number.isFinite(ev.gained) ? ev.gained : ((ev.meta && Number.isFinite(ev.meta.gained)) ? ev.meta.gained : 0);
                push(`労働石: 布石 +${gained}`);
                continue;
            }
            if (ev.type === 'WORK_REMOVED') {
                push('労働石: 効果終了');
                continue;
            }
            if (!ev || ev.type !== 'STATUS_TICK' || !ev.meta) continue;
            const special = String(ev.meta.special || '');
            const timer = ev.meta.timer;
            const key = `${special}:${ev.row},${ev.col}:${timer}`;
            if (seenStatusTick.has(key)) continue;
            seenStatusTick.add(key);
            if (special === 'TIME_BOMB' && Number.isFinite(timer)) {
                push(`時限爆弾: ${_toPosText(ev)} のカウント ${timer}`);
            } else if (special && Number.isFinite(timer)) {
                push(`${_specialLabelJa(special)}: ${_toPosText(ev)} の残り ${timer}`);
            }
        }

        // De-duplicate only consecutive identical entries.
        const compact = [];
        for (const line of logs) {
            if (!line) continue;
            if (compact.length > 0 && compact[compact.length - 1] === line) continue;
            compact.push(line);
        }
        return compact;
    }

    function mapNormalLogsFromPipeline(rawEvents, playerKey) {
        const logs = [];
        const actor = _playerLabel(playerKey);
        const events = Array.isArray(rawEvents) ? rawEvents : [];

        for (const ev of events) {
            if (!ev || !ev.type) continue;
            if (ev.type === 'place') {
                const flipCount = Array.isArray(ev.flips) ? ev.flips.length : 0;
                if (flipCount > 0) logs.push(`${actor}が${flipCount}枚反転！`);
            }
        }

        const compact = [];
        for (const line of logs) {
            if (!line) continue;
            if (compact.length > 0 && compact[compact.length - 1] === line) continue;
            compact.push(line);
        }
        return compact;
    }

    /**
     * Minimal adapter to run a placement via TurnPipeline and return both state and PlaybackEvents.
     */
    function runTurnWithAdapter(cardState, gameState, playerKey, action, turnPipeline) {
        if (!turnPipeline) throw new Error('TurnPipeline not available');

        // Build options for applyTurnSafe: include current state version and previous action ids if ActionManager is available
        const options = {};
        if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
            try {
                if (typeof ActionManager.ActionManager.getRecentActionIds === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getRecentActionIds(200);
                } else if (typeof ActionManager.ActionManager.getActions === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getActions().map(a => a.actionId).filter(Boolean);
                }
            } catch (e) { /* ignore */ }
        }
        if (cardState && typeof cardState.turnIndex === 'number') {
            options.currentStateVersion = cardState.turnIndex;
        }

        // Attempt to pass the current game PRNG (when available in browser env) to ensure deterministic rule logic
        const runtimePrng = (typeof getGamePrng === 'function') ? getGamePrng() : (typeof globalThis !== 'undefined' && typeof globalThis.getGamePrng === 'function') ? globalThis.getGamePrng() : undefined;
        const result = (typeof turnPipeline.applyTurnSafe === 'function')
            ? turnPipeline.applyTurnSafe(cardState, gameState, playerKey, action, runtimePrng, options)
            : turnPipeline.applyTurn(cardState, gameState, playerKey, action, runtimePrng);

        if (result.ok === false) {
            return { ok: false, rejectedReason: result.rejectedReason || 'UNKNOWN', events: result.events };
        }

        // Prefer pipeline-produced presentationEvents when available
        const pres = result.presentationEvents || result.cardState && result.cardState.presentationEvents || [];
        const playbackEvents = mapToPlaybackEvents(pres, result.cardState, result.gameState);
        const effectLogMessages = mapEffectLogsFromPipeline(result.events, pres, playerKey);
        const normalLogMessages = mapNormalLogsFromPipeline(result.events, playerKey);
        try {
            if (typeof emitEffectLog === 'function') {
                for (const msg of effectLogMessages) emitEffectLog(msg);
            } else if (typeof emitLogAdded === 'function') {
                for (const msg of effectLogMessages) emitLogAdded(msg, 'effect');
            }
            if (typeof emitNormalLog === 'function') {
                for (const msg of normalLogMessages) emitNormalLog(msg);
            } else if (typeof emitLogAdded === 'function') {
                for (const msg of normalLogMessages) emitLogAdded(msg, 'normal');
            }
        } catch (e) { /* ignore */ }

        return {
            ok: true,
            nextCardState: result.cardState,
            nextGameState: result.gameState,
            playbackEvents: playbackEvents,
            rawEvents: result.events,
            presentationEvents: pres,
            effectLogMessages
        };
    }

    return {
        mapToPlaybackEvents,
        mapEffectLogsFromPipeline,
        mapNormalLogsFromPipeline,
        runTurnWithAdapter
    };
}));
