import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export function validateCandidateRun(config: any) {
    const args: string[] = config.command.args;
    if (!args.includes('--no-promote') || args.includes('--promote') ||
        !args.includes('--no-deploy-promoted-to-root') || args.includes('--deploy-promoted-to-root')) {
        throw new Error('Supervisor requires a candidate-only run without promotion or deployment');
    }
}

export function completed(summary: any): boolean {
    return !summary.failure && !summary.stoppedByTimeBudget &&
        summary.iterations?.length >= summary.config?.iterations;
}

async function main() {
    const configFile = path.resolve(process.argv[2]);
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    validateCandidateRun(config);
    const runDir = config.paths.runDir;
    const stateFile = path.join(runDir, 'supervisor.json');
    const lockFile = path.join(runDir, 'supervisor.lock');
    const readSummary = () => JSON.parse(fs.readFileSync(config.paths.summaryOut, 'utf8'));
    const lock = fs.openSync(lockFile, 'wx'); // Fail closed if another supervisor owns this run.
    fs.writeSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const log = fs.createWriteStream(config.paths.launcherLogPath, { flags: 'a' });
    let childPid: number | undefined;
    let attempt = 0;
    const startedAt = new Date().toISOString();
    const remainingHours = Math.max(0, Number(readSummary().config.maxHours) - Number(readSummary().elapsedMs) / 3600000);
    const deadline = Date.now() + remainingHours * 3600000;
    const state = (status: string, extra = {}) => {
        const temp = `${stateFile}.tmp`;
        fs.writeFileSync(temp, JSON.stringify({ status, pid: process.pid, childPid, attempt, startedAt,
            updatedAt: new Date().toISOString(), deadline: new Date(deadline).toISOString(), ...extra }, null, 2));
        fs.renameSync(temp, stateFile);
    };
    const execute = (command: any, args: string[]) => new Promise<number>((resolve, reject) => {
        const child = spawn(command.executable, args, { cwd: config.cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        childPid = child.pid;
        state('running');
        child.stdout.on('data', data => log.write(data));
        child.stderr.on('data', data => log.write(data));
        let timedOut = false;
        const heartbeat = setInterval(() => {
            state('running');
            if (!timedOut && Date.now() >= deadline) {
                timedOut = true;
                // Only this supervisor's own child tree is terminated at the budget limit.
                if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
                else child.kill('SIGTERM');
            }
        }, 5000);
        child.on('error', error => { clearInterval(heartbeat); reject(error); });
        child.on('close', code => { clearInterval(heartbeat); childPid = undefined; resolve(timedOut ? 124 : code ?? 1); });
    });
    try {
        if (completed(readSummary())) { state('completed'); return; }
        if (Date.now() >= deadline) throw new Error('No remaining training time budget');
        state('preflight');
        if (await execute(config.preflightCommand, config.preflightCommand.args) !== 0) throw new Error('Preflight failed');
        for (attempt = 1; attempt <= 3; attempt++) {
            const args: string[] = [...config.command.args];
            const index = args.indexOf('--max-hours');
            if (index < 0) throw new Error('Missing time budget');
            args[index + 1] = String(Math.max(0.0001, (deadline - Date.now()) / 3600000));
            log.write(`\n[supervisor] attempt=${attempt} resume=${config.paths.summaryOut}\n`);
            const code = await execute(config.command, args);
            if (completed(readSummary())) { state('completed', { exitCode: code }); return; }
            state('interrupted', { exitCode: code });
            if (Date.now() >= deadline || code === 0) throw new Error(`Training stopped without completing (exit=${code})`);
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 15000));
        }
        throw new Error('Three attempts failed; automatic retries exhausted');
    } catch (error) {
        state('failed', { error: String(error) });
        throw error;
    } finally {
        await new Promise<void>(resolve => log.end(resolve));
        fs.closeSync(lock);
        fs.unlinkSync(lockFile);
    }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
