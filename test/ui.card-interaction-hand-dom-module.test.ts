import { JSDOM } from 'jsdom';
import { createCardInteractionHandDom } from '../cards/card-interaction-hand-dom';

function createController() {
  const dom = new JSDOM(`
    <!doctype html><html><body>
      <div id="hand-black" data-owner-key="black">
        <div class="card-item hidden" data-card-id="dragon_01" data-owner-key="black"></div>
        <div class="card-item card-fade-prep card-fade-in" data-card-id="dragon_01" data-owner-key="black" style="--card-fade-in-duration: 200ms"></div>
      </div>
      <div id="hand-white" data-owner-key="white">
        <div class="card-item" data-card-id="dragon_01" data-owner-key="white"></div>
      </div>
    </body></html>
  `);
  const ownerHelpersModule = {
    filterOwnerMatchedElements: jest.fn((elements, ownerKey) => elements.filter((el: any) => el.dataset.ownerKey === ownerKey)),
    getElementOwnerKey: jest.fn((el) => el.dataset.ownerKey || null)
  };
  const controller = createCardInteractionHandDom({
    normalizeOwnerKey: (ownerKey) => ownerKey === 'white' ? 'white' : 'black',
    ownerHelpersModule,
    getDocumentRef: () => dom.window.document,
    getWindowRef: () => dom.window as any
  });

  return { controller, dom, ownerHelpersModule };
}

describe('card interaction hand DOM module', () => {
  test('finds owner hand containers and visible matching card element', () => {
    const { controller, dom, ownerHelpersModule } = createController();

    expect(controller.getOwnerHandContainers('black')).toEqual([
      dom.window.document.getElementById('hand-black')
    ]);
    expect(ownerHelpersModule.filterOwnerMatchedElements).toHaveBeenCalled();

    const blackCard = controller.findCardElementInOwnerHand('dragon_01', 'black');
    expect(blackCard).toBeTruthy();
    expect(blackCard?.classList.contains('hidden')).toBe(false);

    const whiteCard = controller.findCardElementInOwnerHand('dragon_01', 'white');
    expect(whiteCard).toBe(dom.window.document.querySelector('#hand-white .card-item'));
  });

  test('settles lingering fade classes and clears matching window fade state', () => {
    const { controller, dom } = createController();
    (dom.window as any).__handFadeInState = { playerKey: 'black' };
    (dom.window as any).__handFadeInHint = { playerKey: 'white' };

    controller.settleLingeringHandFadeForOwner('black');

    const fadedCard = dom.window.document.querySelector('#hand-black .card-item:not(.hidden)') as HTMLElement;
    expect(fadedCard.classList.contains('card-fade-prep')).toBe(false);
    expect(fadedCard.classList.contains('card-fade-in')).toBe(false);
    expect(fadedCard.style.getPropertyValue('--card-fade-in-duration')).toBe('');
    expect((dom.window as any).__handFadeInState).toBeNull();
    expect((dom.window as any).__handFadeInHint).toEqual({ playerKey: 'white' });
  });
});
