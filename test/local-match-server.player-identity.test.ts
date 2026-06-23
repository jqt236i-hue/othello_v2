import * as http from 'http';
import { createLocalMatchServer, resetRoomsForTests } from '../scripts/local-match-server.js';

function requestJson(port: number, method: string, path: string, payload?: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            data: raw ? JSON.parse(raw) : {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(JSON.stringify(payload));
    req.end();
  });
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

describe('local match server anonymous player identity', () => {
  beforeEach(() => {
    resetRoomsForTests();
  });

  test('identity create verify and recover mirrors Worker contract', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    try {
      const created = await requestJson(port, 'POST', '/api/player/identity/create', {});
      const verified = await requestJson(port, 'POST', '/api/player/identity/verify', {
        playerId: created.data.playerId,
        playerToken: created.data.playerToken
      });
      const recovered = await requestJson(port, 'POST', '/api/player/identity/recover', {
        recoveryCode: created.data.recoveryCode
      });
      const oldVerified = await requestJson(port, 'POST', '/api/player/identity/verify', {
        playerId: created.data.playerId,
        playerToken: created.data.playerToken
      });

      expect(created.status).toBe(200);
      expect(created.data.playerId).toMatch(/^p_[A-Za-z0-9_-]{26}$/);
      expect(created.data.playerToken).toMatch(/^pt_[A-Za-z0-9_-]{43}$/);
      expect(created.data.recoveryCode).toMatch(/^CR-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}$/);
      expect(verified.status).toBe(200);
      expect(recovered.status).toBe(200);
      expect(recovered.data.playerId).toBe(created.data.playerId);
      expect(recovered.data.playerToken).not.toBe(created.data.playerToken);
      expect(oldVerified.status).toBe(403);
      expect(oldVerified.data.reason).toBe('PLAYER_ID_TOKEN_INVALID');
    } finally {
      server.close();
    }
  });

  test('room create and join expose public seatPlayerIds without secrets', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    try {
      const black = await requestJson(port, 'POST', '/api/player/identity/create', {});
      const white = await requestJson(port, 'POST', '/api/player/identity/create', {});
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        playerId: black.data.playerId,
        playerToken: black.data.playerToken
      });
      const invalidJoin = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ',
        playerId: white.data.playerId,
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno99'
      });
      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ',
        playerId: white.data.playerId,
        playerToken: white.data.playerToken
      });
      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(created.data.roomId)}&seatKey=white&seatToken=${encodeURIComponent(joined.data.seatToken)}`
      );
      const publicPayloadText = JSON.stringify({
        created: created.data,
        joined: joined.data,
        state: state.data
      });

      expect(created.status).toBe(200);
      expect(created.data.seatPlayerIds).toEqual({
        black: black.data.playerId,
        white: ''
      });
      expect(invalidJoin.status).toBe(403);
      expect(invalidJoin.data.reason).toBe('PLAYER_ID_TOKEN_INVALID');
      expect(joined.status).toBe(200);
      expect(joined.data.seatPlayerIds).toEqual({
        black: black.data.playerId,
        white: white.data.playerId
      });
      expect(state.status).toBe(200);
      expect(state.data.seatPlayerIds).toEqual({
        black: black.data.playerId,
        white: white.data.playerId
      });
      expect(publicPayloadText).not.toContain('playerToken');
      expect(publicPayloadText).not.toContain('recoveryCode');
    } finally {
      server.close();
    }
  });
});
