import * as fs from 'fs';
import * as path from 'path';
import type {
  DurableObjectStateLike,
  MatchRoomDurableObjectApi,
  MatchWorkerEntrypoint,
  MatchWorkerEnv
} from '../workers/match-worker-types';

describe('match-worker public contract types', () => {
  test('describes Worker and Durable Object runtime boundaries', () => {
    const env: MatchWorkerEnv = {
      MATCH_ROOM: {
        idFromName: (name: string) => name,
        get: () => ({ fetch: async () => new Response('{}') })
      }
    };
    const entrypoint: MatchWorkerEntrypoint = {
      fetch: async (_request, runtimeEnv) => {
        expect(runtimeEnv).toBe(env);
        return new Response('ok');
      }
    };
    const durableState: DurableObjectStateLike = {
      storage: {
        get: async () => null,
        put: async () => undefined,
        delete: async () => true
      }
    };
    const durableObject: Partial<MatchRoomDurableObjectApi> = {
      fetch: async () => new Response('ok')
    };

    expect(durableState.storage).toBeTruthy();
    expect(durableObject.fetch).toBeTruthy();
    return expect(entrypoint.fetch(new Request('https://worker/'), env)).resolves.toBeInstanceOf(Response);
  });

  test('Worker source routes public exports through contract types', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../workers/match-worker.ts'), 'utf8');
    expect(source).toContain('implements MatchRoomDurableObjectApi');
    expect(source).toContain('const matchWorkerEntrypoint: MatchWorkerEntrypoint');
    expect(source).toContain('export default matchWorkerEntrypoint');
  });
});
