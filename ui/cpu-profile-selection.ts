'use strict';

import CpuOpponentProfiles = require('../shared/cpu-opponent-profiles');

type CpuProfilePlayerKey = 'black' | 'white';

interface CpuSmartnessSelection {
    black: number | string;
    white: number | string;
}

const CPU_PROFILE_STORAGE_KEY='card-reversi.cpu-profiles.v1';

function normalizeStoredProfile(value:unknown): string | null {
    const raw=String(value ?? '').trim();
    const numeric=Number(raw);
    const known=CpuOpponentProfiles.getCpuOpponentMenuOptions().some(option=>String(option.value)===raw);
    if(!known && !(raw && Number.isInteger(numeric) && numeric>=1 && numeric<=11))return null;
    return CpuOpponentProfiles.getCpuOpponentProfileId(raw);
}

function readStoredCpuProfiles(doc?:Document|null): Partial<Record<CpuProfilePlayerKey,string>> {
    try {
        const storage=resolveDocument(doc)?.defaultView?.localStorage;
        const saved=JSON.parse(storage?.getItem(CPU_PROFILE_STORAGE_KEY)||'null');
        const out:Partial<Record<CpuProfilePlayerKey,string>>={};
        for(const player of ['black','white'] as const) {
            const value=normalizeStoredProfile(saved?.[player]);
            if(value)out[player]=value;
        }
        return out;
    } catch { return {}; }
}

function writeStoredCpuProfile(player:CpuProfilePlayerKey,value:unknown,doc?:Document|null): boolean {
    const profile=normalizeStoredProfile(value);
    if(!profile)return false;
    try {
        const storage=resolveDocument(doc)?.defaultView?.localStorage;
        if(!storage)return false;
        storage.setItem(CPU_PROFILE_STORAGE_KEY,JSON.stringify({...readStoredCpuProfiles(doc),[player]:profile}));
        return true;
    } catch { return false; }
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
        const value=String(select && select.value || '');
        // The initial deal can run before the select's options are installed.
        // Restore the same profile here so opening perks and visible selection
        // agree from the first canonical reset after a reload.
        if(value)return value;
        const player=id==='smartBlack'?'black':id==='smartWhite'?'white':null;
        return player ? readStoredCpuProfiles(resolvedDoc)[player] || '' : '';
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
    return Number.isFinite(n) ? Math.max(1, Math.min(11, Math.floor(n))) : raw;
}

function readCpuSmartnessFromSelects(doc?: Document | null): CpuSmartnessSelection {
    return {
        black: readCpuSmartnessValueFromSelectId('smartBlack', doc),
        white: readCpuSmartnessValueFromSelectId('smartWhite', doc)
    };
}

export = {
    CPU_PROFILE_STORAGE_KEY,
    readStoredCpuProfiles,
    writeStoredCpuProfile,
    readCpuProfileValueFromSelect,
    readCpuSmartnessValueFromSelectId,
    readCpuSmartnessFromSelects
};
