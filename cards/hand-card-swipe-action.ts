export type HandCardSwipeActionKind = 'pending' | 'use' | 'destroy' | 'cancel';

export type HandCardSwipePoint = {
    x: number;
    y: number;
    timeMs: number;
};

export type HandCardSwipeOptions = {
    longPressMs?: number;
    actionThresholdPx?: number;
    destroyActionThresholdPx?: number;
    preActivationCancelPx?: number;
};

export type HandCardSwipeGesture = {
    startX: number;
    startY: number;
    startTimeMs: number;
    active: boolean;
    cancelled: boolean;
    action: HandCardSwipeActionKind;
    longPressMs: number;
    actionThresholdPx: number;
    destroyActionThresholdPx: number;
    preActivationCancelPx: number;
};

export type HandCardSwipeUpdate = {
    action: HandCardSwipeActionKind;
    active: boolean;
    cancelled: boolean;
};

const DEFAULT_LONG_PRESS_MS = 170;
const DEFAULT_ACTION_THRESHOLD_PX = 40;
const DEFAULT_DESTROY_ACTION_THRESHOLD_PX = 60;
const DEFAULT_PRE_ACTIVATION_CANCEL_PX = 24;
const MIN_DESTROY_ACTION_THRESHOLD_PX = 28;
const DESTROY_EDGE_SPACE_RATIO = 0.85;

function toFiniteNumber(value: any, fallback: number): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function normalizePoint(point: HandCardSwipePoint): HandCardSwipePoint {
    return {
        x: toFiniteNumber(point && point.x, 0),
        y: toFiniteNumber(point && point.y, 0),
        timeMs: toFiniteNumber(point && point.timeMs, 0)
    };
}

function normalizeOptions(options?: HandCardSwipeOptions): Required<HandCardSwipeOptions> {
    return {
        longPressMs: Math.max(0, toFiniteNumber(options && options.longPressMs, DEFAULT_LONG_PRESS_MS)),
        actionThresholdPx: Math.max(1, toFiniteNumber(options && options.actionThresholdPx, DEFAULT_ACTION_THRESHOLD_PX)),
        destroyActionThresholdPx: Math.max(1, toFiniteNumber(options && options.destroyActionThresholdPx, DEFAULT_DESTROY_ACTION_THRESHOLD_PX)),
        preActivationCancelPx: Math.max(1, toFiniteNumber(options && options.preActivationCancelPx, DEFAULT_PRE_ACTIVATION_CANCEL_PX))
    };
}

export function resolveHandCardSwipeDestroyThreshold(
    baseThresholdPx: number,
    startX: number,
    viewportWidth: number
): number {
    const base = Math.max(1, toFiniteNumber(baseThresholdPx, DEFAULT_DESTROY_ACTION_THRESHOLD_PX));
    const start = toFiniteNumber(startX, NaN);
    const width = toFiniteNumber(viewportWidth, NaN);
    if (!Number.isFinite(start) || !Number.isFinite(width) || width <= 0 || start < 0 || start >= width) {
        return base;
    }
    const rightSpace = Math.max(0, width - start);
    const adaptive = Math.floor(rightSpace * DESTROY_EDGE_SPACE_RATIO);
    return Math.max(MIN_DESTROY_ACTION_THRESHOLD_PX, Math.min(base, adaptive));
}

function snapshot(gesture: HandCardSwipeGesture): HandCardSwipeUpdate {
    return {
        action: gesture.action,
        active: gesture.active,
        cancelled: gesture.cancelled
    };
}

function resolveSwipeAction(gesture: HandCardSwipeGesture, point: HandCardSwipePoint): HandCardSwipeActionKind {
    const dx = point.x - gesture.startX;
    const dy = point.y - gesture.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (dy <= -gesture.actionThresholdPx && absDy >= absDx) return 'use';
    if (dx >= gesture.destroyActionThresholdPx && absDx > absDy) return 'destroy';
    return 'pending';
}

function resolvePreActivationIntent(gesture: HandCardSwipeGesture, point: HandCardSwipePoint): HandCardSwipeActionKind {
    const dx = point.x - gesture.startX;
    const dy = point.y - gesture.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (dy <= -gesture.preActivationCancelPx && absDy >= absDx) return 'use';
    if (dx >= gesture.preActivationCancelPx && absDx > absDy) return 'destroy';
    return 'pending';
}

export function createHandCardSwipeGesture(point: HandCardSwipePoint, options?: HandCardSwipeOptions): HandCardSwipeGesture {
    const start = normalizePoint(point);
    const normalizedOptions = normalizeOptions(options);
    return {
        startX: start.x,
        startY: start.y,
        startTimeMs: start.timeMs,
        active: false,
        cancelled: false,
        action: 'pending',
        longPressMs: normalizedOptions.longPressMs,
        actionThresholdPx: normalizedOptions.actionThresholdPx,
        destroyActionThresholdPx: normalizedOptions.destroyActionThresholdPx,
        preActivationCancelPx: normalizedOptions.preActivationCancelPx
    };
}

export function updateHandCardSwipeGesture(gesture: HandCardSwipeGesture, point: HandCardSwipePoint): HandCardSwipeUpdate {
    if (!gesture || gesture.cancelled) return { action: 'cancel', active: false, cancelled: true };
    const current = normalizePoint(point);
    const dx = current.x - gesture.startX;
    const dy = current.y - gesture.startY;
    const elapsedMs = current.timeMs - gesture.startTimeMs;

    if (!gesture.active) {
        const drift = Math.sqrt((dx * dx) + (dy * dy));
        const earlyIntent = resolvePreActivationIntent(gesture, current);
        if (elapsedMs < gesture.longPressMs && drift >= gesture.preActivationCancelPx && earlyIntent === 'pending') {
            gesture.cancelled = true;
            gesture.action = 'cancel';
            return snapshot(gesture);
        }
        if (elapsedMs >= gesture.longPressMs) {
            gesture.active = true;
        }
    }

    gesture.action = gesture.active ? resolveSwipeAction(gesture, current) : 'pending';
    return snapshot(gesture);
}

export function finishHandCardSwipeGesture(gesture: HandCardSwipeGesture, point: HandCardSwipePoint): HandCardSwipeUpdate {
    const update = updateHandCardSwipeGesture(gesture, point);
    if (update.cancelled || !update.active || update.action === 'pending') {
        gesture.action = 'cancel';
        return snapshot(gesture);
    }
    return update;
}

module.exports = {
    createHandCardSwipeGesture,
    updateHandCardSwipeGesture,
    finishHandCardSwipeGesture,
    resolveHandCardSwipeDestroyThreshold
};
