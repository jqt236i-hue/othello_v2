import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TRAINING_CLI_WRAPPERS = [
    'run-selfplay-training-profile.js',
    'run-selfplay-training-cycle.js',
    'generate-selfplay-data.js',
    'preflight-selfplay-training.js',
    'resolve-training-profile.js',
    'benchmark-policy-adoption.js',
    'benchmark-policy-quality-gate.js',
    'benchmark-policy-onnx-gate.js',
    'promote-policy-model.js'
];

const DIRECT_HELP_WRAPPERS = [
    'run-selfplay-training-profile.js',
    'run-selfplay-training-cycle.js',
    'generate-selfplay-data.js',
    'preflight-selfplay-training.js',
    'resolve-training-profile.js',
    'promote-policy-model.js'
];

function wrapperPath(name: string): string {
    return path.join(process.cwd(), 'scripts', name);
}

function distPath(name: string): string {
    return path.join(process.cwd(), 'dist', 'scripts', name);
}

describe('selfplay training CLI wrappers', () => {
    test.each(DIRECT_HELP_WRAPPERS)('%s forwards direct CLI execution to dist', (scriptName) => {
        expect(fs.existsSync(wrapperPath(scriptName))).toBe(true);
        expect(fs.existsSync(distPath(scriptName))).toBe(true);

        const result = spawnSync(process.execPath, [wrapperPath(scriptName), '--help'], {
            cwd: process.cwd(),
            encoding: 'utf8',
            timeout: 30000
        });
        const output = `${result.stdout || ''}${result.stderr || ''}`;

        expect(result.error).toBeUndefined();
        expect(result.status).toBe(0);
        expect(output.trim().length).toBeGreaterThan(0);
        expect(output).toMatch(/Usage|usage|Options|--help|selfplay|policy|training/i);
    });

    test.each(TRAINING_CLI_WRAPPERS)('%s exports the dist module when required', (scriptName) => {
        const wrapperExports = require(wrapperPath(scriptName));
        const distExports = require(distPath(scriptName));

        expect(wrapperExports).toBe(distExports);
    });
});
