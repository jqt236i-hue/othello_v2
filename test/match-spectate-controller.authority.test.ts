import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function routeBody(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe('shared match spectate controller authority', () => {
  test('keeps spectator admission and presence publication in one portable controller', () => {
    const shared = read('utils/match-spectate-controller.ts');
    const worker = read('workers/match-worker.ts');
    const local = read('scripts/local-match-server.ts');
    const workerRoute = routeBody(worker, 'async handleSpectate', 'async handleSpectatorLeave');
    const localRoute = routeBody(local, 'async function handleSpectate', 'async function handleSpectatorLeave');

    expect(shared).toContain('createMatchSpectateController');
    expect(shared).toContain("type: 'spectator_join'");
    expect(workerRoute).toContain('createMatchSpectateController');
    expect(workerRoute).not.toContain("type: 'spectator_join'");
    expect(localRoute).toContain('createMatchSpectateController');
    expect(localRoute).not.toContain("type: 'spectator_join'");
  });
});
