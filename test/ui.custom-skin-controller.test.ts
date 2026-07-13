import { JSDOM } from 'jsdom';

describe('custom skin editor controls', () => {
  let dom: JSDOM;
  let storage: any;
  let customDefinitions: any[];

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
    storage = {
      getCustomSkinDefinitions: (_root: Window, kind: string) => kind === 'board' ? customDefinitions : [],
      isCustomSkin: () => false,
      getCustomSkinRecord: () => null,
      saveCustomSkin: jest.fn(async () => {
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
    expect(editor?.textContent).toContain('保存');
    expect(editor?.textContent).toContain('削除');
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

    expect(storage.saveCustomSkin).toHaveBeenCalled();
    expect(window.localStorage.getItem('reversi.boardSkin')).toBe('custom:board:test');
  });
});
