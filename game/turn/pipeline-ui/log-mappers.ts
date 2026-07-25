type PipelineUILogMapperDeps = {
    SharedBoardUtils: any;
    SpecialStoneRegistry: any;
    OwnerHelpersModule: any;
    formatMultiPlaceActivationLog: (effects: any) => string;
    formatMultiPlaceConsumedLog: (event: any) => string;
    isWorkDurationExpiredPresentationEvent: (event: any) => boolean;
};

function _playerLabel(playerKey: any) {
    return playerKey === 'black' ? '黒' : '白';
}

function _toPosText(pos: any, deps: PipelineUILogMapperDeps) {
    if (!pos || !Number.isInteger(pos.row) || !Number.isInteger(pos.col)) return '';
    if (deps && deps.SharedBoardUtils && typeof deps.SharedBoardUtils.formatPosTextJa === 'function') {
        return deps.SharedBoardUtils.formatPosTextJa(pos);
    }
    if (pos.col === -1) return `左外${pos.row + 1}`;
    if (pos.col === 8) return `右外${pos.row + 1}`;
    const file = String.fromCharCode('A'.charCodeAt(0) + pos.col);
    return `${file}${pos.row + 1}`;
}

// Time-stop log labels for triggered/fizzled variants. Adding a new TIME_STOP_* card
// type only requires adding its markerType/cardType here plus updating presentation-helpers.
const _TIME_STOP_LOG_BY_TYPE: Record<string, string> = Object.freeze({
    time_stop_triggered: '時間停石: 時間停止が発動し、2連続で行動',
    time_stop_deity_triggered: '時間停神: 時間停止が発動し、4連続で行動',
    time_stop_fizzled: '時間停石: 親石消失で不発',
    time_stop_deity_fizzled: '時間停神: 親石消失で不発'
});

function _specialLabelJa(rawSpecial: any, deps: PipelineUILogMapperDeps) {
    if (deps && deps.SpecialStoneRegistry && typeof deps.SpecialStoneRegistry.getSpecialStoneDisplayName === 'function') {
        const displayName = deps.SpecialStoneRegistry.getSpecialStoneDisplayName(rawSpecial, null);
        if (displayName) return displayName;
    }
    const s = String(rawSpecial || '').toUpperCase();
    if (s === 'BREEDING') return '繁殖石';
    if (s === 'TIME_BOMB') return '時限爆弾';
    if (s === 'TIME_STOP') return '時間停石';
    if (s === 'TIME_STOP_DEITY') return '時間停神';
    if (s === 'DRAGON') return '究極反転龍';
    if (s === 'DESTROY_DRAGON' || s === 'DESTROY_DRAGON_WILL') return '破壊龍';
    if (s === 'ULTIMATE_DESTROY_GOD') return '究極破壊神';
    if (s === 'SNIPER') return '狙撃石';
    if (s === 'LIGHTNING') return '落雷石';
    if (s === 'METEOR_GOD') return '因果抹消神石';
    if (s === 'HYPERACTIVE') return '多動石';
    if (s === 'EXTREME_HYPERACTIVE') return '極悪多動魔';
    if (s === 'ESCAPE_HYPERACTIVE') return '逃亡石';
    if (s === 'GLUTTONOUS') return '悪食石';
    if (s === 'ULTIMATE_HYPERACTIVE') return '究極多動神';
    if (s === 'REGEN') return '復活石';
    if (s === 'WORK') return '労働石';
    if (s === 'CROSS_BOMB') return '十字爆弾';
    if (s === 'X_BOMB') return 'クロス爆弾';
    if (s === 'PROTECTED') return '反転保護';
    if (s === 'PERMA_PROTECTED') return '永続反転保護';
    if (s === 'GUARD') return '守る石';
    if (s === 'TRAP' || s === 'TRAP_REVEAL') return '罠石';
    if (s === 'BLOCKADE') return '封鎖マス';
    return rawSpecial || '';
}

function _detailCount(ev: any) {
    return (ev && Array.isArray(ev.details)) ? ev.details.length : 0;
}

