'use strict';

type CpuProfilePlayerKey = 'black' | 'white';

interface CpuSmartnessSelection {
    black: number | string;
    white: number | string;
}

function resolveDocument(doc?: Document | null): Document | null {
    if (doc && typeof doc.getElementById === 'function') return doc;
    return typeof document !== 'undefined' ? document : null;
}

function getCpuProfileSelectId(playerKey: unknown): string {
    return playerKey === 'white' ? 'smartWhite' : 'smartBlack';
}

function readRawSelectValue(selectId: unknown, doc?: Document | null): string {
    try {
        const resolvedDoc = resolveDocument(doc);
        const id = String(selectId || '').trim();
        const select = resolvedDoc && id ? resolvedDoc.getElementById(id) as HTMLSelectElement | null : null;
        return String(select && select.value || '');
    } catch (e) {
        return '';
    }
}

function readCpuProfileValueFromSelect(playerKey: CpuProfilePlayerKey | unknown, doc?: Document | null): string {
    return readRawSelectValue(getCpuProfileSelectId(playerKey), doc);
}

function readCpuSmartnessValueFromSelectId(selectId: unknown, doc?: Document | null): number | string {
    const raw = readRawSelectValue(selectId, doc).trim();
    if (!raw) return 1;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(1, Math.min(7, Math.floor(n))) : raw;
}

function readCpuSmartnessFromSelects(doc?: Document | null): CpuSmartnessSelection {
    return {
        black: readCpuSmartnessValueFromSelectId('smartBlack', doc),
        white: readCpuSmartnessValueFromSelectId('smartWhite', doc)
    };
}

export = {
    readCpuProfileValueFromSelect,
    readCpuSmartnessValueFromSelectId,
    readCpuSmartnessFromSelects
};
