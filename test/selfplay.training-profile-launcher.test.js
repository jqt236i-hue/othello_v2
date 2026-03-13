const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    createLauncherLogger,
    runCommandLogged,
    readTrainingCycleFailureDetail,
    annotateTrainingProfileError,
    buildTrainingProfileFailureReport
} = require('../scripts/run-selfplay-training-profile');

describe('selfplay training profile launcher logging', () => {
    test('launcher logger captures streamed stdout and stderr into launcher.log', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-launcher-'));
        const logPath = path.join(tempRoot, 'launcher.log');
        const logger = createLauncherLogger(logPath);
        const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

        try {
            logger.log('[training-profile] launch: test');
            const result = await runCommandLogged(process.execPath, [
                '-e',
                [
                    'process.stdout.write("[selfplay] 9390/16000 completed (last winner: black)\\n");',
                    'process.stderr.write("[selfplay] 9400/16000 completed (last winner: white)\\n");'
                ].join(' ')
            ], {
                cwd: process.cwd(),
                logger
            });

            await logger.close();

            expect(result.status).toBe(0);
            expect(fs.existsSync(logPath)).toBe(true);
            const logText = fs.readFileSync(logPath, 'utf8');
            expect(logText).toContain('[training-profile] launch: test');
            expect(logText).toContain('[selfplay] 9390/16000 completed (last winner: black)');
            expect(logText).toContain('[selfplay] 9400/16000 completed (last winner: white)');
        } finally {
            stdoutSpy.mockRestore();
            stderrSpy.mockRestore();
        }
    });

    test('launcher logger rotates existing launcher.log before writing a restarted run', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-launcher-'));
        const logPath = path.join(tempRoot, 'launcher.log');
        fs.writeFileSync(logPath, '[old-run] games=2000/3200\n', 'utf8');

        const logger = createLauncherLogger(logPath);
        const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

        try {
            logger.log('[training-profile] launch: restarted');
            await logger.close();

            const files = fs.readdirSync(tempRoot).sort();
            const archived = files.filter((name) => name !== 'launcher.log' && /^launcher\..+\.log$/.test(name));
            expect(archived).toHaveLength(1);

            const currentText = fs.readFileSync(logPath, 'utf8');
            const archivedText = fs.readFileSync(path.join(tempRoot, archived[0]), 'utf8');
            expect(currentText).toContain('[training-profile] launch: restarted');
            expect(currentText).not.toContain('games=2000/3200');
            expect(archivedText).toContain('games=2000/3200');
            expect(logger.archivedPath).toBe(path.join(tempRoot, archived[0]));
        } finally {
            stdoutSpy.mockRestore();
        }
    });

    test('reads failed iteration detail from training-cycle summary', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-training-launcher-'));
        const summaryPath = path.join(tempRoot, 'training-cycle.summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify({
            failure: {
                iteration: 4,
                step: 'train-card-policy',
                exitCode: 1,
                command: 'python train_card_onnx.py'
            }
        }, null, 2), 'utf8');

        expect(readTrainingCycleFailureDetail(summaryPath)).toEqual({
            iteration: 4,
            step: 'train-card-policy',
            exitCode: 1,
            command: 'python train_card_onnx.py'
        });
    });

    test('formats phase and step details into failure report', () => {
        const error = annotateTrainingProfileError(new Error('train-cycle failed (exit=1)'), {
            phase: 'train-cycle',
            exitCode: 1,
            profile: 'production_v3',
            gate: 'promotion_v3',
            runTag: 'production_v3_test',
            summaryPath: 'C:/tmp/training-cycle.summary.json',
            launcherLogPath: 'C:/tmp/launcher.log',
            failureDetail: {
                iteration: 4,
                step: 'train-card-policy',
                command: 'python train_card_onnx.py',
                stepOutputs: ['C:/tmp/train.card.metrics.jsonl']
            }
        });

        const report = buildTrainingProfileFailureReport(error).join('\n');
        expect(report).toContain('phase=train-cycle');
        expect(report).toContain('iteration=4');
        expect(report).toContain('step=train-card-policy');
        expect(report).toContain('summary=C:/tmp/training-cycle.summary.json');
        expect(report).toContain('launcherLog=C:/tmp/launcher.log');
        expect(report).toContain('failedCommand=python train_card_onnx.py');
        expect(report).toContain('stepOutputs=C:/tmp/train.card.metrics.jsonl');
    });
});