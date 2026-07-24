import { JSDOM } from 'jsdom';

describe('network rematch request dialog', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('deduplicates a replayed request and closes it when the matching response arrives', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const client = {
      hasPendingRematchRequest: jest.fn(() => false),
      acceptRematchRequest: jest.fn(async () => ({ ok: true })),
      declineRematchRequest: jest.fn(async () => ({ ok: true }))
    };
    const options = {
      root: dom.window,
      getNetworkMatchClient: () => client
    };
    const { showNetworkRematchRequestDialog } = require(
      '../ui/handlers/match-mode/network-client-listeners.ts'
    );

    showNetworkRematchRequestDialog({
      type: 'request',
      requestId: 'rematch_req_1'
    }, options);
    const initial = dom.window.document.getElementById('network-rematch-request-dialog');
    expect(initial).toBeTruthy();
    expect(initial?.getAttribute('data-rematch-request-id')).toBe('rematch_req_1');

    showNetworkRematchRequestDialog({
      type: 'request',
      requestId: 'rematch_req_1'
    }, options);
    expect(dom.window.document.getElementById('network-rematch-request-dialog')).toBe(initial);

    showNetworkRematchRequestDialog({
      type: 'response',
      requestId: 'rematch_req_1',
      accepted: true
    }, options);
    expect(dom.window.document.getElementById('network-rematch-request-dialog')).toBeNull();

    showNetworkRematchRequestDialog({
      type: 'request',
      requestId: 'rematch_req_1'
    }, options);
    expect(dom.window.document.getElementById('network-rematch-request-dialog')).toBeNull();

    dom.window.close();
  });

  test('treats crossed pending requests as mutual consent without opening two dialogs', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const client = {
      hasPendingRematchRequest: jest.fn(() => true),
      acceptRematchRequest: jest.fn(async () => ({ ok: true })),
      declineRematchRequest: jest.fn(async () => ({ ok: true }))
    };
    const options = {
      root: dom.window,
      getNetworkMatchClient: () => client
    };
    const { showNetworkRematchRequestDialog } = require(
      '../ui/handlers/match-mode/network-client-listeners.ts'
    );

    showNetworkRematchRequestDialog({
      type: 'request',
      requestId: 'rematch_crossed_1'
    }, options);
    await Promise.resolve();

    expect(client.acceptRematchRequest).toHaveBeenCalledTimes(1);
    expect(client.acceptRematchRequest).toHaveBeenCalledWith('rematch_crossed_1');
    expect(dom.window.document.getElementById('network-rematch-request-dialog')).toBeNull();

    showNetworkRematchRequestDialog({
      type: 'request',
      requestId: 'rematch_crossed_1'
    }, options);
    expect(client.acceptRematchRequest).toHaveBeenCalledTimes(1);

    dom.window.close();
  });
});
