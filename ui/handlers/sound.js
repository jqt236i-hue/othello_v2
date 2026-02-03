/**
 * @file sound.js
 * @description Sound effect and BGM handlers
 */

/**
 * SE コントロールの設定
 * Setup sound effect controls
 */
function setupSoundControls(muteBtn, seTypeSelect, seVolSlider) {
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            const muted = SoundEngine.toggleMute();
            muteBtn.textContent = muted ? '🔇 OFF' : '🔊 ON';
            muteBtn.style.opacity = muted ? '0.7' : '1';
        });
    }

    const soundOptions = [
        { v: '1', t: 'Type 1 (標準)' },
        { v: '2', t: 'Type 2 (硬め)' },
        { v: '3', t: 'Type 3 (重め)' },
        { v: '4', t: 'Type 4 (響き)' },
        { v: '5', t: 'Type 5 (ソフト)' }
    ];

    if (seTypeSelect) {
        soundOptions.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.v;
            el.textContent = opt.t;
            seTypeSelect.appendChild(el);
        });
        seTypeSelect.addEventListener('change', (e) => {
            SoundEngine.setSoundType(e.target.value);
            SoundEngine.init();
            SoundEngine.playStoneClack();
        });
    }

    if (seVolSlider) {
        seVolSlider.value = SoundEngine.volume;
        seVolSlider.addEventListener('input', (e) => {
            SoundEngine.setVolume(e.target.value);
            SoundEngine.init();
        });
    }
}

/**
 * BGM コントロールの設定
 * Setup BGM controls
 */
function setupBgmControls(bgmPlayBtn, bgmPauseBtn, bgmTrackSelect, bgmVolSlider) {
    if (bgmTrackSelect) {
        SoundEngine.playlist.forEach((track, idx) => {
            const el = document.createElement('option');
            el.value = idx;
            el.textContent = track.name;
            bgmTrackSelect.appendChild(el);
        });

        bgmTrackSelect.addEventListener('change', (e) => {
            SoundEngine.setBgmTrack(e.target.value);
        });
    }

    if (bgmPlayBtn) {
        bgmPlayBtn.addEventListener('click', () => {
            SoundEngine.init();
            SoundEngine.playBgm();
        });
    }

    if (bgmPauseBtn) {
        bgmPauseBtn.addEventListener('click', () => {
            SoundEngine.pauseBgm();
        });
    }

    if (bgmVolSlider) {
        bgmVolSlider.value = SoundEngine.bgmVolume;
        bgmVolSlider.addEventListener('input', (e) => {
            SoundEngine.setBgmVolume(e.target.value);
        });
    }
}

if (typeof window !== 'undefined') {
    window.setupSoundControls = setupSoundControls;
    window.setupBgmControls = setupBgmControls;
}
