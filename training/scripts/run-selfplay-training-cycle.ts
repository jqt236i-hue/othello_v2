declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { StringDecoder } = require('string_decoder');
const {
    TRAINING_CHECKPOINT_HEAD_SPECS,
    cloneResumeCheckpointPaths
} = require('./training-checkpoint-utils');
const {
    TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION,
    buildIterationWarehouseManifest,
    writeTrainingWarehouseManifest,
    cleanupWarehouseSelfplayArtifacts
} = require('./training-warehouse-manifest-utils');
const { buildSeedList } = require('./policy-seed-utils');
const {
    loadSeedBank,
    resolveSeedScheduleFromBank,
    commitSeedBankUsage
} = require('./seed-bank-manager');
const {
    buildGenerateSelfplayDataArgs,
    buildPolicyTrainingCommandArgs,
    buildCardTrainingCommandArgs,
    buildTargetTrainingCommandArgs,
    buildValueTrainingCommandArgs,
    buildQuickAdoptionCommandArgs,
    buildQualityGateCommandArgs,
    buildFinalAdoptionCommandArgs,
    buildCandidateOnnxBundleArgs,
    buildTargetOnnxBundleArgs,
    buildOnnxGateCommandArgs,
    buildPromotionTargetBundleArgs,
    buildPromotionCommandArgs
} = require('./training-cycle-command-builders');
const {
    buildDeckCodeArgs
} = require('./selfplay-deck-options');
const {
    extractTrainingCycleFailureDetail,
    annotateTrainingCycleError,
    writeSummarySnapshot
} = require('./training-cycle-reporting');
const {
    TRAINING_CYCLE_STEP_ORDER
} = require('./training-cycle-steps');
const {
    parseSelfplayTrainingCycleArgs,
    normalizeRestartFromStep,
    normalizeSelfplayCandidateAdmission,
    shouldAdmitCandidateGuide,
    shouldIncludeCandidateFilesAtStartup,
    describeSelfplayGuideUpdateMode,
    shouldReuseStepArtifacts,
    getPrimaryResumeCheckpointPath,
    resolveCarryOverResumeCheckpointPaths,
    resolveResumeCheckpointPathsFromArgs,
    resolveSelfplayCardUsageRateForIteration,
    makeRunTag
} = require('./selfplay-training-cycle-args');

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-selfplay-training-cycle.js [options]',
        '',
        'Options:',
        '  -n, --iterations <n>        Number of full training cycles (default: 1)',
        '      --max-hours <h>         Time budget in hours (default: 100, 0=off)',
        '      --train-games <n>       Self-play games for train data (default: 20000)',
        '      --eval-games <n>        Self-play games for eval data (default: 2000)',
        '      --selfplay-jobs <n>     Parallel workers for self-play generation (default: auto, up to 10)',
        '      --selfplay-resume-chunk-size <n>  Chunk checkpoint size for resumable self-play generation (default: 1000, 0=off)',
        '      --adoption-jobs <n>     Parallel workers for adoption benchmark (default: auto, up to 10)',
        '      --onnx-gate-jobs <n>    Parallel workers for ONNX gate matches (default: auto, up to 10)',
        '  -s, --seed <n>              Base seed (default: 1)',
        '      --seed-stride <n>       Seed step per iteration (default: 1000)',
        '      --eval-seed-offset <n>  Eval seed offset from train seed (default: 100000)',
        '      --max-plies <n>         Max plies per game (default: 220)',
        '      --with-cards            Enable cards in self-play (default: on)',
        '      --no-cards              Disable cards in self-play',
        '      --selfplay-hardcases    Write hardcase-only NDJSON alongside self-play data (default: on)',
        '      --no-selfplay-hardcases Disable hardcase-only NDJSON generation for self-play',
        '      --card-usage-rate <r>   Card usage rate [0..1] (default: 0.2)',
        '      --selfplay-policy-mix-rate <r> Probability to use guide model per player/game [0..1] (default: 1)',
        '      --selfplay-policy-model-pool-size <n> Recent promoted/candidate models kept in self-play pool (default: 4)',
        '      --selfplay-candidate-admission <m> Candidate guide admission: promoted-only|quick-pass|always (default: promoted-only)',
        '      --selfplay-policy-pool-sampling <mode> Model-pool sampling mode uniform|recency (default: recency)',
        '      --selfplay-policy-pool-recency-decay <r> Recency decay (>0) for recency sampling (default: 2.5)',
        '      --selfplay-policy-current-anchor-rate <r> Probability to anchor one side to current guide model [0..1] (default: 0.35)',
        '      --selfplay-card-usage-rate-jitter <r> Per-game card usage jitter (+/-r) [0..1] (default: 0)',
        '      --selfplay-card-usage-rate-schedule <spec> Step schedule for self-play card usage only (<rate>@<iteration>,...)',
        '      --selfplay-tactical-weight-min <r> Min tactical lookahead weight during self-play (default: 1)',
        '      --selfplay-tactical-weight-max <r> Max tactical lookahead weight during self-play (default: 1)',
        '      --selfplay-tactical-depth-opening <n> Tactical search depth in opening phase for self-play (default: 4)',
        '      --selfplay-tactical-depth-mid <n> Tactical search depth in mid phase for self-play (default: 6)',
        '      --selfplay-tactical-depth-end <n> Tactical search depth in end phase for self-play (default: 8)',
        '      --selfplay-tactical-beam-width <n> Tactical search beam width for self-play (default: 12)',
        '      --selfplay-teacher-committee-weight-min <r> Min committee voting weight in teacher self-play (default: 28)',
        '      --selfplay-teacher-committee-weight-max <r> Max committee voting weight in teacher self-play (default: 28)',
        '      --selfplay-teacher-committee-consensus-bonus-min <r> Min committee consensus bonus in teacher self-play (default: 320)',
        '      --selfplay-teacher-committee-consensus-bonus-max <r> Max committee consensus bonus in teacher self-play (default: 320)',
        '      --selfplay-policy-score-weight-min <r> Min model score weight in teacher hybrid scoring (default: 1)',
        '      --selfplay-policy-score-weight-max <r> Max model score weight in teacher hybrid scoring (default: 1)',
        '      --selfplay-heuristic-weight-min <r> Min heuristic score weight in teacher hybrid scoring (default: 1)',
        '      --selfplay-heuristic-weight-max <r> Max heuristic score weight in teacher hybrid scoring (default: 1)',
        '      --python <path>         Python executable path (default: .venv/Scripts/python.exe)',
        '      --policy-trainer-script <path> Policy trainer script (default: ai/train/train_policy_onnx.py)',
        '      --onnx-epochs <n>       train_policy_onnx --epochs (default: 9999)',
        '      --onnx-batch-size <n>   train_policy_onnx --batch-size (default: 2048)',
        '      --onnx-lr <r>           train_policy_onnx --lr (default: 0.001)',
        '      --onnx-value-lr <r>     train_value_onnx --lr override (>0, default: reuse --onnx-lr)',
        '      --onnx-hidden-size <n>  train_policy_onnx --hidden-size (default: 256)',
        '      --onnx-hidden-channels <n> CNN policy trainer hidden channels (default: 32)',
        '      --onnx-num-res-blocks <n> CNN policy trainer ResNet blocks (default: 3)',
        '      --onnx-history-length <n> CNN policy trainer board history length (default: 1)',
        '      --onnx-nonvalidity-penalty <r> CNN policy trainer illegal-mass penalty (default: 0)',
        '      --onnx-value-hidden-size <n>  train_value_onnx --hidden-size override (>=8, default: reuse --onnx-hidden-size)',
        '      --onnx-device <mode>    train_policy_onnx --device auto/cpu/cuda (default: auto)',
        '      --onnx-log-interval-steps <n>  train_policy_onnx step log interval (default: 0=off)',
        '      --onnx-val-split <r>    train_policy_onnx --val-split [0..0.5) (default: 0.1)',
        '      --onnx-val-split-mode <m> train_policy_onnx --val-split-mode random|grouped-game (default: grouped-game)',
        '      --onnx-early-stop-patience <n> train_policy_onnx early stop patience (default: 8)',
        '      --onnx-early-stop-min-delta <r> train_policy_onnx early stop min delta (default: 0.0005)',
        '      --onnx-early-stop-min-epochs <n> train_policy_onnx minimum epochs before early-stop (default: 8)',
        '      --onnx-early-stop-monitor <m> train_policy_onnx monitor val_loss/train_loss/val_place_loss/train_place_loss (default: val_loss)',
        '      --onnx-early-stop-smoothing-window <n> train_policy_onnx early-stop moving-average window (default: 1=off)',
        '      --onnx-resume-optimizer   Restore optimizer state when resuming checkpoint (default: off)',
        '      --no-onnx-resume-optimizer Disable optimizer-state resume',
        '      --onnx-card-no-action-weight <r> train_policy_onnx NO_CARD class weight (>0, default: 0.7)',
        '      --onnx-card-class-balance-power <r> train_policy_onnx card class balancing power [0..1] (default: 0.25)',
        '      --onnx-winner-sample-boost <r> train_policy_onnx winner-side sample boost (>=0, default: 0.35)',
        '      --onnx-loser-sample-weight <r> train_policy_onnx loser-side sample weight (>0, default: 0.8)',
        '      --onnx-draw-sample-weight <r> train_policy_onnx draw sample weight (>0, default: 1.0)',
        '      --onnx-corner-emergency-sample-boost <r> Extra sample boost on corner-emergency records (>=0, default: 0.0)',
        '      --onnx-negative-future-disc-sample-boost <r> Extra sample boost when futureDiscDelta3Ply is below threshold (>=0, default: 0.0)',
        '      --onnx-negative-future-disc-threshold <r> Threshold for futureDiscDelta3Ply danger boost (default: -1.0)',
        '      --onnx-tactical-miss-sample-boost <r> Extra sample boost when tacticalScoreMissRatio exceeds threshold (>=0, default: 0.0)',
        '      --onnx-tactical-miss-threshold <r> Threshold for tacticalScoreMissRatio boost (>=0, default: 0.08)',
        '      --onnx-hand-pressure-sample-boost <r> Extra sample boost when handCards length is >= 4 (>=0, default: 0.0)',
        '      --onnx-pending-target-sample-boost <r> Extra sample boost when pendingType is active (>=0, default: 0.0)',
        '      --onnx-corner-balance-sample-boost <r> Extra policy/value sample boost scaled by corner pressure (>=0, default: 0.0)',
        '      --onnx-edge-balance-sample-boost <r> Extra policy/value sample boost scaled by edge pressure (>=0, default: 0.0)',
        '      --onnx-economy-balance-sample-boost <r> Extra policy/value sample boost scaled by charge/bonus pressure (>=0, default: 0.0)',
        '      --onnx-value-target-corner-weight <r> Value-target corner blend weight [0..1] (default: 0.0)',
        '      --onnx-value-target-edge-weight <r> Value-target edge blend weight [0..1] (default: 0.0)',
        '      --onnx-value-target-economy-weight <r> Value-target economy blend weight [0..1] (default: 0.0)',
        '      --onnx-value-target-corner-emergency-weight <r> Value-target corner-emergency penalty weight [0..1] (default: 0.0)',
        '      --train-target-head     Enable pending-target specialist training and packaging (default: on)',
        '      --no-train-target-head  Disable pending-target specialist training and promotion packaging for this lane',
        '      --train-value-head      Enable value specialist training and packaging (default: on)',
        '      --no-train-value-head   Disable value specialist training, ONNX gate wiring, and promotion packaging for this lane',
        '      --train-card-every <n>  Train card specialist every N iterations, starting from iteration 1 (default: 1)',
        '      --train-target-every <n> Train pending-target specialist every N iterations, starting from iteration 1 (default: 1)',
        '      --train-value-every <n> Train value specialist every N iterations, starting from iteration 1 (default: 1)',
        '      --min-visits <n>        compatibility policy-table --min-visits (default: 12)',
        '      --shape-immediate <r>   compatibility policy-table --shape-immediate (default: 0.4)',
        '      --quick-games <n>       Adoption quick check games (default: 500)',
        '      --final-games <n>       Adoption final check games (default: 2000)',
        '      --threshold <r>         Required average uplift threshold [0..1] (default: 0.05)',
        '      --adoption-seed-count <n>  Number of seeds for adoption averaging (default: 1)',
        '      --adoption-seed-stride <n> Seed step for adoption averaging (default: 1000)',
        '      --adoption-final-seed-offset <n> Seed offset for final adoption run (default: 500000)',
        '      --adoption-confidence-level <r> One-sided confidence level for uplift lower bound [0.5..1) (default: 0.95)',
        '      --adoption-min-lower-bound <r> Required uplift lower confidence bound [-1..1] (default: -1=off)',
        '      --adoption-min-seed-uplift <r> Required minimum per-seed uplift [-1..1] (default: -1)',
        '      --adoption-min-seed-pass-count <n> Required per-seed threshold pass count (default: 0)',
        '      --quality-gate          Enable quality-only gate between quick and final adoption (default: off)',
        '      --no-quality-gate       Disable quality-only gate',
        '      --quality-gate-games <n> Quality gate games (default: 1000)',
        '      --quality-gate-seed-count <n> Quality gate seed count (default: 1)',
        '      --quality-gate-seed-stride <n> Quality gate seed stride (default: 1000)',
        '      --quality-gate-seed-offset <n> Quality gate base seed offset (default: 250000)',
        '      --quality-gate-threshold <r> Quality gate average uplift threshold [-1..1] (default: 0)',
        '      --quality-gate-confidence-level <r> Quality gate confidence level [0.5..1) (default: 0.95)',
        '      --quality-gate-min-lower-bound <r> Quality gate uplift lower confidence bound [-1..1] (default: -1)',
        '      --quality-gate-min-seed-uplift <r> Quality gate minimum per-seed uplift [-1..1] (default: -1)',
        '      --quality-gate-min-seed-pass-count <n> Quality gate minimum passing seeds (default: 0)',
        '      --quality-gate-strength-first Require non-negative raw/source strength on quality-gate samples before passing',
        '      --quick-adoption-seed-offset <n> Seed offset for quick adoption run (default: 0 = reuse iteration base seed family)',
        '      --quick-adoption-threshold <r> Override quick adoption threshold [0..1] (default: fallback to --threshold)',
        '      --quick-adoption-seed-count <n> Override quick adoption seed count (default: fallback to --adoption-seed-count)',
        '      --quick-adoption-seed-stride <n> Override quick adoption seed stride (default: fallback to --adoption-seed-stride)',
        '      --quick-adoption-confidence-level <r> Override quick adoption confidence level [0.5..1) (default: fallback to --adoption-confidence-level)',
        '      --quick-adoption-min-lower-bound <r> Override quick adoption lower confidence bound [-1..1] (default: fallback to --adoption-min-lower-bound)',
        '      --quick-adoption-min-seed-uplift <r> Override quick adoption minimum per-seed uplift [-1..1] (default: fallback to --adoption-min-seed-uplift)',
        '      --quick-adoption-min-seed-pass-count <n> Override quick adoption minimum seed pass count (default: fallback to --adoption-min-seed-pass-count)',
        '      --final-adoption-threshold <r> Override final adoption threshold [0..1] (default: fallback to --threshold)',
        '      --final-adoption-seed-count <n> Override final adoption seed count (default: fallback to --adoption-seed-count)',
        '      --final-adoption-seed-stride <n> Override final adoption seed stride (default: fallback to --adoption-seed-stride)',
        '      --final-adoption-confidence-level <r> Override final adoption confidence level [0.5..1) (default: fallback to --adoption-confidence-level)',
        '      --final-adoption-min-lower-bound <r> Override final adoption lower confidence bound [-1..1] (default: fallback to --adoption-min-lower-bound)',
        '      --final-adoption-min-seed-uplift <r> Override final adoption minimum per-seed uplift [-1..1] (default: fallback to --adoption-min-seed-uplift)',
        '      --final-adoption-min-seed-pass-count <n> Override final adoption minimum seed pass count (default: fallback to --adoption-min-seed-pass-count)',
        '      --adoption-tactical-weight <r> Shared tactical weight in adoption benchmark (default: 0.25)',
        '      --adoption-tactical-depth-opening <n> Tactical search depth in opening phase for adoption benchmark (default: 4)',
        '      --adoption-tactical-depth-mid <n> Tactical search depth in mid phase for adoption benchmark (default: 6)',
        '      --adoption-tactical-depth-end <n> Tactical search depth in end phase for adoption benchmark (default: 8)',
        '      --adoption-tactical-beam-width <n> Tactical search beam width for adoption benchmark (default: 12)',
        '      --adoption-policy-score-weight <r> Shared model score weight in adoption benchmark (default: 2.0)',
        '      --adoption-heuristic-weight <r> Shared heuristic score weight in adoption benchmark (default: 0.85)',
        '      --adoption-white-priority <r> White-side score blend in adoption benchmark [0..1] (default: 0.5)',
        '      --adoption-quality-weight-corner <r> Adoption quality corner-take weight [0..1] (default: 0.22)',
        '      --adoption-quality-weight-edge <r> Adoption quality edge-take weight [0..1] (default: 0.10)',
        '      --adoption-quality-weight-corner-recovery <r> Adoption quality corner-recovery weight [0..1] (default: 0.18)',
        '      --adoption-quality-weight-corner-recapture <r> Adoption quality corner-recapture weight [0..1] (default: 0.14)',
        '      --adoption-quality-weight-edge-recovery <r> Adoption quality edge-recovery weight [0..1] (default: 0.12)',
        '      --adoption-quality-weight-corner-hold <r> Adoption quality corner-hold weight [0..1] (default: 0.16)',
        '      --adoption-quality-weight-corner-hold-turns <r> Adoption quality corner-hold-turns weight [0..1] (default: 0.10)',
        '      --adoption-quality-weight-edge-hold <r> Adoption quality edge-hold weight [0..1] (default: 0.09)',
        '      --adoption-quality-weight-edge-chain <r> Adoption quality contiguous-edge weight [0..1] (default: 0.12)',
        '      --adoption-quality-weight-final-corner-share <r> Adoption quality final corner share weight [0..1] (default: 0.24)',
        '      --adoption-quality-weight-final-edge-share <r> Adoption quality final edge share weight [0..1] (default: 0.06)',
        '      --adoption-quality-weight-final-longest-edge-run-share <r> Adoption quality final longest-edge-run share weight [0..1] (default: 0.08)',
        '      --adoption-quality-weight-bonus <r> Adoption quality bonus weight [0..1] (default: 0.01)',
        '      --adoption-quality-weight-card-immediate <r> Adoption quality card-immediate weight [0..1] (default: 0.015)',
        '      --adoption-quality-weight-card-future <r> Adoption quality card-future(3ply) weight [0..1] (default: 0.02)',
        '      --adoption-quality-weight-place-delta <r> Adoption quality place-delta weight [0..1] (default: 0.015)',
        '      --adoption-use-guide-baseline  Compare candidate against current guide model in adoption benchmark',
        '      --no-adoption-use-guide-baseline Disable guide-model baseline compare (default)',
        '      --adoption-use-anchor-baseline Compare candidate against a fixed loop-start anchor model in adoption benchmark',
        '      --no-adoption-use-anchor-baseline Disable fixed-anchor baseline compare (default)',
        '      --onnx-gate             Enable browser ONNX gate before promotion (default: off)',
        '      --no-onnx-gate          Disable browser ONNX gate',
        '      --onnx-gate-games <n>   ONNX gate games per side/seed (default: 8)',
        '      --onnx-gate-seed-count <n> ONNX gate seed count (default: 1)',
        '      --onnx-gate-seed-stride <n> ONNX gate seed stride (default: 1000)',
        '      --onnx-gate-seed-offset <n> ONNX gate base seed offset (default: 700000)',
        '      --onnx-gate-threshold <r> ONNX gate average score threshold [0..1] (default: 0.5)',
        '      --onnx-gate-min-seed-score <r> ONNX gate minimum seed score [0..1] (default: 0)',
        '      --onnx-gate-min-seed-pass-count <n> ONNX gate minimum passing seeds (default: 0)',
        '      --onnx-gate-max-average-latency-ms <n> ONNX gate max average inference latency in ms (default: 0=off)',
        '      --onnx-gate-max-p95-latency-ms <n> ONNX gate max worst-match p95 inference latency in ms (default: 0=off)',
        '      --onnx-gate-max-max-latency-ms <n> ONNX gate max peak inference latency in ms (default: 0=off)',
        '      --onnx-gate-timeout-ms <n> ONNX gate per-match timeout in ms (default: 180000)',
        '      --onnx-gate-black-level <n> ONNX gate black CPU level [1..6] (default: 6)',
        '      --onnx-gate-white-level <n> ONNX gate white CPU level [1..6] (default: 6)',
        '      --onnx-gate-candidate-color-mode <m> ONNX gate candidate side mode both|white (default: both)',
        '      --promotion-mode <mode> Promotion gate strategy: strict | onnx-primary | quick-only (default: strict)',
        '      --onnx-primary-max-quick-regression <r> Max allowed quick uplift regression in onnx-primary [0..1] (default: 0.05)',
        '      --onnx-primary-require-quick-regression    Require quick uplift regression guard in onnx-primary (default: off)',
        '      --no-onnx-primary-require-quick-regression Disable quick uplift regression guard in onnx-primary',
        '      --onnx-primary-require-quick-non-regression    Require quick core/white/quality non-regression guard (default: off)',
        '      --no-onnx-primary-require-quick-non-regression Disable quick core/white/quality non-regression guard',
        '      --onnx-primary-min-quick-core-delta <r> Min allowed (candidate-baseline) quick core score delta [-1..1] (default: 0)',
        '      --onnx-primary-min-quick-white-delta <r> Min allowed (candidate-baseline) quick white-side score delta [-1..1] (default: 0)',
        '      --onnx-primary-min-quick-quality-delta <r> Min allowed (candidate-baseline) quick quality score delta [-1..1] (default: -0.01)',
        '      --onnx-primary-min-quick-uplift <r> Min quick uplift required in onnx-primary [-1..1] (default: 0)',
        '      --onnx-primary-min-quick-lower-bound <r> Min quick uplift lower-bound required in onnx-primary [-1..1] (default: -1)',
        '      --onnx-primary-min-onnx-gate-avg <r> Min ONNX gate average score required in onnx-primary [0..1] (default: 0)',
        '      --onnx-primary-min-onnx-gate-min-seed <r> Min ONNX gate min-seed score required in onnx-primary [0..1] (default: 0)',
        '      --gate-final-iteration-only  Run quick/quality/final/onnx/promotion only on the last iteration',
        '      --no-gate-final-iteration-only Disable last-iteration-only gate mode (default)',
        '      --promote               Promote model when selected promotion mode passes (default: on)',
        '      --no-promote            Skip promotion even when final check passes',
        '      --selfplay-use-promoted-model-only        Update next self-play guide only when promotion succeeds (default: on)',
        '      --selfplay-use-candidate-every-iteration  Update next self-play guide to latest candidate every iteration',
        '      --bootstrap-policy-model <path>  Seed self-play with an existing policy-table JSON',
        '      --resume-checkpoint <path>       Legacy single resume checkpoint; head is inferred from filename',
        '      --resume-policy-checkpoint <path> Resume policy ONNX training from checkpoint (.pt)',
        '      --resume-card-checkpoint <path>   Resume card ONNX training from checkpoint (.pt)',
        '      --resume-target-checkpoint <path> Resume target ONNX training from checkpoint (.pt)',
        '      --resume-value-checkpoint <path>  Resume value ONNX training from checkpoint (.pt)',
        '      --carry-over-checkpoint          Carry candidate checkpoint to next iteration (default: on)',
        '      --carry-over-checkpoint-promoted-only  Carry candidate checkpoint only after promotion succeeds',
        '      --no-carry-over-checkpoint       Do not carry checkpoint to next iteration',
        '      --seed-bank <path>     Optional seed_bank.v1 file for quick/quality/final/onnx gate seeds',
        '      --run-tag <tag>         Tag appended to output filenames',
        '      --runs-dir <path>       Output directory for records/results (default: data/runs)',
        '      --models-dir <path>     Output directory for candidate models (default: data/models)',
        '      --summary-out <path>    Output summary JSON path',
        '      --reuse-existing-artifacts  Reuse completed iteration artifacts and continue from the first missing step',
        `      --restart-from-step <name>  When reusing artifacts, rerun this step and later steps (${TRAINING_CYCLE_STEP_ORDER.join(', ')})`,
        '      --verbose               Keep verbose logs in underlying scripts',
        '  -h, --help                  Show this help'
    ].join('\n'));
}

