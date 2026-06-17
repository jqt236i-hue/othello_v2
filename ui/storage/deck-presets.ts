/**
 * @file deck-presets.ts
 * @description Deck preset storage management
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface Preset {
  id: string;
  name: string;
  deckCode: string;
  updatedAt: number;
}

interface DeckPresetState {
  version: number;
  activePresetId: string;
  presets: Preset[];
}

const STORAGE_KEY = 'deck_builder_presets_v1';
const STATE_VERSION = 1;
const PRESET_LIMIT = 6;
const PRESET_IDS: readonly string[] = Object.freeze([
  'preset_1',
  'preset_2',
  'preset_3',
  'preset_4',
  'preset_5',
  'preset_6'
]);

function normalizePresetName(value: unknown): string {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  return Array.from(raw).slice(0, 24).join('');
}

function createEmptyPreset(index: number): Preset {
  return {
    id: PRESET_IDS[index],
    name: '',
    deckCode: '',
    updatedAt: 0
  };
}

function createDefaultState(): DeckPresetState {
  return {
    version: STATE_VERSION,
    activePresetId: '',
    presets: PRESET_IDS.map((_, index) => createEmptyPreset(index))
  };
}

function normalizeState(rawState: unknown): DeckPresetState {
  const source = (rawState && typeof rawState === 'object') ? rawState as Record<string, unknown> : {};
  const presetsSource = Array.isArray(source.presets) ? source.presets as Array<Record<string, unknown> | null> : [];
  const presets = PRESET_IDS.map((presetId, index) => {
    const candidate = presetsSource.find((entry) => entry && String(entry.id || '') === presetId) || {};
    return {
      id: presetId,
      name: normalizePresetName(candidate.name),
      deckCode: String(candidate.deckCode || '').trim(),
      updatedAt: Number.isFinite(Number(candidate.updatedAt))
        ? Math.max(0, Math.trunc(Number(candidate.updatedAt)))
        : 0
    };
  });

  const activePresetId = PRESET_IDS.includes(String(source.activePresetId || ''))
    ? String(source.activePresetId)
    : '';

  return {
    version: STATE_VERSION,
    activePresetId,
    presets
  };
}

function loadState(): DeckPresetState {
  try {
    if (typeof localStorage === 'undefined') {
      return createDefaultState();
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    return createDefaultState();
  }
}

function saveState(nextState: unknown): DeckPresetState {
  const normalized = normalizeState(nextState);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch (e) { /* ignore */ }
  return normalized;
}

export = {
  STORAGE_KEY,
  STATE_VERSION,
  PRESET_LIMIT,
  PRESET_IDS,
  createDefaultState,
  normalizeState,
  loadState,
  saveState
};
