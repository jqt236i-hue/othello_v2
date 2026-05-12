// @ts-nocheck
'use strict';

function ensureArray(value: any) {
    if (value == null) return [];
    return Array.isArray(value) ? value.slice() : [value];
}

function mergeObject(base: any, override: any) {
    return Object.assign(
        {},
        base && typeof base === 'object' && !Array.isArray(base) ? base : {},
        override && typeof override === 'object' && !Array.isArray(override) ? override : {}
    );
}

function mergeTrainingProfilePreset(base: any, override: any) {
    const merged = Object.assign({}, base || {}, override || {});
    merged.paths = mergeObject(base && base.paths, override && override.paths);
    merged.bootstrap = mergeObject(base && base.bootstrap, override && override.bootstrap);
    merged.preflight = mergeObject(base && base.preflight, override && override.preflight);
    merged.sharedTeacherSync = mergeObject(base && base.sharedTeacherSync, override && override.sharedTeacherSync);
    merged.trainCycleArgs = ensureArray(base && base.trainCycleArgs).concat(ensureArray(override && override.trainCycleArgs));
    return merged;
}

function resolveTrainingProfilePresetRefs(profile: any, context: any) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
    const presetRefs = ensureArray(profile.presetRefs || profile.presets);
    if (presetRefs.length <= 0) return profile;
    if (!context || typeof context.loadPreset !== 'function') {
        throw new Error('training profile preset resolver requires loadPreset');
    }

    let merged = {};
    for (const ref of presetRefs) {
        const preset = context.loadPreset(ref);
        merged = mergeTrainingProfilePreset(merged, preset);
    }
    const profileWithoutPresetRefs = Object.assign({}, profile);
    delete profileWithoutPresetRefs.presetRefs;
    delete profileWithoutPresetRefs.presets;
    return mergeTrainingProfilePreset(merged, profileWithoutPresetRefs);
}

export = {
    mergeTrainingProfilePreset,
    resolveTrainingProfilePresetRefs
};
