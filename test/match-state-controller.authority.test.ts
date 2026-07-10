import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function routeBody(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe('shared match state controller authority', () => {
  test('keeps state recovery and presentation journal viewer authorization in one portable controller', () => {
    const shared = read('utils/match-state-controller.ts');
    const worker = read('workers/match-worker.ts');
    const local = read('scripts/local-match-server.ts');
    const workerState = routeBody(worker, 'async handleState', 'async handlePresentationJournal');
    const workerJournal = routeBody(worker, 'async handlePresentationJournal', 'async handleStream');
    const localState = routeBody(local, 'async function handleState', 'async function handlePresentationJournal');
    const localJournal = routeBody(local, 'async function handlePresentationJournal', 'function handleStream');

    expect(shared).toContain('createMatchStateController');
    expect(shared).toContain('getBufferedSnapshotPayloadForStateVersion');
    expect(shared).toContain('buildPresentationJournalResponse');
    expect(workerState).toContain('getStateController');
    expect(workerState).not.toContain('getBufferedSnapshotPayloadForStateVersion');
    expect(workerJournal).toContain('getStateController');
    expect(workerJournal).not.toContain('buildPresentationJournalResponse');
    expect(localState).toContain('createLocalMatchStateController');
    expect(localState).not.toContain('getBufferedSnapshotPayloadForStateVersion');
    expect(localJournal).toContain('createLocalMatchStateController');
    expect(localJournal).not.toContain('buildPresentationJournalResponse');
  });
});
