'use strict';

const path = require('path');

type SelfplayTrainingCycleStepResult = {
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    command?: string;
    artifactPaths?: string[];
};

function toSelfplayTrainingCycleStepResult(step: any): SelfplayTrainingCycleStepResult {
    const result: SelfplayTrainingCycleStepResult = {
        name: String(step && step.name ? step.name : ''),
        status: step && step.skipped ? 'skipped' : (Number(step && step.status) === 0 ? 'passed' : 'failed')
    };
    if (step && typeof step.command === 'string' && step.command) {
        result.command = step.command;
    }
    const artifactPaths = step && Array.isArray(step.artifactPaths)
        ? step.artifactPaths
        : (step && Array.isArray(step.stepOutputs) ? step.stepOutputs : []);
    if (artifactPaths.length > 0) {
        result.artifactPaths = artifactPaths.slice();
    }
    return result;
}

function createSelfplayTrainingCycleStepRecorder(config?: any) {
    const cfg = (config && typeof config === 'object') ? config : {};
    const steps = Array.isArray(cfg.steps) ? cfg.steps : [];
    const args = cfg.args || {};
    const logger = cfg.logger || console;
    const runCommand = typeof cfg.runCommand === 'function' ? cfg.runCommand : null;
    const getRemainingMs = typeof cfg.getRemainingMs === 'function' ? cfg.getRemainingMs : null;
    const shouldReuseStepArtifacts = typeof cfg.shouldReuseStepArtifacts === 'function'
        ? cfg.shouldReuseStepArtifacts
        : () => false;
    const fileExists = typeof cfg.fileExists === 'function' ? cfg.fileExists : () => false;
    const annotateError = typeof cfg.annotateError === 'function' ? cfg.annotateError : (error: any) => error;

    function runStep(name: string, cmd: string, stepArgs: any[], options?: any) {
        if (!runCommand) {
            throw new Error('[selfplay-training-cycle-steps] runCommand is required');
        }
        const remainingMs = getRemainingMs ? getRemainingMs(cfg.deadlineMs) : null;
        if (Number.isFinite(remainingMs) && remainingMs <= 0) {
            const err: any = new Error(`time budget exceeded before ${name}`);
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
            throw annotateError(error, {
                iteration: cfg.iterationIndex,
                step: name,
                runTag: args.runTag,
                iterationTag: cfg.iterationTag,
                summaryOut: args.summaryOut,
                stepOutputs: options && Array.isArray(options.reuseOutputs) ? options.reuseOutputs : []
            });
        }
    }

    function runManagedStep(name: string, cmd: string, stepArgs: any[], options?: any) {
        const reuseOutputs = options && Array.isArray(options.reuseOutputs)
            ? options.reuseOutputs.filter((one: any) => !!one)
            : [];
        if (shouldReuseStepArtifacts(args, name) && reuseOutputs.length > 0 && reuseOutputs.every(fileExists)) {
            logger.log(`[training-cycle] reuse ${name}: ${reuseOutputs.map((one: string) => path.basename(one)).join(', ')}`);
            const reusedResult = { status: 0, elapsedMs: 0, reused: true };
            steps.push({ name, ...reusedResult });
            return reusedResult;
        }
        return runStep(name, cmd, stepArgs, options);
    }

    function recordSkippedStep(name: string, reason: string, extra?: any) {
        const result = Object.assign({
            name,
            status: 0,
            elapsedMs: 0,
            skipped: true,
            reason
        }, extra || {});
        steps.push(result);
        return result;
    }

    function getStepResults() {
        return steps.map(toSelfplayTrainingCycleStepResult);
    }

    return {
        steps,
        runStep,
        runManagedStep,
        recordSkippedStep,
        getStepResults
    };
}

export = {
    createSelfplayTrainingCycleStepRecorder,
    toSelfplayTrainingCycleStepResult
};
