import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function routeBody(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe('shared match leave controller authority', () => {
  test('keeps player and spectator leave presence in one portable controller', () => {
    const shared = read('utils/match-leave-controller.ts');
    const worker = read('workers/match-worker.ts');
    const local = read('scripts/local-match-server.ts');
    const workerLeave = routeBody(worker, 'async handleLeave', 'async handleSpectate');
    const workerSpectatorLeave = routeBody(worker, 'async handleSpectatorLeave', 'async handleHandSkin');
    const localLeave = routeBody(local, 'async function handleLeave', 'async function handleSpectate');
    const localSpectatorLeave = routeBody(local, 'async function handleSpectatorLeave', 'async function handleHandSkin');

    expect(shared).toContain('createMatchLeaveController');
    expect(shared).toContain("type: 'leave'");
    expect(shared).toContain("type: 'spectator_leave'");
    expect(workerLeave).toContain('getLeaveController');
    expect(workerLeave).not.toContain("type: 'leave'");
    expect(workerSpectatorLeave).toContain('getLeaveController');
    expect(workerSpectatorLeave).not.toContain("type: 'spectator_leave'");
    expect(localLeave).toContain('createLocalMatchLeaveController');
    expect(localLeave).not.toContain("type: 'leave'");
    expect(localSpectatorLeave).toContain('createLocalMatchLeaveController');
    expect(localSpectatorLeave).not.toContain("type: 'spectator_leave'");
  });
});
