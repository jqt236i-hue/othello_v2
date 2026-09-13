import { stableStringify } from '../shared/state-hash';
import { clearPresentationQueues } from '../shared/presentation-queue';

/** Recheck saved coverage and state/RNG parity without trusting browser flags. */
export function verifyFrozenTransitionCoverage(audit: any, frozenPlayer: 'black' | 'white'): void {
    const controlledByFrozen = (record: any) =>
        (record.before.cardState.fateWillControllerByTurnOwner?.[record.player] || record.player) === frozenPlayer;
    const comparable = (value: any) => {
        const state = JSON.parse(JSON.stringify(value));
        clearPresentationQueues(state.cardState);
        state.cardState.chargeDeltaEvents = [];
        for (const field of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta']) delete state.cardState[field];
        return stableStringify(state);
    };
    const seen = new Set<number>(), usedAnswers = new Set<number>();
    for (const item of audit.oracleActionVerifications || []) {
        const record = audit.records[item.recordIndex], answer = audit.frozenOpponent.answers[item.oracleAnswerIndex];
        const attempt = answer?.attempts?.at(-1);
        if (!Number.isInteger(item.recordIndex) || !Number.isInteger(item.oracleAnswerIndex)
            || seen.has(item.recordIndex) || usedAnswers.has(item.oracleAnswerIndex)
            || !record?.ok || !controlledByFrozen(record) || !attempt?.ok || attempt.player !== record.player
            || !['advised', 'automatic-pass'].includes(item.delivery)
            || comparable(record.before) !== comparable(attempt.before)
            || comparable(record.after) !== comparable(answer.after)) throw new Error('Invalid frozen transition coverage');
        if (item.delivery === 'automatic-pass' && (record.action.type !== 'pass' || record.action.autoNoActionPass !== true
            || answer.attempts.length !== 1 || attempt.preparations?.length
            || stableStringify(record.action) !== stableStringify(answer.action))) throw new Error('Invalid frozen automatic pass');
        seen.add(item.recordIndex);
        usedAnswers.add(item.oracleAnswerIndex);
    }
    if (audit.records.some((record: any, index: number) => record.ok && controlledByFrozen(record) && !seen.has(index))) {
        throw new Error('Missing frozen transition coverage');
    }
}

/** Installed inside the live comparison browser. All accepted frozen-seat
 * actions, including UI-triggered forced passes, must match the frozen CPU. */
export function installFrozenLv9Verification({ frozenPlayer }: { frozenPlayer: 'black' | 'white' }) {
    const root = window as any, req = root.require;
    if (typeof root.__queryFrozenLv9 !== 'function') return;
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const audit = root.__lv10MatchAudit;
    const controlledByFrozen = (playerKey: string, cardState: any) =>
        (cardState.fateWillControllerByTurnOwner?.[playerKey] || playerKey) === frozenPlayer;
    // The frozen browser owns its entire CPU turn, including automatic
    // continuations. Let that sequence reach the live browser in order.
    req('game/pass-handler').setAutomaticPassGuard((playerKey: string) => !controlledByFrozen(playerKey, root.cardState));
    audit.oracleVerificationErrors ||= [];
    audit.oracleStaleAnswers ||= 0;
    audit.oracleActionVerifications = [];
    const automaticPasses: number[] = [];
    let adviceWork: Promise<any> | null = null;
    let flushWork: Promise<void> | null = null;
    const comparable = (value: any) => {
        const state = clone(value);
        req('shared/presentation-queue').clearPresentationQueues(state.cardState);
        state.cardState.chargeDeltaEvents = [];
        for (const field of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta']) delete state.cardState[field];
        return req('shared/state-hash').stableStringify(state);
    };
    const currentState = () => ({ gameState: root.gameState, cardState: root.cardState,
        prngState: req('card-system').getGamePrng().getState() });
    const fail = (reason: string, details: any): never => {
        audit.oracleVerificationErrors.push({ reason, ...details });
        void root.__lv10MatchStalled(clone({ reason, details, ...currentState(), audit,
            lv10: root.__lv10CaptureDiagnostics?.() })).catch(() => undefined);
        throw new Error(`Frozen comparison failed: ${reason}`);
    };
    const verified = (recordIndex: number, answer: any, delivery: string) => {
        audit.oracleActionVerifications.push({ recordIndex, delivery, oracleAnswerIndex: answer.oracleAnswerIndex,
            action: clone(answer.action), turnPlan: answer.turnPlan });
    };
    const verifyAutomaticPass = (recordIndex: number, answer: any) => {
        const record = audit.records[recordIndex], attempts = answer.attempts || [], attempt = attempts[0];
        // A forced pass may happen between CPU callbacks. It cannot stand in
        // for a different decision, a retry sequence, or a pending preparation.
        if (!record?.ok || !controlledByFrozen(record.player, record.before.cardState) || record.action.type !== 'pass'
            || record.action.autoNoActionPass !== true || attempts.length !== 1 || !attempt.ok
            || attempt.player !== record.player || attempt.preparations?.length
            || req('shared/state-hash').stableStringify(record.action) !== req('shared/state-hash').stableStringify(answer.action)
            || comparable(record.before) !== comparable(attempt.before)
            || comparable(record.after) !== comparable(answer.after)) {
            fail('automatic_pass_mismatch', { recordIndex, record, answer });
        }
        verified(recordIndex, answer, 'automatic-pass');
    };
    const flushAutomaticPasses = () => {
        if (flushWork) return flushWork;
        const work = (async () => {
            while (automaticPasses.length) {
                const index = automaticPasses[0];
                const answer = await root.__queryFrozenLv9(clone(audit.records[index].before));
                verifyAutomaticPass(index, answer);
                automaticPasses.shift();
            }
        })();
        flushWork = work;
        return work.finally(() => { if (flushWork === work) flushWork = null; });
    };
    const pipeline = req('game/turn/turn_pipeline'), apply = pipeline.applyTurnSafe;
    pipeline.applyTurnSafe = function(cs: any, gs: any, player: any, action: any, rng: any, options: any) {
        const live = cs === root.cardState && gs === root.gameState;
        const frozen = live && controlledByFrozen(player, cs);
        const result = apply(cs, gs, player, action, rng, options);
        if (!frozen || !result.ok) return result;
        const index = audit.records.length - 1, record = audit.records[index];
        const answer = root.__lv10ExpectedOracleAction;
        if (answer) {
            root.__lv10ExpectedOracleAction = null;
            if (comparable(record.after) !== comparable(answer.after)) {
                fail('accepted_transition_mismatch', { recordIndex: index, expected: answer.after, actual: record.after });
            }
            verified(index, answer, 'advised');
        } else if (action.type === 'pass' && action.autoNoActionPass === true) {
            automaticPasses.push(index);
        } else {
            fail('unadvised_frozen_action', { recordIndex: index, record });
        }
        return result;
    };
    const advise = async () => {
        await flushAutomaticPasses();
        const snapshot = clone(currentState());
        const answer = await root.__queryFrozenLv9(snapshot);
        const advisory = { version: 'frozen-lv9-baseline-v1', action: answer.action, continuation: [], value: null,
            transitions: 0, elapsedMs: answer.thinkingMs, stopped: 'complete', rejectedCount: 0, rejected: [], evaluatedCandidates: 1 };
        if (comparable(currentState()) !== comparable(snapshot)) {
            // The same forced pass can also finish while its advice is in
            // flight. This answer has already been consumed from the oracle.
            const index = automaticPasses[0];
            if (index !== undefined && comparable(audit.records[index].before) === comparable(snapshot)) {
                verifyAutomaticPass(index, answer);
                automaticPasses.shift();
            }
            audit.oracleStaleAnswers++;
            return { ...advisory, action: null };
        }
        root.__lv10ExpectedOracleAction = answer;
        root.__lv10ExpectedOracleSnapshot = snapshot;
        return advisory;
    };
    req('game/cpu-turn-handler').setCpuUIImpl({
        adviseComparisonOpponent: () => {
            if (adviceWork) return Promise.reject(new Error('Concurrent live comparison advice'));
            const work = advise();
            adviceWork = work;
            return work.finally(() => { if (adviceWork === work) adviceWork = null; });
        },
        applyComparisonOpponentPrelude: async (action: any) => {
            try {
                const answer = root.__lv10ExpectedOracleAction, rng = req('card-system').getGamePrng();
                const snapshot = root.__lv10ExpectedOracleSnapshot;
                if (!answer || JSON.stringify(answer.action) !== JSON.stringify(action)
                    || comparable(currentState()) !== comparable(snapshot)) throw new Error('Frozen opponent prelude is stale');
                for (const attempt of answer.attempts) {
                    for (const preparation of attempt.preparations || []) {
                        const pending = root.cardState.pendingEffectByPlayer?.[preparation.player];
                        if (preparation.player !== attempt.player) throw new Error('Frozen preparation changes another player');
                        if (preparation.kind === 'clearPendingEffect') {
                            if (JSON.stringify(pending || null) !== JSON.stringify(preparation.pending)) throw new Error('Frozen pending clear differs');
                            req('game/turn/pending-coordinator').clearPendingEffect(root.cardState, preparation.player, preparation.options);
                        } else if (preparation.kind === 'setPendingField' && pending?.type === 'BOARD_EXPANSION_GOD'
                            && preparation.pendingType === pending.type && preparation.pendingEffectId === pending.pendingEffectId
                            && preparation.field === 'maxSelections' && preparation.value === 1 && !pending.selectedCount) {
                            pending.maxSelections = 1;
                        } else throw new Error('Unsupported frozen CPU preparation');
                        (audit.oraclePreparations ||= []).push(clone(preparation));
                    }
                    if (attempt.before && comparable(currentState()) !== comparable(attempt.before)) {
                        fail('pre_action_state_mismatch', { attempt, actual: clone(currentState()) });
                    }
                    if (attempt.ok) break;
                    const actual = pipeline.applyTurnSafe(root.cardState, root.gameState, attempt.player, attempt.action, rng, attempt.options);
                    if (actual.ok || JSON.stringify(rng.getState()) !== JSON.stringify(attempt.rngAfter)) {
                        fail('rejected_attempt_mismatch', { attempt });
                    }
                }
                const accepted = answer.attempts[answer.attempts.length - 1];
                if (JSON.stringify(rng.getState()) !== JSON.stringify(accepted.rngBefore)) {
                    fail('pre_action_rng_mismatch', { accepted, snapshotPrng: snapshot.prngState, actualPrng: rng.getState() });
                }
                root.__lv10ExpectedOracleAction = answer;
            } catch (error) {
                fail('comparison_prelude_failed', { error: String(error), recordIndex: audit.records.length });
            }
        }
    });
    root.__lv10FlushComparison = async () => {
        if (adviceWork) await adviceWork;
        await flushAutomaticPasses();
        const verifiedIndices = new Set(audit.oracleActionVerifications.map((item: any) => item.recordIndex));
        const missing = audit.records.flatMap((record: any, index: number) =>
            record.ok && controlledByFrozen(record.player, record.before.cardState) && !verifiedIndices.has(index) ? [index] : []);
        if (missing.length) fail('unverified_frozen_actions', { missing });
    };
}
