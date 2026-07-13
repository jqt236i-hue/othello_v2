import { JSDOM } from 'jsdom';

describe('custom skin editor controls', () => {
  let dom: JSDOM;
  let storage: any;
  let customDefinitions: any[];
  let customFrameDefinitions: any[];

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><body>
      <div id="board-frame"></div>
      <div id="board"></div>
      <div id="boardSkinOptions"></div>
      <div id="boardFrameSkinOptions"></div>
    </body></html>`, { url: 'https://example.test/' });
    global.window = dom.window as unknown as Window & typeof globalThis;
    global.document = dom.window.document;
    customDefinitions = [];
    customFrameDefinitions = [];
    storage = {
      getCustomSkinDefinitions: (_root: Window, kind: string) => kind === 'board' ? customDefinitions : kind === 'board-frame' ? customFrameDefinitions : [],
      isCustomSkin: () => false,
      getCustomSkinRecord: () => null,
      saveCustomSkin: jest.fn(async (root: Window, input: any) => {
        if (input.kind === 'board-frame') {
          const definition = { id: 'custom:board-frame:test', kind: 'board-frame', label: '保存枠', note: '個人保存', imagePath: 'blob:frame' };
          customFrameDefinitions = [definition];
          storage.isCustomSkin = (value: string, kind: string) => value === definition.id && kind === 'board-frame';
          return definition;
        }
        const definition = { id: 'custom:board:test', kind: 'board', label: '保存盤面', note: '個人保存', imagePath: 'blob:board' };
        customDefinitions = [definition];
        storage.isCustomSkin = (value: string, kind: string) => value === definition.id && kind === 'board';
        return definition;
      }),
      deleteCustomSkin: jest.fn(),
      subscribeCustomSkins: jest.fn(),
      loadCustomSkins: jest.fn().mockResolvedValue([])
    };
    (window as any).CustomSkinStorageModule = storage;
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('renders image loading, save, and delete controls above the board catalog', () => {
    const controller = require('../ui/board-skin/controller.ts');
    controller.setupBoardSkinControls({ root: window });

    const editor = document.querySelector('.custom-skin-editor--board');
    expect(editor).not.toBeNull();
    expect(editor?.textContent).toContain('画像読み込み');
    expect(editor?.textContent).toContain('使用');
    expect(editor?.textContent).toContain('保存');
    expect(editor?.textContent).toContain('削除');
    expect((editor?.querySelector('.custom-skin-editor-use-button') as HTMLButtonElement).disabled).toBe(true);
    expect((editor?.querySelector('.custom-skin-editor-delete-button') as HTMLButtonElement).disabled).toBe(true);
  });

  test('persists the selected custom id after saving an uploaded board image', async () => {
    const controller = require('../ui/board-skin/controller.ts');
    controller.setupBoardSkinControls({ root: window });
    const fileInput = document.querySelector('.custom-skin-editor--board input[type="file"]') as HTMLInputElement;
    const file = new Blob(['image'], { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    (document.querySelector('.custom-skin-editor-name-input') as HTMLInputElement).value = '保存盤面';
    (document.querySelector('.custom-skin-editor-save-button') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(storage.saveCustomSkin).toHaveBeenCalled();
    expect(window.localStorage.getItem('reversi.boardSkin')).toBe('custom:board:test');

    const useButton = document.querySelector('.custom-skin-editor-use-button') as HTMLButtonElement;
    useButton.click();
    expect(window.localStorage.getItem('reversi.boardSkin')).toBe('custom:board:test');
    expect(document.querySelector('.custom-skin-editor-status')?.textContent).toContain('一時使用');
  });

  test('renders a custom image editor for board frames and persists the frame selection', async () => {
    const controller = require('../ui/board-skin/controller.ts');
    controller.setupBoardSkinControls({ root: window });

    const editor = document.querySelector('.custom-skin-editor--board-frame');
    expect(editor).not.toBeNull();
    expect(editor?.textContent).toContain('画像読み込み');
    expect(editor?.textContent).toContain('使用');
    expect(editor?.textContent).toContain('保存');
    expect(editor?.textContent).toContain('削除');

    const fileInput = editor?.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new Blob(['frame'], { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    (editor?.querySelector('.custom-skin-editor-name-input') as HTMLInputElement).value = '保存枠';
    (editor?.querySelector('.custom-skin-editor-save-button') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(storage.saveCustomSkin).toHaveBeenCalledWith(window, expect.objectContaining({ kind: 'board-frame' }));
    expect(window.localStorage.getItem('reversi.boardFrameSkin')).toBe('custom:board-frame:test');
  });
});
