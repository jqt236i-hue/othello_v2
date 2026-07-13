import { JSDOM } from 'jsdom';

describe('my skin controls', () => {
  let dom: JSDOM;
  let definitions: any[];
  let storage: any;
  let backgroundController: any;
  let boardController: any;
  let stoneController: any;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="mySkinOptions"></div></body></html>', {
      url: 'https://example.test/'
    });
    global.window = dom.window as unknown as Window & typeof globalThis;
    global.document = dom.window.document;
    definitions = [
      {
        id: 'custom:background:night',
        kind: 'background',
        label: '夜空背景',
        note: '個人保存',
        imagePath: 'blob:background'
      },
      {
        id: 'custom:board:star',
        kind: 'board',
        label: '星盤',
        note: '個人保存',
        imagePath: 'blob:board'
      },
      {
        id: 'custom:stone:moon',
        kind: 'stone',
        label: '月石',
        note: '個人保存',
        blackImagePath: 'blob:black',
        whiteImagePath: 'blob:white'
      }
    ];
    backgroundController = {
      useSkin: jest.fn(() => definitions[0]),
      saveSkin: jest.fn(() => definitions[0]),
      getSelectedSkinId: jest.fn(() => 'default-25')
    };
    boardController = {
      useSkin: jest.fn(() => definitions[1]),
      saveSkin: jest.fn(() => definitions[1]),
      getSelectedSkinId: jest.fn(() => 'bluegreen-felt')
    };
    stoneController = {
      useSkin: jest.fn(() => definitions[2]),
      saveSkin: jest.fn(() => definitions[2]),
      getSelectedSkinId: jest.fn(() => 'o-stone')
    };
    storage = {
      getCustomSkinDefinitions: jest.fn(() => definitions.slice()),
      loadCustomSkins: jest.fn(async () => definitions.slice()),
      deleteCustomSkin: jest.fn(async (_root: Window, skinId: string) => {
        definitions = definitions.filter((definition) => definition.id !== skinId);
        return true;
      }),
      subscribeCustomSkins: jest.fn(() => () => undefined)
    };
    (window as any).CustomSkinStorageModule = storage;
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('shows saved custom skins only and exposes use, save, and delete actions', async () => {
    const controller = require('../ui/custom-skin/my-skin-controller.ts');
    controller.setupMySkinControls({
      root: window,
      document,
      optionsEl: document.getElementById('mySkinOptions'),
      backgroundControllerApi: backgroundController,
      boardControllerApi: boardController,
      stoneControllerApi: stoneController
    });
    await Promise.resolve();

    expect(document.querySelectorAll('.my-skin-card')).toHaveLength(3);
    expect(document.querySelectorAll('.my-skin-card-actions button')).toHaveLength(9);
    expect(document.body.textContent).not.toContain('既定');

    const backgroundCard = document.querySelector('[data-custom-skin-id="custom:background:night"]') as HTMLElement;
    (backgroundCard.querySelector('.my-skin-use') as HTMLButtonElement).click();
    expect(backgroundController.useSkin).toHaveBeenCalledWith('custom:background:night');
    expect(backgroundController.saveSkin).not.toHaveBeenCalled();
    expect(document.querySelector('.my-skin-status')?.textContent).toContain('一時使用');

    const refreshedBackgroundCard = document.querySelector('[data-custom-skin-id="custom:background:night"]') as HTMLElement;
    (refreshedBackgroundCard.querySelector('.my-skin-save') as HTMLButtonElement).click();
    expect(backgroundController.saveSkin).toHaveBeenCalledWith('custom:background:night');

    (document.querySelector('[data-custom-skin-id="custom:background:night"] .my-skin-delete') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(storage.deleteCustomSkin).toHaveBeenCalledWith(window, 'custom:background:night');
    expect(document.querySelector('[data-custom-skin-id="custom:background:night"]')).toBeNull();
  });
});