function runCommand(cmd, args, options) {
    const allowExitCodes = options && Array.isArray(options.allowExitCodes) ? options.allowExitCodes : [0];
    const timeoutMs = options && Number.isFinite(options.timeoutMs)
        ? Math.max(1, Math.floor(options.timeoutMs))
        : null;
    const shown = [cmd].concat(args).join(' ');
    console.log(`[training-cycle] run: ${shown}`);
    const startedAt = Date.now();
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
        timeout: timeoutMs || undefined
    });
    const elapsedMs = Date.now() - startedAt;
    if (result.error) {
        if (result.error.code === 'ETIMEDOUT') {
            const err = new Error(`command timed out after ${timeoutMs}ms: ${shown}`);
            err.code = 'COMMAND_TIMEOUT';
            err.command = shown;
            throw err;
        }
        result.error.command = shown;
        throw result.error;
    }
    if (!allowExitCodes.includes(result.status)) {
        const err = new Error(`command failed (exit=${result.status}): ${shown}`);
        err.code = 'COMMAND_FAILED';
        err.exitCode = result.status;
        err.command = shown;
        throw err;
    }
    return { status: result.status, elapsedMs };
}

function iterationTag(runTag, iterationIndex) {
    return `${runTag}.it${String(iterationIndex).padStart(2, '0')}`;
}

