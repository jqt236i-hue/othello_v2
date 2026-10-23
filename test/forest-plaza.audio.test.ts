import { PlazaAudio } from '../browser-vite/forest-plaza/activities/audio';
import { createPianoVoice, PIANO_SONGS } from '../browser-vite/forest-plaza/activities/pianoSynth';

function setup() {
  const descriptors = new Map(['document', 'AudioContext', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const listeners = new Set<() => void>();
  const doc = {
    hidden: false,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  const param = () => ({ value: 0, setTargetAtTime: jest.fn(), cancelScheduledValues: jest.fn() });
  const node = () => ({ connect: jest.fn(), disconnect: jest.fn(), gain: param(), pan: param() });
  const starts: number[] = [];
  class Context {
    state = 'suspended'; currentTime = 0; sampleRate = 100; destination = node();
    resume = jest.fn(async () => { this.state = 'running'; });
    suspend = jest.fn(async () => { this.state = 'suspended'; });
    close = jest.fn(async () => { this.state = 'closed'; });
    createGain = node; createStereoPanner = node; createConvolver = node;
    createBuffer = (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
    createBufferSource = () => ({ ...node(), start: (when: number) => starts.push(when), stop: jest.fn() });
    advance(seconds: number) { if (this.state === 'running') this.currentTime += seconds; }
  }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: jest.fn() } });
  const audio = new PlazaAudio();
  return {
    audio, starts, listeners,
    context: () => audio.context() as unknown as Context,
    visibility(hidden: boolean) { doc.hidden = hidden; for (const listener of listeners) listener(); },
    cleanup() {
      audio.dispose();
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

describe('森の広場 音声と非表示中の活動停止', () => {
  test('30秒の非表示から復帰しても音声時計は進まず、過去の音符をまとめて予約しない', () => {
    jest.useFakeTimers();
    const s = setup();
    try {
      s.audio.unlock();
      const ctx = s.context();
      const voice = createPianoVoice(s.audio.context()!, s.audio.master!, PIANO_SONGS[0]);
      const initial = s.starts.length;
      s.visibility(true); ctx.advance(30);
      s.visibility(false); voice.update(1, 0);
      expect(ctx.currentTime).toBe(0);
      expect(s.starts).toHaveLength(initial);
      expect(s.starts.every(when => when >= ctx.currentTime)).toBe(true);
      // 可視状態の活動が再び進むと、曲も同じ時点から続きを予約する。
      ctx.advance(0.5); voice.update(1, 0);
      expect(s.starts.length).toBeGreaterThan(initial);
      expect(s.starts.slice(initial).every(when => when >= ctx.currentTime)).toBe(true);
      voice.stop(); jest.runOnlyPendingTimers();
    } finally { s.cleanup(); jest.useRealTimers(); }
  });

  test('ユーザー操作前のタブ往復は音声を生成せず、初回操作時にも非表示なら停止を保つ', () => {
    const s = setup();
    try {
      s.visibility(true); s.visibility(false);
      expect(s.audio.context()).toBeNull();
      s.visibility(true); s.audio.unlock();
      expect(s.context().state).toBe('suspended');
      expect(s.context().resume).not.toHaveBeenCalled();
      s.visibility(false);
      expect(s.context().state).toBe('running');
    } finally { s.cleanup(); }
  });

  test('素早いタブ往復後も最終状態へ戻り、終了時は可視状態リスナーを解除する', () => {
    const s = setup();
    try {
      s.audio.unlock(); const ctx = s.context();
      s.visibility(true); s.visibility(false); s.visibility(true); s.visibility(false);
      expect(ctx.state).toBe('running');
      expect(ctx.suspend).toHaveBeenCalledTimes(2);
      expect(ctx.resume).toHaveBeenCalledTimes(3);
      s.audio.dispose();
      expect(s.listeners.size).toBe(0);
      s.visibility(true); s.visibility(false);
      expect(ctx.resume).toHaveBeenCalledTimes(3);
      expect(ctx.close).toHaveBeenCalledTimes(1);
    } finally { s.cleanup(); }
  });
});
