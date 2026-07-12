const SpecialMarkerRenderer = require('../ui/diff-renderer/special-marker-renderer.ts');

describe('diff-renderer special marker renderer', () => {
  class FakeClassList {
    element: any;

    constructor(element: any) {
      this.element = element;
    }

    add(name: string) {
      const names = new Set(String(this.element.className || '').split(/\s+/).filter(Boolean));
      names.add(name);
      this.element.className = Array.from(names).join(' ');
    }

    contains(name: string) {
      return String(this.element.className || '').split(/\s+/).includes(name);
    }
  }

  class FakeElement {
    className = '';
    textContent = '';
    children: any[] = [];
    attributes: Record<string, string> = {};
    classList = new FakeClassList(this);

    appendChild(child: any) {
      this.children.push(child);
      return child;
    }

    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }

    querySelector(selector: string) {
      const className = selector.startsWith('.') ? selector.slice(1) : selector;
      const stack = this.children.slice();
      while (stack.length > 0) {
        const current = stack.shift();
        if (String(current.className || '').split(/\s+/).includes(className)) return current;
        if (Array.isArray(current.children)) stack.push(...current.children);
      }
      return null;
    }
  }

  function createFakeDocument() {
    return {
      createElement: () => new FakeElement()
    };
  }

  function createRenderer(applyDoubleDigitTimerClass?: any) {
    return SpecialMarkerRenderer.createSpecialMarkerRenderer({
      documentRef: createFakeDocument() as any,
      applyDoubleDigitTimerClass
    });
  }

  test('creates board shrink and meteor hole marks with existing class names', () => {
    const renderer = createRenderer();

    const shrink = renderer.createHoleMark('board-shrink', ['top', 'left']);
    expect(shrink.className).toBe('board-shrink-hole-mark');
    expect(Array.from(shrink.children).map((child: any) => child.className)).toEqual([
      'board-shrink-hole-inner-edge inner-edge-top',
      'board-shrink-hole-inner-edge inner-edge-left'
    ]);

    const meteor = renderer.createHoleMark('meteor');
    expect(meteor.className).toBe('meteor-hole-mark');
    expect(meteor.children.length).toBe(0);
  });

  test('creates blockade seed bonus timed guard and freeze labels', () => {
    const applied: any[] = [];
    const renderer = createRenderer((element: HTMLElement, value: any) => {
      applied.push({ className: element.className, value });
      element.classList.add('double-digit');
    });

    const blockade = renderer.createBlockadeMark(3);
    expect(blockade.className).toBe('blockade-mark');
    expect(blockade.querySelector('.blockade-turn')?.textContent).toBe('3');

    const seed = renderer.createSeedMark(12);
    expect(seed.className).toBe('seed-mark');
    expect(seed.querySelector('.seed-icon')).not.toBeNull();
    expect(seed.querySelector('.seed-turn')?.textContent).toBe('12');
    expect(seed.querySelector('.seed-turn')?.classList.contains('double-digit')).toBe(true);

    const bonus = renderer.createBonusLabel(-4);
    expect(bonus.className).toBe('board-bonus-number');
    expect(bonus.textContent).toBe('-4');

    const timed = renderer.createTimedMarkerLabel('stone-timer flip-evade-timer', 5.9);
    expect(timed.className).toContain('stone-timer');
    expect(timed.className).toContain('flip-evade-timer');
    expect(timed.textContent).toBe('5');

    const guard = renderer.createGuardTimerLabel(2);
    expect(guard.className).toContain('guard-timer');
    expect(guard.textContent).toBe('2');

    const regen = renderer.createRegenBadgeLabel(3);
    expect(regen.className).toContain('stone-regen-badge');
    expect(regen.attributes['data-count']).toBe('3');
    expect(regen.querySelector('.stone-regen-badge-value')?.textContent).toBe('3');

    const freeze = renderer.createFreezeMark(4);
    expect(freeze.className).toBe('freeze-mark');
    expect(freeze.querySelector('.freeze-turn')?.textContent).toBe('4');
    expect(applied.map((one) => one.className)).toEqual([
      'seed-turn countdown-timer',
      'stone-timer flip-evade-timer',
      'guard-timer',
      'stone-regen-badge'
    ]);
  });

  test('creates flip protection badge with stable marker text', () => {
    const renderer = createRenderer();

    const badge = renderer.createFlipProtectionBadge();

    expect(badge.className).toBe('stone-flip-protection-badge');
    expect(badge.textContent).toBe('反');
  });

  test('creates a dedicated poison lethal timer without the shared countdown marker', () => {
    const renderer = createRenderer();

    const timer = renderer.createPoisonLethalTimer(5.9);

    expect(timer.className).toBe('poison-lethal-timer');
    expect(timer.classList.contains('countdown-timer')).toBe(false);
    expect(timer.textContent).toBe('5');
    expect(timer.attributes['aria-hidden']).toBe('true');
  });
});
