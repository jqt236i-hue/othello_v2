const HAND_CARD_SWIPE_LONG_PRESS_MS = 170;
const HAND_CARD_SWIPE_ACTION_THRESHOLD_PX = 40;
const HAND_CARD_SWIPE_DESTROY_ACTION_THRESHOLD_PX = 60;
const HAND_CARD_SWIPE_PRE_ACTIVATION_CANCEL_PX = 24;

function createHandCardSwipeGestureAdapter(options: any) {
    const config = options || {};
    let state: any = null;
    let overlayEl: any = null;
    let bound = false;
    let suppressClickUntil = 0;

    function getEventTime(event: any): number {
        const eventTime = Number(event && event.timeStamp);
        if (Number.isFinite(eventTime) && eventTime >= 0) return eventTime;
        try {
            const root = config.getWindowRef();
            if (root && root.performance && typeof root.performance.now === 'function') return root.performance.now();
        } catch (e) { /* ignore */ }
        return Date.now();
    }

    function getPoint(event: any, fallbackTimeMs?: any): any {
        return {
            x: Number(event && event.clientX) || 0,
            y: Number(event && event.clientY) || 0,
            timeMs: Number.isFinite(Number(fallbackTimeMs)) ? Number(fallbackTimeMs) : getEventTime(event)
        };
    }

    function resolveDestroyThreshold(startPoint: any): number {
        const actionModule = config.actionModule;
        const root = config.getWindowRef();
        if (actionModule && typeof actionModule.resolveHandCardSwipeDestroyThreshold === 'function' && root) {
            return actionModule.resolveHandCardSwipeDestroyThreshold(
                HAND_CARD_SWIPE_DESTROY_ACTION_THRESHOLD_PX,
                startPoint && startPoint.x,
                root.innerWidth
            );
        }
        return HAND_CARD_SWIPE_DESTROY_ACTION_THRESHOLD_PX;
    }

    function findTarget(event: any): any {
        if (!event || event.button > 0) return null;
        const rawTarget = event.target || null;
        const targetEl = rawTarget && rawTarget.nodeType === 1
            ? rawTarget
            : (rawTarget && rawTarget.parentElement ? rawTarget.parentElement : null);
        const cardEl = targetEl && typeof targetEl.closest === 'function'
            ? targetEl.closest('.card-item.visible.clickable[data-card-id]')
            : null;
        if (!cardEl || !cardEl.dataset || !cardEl.dataset.cardId) return null;
        if (typeof cardEl.closest === 'function' && !cardEl.closest('#hand-black, #hand-white')) return null;
        const rawActualHandIndex = Number(cardEl.dataset.actualHandIndex);
        const rawHandIndex = Number.isInteger(rawActualHandIndex) && rawActualHandIndex >= 0
            ? rawActualHandIndex
            : Number(cardEl.dataset.handIndex);
        return {
            cardEl,
            cardId: String(cardEl.dataset.cardId),
            ownerKey: config.normalizeOwnerKey(cardEl.dataset.ownerKey),
            handIndex: Number.isInteger(rawHandIndex) && rawHandIndex >= 0 ? rawHandIndex : undefined
        };
    }

    function ensureOverlay(): any {
        const doc = config.getDocumentRef();
        if (!doc) return null;
        if (overlayEl && overlayEl.parentElement) return overlayEl;
        const overlay = doc.createElement('div');
        overlay.id = 'hand-card-swipe-action-overlay';
        overlay.className = 'hand-card-swipe-action-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        const useZone = doc.createElement('div');
        useZone.className = 'hand-card-swipe-zone hand-card-swipe-zone-use';
        useZone.textContent = '使用';
        overlay.appendChild(useZone);
        const destroyZone = doc.createElement('div');
        destroyZone.className = 'hand-card-swipe-zone hand-card-swipe-zone-destroy';
        destroyZone.textContent = '破壊';
        overlay.appendChild(destroyZone);
        doc.body.appendChild(overlay);
        overlayEl = overlay;
        return overlay;
    }

    function setOverlayAction(action: any): void {
        const overlay = ensureOverlay();
        if (!overlay || !overlay.classList) return;
        overlay.classList.add('is-visible');
        overlay.classList.toggle('is-use-active', action === 'use');
        overlay.classList.toggle('is-destroy-active', action === 'destroy');
    }

    function hideOverlay(): void {
        if (!overlayEl || !overlayEl.classList) return;
        overlayEl.classList.remove('is-visible', 'is-use-active', 'is-destroy-active');
    }

    function setCardOffset(nextState: any, point: any): void {
        if (!nextState || !nextState.cardEl || !nextState.cardEl.style) return;
        const dx = (Number(point && point.x) || 0) - nextState.startPoint.x;
        const dy = (Number(point && point.y) || 0) - nextState.startPoint.y;
        nextState.cardEl.style.setProperty('--hand-card-swipe-x', `${dx}px`);
        nextState.cardEl.style.setProperty('--hand-card-swipe-y', `${dy}px`);
    }

    function clearCardState(nextState: any): void {
        if (!nextState || !nextState.cardEl) return;
        try {
            nextState.cardEl.classList.remove('hand-card-swipe-pending', 'hand-card-swipe-dragging');
            nextState.cardEl.style.removeProperty('--hand-card-swipe-x');
            nextState.cardEl.style.removeProperty('--hand-card-swipe-y');
            if (typeof nextState.cardEl.releasePointerCapture === 'function' && Number.isFinite(Number(nextState.pointerId))) {
                nextState.cardEl.releasePointerCapture(nextState.pointerId);
            }
        } catch (e) { /* ignore */ }
    }

    function cleanup(suppressClick: any): void {
        const current = state;
        if (current && current.longPressTimer) {
            clearTimeout(current.longPressTimer);
            current.longPressTimer = null;
        }
        clearCardState(current);
        hideOverlay();
        if (suppressClick) suppressClickUntil = Date.now() + 700;
        state = null;
    }

    function activate(nextState: any): void {
        const actionModule = config.actionModule;
        if (!nextState || state !== nextState || nextState.activated) return;
        const activationPoint = Object.assign({}, nextState.lastPoint, {
            timeMs: nextState.startPoint.timeMs + HAND_CARD_SWIPE_LONG_PRESS_MS
        });
        const update = actionModule.updateHandCardSwipeGesture(nextState.gesture, activationPoint);
        if (!update || update.cancelled) {
            cleanup(false);
            return;
        }
        nextState.activated = true;
        nextState.cardEl.classList.remove('hand-card-swipe-pending');
        nextState.cardEl.classList.add('hand-card-swipe-dragging');
        setCardOffset(nextState, activationPoint);
        setOverlayAction(update.action);
        suppressClickUntil = Date.now() + 700;
    }

    function onPointerDown(event: any): void {
        const actionModule = config.actionModule;
        if (!actionModule || config.isAutoModeActive()) return;
        const target = findTarget(event);
        if (!target) return;
        cleanup(false);
        const startPoint = getPoint(event);
        const gesture = actionModule.createHandCardSwipeGesture(startPoint, {
            longPressMs: HAND_CARD_SWIPE_LONG_PRESS_MS,
            actionThresholdPx: HAND_CARD_SWIPE_ACTION_THRESHOLD_PX,
            destroyActionThresholdPx: resolveDestroyThreshold(startPoint),
            preActivationCancelPx: HAND_CARD_SWIPE_PRE_ACTIVATION_CANCEL_PX
        });
        const nextState: any = {
            pointerId: event.pointerId,
            cardEl: target.cardEl,
            cardId: target.cardId,
            ownerKey: target.ownerKey,
            handIndex: target.handIndex,
            gesture,
            startPoint,
            lastPoint: startPoint,
            activated: false,
            longPressTimer: null
        };
        nextState.longPressTimer = setTimeout(() => activate(nextState), HAND_CARD_SWIPE_LONG_PRESS_MS);
        state = nextState;
        try {
            if (typeof target.cardEl.setPointerCapture === 'function' && Number.isFinite(Number(event.pointerId))) {
                target.cardEl.setPointerCapture(event.pointerId);
            }
        } catch (e) { /* ignore */ }
    }

    function onPointerMove(event: any): void {
        const actionModule = config.actionModule;
        const current = state;
        if (!current || (Number.isFinite(Number(current.pointerId)) && event.pointerId !== current.pointerId)) return;
        const point = getPoint(event);
        current.lastPoint = point;
        const update = actionModule.updateHandCardSwipeGesture(current.gesture, point);
        if (!current.activated) {
            if (update && update.cancelled) cleanup(false);
            return;
        }
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        setCardOffset(current, point);
        setOverlayAction(update ? update.action : 'pending');
    }

    function onPointerUp(event: any): void {
        const actionModule = config.actionModule;
        const current = state;
        if (!current || (Number.isFinite(Number(current.pointerId)) && event.pointerId !== current.pointerId)) return;
        const point = getPoint(event);
        current.lastPoint = point;
        const finish = actionModule.finishHandCardSwipeGesture(current.gesture, point);
        const finishedByPointerUp = !!(finish && finish.active && finish.action !== 'cancel' && finish.action !== 'pending');
        if (!current.activated && !finishedByPointerUp) {
            cleanup(false);
            return;
        }
        const action = finish && finish.action;
        if (!current.activated && finishedByPointerUp) {
            current.activated = true;
            if (current.cardEl && current.cardEl.classList) current.cardEl.classList.add('hand-card-swipe-dragging');
            setCardOffset(current, point);
            setOverlayAction(action);
        }
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        const selected = (action === 'use' || action === 'destroy')
            ? config.selectCardForAction(current)
            : false;
        cleanup(true);
        if (selected && (action === 'use' || action === 'destroy')) config.runSelectedAction(action);
    }

    function onPointerCancel(event: any): void {
        const current = state;
        if (!current || (Number.isFinite(Number(current.pointerId)) && event.pointerId !== current.pointerId)) return;
        cleanup(!!current.activated);
    }

    function bind(): boolean {
        const doc = config.getDocumentRef();
        if (bound || !doc) return false;
        doc.addEventListener('pointerdown', onPointerDown, true);
        doc.addEventListener('pointermove', onPointerMove, true);
        doc.addEventListener('pointerup', onPointerUp, true);
        doc.addEventListener('pointercancel', onPointerCancel, true);
        doc.addEventListener('click', (event: any) => {
            if (Date.now() > suppressClickUntil) return;
            if (!findTarget(event)) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);
        doc.addEventListener('contextmenu', (event: any) => {
            if (!state || !state.activated || !findTarget(event)) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);
        bound = true;
        return true;
    }

    return { bind };
}

export = { createHandCardSwipeGestureAdapter };
