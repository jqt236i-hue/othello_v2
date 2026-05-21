import type { SerializedStoryState } from '../core/story-state';

export type StorySaveAdapter = {
  load: (scenarioId: string) => SerializedStoryState | null;
  save: (state: SerializedStoryState) => void;
  clear: (scenarioId: string) => void;
};

export type StoryStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function createLocalStorageStorySaveAdapter(storage: StoryStorageLike): StorySaveAdapter {
  return {
    load(scenarioId) {
      const raw = storage.getItem(getStorySaveKey(scenarioId)) || storage.getItem(getLegacyStorySaveKey(scenarioId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SerializedStoryState;
      if (!parsed || parsed.scenarioId !== scenarioId) {
        throw new Error(`Story save scenarioId mismatch for ${scenarioId}.`);
      }
      return parsed;
    },
    save(state) {
      const value = JSON.stringify({ ...state, lastPlayedAt: new Date().toISOString() });
      storage.setItem(getStorySaveKey(state.scenarioId), value);
      storage.setItem(getLegacyStorySaveKey(state.scenarioId), value);
    },
    clear(scenarioId) {
      storage.removeItem(getStorySaveKey(scenarioId));
      storage.removeItem(getLegacyStorySaveKey(scenarioId));
    }
  };
}

export function getStorySaveKey(scenarioId: string): string {
  return `card-reversi:story:${scenarioId}:save`;
}

export function getLegacyStorySaveKey(scenarioId: string): string {
  return `card-othello:story:${scenarioId}:save`;
}
