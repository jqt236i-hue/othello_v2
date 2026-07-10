import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function routeBody(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe('shared match join controller authority', () => {
  test('keeps seat admission, initial snapshot, and join presence in one portable controller', () => {
    const shared = read('utils/match-join-controller.ts');
    const worker = read('workers/match-worker.ts');
    const local = read('scripts/local-match-server.ts');
    const workerRoute = routeBody(worker, 'async handleJoin', 'async handleLeave');
    const localRoute = routeBody(local, 'async function handleJoin', 'function handleList');

    expect(shared).toContain('createMatchJoinController');
    expect(shared).toContain("actionType: 'join_room'");
    expect(shared).toContain("type: 'join'");
    expect(workerRoute).toContain('createMatchJoinController');
    expect(workerRoute).not.toContain("actionType: 'join_room'");
    expect(workerRoute).not.toContain("type: 'join'");
    expect(localRoute).toContain('createMatchJoinController');
    expect(localRoute).not.toContain("actionType: 'join_room'");
    expect(localRoute).not.toContain("type: 'join'");
  });
});
