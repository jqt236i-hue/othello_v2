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

function setActiveRouletteEntry(entries: any[], activeEntry: any) {
    for (const entry of entries) {
        try {
            if (entry === activeEntry) {
                entry.element.classList.add(ROULETTE_CLASS);
                entry.element.style.setProperty('--theory-roulette-index', String(entry.index));
            } else {
                entry.element.classList.remove(ROULETTE_CLASS);
                entry.element.style.removeProperty('--theory-roulette-index');
            }
        } catch (e) { /* ignore */ }
    }
}

function findEntryForCell(entries: any[], selected: any) {
    if (!selected) return null;
    return entries.find((entry: any) => (
        entry &&
        entry.cell &&
        entry.cell.row === selected.row &&
        entry.cell.col === selected.col
    )) || null;
}

function hidePreRenderedSpawnStone(selectedEntry: any) {
    const element = selectedEntry && selectedEntry.element;
    if (!element || typeof element.querySelectorAll !== 'function') return;
    try {
        const discs = Array.from(element.querySelectorAll('.disc'));
        for (const disc of discs) {
            try {
                if ((disc as any).parentElement) (disc as any).parentElement.removeChild(disc);
            } catch (e) { /* ignore */ }
        }
        if (element.classList && typeof element.classList.remove === 'function') {
            element.classList.remove('has-disc');
        }
    } catch (e) { /* ignore */ }
}

function positiveModulo(value: number, size: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) return 0;
    return ((value % size) + size) % size;
}

function buildRouletteDelays(durationMs: number, stepCount: number): number[] {
    const count = Math.max(1, Math.trunc(stepCount));
    const total = Math.max(0, Math.trunc(durationMs));
    if (count <= 1) return [total];
    const weights = [];
    let weightTotal = 0;
    for (let i = 0; i < count; i += 1) {
        const t = count <= 1 ? 1 : i / (count - 1);
        const weight = 0.42 + (1.85 * t * t);
        weights.push(weight);
        weightTotal += weight;
    }
    let used = 0;
    return weights.map((weight, index) => {
        if (index === weights.length - 1) return Math.max(0, total - used);
        const delay = Math.max(1, Math.round((total * weight) / weightTotal));
        used += delay;
        return delay;
    });
}

async function playRouletteSequence(entries: any[], selectedEntry: any, durationMs: number, deps: TheoryAnimationDeps) {
    if (!entries.length) {
        await sleep(durationMs, deps);
        return;
    }
    const selectedIndex = Math.max(0, entries.indexOf(selectedEntry));
    const minimumSteps = Math.max(entries.length * 3, 8);
    const timedSteps = Math.max(minimumSteps, Math.round(Math.max(0, durationMs) / 90));
    const stepCount = Math.min(32, timedSteps);
    const delays = buildRouletteDelays(durationMs, stepCount);

    for (let step = 0; step < stepCount; step += 1) {
        const remaining = stepCount - 1 - step;
        const entry = entries[positiveModulo(selectedIndex - remaining, entries.length)];
        setActiveRouletteEntry(entries, entry);
        await sleep(delays[step] || 0, deps);
    }
}

async function materializeSelectedStone(target: any, deps: TheoryAnimationDeps, materializeMs: number) {
    const row = Number(target && (target.row ?? target.r));
    const col = Number(target && target.col);
    const cell = Number.isInteger(row) && Number.isInteger(col) ? deps.getCellEl(row, col) : null;
    if (!cell) return;

    const after = (target && target.after && typeof target.after === 'object') ? target.after : {};
    const disc = deps.createDisc(after);
    const shouldAnimate = !(deps.isNoAnim() || !Number.isFinite(materializeMs) || materializeMs <= 0);
    if (shouldAnimate) {
        disc.style.opacity = '0';
        disc.style.setProperty('--theory-spawn-materialize-ms', `${materializeMs}ms`);
    }
    cell.innerHTML = '';
    cell.classList.add(ROULETTE_SELECTED_CLASS, MATERIALIZE_CLASS);
    disc.classList.add(MATERIALIZED_DISC_CLASS);
    cell.appendChild(disc);

    if (!shouldAnimate) {
        cell.classList.remove(ROULETTE_SELECTED_CLASS, MATERIALIZE_CLASS);
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
            disc.style.removeProperty('--theory-spawn-materialize-ms');
            disc.classList.remove(MATERIALIZED_DISC_CLASS);
            cell.classList.remove(ROULETTE_SELECTED_CLASS, MATERIALIZE_CLASS);
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
        const selectedEntry = findEntryForCell(entries, selected);
        hidePreRenderedSpawnStone(selectedEntry);

        await playRouletteSequence(entries, selectedEntry, durationMs, deps);
        clearRouletteClasses(entries);
        if (selectedEntry && selectedEntry.element) {
            try { selectedEntry.element.classList.add(ROULETTE_SELECTED_CLASS); } catch (e) { /* ignore */ }
        }
        await materializeSelectedStone(target, deps, materializeMs);
    }
}

module.exports = {
    handleTheoryIncarnationSpawnRouletteEvent
};
