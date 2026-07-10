import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function routeBody(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe('shared match stream preparation authority', () => {
  test('keeps stream admission, viewer authorization, and replay selection portable', () => {
    const shared = read('utils/match-stream-preparation-controller.ts');
    const worker = read('workers/match-worker-stream-route-controller.ts');
    const local = read('scripts/local-match-server.ts');
    const workerRoute = routeBody(worker, 'async function handleStream', 'return {');
    const localRoute = routeBody(local, 'async function handleStream', 'function createLocalMatchServer');

    expect(shared).toContain('createMatchStreamPreparationController');
    expect(shared).toContain('resolveAuthenticatedViewer');
    expect(shared).toContain('getBufferedSseReplayEvents');
    expect(shared).toContain('headerLastEventId || resumeEventId');
    expect(workerRoute).toContain('preparationController.prepareStream');
    expect(workerRoute).not.toContain('resolveAuthenticatedViewer(room');
    expect(workerRoute).not.toContain('getBufferedSseReplayEvents(');
    expect(localRoute).toContain('createLocalMatchStreamPreparationController');
    expect(localRoute).not.toContain('resolveAuthenticatedViewer(room');
    expect(localRoute).not.toContain('getBufferedSseReplayEvents(');
  });
});
