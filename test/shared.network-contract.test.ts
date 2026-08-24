import * as NetworkContract from '../shared/network-contract';

const MatchAuthority = require('../utils/match-authority');

describe('shared network contract', () => {
  test('keeps room-id normalization and validation exact', () => {
    expect(NetworkContract.normalizeNetworkRoomId(' ab9 ')).toBe('AB9');
    expect(NetworkContract.normalizeNetworkRoomId(0)).toBe('');
    expect(NetworkContract.isValidNetworkRoomId('ab9')).toBe(true);
    expect(NetworkContract.isValidNetworkRoomId('AB')).toBe(false);
    expect(NetworkContract.isValidNetworkRoomId('A!9')).toBe(false);
    expect(MatchAuthority.normalizeNetworkRoomId(' ab9 ')).toBe('AB9');
    expect(MatchAuthority.isValidNetworkRoomId('ab9')).toBe(true);
  });

  test('keeps player-name and chat validation behavior exact', () => {
    expect(NetworkContract.normalizeNetworkPlayerName('  A\nB\tC  ')).toBe('A B C');
    expect(NetworkContract.normalizeNetworkPlayerName('12345678')).toBe('1234567');
    expect(MatchAuthority.normalizeNetworkPlayerName('  A\nB\tC  ')).toBe('A B C');
    expect(NetworkContract.validateNetworkChatMessage(' a\n b ')).toEqual({ ok: true, text: 'a  b' });
    expect(NetworkContract.validateNetworkChatMessage('')).toEqual({ ok: false, reason: 'MESSAGE_REQUIRED' });
    expect(NetworkContract.validateNetworkChatMessage('123456789012345678901')).toEqual({ ok: false, reason: 'MESSAGE_TOO_LONG' });
    expect(MatchAuthority.parseNetworkChatMessage(' a\n b ')).toEqual({ ok: true, text: 'a  b' });
  });

  test('keeps all runtime-facing limits in one portable contract', () => {
    expect(MatchAuthority.NETWORK_PLAYER_NAME_MAX).toBe(NetworkContract.NETWORK_PLAYER_NAME_MAX);
    expect(MatchAuthority.CHAT_MAX_LENGTH).toBe(NetworkContract.NETWORK_CHAT_MAX_LENGTH);
    expect(MatchAuthority.CHAT_HISTORY_LIMIT).toBe(NetworkContract.NETWORK_CHAT_HISTORY_LIMIT);
    expect(MatchAuthority.NETWORK_TURN_LIMIT_SECONDS).toBe(NetworkContract.NETWORK_TURN_LIMIT_SECONDS);
    expect(MatchAuthority.NETWORK_TURN_LIMIT_MS).toBe(NetworkContract.NETWORK_TURN_LIMIT_MS);
    expect(MatchAuthority.ROOM_ID_LENGTH).toBe(NetworkContract.NETWORK_ROOM_ID_LENGTH);
  });

  test('normalizes room turn time to an integer between 3 and 1800 seconds', () => {
    expect(NetworkContract.normalizeNetworkTurnLimitSeconds(undefined)).toBe(120);
    expect(NetworkContract.normalizeNetworkTurnLimitSeconds('')).toBe(120);
    expect(NetworkContract.normalizeNetworkTurnLimitSeconds('3')).toBe(3);
    expect(NetworkContract.normalizeNetworkTurnLimitSeconds(1800.9)).toBe(1800);
    expect(NetworkContract.normalizeNetworkTurnLimitSeconds(2)).toBe(3);
    expect(NetworkContract.normalizeNetworkTurnLimitSeconds(1801)).toBe(1800);
    expect(NetworkContract.normalizeNetworkTurnLimitSeconds('invalid')).toBe(120);
  });
});
