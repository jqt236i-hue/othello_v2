(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.StoryEncounterModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function createStoryEncounter(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
        const stateStore = opts.stateStore || null;
        const runtime = opts.runtime || null;

        let activeEncounter = null;
        let previousBuildCardInitOptions = null;
        let hasEncounterDeckInitOverride = false;

        function cloneDeckCardIds(deckCardIds) {
            return Array.isArray(deckCardIds) ? deckCardIds.slice() : null;
        }

        function cloneDeckCardIdsByPlayer(deckCardIdsByPlayer) {
            if (!deckCardIdsByPlayer || typeof deckCardIdsByPlayer !== 'object') return null;
            const cloned = {};
            if (Array.isArray(deckCardIdsByPlayer.black)) {
                cloned.black = deckCardIdsByPlayer.black.slice();
            }
            if (Array.isArray(deckCardIdsByPlayer.white)) {
                cloned.white = deckCardIdsByPlayer.white.slice();
            }
            return Object.keys(cloned).length > 0 ? cloned : null;
        }

        function getTurnManagerUiImpl() {
            return (rootRef && rootRef.__uiImpl_turn_manager && typeof rootRef.__uiImpl_turn_manager === 'object')
                ? rootRef.__uiImpl_turn_manager
                : {};
        }

        function resolveEncounterDeckInitOptions(encounter) {
            if (!encounter || typeof encounter !== 'object') return null;
            const deckCardIdsByPlayer = cloneDeckCardIdsByPlayer(encounter.initialDeckCardIdsByPlayer);
            if (deckCardIdsByPlayer) {
                return { initialDeckCardIdsByPlayer: deckCardIdsByPlayer };
            }
            const deckCardIds = cloneDeckCardIds(encounter.initialDeckCardIds);
            return deckCardIds ? { initialDeckCardIds: deckCardIds } : null;
        }

        function installEncounterDeckInitOverride(encounter) {
            const encounterDeckInitOptions = resolveEncounterDeckInitOptions(encounter);
            if (!encounterDeckInitOptions) {
                clearEncounterDeckInitOverride();
                return;
            }

            const turnManagerUiImpl = getTurnManagerUiImpl();
            if (!hasEncounterDeckInitOverride) {
                previousBuildCardInitOptions = typeof turnManagerUiImpl.buildCardInitOptions === 'function'
                    ? turnManagerUiImpl.buildCardInitOptions
                    : null;
                hasEncounterDeckInitOverride = true;
            }

            rootRef.__uiImpl_turn_manager = Object.assign({}, turnManagerUiImpl, {
                buildCardInitOptions: function () {
                    const liveDeckInitOptions = resolveEncounterDeckInitOptions(activeEncounter);
                    if (liveDeckInitOptions) {
                        return liveDeckInitOptions;
                    }
                    return previousBuildCardInitOptions
                        ? previousBuildCardInitOptions.apply(this, arguments)
                        : {};
                }
            });
        }

        function clearEncounterDeckInitOverride() {
            if (!hasEncounterDeckInitOverride) return;
            const turnManagerUiImpl = getTurnManagerUiImpl();
            const restoredTurnManagerUiImpl = Object.assign({}, turnManagerUiImpl);
            if (previousBuildCardInitOptions) {
                restoredTurnManagerUiImpl.buildCardInitOptions = previousBuildCardInitOptions;
            } else {
                delete restoredTurnManagerUiImpl.buildCardInitOptions;
            }
            rootRef.__uiImpl_turn_manager = restoredTurnManagerUiImpl;
            previousBuildCardInitOptions = null;
            hasEncounterDeckInitOverride = false;
        }

        function getCpuSmartness() {
            if (rootRef && rootRef.cpuSmartness && typeof rootRef.cpuSmartness === 'object') {
                return rootRef.cpuSmartness;
            }
            return null;
        }

        function resolveSoundEngine() {
            return (rootRef && rootRef.SoundEngine)
                || (typeof SoundEngine !== 'undefined' ? SoundEngine : null)
                || (typeof globalThis !== 'undefined' ? globalThis.SoundEngine : null);
        }

        function snapshotBgmTrackIndex() {
            const soundEngine = resolveSoundEngine();
            if (!soundEngine) return null;
            const currentTrackIndex = Number(soundEngine.currentTrackIndex);
            return Number.isInteger(currentTrackIndex) ? currentTrackIndex : null;
        }

        function resolveEncounterBgmTrackIndex(encounter) {
            if (!encounter || typeof encounter !== 'object') return null;
            const explicitTrackIndexValue = encounter.bgmTrackIndex;
            if (
                explicitTrackIndexValue !== null
                && explicitTrackIndexValue !== undefined
                && String(explicitTrackIndexValue).trim() !== ''
            ) {
                const explicitTrackIndex = Number(explicitTrackIndexValue);
                if (Number.isInteger(explicitTrackIndex) && explicitTrackIndex >= 0) {
                    return explicitTrackIndex;
                }
            }

            const soundEngine = resolveSoundEngine();
            const playlist = Array.isArray(soundEngine && soundEngine.playlist) ? soundEngine.playlist : [];
            if (!playlist.length) return null;

            const bgmTrackFile = String(encounter.bgmTrackFile || '').trim();
            if (bgmTrackFile) {
                const fileIndex = playlist.findIndex((track) => track && String(track.file || '').trim() === bgmTrackFile);
                if (fileIndex >= 0) return fileIndex;
            }

            const bgmTrackName = String(encounter.bgmTrackName || '').trim();
            if (bgmTrackName) {
                const nameIndex = playlist.findIndex((track) => track && String(track.name || '').trim() === bgmTrackName);
                if (nameIndex >= 0) return nameIndex;
            }

            return null;
        }

        function applyEncounterBgm(encounter) {
            const soundEngine = resolveSoundEngine();
            if (!soundEngine || typeof soundEngine.setBgmTrack !== 'function') return;
            const nextTrackIndex = resolveEncounterBgmTrackIndex(encounter);
            if (!Number.isInteger(nextTrackIndex)) return;
            if (!Number.isInteger(encounter.previousBgmTrackIndex)) {
                encounter.previousBgmTrackIndex = snapshotBgmTrackIndex();
            }
            if (Number(soundEngine.currentTrackIndex) === nextTrackIndex) return;
            if (typeof soundEngine.init === 'function') soundEngine.init();
            soundEngine.setBgmTrack(nextTrackIndex);
        }

        function restoreEncounterBgm(encounter) {
            if (!encounter || !Number.isInteger(encounter.previousBgmTrackIndex)) return;
            const soundEngine = resolveSoundEngine();
            if (!soundEngine || typeof soundEngine.setBgmTrack !== 'function') return;
            const previousTrackIndex = encounter.previousBgmTrackIndex;
            encounter.previousBgmTrackIndex = null;
            if (Number(soundEngine.currentTrackIndex) === previousTrackIndex) return;
            if (typeof soundEngine.init === 'function') soundEngine.init();
            soundEngine.setBgmTrack(previousTrackIndex);
        }

        function snapshotCpuSmartness() {
            const cpuSmartness = getCpuSmartness();
            if (!cpuSmartness) return null;
            return {
                black: cpuSmartness.black,
                white: cpuSmartness.white
            };
        }

        function applyEncounterPresentation(encounter) {
            if (!stateStore || typeof stateStore.setEncounterState !== 'function') return;
            if (!encounter) {
                stateStore.setEncounterState({
                    active: false,
                    encounterId: null,
                    enemyName: null,
                    enemyImageSrc: null,
                    cpuLevel: null
                });
                return;
            }
            stateStore.setEncounterState({
                active: true,
                encounterId: encounter.encounterId || null,
                enemyName: encounter.enemyName || null,
                enemyImageSrc: encounter.enemyImageSrc || null,
                cpuLevel: encounter.cpuLevel || null
            });
        }

        function restoreCpuSmartness(previousCpuSmartness) {
            const cpuSmartness = getCpuSmartness();
            if (!cpuSmartness || !previousCpuSmartness || typeof previousCpuSmartness !== 'object') return;
            if (Number.isFinite(Number(previousCpuSmartness.black))) {
                cpuSmartness.black = Number(previousCpuSmartness.black);
            }
            if (Number.isFinite(Number(previousCpuSmartness.white))) {
                cpuSmartness.white = Number(previousCpuSmartness.white);
            }
        }

        async function launchEncounter(encounter, reuseSnapshot) {
            if (!encounter || !runtime) return false;
            if (typeof runtime.restoreCpuTurns === 'function') {
                runtime.restoreCpuTurns();
            }

            if (!reuseSnapshot || !encounter.previousCpuSmartness) {
                encounter.previousCpuSmartness = snapshotCpuSmartness();
            }
            activeEncounter = encounter;
            installEncounterDeckInitOverride(encounter);
            applyEncounterPresentation(encounter);
            applyEncounterBgm(encounter);

            if (typeof rootRef.resetGame === 'function') {
                rootRef.resetGame();
                if (typeof runtime.waitForResetReady === 'function') {
                    await runtime.waitForResetReady();
                }
            }

            const cpuSmartness = getCpuSmartness();
            if (cpuSmartness && Number.isFinite(Number(encounter.cpuLevel))) {
                cpuSmartness.white = Number(encounter.cpuLevel);
            }
            if (typeof runtime.updateCpuLabel === 'function') {
                runtime.updateCpuLabel();
            } else if (typeof rootRef.updateCpuCharacter === 'function') {
                rootRef.updateCpuCharacter();
            }

            try {
                if (typeof rootRef.emitLogAdded === 'function') {
                    rootRef.emitLogAdded(`${encounter.enemyName || '敵'} とのストーリー対局を開始`, 'normal');
                }
            } catch (e) { /* ignore */ }
            return true;
        }

        async function finishEncounter(options) {
            const opts = options && typeof options === 'object' ? options : {};
            const encounter = activeEncounter;
            if (!encounter) return false;

            restoreEncounterBgm(encounter);
            restoreCpuSmartness(encounter.previousCpuSmartness);
            activeEncounter = null;
            clearEncounterDeckInitOverride();
            applyEncounterPresentation(null);

            if (typeof runtime.updateCpuLabel === 'function') {
                runtime.updateCpuLabel();
            } else if (typeof rootRef.updateCpuCharacter === 'function') {
                rootRef.updateCpuCharacter();
            }

            if (opts.resetGame === true && typeof rootRef.resetGame === 'function') {
                rootRef.resetGame();
                if (typeof runtime.waitForResetReady === 'function') {
                    await runtime.waitForResetReady();
                }
            }
            return true;
        }

        function resolveLocalOutcomeKey(counts, viewerKey) {
            const black = Number.isFinite(Number(counts && counts.black)) ? Number(counts.black) : 0;
            const white = Number.isFinite(Number(counts && counts.white)) ? Number(counts.white) : 0;
            const localViewer = viewerKey === 'white' ? 'white' : 'black';
            if (black === white) return 'draw';
            const localCount = localViewer === 'black' ? black : white;
            const opponentCount = localViewer === 'black' ? white : black;
            return localCount > opponentCount ? 'win' : 'lose';
        }

        async function continueAfterWin(encounter) {
            await finishEncounter({ resetGame: true });
            if (encounter && typeof encounter.onWinContinue === 'function') {
                await encounter.onWinContinue();
            }
        }

        async function endAfterResult(encounter) {
            await finishEncounter({ resetGame: false });
            if (encounter && typeof encounter.onAbort === 'function') {
                await encounter.onAbort();
            }
        }

        function createResultOverride(encounter, localOutcomeKey) {
            const title = localOutcomeKey === 'win'
                ? '勝利'
                : (localOutcomeKey === 'lose' ? 'ゲームオーバー' : '引き分け');
            const statusClass = localOutcomeKey === 'win'
                ? 'win'
                : (localOutcomeKey === 'lose' ? 'lose' : 'draw');
            const dialogueLines = localOutcomeKey === 'win'
                ? (encounter.winDialogueLines || [])
                : (localOutcomeKey === 'lose'
                    ? (encounter.loseDialogueLines || [])
                    : (encounter.drawDialogueLines || []));

            if (localOutcomeKey === 'win') {
                return {
                    layout: 'story',
                    title,
                    statusClass,
                    localOutcomeKey,
                    metaText: 'ストーリー対局: ランキング対象外',
                    speakerName: encounter.enemyName,
                    enemyImageSrc: encounter.enemyImageSrc || '',
                    dialogueLines,
                    primaryLabel: '続ける',
                    secondaryLabel: '終了',
                    onPrimary: () => continueAfterWin(encounter),
                    onSecondary: () => endAfterResult(encounter)
                };
            }

            return {
                layout: 'story',
                title,
                statusClass,
                localOutcomeKey,
                metaText: 'ストーリー対局: ランキング対象外',
                speakerName: encounter.enemyName,
                enemyImageSrc: encounter.enemyImageSrc || '',
                dialogueLines,
                primaryLabel: '再戦',
                secondaryLabel: '終了',
                onPrimary: () => launchEncounter(encounter, true),
                onSecondary: () => endAfterResult(encounter)
            };
        }

        async function startEncounter(config) {
            const source = config && typeof config === 'object' ? config : {};
            const encounter = {
                encounterId: source.encounterId || null,
                enemyName: source.enemyName || '敵',
                enemyImageSrc: source.enemyImageSrc || '',
                cpuLevel: Number.isFinite(Number(source.cpuLevel)) ? Number(source.cpuLevel) : 1,
                previousCpuSmartness: null,
                previousBgmTrackIndex: null,
                bgmTrackIndex: Number.isInteger(Number(source.bgmTrackIndex)) ? Number(source.bgmTrackIndex) : null,
                bgmTrackFile: source.bgmTrackFile || null,
                bgmTrackName: source.bgmTrackName || null,
                onWinContinue: typeof source.onWinContinue === 'function' ? source.onWinContinue : null,
                onAbort: typeof source.onAbort === 'function' ? source.onAbort : null,
                winDialogueLines: Array.isArray(source.winDialogueLines) ? source.winDialogueLines.slice() : [],
                loseDialogueLines: Array.isArray(source.loseDialogueLines) ? source.loseDialogueLines.slice() : [],
                drawDialogueLines: Array.isArray(source.drawDialogueLines) ? source.drawDialogueLines.slice() : [],
                initialDeckCardIds: cloneDeckCardIds(source.initialDeckCardIds),
                initialDeckCardIdsByPlayer: cloneDeckCardIdsByPlayer(source.initialDeckCardIdsByPlayer)
            };
            return launchEncounter(encounter, false);
        }

        function resolveStoryEncounterPresentation() {
            if (!activeEncounter) return null;
            return {
                imageSrc: activeEncounter.enemyImageSrc || '',
                label: activeEncounter.enemyName || '敵'
            };
        }

        function resolveStoryEncounterResult(counts, viewerKey) {
            if (!activeEncounter) return null;
            const localOutcomeKey = resolveLocalOutcomeKey(counts, viewerKey);
            return createResultOverride(activeEncounter, localOutcomeKey);
        }

        async function abortEncounter() {
            if (!activeEncounter) return false;
            return abortAfterResult(activeEncounter);
        }

        return {
            startEncounter,
            abortEncounter,
            resolveStoryEncounterPresentation,
            resolveStoryEncounterResult,
            isActive: function () { return !!activeEncounter; }
        };
    }

    return {
        createStoryEncounter
    };
}));
