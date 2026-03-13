const net = require('net');

const {
    parseArgs,
    chooseServePort,
    buildHttpServerArgs
} = require('../scripts/serve-with-fallback');

function listenOnce(server, options) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options, () => resolve(server.address()));
    });
}

describe('serve-with-fallback', () => {
    test('parseArgs keeps explicit root and port', () => {
        const args = parseArgs(['worker-public', '--port', '9000', '--host', '127.0.0.1']);
        expect(args.root).toBe('worker-public');
        expect(args.preferredPort).toBe(9000);
        expect(args.host).toBe('127.0.0.1');
    });

    test('chooseServePort skips an occupied port', async () => {
        const server = net.createServer();
        const address = await listenOnce(server, { host: '127.0.0.1', port: 0 });

        try {
            const selectedPort = await chooseServePort({
                host: '127.0.0.1',
                preferredPort: address.port,
                maxAttempts: 5
            });
            expect(selectedPort).not.toBe(address.port);

            const probe = net.createServer();
            await listenOnce(probe, { host: '127.0.0.1', port: selectedPort });
            await new Promise((resolve) => probe.close(resolve));
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test('buildHttpServerArgs includes selected port and cache flag', () => {
        const args = buildHttpServerArgs('http-server-entry.js', {
            root: '.',
            host: '0.0.0.0',
            cacheSeconds: -1,
            passThrough: ['--cors']
        }, 8012);

        expect(args).toContain('http-server-entry.js');
        expect(args).toContain('-p');
        expect(args).toContain('8012');
        expect(args).toContain('-a');
        expect(args).toContain('0.0.0.0');
        expect(args).toContain('-c-1');
        expect(args).toContain('--cors');
    });
});