describe('NetworkRoomEventsController: 観戦者と席のプレイヤーの表示分け', () => {
  function setup(stateOverrides) {
    const state: any = Object.assign({ seatKey: 'black', viewerRole: 'player', chatHistory: [] }, stateOverrides);
    const logs: string[] = [];
    const rematchEvents: any[] = [];
    state.rematchRequestListener = (event) => rematchEvents.push(event);
    const { createNetworkRoomEventsController } = require('../ui/network/room-events.js');
    const controller = createNetworkRoomEventsController({
      getState: () => state,
      emitStatusAndEffectLog: (message) => logs.push(message),
      getSeatDisplayName: (key) => (key === 'white' ? '白' : '黒')
    });
    return { controller, logs, rematchEvents };
  }

  test('観戦者には再戦申請のモーダル用イベントも「送信しました」も出ない', () => {
    const { controller, logs, rematchEvents } = setup({ viewerRole: 'spectator' });
    controller.handlePresencePayload({ ok: true, type: 'rematch_request', seatKey: 'white', requestId: 'r1' });
    controller.handlePresencePayload({ ok: true, type: 'rematch_request', seatKey: 'black', requestId: 'r2' });
    controller.handlePresencePayload({ ok: true, type: 'rematch_response', seatKey: 'white', requestId: 'r1', accepted: true });
    expect(rematchEvents).toEqual([]);
    expect(logs.some((m) => m.includes('送信しました'))).toBe(false);
  });

  test('観戦者には黒白どちらの入退室も第三者視点で出る', () => {
    const { controller, logs } = setup({ viewerRole: 'spectator' });
    controller.handlePresencePayload({ ok: true, type: 'leave', seatKey: 'black' });
    controller.handlePresencePayload({ ok: true, type: 'leave', seatKey: 'white' });
    expect(logs).toEqual(['ネット対戦: 黒が退出しました', 'ネット対戦: 白が退出しました']);
  });

  test('観戦者には「あなたの手番」ではなく席名で時間切れが出る', () => {
    const { controller, logs } = setup({ viewerRole: 'spectator' });
    controller.handleTimeoutPassPayload({ ok: true, actionType: 'timeout_pass', playerKey: 'black' });
    expect(logs).toEqual(['ネット対戦: 黒の手番が時間切れになりました']);
  });

  test('席のプレイヤーは従来どおり（自分の申請・時間切れ・相手の申請）', () => {
    const { controller, logs, rematchEvents } = setup({});
    controller.handlePresencePayload({ ok: true, type: 'rematch_request', seatKey: 'black', requestId: 'r1' });
    controller.handlePresencePayload({ ok: true, type: 'rematch_request', seatKey: 'white', requestId: 'r2' });
    controller.handleTimeoutPassPayload({ ok: true, actionType: 'timeout_pass', playerKey: 'black' });
    controller.handlePresencePayload({ ok: true, type: 'leave', seatKey: 'black' });
    expect(logs).toEqual([
      'ネット対戦: 再戦申請を送信しました',
      'ネット対戦: あなたの手番が時間切れになりました'
    ]);
    expect(rematchEvents.map((e) => e.requestId)).toEqual(['r2']);
  });
});
