import * as http from 'http';
import * as nodeCrypto from 'crypto';

import {
  PLAYER_ID_TOKEN_CHARS,
  RECOVERY_CODE_CHARS,
  makePlayerId,
  makePlayerToken,
  makeRecoveryCode,
  randomStringFromBytes,
  unbiasedByteLimit
} from '../shared/player-identity-generator';
import { createMatchWorkerPlayerIdentityController } from '../workers/match-worker-player-identity';

const Contract = require('../shared/player-identity-contract');

// Byte stream alternating a byte in the biased tail (250) with a valid low byte (3).
function createAlternatingByteStream() {
  let counter = 0;
  return () => {
    const value = counter % 2 === 0 ? 250 : 3;
    counter += 1;
    return value;
  };
}

describe('shared player identity generator', () => {
  test('rejection sampling discards bytes 240-255 for the 30-character recovery charset and maps the rest evenly', () => {
    expect(RECOVERY_CODE_CHARS).toHaveLength(30);
    expect(unbiasedByteLimit(30)).toBe(240);
    const allBytes = Array.from({ length: 256 }, (_, index) => index);
    const calls: number[] = [];
    const text = randomStringFromBytes(RECOVERY_CODE_CHARS, 241, (count) => {
      calls.push(count);
      return calls.length === 1 ? allBytes : [5];
    });

    expect(text).toHaveLength(241);
    const counts = new Map<string, number>();
    for (const char of text.slice(0, 240)) counts.set(char, (counts.get(char) || 0) + 1);
    expect(counts.size).toBe(30);
    expect(Array.from(counts.values()).every((count) => count === 8)).toBe(true);
    // The 241st character comes from the second batch: all 16 tail bytes of the first batch were rejected.
    expect(text[240]).toBe(RECOVERY_CODE_CHARS[5]);
    expect(calls).toEqual([241, 16]);
  });

  test('the 64-character token charset maps every byte without rejection', () => {
    expect(unbiasedByteLimit(PLAYER_ID_TOKEN_CHARS.length)).toBe(256);
    const allBytes = Array.from({ length: 256 }, (_, index) => index);
    expect(randomStringFromBytes(PLAYER_ID_TOKEN_CHARS, 256, () => allBytes)).toBe(PLAYER_ID_TOKEN_CHARS.repeat(4));
  });

  test('formats stay compatible with the shared identity contract', () => {
    const source = (count: number) => nodeCrypto.randomBytes(count);
    for (let i = 0; i < 20; i += 1) {
      expect(Contract.normalizePlayerId(makePlayerId(source))).not.toBeNull();
      expect(Contract.normalizePlayerToken(makePlayerToken(source))).not.toBeNull();
      expect(Contract.normalizeRecoveryCode(makeRecoveryCode(source))).not.toBeNull();
    }
    expect(() => randomStringFromBytes(RECOVERY_CODE_CHARS, 5, undefined as any)).toThrow(/byte source/);
    expect(() => randomStringFromBytes(RECOVERY_CODE_CHARS, 5, () => [])).toThrow(/no bytes/);
  });
});

describe('player identity adapters use the unbiased generator', () => {
  test('Worker recovery codes never use bytes from the biased tail', async () => {
    const nextByte = createAlternatingByteStream();
    const storage = new Map<string, unknown>();
    const fakeCrypto = {
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = nextByte();
        return bytes;
      },
      subtle: (nodeCrypto.webcrypto as any).subtle
    } as unknown as Crypto;
    const controller = createMatchWorkerPlayerIdentityController({
      storage: {
        get: async (key: string) => storage.get(key),
        put: async (key: string, value: unknown) => { storage.set(key, value); },
        delete: async (key: string) => storage.delete(key)
      } as any,
      storageKey: 'test',
      jsonResponse: (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status }),
      now: () => 1000,
      crypto: fakeCrypto
    });

    const created = await (await controller.handleCreate()).json();

    expect(created.recoveryCode).toBe('CR-DDDDD-DDDDD-DDDDD-DDDDD-DDDDD');
    expect(created.playerId).toMatch(Contract.PLAYER_ID_RE);
    expect(created.playerToken).toMatch(Contract.PLAYER_TOKEN_RE);
  });

  test('credentials issued by the previous Worker generator still verify and recover', async () => {
    const storage = new Map<string, unknown>();
    const sha256 = (value: string) => nodeCrypto.createHash('sha256').update(value).digest('hex');
    // Shape produced by the old modulo mapping (bytes 240-255 folded onto the first characters).
    const legacy = {
      playerId: 'p_' + 'AB'.repeat(13),
      playerToken: 'pt_' + 'Cd'.repeat(21) + 'e',
      recoveryCode: 'CR-ABCDE-FGHJK-ABCDE-FGHJK-AAAAA'
    };
    storage.set(`test:identity:${legacy.playerId}`, {
      playerId: legacy.playerId,
      tokenHash: sha256(legacy.playerToken),
      recoveryHash: sha256(legacy.recoveryCode),
      createdAt: 1,
      updatedAt: 1,
      lastSeenAt: 1
    });
    storage.set(`test:recovery:${sha256(legacy.recoveryCode)}`, legacy.playerId);
    const controller = createMatchWorkerPlayerIdentityController({
      storage: {
        get: async (key: string) => storage.get(key),
        put: async (key: string, value: unknown) => { storage.set(key, value); },
        delete: async (key: string) => storage.delete(key)
      } as any,
      storageKey: 'test',
      jsonResponse: (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status }),
      now: () => 2000,
      crypto: nodeCrypto.webcrypto as unknown as Crypto
    });

    const verified = await controller.handleVerify({ playerId: legacy.playerId, playerToken: legacy.playerToken });
    expect(verified.status).toBe(200);
    const recovered = await controller.handleRecover({ recoveryCode: legacy.recoveryCode });
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).playerId).toBe(legacy.playerId);
  });

  test('local server recovery codes follow the same rule for the same byte stream', async () => {
    const { createLocalMatchServer, resetRoomsForTests } = require('../scripts/local-match-server.js');
    const realCrypto = require('crypto');
    const nextByte = createAlternatingByteStream();
    const spy = jest.spyOn(realCrypto, 'randomBytes').mockImplementation((count: any) => {
      const bytes = Buffer.alloc(Number(count));
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = nextByte();
      return bytes;
    });
    const server = createLocalMatchServer();
    try {
      const port = await new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        resolve(typeof address === 'object' && address ? address.port : 0);
      }));
      const created = await new Promise<any>((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: '/api/player/identity/create', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => resolve(JSON.parse(raw)));
        });
        req.on('error', reject);
        req.end('{}');
      });
      expect(created.recoveryCode).toBe('CR-DDDDD-DDDDD-DDDDD-DDDDD-DDDDD');
      expect(created.playerId).toMatch(Contract.PLAYER_ID_RE);
      expect(created.playerToken).toMatch(Contract.PLAYER_TOKEN_RE);
    } finally {
      spy.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      resetRoomsForTests();
    }
  });
});
