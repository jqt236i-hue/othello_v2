import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

function isPrivatePath(relativePath: string): boolean {
    return relativePath.replace(/\\/g, '/').split('/').some((part) => (
        part.startsWith('.') || part.includes(':') || part.includes('\0')
    ));
}

export function createLocalRequestGuard(rootDir: string) {
    const root = fs.realpathSync(rootDir);
    return function guard(request: IncomingMessage, response: ServerResponse): void {
        let pathname: string;
        try {
            pathname = decodeURIComponent(parse(request.url || '/').pathname || '/');
        } catch {
            response.statusCode = 400;
            response.end('Bad request');
            return;
        }
        const reject = () => {
            response.statusCode = 404;
            response.end('Not found');
        };
        if (isPrivatePath(pathname)) {
            reject();
            return;
        }
        const candidate = path.resolve(root, '.' + pathname.replace(/\\/g, '/'));
        fs.realpath(candidate, (error, realPath) => {
            // Missing files remain the static server's responsibility (including index.html).
            if (error) {
                if (error.code === 'ENOENT' || error.code === 'ENOTDIR') response.emit('next');
                else reject();
                return;
            }
            const relativePath = path.relative(root, realPath);
            if (path.isAbsolute(relativePath) || isPrivatePath(relativePath)) {
                reject();
                return;
            }
            response.emit('next');
        });
    };
}

export function runGuardedHttpServer(entrypoint: string, args: string[]): void {
    // Adapt only this child process so every upstream CLI option still works.
    const httpServer = require('http-server');
    const createServer = httpServer.createServer;
    httpServer.createServer = (options: Record<string, any> = {}) => createServer({
        ...options,
        showDir: 'false',
        showDotfiles: false,
        before: [createLocalRequestGuard(options.root || '.'), ...(options.before || [])]
    });
    process.argv = [process.execPath, entrypoint, ...args];
    require(entrypoint);
}
