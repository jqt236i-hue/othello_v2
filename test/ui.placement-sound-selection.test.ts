import { JSDOM } from 'jsdom';

describe('placement sound selection', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('lists the default sound and unlocked placement sounds from the observation catalog', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    import * as storageModule from '../ui/storage/gacha-progress.js';
    import * as selectionModule from '../ui/placement-sound-selection.js';

    dom.window.GachaProgressStorage = storageModule;
    dom.window.ObservationGachaCatalogAccessModule = {
      getObservationCatalogItemsByKind: jest.fn(() => ([
        {
          id: 'gacha__n__placement_sound__type-1-standard',
          kind: 'placement_sound',
          label: 'type-1-standard',
          assetPath: 'assets/images/Gacha/N/type-1-standard.mp3'
        },
        {
          id: 'gacha__n__placement_sound__type-3-heavy',
          kind: 'placement_sound',
          label: 'type-3-heavy',
          assetPath: 'assets/images/Gacha/N/type-3-heavy.mp3'
        }
      ]))
    };

    storageModule.unlockPlacementSoundIds(dom.window, ['gacha__n__placement_sound__type-3-heavy']);

    expect(selectionModule.listSelectablePlacementSounds({ root: dom.window }).map((item) => item.id)).toEqual([
      'default',
      'gacha__n__placement_sound__type-3-heavy'
    ]);

    dom.window.close();
  });

  test('selected sound falls back to default when storage points to an unowned sound', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    import * as selectionModule from '../ui/placement-sound-selection.js';

    dom.window.localStorage.setItem('othello.placementSound', 'gacha__n__placement_sound__type-1-standard');
    dom.window.ObservationGachaCatalogAccessModule = {
      getObservationCatalogItemsByKind: jest.fn(() => ([
        {
          id: 'gacha__n__placement_sound__type-1-standard',
          kind: 'placement_sound',
          label: 'type-1-standard',
          assetPath: 'assets/images/Gacha/N/type-1-standard.mp3'
        }
      ]))
    };
    dom.window.GachaProgressStorage = {
      listOwnedPlacementSoundIds: jest.fn(() => ['default'])
    };

    expect(selectionModule.getSelectedPlacementSoundId({ root: dom.window })).toBe('default');
    expect(dom.window.localStorage.getItem('othello.placementSound')).toBe('default');
    expect(selectionModule.resolveSelectedPlacementSoundFilePath({ root: dom.window })).toBe('assets/audio/sound-effect-skin/default.mp3');

    dom.window.close();
  });
});
