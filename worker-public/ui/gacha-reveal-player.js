(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const exports = factory();
        root.GachaRevealPlayerModule = exports;
        root.createGachaRevealPlayer = exports.createGachaRevealPlayer;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DEFAULT_TIMINGS = Object.freeze({
        introMs: 2000,
        heroMs: 280,
        gridMs: 420,
        finishMs: 120
    });
    const RARITY_REVEAL_EFFECTS = Object.freeze({
        EXR: 'singularity',
        UR: 'cataclysm',
        SSR: 'nova',
        SR: 'prism',
        R: 'slash',
        N: 'subtle'
    });

    function resolveDocument(rootRef) {
        if (rootRef && rootRef.document) return rootRef.document;
        if (typeof document !== 'undefined') return document;
        return null;
    }

    function resolveAnimationSharedModule() {
        if (typeof require === 'function') {
            try {
                return require('./animation-shared.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.AnimationShared) return globalThis.AnimationShared;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaHelpersModule() {
        if (typeof require === 'function') {
            try {
                return require('../shared/gacha-helpers.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaHelpersModule) return globalThis.GachaHelpersModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaRevealStageModule() {
        if (typeof require === 'function') {
            try {
                return require('./gacha/gacha-reveal-stage.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaRevealStageModule) return globalThis.GachaRevealStageModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaRevealAudioModule() {
        if (typeof require === 'function') {
            try {
                return require('./gacha/gacha-reveal-audio.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaRevealAudioModule) return globalThis.GachaRevealAudioModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function prefersReducedMotion(rootRef) {
        const win = rootRef || (typeof window !== 'undefined' ? window : null);
        if (!win || typeof win.matchMedia !== 'function') return false;
        try {
            return win.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
        } catch (e) {
            return false;
        }
    }

    function isInstantPlayback(rootRef) {
        const animationShared = resolveAnimationSharedModule();
        if (animationShared && typeof animationShared.isNoAnim === 'function' && animationShared.isNoAnim()) {
            return true;
        }
        return prefersReducedMotion(rootRef);
    }

    function nextFrame(rootRef) {
        return new Promise((resolve) => {
            const win = rootRef || (typeof window !== 'undefined' ? window : null);
            if (win && typeof win.requestAnimationFrame === 'function') {
                win.requestAnimationFrame(() => resolve());
                return;
            }
            setTimeout(resolve, 16);
        });
    }

    function waitForStep(state, durationMs) {
        const duration = Math.max(0, Math.floor(Number(durationMs) || 0));
        if (duration <= 0 || state.skipRequested === true || state.isActive !== true) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const startedAt = Date.now();
            (function tick() {
                if (state.skipRequested === true || state.isActive !== true) {
                    resolve();
                    return;
                }
                if ((Date.now() - startedAt) >= duration) {
                    resolve();
                    return;
                }
                setTimeout(tick, 16);
            }());
        });
    }

    function waitForDismiss(state) {
        if (state.isActive !== true) return Promise.resolve();

        return new Promise((resolve) => {
            (function tick() {
                if (state.dismissRequested === true || state.isActive !== true) {
                    resolve();
                    return;
                }
                setTimeout(tick, 16);
            }());
        });
    }

    function resolveRarityRank(rarity, helpersModule) {
        const normalized = helpersModule && typeof helpersModule.normalizeRarity === 'function'
            ? helpersModule.normalizeRarity(rarity)
            : String(rarity || '').trim().toUpperCase();
        const configured = Array.isArray(helpersModule && helpersModule.CONFIGURED_RARITIES)
            ? helpersModule.CONFIGURED_RARITIES
            : ['EXR', 'UR', 'SSR', 'SR', 'R', 'N'];
        const rank = configured.indexOf(normalized);
        return rank >= 0 ? rank : configured.length;
    }

    function resolveSpotlightPull(pulls, helpersModule) {
        const safePulls = Array.isArray(pulls) ? pulls.filter((pull) => pull && pull.item) : [];
        if (!safePulls.length) return null;

        return safePulls.reduce((best, pull) => {
            if (!best) return pull;
            return resolveRarityRank(pull.rarity, helpersModule) < resolveRarityRank(best.rarity, helpersModule)
                ? pull
                : best;
        }, null);
    }

    function resolveRevealEffectKey(rarity, helpersModule) {
        const normalized = helpersModule && typeof helpersModule.normalizeRarity === 'function'
            ? helpersModule.normalizeRarity(rarity)
            : String(rarity || '').trim().toUpperCase();
        return RARITY_REVEAL_EFFECTS[normalized] || RARITY_REVEAL_EFFECTS.N;
    }

    function createGachaRevealPlayer(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
        const docRef = opts.document || resolveDocument(rootRef);
        const overlay = opts.overlay || (docRef ? docRef.getElementById('gachaOverlay') : null);
        const stageModule = opts.stageModule || resolveGachaRevealStageModule();
        const audioModule = opts.audioModule || resolveGachaRevealAudioModule();
        const refs = stageModule && typeof stageModule.ensureGachaRevealStage === 'function'
            ? stageModule.ensureGachaRevealStage(docRef, overlay)
            : null;
        const helpersModule = resolveGachaHelpersModule();
        const timings = Object.assign({}, DEFAULT_TIMINGS, opts.timings || {});
        const audioSession = audioModule && typeof audioModule.createGachaRevealAudioSession === 'function'
            ? audioModule.createGachaRevealAudioSession({
                root: rootRef,
                createAudio: opts.createAudio
            })
            : null;
        const state = {
            skipRequested: false,
            dismissRequested: false,
            phase: 'idle',
            isActive: false
        };

        if (!refs || !refs.stage || !stageModule) return null;

        function requestSkip() {
            if (state.isActive !== true) return false;
            if (state.phase === 'waiting-dismiss') {
                state.dismissRequested = true;
                return true;
            }
            state.skipRequested = true;
            refs.stage.classList.add('is-skip-requested');
            return true;
        }

        if (!refs.skipBtn.__gachaRevealSkipBound) {
            refs.skipBtn.addEventListener('click', function (event) {
                if (event && typeof event.preventDefault === 'function') event.preventDefault();
                requestSkip();
            });
            refs.skipBtn.__gachaRevealSkipBound = true;
        }

        if (!refs.stage.__gachaRevealStageBound) {
            refs.stage.addEventListener('click', function (event) {
                if (!event || event.target === refs.skipBtn) return;
                if (state.phase !== 'waiting-dismiss') return;
                state.dismissRequested = true;
            });
            refs.stage.__gachaRevealStageBound = true;
        }

        async function play(transaction) {
            const safeTransaction = (transaction && typeof transaction === 'object') ? transaction : {};
            const pulls = Array.isArray(safeTransaction.pulls) ? safeTransaction.pulls.filter((pull) => pull && pull.item) : [];
            const newlyUnlockedIdSet = new Set(Array.isArray(safeTransaction.newlyUnlockedIds) ? safeTransaction.newlyUnlockedIds : []);
            const spotlightPull = resolveSpotlightPull(pulls, helpersModule);
            const highestRarity = spotlightPull && spotlightPull.rarity ? spotlightPull.rarity : 'N';
            const highestRarityId = String(highestRarity || 'N').trim().toLowerCase();
            const revealEffect = resolveRevealEffectKey(highestRarity, helpersModule);
            const isTenPull = pulls.length > 1;

            if (audioSession && typeof audioSession.destroy === 'function') {
                audioSession.destroy();
            }
            stageModule.hideStage(refs.stage);
            refs.grid.innerHTML = '';
            state.skipRequested = false;
            state.dismissRequested = false;
            state.phase = 'animating';
            state.isActive = true;

            refs.stage.setAttribute('data-rarity', highestRarityId);
            refs.stage.setAttribute('data-gacha-rarity', highestRarityId);
            refs.stage.setAttribute('data-reveal-effect', revealEffect);
            refs.stage.classList.remove('is-awaiting-dismiss');
            refs.skipBtn.textContent = 'SKIP';
            refs.headline.textContent = isTenPull ? '大量観測を開始します' : '観測が収束しています';
            refs.subtitle.textContent = isTenPull
                ? 'もっとも強い反応を先に解析します'
                : '強い反応を解析しています';
            stageModule.populateHero(refs, spotlightPull, newlyUnlockedIdSet);
            stageModule.populateGrid(refs, pulls, newlyUnlockedIdSet, spotlightPull);

            if (isInstantPlayback(rootRef)) {
                stageModule.hideStage(refs.stage);
                refs.skipBtn.textContent = 'SKIP';
                state.phase = 'idle';
                state.isActive = false;
                return {
                    finishedWith: 'instant',
                    highestRarity,
                    spotlightPull
                };
            }

            stageModule.resetStageVisualState(refs.stage, isTenPull);
            const revealStartedAt = Date.now();
            refs.stage.classList.add('is-active');
            refs.stage.classList.add('is-charging');
            if (audioSession && typeof audioSession.play === 'function') {
                audioSession.play();
            }
            await nextFrame(rootRef);
            await waitForStep(state, Math.max(0, timings.introMs - (Date.now() - revealStartedAt)));

            if (state.skipRequested !== true) {
                refs.headline.textContent = '観測が収束しました';
                refs.subtitle.textContent = isTenPull
                    ? 'もっとも強い反応を観測しました'
                    : '手の見た目を観測しました';
                refs.stage.classList.add('is-impact-visible');
                refs.stage.classList.add('is-hero-visible');
                await waitForStep(state, timings.heroMs);
            }

            if (state.skipRequested !== true && isTenPull) {
                refs.stage.classList.add('is-grid-visible');
                await waitForStep(state, timings.gridMs);
            }

            const finishedWith = state.skipRequested === true ? 'skipped' : 'animated';
            if (state.skipRequested !== true) {
                state.phase = 'waiting-dismiss';
                refs.stage.classList.add('is-awaiting-dismiss');
                refs.skipBtn.textContent = '一覧へ';
                refs.subtitle.textContent = 'タップで結果一覧へ';
                await waitForDismiss(state);
            }

            if (state.skipRequested === true) {
                refs.stage.classList.add('is-finishing');
                await waitForStep(state, timings.finishMs);
            }

            if (audioSession && typeof audioSession.destroy === 'function') {
                audioSession.destroy();
            }
            stageModule.hideStage(refs.stage);
            refs.skipBtn.textContent = 'SKIP';
            state.phase = 'idle';
            state.isActive = false;
            return {
                finishedWith,
                highestRarity,
                spotlightPull
            };
        }

        function destroy() {
            state.skipRequested = true;
            state.dismissRequested = true;
            state.phase = 'idle';
            state.isActive = false;
            if (audioSession && typeof audioSession.destroy === 'function') {
                audioSession.destroy();
            }
            stageModule.hideStage(refs.stage);
            try {
                if (refs.stage.parentElement) refs.stage.parentElement.removeChild(refs.stage);
            } catch (e) { /* ignore */ }
        }

        return {
            play,
            requestSkip,
            isActive: function () {
                return state.isActive === true;
            },
            destroy
        };
    }

    return {
        createGachaRevealPlayer,
        resolveRevealEffectKey,
        resolveSpotlightPull,
        isInstantPlayback
    };
}));
