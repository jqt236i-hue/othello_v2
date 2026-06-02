declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

// ===== Sound Engine (Web Audio API) =====


interface BgmTrack {
    name: string;
    file: string;
    loopStart?: number;
    loopEnd?: number;
}

interface ResultBgmTrack extends BgmTrack {
    file: string;
    loop: boolean;
    loopStart?: number;
    loopEnd?: number;
}

interface EffectVolumeScales {
    [key: string]: number;
}

interface EffectSoundFiles {
    [key: string]: string;
}

interface EffectAudioPools {
    [key: string]: HTMLAudioElement[];
}

interface BgmBufferedState {
    track: BgmTrack;
    loopStart: number;
    loopEnd: number;
    duration: number;
    pauseOffset: number;
    startedAt: number;
    startedOffset: number;
    loadingPromise: Promise<AudioBuffer> | null;
    buffer: AudioBuffer | null;
    gainNode: GainNode | null;
    source: AudioBufferSourceNode | null;
    controller: any;
}

const SoundEngine = {
    ctx: null as AudioContext | null,
    isMuted: false,
    volume: 0.56,
    bgm: null as any,
    bgmVolume: 0.665,
    bgmOutputVolumeScale: 0.364,
    currentTrackIndex: 5,
    allowBgmPlay: true, // Default to true requested by user
    resultBgmTracks: {
        win: { name: '勝利リザルト', file: 'assets/audio/other/勝利リザルト-bpm165.mp3', loop: false },
        lose: { name: '敗北リザルト', file: 'assets/audio/other/敗北リザルト-bpm115.mp3', loop: true, loopEnd: 90 * 60 / 115 }
    } as Record<string, ResultBgmTrack>,
    _resultBgm: null as HTMLAudioElement | null,
    _resultBgmSource: null as AudioBufferSourceNode | null,
    _resultBgmGainNode: null as GainNode | null,
    _resultBgmOutcomeKey: null as string | null,
    _resultBgmPausedNormalBgm: false,
    _resultBgmLoadToken: null as any,
    _bgmBufferedState: null as BgmBufferedState | null,
    _bgmBufferCache: {} as Record<string, AudioBuffer | Promise<AudioBuffer>>,
    _effectAudioPools: {} as EffectAudioPools,
    effectAudioPoolSize: 3,
    _effectWarmupStarted: false,

    // BGM Playlist
    playlist: [
        { name: 'c-reversi', file: 'assets/audio/bgm/c-reversi.mp3' },
        { name: 'c-reversi-2', file: 'assets/audio/bgm/c-reversi-2.mp3' },
        { name: '盤喰いの小鬼戦', file: 'assets/audio/bgm/盤喰いの小鬼戦.mp3', loopStart: 1.655 },
        { name: '幻想即興曲', file: 'assets/audio/bgm/幻想即興曲.mp3' },
        { name: 'ノクターン', file: 'assets/audio/bgm/ノクターン.mp3' },
        { name: 'The Observer’s Tears', file: 'assets/audio/bgm/The Observer’s Tears.mp3', loopEnd: 58.434783 }
    ] as BgmTrack[],
    effectBasePath: 'assets/audio/sound-effect/',
    effectSoundFiles: {
        card_use_button: 'カード使用ボタンを押したタイミング.mp3',
        hand_card_select: '手札のカードを選択したタイミング.mp3',
        stone_place: 'assets/audio/sound-effect-skin/default.mp3',
        clone_spawn: '石が複製・増殖したタイミング.mp3',
        trap_select: '罠・時限爆弾の石を選択したタイミング.mp3',
        guard_select: '自分の石を選択したタイミング.mp3',
        blockade_select: '封鎖の意志を置くタイミング.mp3',
        freeze_select: '凍結するマスを選択したタイミング.mp3',
        trap_triggered: '罠が発動したタイミング.mp3',
        trap_misfire: '罠が不発で消えたタイミング.mp3',
        board_expansion_reveal: '盤面が拡張されたタイミング.mp3',
        board_shrink_selected: '盤面縮小するタイミング.mp3',
        strong_wind_move: '強風で石が移動したタイミング.mp3',
        position_swap_move: '入替の意志で石が入れ替わるタイミング.mp3',
        super_buoyancy_move: '浮力系で石が浮上したタイミング.mp3',
        super_gravity_move: '重力系で石が落下したタイミング.mp3',
        super_attraction_move: '超引力で石が引き寄せられたタイミング.mp3',
        round_bonus: 'ラウンドボーナスで布石を獲得したタイミング.mp3',
        teleport_select: 'テレポート対象の石を選択したタイミング.mp3',
        tempt_select: '相手特殊石を選択したタイミング.mp3',
        treasure_gain: '宝箱・天の恵みで獲得したタイミング.mp3',
        loss_will_reset: '意志の喪失で特殊石が解除されたタイミング.mp3',
        strong_will_promoted: '強い意志の石が進化したタイミング.mp3',
        living_will_selected: '生きる意志を付与するタイミング.mp3',
        living_will_restored: '生きる意志で復活するタイミング.mp3',
        extend_life: '特殊石の持続ターンが延長されたタイミング.mp3',
        corrosion_tick: '特殊石の持続ターンが減少したタイミング.mp3',
        hyperactive_move: '多動系の石が移動したタイミング.mp3',
        ultimate_anchor_move: '究極反転龍・究極破壊神・意志狩りの王が移動したタイミング.mp3',
        robot_vacuum_suck: 'ロボット掃除機で敵石を吸い込んだタイミング.mp3',
        breeding_spawn: 'カード効果で石が生成されたタイミング.mp3',
        seed_place: '種まきの意志で種をまいたタイミング.mp3',
        seed_sprout: '種まきの意志で芽生えるタイミング.mp3',
        card_effect_flip: 'カード効果で石が反転したタイミング.mp3',
        bomb_explode: '爆弾系の石が起爆したタイミング.mp3',
        stone_destroy: '石・カードが破壊されたタイミング.mp3',
        special_reverted: '特殊石が通常石に戻ったタイミング.mp3',
        charge_gain_common: '売却・出稼ぎ・自壊で布石を獲得したタイミング.mp3',
        work_income_16: '出稼ぎで16布石を獲得したタイミング.mp3',
        work_removed: '出稼ぎの意志が除去されたタイミング.mp3'
    } as EffectSoundFiles,
    effectDefaultVolumeScale: 0.35,
    effectVolumeScales: {
        hand_card_select: 0.5,
        stone_place: 15 / 7,
        stone_destroy: 0.7,
        board_shrink_selected: 0.7
    } as EffectVolumeScales,
    _missingEffectWarned: {} as Record<string, boolean>,

    init() {
        this._ensureAudioContext(true);
        this.primeEffectSounds();

        // Init BGM on first interaction
        if (!this.bgm) {
            this.loadBgm(this.currentTrackIndex);
        } else if (this.allowBgmPlay && this.bgm.paused) {
            this.playBgm();
        }
    },

    _ensureAudioContext(resumeIfSuspended = false) {
        if (!this.ctx) {
            const AudioContext = (typeof globalThis !== 'undefined' && ((globalThis as any).AudioContext || (globalThis as any).webkitAudioContext)) || null;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (resumeIfSuspended && this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    },

    _resolveBgmTrack(index: number | string) {
        const numericIndex = Number(index);
        const fallbackIndex = Math.max(0, Math.min(this.playlist.length - 1, Number(this.currentTrackIndex) || 0));
        const normalizedIndex = Number.isInteger(numericIndex)
            ? Math.max(0, Math.min(this.playlist.length - 1, numericIndex))
            : fallbackIndex;
        return {
            index: normalizedIndex,
            track: this.playlist[normalizedIndex] || null
        };
    },

    _resolveBgmLoopStart(track: BgmTrack | null) {
        const loopStart = Number(track && track.loopStart);
        return Number.isFinite(loopStart) ? Math.max(0, loopStart) : 0;
    },

    _resolveBgmLoopEnd(track: BgmTrack | null, duration: number, loopStart: number) {
        const loopEnd = Number(track && track.loopEnd);
        if (Number.isFinite(loopEnd) && loopEnd > loopStart && loopEnd <= duration) {
            return loopEnd;
        }
        return Number.isFinite(duration) ? Math.max(loopStart, duration) : loopStart;
    },

    _hasExplicitBgmLoopWindow(track: BgmTrack | null) {
        const loopStart = this._resolveBgmLoopStart(track);
        const loopEnd = Number(track && track.loopEnd);
        return loopStart > 0 || (Number.isFinite(loopEnd) && loopEnd > loopStart);
    },

    _canUseBufferedBgmLoop(track: BgmTrack | null) {
        if (!this._hasExplicitBgmLoopWindow(track)) return false;
        if (typeof fetch !== 'function') return false;
        const ctx = this.ctx || this._ensureAudioContext(false);
        return !!(
            ctx &&
            typeof ctx.createBufferSource === 'function' &&
            typeof ctx.createGain === 'function' &&
            typeof ctx.decodeAudioData === 'function'
        );
    },

    _isBufferedBgmController(audio: any) {
        return !!(audio && audio.__bufferedLoop === true);
    },

    _getBgmOutputVolume() {
        const sliderVolume = this._toNonNegativeNumber(this.bgmVolume, 0);
        const outputScale = this._toNonNegativeNumber(this.bgmOutputVolumeScale, 1);
        return this._clamp01(sliderVolume * outputScale * (this.isMuted ? 0 : 1));
    },

    _updateResultBgmVolume() {
        const volume = this._getBgmOutputVolume();
        if (this._resultBgm) {
            this._resultBgm.volume = volume;
        }
        if (this._resultBgmGainNode && this._resultBgmGainNode.gain) {
            if (typeof this._resultBgmGainNode.gain.setValueAtTime === 'function' && this.ctx && Number.isFinite(Number(this.ctx.currentTime))) {
                this._resultBgmGainNode.gain.setValueAtTime(volume, Number(this.ctx.currentTime));
            } else if ('value' in this._resultBgmGainNode.gain) {
                this._resultBgmGainNode.gain.value = volume;
            }
        }
    },

    _updateBufferedBgmVolume(state?: BgmBufferedState | null) {
        if (typeof state === 'undefined') state = this._bgmBufferedState;
        if (!state) return;
        const volume = this._getBgmOutputVolume();
        if (state.controller) {
            state.controller.volume = volume;
        }
        if (state.gainNode && state.gainNode.gain) {
            if (typeof state.gainNode.gain.setValueAtTime === 'function' && this.ctx && Number.isFinite(Number(this.ctx.currentTime))) {
                state.gainNode.gain.setValueAtTime(volume, Number(this.ctx.currentTime));
            } else if ('value' in state.gainNode.gain) {
                state.gainNode.gain.value = volume;
            }
        }
    },

    _normalizeBufferedBgmOffset(offset: number, state: BgmBufferedState | null) {
        const numericOffset = Math.max(0, Number(offset) || 0);
        if (!state) return numericOffset;
        const loopStart = Number(state.loopStart) || 0;
        const loopEnd = Number(state.loopEnd) || 0;
        if (!(loopStart > 0) || !(loopEnd > loopStart)) {
            return numericOffset;
        }
        if (numericOffset < loopStart) return numericOffset;
        const loopLength = loopEnd - loopStart;
        return loopStart + ((numericOffset - loopStart) % loopLength);
    },

    _getBufferedBgmOffsetNow(state?: BgmBufferedState | null) {
        if (typeof state === 'undefined') state = this._bgmBufferedState;
        if (!state) return 0;
        if (!state.source || !this.ctx || !Number.isFinite(Number(this.ctx.currentTime))) {
            return this._normalizeBufferedBgmOffset(state.pauseOffset || 0, state);
        }
        const elapsed = Math.max(0, Number(this.ctx.currentTime) - Number(state.startedAt || 0));
        return this._normalizeBufferedBgmOffset(Number(state.startedOffset || 0) + elapsed, state);
    },

    _teardownBufferedBgmState(resetController = true) {
        const state = this._bgmBufferedState;
        if (!state) return;
        if (state.source) {
            const source = state.source;
            state.source = null;
            source.onended = null;
            try { source.stop(); } catch (e) { /* ignore */ }
            if (typeof source.disconnect === 'function') {
                try { source.disconnect(); } catch (e) { /* ignore */ }
            }
        }
        if (resetController && state.gainNode && typeof state.gainNode.disconnect === 'function') {
            try { state.gainNode.disconnect(); } catch (e) { /* ignore */ }
            state.gainNode = null;
        }
        if (state.controller) {
            state.controller.paused = true;
            if (resetController) {
                state.controller.currentTime = 0;
            }
        }
        if (resetController) {
            state.pauseOffset = 0;
            this._bgmBufferedState = null;
        }
    },

    async _loadBufferedBgmBuffer(track: BgmTrack) {
        const file = String(track && track.file ? track.file : '').trim();
        if (!file) throw new Error('Missing BGM file path');
        if (!this.ctx || typeof this.ctx.decodeAudioData !== 'function') {
            throw new Error('AudioContext decodeAudioData unavailable');
        }
        const cached = this._bgmBufferCache[file];
        if (cached) {
            return (typeof (cached as any).then === 'function') ? await (cached as Promise<AudioBuffer>) : cached as AudioBuffer;
        }

        const tryLoad = async (url: string) => {
            const response = await fetch(url);
            if (!response || response.ok !== true) {
                throw new Error(`BGM fetch failed: ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const decodeInput = (arrayBuffer && typeof (arrayBuffer as any).slice === 'function')
                ? (arrayBuffer as any).slice(0)
                : arrayBuffer;
            return await this.ctx!.decodeAudioData(decodeInput);
        };

        const legacy = file.replace('assets/audio/bgm/', 'assets/');
        const loadPromise = (async () => {
            try {
                return await tryLoad(file);
            } catch (primaryError) {
                if (legacy !== file) {
                    return await tryLoad(legacy);
                }
                throw primaryError;
            }
        })();

        this._bgmBufferCache[file] = loadPromise;
        try {
            const buffer = await loadPromise;
            this._bgmBufferCache[file] = buffer;
            return buffer;
        } catch (e) {
            delete this._bgmBufferCache[file];
            throw e;
        }
    },

    async _playBufferedBgmState(state?: BgmBufferedState | null) {
        if (typeof state === 'undefined') state = this._bgmBufferedState;
        if (!state || this._bgmBufferedState !== state) return false;
        this.allowBgmPlay = true;
        try {
            this._ensureAudioContext(true);
        } catch (e) { /* ignore */ }
        if (!this.ctx) return false;

        if (!state.buffer) {
            try {
                state.loadingPromise = state.loadingPromise || this._loadBufferedBgmBuffer(state.track);
                state.buffer = await state.loadingPromise;
                state.duration = Number(state.buffer && state.buffer.duration) || 0;
                state.loopEnd = this._resolveBgmLoopEnd(state.track, state.duration, state.loopStart);
            } catch (e) {
                state.loadingPromise = null;
                if (this._bgmBufferedState === state) {
                    console.warn(`Buffered BGM loop unavailable for ${state.track && state.track.file ? state.track.file : 'unknown'}: ${e && (e as any).message ? (e as any).message : e}`);
                    this._teardownBufferedBgmState(true);
                    this._loadHtmlBgmTrack(state.track);
                }
                return false;
            }
            state.loadingPromise = null;
        }

        if (!state.buffer || !(state.loopEnd > state.loopStart) || state.source) {
            (window as any).updateBgmButtons();
            return !!state.source;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = state.buffer;
        source.loop = true;
        source.loopStart = state.loopStart;
        source.loopEnd = state.loopEnd;

        const gainNode = state.gainNode || this.ctx.createGain();
        if (!state.gainNode) {
            state.gainNode = gainNode;
            gainNode.connect(this.ctx.destination);
        }
        this._updateBufferedBgmVolume(state);

        source.connect(gainNode);
        state.source = source;

        const startOffset = this._normalizeBufferedBgmOffset(state.pauseOffset || 0, state);
        state.startedAt = Number(this.ctx.currentTime) || 0;
        state.startedOffset = startOffset;
        state.controller.currentTime = startOffset;
        state.controller.paused = false;
        source.onended = () => {
            if (state.source !== source) return;
            state.source = null;
            if (state.controller) {
                state.controller.paused = true;
            }
        };
        source.start(0, startOffset);
        (window as any).updateBgmButtons();
        return true;
    },

    _pauseBufferedBgmState(state?: BgmBufferedState | null) {
        if (typeof state === 'undefined') state = this._bgmBufferedState;
        if (!state || this._bgmBufferedState !== state) return;
        state.pauseOffset = this._getBufferedBgmOffsetNow(state);
        if (state.controller) {
            state.controller.currentTime = state.pauseOffset;
            state.controller.paused = true;
        }
        if (state.source) {
            const source = state.source;
            state.source = null;
            source.onended = null;
            try { source.stop(); } catch (e) { /* ignore */ }
            if (typeof source.disconnect === 'function') {
                try { source.disconnect(); } catch (e) { /* ignore */ }
            }
        }
    },

    _createBufferedBgmController(state: BgmBufferedState) {
        return {
            __bufferedLoop: true,
            paused: true,
            currentTime: 0,
            volume: this._getBgmOutputVolume(),
            play: () => this._playBufferedBgmState(state),
            pause: () => {
                this._pauseBufferedBgmState(state);
            },
            load: () => Promise.resolve()
        };
    },

    _playBgmElement(audio: HTMLAudioElement | any) {
        if (!audio || typeof audio.play !== 'function') return;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((e: any) => console.warn("BGM play failed:", e));
        }
    },

    _restartBgmFromLoopStart(audio: HTMLAudioElement | any, loopStart: number) {
        if (!audio || audio !== this.bgm) return;
        if (!this.allowBgmPlay) return;
        try {
            audio.currentTime = loopStart;
        } catch (e) { /* ignore */ }
        this._playBgmElement(audio);
    },

    _configureBgmLoop(audio: HTMLAudioElement | any, track: BgmTrack | null) {
        if (!audio) return;
        const loopStart = this._resolveBgmLoopStart(track);
        const hasExplicitLoopWindow = this._hasExplicitBgmLoopWindow(track);
        audio.ontimeupdate = null;
        audio.onended = null;
        if (!hasExplicitLoopWindow) {
            audio.loop = true;
            return;
        }

        audio.loop = false;
        audio.ontimeupdate = () => {
            if (audio !== this.bgm) return;
            const duration = Number(audio.duration);
            const loopEnd = this._resolveBgmLoopEnd(track, duration, loopStart);
            if (!Number.isFinite(loopEnd) || loopEnd <= loopStart) return;
            if (Number(audio.currentTime) >= loopEnd - 0.15) {
                try {
                    audio.currentTime = loopStart;
                } catch (e) { /* ignore */ }
            }
        };
        audio.onended = () => {
            this._restartBgmFromLoopStart(audio, loopStart);
        };
    },

    _loadHtmlBgmTrack(track: BgmTrack) {
        this.bgm = new Audio(track.file);
        this.bgm.preload = 'auto';
        this.bgm.onerror = () => {
            const legacy = track.file.replace('assets/audio/bgm/', 'assets/');
            if (this.bgm && this.bgm.src && this.bgm.src.endsWith(track.file)) {
                this.bgm.src = legacy;
                this.bgm.load();
                if (this.allowBgmPlay) this.playBgm();
            }
        };
        this._configureBgmLoop(this.bgm, track);
        this.bgm.volume = this._getBgmOutputVolume();

        if (this.allowBgmPlay) {
            this.playBgm();
        } else {
            (window as any).updateBgmButtons();
        }
    },

    loadBgm(index: number | string) {
        if (this._bgmBufferedState) {
            this._teardownBufferedBgmState(true);
        }
        if (this.bgm && !this._isBufferedBgmController(this.bgm)) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
            this.bgm.onerror = null;
            this.bgm.ontimeupdate = null;
            this.bgm.onended = null;
        }
        const resolvedTrack = this._resolveBgmTrack(index);
        this.currentTrackIndex = resolvedTrack.index;
        const track = resolvedTrack.track;
        if (!track) {
            this.bgm = null;
            (window as any).updateBgmButtons();
            return;
        }
        if (this._canUseBufferedBgmLoop(track)) {
            const state: BgmBufferedState = {
                track,
                loopStart: this._resolveBgmLoopStart(track),
                loopEnd: 0,
                duration: 0,
                pauseOffset: 0,
                startedAt: 0,
                startedOffset: 0,
                loadingPromise: null,
                buffer: null,
                gainNode: null,
                source: null,
                controller: null
            };
            state.controller = this._createBufferedBgmController(state);
            this._bgmBufferedState = state;
            this.bgm = state.controller;
            if (this.allowBgmPlay) {
                this._playBgmElement(this.bgm);
            } else {
                (window as any).updateBgmButtons();
            }
            return;
        }
        this._loadHtmlBgmTrack(track);
    },

    _canCreateEffectAudioElement() {
        return typeof Audio === 'function';
    },

    _createEffectAudioElement(filePath: string) {
        if (!this._canCreateEffectAudioElement()) return null;
        const audio = new Audio(filePath);
        audio.preload = 'auto';
        if (typeof audio.load === 'function') {
            try { audio.load(); } catch (e) { /* ignore */ }
        }
        return audio;
    },

    _getEffectAudioPool(filePath: string) {
        const key = String(filePath || '').trim();
        if (!key) return [];
        if (!Object.prototype.hasOwnProperty.call(this._effectAudioPools, key)) {
            const warmed = this._createEffectAudioElement(key);
            this._effectAudioPools[key] = warmed ? [warmed] : [];
        }
        return this._effectAudioPools[key];
    },

    _takeEffectAudio(filePath: string) {
        const pool = this._getEffectAudioPool(filePath);
        for (const candidate of pool) {
            if (candidate && candidate.paused !== false) {
                return candidate;
            }
        }
        if (pool.length < Math.max(1, Number(this.effectAudioPoolSize) || 1)) {
            const created = this._createEffectAudioElement(filePath);
            if (created) {
                pool.push(created);
                return created;
            }
        }
        return this._createEffectAudioElement(filePath);
    },

    _getRegisteredEffectFilePaths() {
        const seen = new Set<string>();
        const paths: string[] = [];
        const keys = Object.keys(this.effectSoundFiles || {});
        for (const key of keys) {
            const filePath = this.getEffectFilePath(key);
            if (!filePath || seen.has(filePath)) continue;
            seen.add(filePath);
            paths.push(filePath);
        }
        return paths;
    },

    _resetEffectWarmup() {
        this._effectAudioPools = {};
        this._effectWarmupStarted = false;
    },

    primeEffectSounds() {
        if (this._effectWarmupStarted) {
            return Object.keys(this._effectAudioPools || {}).length;
        }
        this._effectWarmupStarted = true;
        const filePaths = this._getRegisteredEffectFilePaths();
        for (const filePath of filePaths) {
            try { this._getEffectAudioPool(filePath); } catch (e) { /* ignore */ }
        }
        return filePaths.length;
    },

    registerEffectSound(key: string, fileName: string) {
        const k = String(key || '').trim();
        const f = String(fileName || '').trim();
        if (!k || !f) return false;
        const previousPath = this.getEffectFilePath(k);
        this.effectSoundFiles[k] = f;
        const nextPath = this.getEffectFilePath(k);
        if (previousPath && previousPath !== nextPath) {
            delete this._effectAudioPools[previousPath];
        }
        if (this._effectWarmupStarted && nextPath) {
            try { this._getEffectAudioPool(nextPath); } catch (e) { /* ignore */ }
        }
        return true;
    },

    registerEffectSounds(definitions: Record<string, string>) {
        if (!definitions || typeof definitions !== 'object') return 0;
        let count = 0;
        for (const key of Object.keys(definitions)) {
            if (this.registerEffectSound(key, definitions[key])) count++;
        }
        return count;
    },

    setEffectBasePath(path: string) {
        const raw = String(path || '').trim();
        if (!raw) return this.effectBasePath;
        const nextBasePath = raw.endsWith('/') ? raw : `${raw}/`;
        if (nextBasePath === this.effectBasePath) return this.effectBasePath;
        this.effectBasePath = nextBasePath;
        this._resetEffectWarmup();
        return this.effectBasePath;
    },

    _resolveRootRef() {
        return (typeof globalThis !== 'undefined') ? globalThis : null;
    },

    _resolvePlacementSoundSelectionModule(rootRef?: any) {
        const ctx = rootRef || this._resolveRootRef();
        if (ctx && ctx.PlacementSoundSelectionModule) {
            return ctx.PlacementSoundSelectionModule;
        }
        try {
            if (typeof globalThis !== 'undefined' && (globalThis as any).PlacementSoundSelectionModule) {
                return (globalThis as any).PlacementSoundSelectionModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('./ui/placement-sound-selection.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    },

    _getPlacementSoundFallbackDefinition() {
        const defaultPath = String(this.effectSoundFiles.stone_place || '').trim() || 'assets/audio/sound-effect-skin/default.mp3';
        return {
            id: 'default',
            label: '既定配置音',
            kind: 'placement_sound',
            assetPath: defaultPath,
            soundPath: defaultPath,
            previewImagePath: '',
            note: '既定の石置き音'
        };
    },

    getDefaultPlacementSoundDefinition(options: any = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const selectionModule = this._resolvePlacementSoundSelectionModule(opts.root || this._resolveRootRef());
        if (selectionModule && typeof selectionModule.getDefaultPlacementSoundDefinition === 'function') {
            return selectionModule.getDefaultPlacementSoundDefinition();
        }
        return this._getPlacementSoundFallbackDefinition();
    },

    listSelectablePlacementSounds(options: any = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || this._resolveRootRef();
        const selectionModule = this._resolvePlacementSoundSelectionModule(rootRef);
        if (selectionModule && typeof selectionModule.listSelectablePlacementSounds === 'function') {
            return selectionModule.listSelectablePlacementSounds({ root: rootRef });
        }
        return [this.getDefaultPlacementSoundDefinition({ root: rootRef })];
    },

    isPlacementSoundOwned(soundId: string, options: any = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || this._resolveRootRef();
        const selectionModule = this._resolvePlacementSoundSelectionModule(rootRef);
        if (selectionModule && typeof selectionModule.isPlacementSoundOwned === 'function') {
            return selectionModule.isPlacementSoundOwned(soundId, { root: rootRef });
        }
        return String(soundId || '').trim() === 'default';
    },

    getSelectedPlacementSoundId(options: any = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || this._resolveRootRef();
        const selectionModule = this._resolvePlacementSoundSelectionModule(rootRef);
        if (selectionModule && typeof selectionModule.getSelectedPlacementSoundId === 'function') {
            return selectionModule.getSelectedPlacementSoundId({ root: rootRef });
        }
        return 'default';
    },

    setSelectedPlacementSoundId(soundId: string, options: any = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || this._resolveRootRef();
        const selectionModule = this._resolvePlacementSoundSelectionModule(rootRef);
        const nextId = selectionModule && typeof selectionModule.setSelectedPlacementSoundId === 'function'
            ? selectionModule.setSelectedPlacementSoundId(soundId, { root: rootRef })
            : 'default';
        const selectedPath = this.resolveSelectedPlacementSoundFilePath({ root: rootRef, soundId: nextId });
        if (this._effectWarmupStarted && selectedPath) {
            try { this._getEffectAudioPool(selectedPath); } catch (e) { /* ignore */ }
        }
        return nextId;
    },

    getSelectedPlacementSoundDefinition(options: any = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || this._resolveRootRef();
        const selectionModule = this._resolvePlacementSoundSelectionModule(rootRef);
        if (selectionModule && typeof selectionModule.getSelectedPlacementSoundDefinition === 'function') {
            return selectionModule.getSelectedPlacementSoundDefinition(Object.assign({}, opts, { root: rootRef }));
        }
        return this.getDefaultPlacementSoundDefinition({ root: rootRef });
    },

    resolveSelectedPlacementSoundFilePath(options: any = {}) {
        const definition = this.getSelectedPlacementSoundDefinition(options);
        return definition ? String(definition.assetPath || '').trim() : String(this.effectSoundFiles.stone_place || '').trim();
    },

    getEffectFilePath(effectKey: string, options: any = {}) {
        const key = String(effectKey || '').trim();
        if (!key) return null;
        const opts = options && typeof options === 'object' ? options : {};
        const directFilePath = String(opts.filePath || '').trim();
        if (directFilePath) return directFilePath;
        if (key === 'stone_place' && !opts.fileName) {
            return this.resolveSelectedPlacementSoundFilePath(opts);
        }
        const fileNameRaw = opts.fileName || this.effectSoundFiles[key] || `${key}.mp3`;
        const fileName = String(fileNameRaw || '').trim();
        if (!fileName) return null;
        if (/^(?:[A-Za-z]:[\\/]|[./]|assets\/)/.test(fileName)) {
            return fileName.replace(/\\/g, '/');
        }
        const basePath = String(this.effectBasePath || 'assets/audio/sound-effect/');
        const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
        return `${normalizedBase}${fileName}`;
    },

    _toNonNegativeNumber(value: any, fallback: number) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(0, parsed);
    },

    _clamp01(value: number) {
        return Math.max(0, Math.min(1, Number(value) || 0));
    },

    resolveEffectVolumeScale(effectKey: string, options: any = {}) {
        const key = String(effectKey || '').trim();
        const opts = options && typeof options === 'object' ? options : {};
        const baseScale = this._toNonNegativeNumber(this.effectDefaultVolumeScale, 1);
        const keyScaleRaw = this.effectVolumeScales ? this.effectVolumeScales[key] : NaN;
        const keyScale = this._toNonNegativeNumber(keyScaleRaw, 1);
        const defaultScale = baseScale * keyScale;
        const overrideScale = this._toNonNegativeNumber(opts.volumeScale, NaN);
        return Number.isFinite(overrideScale) ? overrideScale : defaultScale;
    },

    resolveEffectVolume(effectKey: string, options: any = {}) {
        const volumeScale = this.resolveEffectVolumeScale(effectKey, options);
        return this._clamp01(this.volume * volumeScale);
    },

    playEffectByKey(effectKey: string, options: any = {}) {
        const key = String(effectKey || '').trim();
        const opts = options && typeof options === 'object' ? options : {};
        const filePath = this.getEffectFilePath(key, opts);
        if (!filePath || this.isMuted) return false;

        try { this.init(); } catch (e) { /* ignore */ }

        const effectVolume = this.resolveEffectVolume(key, opts);

        const audio = this._takeEffectAudio(filePath);
        if (!audio) return false;
        audio.volume = effectVolume * (this.isMuted ? 0 : 1);
        try { audio.currentTime = 0; } catch (e) { /* ignore */ }
        audio.onerror = () => {
            if (!this._missingEffectWarned[filePath]) {
                this._missingEffectWarned[filePath] = true;
                console.warn(`Effect sound not found: ${filePath}`);
            }
        };

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((e: any) => {
                if (!this._missingEffectWarned[filePath]) {
                    this._missingEffectWarned[filePath] = true;
                    console.warn(`Effect sound play failed (${filePath}): ${e && e.message ? e.message : e}`);
                }
            });
        }
        return true;
    },

    _resolveResultBgmTrack(outcomeKey: string) {
        const key = String(outcomeKey || '').trim();
        return (this.resultBgmTracks && this.resultBgmTracks[key]) || null;
    },

    _createResultBgmAudio(track: ResultBgmTrack) {
        if (typeof Audio !== 'function') return null;
        let audio: HTMLAudioElement;
        try {
            audio = new Audio(track.file);
        } catch (e) {
            return null;
        }
        audio.preload = 'auto';
        audio.loop = track.loop === true;
        audio.volume = this._getBgmOutputVolume();
        if (typeof audio.load === 'function') {
            try { audio.load(); } catch (e) { /* ignore */ }
        }
        return audio;
    },

    _canUseBufferedResultBgm(track: ResultBgmTrack | null) {
        if (!track || track.loop !== true) return false;
        if (typeof fetch !== 'function') return false;
        let ctx: AudioContext | null = null;
        try {
            ctx = this.ctx || this._ensureAudioContext(false);
        } catch (e) {
            return false;
        }
        return !!(
            ctx &&
            typeof ctx.createBufferSource === 'function' &&
            typeof ctx.createGain === 'function' &&
            typeof ctx.decodeAudioData === 'function'
        );
    },

    _resolveResultBgmLoopStart(track: ResultBgmTrack) {
        const loopStart = Number(track && track.loopStart);
        return Number.isFinite(loopStart) ? Math.max(0, loopStart) : 0;
    },

    _resolveResultBgmLoopEnd(track: ResultBgmTrack, duration: number, loopStart: number) {
        const loopEnd = Number(track && track.loopEnd);
        if (Number.isFinite(loopEnd) && loopEnd > loopStart && (!Number.isFinite(duration) || loopEnd <= duration + 0.01)) {
            return loopEnd;
        }
        return Number.isFinite(duration) ? Math.max(loopStart, duration) : loopStart;
    },

    _playBufferedResultBgm(track: ResultBgmTrack, outcomeKey: string) {
        const ctx = this.ctx || this._ensureAudioContext(true);
        if (!ctx) return false;
        try {
            if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                ctx.resume();
            }
        } catch (e) { /* ignore */ }

        this.pauseBgm();
        const loadToken = {};
        this._resultBgmLoadToken = loadToken;
        this._resultBgmOutcomeKey = String(outcomeKey || '').trim();
        this._resultBgmPausedNormalBgm = true;

        this._loadBufferedBgmBuffer(track)
            .then((buffer: AudioBuffer) => {
                if (this._resultBgmLoadToken !== loadToken) return;
                if (!buffer || this._resultBgmOutcomeKey !== outcomeKey) return;
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                source.loopStart = this._resolveResultBgmLoopStart(track);
                source.loopEnd = this._resolveResultBgmLoopEnd(track, Number(buffer.duration), source.loopStart);

                const gainNode = ctx.createGain();
                gainNode.connect(ctx.destination);
                source.connect(gainNode);

                this._resultBgmSource = source;
                this._resultBgmGainNode = gainNode;
                this._updateResultBgmVolume();

                source.onended = () => {
                    if (this._resultBgmSource !== source) return;
                    this._resultBgmSource = null;
                };
                source.start(0, 0);
            })
            .catch((e: any) => {
                if (this._resultBgmLoadToken !== loadToken) return;
                console.warn(`Buffered result BGM unavailable for ${track.file}: ${e && e.message ? e.message : e}`);
                this._resultBgmLoadToken = null;
                this._resultBgmOutcomeKey = null;
                const audio = this._createResultBgmAudio(track);
                if (!audio) {
                    if (this._resultBgmPausedNormalBgm) {
                        this._resultBgmPausedNormalBgm = false;
                        this.playBgm();
                    }
                    return;
                }
                this.pauseBgm();
                this._resultBgm = audio;
                this._resultBgmOutcomeKey = String(outcomeKey || '').trim();
                this._resultBgmPausedNormalBgm = true;
                audio.onerror = () => {
                    console.warn(`Result BGM play failed: ${track.file}`);
                };
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch((playError: any) => {
                        console.warn(`Result BGM play failed (${track.file}): ${playError && playError.message ? playError.message : playError}`);
                    });
                }
            });
        return true;
    },

    playResultBgm(outcomeKey: string) {
        const track = this._resolveResultBgmTrack(outcomeKey);
        if (!track) return false;
        this.stopResultBgm({ resumeBgm: false });

        if (this._canUseBufferedResultBgm(track)) {
            return this._playBufferedResultBgm(track, String(outcomeKey || '').trim());
        }

        const audio = this._createResultBgmAudio(track);
        if (!audio) return false;

        this.pauseBgm();
        this._resultBgm = audio;
        this._resultBgmOutcomeKey = String(outcomeKey || '').trim();
        this._resultBgmPausedNormalBgm = true;
        audio.onended = () => {
            if (this._resultBgm !== audio) return;
            this._resultBgm = null;
            this._resultBgmOutcomeKey = null;
            audio.onended = null;
            audio.onerror = null;
        };
        audio.onerror = () => {
            console.warn(`Result BGM play failed: ${track.file}`);
        };

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((e: any) => {
                console.warn(`Result BGM play failed (${track.file}): ${e && e.message ? e.message : e}`);
            });
        }
        return true;
    },

    stopResultBgm(options: any = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const audio = this._resultBgm;
        const source = this._resultBgmSource;
        const gainNode = this._resultBgmGainNode;
        const shouldResumeBgm = opts.resumeBgm === true && !!(audio || source || this._resultBgmPausedNormalBgm);

        this._resultBgm = null;
        this._resultBgmSource = null;
        this._resultBgmGainNode = null;
        this._resultBgmOutcomeKey = null;
        this._resultBgmPausedNormalBgm = false;
        this._resultBgmLoadToken = null;

        if (audio) {
            audio.onended = null;
            audio.onerror = null;
            try { audio.pause(); } catch (e) { /* ignore */ }
            try { audio.currentTime = 0; } catch (e) { /* ignore */ }
        }
        if (source) {
            source.onended = null;
            try { source.stop(); } catch (e) { /* ignore */ }
            if (typeof source.disconnect === 'function') {
                try { source.disconnect(); } catch (e) { /* ignore */ }
            }
        }
        if (gainNode && typeof gainNode.disconnect === 'function') {
            try { gainNode.disconnect(); } catch (e) { /* ignore */ }
        }

        if (shouldResumeBgm) {
            this.playBgm();
        }
        return !!audio || !!source || !!gainNode || shouldResumeBgm;
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.bgm) {
            this.bgm.volume = this._getBgmOutputVolume();
        }
        this._updateBufferedBgmVolume();
        this._updateResultBgmVolume();
        return this.isMuted;
    },

    setVolume(val: number | string) {
        this.volume = parseFloat(String(val));
    },

    setBgmVolume(val: number | string) {
        this.bgmVolume = parseFloat(String(val));
        if (this.bgm) {
            this.bgm.volume = this._getBgmOutputVolume();
        }
        this._updateBufferedBgmVolume();
        this._updateResultBgmVolume();
    },

    playBgm() {
        if (this.bgm) {
            this.allowBgmPlay = true;
            this._playBgmElement(this.bgm);
            (window as any).updateBgmButtons();
        }
    },

    pauseBgm() {
        this.allowBgmPlay = false;
        if (this.bgm) this.bgm.pause();
        (window as any).updateBgmButtons();
    },

    setBgmTrack(index: number | string) {
        this.loadBgm(parseInt(String(index), 10));
    }
};

export default SoundEngine;
