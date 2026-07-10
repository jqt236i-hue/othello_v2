import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function routeBody(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe('shared match room preferences controller authority', () => {
  test('keeps hand-skin and deck presence publication in one portable controller', () => {
    const shared = read('utils/match-room-preferences-controller.ts');
    const worker = read('workers/match-worker.ts');
    const local = read('scripts/local-match-server.ts');
    const workerHandSkin = routeBody(worker, 'async handleHandSkin', 'async handleDeck');
    const workerDeck = routeBody(worker, 'async handleDeck', 'async handlePublish');
    const localHandSkin = routeBody(local, 'async function handleHandSkin', 'async function handleDeck');
    const localDeck = routeBody(local, 'async function handleDeck', 'async function handlePublish');

    expect(shared).toContain('createMatchRoomPreferencesController');
    expect(shared).toContain("type: 'hand_skin'");
    expect(shared).toContain("type: 'deck'");
    expect(workerHandSkin).toContain('getRoomPreferencesController');
    expect(workerHandSkin).not.toContain("type: 'hand_skin'");
    expect(workerDeck).toContain('getRoomPreferencesController');
    expect(workerDeck).not.toContain("type: 'deck'");
    expect(localHandSkin).toContain('createLocalMatchRoomPreferencesController');
    expect(localHandSkin).not.toContain("type: 'hand_skin'");
    expect(localDeck).toContain('createLocalMatchRoomPreferencesController');
    expect(localDeck).not.toContain("type: 'deck'");
  });
});
