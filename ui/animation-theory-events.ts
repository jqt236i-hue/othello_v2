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
const ROULETTE_TRAIL_CLASS = 'theory-spawn-roulette-trail';
const ROULETTE_SELECTED_CLASS = 'theory-spawn-roulette-selected';
const MATERIALIZE_CLASS = 'theory-spawn-materialize';
const MATERIALIZED_DISC_CLASS = 'theory-spawn-materialized-disc';
const THEORY_ROULETTE_BASE_DURATION_MS = 2500;
const THEORY_MATERIALIZE_BASE_DURATION_MS = 2000;
const THEORY_ROULETTE_DELAYS_MS = [
    62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5,
    125, 125, 125, 125, 125, 125, 125,
    250, 250, 375, 250
];

function normalizeCell(value: any) {
    const row = Number(value && value.row);
    const col = Number(value && value.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    const rawNumberValue = Number(value && value.value);
    const numberValue = Number.isFinite(rawNumberValue) && rawNumberValue > 0
        ? Math.floor(rawNumberValue)
        : null;
    return numberValue !== null ? { row, col, value: numberValue } : { row, col };
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
            element: deps.getCellEl(cell.row, cell.col),
            temporaryNumberLabel: null,
            addedBoardBonusClass: false,
            addedTheoryNumberClass: false
        }))
        .filter((entry: any) => !!entry.element);
}

function clearRouletteClasses(entries: any[]) {
    for (const entry of entries) {
        try {
            entry.element.classList.remove(ROULETTE_CLASS, ROULETTE_TRAIL_CLASS, ROULETTE_SELECTED_CLASS);
            entry.element.style.removeProperty('--theory-roulette-index');
        } catch (e) { /* ignore */ }
    }
}

function applyTemporaryNumberLabels(entries: any[]) {
    for (const entry of entries) {
        const element = entry && entry.element;
        const numberValue = Number(entry && entry.cell && entry.cell.value);
        if (!element || !Number.isFinite(numberValue) || numberValue <= 0) continue;
        try {
            if (element.querySelector && element.querySelector('.board-bonus-number')) continue;
            const doc = element.ownerDocument || (typeof document !== 'undefined' ? document : null);
            if (!doc || typeof doc.createElement !== 'function') continue;
            const label = doc.createElement('div');
            label.className = 'board-bonus-number';
            label.textContent = String(Math.floor(numberValue));
            element.appendChild(label);
            entry.temporaryNumberLabel = label;
            if (element.classList && !element.classList.contains('has-board-bonus')) {
                element.classList.add('has-board-bonus');
                entry.addedBoardBonusClass = true;
            }
            if (element.classList && !element.classList.contains('has-theory-number-cell')) {
                element.classList.add('has-theory-number-cell');
                entry.addedTheoryNumberClass = true;
            }
        } catch (e) { /* ignore */ }
    }
}

function clearTemporaryNumberLabels(entries: any[]) {
    for (const entry of entries) {
        const element = entry && entry.element;
        try {
            if (entry && entry.temporaryNumberLabel && entry.temporaryNumberLabel.parentElement) {
                entry.temporaryNumberLabel.parentElement.removeChild(entry.temporaryNumberLabel);
            }
            if (element && element.classList) {
                if (entry && entry.addedBoardBonusClass) element.classList.remove('has-board-bonus');
                if (entry && entry.addedTheoryNumberClass) element.classList.remove('has-theory-number-cell');
            }
            if (entry) {
                entry.temporaryNumberLabel = null;
                entry.addedBoardBonusClass = false;
                entry.addedTheoryNumberClass = false;
            }
        } catch (e) { /* ignore */ }
    }
}

function restartRouletteTrail(element: any) {
    try {
        element.classList.remove(ROULETTE_TRAIL_CLASS);
        if (typeof element.offsetWidth === 'number') {
            void element.offsetWidth;
        }
        element.classList.add(ROULETTE_TRAIL_CLASS);
    } catch (e) { /* ignore */ }
}

