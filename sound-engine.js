// ===== Sound Engine (Web Audio API) =====
const SoundEngine = {
    ctx: null,
    isMuted: false,
    volume: 0.3,
    currentType: '2',
    bgm: null,
    bgmVolume: 0.1,
    currentTrackIndex: 0,
    allowBgmPlay: true, // Default to true requested by user

    // BGM Playlist
    playlist: [
        { name: '砕月', file: 'assets/audio/bgm/砕月.mp3' },
        { name: 'U.N.オーエンは彼女なのか？', file: 'assets/audio/bgm/U.N.オーエンは彼女なのか？.mp3' },
        { name: 'ナイト・オブ・ナイツ', file: 'assets/audio/bgm/ナイト・オブ・ナイツ.mp3' },
        { name: 'フラワリングナイト', file: 'assets/audio/bgm/フラワリングナイト.mp3' },
        { name: '亡き王女の為のセプテット', file: 'assets/audio/bgm/亡き王女の為のセプテット.mp3' }
    ],
    externalBuffers: {},

    init() {
        if (!this.ctx) {
            const AudioContext = (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext)) || null;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        // Resume logic for browsers that block autoplay
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        // Init BGM on first interaction
        if (!this.bgm) {
            this.loadBgm(0);
        } else if (this.allowBgmPlay && this.bgm.paused) {
            this.playBgm();
        }
    },

    loadBgm(index) {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
        this.currentTrackIndex = index;
        const track = this.playlist[index];
        this.bgm = new Audio(track.file);
        // 互換フォールバック: 新パスが失敗したら旧パスに切替
        this.bgm.onerror = () => {
            const legacy = track.file.replace('assets/audio/bgm/', 'assets/');
            if (this.bgm && this.bgm.src && this.bgm.src.endsWith(track.file)) {
                this.bgm.src = legacy;
                this.bgm.load();
                if (this.allowBgmPlay) this.playBgm();
            }
        };
        this.bgm.loop = true;
        this.bgm.volume = this.bgmVolume * (this.isMuted ? 0 : 1);

        // Auto-play if previously playing or allowed
        if (this.allowBgmPlay) {
            this.playBgm();
        }
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

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.bgm) {
            this.bgm.volume = this.bgmVolume * (this.isMuted ? 0 : 1);
        }
        return this.isMuted;
    },

    setVolume(val) {
        this.volume = parseFloat(val);
    },

    setBgmVolume(val) {
        this.bgmVolume = parseFloat(val);
        if (this.bgm && !this.isMuted) {
            this.bgm.volume = this.bgmVolume;
        }
    },

    playBgm() {
        if (this.bgm) {
            this.allowBgmPlay = true;
            this.bgm.play().catch(e => console.warn("BGM play failed:", e));
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
        this.loadBgm(parseInt(index));
    },

    playStoneClack() {
        if (this.isMuted || !this.ctx) return;

        // Ensure context is running
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const t = this.ctx.currentTime;
        const vol = this.volume;
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
