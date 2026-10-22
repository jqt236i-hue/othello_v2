/** オリジナルの小曲。数字はMIDI音名、1小節4拍。楽譜と音源を同じ純粋データから生成する。 */
export interface PianoNote { midi: number; time: number; duration: number; velocity: number }
export interface PianoSong { id: string; title: string; bpm: number; bars: readonly (readonly number[])[]; bass: readonly number[] }
export const PIANO_SONGS: readonly PianoSong[] = [
  { id: 'sunlit', title: '木漏れ日の午後', bpm: 80,
    bars: [[72,76,79,76],[74,77,81,77],[76,79,83,79],[74,77,79,77],[72,76,79,84],[83,79,77,74],[76,74,72,71],[72,76,79,72]], bass: [48,50,52,55,48,53,55,48] },
  { id: 'lantern', title: 'ランタンの小径', bpm: 76,
    bars: [[69,72,76,72],[67,71,74,71],[65,69,72,69],[64,67,71,67],[69,76,74,72],[71,74,72,67],[69,67,64,71],[69,72,71,69]], bass: [45,43,41,40,45,43,40,45] },
  { id: 'moss', title: '苔の庭', bpm: 84,
    bars: [[67,71,74,71],[69,72,76,72],[71,74,79,74],[69,74,78,74],[67,74,71,79],[76,72,69,72],[74,71,69,66],[67,71,74,67]], bass: [43,45,47,50,43,48,50,43] },
];
export function songNotes(song: PianoSong): PianoNote[] {
  const beat = 60 / song.bpm, notes: PianoNote[] = [];
  for (let bar = 0; bar < 16; bar++) {
    const phrase = song.bars[bar % song.bars.length], bass = song.bass[bar % song.bass.length];
    phrase.forEach((midi, i) => notes.push({ midi, time: (bar * 4 + i) * beat, duration: beat * (bar === 15 && i === 3 ? 1.8 : 0.86), velocity: i === 0 ? 0.82 : 0.67 }));
    notes.push({ midi: bass, time: bar * 4 * beat, duration: beat * 2.7, velocity: 0.58 });
    for (const i of [1, 3]) notes.push({ midi: bass + 12, time: (bar * 4 + i) * beat, duration: beat * 1.3, velocity: 0.32 });
  }
  return notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
}
export function songDuration(song: PianoSong): number { return 64 * 60 / song.bpm + 2.5; }
export function pianoDistanceGain(distance: number): number { return 0.08 + 0.92 / (1 + (Math.max(0, distance) / 5) ** 2); }
export function midiFrequency(midi: number): number { return 440 * 2 ** ((midi - 69) / 12); }

/** 打鍵の速い立ち上がり、弦ごとに異なる減衰と微弱な離調。サンプル素材なし。 */
function pianoBuffer(ctx: BaseAudioContext, midi: number, duration: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil((duration + 2) * ctx.sampleRate), ctx.sampleRate), data = buffer.getChannelData(0);
  const hz = midiFrequency(midi), partials = [1, 0.39, 0.19, 0.075, 0.035, 0.014];
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate, attack = 1 - Math.exp(-t * 420);
    const release = t < duration ? 1 : Math.exp(-(t - duration) * 5.5);
    let v = 0;
    for (let p = 1; p <= partials.length; p++) {
      const decay = Math.exp(-t * (0.75 + p * 0.42 + hz / 2400));
      v += partials[p - 1] * decay * (Math.sin(2 * Math.PI * hz * p * t) + 0.16 * Math.sin(2 * Math.PI * hz * p * 1.0008 * t));
    }
    const hammer = Math.sin(i * 1.731) * Math.sin(i * 0.913) * Math.exp(-t * 115) * 0.045;
    data[i] = (v * attack * release + hammer) * 0.14;
  }
  return buffer;
}
export interface PianoVoice { update(distance: number, pan: number): void; stop(): void }
/** realtimeは小窓だけ予約。offlineは全音符を予約して同じ音色を数値検証できる。 */
export function createPianoVoice(ctx: BaseAudioContext, master: AudioNode, song: PianoSong, offline = false): PianoVoice {
  const gain = ctx.createGain(), pan = ctx.createStereoPanner(), dry = ctx.createGain(), wet = ctx.createGain(), reverb = ctx.createConvolver();
  gain.gain.value = 0.75; dry.gain.value = 0.88; wet.gain.value = 0.15;
  const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 1.3), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const a = impulse.getChannelData(ch); for (let i = 0; i < a.length; i++) a[i] = Math.sin(i * (ch ? 1.371 : 1.713)) * Math.sin(i * 0.173) * Math.exp(-i / ctx.sampleRate * 5) * 0.25; }
  reverb.buffer = impulse; dry.connect(gain); reverb.connect(wet); wet.connect(gain); gain.connect(pan); pan.connect(master);
  const notes = songNotes(song), start = ctx.currentTime + 0.05, active = new Set<AudioBufferSourceNode>(), cache = new Map<string, AudioBuffer>();
  let cursor = 0, stopped = false;
  function schedule() {
    if (stopped) return;
    while (cursor < notes.length && (offline || start + notes[cursor].time < ctx.currentTime + 0.4)) {
      const n = notes[cursor++], key = `${n.midi}:${n.duration}`, source = ctx.createBufferSource(), level = ctx.createGain();
      let buffer = cache.get(key); if (!buffer) { buffer = pianoBuffer(ctx, n.midi, n.duration); cache.set(key, buffer); }
      source.buffer = buffer; level.gain.value = n.velocity; source.connect(level); level.connect(dry); level.connect(reverb); active.add(source);
      source.onended = () => { active.delete(source); source.disconnect(); level.disconnect(); };
      source.start(start + n.time);
    }
  }
  schedule();
  return {
    update(distance, position) { if (stopped) return; gain.gain.setTargetAtTime(pianoDistanceGain(distance) * 0.75, ctx.currentTime, 0.12); pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, position)), ctx.currentTime, 0.12); schedule(); },
    stop() {
      if (stopped) return; stopped = true;
      const now = ctx.currentTime; gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(0, now, 0.09);
      for (const source of active) source.stop(now + 0.55);
      // 声を落としてから配線を外す。停止中のcontextでも必ず資源を解放する。
      setTimeout(() => { for (const source of active) source.disconnect(); active.clear(); cache.clear(); for (const node of [dry, reverb, wet, gain, pan]) node.disconnect(); }, 600);
    },
  };
}

export async function renderPianoSong(song: PianoSong, sampleRate = 22050): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(2, Math.ceil((songDuration(song) + 0.2) * sampleRate), sampleRate);
  createPianoVoice(context, context.destination, song, true);
  return context.startRendering();
}
