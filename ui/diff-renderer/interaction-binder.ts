const BOARD_DIRECTION_HINT_SELECTOR = [
    '.board-expansion-direction-hint',
    '.board-shrink-god-direction-hint',
    '.board-shrink-will-direction-hint'
].join(', ');

function resolveBoardInputController(capabilities: any): any {
    const controller = capabilities && typeof capabilities.getInputController === 'function'
        ? capabilities.getInputController()
        : null;
    if (!controller || typeof controller.handlePointer !== 'function') {
        throw new Error('[DiffRendererInteractionBinder] board input controller unavailable');
    }
    return controller;
}

function resolveDirectionKey(event: any): string | undefined {
    const target = event && event.target;
    const directionHint = target && typeof target.closest === 'function'
        ? target.closest(BOARD_DIRECTION_HINT_SELECTOR)
        : null;
    const directionKey = directionHint && directionHint.dataset
        ? String(directionHint.dataset.direction || '').trim()
        : '';
    return directionKey || undefined;
}

function createPointerInput(type: string, event: any, row: number, col: number): any {
    return {
        type,
        row,
        col,
        pointerId: event && event.pointerId,
        pointerType: event && event.pointerType,
        button: event && event.button,
        clientX: event && event.clientX,
        clientY: event && event.clientY,
        directionKey: type === 'pointerup' ? resolveDirectionKey(event) : undefined,
        preventDefault: event && typeof event.preventDefault === 'function'
            ? () => event.preventDefault()
            : undefined
    };
}

function bindBoardCellInteraction(capabilities: any, cell: any, rawRow: any, rawCol: any): void {
    if (!cell) return;
    const row = Number(rawRow);
    const col = Number(rawCol);
    capabilities?.showIdleStoneInfoPanel?.();

    const forwardPointer = (type: string, event: any) => {
        const controller = resolveBoardInputController(capabilities);
        return controller.handlePointer(createPointerInput(type, event, row, col));
    };

    cell.addEventListener('pointerdown', (event: any) => forwardPointer('pointerdown', event));
    cell.addEventListener('pointerenter', (event: any) => forwardPointer('pointerenter', event));
    cell.addEventListener('pointermove', (event: any) => forwardPointer('pointermove', event));
    cell.addEventListener('pointerup', (event: any) => forwardPointer('pointerup', event));
    cell.addEventListener('pointerupoutside', (event: any) => forwardPointer('pointerupoutside', event));
    cell.addEventListener('pointercancel', (event: any) => forwardPointer('pointercancel', event));
    cell.addEventListener('pointerleave', (event: any) => forwardPointer('pointerleave', event));
    cell.addEventListener('mouseleave', (event: any) => {
        const controller = resolveBoardInputController(capabilities);
        const normalized = createPointerInput('pointerleave', event, row, col);
        if (normalized.pointerId == null && typeof controller.getState === 'function') {
            normalized.pointerId = controller.getState()?.activePointerId ?? undefined;
        }
        controller.handlePointer(normalized);
    });
    cell.addEventListener('keydown', (event: any) => {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
        const directionKey = resolveDirectionKey(event);
        if (!directionKey) return;
        const controller = resolveBoardInputController(capabilities);
        if (typeof controller.handleKeyboard !== 'function') {
            throw new Error('[DiffRendererInteractionBinder] keyboard input capability unavailable');
        }
        controller.handleKeyboard({
            code: event.code,
            key: event.key,
            repeat: event.repeat,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            isComposing: event.isComposing,
            defaultPrevented: event.defaultPrevented,
            row,
            col,
            directionKey,
            preventDefault: typeof event.preventDefault === 'function'
                ? () => event.preventDefault()
                : undefined
        });
    });
}

export = {
    bindBoardCellInteraction
};
