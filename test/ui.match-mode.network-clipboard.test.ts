import { JSDOM } from 'jsdom';

const NetworkClipboard = require('../ui/handlers/match-mode/network-clipboard');

describe('match-mode network clipboard helper', () => {
  test('uses navigator.clipboard when available', async () => {
    const writeText = jest.fn(async () => undefined);
    const root = { navigator: { clipboard: { writeText } } };

    await expect(NetworkClipboard.copyTextToClipboard(root, null, 'ROOM-1')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('ROOM-1');
  });

  test('falls back to a hidden textarea copy command', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const execCommand = jest.fn(() => true);
    dom.window.document.execCommand = execCommand;

    await expect(NetworkClipboard.copyTextToClipboard({}, dom.window.document, 'ROOM-2')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(dom.window.document.querySelector('textarea')).toBeNull();

    dom.window.close();
  });
});
