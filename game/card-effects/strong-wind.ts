declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file strong-wind.js
 * @description Strong Wind Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');
declare const emitLogAdded: any;

function getPlayerLabel(playerKey: string): string {
    return playerKey === 'black' ? '黒' : '白';
}

async function handleMovementSelection(row: number, col: number, playerKey: string, options: any) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;

    const opts = options || {};
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: opts.pendingType,
        actionPayload: { [opts.actionField]: { row, col } },
        invalidMessage: opts.invalidMessage,
        validateResult: ({ result }: any) => {
            const selected = result && Array.isArray(result.rawEvents)
                ? result.rawEvents.find((event: any) => event && event.type === opts.rawEventType && event.applied)
                : null;
            return !!selected;
        },
        buildPlaybackMeta: () => ({ cause: opts.cause, target: { row, col } }),
        afterStateChange: () => {
            if (typeof emitLogAdded === 'function') {
                emitLogAdded(`${getPlayerLabel(playerKey)}が${opts.activationName}を発動`);
            }
        }
    });
}

async function handleStrongWindSelection(row: number, col: number, playerKey: string) {
    return handleMovementSelection(row, col, playerKey, {
        pendingType: 'STRONG_WIND_WILL',
        actionField: 'strongWindTarget',
        rawEventType: 'strong_wind_selected',
        invalidMessage: '移動可能な石を選んでください',
        activationName: '強風の意志',
        cause: 'STRONG_WIND_WILL'
    });
}

async function handleSuperBuoyancySelection(row: number, col: number, playerKey: string) {
    return handleMovementSelection(row, col, playerKey, {
        pendingType: 'SUPER_BUOYANCY_WILL',
        actionField: 'superBuoyancyTarget',
        rawEventType: 'super_buoyancy_selected',
        invalidMessage: '上へ移動させる石を選んでください',
        activationName: '超浮力',
        cause: 'SUPER_BUOYANCY_WILL'
    });
}

async function handleBuoyancySelection(row: number, col: number, playerKey: string) {
    return handleMovementSelection(row, col, playerKey, {
        pendingType: 'BUOYANCY_WILL',
        actionField: 'buoyancyTarget',
        rawEventType: 'buoyancy_selected',
        invalidMessage: '上へ移動させる石を選んでください',
        activationName: '浮力',
        cause: 'BUOYANCY_WILL'
    });
}

async function handleSuperGravitySelection(row: number, col: number, playerKey: string) {
    return handleMovementSelection(row, col, playerKey, {
        pendingType: 'SUPER_GRAVITY_WILL',
        actionField: 'superGravityTarget',
        rawEventType: 'super_gravity_selected',
        invalidMessage: '下へ移動させる石を選んでください',
        activationName: '超重力',
        cause: 'SUPER_GRAVITY_WILL'
    });
}

async function handleGravitySelection(row: number, col: number, playerKey: string) {
    return handleMovementSelection(row, col, playerKey, {
        pendingType: 'GRAVITY_WILL',
        actionField: 'gravityTarget',
        rawEventType: 'gravity_selected',
        invalidMessage: '下へ移動させる石を選んでください',
        activationName: '重力',
        cause: 'GRAVITY_WILL'
    });
}

function getSuperAttractionSelectedEvent(result: any) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && (
            (event.type === 'super_attraction_first_selected' && event.applied) ||
            (event.type === 'super_attraction_selected' && event.applied)
        ))
        : null;
}

async function handleSuperAttractionSelection(row: number, col: number, playerKey: string) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'SUPER_ATTRACTION_WILL',
        actionPayload: { superAttractionTarget: { row, col } },
        invalidMessage: '引き寄せる石または引き寄せ先のマスを選んでください',
        validateResult: ({ result }: any) => !!getSuperAttractionSelectedEvent(result),
        buildPlaybackMeta: () => ({ cause: 'SUPER_ATTRACTION_WILL', target: { row, col } }),
        afterStateChange: ({ result }: any) => {
            if (typeof emitLogAdded !== 'function') return;
            const selected = getSuperAttractionSelectedEvent(result);
            if (selected && selected.completed === false) {
                emitLogAdded('超引力: 引き寄せ先のマスを選んでください');
                return;
            }
            emitLogAdded(`${getPlayerLabel(playerKey)}が超引力を発動`);
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleStrongWindSelection,
        handleBuoyancySelection,
        handleSuperBuoyancySelection,
        handleGravitySelection,
        handleSuperGravitySelection,
        handleSuperAttractionSelection
    };
}

export {};