function setActiveRouletteEntry(entries: any[], activeEntry: any) {
    for (const entry of entries) {
        try {
            const wasActive = entry.element.classList.contains(ROULETTE_CLASS);
            if (entry === activeEntry) {
                entry.element.classList.remove(ROULETTE_TRAIL_CLASS);
                entry.element.classList.add(ROULETTE_CLASS);
                entry.element.style.setProperty('--theory-roulette-index', String(entry.index));
            } else {
                entry.element.classList.remove(ROULETTE_CLASS);
                entry.element.style.removeProperty('--theory-roulette-index');
                if (wasActive) restartRouletteTrail(entry.element);
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

function buildRouletteDelays(durationMs: number): number[] {
    const total = Math.max(0, Math.trunc(durationMs));
    if (total === THEORY_ROULETTE_BASE_DURATION_MS) return THEORY_ROULETTE_DELAYS_MS.slice();
    const scale = THEORY_ROULETTE_BASE_DURATION_MS > 0 ? total / THEORY_ROULETTE_BASE_DURATION_MS : 0;
    let used = 0;
    return THEORY_ROULETTE_DELAYS_MS.map((delayMs, index) => {
        if (index === THEORY_ROULETTE_DELAYS_MS.length - 1) return Math.max(0, total - used);
        const delay = Math.max(1, Math.round(delayMs * scale));
        used += delay;
        return delay;
    });
}

function pickRouletteEntry(entries: any[], selectedIndex: number, step: number, stepCount: number, previousEntry: any) {
    if (!entries.length) return null;
    if (entries.length === 1) return entries[0];
    const selected = entries[positiveModulo(selectedIndex, entries.length)];
    if (step >= stepCount - 1) return selected;
    const remaining = stepCount - 1 - step;
    let index = positiveModulo(selectedIndex - remaining, entries.length);
    if (step === 0 && index === selectedIndex) {
        index = positiveModulo(index - 1, entries.length);
    }
    if (entries[index] === previousEntry) {
        index = positiveModulo(index + 1, entries.length);
    }
    return entries[index];
}

async function playRouletteSequence(entries: any[], selectedEntry: any, durationMs: number, deps: TheoryAnimationDeps) {
    if (!entries.length) {
        await sleep(durationMs, deps);
        return;
    }
    const selectedIndex = Math.max(0, entries.indexOf(selectedEntry));
    const delays = buildRouletteDelays(durationMs);
    const stepCount = delays.length;
    let previousEntry: any = null;

    for (let step = 0; step < stepCount; step += 1) {
        const entry = pickRouletteEntry(entries, selectedIndex, step, stepCount, previousEntry);
        setActiveRouletteEntry(entries, entry);
        previousEntry = entry;
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
        const durationMs = Number.isFinite(Number(ev.durationMs)) ? Math.max(0, Math.trunc(Number(ev.durationMs))) : THEORY_ROULETTE_BASE_DURATION_MS;
        const materializeMs = Number.isFinite(Number(ev.materializeMs)) ? Math.max(0, Math.trunc(Number(ev.materializeMs))) : THEORY_MATERIALIZE_BASE_DURATION_MS;
        const entries = collectCandidateCells(target, deps);
        const selected = normalizeCell(target && (target.selectedCell || { row: target.row ?? target.r, col: target.col }));
        const selectedEntry = findEntryForCell(entries, selected);
        hidePreRenderedSpawnStone(selectedEntry);
        applyTemporaryNumberLabels(entries);

        await playRouletteSequence(entries, selectedEntry, durationMs, deps);
        clearRouletteClasses(entries);
        if (selectedEntry && selectedEntry.element) {
            try { selectedEntry.element.classList.add(ROULETTE_SELECTED_CLASS); } catch (e) { /* ignore */ }
        }
        await materializeSelectedStone(target, deps, materializeMs);
        clearTemporaryNumberLabels(entries);
    }
}

module.exports = {
    handleTheoryIncarnationSpawnRouletteEvent
};