function _detailGainedSum(ev: any) {
    if (!ev || !Array.isArray(ev.details)) return 0;
    return ev.details.reduce((sum: any, one: any) => sum + (Number(one && one.gained) || 0), 0);
}

function _hyperactiveLabel(ev: any, fallback: any) {
    const details = (ev && Array.isArray(ev.details)) ? ev.details : null;
    const first = details && details[0] ? details[0] : null;
    const markerType = String(first && (first.specialType || first.type) ? (first.specialType || first.type) : '').toUpperCase();
    if (markerType === 'EXTREME_HYPERACTIVE') return '極悪多動魔';
    if (markerType === 'ESCAPE_HYPERACTIVE') return '逃亡石';
    if (markerType === 'GLUTTONOUS') return '悪食石';
    return fallback;
}

function _countMatchingDetails(ev: any, predicate: any) {
    const details = (ev && Array.isArray(ev.details)) ? ev.details : [];
    return details.reduce((sum: any, detail: any) => sum + (predicate(detail) ? 1 : 0), 0);
}

function _isDurationEndRevertDetail(detail: any) {
    const reason = String(detail && detail.reason ? detail.reason : '').toLowerCase();
    return !!(detail && detail.reverted === true) || reason === 'duration_end' || reason === 'anchor_expired';
}

function _pushSplitDestroyedVsRevertedLog(push: any, ev: any, label: any, destroyedWord: any = '消滅') {
    const revertedCount = _countMatchingDetails(ev, _isDurationEndRevertDetail);
    const totalCount = _detailCount(ev);
    const destroyedCount = Math.max(0, totalCount - revertedCount);
    if (destroyedCount > 0) push(`${label}${destroyedCount}個が${destroyedWord}`);
    if (revertedCount > 0) push(`${label}${revertedCount}個が通常石に戻る`);
}

function _formatCrystalStonePlacementLog(effects: any) {
    const gain = Number.isFinite(Number(effects && effects.crystalStoneGain))
        ? Math.max(0, Number(effects.crystalStoneGain))
        : 0;
    return `演算の意志：数字マス布石 +${gain}（2倍）`;
}

function _normalizePlayerKey(v: any, deps: PipelineUILogMapperDeps) {
    if (deps && deps.OwnerHelpersModule && typeof deps.OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
        const normalized = deps.OwnerHelpersModule.normalizePlayerKeyOptional(v);
        if (normalized) return normalized;
    }
    if (v === 'black' || v === 1 || v === '1') return 'black';
    if (v === 'white' || v === -1 || v === '-1') return 'white';
    return null;
}

function _resolveEventActorKey(ev: any, fallbackPlayerKey: any, deps: PipelineUILogMapperDeps) {
    const byPlayer = _normalizePlayerKey(ev && ev.player, deps);
    if (byPlayer) return byPlayer;
    const details = ev && Array.isArray(ev.details) ? ev.details : null;
    if (details && details.length > 0) {
        const byDetailOwner = _normalizePlayerKey(details[0] && details[0].owner, deps);
        if (byDetailOwner) return byDetailOwner;
        const byDetailOwnerKey = _normalizePlayerKey(details[0] && details[0].ownerKey, deps);
        if (byDetailOwnerKey) return byDetailOwnerKey;
    }
    return _normalizePlayerKey(fallbackPlayerKey, deps) || 'black';
}

function _withActorPrefix(line: any, actorKey: any) {
    const text = String(line || '').trim();
    if (!text) return '';
    if (/^(黒|白):/.test(text)) return text;
    return `${_playerLabel(actorKey)}: ${text}`;
}

