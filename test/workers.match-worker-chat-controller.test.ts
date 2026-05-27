import { createMatchWorkerChatController } from '../workers/match-worker-chat-controller';

function createJsonResponse(statusCode: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function readJson(response: Response): Promise<any> {
  return JSON.parse(await response.text());
}

function createRoom(overrides: Record<string, unknown> = {}) {
  return {
    roomId: 'ABC',
    seats: { black: true, white: true },
    seatTokens: { black: 'black-token', white: 'white-token' },
    chatMessages: [],
    chatSeq: 0,
    updatedAt: 0,
    ...overrides
  } as any;
}

function createController(room: any) {
  const saved: any[] = [];
  const broadcasts: any[] = [];
  let timeoutChecks = 0;
  let nowValue = 1000;
  const controller = createMatchWorkerChatController({
    getRoom: () => room,
    loadRoom: async () => undefined,
    saveRoom: async () => {
      saved.push({ chatSeq: room.chatSeq, chatMessages: room.chatMessages.slice(), updatedAt: room.updatedAt });
    },
    applyExpiredTurnTimeoutIfNeeded: async () => {
      timeoutChecks += 1;
      return null;
    },
    normalizePlayerKey: (value) => (value === 'white' ? 'white' : 'black'),
    buildPublicSeatState: (currentRoom) => ({
      seats: currentRoom.seats || { black: false, white: false }
    }),
    toPublicTurnTimer: (_currentRoom, nowMs) => ({ serverNow: nowMs }),
    withPublicSeatState: (currentRoom, payload) => ({
      seats: currentRoom.seats,
      ...payload
    }),
    toPublicNetworkDebugEnabled: () => true,
    classifySeatTokenRejectionReason: (seatToken) => (seatToken ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED'),
    broadcastChat: async (payload) => {
      broadcasts.push(payload);
    },
    jsonResponse: createJsonResponse,
    chatMaxLength: 20,
    chatHistoryLimit: 2,
    now: () => {
      nowValue += 1;
      return nowValue;
    }
  });

  return {
    controller,
    saved,
    broadcasts,
    getTimeoutChecks: () => timeoutChecks
  };
}

describe('match worker chat controller', () => {
  test('accepts a valid chat message, trims newlines, saves, and broadcasts', async () => {
    const room = createRoom();
    const ctx = createController(room);

    const response = await ctx.controller.handleChat({
      seatKey: 'black',
      seatToken: 'black-token',
      message: '  hello\r\nworld  '
    });

    const body = await readJson(response);
    expect(response.status).toBe(200);
    expect(ctx.getTimeoutChecks()).toBe(1);
    expect(room.chatSeq).toBe(1);
    expect(room.chatMessages).toEqual([
      {
        id: 1,
        seatKey: 'black',
        text: 'hello world',
        serverTime: 1001
      }
    ]);
    expect(ctx.saved).toHaveLength(1);
    expect(ctx.broadcasts).toEqual([
      {
        seats: { black: true, white: true },
        ok: true,
        roomId: 'ABC',
        type: 'message',
        message: room.chatMessages[0],
        networkDebugEnabled: true
      }
    ]);
    expect(body).toMatchObject({
      ok: true,
      roomId: 'ABC',
      message: room.chatMessages[0],
      networkDebugEnabled: true,
      turnTimer: { serverNow: 1002 },
      serverTime: 1003
    });
  });

  test('rejects unjoined, unauthenticated, disabled, empty, and overlong chat requests', async () => {
    const cases = [
      {
        room: createRoom({ seats: { black: false, white: true } }),
        request: { seatKey: 'black', seatToken: 'black-token', message: 'hello' },
        status: 403,
        reason: 'SEAT_NOT_JOINED'
      },
      {
        room: createRoom(),
        request: { seatKey: 'black', seatToken: 'bad-token', message: 'hello' },
        status: 403,
        reason: 'SEAT_TOKEN_MISMATCH'
      },
      {
        room: createRoom({ seats: { black: true, white: false } }),
        request: { seatKey: 'black', seatToken: 'black-token', message: 'hello' },
        status: 409,
        reason: 'CHAT_DISABLED'
      },
      {
        room: createRoom(),
        request: { seatKey: 'black', seatToken: 'black-token', message: '   ' },
        status: 400,
        reason: 'MESSAGE_REQUIRED'
      },
      {
        room: createRoom(),
        request: { seatKey: 'black', seatToken: 'black-token', message: '123456789012345678901' },
        status: 400,
        reason: 'MESSAGE_TOO_LONG'
      }
    ];

    for (const testCase of cases) {
      const ctx = createController(testCase.room);
      const response = await ctx.controller.handleChat(testCase.request);
      const body = await readJson(response);

      expect(response.status).toBe(testCase.status);
      expect(body.reason).toBe(testCase.reason);
      expect(ctx.saved).toEqual([]);
      expect(ctx.broadcasts).toEqual([]);
    }
  });

  test('keeps only the configured chat history limit', async () => {
    const room = createRoom({
      chatSeq: 2,
      chatMessages: [
        { id: 1, seatKey: 'black', text: 'oldest', serverTime: 1 },
        { id: 2, seatKey: 'white', text: 'middle', serverTime: 2 }
      ]
    });
    const ctx = createController(room);

    await ctx.controller.handleChat({
      seatKey: 'black',
      seatToken: 'black-token',
      message: 'newest'
    });

    expect(room.chatMessages.map((message: any) => message.text)).toEqual(['middle', 'newest']);
    expect(room.chatSeq).toBe(3);
  });
});
