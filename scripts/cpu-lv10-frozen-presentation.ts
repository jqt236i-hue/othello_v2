/** Serialized into the captured browser. Observe its existing presentation
 * owners without clearing locks, draining queues, or changing canonical state. */
export function installFrozenPresentationSettlement(limits: { presentationTimeoutMs: number }): void {
    const root = window as any;
    root.__waitForFrozenPresentation = (stage: string) => new Promise<void>((resolve, reject) => {
        const playback = root.require('ui/playback-state-manager');
        const controller = root.require('ui/bootstrap').getBoardVisualController();
        let done = false;
        let poll: ReturnType<typeof setTimeout> | undefined;
        const samples: any[] = [];
        const read = () => ({
            at: performance.now(), stage, turn: root.gameState?.turnNumber,
            autoInFlight: root.__frozenLv9Oracle?.autoInFlight === true,
            processing: root.isProcessing === true, animating: root.isCardAnimating === true,
            playbackActive: playback.getPlaybackActive(),
            claimed: playback.hasClaimedVisualPlayback(),
            selectionLocked: playback.hasSelectionSettlementLock(),
            pendingVisual: playback.hasPendingVisualPlayback(root.cardState),
            mode: controller.getMode(), writer: controller.getActiveWriterToken(),
            idleSettlementPending: controller.isIdleSettlementPending()
        });
        const finish = (error?: unknown) => {
            if (done) return;
            done = true; clearTimeout(timer); clearTimeout(poll);
            if (error) {
                let detail: any = null;
                try {
                    const backend = controller.getBackendDiagnostics?.();
                    detail = {
                        visibility: root.document?.visibilityState ?? null,
                        focused: root.document?.hasFocus?.() ?? null,
                        animationEnginePlaying: root.AnimationEngine?.isPlaying === true,
                        backend: backend ? {
                            state: backend.state, noAnimation: backend.noAnimation,
                            latestFrameToken: backend.latestFrameToken, settledFrameToken: backend.settledFrameToken,
                            lastErrorCode: backend.lastErrorCode, timeline: backend.timeline,
                            contextRecovery: backend.contextRecovery, textures: backend.textures
                        } : null
                    };
                } catch (diagnosticError) { detail = { observationError: String(diagnosticError) }; }
                root.__frozenPresentationFailure = { stage, samples, detail, error: String(error) };
                reject(error);
            } else resolve();
        };
        const capture = () => {
            const state = read(); samples.push(state);
            if (samples.length > 64) samples.shift();
            return state;
        };
        const timer = setTimeout(() => {
            try { capture(); } catch (error) { finish(error); return; }
            finish(new Error(`Frozen ${stage} presentation did not settle`));
        }, limits.presentationTimeoutMs);
        const check = () => {
            if (done) return;
            try {
                const s = capture();
                if (!s.autoInFlight && !s.processing && !s.animating && !s.playbackActive
                    && !s.claimed && !s.selectionLocked && !s.pendingVisual
                    && s.mode === 'idle' && !s.writer && !s.idleSettlementPending) {
                    // The controller owns final-frame settlement. A busy flag
                    // can be false while an existing writer is still alive.
                    Promise.resolve(controller.waitForIdle()).then(() => {
                        if (done) return;
                        const after = capture();
                        if (!after.autoInFlight && !after.processing && !after.animating && !after.playbackActive
                            && !after.claimed && !after.selectionLocked && !after.pendingVisual
                            && after.mode === 'idle' && !after.writer && !after.idleSettlementPending) finish();
                        else poll = setTimeout(check, 10);
                    }, finish).catch(finish);
                } else poll = setTimeout(check, 10);
            } catch (error) { finish(error); }
        };
        check();
    });
}