function mapEffectLogsFromPipeline(rawEvents: any, presEvents: any, playerKey: any, deps: PipelineUILogMapperDeps) {
    const logs: any[] = [];
    const events = Array.isArray(rawEvents) ? rawEvents : [];
    const seenStatusTick = new Set();

    for (const ev of events) {
        if (!ev || !ev.type) continue;
        const actorKey = _resolveEventActorKey(ev, playerKey, deps);
        const push = (line: any) => {
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
            case 'taboo_reverse_flipped':
                push(`禁忌の反転: ${_detailCount(ev)}枚を反転`);
                break;
            case 'dragon_converted_start':
            case 'dragon_converted_immediate':
                push(`究極反転龍: ${_detailCount(ev)}枚を反転`);
                break;
            case 'dragon_moved_start':
            case 'dragon_moved_immediate':
                push(`究極反転龍: ${_detailCount(ev)}回移動`);
                break;
            case 'dragon_destroyed_anchor_start':
            case 'dragon_destroyed_anchor_immediate':
                push(`究極反転龍: 親石${_detailCount(ev)}個が通常石に戻る`);
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
                push(`繁殖石: 親石${_detailCount(ev)}個が通常石に戻る`);
                break;
            case 'hyperactive_moved_start':
            case 'hyperactive_moved_immediate':
                push(`${_hyperactiveLabel(ev, '多動石')}: ${_detailCount(ev)}回移動`);
                break;
            case 'hyperactive_destroyed_start':
            case 'hyperactive_destroyed_immediate':
                _pushSplitDestroyedVsRevertedLog(push, ev, `${_hyperactiveLabel(ev, '多動石')}: `);
                break;
            case 'hyperactive_flipped_start':
            case 'hyperactive_flipped_immediate':
                push(`${_hyperactiveLabel(ev, '多動石')}: ${_detailCount(ev)}枚を反転`);
                break;
            case 'extreme_hyperactive_repelled_start':
            case 'extreme_hyperactive_repelled_immediate':
                push(`極悪多動魔: 隣接石を${_detailCount(ev)}個退避`);
                break;
            case 'robot_vacuum_moved_start':
            case 'robot_vacuum_moved_immediate':
                push(`ロボット掃除機石: ${_detailCount(ev)}回移動`);
                break;
            case 'robot_vacuum_sucked_start':
            case 'robot_vacuum_sucked_immediate':
                push(`ロボット掃除機石: ${_detailCount(ev)}個を吸い込み`);
                break;
            case 'robot_vacuum_destroyed_start':
            case 'robot_vacuum_destroyed_immediate':
                push(`ロボット掃除機石: ${_detailCount(ev)}個が消滅`);
                break;
            case 'robot_vacuum_expired_start':
                push(`ロボット掃除機石: ${_detailCount(ev)}個が通常石に戻る`);
                break;
            case 'robot_vacuum_flipped_start':
            case 'robot_vacuum_flipped_immediate':
                push(`ロボット掃除機石: ${_detailCount(ev)}枚を反転`);
                break;
            case 'ultimate_hyperactive_moved_start':
            case 'ultimate_hyperactive_moved_immediate':
                push(`究極多動神: ${_detailCount(ev)}回移動`);
                break;
            case 'ultimate_hyperactive_destroyed_start':
            case 'ultimate_hyperactive_destroyed_immediate':
                _pushSplitDestroyedVsRevertedLog(push, ev, '究極多動神: ');
                break;
            case 'ultimate_hyperactive_flipped_start':
            case 'ultimate_hyperactive_flipped_immediate':
                push(`究極多動神: ${_detailCount(ev)}枚を反転`);
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
            case 'udg_moved_start':
            case 'udg_moved_immediate':
                push(`究極破壊神: ${_detailCount(ev)}回移動`);
                break;
            case 'udg_expired_start':
            case 'udg_expired_immediate':
                push(`究極破壊神: 親石${_detailCount(ev)}個が通常石に戻る`);
                break;
            case 'destroy_dragon_destroyed_start':
            case 'destroy_dragon_destroyed_immediate':
                push(`破壊龍: ${_detailCount(ev)}個を破壊`);
                break;
            case 'destroy_dragon_expired_start':
            case 'destroy_dragon_expired_immediate':
                push(`破壊龍: 親石${_detailCount(ev)}個が通常石に戻る`);
                break;
            case 'sniper_destroyed_start':
            case 'sniper_destroyed_immediate':
                push(`狙撃石: ${_detailCount(ev)}個を破壊`);
                break;
            case 'sniper_expired_start':
            case 'sniper_expired_immediate':
                push(`狙撃石: 親石${_detailCount(ev)}個が通常石に戻る`);
                break;
            case 'lightning_destroyed_start':
            case 'lightning_destroyed_immediate':
                push(`落雷石: ${_detailCount(ev)}個を破壊`);
                break;
            case 'lightning_expired_start':
            case 'lightning_expired_immediate':
                push(`落雷石: 親石${_detailCount(ev)}個が通常石に戻る`);
                break;
            case 'meteor_god_destroyed_start':
            case 'meteor_god_destroyed_immediate':
                push(`因果抹消神石: ${_detailCount(ev)}個を穴化`);
                break;
            case 'meteor_god_expired_start':
            case 'meteor_god_expired_immediate':
                push(`因果抹消神石: 親石${_detailCount(ev)}個が通常石に戻る`);
                break;
            case 'will_hunter_king_destroyed_start':
            case 'will_hunter_king_destroyed_immediate':
                push(`意志狩りの王: ${_detailCount(ev)}個を斬撃破壊`);
                break;
            case 'will_hunter_king_moved_start':
            case 'will_hunter_king_moved_immediate':
                push(`意志狩りの王: ${_detailCount(ev)}回移動`);
                break;
            case 'will_hunter_king_expired_start':
            case 'will_hunter_king_expired_immediate':
                push(`意志狩りの王: 親石${_detailCount(ev)}個が通常石に戻る`);
                break;
            case 'time_stop_triggered':
                push('時間停石: 時間停止が発動し、2連続で行動');
                break;
            case 'time_stop_deity_triggered':
                push('時間停神: 時間停止が発動し、4連続で行動');
                break;
            case 'time_stop_deity_fizzled':
                push('時間停神: 親石消失で不発');
                break;
            case 'time_stop_fizzled':
                push('時間停石: 親石消失で不発');
                break;
            case 'zombie_infected_start':
                if (_detailCount(ev) > 0) push(`ゾンビの意志: 屍石が感染させた個`);
                break;
            case 'clone_selected':
                if (ev.applied) push(`複製の意志: ${_toPosText(ev.target, deps)}から${_detailCount(ev)}個を生成`);
                break;
            case 'board_expansion_first_selected':
                if (ev.applied) push(`盤面拡張神: 1つ目に${_toPosText(ev.target, deps)}を選択`);
                break;
            case 'board_expansion_selected':
                if (ev.applied) {
                    if (ev.cardType === 'BOARD_EXPANSION_GOD') {
                        const addedCount = Array.isArray(ev.added) ? ev.added.length : 0;
                        push(`盤面拡張神: 2角から${addedCount || 6}マス拡張`);
                    } else {
                        const sideLabel = ev.side === 'left' ? '左' : (ev.side === 'right' ? '右' : '左右');
                        push(`盤面拡張: ${sideLabel}側へ1マス拡張`);
                    }
                }
                break;
            case 'board_shrink_selected':
                if (ev.applied) {
                    if (ev.completed === false) {
                        if (ev.cardType === 'BOARD_SHRINK_GOD') {
                            push(`盤面縮小神: 1つ目に${_toPosText(ev.firstTarget || ev.target, deps)}を選択`);
                        } else {
                            const remaining = Number(ev.remainingSelections) || 0;
                            push(`盤面縮小: 連続外周マスを選択（残り${remaining}）`);
                        }
                    } else {
                        const changedCount = Array.isArray(ev.changedTargets) ? ev.changedTargets.length : 0;
                        push(ev.cardType === 'BOARD_SHRINK_GOD'
                            ? `盤面縮小神: ${changedCount}マスを穴化`
                            : `盤面縮小: ${changedCount}マスを穴化`);
                    }
                }
                break;
            case 'blockade_selected':
                if (ev.applied) push(`封鎖の意志: ${_toPosText(ev.target, deps)}を3ターン封鎖`);
                break;
            case 'meteor_selected':
                if (ev.applied) push(`因果抹消: ${_toPosText(ev.target, deps)}をマスごと破壊`);
                break;
            case 'freeze_selected':
                if (ev.applied) push(`凍結の意志: ${_toPosText(ev.target, deps)}を5ターン凍結`);
                break;
            case 'mass_freeze_will_resolved':
                push(`意志の凍結: 特殊石${Number(ev.frozenCount) || 0}個を5ターン凍結`);
                break;
            case 'heaven_blessing_selected':
                if (ev.applied) push('天の恵みでカード獲得');
                break;
            case 'condemn_selected':
                if (ev.applied) push('断罪で相手カードを破壊');
                break;
            case 'observer_will_selected':
                if (ev.applied) push('盤理の観測者で相手カードを獲得');
                break;
            case 'destroy_selected':
                if (ev.regenerated) {
                    push(`破壊の意志: ${_toPosText(ev.target, deps)} は復活した`);
                } else if (ev.destroyed) {
                    push(`破壊の意志で${_toPosText(ev.target, deps)}を破壊`);
                }
                break;
            case 'salvation_will_resolved':
                push(`救済の意志: 破壊石${Number(ev.spawnedCount) || 0}個を通常石として救済、${Number(ev.flippedCount) || 0}枚を反転`);
                break;
            case 'equality_will_resolved':
                push(`平等の意志: 布石を${Number(ev.stolenAmount) || 0}奪取`);
                break;
            case 'reinforcement_will_resolved':
                push(`増援の意志: 通常石${Number(ev.spawnedCount) || 0}個を配置、${Number(ev.flippedCount) || 0}枚を反転`);
                break;
            case 'support_troops_will_resolved':
                push(`援軍の意志: 通常石${Number(ev.spawnedCount) || 0}個を配置、${Number(ev.flippedCount) || 0}枚を反転`);
                break;
            case 'treasure_box_gain':
                push(`宝箱: 布石+${Number(ev.gained) || 0}`);
                break;
            case 'board_bonus_gain':
                push(`数字マス${_toPosText(ev, deps)}: 布石+${Number(ev.gained) || Number(ev.bonus) || 0}${Number(ev.multiplier) > 1 ? `（${Number(ev.multiplier)}倍）` : ''}`);
                break;
            case 'trap_triggered': {
                const details = Array.isArray(ev.details) ? ev.details : [];
                if (details.length > 0) {
                    const destroyedHand = details.reduce((sum: any, d: any) => sum + (Number(d && (d.destroyedHandCount ?? d.stolenHandCount)) || 0), 0);
                    push(`罠石が発動: 布石最大10奪取 / 手札全破壊（${destroyedHand}枚）`);
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
                    if (e.doublePlaceActivated) push(deps.formatMultiPlaceActivationLog(e));
                    if (e.freePlacementUsed && !e.sniperPlaced) push('自由の意志:自由な空きマスに配置');
                    if (e.sniperPlaced) push('狙撃の意志: 狙撃石を設置');
                    if (e.lightningPlaced) push('雷の意志: 落雷石を設置');
                    if (e.meteorGodPlaced) push('因果抹消神石を設置');
                    if (e.willHunterKingPlaced) push('意志狩りの王を設置');
                    if (e.silverStoneUsed) push('銀石: 獲得布石3倍');
                    if (e.goldStoneUsed) push('金石: 獲得布石4倍');
                    if (e.rainbowStoneUsed) push('虹石: 獲得布石6倍');
                    if (e.crystalStoneUsed) push(_formatCrystalStonePlacementLog(e));
                    if (e.protected) push('反転保護を付与');
                    if (e.permaProtected) push('永続反転保護を付与');
                    if (e.bombPlaced) push('時限爆弾を設置');
                    if (e.timeStopPlaced) push('時間停石を設置');
                    if (e.timeStopDeityPlaced) push('時間停神を設置');
                    if (e.dragonPlaced) push('究極反転龍を設置');
                    if (e.ultimateDestroyGodPlaced) push('究極破壊神を設置');
                    if (e.ultimateHyperactivePlaced) push('究極多動神を設置');
                    if (e.instantHyperactivePlaced) push('瞬間多動石を設置');
                    if (e.escapeHyperactivePlaced) push('逃亡石を設置');
                    if (e.extremeHyperactivePlaced) push('極悪多動魔を設置');
                    if (e.robotVacuumPlaced) push('ロボット掃除機石を設置');
                    if (e.gluttonousPlaced) push('悪食石を設置');
                    if (e.hyperactivePlaced && !e.instantHyperactivePlaced && !e.escapeHyperactivePlaced && !e.extremeHyperactivePlaced && !e.robotVacuumPlaced && !e.gluttonousPlaced) push('多動石を設置');
                    if (e.crossBombExploded) push(`十字爆弾: ${e.crossBombDestroyed || 0}個を爆破`);
                    if (e.xBombExploded) push(`クロス爆弾: ${e.xBombDestroyed || 0}個を爆破`);
                }
                break;
            case 'extra_place_consumed':
                push(deps.formatMultiPlaceConsumedLog(ev));
                break;
            default:
                break;
        }
    }

    const pres = Array.isArray(presEvents) ? presEvents : [];
    for (const ev of pres) {
        if (!ev) continue;
        const actorKey = _resolveEventActorKey(ev, playerKey, deps);
        const push = (line: any) => {
            const msg = _withActorPrefix(line, actorKey);
            if (msg) logs.push(msg);
        };
        if (ev.type === 'WORK_INCOME') {
            const gained = Number.isFinite(ev.gained) ? ev.gained : ((ev.meta && Number.isFinite(ev.meta.gained)) ? ev.meta.gained : 0);
            push(`労働石: 布石 +${gained}`);
            continue;
        }
        if (ev.type === 'ULTIMATE_WORK_GOD_INCOME') {
            const gained = Number.isFinite(ev.gained)
                ? ev.gained
                : ((ev.meta && Number.isFinite(ev.meta.gained)) ? ev.meta.gained : 0);
            const chance = Number.isFinite(ev.selfDestructChancePercent)
                ? ev.selfDestructChancePercent
                : ((ev.meta && Number.isFinite(ev.meta.selfDestructChancePercent)) ? ev.meta.selfDestructChancePercent : 0);
            push(`究極労働神: 布石 +${gained}（自壊率 ${chance}%）`);
            continue;
        }
        if (ev.type === 'WORK_REMOVED') {
            if (deps.isWorkDurationExpiredPresentationEvent(ev)) push('労働石: 通常石に戻る');
            else push('労働石: 効果終了');
            continue;
        }
        if (ev.type === 'SPECIAL_STONE_BUBBLE') {
            const special = String(ev.special || (ev.meta && ev.meta.special) || '').trim().toUpperCase();
            const scenario = String(ev.scenario || (ev.meta && ev.meta.scenario) || '').trim().toLowerCase();
            if (special === 'SACRIFICE' && scenario === 'card_nullified') {
                logs.push('犠牲の意志がカードを無効化');
                continue;
            }
        }
        if (!ev || ev.type !== 'STATUS_TICK' || !ev.meta) continue;
        const special = String(ev.meta.special || '');
        const timer = ev.meta.timer;
        const key = `${special}:${ev.row},${ev.col}:${timer}`;
        if (seenStatusTick.has(key)) continue;
        seenStatusTick.add(key);
        if (special === 'TIME_BOMB' && Number.isFinite(timer)) {
            push(`時限爆弾: ${_toPosText(ev, deps)} のカウント ${timer}`);
        } else if (special && Number.isFinite(timer)) {
            push(`${_specialLabelJa(special, deps)}: ${_toPosText(ev, deps)} の残り ${timer}`);
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

function mapNormalLogsFromPipeline(rawEvents: any, playerKey: any) {
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

    const compact: any[] = [];
    for (const line of logs) {
        if (!line) continue;
        if (compact.length > 0 && compact[compact.length - 1] === line) continue;
        compact.push(line);
    }
    return compact;
}

const PipelineUILogMappersModule = {
    mapEffectLogsFromPipeline,
    mapNormalLogsFromPipeline
};

export = PipelineUILogMappersModule;
