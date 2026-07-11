import { spawn, spawnSync, type ChildProcessByStdio } from 'child_process';
import * as fs from 'fs';
import { createServer } from 'net';
import * as path from 'path';
import type { Readable } from 'stream';

const ROOT = fs.existsSync(path.join(process.cwd(), 'wrangler.toml'))
    ? process.cwd()
    : path.resolve(__dirname, '..', '..');
const STARTUP_TIMEOUT_MS = 60000;

type SmokeProcess = ChildProcessByStdio<null, Readable, Readable>;

interface JsonResponse {
    ok: boolean;
    status: number;
    data: any;
}

function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertTrue(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

async function findFreePort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    assertTrue(address && typeof address === 'object' && Number(address.port) > 0, 'worker bundle smoke port の取得に失敗しました');
    return Number(address.port);
}

function stopProcessTree(child: SmokeProcess): void {
    if (!child || !child.pid || child.killed) return;
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        return;
    }
    try {
        process.kill(-child.pid, 'SIGTERM');
    } catch {
        child.kill('SIGTERM');
    }
}

function startWorker(port: number): { child: SmokeProcess; output: () => string } {
    const isWindows = process.platform === 'win32';
    const wranglerArgs = ['wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port)];
    const child = spawn(
        isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npx',
        isWindows ? ['/d', '/s', '/c', 'npx', ...wranglerArgs] : wranglerArgs,
        {
            cwd: ROOT,
            detached: !isWindows,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        }
    );
    let output = '';
    const append = (chunk: Buffer | string) => {
        output = `${output}${chunk.toString()}`.slice(-12000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    return { child, output: () => output };
}

async function requestJson(baseUrl: string, method: string, route: string, body?: unknown): Promise<JsonResponse> {
    const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return {
        ok: response.ok,
        status: response.status,
        data: await response.json().catch(() => ({}))
    };
}

async function waitForWorker(baseUrl: string, child: SmokeProcess, output: () => string): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
        if (child.exitCode !== null) {
            throw new Error(`local Worker exited before ready (code=${child.exitCode})\n${output()}`);
        }
        try {
            const response = await requestJson(baseUrl, 'GET', '/api/match/list');
            if (response.ok) return;
        } catch {
            // The Worker is still starting.
        }
        await wait(250);
    }
    throw new Error(`local Worker did not become ready within ${STARTUP_TIMEOUT_MS}ms\n${output()}`);
}

async function leaveRoom(baseUrl: string, roomId: string, seatKey: string, seatToken: string): Promise<void> {
    const response = await requestJson(baseUrl, 'POST', '/api/match/leave', { roomId, seatKey, seatToken });
    assertTrue(response.ok && response.data && response.data.ok === true, `leave(${seatKey}) failed status=${response.status}`);
}

async function main(): Promise<void> {
    const port = await findFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const runtime = startWorker(port);
    let black: any = null;
    let white: any = null;

    console.log(`[worker-bundle-smoke] starting ${baseUrl}`);
    try {
        await waitForWorker(baseUrl, runtime.child, runtime.output);

        const created = await requestJson(baseUrl, 'POST', '/api/match/create', { playerName: 'bundle黒' });
        assertTrue(created.ok && created.data && created.data.ok === true, `create failed status=${created.status} body=${JSON.stringify(created.data)}`);
        black = created.data;
        assertTrue(black.seatKey === 'black' && black.roomId && black.seatToken, 'create response lacks black seat credentials');

        const joined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId: black.roomId, playerName: 'bundle白' });
        assertTrue(joined.ok && joined.data && joined.data.ok === true, `join failed status=${joined.status} body=${JSON.stringify(joined.data)}`);
        white = joined.data;
        assertTrue(white.seatKey === 'white' && white.seatToken, 'join response lacks white seat credentials');

        const state = await requestJson(
            baseUrl,
            'GET',
            `/api/match/state?roomId=${encodeURIComponent(black.roomId)}&seatKey=black&seatToken=${encodeURIComponent(black.seatToken)}`
        );
        assertTrue(state.ok && state.data && state.data.ok === true, `state failed status=${state.status}`);

        await leaveRoom(baseUrl, black.roomId, 'white', white.seatToken);
        await leaveRoom(baseUrl, black.roomId, 'black', black.seatToken);
        white = null;
        black = null;
        console.log('[worker-bundle-smoke] create/join/state/leave passed');
    } finally {
        if (white && black) {
            await requestJson(baseUrl, 'POST', '/api/match/leave', {
                roomId: black.roomId,
                seatKey: 'white',
                seatToken: white.seatToken
            }).catch(() => undefined);
        }
        if (black) {
            await requestJson(baseUrl, 'POST', '/api/match/leave', {
                roomId: black.roomId,
                seatKey: 'black',
                seatToken: black.seatToken
            }).catch(() => undefined);
        }
        stopProcessTree(runtime.child);
    }
}

main().catch((error) => {
    console.error(`[worker-bundle-smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
