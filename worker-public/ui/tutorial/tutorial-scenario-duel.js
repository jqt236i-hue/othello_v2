(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.TutorialScenarioDuelModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const OBSERVER_CPU_LEVEL = 6;

    function createTutorialScenarioDuel(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
        const stateStore = opts.stateStore;
        const runtime = opts.runtime;
        const observerName = opts.observerName || '盤理の観測者';
        const observerImageSrc = opts.observerImageSrc || 'assets/images/cpu/level6.png';

        function getCpuSmartness() {
            if (rootRef && rootRef.cpuSmartness && typeof rootRef.cpuSmartness === 'object') {
                return rootRef.cpuSmartness;
            }
            return null;
        }

        async function startObserverDuel() {
            if (!stateStore || !runtime) return false;
            runtime.restoreCpuTurns();
            const cpuSmartness = getCpuSmartness();
            const previousCpuSmartness = cpuSmartness
                ? { black: cpuSmartness.black, white: cpuSmartness.white }
                : null;

            stateStore.setObserverDuelState({
                active: true,
                postResultPhase: null,
                previousCpuSmartness
            });
            stateStore.mergeScenarioContext({
                observerName,
                observerImageSrc,
                observerDuelActive: true,
                observerDuelPostResultPhase: null
            });

            if (typeof rootRef.resetGame === 'function') {
                rootRef.resetGame();
                await runtime.waitForResetReady();
            }

            if (cpuSmartness) {
                cpuSmartness.white = OBSERVER_CPU_LEVEL;
            }
            runtime.updateCpuLabel();
            try {
                if (typeof rootRef.emitLogAdded === 'function') {
                    rootRef.emitLogAdded('観測者との特殊対局を開始', 'normal');
                }
            } catch (e) { /* ignore */ }
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

        function resolveObserverDuelResult(counts, viewerKey) {
            if (!stateStore || !stateStore.publicApi || !stateStore.publicApi.isObserverDuelActive()) return null;
            const localOutcomeKey = resolveLocalOutcomeKey(counts, viewerKey);

            if (localOutcomeKey === 'win') {
                stateStore.setObserverDuelState({ postResultPhase: 'fade_out' });
                runtime.updateCpuLabel();
                return {
                    title: '勝利',
                    statusClass: 'win',
                    localOutcomeKey,
                    metaText: '観測者対局: ランキング対象外',
                    speakerName: observerName,
                    dialogueLines: [
                        '……今の盤は見事だった。',
                        'だが観測は終わらぬ。次はこうは行かぬぞ。'
                    ]
                };
            }

            if (localOutcomeKey === 'lose') {
                stateStore.setObserverDuelState({ postResultPhase: 'game_over' });
                runtime.updateCpuLabel();
                return {
                    title: 'ゲームオーバー',
                    statusClass: 'lose',
                    localOutcomeKey,
                    metaText: '観測者対局: ランキング対象外',
                    speakerName: observerName,
                    dialogueLines: [
                        'その程度で私に勝てると思ったか。',
                        'この世界では、その甘さから先に砕ける。'
                    ]
                };
            }

            stateStore.setObserverDuelState({ postResultPhase: null });
            runtime.updateCpuLabel();
            return {
                title: '引き分け',
                statusClass: 'draw',
                localOutcomeKey,
                metaText: '観測者対局: ランキング対象外',
                speakerName: observerName,
                dialogueLines: [
                    'まだ決着は保留だな。',
                    'ならば次の観測で続きを見せてもらおう。'
                ]
            };
        }

        function finishObserverDuel() {
            if (!stateStore || !stateStore.publicApi || !stateStore.publicApi.isObserverDuelActive()) return false;
            const previous = stateStore.tutorialState && stateStore.tutorialState.observerDuel
                ? stateStore.tutorialState.observerDuel.previousCpuSmartness
                : null;
            const cpuSmartness = getCpuSmartness();
            if (cpuSmartness && previous && typeof previous === 'object') {
                if (Number.isFinite(Number(previous.black))) cpuSmartness.black = Number(previous.black);
                if (Number.isFinite(Number(previous.white))) cpuSmartness.white = Number(previous.white);
            }
            stateStore.setObserverDuelState({
                active: false,
                postResultPhase: null,
                previousCpuSmartness: null
            });
            stateStore.setScenarioContext(null);
            runtime.updateCpuLabel();
            return true;
        }

        return {
            startObserverDuel,
            resolveObserverDuelResult,
            finishObserverDuel
        };
    }

    return {
        createTutorialScenarioDuel
    };
}));
