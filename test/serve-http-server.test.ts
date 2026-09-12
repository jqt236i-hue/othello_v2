import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

function request(port: number, pathname: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path: pathname }, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ status: response.statusCode!, body }));
        });
        req.on('error', reject);
    });
}

test('the actual local server CLI serves game files but rejects private paths and listings', async () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-http-guard-'));
    const write = (file: string, content: string) => {
        const target = path.join(fixtureRoot, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    };
    write('index.html', '<!doctype html>game entry');
    write('.env', 'fixture-private-environment');
    write('.git/HEAD', 'fixture-private-git');
    write('assets/.env.local', 'fixture-private-nested');
    write('assets/画像.txt', 'game asset');
    write('vite-dist/assets/app.js', 'game script');
    write('data/models/model.onnx', 'game model');
    // Junctions can be created without Windows developer-mode privileges.
    fs.symlinkSync(path.join(fixtureRoot, '.git'), path.join(fixtureRoot, 'git-alias'), 'junction');

    const probe = net.createServer();
    await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    const child = spawn(process.execPath, [
        path.resolve(__dirname, '../dist/scripts/serve-with-fallback.js'),
        '--http-server-child', require.resolve('http-server/bin/http-server'),
        fixtureRoot, '-a', '127.0.0.1', '-p', String(port), '-c-1', '--cors',
        // Upstream flags must not disable the local privacy guard.
        '-d', 'true', '--dotfiles', 'true'
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
    try {
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
            if (child.exitCode !== null) throw new Error(output);
            try {
                ready = (await request(port, '/')).status === 200;
            } catch { /* wait for the child to bind */ }
            if (ready) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (!ready) throw new Error(`Local server did not start: ${output}`);

        for (const [route, body] of [
            ['/', '<!doctype html>game entry'],
            ['/vite-dist/assets/app.js', 'game script'],
            ['/assets/' + encodeURIComponent('画像.txt'), 'game asset'],
            ['/data/models/model.onnx', 'game model']
        ]) {
            expect(await request(port, route)).toEqual({ status: 200, body });
        }
        for (const route of [
            '/.env', '/.git/HEAD', '/%2eenv', '/%2egit%2fHEAD',
            '/assets/.env.local', '/assets%2f.env.local', '/assets/../.env',
            '/assets%5c..%5c.env', '/git-alias/HEAD', '/assets/'
        ]) {
            const response = await request(port, route);
            expect([403, 404]).toContain(response.status);
            expect(response.body).not.toContain('fixture-private');
        }
        expect((await request(port, '/%zz')).status).toBe(400);
    } finally {
        child.kill();
        await exited;
        fs.unlinkSync(path.join(fixtureRoot, 'git-alias'));
        const resolvedFixture = path.resolve(fixtureRoot);
        if (path.dirname(resolvedFixture) !== path.resolve(os.tmpdir()) || !path.basename(resolvedFixture).startsWith('serve-http-guard-')) {
            throw new Error('Unexpected fixture cleanup path');
        }
        fs.rmSync(resolvedFixture, { recursive: true, force: true });
    }
}, 20000);
