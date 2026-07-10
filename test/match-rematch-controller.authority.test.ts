import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function routeBody(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe('shared match rematch controller authority', () => {
  test('keeps rematch request and response presence publication in one portable controller', () => {
    const shared = read('utils/match-rematch-controller.ts');
    const worker = read('workers/match-worker.ts');
    const local = read('scripts/local-match-server.ts');
    const workerRequest = routeBody(worker, 'async handleRematchRequest', 'async handleRematchResponse');
    const workerResponse = routeBody(worker, 'async handleRematchResponse', 'async handleState');
    const localRequest = routeBody(local, 'async function handleRematchRequest', 'async function handleRematchResponse');
    const localResponse = routeBody(local, 'async function handleRematchResponse', 'async function handleChat');

    expect(shared).toContain('createMatchRematchController');
    expect(shared).toContain("type: 'rematch_request'");
    expect(shared).toContain("type: 'rematch_response'");
    expect(workerRequest).toContain('getRematchController');
    expect(workerRequest).not.toContain("type: 'rematch_request'");
    expect(workerResponse).toContain('getRematchController');
    expect(workerResponse).not.toContain("type: 'rematch_response'");
    expect(localRequest).toContain('createLocalMatchRematchController');
    expect(localRequest).not.toContain("type: 'rematch_request'");
    expect(localResponse).toContain('createLocalMatchRematchController');
    expect(localResponse).not.toContain("type: 'rematch_response'");
  });
});
