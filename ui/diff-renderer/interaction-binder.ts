function bindBoardCellInteraction(capabilities: any, cell: any, row: any, col: any): void {
    if (!cell) return;
    const {
        showIdleStoneInfoPanel,
        ensureOutsideCloseHandler,
        longPressMs,
        longPressMoveCancelPx,
        isHoverPointerEvent,
        setSuperAttractionHoverPreview,
        clearSuperAttractionHoverPreview,
        showSpecialStoneInfoAt,
        isTouchStoneInfoEvent,
        handleCellClick,
        setTimeout: setTimeoutFn,
        clearTimeout: clearTimeoutFn
    } = capabilities || {};
    showIdleStoneInfoPanel();

    let pressTimer: any = null;
    let pressActive = false;
    let longPressed = false;
    let startX = 0;
    let startY = 0;

    const clearPress = () => {
        pressActive = false;
        if (pressTimer) {
            clearTimeoutFn(pressTimer);
            pressTimer = null;
        }
    };

    cell.addEventListener('pointerdown', (ev: any) => {
        if (ev.button !== 0) return;
        ensureOutsideCloseHandler();
        clearPress();
        longPressed = false;
        pressActive = true;
        startX = Number(ev.clientX || 0);
        startY = Number(ev.clientY || 0);
        pressTimer = setTimeoutFn(() => {
            if (!pressActive) return;
            longPressed = true;
            showSpecialStoneInfoAt(row, col);
        }, longPressMs);
    });

    cell.addEventListener('pointerenter', (ev: any) => {
        if (!isHoverPointerEvent(ev)) return;
        ensureOutsideCloseHandler();
        setSuperAttractionHoverPreview(row, col);
        showSpecialStoneInfoAt(row, col, { preserveOnEmpty: true });
    });

    cell.addEventListener('pointermove', (ev: any) => {
        if (isHoverPointerEvent(ev)) {
            setSuperAttractionHoverPreview(row, col);
        }
        if (!pressActive) return;
        const dx = Math.abs(Number(ev.clientX || 0) - startX);
        const dy = Math.abs(Number(ev.clientY || 0) - startY);
        if (dx > longPressMoveCancelPx || dy > longPressMoveCancelPx) {
            clearPress();
        }
    });

    cell.addEventListener('pointerup', (ev: any) => {
        if (!pressActive && !longPressed) return;
        const wasLongPressed = longPressed;
        clearPress();
        if (wasLongPressed) {
            ev.preventDefault();
            return;
        }
        if (isTouchStoneInfoEvent(ev)) {
            showSpecialStoneInfoAt(row, col);
        }
        handleCellClick(row, col);
    });

    cell.addEventListener('pointercancel', () => clearPress());
    cell.addEventListener('pointerleave', (ev: any) => {
        if (isHoverPointerEvent(ev)) {
            clearSuperAttractionHoverPreview();
        }
        clearPress();
    });
    cell.addEventListener('mouseleave', () => {
        clearSuperAttractionHoverPreview();
        clearPress();
    });
}

export = {
    bindBoardCellInteraction
};
