// ===== Sound Engine (Web Audio API) =====
const SoundEngine = {
    ctx: null,
    isMuted: false,
    volume: 0.7,
    currentType: '2',
    stoneClackVolumeScale: 0.8,
    bgm: null,
    bgmVolume: 0.07,
    currentTrackIndex: 1,
    allowBgmPlay: true, // Default to true requested by user
    _bgmBufferedState: null,
    _bgmBufferCache: {},

    // BGM Playlist
    playlist: [
        { name: 'c-othello', file: 'assets/audio/bgm/c-othello.mp3' },
        { name: 'c-othello-2', file: 'assets/audio/bgm/c-othello-2.mp3' },
        { name: '盤喰いの小鬼戦', file: 'assets/audio/bgm/盤喰いの小鬼戦.mp3', loopStart: 1.5 },
        { name: '幻想即興曲', file: 'assets/audio/bgm/幻想即興曲.mp3' },
        { name: 'ノクターン', file: 'assets/audio/bgm/ノクターン.mp3' }
    ],
    externalBuffers: {},
    effectBasePath: 'assets/audio/sound-effect/',
    effectSoundFiles: {
        card_use_button: 'カードを使用ボタンを押すタイミング.mp3',
        hand_card_select: '自分の手札のカードを選択＿押したタイミング.mp3',
        clone_spawn: '複製の意志で石を複製するタイミング.mp3',
        trap_select: '罠の意志で石を選択したタイミング.mp3',
        guard_select: '守る意志で自分の石を選択するタイミング.mp3',
        freeze_select: '凍結の意志でマスを凍結させるタイミング.mp3',
        trap_triggered: '相手の罠の意志の罠にかかってしまったタイミング.mp3',
        trap_misfire: '罠の意志の石が反転されなくて不発で消滅したタイミング.mp3',
        board_expansion_reveal: '盤面拡張系で実際に盤面が拡張されるタイミング.mp3',
        strong_wind_move: '強風の意志で石を移動させるタイミング.mp3',
        super_buoyancy_move: '超浮力で石を浮かせるタイミング.mp3',
        super_gravity_move: '超重力で石を落下させるタイミング.mp3',
        teleport_select: 'テレポートを使って石を選択するタイミング.mp3',
        tempt_select: '誘惑の意志で相手特殊石を誘惑したタイミング.mp3',
        treasure_gain: '宝箱で布石取得したタイミング.mp3',
        loss_will_reset: '意志の喪失.mp3',
        extend_life: '延命の意志で特殊石の持続ターンを増やすタイミング.mp3',
        corrosion_tick: '腐食の意志で特殊石の持続ターンを減らすタイミング.mp3',
        hyperactive_move: '多動系カードの石がマス移動するタイミング.mp3',
        robot_vacuum_suck: 'ロボット掃除機が敵石を吸い込むタイミング.mp3',
        breeding_spawn: '繁殖の意志の石生成で石が生成されたタイミング.mp3',
        card_effect_flip: 'カード効果で石が反転するタイミング.mp3',
        bomb_explode: '爆弾系の石が起爆するタイミング.mp3',
        stone_destroy: '破壊ロジック＿石が破壊されるとき.mp3',
        special_expired: '持続ターン切れで石が自己破壊で消滅するタイミング.mp3',
        sell_sacrifice_gain: '売却の意志、生贄の意志、出稼ぎの意志でカード効果で布石獲得するタイミング.mp3',
        work_income_16: '出稼ぎの意志が布石16獲得するタイミング.mp3',
        work_removed: '出稼ぎの意志が反転または破壊されて消えるタイミング.mp3'
    },
    effectDefaultVolumeScale: 0.35,
    effectVolumeScales: {
        hand_card_select: 0.5,
        stone_destroy: 0.7
    },
    _missingEffectWarned: {},

    init() {
        this._ensureAudioContext(true);

        // Init BGM on first interaction
        if (!this.bgm) {
            this.loadBgm(this.currentTrackIndex);
        } else if (this.allowBgmPlay && this.bgm.paused) {
            this.playBgm();
        }
    },

    _ensureAudioContext(resumeIfSuspended = false) {
        if (!this.ctx) {
            const AudioContext = (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext)) || null;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (resumeIfSuspended && this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    },

    _resolveBgmTrack(index) {
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

    _resolveBgmLoopStart(track) {
        const loopStart = Number(track && track.loopStart);
        return Number.isFinite(loopStart) ? Math.max(0, loopStart) : 0;
    },

    _resolveBgmLoopEnd(track, duration, loopStart) {
        const loopEnd = Number(track && track.loopEnd);
        if (Number.isFinite(loopEnd) && loopEnd > loopStart && loopEnd <= duration) {
            return loopEnd;
        }
        return Number.isFinite(duration) ? Math.max(loopStart, duration) : loopStart;
    },

    _canUseBufferedBgmLoop(track) {
        if (this._resolveBgmLoopStart(track) <= 0) return false;
        if (typeof fetch !== 'function') return false;
        const ctx = this.ctx || this._ensureAudioContext(false);
        return !!(
            ctx &&
            typeof ctx.createBufferSource === 'function' &&
            typeof ctx.createGain === 'function' &&
            typeof ctx.decodeAudioData === 'function'
        );
    },

    _isBufferedBgmController(audio) {
        return !!(audio && audio.__bufferedLoop === true);
    },

    _getBgmOutputVolume() {
        return this._clamp01(this._toNonNegativeNumber(this.bgmVolume, 0) * (this.isMuted ? 0 : 1));
    },

    _updateBufferedBgmVolume(state = this._bgmBufferedState) {
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

    _normalizeBufferedBgmOffset(offset, state) {
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

    _getBufferedBgmOffsetNow(state = this._bgmBufferedState) {
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

    async _loadBufferedBgmBuffer(track) {
        const file = String(track && track.file ? track.file : '').trim();
        if (!file) throw new Error('Missing BGM file path');
        if (!this.ctx || typeof this.ctx.decodeAudioData !== 'function') {
            throw new Error('AudioContext decodeAudioData unavailable');
        }
        const cached = this._bgmBufferCache[file];
        if (cached) {
            return (typeof cached.then === 'function') ? await cached : cached;
        }

        const tryLoad = async (url) => {
            const response = await fetch(url);
            if (!response || response.ok !== true) {
                throw new Error(`BGM fetch failed: ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const decodeInput = (arrayBuffer && typeof arrayBuffer.slice === 'function')
                ? arrayBuffer.slice(0)
                : arrayBuffer;
            return await this.ctx.decodeAudioData(decodeInput);
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

    async _playBufferedBgmState(state = this._bgmBufferedState) {
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
                    console.warn(`Buffered BGM loop unavailable for ${state.track && state.track.file ? state.track.file : 'unknown'}: ${e && e.message ? e.message : e}`);
                    this._teardownBufferedBgmState(true);
                    this._loadHtmlBgmTrack(state.track);
                }
                return false;
            }
            state.loadingPromise = null;
        }

        if (!state.buffer || !(state.loopEnd > state.loopStart) || state.source) {
            updateBgmButtons();
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
        updateBgmButtons();
        return true;
    },

    _pauseBufferedBgmState(state = this._bgmBufferedState) {
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

    _createBufferedBgmController(state) {
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

    _playBgmElement(audio) {
        if (!audio || typeof audio.play !== 'function') return;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(e => console.warn("BGM play failed:", e));
        }
    },

    _restartBgmFromLoopStart(audio, loopStart) {
        if (!audio || audio !== this.bgm) return;
        if (!this.allowBgmPlay) return;
        try {
            audio.currentTime = loopStart;
        } catch (e) { /* ignore */ }
        this._playBgmElement(audio);
    },

    _configureBgmLoop(audio, track) {
        if (!audio) return;
        const loopStart = this._resolveBgmLoopStart(track);
        audio.ontimeupdate = null;
        audio.onended = null;
        if (loopStart <= 0) {
            audio.loop = true;
            return;
        }

        audio.loop = false;
        audio.ontimeupdate = () => {
            if (audio !== this.bgm) return;
            const duration = Number(audio.duration);
            if (!Number.isFinite(duration) || duration <= loopStart) return;
            if (Number(audio.currentTime) >= duration - 0.15) {
                try {
                    audio.currentTime = loopStart;
                } catch (e) { /* ignore */ }
            }
        };
        audio.onended = () => {
            this._restartBgmFromLoopStart(audio, loopStart);
        };
    },

    _loadHtmlBgmTrack(track) {
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
            updateBgmButtons();
        }
    },

    loadBgm(index) {
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
            updateBgmButtons();
            return;
        }
        if (this._canUseBufferedBgmLoop(track)) {
            const state = {
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
                updateBgmButtons();
            }
            return;
        }
        this._loadHtmlBgmTrack(track);
    },

    async loadExternalSound(name, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Sound file not found');
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.externalBuffers[name] = audioBuffer;
            console.log(`Loaded external sound: ${name}`);
        } catch (e) {
            console.warn(`Could not load ${url}: ${e.message}`);
        }
    },

    registerEffectSound(key, fileName) {
        const k = String(key || '').trim();
        const f = String(fileName || '').trim();
        if (!k || !f) return false;
        this.effectSoundFiles[k] = f;
        return true;
    },

    registerEffectSounds(definitions) {
        if (!definitions || typeof definitions !== 'object') return 0;
        let count = 0;
        for (const key of Object.keys(definitions)) {
            if (this.registerEffectSound(key, definitions[key])) count++;
        }
        return count;
    },

    setEffectBasePath(path) {
        const raw = String(path || '').trim();
        if (!raw) return this.effectBasePath;
        this.effectBasePath = raw.endsWith('/') ? raw : `${raw}/`;
        return this.effectBasePath;
    },

    getEffectFilePath(effectKey, options = {}) {
        const key = String(effectKey || '').trim();
        if (!key) return null;
        const opts = options && typeof options === 'object' ? options : {};
        const directFilePath = String(opts.filePath || '').trim();
        if (directFilePath) return directFilePath;
        const fileNameRaw = opts.fileName || this.effectSoundFiles[key] || `${key}.mp3`;
        const fileName = String(fileNameRaw || '').trim();
        if (!fileName) return null;
        const basePath = String(this.effectBasePath || 'assets/audio/sound-effect/');
        const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
        return `${normalizedBase}${fileName}`;
    },

    _toNonNegativeNumber(value, fallback) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(0, parsed);
    },

    _clamp01(value) {
        return Math.max(0, Math.min(1, Number(value) || 0));
    },

    resolveStoneClackVolume() {
        const masterVolume = this._toNonNegativeNumber(this.volume, 0);
        const clackScale = this._toNonNegativeNumber(this.stoneClackVolumeScale, 1);
        return this._clamp01(masterVolume * clackScale);
    },

    resolveEffectVolumeScale(effectKey, options = {}) {
        const key = String(effectKey || '').trim();
        const opts = options && typeof options === 'object' ? options : {};
        const baseScale = this._toNonNegativeNumber(this.effectDefaultVolumeScale, 1);
        const keyScaleRaw = this.effectVolumeScales ? this.effectVolumeScales[key] : NaN;
        const keyScale = this._toNonNegativeNumber(keyScaleRaw, 1);
        const defaultScale = baseScale * keyScale;
        const overrideScale = this._toNonNegativeNumber(opts.volumeScale, NaN);
        return Number.isFinite(overrideScale) ? overrideScale : defaultScale;
    },

    resolveEffectVolume(effectKey, options = {}) {
        const volumeScale = this.resolveEffectVolumeScale(effectKey, options);
        return this._clamp01(this.volume * volumeScale);
    },

    playEffectByKey(effectKey, options = {}) {
        const key = String(effectKey || '').trim();
        const opts = options && typeof options === 'object' ? options : {};
        const filePath = this.getEffectFilePath(key, opts);
        if (!filePath || this.isMuted) return false;

        try { this.init(); } catch (e) { /* ignore */ }

        const effectVolume = this.resolveEffectVolume(key, opts);

        const audio = new Audio(filePath);
        audio.preload = 'auto';
        audio.volume = effectVolume * (this.isMuted ? 0 : 1);
        audio.onerror = () => {
            if (!this._missingEffectWarned[filePath]) {
                this._missingEffectWarned[filePath] = true;
                console.warn(`Effect sound not found: ${filePath}`);
            }
            if (opts.fallbackStoneClack === true) {
                try { this.playStoneClack(); } catch (e) { /* ignore */ }
            }
        };

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((e) => {
                if (!this._missingEffectWarned[filePath]) {
                    this._missingEffectWarned[filePath] = true;
                    console.warn(`Effect sound play failed (${filePath}): ${e && e.message ? e.message : e}`);
                }
            });
        }
        return true;
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.bgm) {
            this.bgm.volume = this._getBgmOutputVolume();
        }
        this._updateBufferedBgmVolume();
        return this.isMuted;
    },

    setVolume(val) {
        this.volume = parseFloat(val);
    },

    setBgmVolume(val) {
        this.bgmVolume = parseFloat(val);
        if (this.bgm) {
            this.bgm.volume = this._getBgmOutputVolume();
        }
        this._updateBufferedBgmVolume();
    },

    playBgm() {
        if (this.bgm) {
            this.allowBgmPlay = true;
            this._playBgmElement(this.bgm);
            updateBgmButtons();
        }
    },

    pauseBgm() {
        this.allowBgmPlay = false;
        if (this.bgm) this.bgm.pause();
        updateBgmButtons();
    },

    setSoundType(type) {
        this.currentType = type;
    },

    setBgmTrack(index) {
        this.loadBgm(parseInt(index, 10));
    },

    playStoneClack() {
        if (this.isMuted || !this.ctx) return;

        // Ensure context is running
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const t = this.ctx.currentTime;
        const vol = this.resolveStoneClackVolume();
        const type = this.currentType;

        // Special Case: Real Sound (External)
        if (type === '6' && this.externalBuffers['real']) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.externalBuffers['real'];
            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(vol * 1.5, t); // Boost real sound a bit
            source.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            source.start(t);
            return;
        }

        // Tone Parameters based on type
        let clickFreq = 1200, clickDecay = 0.08, clickGain = 0.3;
        let thudFreq = 300, thudDecay = 0.15, thudGain = 0.5;
        let noiseFreq = 800, noiseDecay = 0.05, noiseGain = 0.1;

        switch (type) {
            case '2': // Sharp / Plastic
                clickFreq = 1800; clickDecay = 0.04; clickGain = 0.4;
                thudFreq = 500; thudDecay = 0.05; thudGain = 0.2;
                noiseFreq = 1500; noiseDecay = 0.03; noiseGain = 0.15;
                break;
            case '3': // Heavy / Thud
                clickFreq = 800; clickDecay = 0.1; clickGain = 0.2;
                thudFreq = 150; thudDecay = 0.25; thudGain = 0.7;
                noiseFreq = 400; noiseDecay = 0.1; noiseGain = 0.05;
                break;
            case '4': // Resonant / Wood
                clickFreq = 1400; clickDecay = 0.12; clickGain = 0.3;
                thudFreq = 400; thudDecay = 0.3; thudGain = 0.4;
                noiseFreq = 1000; noiseDecay = 0.15; noiseGain = 0.08;
                break;
            case '5': // Soft / Muted
                clickFreq = 600; clickDecay = 0.05; clickGain = 0.15;
                thudFreq = 200; thudDecay = 0.1; thudGain = 0.3;
                noiseFreq = 300; noiseDecay = 0.08; noiseGain = 0.2;
                break;
            default: // Standard (Type 1)
                // Uses defaults
                break;
        }

        // Oscillator 1: High frequency impact
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(clickFreq, t);
        osc1.frequency.exponentialRampToValueAtTime(100, t + clickDecay);
        gain1.gain.setValueAtTime(0, t);
        gain1.gain.linearRampToValueAtTime(clickGain * vol, t + 0.005);
        gain1.gain.exponentialRampToValueAtTime(0.01 * vol, t + clickDecay + 0.02);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(t);
        osc1.stop(t + clickDecay + 0.02);

        // Oscillator 2: Low frequency body
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(thudFreq, t);
        osc2.frequency.exponentialRampToValueAtTime(50, t + thudDecay);
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(thudGain * vol, t + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.01 * vol, t + thudDecay + 0.05);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(t);
        osc2.stop(t + thudDecay + 0.05);

        // Noise Burst: Texture
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = noiseFreq;
        noiseGainNode.gain.setValueAtTime(noiseGain * vol, t);
        noiseGainNode.gain.exponentialRampToValueAtTime(0.01 * vol, t + noiseDecay);
        noise.connect(filter);
        filter.connect(noiseGainNode);
        noiseGainNode.connect(this.ctx.destination);
        noise.start(t);
    }
};