function buildIterationPaths(args, iterationIndex) {
    const tag = iterationTag(args.runTag, iterationIndex);
    const targetHeadEnabled = args.trainTargetHeadEnabled !== false;
    const valueHeadEnabled = args.trainValueHeadEnabled !== false;
    return {
        tag,
        trainDataPath: path.resolve(args.runsDir, `selfplay.train.${tag}.ndjson`),
        trainHardcaseDataPath: args.selfplayGenerateHardcases === false
            ? null
            : path.resolve(args.runsDir, `selfplay.train.hardcase.${tag}.ndjson`),
        trainDataSummaryPath: path.resolve(args.runsDir, `selfplay.train.${tag}.ndjson.summary.json`),
        evalDataPath: path.resolve(args.runsDir, `selfplay.eval.${tag}.ndjson`),
        evalHardcaseDataPath: args.selfplayGenerateHardcases === false
            ? null
            : path.resolve(args.runsDir, `selfplay.eval.hardcase.${tag}.ndjson`),
        evalDataSummaryPath: path.resolve(args.runsDir, `selfplay.eval.${tag}.ndjson.summary.json`),
        onnxModelPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.onnx`),
        onnxMetaPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.onnx.meta.json`),
        checkpointPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.checkpoint.pt`),
        cardOnnxModelPath: path.resolve(args.modelsDir, `policy-card.candidate.${tag}.onnx`),
        cardOnnxMetaPath: path.resolve(args.modelsDir, `policy-card.candidate.${tag}.onnx.meta.json`),
        cardCheckpointPath: path.resolve(args.modelsDir, `policy-card.candidate.${tag}.checkpoint.pt`),
        targetOnnxModelPath: targetHeadEnabled
            ? path.resolve(args.modelsDir, `policy-target.candidate.${tag}.onnx`)
            : null,
        targetOnnxMetaPath: targetHeadEnabled
            ? path.resolve(args.modelsDir, `policy-target.candidate.${tag}.onnx.meta.json`)
            : null,
        targetCheckpointPath: targetHeadEnabled
            ? path.resolve(args.modelsDir, `policy-target.candidate.${tag}.checkpoint.pt`)
            : null,
        valueOnnxModelPath: valueHeadEnabled
            ? path.resolve(args.modelsDir, `policy-value.candidate.${tag}.onnx`)
            : null,
        valueOnnxMetaPath: valueHeadEnabled
            ? path.resolve(args.modelsDir, `policy-value.candidate.${tag}.onnx.meta.json`)
            : null,
        valueCheckpointPath: valueHeadEnabled
            ? path.resolve(args.modelsDir, `policy-value.candidate.${tag}.checkpoint.pt`)
            : null,
        onnxMetricsPath: path.resolve(args.runsDir, `train.metrics.${tag}.jsonl`),
        cardMetricsPath: path.resolve(args.runsDir, `train.card.metrics.${tag}.jsonl`),
        targetMetricsPath: targetHeadEnabled
            ? path.resolve(args.runsDir, `train.target.metrics.${tag}.jsonl`)
            : null,
        valueMetricsPath: valueHeadEnabled
            ? path.resolve(args.runsDir, `train.value.metrics.${tag}.jsonl`)
            : null,
        candidateModelPath: path.resolve(args.modelsDir, `policy-table.candidate.${tag}.json`),
        quickAdoptionPath: path.resolve(args.runsDir, `adoption.quick.${tag}.json`),
        finalAdoptionPath: path.resolve(args.runsDir, `adoption.final.${tag}.json`),
        qualityGatePath: path.resolve(args.runsDir, `adoption.quality.${tag}.json`),
        onnxGatePath: path.resolve(args.runsDir, `adoption.onnx.${tag}.json`),
        warehouseManifestPath: path.resolve(args.runsDir, `training-warehouse.${tag}.json`)
    };
}

function fileExists(filePath) {
    return !!filePath && fs.existsSync(filePath);
}

function buildResumeChunkArtifactDir(dataPath) {
    return path.resolve(`${String(dataPath || '')}.resume-chunks`);
}

function buildMergeArtifactPaths(dataPath) {
    if (!dataPath) return [];
    const resolvedPath = path.resolve(String(dataPath || ''));
    return [
        `${resolvedPath}.partial`,
        `${resolvedPath}.merge-state.json`
    ];
}

function removePathIfExists(targetPath) {
    if (!targetPath || !fs.existsSync(targetPath)) return false;
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
        fs.rmSync(targetPath, { force: true });
    }
    return true;
}

function collectTransientSelfplayArtifactPaths(iterationPaths) {
    if (!iterationPaths || typeof iterationPaths !== 'object') return [];
    const out = [
        iterationPaths.trainDataPath,
        iterationPaths.trainHardcaseDataPath,
        iterationPaths.evalDataPath,
        iterationPaths.evalHardcaseDataPath,
        buildResumeChunkArtifactDir(iterationPaths.trainDataPath),
        buildResumeChunkArtifactDir(iterationPaths.evalDataPath)
    ];
    for (const basePath of [
        iterationPaths.trainDataPath,
        iterationPaths.trainHardcaseDataPath,
        iterationPaths.evalDataPath,
        iterationPaths.evalHardcaseDataPath
    ]) {
        out.push(...buildMergeArtifactPaths(basePath));
    }
    return out.filter(Boolean);
}

function cleanupTransientSelfplayArtifacts(iterationPaths) {
    const removed = [];
    const failed = [];
    const seen = new Set();
    for (const onePath of collectTransientSelfplayArtifactPaths(iterationPaths)) {
        const resolvedPath = path.resolve(onePath);
        if (seen.has(resolvedPath)) continue;
        seen.add(resolvedPath);
        try {
            if (removePathIfExists(resolvedPath)) {
                removed.push(resolvedPath);
            }
        } catch (err) {
            failed.push({
                path: resolvedPath,
                error: err && err.message ? err.message : String(err)
            });
        }
    }
    return {
        removed,
        failed
    };
}

function lineHasCoordinatePendingSelection(line) {
    if (!line) return false;
    let record = null;
    try {
        record = JSON.parse(line);
    } catch (err) {
        return false;
    }
    const pendingSelection = record && typeof record === 'object' ? record.pendingSelection : null;
    return !!(
        pendingSelection &&
        pendingSelection.kind === 'board_cell' &&
        Number.isInteger(pendingSelection.row) &&
        Number.isInteger(pendingSelection.col)
    );
}

function scanTextFileLines(filePath, onLine, options) {
    const chunkSizeBytes = options && Number.isFinite(options.chunkSizeBytes) && options.chunkSizeBytes > 0
        ? Math.max(1024, Math.floor(options.chunkSizeBytes))
        : (1024 * 1024);
    const decoder = new StringDecoder('utf8');
    const buffer = Buffer.allocUnsafe(chunkSizeBytes);
    const handleLine = (line) => !!(line && onLine(line));
    let carry = '';
    const fd = fs.openSync(filePath, 'r');

    try {
        while (true) {
            const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
            if (!bytesRead) break;
            const chunk = decoder.write(buffer.subarray(0, bytesRead));
            const combined = carry + chunk;
            const lines = combined.split(/\r?\n/);
            carry = lines.pop() || '';
            for (const line of lines) {
                if (handleLine(line)) return true;
            }
        }
        const tail = carry + decoder.end();
        return handleLine(tail);
    } finally {
        fs.closeSync(fd);
    }
}

function hasCoordinatePendingSelectionRecords(filePath, options) {
    if (!fileExists(filePath)) return false;
    return scanTextFileLines(filePath, lineHasCoordinatePendingSelection, options);
}

function readJsonSafe(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function resolveQuickComponentDelta(quickPayload, quickDecision, baselineKey, candidateKey) {
    if (
        quickDecision &&
        Number.isFinite(quickDecision[baselineKey]) &&
        Number.isFinite(quickDecision[candidateKey])
    ) {
        return Number(quickDecision[candidateKey]) - Number(quickDecision[baselineKey]);
    }
    const perSeed = quickPayload && Array.isArray(quickPayload.perSeed) ? quickPayload.perSeed : [];
    let sum = 0;
    let count = 0;
    for (const seedRow of perSeed) {
        const seedDecision = seedRow && seedRow.decision ? seedRow.decision : null;
        if (!seedDecision) continue;
        if (!Number.isFinite(seedDecision[baselineKey]) || !Number.isFinite(seedDecision[candidateKey])) continue;
        sum += Number(seedDecision[candidateKey]) - Number(seedDecision[baselineKey]);
        count += 1;
    }
    return count > 0 ? (sum / count) : -Infinity;
}

function resolvePromotionEligibility(args, gateState) {
    const quickPassed = !!(gateState && gateState.quickPassed);
    const qualityGatePassed = !!(gateState && gateState.qualityGatePassed);
    const finalPassed = !!(gateState && gateState.finalPassed);
    const onnxGatePassed = !!(gateState && gateState.onnxGatePassed);
    const quickRegressionWithinOnnxPrimaryLimit = !!(gateState && gateState.quickRegressionWithinOnnxPrimaryLimit);
    const quickNonRegressionWithinOnnxPrimaryLimit = !!(gateState && gateState.quickNonRegressionWithinOnnxPrimaryLimit);
    const quickUplift = gateState && Number.isFinite(gateState.quickUplift)
        ? Number(gateState.quickUplift)
        : Number.NEGATIVE_INFINITY;
    const quickUpliftLowerBound = gateState && Number.isFinite(gateState.quickUpliftLowerBound)
        ? Number(gateState.quickUpliftLowerBound)
        : Number.NEGATIVE_INFINITY;
    const onnxGateDecision = gateState && gateState.onnxGateDecision ? gateState.onnxGateDecision : null;

    const strictPromoteEligible = finalPassed && qualityGatePassed && onnxGatePassed;
    const onnxPrimaryQuickGuardPassed = !args.onnxPrimaryRequireQuickRegression || quickRegressionWithinOnnxPrimaryLimit;
    const onnxPrimaryQuickNonRegressionGuardPassed = !args.onnxPrimaryRequireQuickNonRegression || quickNonRegressionWithinOnnxPrimaryLimit;
    const onnxGateAverageScore = onnxGateDecision && Number.isFinite(onnxGateDecision.averageScore)
        ? Number(onnxGateDecision.averageScore)
        : -Infinity;
    const onnxGateMinSeedScore = onnxGateDecision && Number.isFinite(onnxGateDecision.minSeedScore)
        ? Number(onnxGateDecision.minSeedScore)
        : -Infinity;
    const onnxPrimaryQuickUpliftGuardPassed = quickUplift >= args.onnxPrimaryMinQuickUplift;
    const onnxPrimaryQuickLowerBoundGuardPassed = quickUpliftLowerBound >= args.onnxPrimaryMinQuickLowerBound;
    const onnxPrimaryOnnxGateAvgGuardPassed = onnxGateAverageScore >= args.onnxPrimaryMinOnnxGateAvg;
    const onnxPrimaryOnnxGateMinSeedGuardPassed = onnxGateMinSeedScore >= args.onnxPrimaryMinOnnxGateMinSeed;
    const onnxPrimaryPromoteEligible =
        qualityGatePassed &&
        onnxGatePassed &&
        onnxPrimaryQuickGuardPassed &&
        onnxPrimaryQuickNonRegressionGuardPassed &&
        onnxPrimaryQuickUpliftGuardPassed &&
        onnxPrimaryQuickLowerBoundGuardPassed &&
        onnxPrimaryOnnxGateAvgGuardPassed &&
        onnxPrimaryOnnxGateMinSeedGuardPassed;
    const quickOnlyPromoteEligible = quickPassed && qualityGatePassed;

    let promoteEligible = strictPromoteEligible;
    if (args.promotionMode === 'onnx-primary') {
        promoteEligible = onnxPrimaryPromoteEligible;
    } else if (args.promotionMode === 'quick-only') {
        promoteEligible = quickOnlyPromoteEligible;
    }

    return {
        promoteEligible,
        strictPromoteEligible,
        onnxPrimaryPromoteEligible,
        quickOnlyPromoteEligible,
        onnxPrimaryQuickGuardPassed,
        onnxPrimaryQuickNonRegressionGuardPassed,
        onnxPrimaryQuickUpliftGuardPassed,
        onnxPrimaryQuickLowerBoundGuardPassed,
        onnxPrimaryOnnxGateAvgGuardPassed,
        onnxPrimaryOnnxGateMinSeedGuardPassed,
        onnxGateAverageScore,
        onnxGateMinSeedScore
    };
}

function resolveGateSeedConfig(seedBank, gateType, fallback) {
    const normalizedFallback = {
        seed: Number.isFinite(Number(fallback && fallback.seed)) ? Number(fallback.seed) : null,
        seedCount: Number.isFinite(Number(fallback && fallback.seedCount)) ? Number(fallback.seedCount) : null,
        seedStride: Number.isFinite(Number(fallback && fallback.seedStride)) ? Number(fallback.seedStride) : null,
        seedList: Array.isArray(fallback && fallback.seedList) ? fallback.seedList.slice() : []
    };
    if (!seedBank) {
        return Object.assign({}, normalizedFallback, {
            source: 'config',
            bankId: null,
            bankPath: null,
            purpose: null
        });
    }
    const schedule = resolveSeedScheduleFromBank(seedBank, gateType);
    return {
        seed: schedule.baseSeed,
        seedCount: schedule.seedCount,
        seedStride: schedule.seedStride,
        seedList: Array.isArray(schedule.scheduledSeeds) ? schedule.scheduledSeeds.slice() : [],
        source: 'seed-bank',
        bankId: seedBank.bankId || null,
        bankPath: seedBank.__filePath || null,
        purpose: schedule.purpose || null
    };
}

function recordSeedBankGateUsage(seedBank, gateType, gatePayloadPath, iterationIndex, runTag, reused) {
    if (!seedBank || !seedBank.__filePath || !gatePayloadPath) return null;
    return commitSeedBankUsage(seedBank.__filePath, {
        gateType,
        runTag,
        iteration: iterationIndex,
        gatePayloadPath,
        note: reused ? 'reused-artifact' : 'fresh-run'
    });
}

function buildInitialGuideModelPoolPaths(modelsDir, guideModelPath, maxSize, options) {
    const limit = Number.isFinite(maxSize) ? Math.max(1, Math.floor(maxSize)) : 1;
    const includeCandidateFiles = !options || options.includeCandidateFiles !== false;
    const includeArchiveFiles = !!(options && options.includeArchiveFiles);
    const dedup = new Set();
    const out = [];

    const addPath = (onePath) => {
        if (!onePath) return;
        const resolved = path.resolve(onePath);
        if (!fs.existsSync(resolved)) return;
        if (dedup.has(resolved)) return;
        dedup.add(resolved);
        out.push(resolved);
    };

    addPath(guideModelPath);
    if (includeArchiveFiles && modelsDir && fs.existsSync(modelsDir)) {
        let archiveEntries = [];
        try {
            archiveEntries = fs.readdirSync(path.resolve(modelsDir, 'archive'), { withFileTypes: true });
        } catch (e) {
            archiveEntries = [];
        }
        const archivedGuideFiles = archiveEntries
            .filter((entry) => entry && entry.isDirectory())
            .map((entry) => {
                const fullPath = path.resolve(modelsDir, 'archive', entry.name, 'policy-table.json');
                let mtimeMs = 0;
                try {
                    mtimeMs = Number(fs.statSync(fullPath).mtimeMs) || 0;
                } catch (e) {
                    return null;
                }
                return { fullPath, mtimeMs };
            })
            .filter((one) => !!one)
            .sort((a, b) => b.mtimeMs - a.mtimeMs);
        for (const one of archivedGuideFiles) {
            if (out.length >= limit) break;
            addPath(one.fullPath);
        }
    }
    if (!includeCandidateFiles || !modelsDir || !fs.existsSync(modelsDir)) {
        return out.slice(0, limit);
    }

    let entries = [];
    try {
        entries = fs.readdirSync(modelsDir, { withFileTypes: true });
    } catch (e) {
        return out.slice(0, limit);
    }

    const candidateFiles = entries
        .filter((entry) => entry && entry.isFile() && entry.name.startsWith('policy-table.candidate.') && entry.name.endsWith('.json'))
        .map((entry) => {
            const fullPath = path.resolve(modelsDir, entry.name);
            let mtimeMs = 0;
            try {
                mtimeMs = Number(fs.statSync(fullPath).mtimeMs) || 0;
            } catch (e) {
                mtimeMs = 0;
            }
            return { fullPath, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const one of candidateFiles) {
        if (out.length >= limit) break;
        addPath(one.fullPath);
    }
    return out.slice(0, limit);
}

function resolveAdoptionBaselineMode(args) {
    if (args && args.adoptionUseAnchorBaseline === true) return 'anchor';
    if (args && args.adoptionUseGuideBaseline === true) return 'guide';
    return 'none';
}

function shouldRunGateForIteration(args, iterationIndex) {
    if (!args || args.gateFinalIterationOnly !== true) return true;
    const totalIterations = Number.isFinite(Number(args.iterations))
        ? Math.max(1, Math.floor(Number(args.iterations)))
        : 1;
    return iterationIndex >= totalIterations;
}

function shouldRunPeriodicTraining(iterationIndex, every) {
    const safeIteration = Number.isFinite(Number(iterationIndex))
        ? Math.max(1, Math.floor(Number(iterationIndex)))
        : 1;
    const safeEvery = Number.isFinite(Number(every))
        ? Math.max(1, Math.floor(Number(every)))
        : 1;
    return ((safeIteration - 1) % safeEvery) === 0;
}

function resolveIterationGateControl(args, iterationIndex, guideModelPath, anchorModelPath) {
    const baselineMode = resolveAdoptionBaselineMode(args);
    let baselineModelPath = null;
    if (baselineMode === 'anchor' && anchorModelPath) {
        baselineModelPath = path.resolve(anchorModelPath);
    } else if (baselineMode === 'guide' && guideModelPath) {
        baselineModelPath = path.resolve(guideModelPath);
    }
    return {
        gateIterationAllowed: shouldRunGateForIteration(args, iterationIndex),
        baselineMode,
        baselineModelPath
    };
}

function getRemainingMs(deadlineMs) {
    if (!Number.isFinite(deadlineMs)) return null;
    return Math.max(0, deadlineMs - Date.now());
}

function resolveNextCarryOverState(args, carryOver, result) {
    const nextState = {
        guideModelPath: carryOver && carryOver.guideModelPath ? carryOver.guideModelPath : null,
        guideModelPoolPaths: carryOver && Array.isArray(carryOver.guideModelPoolPaths)
            ? carryOver.guideModelPoolPaths.slice()
            : [],
        resumeCheckpointPaths: resolveCarryOverResumeCheckpointPaths(carryOver),
        resumeCheckpointPath: carryOver && carryOver.resumeCheckpointPath
            ? carryOver.resumeCheckpointPath
            : getPrimaryResumeCheckpointPath(resolveCarryOverResumeCheckpointPaths(carryOver)),
        checkpointCarryOverSkipped: false
    };
    if (args.trainTargetHeadEnabled === false) {
        nextState.resumeCheckpointPaths.target = null;
    }
    if (args.trainValueHeadEnabled === false) {
        nextState.resumeCheckpointPaths.value = null;
    }
    if (!result || !result.paths) return nextState;

    const shouldAdvanceGuide = shouldAdmitCandidateGuide(args, result);
    if (result.paths.candidateModelPath && fs.existsSync(result.paths.candidateModelPath) && shouldAdvanceGuide) {
        const promotedModelPath = path.resolve(args.modelsDir, 'policy-table.json');
        nextState.guideModelPath = (result.promoted && fs.existsSync(promotedModelPath))
            ? promotedModelPath
            : result.paths.candidateModelPath;
        if (nextState.guideModelPath) {
            if (result.promoted) {
                nextState.guideModelPoolPaths = buildInitialGuideModelPoolPaths(
                    args.modelsDir,
                    nextState.guideModelPath,
                    args.selfplayPolicyModelPoolSize,
                    { includeCandidateFiles: false, includeArchiveFiles: true }
                );
            } else {
                const deduped = [nextState.guideModelPath]
                    .concat(nextState.guideModelPoolPaths.filter((one) => path.resolve(one) !== path.resolve(nextState.guideModelPath)));
                nextState.guideModelPoolPaths = deduped.slice(0, args.selfplayPolicyModelPoolSize);
            }
        }
    }

    // Guide advancement and checkpoint carry-over are intentionally decoupled:
    // some promoted-only lanes still accumulate candidate state, while others
    // keep both guide and resume checkpoint fixed until a promotion succeeds.
    const carryOverCheckpointMode = args.carryOverCheckpointMode === 'promoted-only'
        ? 'promoted-only'
        : 'always';
    const shouldCarryOverCheckpoint = !!args.carryOverCheckpoint
        && (carryOverCheckpointMode !== 'promoted-only' || !!result.promoted);
    if (!!args.carryOverCheckpoint && carryOverCheckpointMode === 'promoted-only' && !result.promoted) {
        nextState.checkpointCarryOverSkipped = true;
    }
    if (shouldCarryOverCheckpoint) {
        for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
            const checkpointPath = result.paths[spec.resultPathKey];
            if (checkpointPath && fs.existsSync(checkpointPath)) {
                nextState.resumeCheckpointPaths[spec.head] = checkpointPath;
            }
        }
        nextState.resumeCheckpointPath = getPrimaryResumeCheckpointPath(nextState.resumeCheckpointPaths);
    }

    return nextState;
}

function runIteration(args, iterationIndex, deadlineMs, carryOver) {
    const seedBank = args.seedBankPath
        ? Object.assign(loadSeedBank(args.seedBankPath), { __filePath: args.seedBankPath })
        : null;
    const seed = args.seed + ((iterationIndex - 1) * args.seedStride);
    const evalSeed = seed + args.evalSeedOffset;
    const selfplayCardUsageRate = resolveSelfplayCardUsageRateForIteration(args, iterationIndex);
    const p = buildIterationPaths(args, iterationIndex);
    const steps = [];
    const guideModelPath = carryOver && carryOver.guideModelPath ? carryOver.guideModelPath : null;
    const guideModelPoolPaths = carryOver && Array.isArray(carryOver.guideModelPoolPaths)
        ? carryOver.guideModelPoolPaths.filter((one) => !!one)
        : [];
    const resumeCheckpointPaths = resolveCarryOverResumeCheckpointPaths(carryOver);
    const policyResumeCheckpointPath = resumeCheckpointPaths.policy;
    const cardResumeCheckpointPath = resumeCheckpointPaths.card;
    const targetResumeCheckpointPath = resumeCheckpointPaths.target;
    const valueResumeCheckpointPath = resumeCheckpointPaths.value;
    const anchorModelPath = carryOver && carryOver.anchorModelPath ? carryOver.anchorModelPath : null;
    const gateControl = resolveIterationGateControl(args, iterationIndex, guideModelPath, anchorModelPath);
    const generateCardArgs = args.allowCardUsage
        ? ['--with-cards', '--card-usage-rate', String(selfplayCardUsageRate)]
        : ['--no-cards', '--card-usage-rate', '0'];
    const selfplayDeckArgs = buildDeckCodeArgs({
        blackDeckCode: args.selfplayBlackDeckCode,
        whiteDeckCode: args.selfplayWhiteDeckCode
    });
    const selfplayDiversityArgs = [
        '--policy-mix-rate', String(args.selfplayPolicyMixRate),
        '--policy-pool-sampling', String(args.selfplayPolicyPoolSampling),
        '--policy-pool-recency-decay', String(args.selfplayPolicyPoolRecencyDecay),
        '--policy-current-anchor-rate', String(args.selfplayPolicyCurrentAnchorRate),
        '--card-usage-rate-jitter', String(args.selfplayCardUsageRateJitter),
        '--tactical-weight-min', String(args.selfplayTacticalWeightMin),
        '--tactical-weight-max', String(args.selfplayTacticalWeightMax),
        '--tactical-depth-opening', String(args.selfplayTacticalDepthOpening),
        '--tactical-depth-mid', String(args.selfplayTacticalDepthMid),
        '--tactical-depth-end', String(args.selfplayTacticalDepthEnd),
        '--tactical-beam-width', String(args.selfplayTacticalBeamWidth),
        '--teacher-committee-weight-min', String(args.selfplayTeacherCommitteeWeightMin),
        '--teacher-committee-weight-max', String(args.selfplayTeacherCommitteeWeightMax),
        '--teacher-committee-consensus-bonus-min', String(args.selfplayTeacherCommitteeConsensusBonusMin),
        '--teacher-committee-consensus-bonus-max', String(args.selfplayTeacherCommitteeConsensusBonusMax),
        '--policy-score-weight-min', String(args.selfplayPolicyScoreWeightMin),
        '--policy-score-weight-max', String(args.selfplayPolicyScoreWeightMax),
        '--heuristic-weight-min', String(args.selfplayHeuristicWeightMin),
        '--heuristic-weight-max', String(args.selfplayHeuristicWeightMax)
    ];
    const guideModelArgs = [];
    if (guideModelPath) {
        guideModelArgs.push('--policy-model', guideModelPath);
    }
    if (guideModelPoolPaths.length > 0) {
        guideModelArgs.push('--policy-model-pool', guideModelPoolPaths.join(','));
    }
    const adoptionBaselineArgs = gateControl.baselineModelPath
        ? ['--baseline-model', gateControl.baselineModelPath]
        : [];
    const verboseArgs = args.verbose ? ['--verbose'] : [];
    const selfplayResumeArgs = args.selfplayResumeChunkSize > 0
        ? ['--resume-chunk-size', String(args.selfplayResumeChunkSize)]
        : [];
    const adoptionCardRate = selfplayCardUsageRate;
    const quickAdoptionThreshold = Number.isFinite(args.quickAdoptionThreshold) ? args.quickAdoptionThreshold : args.threshold;
    const quickAdoptionSeedCount = Number.isFinite(args.quickAdoptionSeedCount) ? args.quickAdoptionSeedCount : args.adoptionSeedCount;
    const quickAdoptionSeedStride = Number.isFinite(args.quickAdoptionSeedStride) ? args.quickAdoptionSeedStride : args.adoptionSeedStride;
    const quickAdoptionConfidenceLevel = Number.isFinite(args.quickAdoptionConfidenceLevel) ? args.quickAdoptionConfidenceLevel : args.adoptionConfidenceLevel;
    const quickAdoptionMinLowerBound = Number.isFinite(args.quickAdoptionMinLowerBound) ? args.quickAdoptionMinLowerBound : args.adoptionMinLowerBound;
    const quickAdoptionMinSeedUplift = Number.isFinite(args.quickAdoptionMinSeedUplift) ? args.quickAdoptionMinSeedUplift : args.adoptionMinSeedUplift;
    const quickAdoptionMinSeedPassCount = Number.isFinite(args.quickAdoptionMinSeedPassCount) ? args.quickAdoptionMinSeedPassCount : args.adoptionMinSeedPassCount;
    const finalAdoptionThreshold = Number.isFinite(args.finalAdoptionThreshold) ? args.finalAdoptionThreshold : args.threshold;
    const finalAdoptionSeedCount = Number.isFinite(args.finalAdoptionSeedCount) ? args.finalAdoptionSeedCount : args.adoptionSeedCount;
    const finalAdoptionSeedStride = Number.isFinite(args.finalAdoptionSeedStride) ? args.finalAdoptionSeedStride : args.adoptionSeedStride;
    const finalAdoptionConfidenceLevel = Number.isFinite(args.finalAdoptionConfidenceLevel) ? args.finalAdoptionConfidenceLevel : args.adoptionConfidenceLevel;
    const finalAdoptionMinLowerBound = Number.isFinite(args.finalAdoptionMinLowerBound) ? args.finalAdoptionMinLowerBound : args.adoptionMinLowerBound;
    const finalAdoptionMinSeedUplift = Number.isFinite(args.finalAdoptionMinSeedUplift) ? args.finalAdoptionMinSeedUplift : args.adoptionMinSeedUplift;
    const finalAdoptionMinSeedPassCount = Number.isFinite(args.finalAdoptionMinSeedPassCount) ? args.finalAdoptionMinSeedPassCount : args.adoptionMinSeedPassCount;
    const quickGateSeedConfig = resolveGateSeedConfig(seedBank, 'quick', {
        seed: seed + args.quickAdoptionSeedOffset,
        seedCount: quickAdoptionSeedCount,
        seedStride: quickAdoptionSeedStride,
        seedList: buildSeedList(seed + args.quickAdoptionSeedOffset, quickAdoptionSeedCount, quickAdoptionSeedStride)
    });
    const qualityGateSeedConfig = resolveGateSeedConfig(seedBank, 'quality', {
        seed: seed + args.qualityGateSeedOffset,
        seedCount: args.qualityGateSeedCount,
        seedStride: args.qualityGateSeedStride,
        seedList: buildSeedList(seed + args.qualityGateSeedOffset, args.qualityGateSeedCount, args.qualityGateSeedStride)
    });
    const finalGateSeedConfig = resolveGateSeedConfig(seedBank, 'final', {
        seed: seed + args.adoptionFinalSeedOffset,
        seedCount: finalAdoptionSeedCount,
        seedStride: finalAdoptionSeedStride,
        seedList: buildSeedList(seed + args.adoptionFinalSeedOffset, finalAdoptionSeedCount, finalAdoptionSeedStride)
    });
    const onnxGateSeedConfig = resolveGateSeedConfig(seedBank, 'onnx', {
        seed: seed + args.onnxGateSeedOffset,
        seedCount: args.onnxGateSeedCount,
        seedStride: args.onnxGateSeedStride,
        seedList: buildSeedList(seed + args.onnxGateSeedOffset, args.onnxGateSeedCount, args.onnxGateSeedStride)
    });
    const quickAdoptionSeed = quickGateSeedConfig.seed;
    const quickAdoptionSeeds = quickGateSeedConfig.seedList;
    const qualityGateSeed = qualityGateSeedConfig.seed;
    const qualityGateSeeds = qualityGateSeedConfig.seedList;
    const finalAdoptionSeed = finalGateSeedConfig.seed;
    const finalAdoptionSeeds = finalGateSeedConfig.seedList;
    const onnxGateSeed = onnxGateSeedConfig.seed;
    const onnxGateSeeds = onnxGateSeedConfig.seedList;

    fs.mkdirSync(args.runsDir, { recursive: true });
    fs.mkdirSync(args.modelsDir, { recursive: true });

    const runStep = (name, cmd, stepArgs, options) => {
        const remainingMs = getRemainingMs(deadlineMs);
        if (Number.isFinite(remainingMs) && remainingMs <= 0) {
            const err = new Error(`time budget exceeded before ${name}`);
            err.code = 'TIME_BUDGET_EXCEEDED';
            throw err;
        }
        try {
            const result = runCommand(cmd, stepArgs, Object.assign({}, options || {}, {
                timeoutMs: Number.isFinite(remainingMs) ? remainingMs : undefined
            }));
            steps.push({ name, ...result });
            return result;
        } catch (error) {
            throw annotateTrainingCycleError(error, {
                iteration: iterationIndex,
                step: name,
                runTag: args.runTag,
                iterationTag: p.tag,
                summaryOut: args.summaryOut,
                stepOutputs: options && Array.isArray(options.reuseOutputs) ? options.reuseOutputs : []
            });
        }
    };

    const runManagedStep = (name, cmd, stepArgs, options) => {
        const reuseOutputs = options && Array.isArray(options.reuseOutputs)
            ? options.reuseOutputs.filter((one) => !!one)
            : [];
        if (shouldReuseStepArtifacts(args, name) && reuseOutputs.length > 0 && reuseOutputs.every(fileExists)) {
            console.log(`[training-cycle] reuse ${name}: ${reuseOutputs.map((one) => path.basename(one)).join(', ')}`);
            const reusedResult = { status: 0, elapsedMs: 0, reused: true };
            steps.push({ name, ...reusedResult });
            return reusedResult;
        }
        return runStep(name, cmd, stepArgs, options);
    };
    const recordSkippedStep = (name, reason, extra) => {
        const result = Object.assign({
            name,
            status: 0,
            elapsedMs: 0,
            skipped: true,
            reason
        }, extra || {});
        steps.push(result);
        return result;
    };

    runManagedStep('generate-train', process.execPath, buildGenerateSelfplayDataArgs({
        games: args.trainGames,
        seed,
        maxPlies: args.maxPlies,
        outPath: p.trainDataPath,
        hardcaseOutPath: p.trainHardcaseDataPath,
        seedFamily: 'train',
        dataLane: 'train-main',
        selfplayJobs: args.selfplayJobs,
        generateCardArgs,
        selfplayDeckArgs,
        selfplayDiversityArgs,
        guideModelArgs,
        selfplayResumeArgs,
        reuseCompletedChunks: shouldReuseStepArtifacts(args, 'generate-train'),
        verboseArgs
    }), {
        reuseOutputs: [p.trainDataPath, p.trainHardcaseDataPath, p.trainDataSummaryPath]
    });

    runManagedStep('generate-eval', process.execPath, buildGenerateSelfplayDataArgs({
        games: args.evalGames,
        seed: evalSeed,
        maxPlies: args.maxPlies,
        outPath: p.evalDataPath,
        hardcaseOutPath: p.evalHardcaseDataPath,
        seedFamily: 'eval',
        dataLane: 'eval-suite',
        selfplayJobs: args.selfplayJobs,
        generateCardArgs,
        selfplayDeckArgs,
        selfplayDiversityArgs,
        guideModelArgs,
        selfplayResumeArgs,
        reuseCompletedChunks: shouldReuseStepArtifacts(args, 'generate-eval'),
        verboseArgs
    }), {
        reuseOutputs: [p.evalDataPath, p.evalHardcaseDataPath, p.evalDataSummaryPath]
    });

    runManagedStep('train-policy', args.pythonPath, buildPolicyTrainingCommandArgs({
        args,
        iterationPaths: p,
        resumeCheckpointPath: policyResumeCheckpointPath
    }), {
        reuseOutputs: [p.onnxModelPath, p.onnxMetaPath, p.candidateModelPath]
    });

    runManagedStep('evaluate-policy', args.pythonPath, [
        path.resolve('ai', 'train', 'evaluate_policy_table.py'),
        '--input', p.evalDataPath,
        '--model', p.candidateModelPath
    ], {
        reuseOutputs: [p.candidateModelPath]
    });

    const trainCardThisIteration = args.allowCardUsage && shouldRunPeriodicTraining(iterationIndex, args.trainCardEvery);
    if (args.allowCardUsage) {
        if (trainCardThisIteration) {
            runManagedStep('train-card-policy', args.pythonPath, buildCardTrainingCommandArgs({
                args,
                iterationPaths: p,
                resumeCheckpointPath: cardResumeCheckpointPath
            }), {
                reuseOutputs: [p.cardOnnxModelPath, p.cardOnnxMetaPath]
            });
        } else {
            console.log(`[training-cycle] skip train-card-policy iteration=${iterationIndex} cadence_every=${args.trainCardEvery}`);
            recordSkippedStep('train-card-policy', 'cadence', { every: args.trainCardEvery });
        }
    }

    const hasTargetTrainingData = args.trainTargetHeadEnabled !== false
        && args.allowCardUsage
        && hasCoordinatePendingSelectionRecords(p.trainDataPath);
    const trainTargetThisIteration = hasTargetTrainingData && shouldRunPeriodicTraining(iterationIndex, args.trainTargetEvery);
    if (args.trainTargetHeadEnabled === false) {
        console.log(`[training-cycle] skip train-target-policy iteration=${iterationIndex} reason=disabled`);
        recordSkippedStep('train-target-policy', 'disabled', { trainTargetHeadEnabled: false });
    } else if (hasTargetTrainingData) {
        if (trainTargetThisIteration) {
            runManagedStep('train-target-policy', args.pythonPath, buildTargetTrainingCommandArgs({
                args,
                iterationPaths: p,
                resumeCheckpointPath: targetResumeCheckpointPath
            }), {
                reuseOutputs: [p.targetOnnxModelPath, p.targetOnnxMetaPath]
            });
        } else {
            console.log(`[training-cycle] skip train-target-policy iteration=${iterationIndex} cadence_every=${args.trainTargetEvery}`);
            recordSkippedStep('train-target-policy', 'cadence', { every: args.trainTargetEvery });
        }
    }

    const trainValueThisIteration = shouldRunPeriodicTraining(iterationIndex, args.trainValueEvery);
    if (args.trainValueHeadEnabled === false) {
        console.log(`[training-cycle] skip train-value-policy iteration=${iterationIndex} reason=disabled`);
        recordSkippedStep('train-value-policy', 'disabled', { trainValueHeadEnabled: false });
    } else if (trainValueThisIteration) {
        runManagedStep('train-value-policy', args.pythonPath, buildValueTrainingCommandArgs({
            args,
            iterationPaths: p,
            resumeCheckpointPath: valueResumeCheckpointPath
        }), {
            reuseOutputs: [p.valueOnnxModelPath, p.valueOnnxMetaPath]
        });
    } else {
        console.log(`[training-cycle] skip train-value-policy iteration=${iterationIndex} cadence_every=${args.trainValueEvery}`);
        recordSkippedStep('train-value-policy', 'cadence', { every: args.trainValueEvery });
    }

    let quickPayload = null;
    let quickPassed = false;
    let quickDecision = null;
    let quickUplift = Number.NEGATIVE_INFINITY;
    let quickUpliftLowerBound = Number.NEGATIVE_INFINITY;
    let quickRegressionWithinOnnxPrimaryLimit = false;
    let quickCoreDelta = Number.NEGATIVE_INFINITY;
    let quickWhiteDelta = Number.NEGATIVE_INFINITY;
    let quickQualityDelta = Number.NEGATIVE_INFINITY;
    let quickNonRegressionWithinOnnxPrimaryLimit = false;
    let qualityGatePayload = null;
    let qualityGatePassed = !args.qualityGateEnabled;
    let finalPayload = null;
    let finalPassed = false;
    let onnxGatePayload = null;
    let onnxGatePassed = !args.onnxGateEnabled;

    if (gateControl.gateIterationAllowed) {
        const quickStep = runManagedStep('adoption-quick', process.execPath, buildQuickAdoptionCommandArgs({
            args,
            iterationPaths: p,
            quickConfig: {
                seed: quickAdoptionSeed,
                seedCount: quickGateSeedConfig.seedCount,
                seedStride: quickGateSeedConfig.seedStride,
                threshold: quickAdoptionThreshold,
                confidenceLevel: quickAdoptionConfidenceLevel,
                minLowerBound: quickAdoptionMinLowerBound,
                minSeedUplift: quickAdoptionMinSeedUplift,
                minSeedPassCount: quickAdoptionMinSeedPassCount
            },
            adoptionCardRate,
            adoptionBaselineArgs,
            verboseArgs
        }), {
            allowExitCodes: [0, 2],
            reuseOutputs: [p.quickAdoptionPath]
        });
        recordSeedBankGateUsage(seedBank, 'quick', p.quickAdoptionPath, iterationIndex, args.runTag, !!quickStep.reused);
        quickPayload = readJsonSafe(p.quickAdoptionPath);
        quickPassed = !!(quickPayload && quickPayload.decision && quickPayload.decision.passed);
        quickDecision = quickPayload && quickPayload.decision ? quickPayload.decision : null;
        quickUplift = quickDecision && Number.isFinite(quickDecision.uplift)
            ? Number(quickDecision.uplift)
            : Number.NEGATIVE_INFINITY;
        quickUpliftLowerBound = quickDecision && Number.isFinite(quickDecision.upliftLowerBound)
            ? Number(quickDecision.upliftLowerBound)
            : Number.NEGATIVE_INFINITY;
        quickRegressionWithinOnnxPrimaryLimit = quickUplift >= (-args.onnxPrimaryMaxQuickRegression);
        quickCoreDelta = resolveQuickComponentDelta(
            quickPayload,
            quickDecision,
            'baselineCoreScore',
            'candidateCoreScore'
        );
        quickWhiteDelta = resolveQuickComponentDelta(
            quickPayload,
            quickDecision,
            'baselineWhiteScore',
            'candidateWhiteScore'
        );
        quickQualityDelta = resolveQuickComponentDelta(
            quickPayload,
            quickDecision,
            'baselineQualityScore',
            'candidateQualityScore'
        );
        quickNonRegressionWithinOnnxPrimaryLimit =
            quickCoreDelta >= args.onnxPrimaryMinQuickCoreDelta &&
            quickWhiteDelta >= args.onnxPrimaryMinQuickWhiteDelta &&
            quickQualityDelta >= args.onnxPrimaryMinQuickQualityDelta;

        qualityGatePassed = !args.qualityGateEnabled;
        if (quickPassed && args.qualityGateEnabled) {
            const qualityStep = runManagedStep('adoption-quality-gate', process.execPath, buildQualityGateCommandArgs({
                args,
                iterationPaths: p,
                qualityConfig: {
                    seed: qualityGateSeed,
                    seedCount: qualityGateSeedConfig.seedCount,
                    seedStride: qualityGateSeedConfig.seedStride
                },
                adoptionCardRate,
                adoptionBaselineArgs,
                verboseArgs
            }), {
                allowExitCodes: [0, 2],
                reuseOutputs: [p.qualityGatePath]
            });
            recordSeedBankGateUsage(seedBank, 'quality', p.qualityGatePath, iterationIndex, args.runTag, !!qualityStep.reused);
            qualityGatePayload = readJsonSafe(p.qualityGatePath);
            qualityGatePassed = !!(qualityGatePayload && qualityGatePayload.decision && qualityGatePayload.decision.passed);
        }

        const shouldRunFinalAdoption = quickPassed && qualityGatePassed && args.promotionMode === 'strict';
        if (shouldRunFinalAdoption) {
            const finalStep = runManagedStep('adoption-final', process.execPath, buildFinalAdoptionCommandArgs({
                args,
                iterationPaths: p,
                finalConfig: {
                    seed: finalAdoptionSeed,
                    seedCount: finalGateSeedConfig.seedCount,
                    seedStride: finalGateSeedConfig.seedStride,
                    threshold: finalAdoptionThreshold,
                    confidenceLevel: finalAdoptionConfidenceLevel,
                    minLowerBound: finalAdoptionMinLowerBound,
                    minSeedUplift: finalAdoptionMinSeedUplift,
                    minSeedPassCount: finalAdoptionMinSeedPassCount
                },
                adoptionCardRate,
                adoptionBaselineArgs,
                verboseArgs
            }), {
                allowExitCodes: [0, 2],
                reuseOutputs: [p.finalAdoptionPath]
            });
            recordSeedBankGateUsage(seedBank, 'final', p.finalAdoptionPath, iterationIndex, args.runTag, !!finalStep.reused);
            finalPayload = readJsonSafe(p.finalAdoptionPath);
            finalPassed = !!(finalPayload && finalPayload.decision && finalPayload.decision.passed);
        }

        onnxGatePassed = !args.onnxGateEnabled;
        const shouldRunOnnxGate = args.onnxGateEnabled && qualityGatePassed && (finalPassed || args.promotionMode === 'onnx-primary');
        if (shouldRunOnnxGate) {
            const onnxStep = runManagedStep('adoption-onnx-gate', process.execPath, buildOnnxGateCommandArgs({
                args,
                iterationPaths: p,
                hasTargetTrainingData,
                onnxConfig: {
                    seed: onnxGateSeed,
                    seedCount: onnxGateSeedConfig.seedCount,
                    seedStride: onnxGateSeedConfig.seedStride
                }
            }), {
                allowExitCodes: [0, 2],
                reuseOutputs: [p.onnxGatePath]
            });
            recordSeedBankGateUsage(seedBank, 'onnx', p.onnxGatePath, iterationIndex, args.runTag, !!onnxStep.reused);
            onnxGatePayload = readJsonSafe(p.onnxGatePath);
            onnxGatePassed = !!(onnxGatePayload && onnxGatePayload.decision && onnxGatePayload.decision.passed);
        }
    }

    const onnxGateDecision = onnxGatePayload && onnxGatePayload.decision ? onnxGatePayload.decision : null;
    const promotionEligibility = resolvePromotionEligibility(args, {
        quickPassed,
        qualityGatePassed,
        finalPassed,
        onnxGatePassed,
        quickRegressionWithinOnnxPrimaryLimit,
        quickNonRegressionWithinOnnxPrimaryLimit,
        quickUplift,
        quickUpliftLowerBound,
        onnxGateDecision
    });
    const promoteEligible = promotionEligibility.promoteEligible;
    const strictPromoteEligible = promotionEligibility.strictPromoteEligible;
    const onnxPrimaryPromoteEligible = promotionEligibility.onnxPrimaryPromoteEligible;
    const quickOnlyPromoteEligible = promotionEligibility.quickOnlyPromoteEligible;
    const onnxPrimaryQuickGuardPassed = promotionEligibility.onnxPrimaryQuickGuardPassed;
    const onnxPrimaryQuickNonRegressionGuardPassed = promotionEligibility.onnxPrimaryQuickNonRegressionGuardPassed;
    const onnxPrimaryQuickUpliftGuardPassed = promotionEligibility.onnxPrimaryQuickUpliftGuardPassed;
    const onnxPrimaryQuickLowerBoundGuardPassed = promotionEligibility.onnxPrimaryQuickLowerBoundGuardPassed;
    const onnxPrimaryOnnxGateAvgGuardPassed = promotionEligibility.onnxPrimaryOnnxGateAvgGuardPassed;
    const onnxPrimaryOnnxGateMinSeedGuardPassed = promotionEligibility.onnxPrimaryOnnxGateMinSeedGuardPassed;
    const onnxGateAverageScore = promotionEligibility.onnxGateAverageScore;
    const onnxGateMinSeedScore = promotionEligibility.onnxGateMinSeedScore;

    let promoted = false;
    if (promoteEligible && args.promoteOnPass) {
        const adoptionResultPath = (args.promotionMode !== 'strict' && !finalPassed)
            ? p.quickAdoptionPath
            : p.finalAdoptionPath;
        const promoteArgs = buildPromotionCommandArgs(args, p, adoptionResultPath, hasTargetTrainingData);
        if (args.promotionMode === 'onnx-primary' && !finalPassed) {
            promoteArgs.push('--force');
        }
        runStep('promote-model', process.execPath, promoteArgs);
        promoted = true;
    }

    const iterationResult = {
        iteration: iterationIndex,
        seed,
        quickAdoptionSeed,
        qualityGateSeed,
        finalAdoptionSeed,
        onnxGateSeed,
        evalSeed,
        usedGuideModelPath: guideModelPath,
        usedGuideModelPoolPaths: guideModelPoolPaths,
        usedResumeCheckpointPath: policyResumeCheckpointPath,
        usedResumeCheckpointPaths: cloneResumeCheckpointPaths(resumeCheckpointPaths),
        usedAnchorModelPath: anchorModelPath,
        seedBankPath: args.seedBankPath,
        seedBankId: seedBank && seedBank.bankId ? seedBank.bankId : null,
        usedSelfplayCardUsageRate: selfplayCardUsageRate,
        gateControl,
        paths: p,
        quickAdoptionConfig: {
            seed: quickAdoptionSeed,
            seedOffset: args.quickAdoptionSeedOffset,
            seedList: quickAdoptionSeeds,
            seedSource: quickGateSeedConfig.source,
            seedBankId: quickGateSeedConfig.bankId,
            seedBankPath: quickGateSeedConfig.bankPath,
            seedPurpose: quickGateSeedConfig.purpose,
            cardUsageRate: adoptionCardRate,
            threshold: quickAdoptionThreshold,
            tacticalWeight: args.adoptionTacticalWeight,
            seedCount: quickAdoptionSeedCount,
            seedStride: quickAdoptionSeedStride,
            confidenceLevel: quickAdoptionConfidenceLevel,
            minLowerBound: quickAdoptionMinLowerBound,
            minSeedUplift: quickAdoptionMinSeedUplift,
            minSeedPassCount: quickAdoptionMinSeedPassCount
        },
        qualityGateConfig: {
            enabled: args.qualityGateEnabled,
            games: args.qualityGateGames,
            seed: qualityGateSeed,
            seedOffset: args.qualityGateSeedOffset,
            seedCount: args.qualityGateSeedCount,
            seedStride: args.qualityGateSeedStride,
            seedList: qualityGateSeeds,
            seedSource: qualityGateSeedConfig.source,
            seedBankId: qualityGateSeedConfig.bankId,
            seedBankPath: qualityGateSeedConfig.bankPath,
            seedPurpose: qualityGateSeedConfig.purpose,
            cardUsageRate: adoptionCardRate,
            threshold: args.qualityGateThreshold,
            tacticalWeight: args.adoptionTacticalWeight,
            confidenceLevel: args.qualityGateConfidenceLevel,
            minLowerBound: args.qualityGateMinLowerBound,
            minSeedUplift: args.qualityGateMinSeedUplift,
            minSeedPassCount: args.qualityGateMinSeedPassCount,
            strengthFirst: args.qualityGateStrengthFirst
        },
        finalAdoptionConfig: {
            seed: finalAdoptionSeed,
            seedOffset: args.adoptionFinalSeedOffset,
            seedList: finalAdoptionSeeds,
            seedSource: finalGateSeedConfig.source,
            seedBankId: finalGateSeedConfig.bankId,
            seedBankPath: finalGateSeedConfig.bankPath,
            seedPurpose: finalGateSeedConfig.purpose,
            cardUsageRate: adoptionCardRate,
            threshold: finalAdoptionThreshold,
            tacticalWeight: args.adoptionTacticalWeight,
            seedCount: finalAdoptionSeedCount,
            seedStride: finalAdoptionSeedStride,
            confidenceLevel: finalAdoptionConfidenceLevel,
            minLowerBound: finalAdoptionMinLowerBound,
            minSeedUplift: finalAdoptionMinSeedUplift,
            minSeedPassCount: finalAdoptionMinSeedPassCount
        },
        onnxGateConfig: {
            enabled: args.onnxGateEnabled,
            games: args.onnxGateGames,
            seed: onnxGateSeed,
            seedOffset: args.onnxGateSeedOffset,
            seedCount: args.onnxGateSeedCount,
            seedStride: args.onnxGateSeedStride,
            seedList: onnxGateSeeds,
            seedSource: onnxGateSeedConfig.source,
            seedBankId: onnxGateSeedConfig.bankId,
            seedBankPath: onnxGateSeedConfig.bankPath,
            seedPurpose: onnxGateSeedConfig.purpose,
            threshold: args.onnxGateThreshold,
            minSeedScore: args.onnxGateMinSeedScore,
            minSeedPassCount: args.onnxGateMinSeedPassCount,
            maxAverageLatencyMs: args.onnxGateMaxAverageLatencyMs,
            maxP95LatencyMs: args.onnxGateMaxP95LatencyMs,
            maxMaxLatencyMs: args.onnxGateMaxMaxLatencyMs,
            blackLevel: args.onnxGateBlackLevel,
            whiteLevel: args.onnxGateWhiteLevel,
            candidateColorMode: args.onnxGateCandidateColorMode
        },
        quickDecision,
        qualityGateDecision: qualityGatePayload && qualityGatePayload.decision ? qualityGatePayload.decision : null,
        finalDecision: finalPayload && finalPayload.decision ? finalPayload.decision : null,
        onnxGateDecision: onnxGatePayload && onnxGatePayload.decision ? onnxGatePayload.decision : null,
        hasTargetTrainingData,
        specialistTraining: {
            card: {
                enabled: args.allowCardUsage,
                every: args.trainCardEvery,
                executed: trainCardThisIteration
            },
            target: {
                enabled: args.trainTargetHeadEnabled !== false,
                dataAvailable: hasTargetTrainingData,
                every: args.trainTargetEvery,
                executed: args.trainTargetHeadEnabled !== false && trainTargetThisIteration
            },
            value: {
                enabled: args.trainValueHeadEnabled !== false,
                every: args.trainValueEvery,
                executed: args.trainValueHeadEnabled !== false && trainValueThisIteration
            }
        },
        promotionDetail: {
            mode: args.promotionMode,
            promoteEligible,
            strictPromoteEligible,
            onnxPrimaryPromoteEligible,
            quickOnlyPromoteEligible,
            gateIterationAllowed: gateControl.gateIterationAllowed,
            qualityGateEnabled: args.qualityGateEnabled,
            qualityGatePassed,
            quickUplift,
            onnxPrimaryMaxQuickRegression: args.onnxPrimaryMaxQuickRegression,
            onnxPrimaryRequireQuickRegression: args.onnxPrimaryRequireQuickRegression,
            onnxPrimaryRequireQuickNonRegression: args.onnxPrimaryRequireQuickNonRegression,
            onnxPrimaryMinQuickCoreDelta: args.onnxPrimaryMinQuickCoreDelta,
            onnxPrimaryMinQuickWhiteDelta: args.onnxPrimaryMinQuickWhiteDelta,
            onnxPrimaryMinQuickQualityDelta: args.onnxPrimaryMinQuickQualityDelta,
            onnxPrimaryMinQuickUplift: args.onnxPrimaryMinQuickUplift,
            onnxPrimaryMinQuickLowerBound: args.onnxPrimaryMinQuickLowerBound,
            onnxPrimaryMinOnnxGateAvg: args.onnxPrimaryMinOnnxGateAvg,
            onnxPrimaryMinOnnxGateMinSeed: args.onnxPrimaryMinOnnxGateMinSeed,
            onnxPrimaryQuickGuardPassed,
            quickRegressionWithinOnnxPrimaryLimit,
            onnxPrimaryQuickNonRegressionGuardPassed,
            onnxPrimaryQuickUpliftGuardPassed,
            onnxPrimaryQuickLowerBoundGuardPassed,
            onnxPrimaryOnnxGateAvgGuardPassed,
            onnxPrimaryOnnxGateMinSeedGuardPassed,
            quickCoreDelta,
            quickWhiteDelta,
            quickQualityDelta,
            quickNonRegressionWithinOnnxPrimaryLimit,
            quickUpliftLowerBound,
            onnxGateAverageScore,
            onnxGateMinSeedScore
        },
        promoted,
        warehouseManifest: {
            schemaVersion: TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION,
            path: p.warehouseManifestPath
        },
        steps
    };
    const warehouseManifest = buildIterationWarehouseManifest(args, iterationResult);
    writeTrainingWarehouseManifest(p.warehouseManifestPath, warehouseManifest);
    return iterationResult;
}

function main() {
    const args = parseSelfplayTrainingCycleArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    console.log(`[training-cycle] selfplay guide update mode=${describeSelfplayGuideUpdateMode(args)}`);
    console.log(`[training-cycle] adoption baseline mode=${resolveAdoptionBaselineMode(args)} gate_final_iteration_only=${args.gateFinalIterationOnly ? 'on' : 'off'}`);
    console.log(`[training-cycle] reuse existing artifacts=${args.reuseExistingArtifacts ? 'on' : 'off'}`);
    console.log(`[training-cycle] target head=${args.trainTargetHeadEnabled ? 'on' : 'off'} cadence_every=${args.trainTargetEvery}`);
    console.log(`[training-cycle] value head=${args.trainValueHeadEnabled ? 'on' : 'off'} cadence_every=${args.trainValueEvery}`);
    if (args.restartFromStep) {
        console.log(`[training-cycle] restart from step=${args.restartFromStep}`);
    }
    console.log(
        `[training-cycle] promotion mode=${args.promotionMode} ` +
        `onnx_primary_max_quick_regression=${args.onnxPrimaryMaxQuickRegression} ` +
        `onnx_primary_require_quick_regression=${args.onnxPrimaryRequireQuickRegression} ` +
        `onnx_primary_require_quick_non_regression=${args.onnxPrimaryRequireQuickNonRegression} ` +
        `onnx_primary_min_quick_core_delta=${args.onnxPrimaryMinQuickCoreDelta} ` +
        `onnx_primary_min_quick_white_delta=${args.onnxPrimaryMinQuickWhiteDelta} ` +
        `onnx_primary_min_quick_quality_delta=${args.onnxPrimaryMinQuickQualityDelta} ` +
        `onnx_primary_min_quick_uplift=${args.onnxPrimaryMinQuickUplift} ` +
        `onnx_primary_min_quick_lower_bound=${args.onnxPrimaryMinQuickLowerBound} ` +
        `onnx_primary_min_onnx_gate_avg=${args.onnxPrimaryMinOnnxGateAvg} ` +
        `onnx_primary_min_onnx_gate_min_seed=${args.onnxPrimaryMinOnnxGateMinSeed}`
    );
    const warehouseCleanup = cleanupWarehouseSelfplayArtifacts(args.runsDir);
    if (warehouseCleanup.removed.length > 0) {
        console.log(
            `[training-cycle] cleaned historical selfplay artifacts=${warehouseCleanup.removed.length} ` +
            `reclaimed=${warehouseCleanup.totalBytesRemovedHuman}`
        );
    }
    if (warehouseCleanup.failed.length > 0) {
        for (const failure of warehouseCleanup.failed) {
            console.warn(`[training-cycle] cleanup warning path=${failure.path} error=${failure.error}`);
        }
    }

    const startedAt = Date.now();
    const deadlineMs = args.maxHours > 0
        ? startedAt + Math.floor(args.maxHours * 60 * 60 * 1000)
        : null;
    const iterations = [];
    let startIteration = 1;
    let guideModelPath = args.bootstrapPolicyModelPath || null;
    let guideModelPoolPaths = buildInitialGuideModelPoolPaths(
        args.modelsDir,
        guideModelPath,
        args.selfplayPolicyModelPoolSize,
        {
            includeCandidateFiles: shouldIncludeCandidateFilesAtStartup(args),
            includeArchiveFiles: args.selfplayCandidateAdmission === 'promoted-only'
        }
    );
    let resumeCheckpointPaths = cloneResumeCheckpointPaths(args.resumeCheckpointPaths);
    let anchorModelPath = guideModelPath || null;
    if (args.summaryOut && fs.existsSync(args.summaryOut)) {
        try {
            const existingSummary = JSON.parse(fs.readFileSync(args.summaryOut, 'utf8'));
            const summaryRunTag = existingSummary && existingSummary.config && typeof existingSummary.config.runTag === 'string'
                ? existingSummary.config.runTag
                : null;
            const existingIterations = Array.isArray(existingSummary && existingSummary.iterations)
                ? existingSummary.iterations
                : [];
            if (summaryRunTag === args.runTag && existingIterations.length > 0) {
                iterations.push(...existingIterations);
                const lastIteration = Number(existingIterations[existingIterations.length - 1] && existingIterations[existingIterations.length - 1].iteration);
                startIteration = Number.isFinite(lastIteration) && lastIteration >= 1
                    ? Math.floor(lastIteration) + 1
                    : existingIterations.length + 1;
                if (existingSummary.latestGuideModelPath) {
                    guideModelPath = existingSummary.latestGuideModelPath;
                }
                if (Array.isArray(existingSummary.latestGuideModelPoolPaths) && existingSummary.latestGuideModelPoolPaths.length > 0) {
                    guideModelPoolPaths = existingSummary.latestGuideModelPoolPaths.slice();
                }
                resumeCheckpointPaths = resolveCarryOverResumeCheckpointPaths({
                    resumeCheckpointPaths: existingSummary.latestResumeCheckpointPaths || existingSummary.resumeCheckpointPaths || null,
                    resumeCheckpointPath: existingSummary.latestResumeCheckpointPath || null
                });
                if (existingSummary.latestAnchorModelPath) {
                    anchorModelPath = existingSummary.latestAnchorModelPath;
                }
                if (!args.restartFromStep && existingSummary.failure && typeof existingSummary.failure.step === 'string') {
                    args.restartFromStep = existingSummary.failure.step;
                }
                console.log(`[training-cycle] resumed summary=${args.summaryOut} start_iteration=${startIteration}`);
            }
        } catch (err) {
            console.warn(`[training-cycle] resume summary load failed path=${args.summaryOut} error=${err && err.message ? err.message : err}`);
        }
    }
    if (resolveAdoptionBaselineMode(args) === 'anchor' && !anchorModelPath) {
        throw new Error('--adoption-use-anchor-baseline requires an initial bootstrap policy model');
    }
    let stoppedByTimeBudget = false;
    let stopReason = null;
    let failureDetail = null;
    for (let i = startIteration; i <= args.iterations; i++) {
        const remainingMs = getRemainingMs(deadlineMs);
        if (remainingMs !== null && remainingMs <= 0) {
            stoppedByTimeBudget = true;
            stopReason = `time budget reached before iteration ${i}`;
            break;
        }
        console.log(`[training-cycle] iteration ${i}/${args.iterations} start`);
        let result = null;
        try {
            result = runIteration(args, i, deadlineMs, {
                guideModelPath,
                guideModelPoolPaths,
                resumeCheckpointPaths,
                anchorModelPath
            });
        } catch (err) {
            if (err && (err.code === 'TIME_BUDGET_EXCEEDED' || err.code === 'COMMAND_TIMEOUT')) {
                stoppedByTimeBudget = true;
                stopReason = err.message || 'time budget reached';
                break;
            }
            failureDetail = extractTrainingCycleFailureDetail(err, {
                iteration: i,
                runTag: args.runTag,
                summaryOut: args.summaryOut
            });
            writeSummarySnapshot(
                args,
                startedAt,
                iterations,
                guideModelPath,
                guideModelPoolPaths,
                resumeCheckpointPaths,
                anchorModelPath,
                stoppedByTimeBudget,
                stopReason,
                failureDetail
            );
            throw err;
        }
        iterations.push(result);
        const finalPassed = !!(result.finalDecision && result.finalDecision.passed);
        const qualityGatePassed = result.qualityGateDecision ? !!result.qualityGateDecision.passed : !args.qualityGateEnabled;
        const onnxGatePassed = result.onnxGateDecision ? !!result.onnxGateDecision.passed : !args.onnxGateEnabled;
        const promoteEligible = !!(result.promotionDetail && result.promotionDetail.promoteEligible);
        const quickUplift = (result.promotionDetail && Number.isFinite(result.promotionDetail.quickUplift))
            ? result.promotionDetail.quickUplift
            : Number.NaN;
        const quickCoreDelta = (result.promotionDetail && Number.isFinite(result.promotionDetail.quickCoreDelta))
            ? result.promotionDetail.quickCoreDelta
            : Number.NaN;
        const quickWhiteDelta = (result.promotionDetail && Number.isFinite(result.promotionDetail.quickWhiteDelta))
            ? result.promotionDetail.quickWhiteDelta
            : Number.NaN;
        const quickQualityDelta = (result.promotionDetail && Number.isFinite(result.promotionDetail.quickQualityDelta))
            ? result.promotionDetail.quickQualityDelta
            : Number.NaN;
        const quickNonRegressionGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryQuickNonRegressionGuardPassed
        );
        const quickUpliftGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryQuickUpliftGuardPassed
        );
        const quickLowerBoundGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryQuickLowerBoundGuardPassed
        );
        const gateAvgGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryOnnxGateAvgGuardPassed
        );
        const gateMinSeedGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryOnnxGateMinSeedGuardPassed
        );
        if (result && result.paths) {
            const nextCarryOverState = resolveNextCarryOverState(args, {
                guideModelPath,
                guideModelPoolPaths,
                resumeCheckpointPaths
            }, result);
            guideModelPath = nextCarryOverState.guideModelPath;
            guideModelPoolPaths = nextCarryOverState.guideModelPoolPaths;
            resumeCheckpointPaths = cloneResumeCheckpointPaths(nextCarryOverState.resumeCheckpointPaths);
            if (nextCarryOverState.checkpointCarryOverSkipped) {
                console.log(`[training-cycle] iteration ${i} checkpoint carry-over skipped (promoted-only mode, promoted=false)`);
            }
        }
        if (result && result.paths) {
            const artifactCleanup = cleanupTransientSelfplayArtifacts(result.paths);
            result.artifactCleanup = artifactCleanup;
            if (artifactCleanup.removed.length > 0) {
                console.log(`[training-cycle] iteration ${i} cleaned transient selfplay artifacts=${artifactCleanup.removed.length}`);
            }
            if (artifactCleanup.failed.length > 0) {
                for (const failure of artifactCleanup.failed) {
                    console.warn(`[training-cycle] cleanup failed path=${failure.path} error=${failure.error}`);
                }
            }
        }
        const quickUpliftLabel = Number.isFinite(quickUplift) ? quickUplift.toFixed(3) : 'n/a';
        const quickCoreDeltaLabel = Number.isFinite(quickCoreDelta) ? quickCoreDelta.toFixed(3) : 'n/a';
        const quickWhiteDeltaLabel = Number.isFinite(quickWhiteDelta) ? quickWhiteDelta.toFixed(3) : 'n/a';
        const quickQualityDeltaLabel = Number.isFinite(quickQualityDelta) ? quickQualityDelta.toFixed(3) : 'n/a';
        console.log(`[training-cycle] iteration ${i} done gate_run=${!!(result.gateControl && result.gateControl.gateIterationAllowed)} quick_pass=${!!(result.quickDecision && result.quickDecision.passed)} quality_pass=${qualityGatePassed} final_pass=${finalPassed} onnx_gate_pass=${onnxGatePassed} promote_eligible=${promoteEligible} quick_uplift=${quickUpliftLabel} quick_core_delta=${quickCoreDeltaLabel} quick_white_delta=${quickWhiteDeltaLabel} quick_quality_delta=${quickQualityDeltaLabel} quick_non_regression_guard=${quickNonRegressionGuard} quick_uplift_guard=${quickUpliftGuard} quick_lb_guard=${quickLowerBoundGuard} gate_avg_guard=${gateAvgGuard} gate_min_seed_guard=${gateMinSeedGuard} promoted=${result.promoted}`);
        writeSummarySnapshot(
            args,
            startedAt,
            iterations,
            guideModelPath,
            guideModelPoolPaths,
            resumeCheckpointPaths,
            anchorModelPath,
            stoppedByTimeBudget,
            stopReason,
            failureDetail
        );
    }
    if (stoppedByTimeBudget) {
        console.warn(`[training-cycle] stopped by time budget: ${stopReason}`);
    }
    writeSummarySnapshot(
        args,
        startedAt,
        iterations,
        guideModelPath,
        guideModelPoolPaths,
        resumeCheckpointPaths,
        anchorModelPath,
        stoppedByTimeBudget,
        stopReason,
        failureDetail
    );
    console.log(`[training-cycle] summary: ${args.summaryOut}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[training-cycle] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

export = {
    parseArgs: parseSelfplayTrainingCycleArgs,
    parseSelfplayTrainingCycleArgs,
    TRAINING_CYCLE_STEP_ORDER,
    normalizeRestartFromStep,
    normalizeSelfplayCandidateAdmission,
    shouldAdmitCandidateGuide,
    shouldIncludeCandidateFilesAtStartup,
    describeSelfplayGuideUpdateMode,
    shouldReuseStepArtifacts,
    buildInitialGuideModelPoolPaths,
    buildIterationPaths,
    collectTransientSelfplayArtifactPaths,
    cleanupTransientSelfplayArtifacts,
    hasCoordinatePendingSelectionRecords,
    iterationTag,
    makeRunTag,
    resolveAdoptionBaselineMode,
    shouldRunGateForIteration,
    resolveIterationGateControl,
    resolveSelfplayCardUsageRateForIteration,
    getPrimaryResumeCheckpointPath,
    resolveResumeCheckpointPathsFromArgs,
    resolveNextCarryOverState,
    buildCandidateOnnxBundleArgs,
    buildTargetOnnxBundleArgs,
    buildPromotionTargetBundleArgs,
    buildPromotionCommandArgs,
    resolveGateSeedConfig,
    resolveQuickComponentDelta,
    resolvePromotionEligibility,
    extractTrainingCycleFailureDetail,
    annotateTrainingCycleError
};
