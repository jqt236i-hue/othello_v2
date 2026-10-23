const KEY = 'cardReversi.forestPlaza.sound.v1';
/** unlock はユーザー操作の「歩きはじめる」からのみ呼ぶ。context() は勝手に生成しない。 */
export class PlazaAudio {
  private ctx: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true;
  // 活動は非表示中に更新されないため、予約済み音符を含め音声の時計も止める。
  private readonly visibilityChanged = () => this.syncPlayback();
  constructor() {
    try { this.enabled = JSON.parse(localStorage.getItem(KEY) ?? 'true') !== false; } catch { /* 保存不可 */ }
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }
  private syncPlayback(): void {
    if (!this.ctx || this.ctx.state === 'closed') return;
    // suspend/resume は同じcontextの操作順に処理される。素早いタブ往復も最後の状態に戻る。
    void (document.hidden ? this.ctx.suspend() : this.ctx.resume()).catch(() => { /* 終了との競合・ブラウザによる再開拒否 */ });
  }
  context(): AudioContext | null { return this.ctx; }
  unlock(): void {
    if (!this.ctx) { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); this.master.gain.value = this.enabled ? 0.35 : 0; }
    this.syncPlayback();
  }
  setEnabled(value: boolean): void {
    this.enabled = value;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(value ? 0.35 : 0, this.ctx.currentTime, 0.05);
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* 保存不可 */ }
  }
  dispose(): void {
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.master?.disconnect(); if (this.ctx) void this.ctx.close(); this.ctx = null; this.master = null;
  }
}
