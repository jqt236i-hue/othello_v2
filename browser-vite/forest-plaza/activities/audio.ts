const KEY = 'cardReversi.forestPlaza.sound.v1';
/** unlock はユーザー操作の「歩きはじめる」からのみ呼ぶ。context() は勝手に生成しない。 */
export class PlazaAudio {
  private ctx: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true;
  constructor() { try { this.enabled = JSON.parse(localStorage.getItem(KEY) ?? 'true') !== false; } catch { /* 保存不可 */ } }
  context(): AudioContext | null { return this.ctx; }
  unlock(): void {
    if (!this.ctx) { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); this.master.gain.value = this.enabled ? 0.35 : 0; }
    void this.ctx.resume();
  }
  setEnabled(value: boolean): void {
    this.enabled = value;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(value ? 0.35 : 0, this.ctx.currentTime, 0.05);
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* 保存不可 */ }
  }
  dispose(): void { this.master?.disconnect(); if (this.ctx) void this.ctx.close(); this.ctx = null; this.master = null; }
}
