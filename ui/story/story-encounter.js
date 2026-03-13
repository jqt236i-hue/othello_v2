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

        function getCpuSmartness() {
            if (rootRef && rootRef.cpuSmartness && typeof rootRef.cpuSmartness === 'object') {
                return rootRef.cpuSmartness;
            }
            return null;
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
            applyEncounterPresentation(encounter);

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

            restoreCpuSmartness(encounter.previousCpuSmartness);
            activeEncounter = null;
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
                onWinContinue: typeof source.onWinContinue === 'function' ? source.onWinContinue : null,
                onAbort: typeof source.onAbort === 'function' ? source.onAbort : null,
                winDialogueLines: Array.isArray(source.winDialogueLines) ? source.winDialogueLines.slice() : [],
                loseDialogueLines: Array.isArray(source.loseDialogueLines) ? source.loseDialogueLines.slice() : [],
                drawDialogueLines: Array.isArray(source.drawDialogueLines) ? source.drawDialogueLines.slice() : []
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
