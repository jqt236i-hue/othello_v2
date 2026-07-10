import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('shared match publish controller authority', () => {
  test('keeps publish outcomes in the runtime-neutral controller', () => {
    const shared = read('utils/match-publish-controller.ts');
    const workerWrapper = read('workers/match-worker-publish-controller.ts');
    const localServer = read('scripts/local-match-server.ts');
    const localPublishHandler = localServer.slice(
      localServer.indexOf('async function handlePublish'),
      localServer.indexOf('function validateRematchSeat')
    );

    expect(shared).toContain('export function createMatchPublishController');
    expect(shared).toContain("kind: 'publish_idempotent_replay'");
    expect(shared).toContain("kind: 'publish_accepted'");
    expect(workerWrapper).toContain('createMatchPublishController');
    expect(workerWrapper).not.toContain("kind: 'publish_accepted'");
    expect(localPublishHandler).toContain('createMatchPublishController');
    expect(localPublishHandler).not.toContain("kind: 'publish_accepted'");
    expect(localPublishHandler).not.toContain("kind: 'publish_idempotent_replay'");
  });
});
