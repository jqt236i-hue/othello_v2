import { appendMatchChatMessage, evaluateMatchChatPost, toPublicMatchChatMessages } from '../utils/match-chat-rules';

function input(overrides: Record<string, unknown> = {}) {
  return {
    seatKey: 'black' as const,
    seatToken: 'tb',
    seats: { black: true, white: true },
    seatTokens: { black: 'tb', white: 'tw' },
    message: 'hello',
    maxLength: 20,
    seatTokenRejectionReason: (token: string) => (token ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED'),
    ...overrides
  };
}

describe('shared match chat rules', () => {
  test('checks seat, then token, then both seats, then the message', () => {
    expect(evaluateMatchChatPost(input({ seats: { black: false, white: true }, seatToken: '', message: '' }))).toEqual({ ok: false, status: 403, reason: 'SEAT_NOT_JOINED' });
    expect(evaluateMatchChatPost(input({ seats: { black: true, white: false }, seatToken: ' ', message: '' }))).toEqual({ ok: false, status: 403, reason: 'SEAT_TOKEN_REQUIRED' });
    expect(evaluateMatchChatPost(input({ seats: { black: true, white: false }, message: '' }))).toEqual({ ok: false, status: 409, reason: 'CHAT_DISABLED' });
    expect(evaluateMatchChatPost(input({ message: 'x'.repeat(4), maxLength: 3 }))).toEqual({ ok: false, status: 400, reason: 'MESSAGE_TOO_LONG', maxLength: 3 });
    expect(evaluateMatchChatPost(input({ message: ' \r\n ' }))).toEqual({ ok: false, status: 400, reason: 'MESSAGE_REQUIRED', maxLength: 20 });
    expect(evaluateMatchChatPost(input({ seatToken: ' tb ', message: ' a\nb ' }))).toEqual({ ok: true, text: 'a b' });
  });

  test('appends with a bounded history and projects public messages', () => {
    const room: any = { chatSeq: 'bad' };
    for (let i = 0; i < 5; i += 1) appendMatchChatMessage(room, { seatKey: i % 2 ? 'white' : 'black', text: 't' + i, serverTime: 100 + i, historyLimit: 3 });
    expect(room.chatSeq).toBe(5);
    expect(room.updatedAt).toBe(104);
    expect(room.chatMessages.map((entry: any) => entry.id)).toEqual([3, 4, 5]);
    room.chatMessages.push({ id: 'x', seatKey: 'red', text: null });
    expect(toPublicMatchChatMessages(room, (value) => (value === 'white' ? 'white' : 'black'), () => 7).slice(-2)).toEqual([
      { id: 5, seatKey: 'black', text: 't4', serverTime: 104 },
      { id: 0, seatKey: 'black', text: '', serverTime: 7 }
    ]);
  });
});
