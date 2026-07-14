const NetworkButtonActions = require('../ui/handlers/match-mode/network-button-actions');

function createOptions(leaveResult: any) {
  return {
    client: { leaveRoom: jest.fn(async () => leaveResult) },
    writeNetworkStatus: jest.fn(),
    setNetworkRoomDebugEnabled: jest.fn(),
    setNetworkRoomAutoEnabled: jest.fn(),
    debugCheckbox: { checked: true },
    autoCheckbox: { checked: true },
    applyNetworkDebugModeAccess: jest.fn(),
    refreshNetworkAutoModeAccess: jest.fn(),
    setMode: jest.fn(async () => undefined),
    cpuMode: 'cpu',
    renderNetworkDeckInfo: jest.fn(),
    refreshBoardUi: jest.fn()
  };
}

describe('network room leave button action', () => {
  test('keeps network UI and shows reload guidance when confirmed leave cleanup cannot settle', async () => {
    const options = createOptions({
      ok: false,
      reason: 'LEAVE_SETTLEMENT_DISPOSE_FAILED',
      authorityLeft: true,
      reloadRequired: true
    });

    await NetworkButtonActions.leaveNetworkRoom(options);

    expect(options.writeNetworkStatus).toHaveBeenCalledWith(expect.stringContaining('再読み込み'), true);
    expect(options.setMode).not.toHaveBeenCalled();
    expect(options.setNetworkRoomDebugEnabled).not.toHaveBeenCalled();
    expect(options.renderNetworkDeckInfo).not.toHaveBeenCalled();
    expect(options.refreshBoardUi).not.toHaveBeenCalled();
  });

  test('switches to local mode only after leave succeeds', async () => {
    const options = createOptions({ ok: true });

    await NetworkButtonActions.leaveNetworkRoom(options);

    expect(options.setMode).toHaveBeenCalledWith('cpu', { silentLog: true, skipNetworkLeave: true });
    expect(options.setNetworkRoomDebugEnabled).toHaveBeenCalledWith(false);
    expect(options.renderNetworkDeckInfo).toHaveBeenCalledWith(null);
    expect(options.refreshBoardUi).toHaveBeenCalledTimes(1);
  });
});
