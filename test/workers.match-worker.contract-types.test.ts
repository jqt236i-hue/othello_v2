import * as fs from 'fs';
import * as path from 'path';
import type {
  MatchRoomDurableObjectConstructor,
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
    const DurableObjectCtor: MatchRoomDurableObjectConstructor = class {
      async fetch() { return new Response('ok'); }
      async handleInternalCreate() { return new Response('ok'); }
      async handleJoin() { return new Response('ok'); }
      async handleLeave() { return new Response('ok'); }
      async handleHandSkin() { return new Response('ok'); }
      async handlePublish() { return new Response('ok'); }
      async handleState() { return new Response('ok'); }
      async handleStream() { return new Response('ok'); }
      async handleChat() { return new Response('ok'); }
      async handleLeaderboardSubmit() { return new Response('ok'); }
      async handleLeaderboardList() { return new Response('ok'); }
    };

    expect(durableState.storage).toBeTruthy();
    expect(durableObject.fetch).toBeTruthy();
    expect(new DurableObjectCtor(durableState).fetch).toBeTruthy();
    return expect(entrypoint.fetch(new Request('https://worker/'), env)).resolves.toBeInstanceOf(Response);
  });

  test('Worker source routes public exports through contract types', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../workers/match-worker.ts'), 'utf8');
    expect(source).toContain('implements MatchRoomDurableObjectApi');
    expect(source).toContain('assertMatchRoomDurableObjectConstructor(MatchRoomDurableObject)');
    expect(source).toContain('const matchWorkerEntrypoint: MatchWorkerEntrypoint = assertMatchWorkerEntrypoint');
    expect(source).toContain('export default matchWorkerEntrypoint');
  });
});
