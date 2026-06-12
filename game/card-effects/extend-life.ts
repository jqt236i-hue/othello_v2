declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file extend-life.js
 * @description 延命系カード UI handler — selection -> pipeline adapter
 */

const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function getExtendLifeSelectedEvent(result: any): any {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'extend_life_selected')
        : null;
}

function getCorrosionResolvedEvent(result: any): any {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'corrosion_will_resolved')
        : null;
}

async function handleExtendLifeSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['EXTEND_LIFE_WILL', 'EXTEND_LIFE_GOD'],
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload(['EXTEND_LIFE_WILL', 'EXTEND_LIFE_GOD'], row, col),
        invalidMessage: ({ pendingType }: any) => pendingType === 'EXTEND_LIFE_GOD'
            ? '延命神の対象となる自分の特殊石を選んでください'
            : '延命の対象となる自分の特殊石を選んでください',
        validateResult: ({ result }: any) => {
            const selected = getExtendLifeSelectedEvent(result);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: ({ pendingType }: any) => ({ cause: pendingType, target: { row, col } })
    });
}

async function handleCorrosionSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'CORROSION_WILL',
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload('CORROSION_WILL', row, col),
        invalidMessage: '腐食の対象となる特殊石を選んでください',
        validateResult: ({ result }: any) => {
            const resolved = getCorrosionResolvedEvent(result);
            return !!(resolved && Number(resolved.affectedCount) > 0);
        },
        buildPlaybackMeta: () => ({ cause: 'CORROSION_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleExtendLifeSelection, handleCorrosionSelection };
}

export {};
