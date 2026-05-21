import type { StoryAssetRegistry } from '../content/story-assets';

export type StoryAudioOptions = {
  assets: StoryAssetRegistry;
  createAudio?: (src?: string) => HTMLAudioElement;
  now?: () => number;
  textBlipSeId?: string | null;
  textBlipMinIntervalMs?: number;
};

export class StoryAudio {
  private readonly assets: StoryAssetRegistry;
  private readonly createAudio: (src?: string) => HTMLAudioElement;
  private readonly now: () => number;
  private readonly textBlipSeId: string | null;
  private readonly textBlipMinIntervalMs: number;
  private bgm: HTMLAudioElement | null = null;
  private bgmVolume = 0.35;
  private seVolume = 0.4;
  private unlocked = false;
  private lastTextBlipAt = Number.NEGATIVE_INFINITY;

  constructor(options: StoryAudioOptions) {
    this.assets = options.assets;
    this.createAudio = options.createAudio ?? ((src?: string) => new Audio(src));
    this.now = options.now ?? (() => Date.now());
    this.textBlipSeId = resolveTextBlipSeId(this.assets, options.textBlipSeId);
    this.textBlipMinIntervalMs = Math.max(0, Number(options.textBlipMinIntervalMs ?? 45));
  }

  unlock(): void {
    this.unlocked = true;
  }

  playBgm(id: string): void {
    this.unlock();
    const src = this.requireBgm(id);
    this.stopBgm();
    const audio = this.createAudio(src);
    audio.loop = true;
    audio.volume = this.bgmVolume;
    this.bgm = audio;
    void audio.play();
  }

  stopBgm(): void {
    if (!this.bgm) return;
    this.bgm.pause();
    this.bgm.currentTime = 0;
    this.bgm = null;
  }

  crossfadeBgm(id: string): void {
    // Keep the first implementation deterministic; timed fades can be added after UI polish.
    this.playBgm(id);
  }

  playSe(id: string): void {
    this.unlock();
    const src = this.requireSe(id);
    const audio = this.createAudio(src);
    audio.volume = this.seVolume;
    void audio.play();
  }

  beginTextLine(): void {
    this.lastTextBlipAt = Number.NEGATIVE_INFINITY;
  }

  playTextBlip(character: string): void {
    if (!this.textBlipSeId) return;
    if (!shouldPlayTextBlip(character)) return;
    const now = this.now();
    if (now - this.lastTextBlipAt < this.textBlipMinIntervalMs) return;
    this.lastTextBlipAt = now;
    this.playSe(this.textBlipSeId);
  }

  setBgmVolume(volume: number): void {
    this.bgmVolume = clampVolume(volume);
    if (this.bgm) {
      this.bgm.volume = this.bgmVolume;
    }
  }

  setSeVolume(volume: number): void {
    this.seVolume = clampVolume(volume);
  }

  dispose(): void {
    this.stopBgm();
    this.unlocked = false;
    this.lastTextBlipAt = Number.NEGATIVE_INFINITY;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  private requireBgm(id: string): string {
    const src = this.assets.bgm[id];
    if (!src) {
      throw new Error(`Unknown story bgm id: ${id}`);
    }
    return src;
  }

  private requireSe(id: string): string {
    const src = this.assets.se[id];
    if (!src) {
      throw new Error(`Unknown story se id: ${id}`);
    }
    return src;
  }
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.max(0, Math.min(1, volume));
}

function resolveTextBlipSeId(assets: StoryAssetRegistry, configuredId?: string | null): string | null {
  if (configuredId === null) return null;
  if (configuredId) return configuredId;
  if (assets.se['テキストクリック']) return 'テキストクリック';
  return null;
}

function shouldPlayTextBlip(character: string): boolean {
  if (!character) return false;
  return !/^[\s。、，「」『』（）\[\]{}・…!?！？ー―.,:;"'`~]+$/.test(character);
}
