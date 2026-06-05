export {};

type TheoryAnimationDeps = {
    isNoAnim: () => boolean;
    getCellEl: (row: any, col: any) => any;
    createDisc: (state: any) => any;
    waitForOpacityTransition: (disc: any, durationMs: any, bufferMs: any, starter: any, cleanup: any) => Promise<any>;
    timer: () => any;
    playbackScope?: any;
};

const ROULETTE_CLASS = 'theory-spawn-roulette-active';
const ROULETTE_SELECTED_CLASS = 'theory-spawn-roulette-selected';
const MATERIALIZE_CLASS = 'theory-spawn-materialize';
const MATERIALIZED_DISC_CLASS = 'theory-spawn-materialized-disc';

function normalizeCell(value: any) {
    const row = Number(value && value.row);
    const col = Number(value && value.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function sleep(ms: number, deps: TheoryAnimationDeps) {
    if (deps.isNoAnim()) return Promise.resolve();
    return new Promise<void>((resolve) => {
        const timer = deps.timer();
        if (timer && typeof timer.setTimeout === 'function') {
            timer.setTimeout(resolve, ms, deps.playbackScope);
            return;
        }
        setTimeout(resolve, ms);
    });
}

function collectCandidateCells(target: any, deps: TheoryAnimationDeps) {
    const source = Array.isArray(target && target.candidateCells) ? target.candidateCells : [];
    return source
        .map(normalizeCell)
        .filter((cell: any) => !!cell)
        .map((cell: any, index: number) => ({
            cell,
            index,
            element: deps.getCellEl(cell.row, cell.col)
        }))
        .filter((entry: any) => !!entry.element);
}

function clearRouletteClasses(entries: any[]) {
    for (const entry of entries) {
        try {
            entry.element.classList.remove(ROULETTE_CLASS, ROULETTE_SELECTED_CLASS);
            entry.element.style.removeProperty('--theory-roulette-index');
        } catch (e) { /* ignore */ }
    }
}

async function materializeSelectedStone(target: any, deps: TheoryAnimationDeps, materializeMs: number) {
    const row = Number(target && (target.row ?? target.r));
    const col = Number(target && target.col);
    const cell = Number.isInteger(row) && Number.isInteger(col) ? deps.getCellEl(row, col) : null;
    if (!cell) return;

    const after = (target && target.after && typeof target.after === 'object') ? target.after : {};
    const disc = deps.createDisc(after);
    cell.innerHTML = '';
    cell.classList.add(MATERIALIZE_CLASS);
    disc.classList.add(MATERIALIZED_DISC_CLASS);
    cell.appendChild(disc);

    if (deps.isNoAnim() || !Number.isFinite(materializeMs) || materializeMs <= 0) {
        cell.classList.remove(MATERIALIZE_CLASS);
        disc.classList.remove(MATERIALIZED_DISC_CLASS);
        return;
    }

    const prevTransition = disc.style.transition || '';
    disc.style.opacity = '0';
    await deps.waitForOpacityTransition(
        disc,
        materializeMs,
        120,
        () => {
            disc.style.transition = prevTransition
                ? `${prevTransition}, opacity ${materializeMs}ms ease`
                : `opacity ${materializeMs}ms ease`;
            try { requestAnimationFrame(() => { disc.style.opacity = '1'; }); } catch (e) { disc.style.opacity = '1'; }
        },
        () => {
            disc.style.opacity = '';
            disc.style.transition = prevTransition;
            disc.classList.remove(MATERIALIZED_DISC_CLASS);
            cell.classList.remove(MATERIALIZE_CLASS);
        }
    );
}

async function handleTheoryIncarnationSpawnRouletteEvent(ev: any, deps: TheoryAnimationDeps) {
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    if (!targets.length) return Promise.resolve();

    for (const target of targets) {
        const durationMs = Number.isFinite(Number(ev.durationMs)) ? Math.max(0, Math.trunc(Number(ev.durationMs))) : 2000;
        const materializeMs = Number.isFinite(Number(ev.materializeMs)) ? Math.max(0, Math.trunc(Number(ev.materializeMs))) : 700;
        const entries = collectCandidateCells(target, deps);
        const selected = normalizeCell(target && (target.selectedCell || { row: target.row ?? target.r, col: target.col }));

        for (const entry of entries) {
            try {
                entry.element.classList.add(ROULETTE_CLASS);
                entry.element.style.setProperty('--theory-roulette-index', String(entry.index));
                if (selected && entry.cell.row === selected.row && entry.cell.col === selected.col) {
                    entry.element.classList.add(ROULETTE_SELECTED_CLASS);
                }
            } catch (e) { /* ignore */ }
        }

        await sleep(durationMs, deps);
        clearRouletteClasses(entries);
        await materializeSelectedStone(target, deps, materializeMs);
    }
}

module.exports = {
    handleTheoryIncarnationSpawnRouletteEvent
};
