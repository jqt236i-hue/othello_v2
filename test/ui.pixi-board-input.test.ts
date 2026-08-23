describe('Pixi board input adapter', () => {
  function createHarness() {
    const nativeListeners = new Map<string, { listener: (event: any) => void; capture: boolean }>();
    const removedNative: Array<{ type: string; listener: unknown; capture: boolean }> = [];
    const viewport = {
      style: {
        pointerEvents: '',
        touchAction: '',
        cursor: ''
      },
      clientWidth: 100,
      clientHeight: 80,
      getBoundingClientRect: () => ({ width: 100, height: 80, left: 10, top: 20 }),
      addEventListener: (type: string, listener: (event: any) => void, capture: boolean) => {
        nativeListeners.set(type, { listener, capture });
      },
      removeEventListener: (type: string, listener: unknown, capture: boolean) => {
        removedNative.push({ type, listener, capture });
        const binding = nativeListeners.get(type);
        if (binding?.listener === listener && binding.capture === capture) nativeListeners.delete(type);
      }
    } as any;
    const federatedListeners = new Map<string, Set<(event: any) => void>>();
    const removedFederated: Array<{ type: string; listener: unknown }> = [];
    const interactionLayer = {
      on(type: string, listener: (event: any) => void) {
        const listeners = federatedListeners.get(type) || new Set<(event: any) => void>();
        listeners.add(listener);
        federatedListeners.set(type, listeners);
      },
      off(type: string, listener: (event: any) => void) {
        removedFederated.push({ type, listener });
        federatedListeners.get(type)?.delete(listener);
      },
      emit(type: string, event: any) {
        for (const listener of federatedListeners.get(type) || []) listener(event);
      }
    };
    let eventTarget: any = { style: { touchAction: 'none' } };
    const eventSystem = {
      autoPreventDefault: true,
      setTargetElement: jest.fn((next: any) => {
        if (eventTarget?.style) eventTarget.style.touchAction = '';
        eventTarget = next;
        if (eventTarget?.style) eventTarget.style.touchAction = 'none';
      })
    };
    const renderer = { resolution: 2, events: eventSystem };
    const events: any[] = [];
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextAnimationFrameId = 1;
    const hitTestClientPoint = jest.fn((x: number, y: number) => {
      if (x >= 10 && x < 50 && y >= 20 && y < 60) return { key: '2,3', row: 2, col: 3 };
      if (x >= 50 && x < 90 && y >= 20 && y < 60) return { key: '2,4', row: 2, col: 4 };
      return null;
    });
    const controller = {
      hitTestClientPoint,
      handlePointer: jest.fn((event: any) => {
        events.push(event);
        return true;
      })
    };
    const { createPixiBoardInput } = require('../ui/pixi/board-input.ts');
    const adapter = createPixiBoardInput({
      getController: () => controller,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        const id = nextAnimationFrameId++;
        animationFrames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (handle: unknown) => animationFrames.delete(Number(handle))
    });
    adapter.mount({ viewport, renderer, interactionLayer });
    const pointer = (type: string, overrides: Record<string, unknown> = {}) => {
      const nativeEvent = {
        pointerId: 7,
        pointerType: 'touch',
        button: 0,
        clientX: 20,
        clientY: 30,
        preventDefault: jest.fn(),
        ...overrides
      };
      if (type === 'pointercancel') {
        nativeListeners.get(type)?.listener(nativeEvent);
      } else {
        interactionLayer.emit(type, { nativeEvent, preventDefault: jest.fn() });
      }
      return nativeEvent;
    };
    const flushAnimationFrame = () => {
      const callbacks = Array.from(animationFrames.values());
      animationFrames.clear();
      callbacks.forEach((callback) => callback(16));
    };
    return {
      adapter,
      viewport,
      renderer,
      eventSystem,
      interactionLayer,
      federatedListeners,
      nativeListeners,
      removedFederated,
      removedNative,
      controller,
      events,
      pointer,
      animationFrames,
      flushAnimationFrame
    };
  }

  test('normalizes a same-cell Federated pointer sequence and leaves native pan/pinch enabled', () => {
    const harness = createHarness();

    harness.pointer('pointerdown');
    harness.pointer('globalpointermove', { clientX: 24, clientY: 34 });
    harness.pointer('pointerup', { clientX: 25, clientY: 35 });

    expect(harness.events.map((event) => event.type)).toEqual([
      'pointerenter',
      'pointerdown',
      'pointermove',
      'pointerup'
    ]);
    expect(harness.events[1]).toMatchObject({ row: 2, col: 3, pointerId: 7, pointerType: 'touch' });
    expect(harness.eventSystem.setTargetElement).toHaveBeenNthCalledWith(1, harness.viewport);
    expect(harness.eventSystem.autoPreventDefault).toBe(false);
    expect(harness.viewport.style.touchAction).toBe('pan-x pan-y pinch-zoom');
    expect(harness.viewport.width).toBe(200);
    expect(harness.viewport.height).toBe(160);
    expect(Array.from(harness.nativeListeners.keys())).toEqual([
      'pointerdown',
      'pointerup',
      'pointerleave',
      'pointercancel'
    ]);
    expect(Array.from(harness.federatedListeners.keys())).toEqual([
      'pointerdown',
      'globalpointermove',
      'pointerup',
      'pointerupoutside',
      'pointerleave'
    ]);
  });

  test('routes release over another cell or outside the Pixi boundary as pointerupoutside', () => {
    const harness = createHarness();

    harness.pointer('pointerdown');
    harness.pointer('globalpointermove', { clientX: 60, clientY: 30 });
    harness.pointer('pointerup', { clientX: 60, clientY: 30 });

    expect(harness.events.map((event) => `${event.type}:${event.row},${event.col}`)).toEqual([
      'pointerenter:2,3',
      'pointerdown:2,3',
      'pointermove:2,3',
      'pointerleave:2,3',
      'pointerenter:2,4',
      'pointerupoutside:2,3'
    ]);

    harness.pointer('pointerdown', { clientX: 60, clientY: 30 });
    harness.pointer('pointerupoutside', { clientX: 60, clientY: 30 });
    expect(harness.events.at(-1)).toMatchObject({ type: 'pointerupoutside', row: 2, col: 4 });
  });

  test('uses native capture when the transparent viewport misses a Federated press without dispatching twice', () => {
    const harness = createHarness();
    const nativeEvent = {
      pointerId: 7,
      pointerType: 'mouse',
      button: 0,
      clientX: 20,
      clientY: 30,
      preventDefault: jest.fn()
    };

    harness.nativeListeners.get('pointerdown')?.listener(nativeEvent);
    harness.interactionLayer.emit('pointerdown', { nativeEvent, preventDefault: jest.fn() });
    harness.nativeListeners.get('pointerup')?.listener(nativeEvent);
    harness.interactionLayer.emit('pointerup', { nativeEvent, preventDefault: jest.fn() });

    expect(harness.events.map((event) => event.type)).toEqual([
      'pointerenter',
      'pointerdown',
      'pointerup'
    ]);
    expect(harness.controller.handlePointer).toHaveBeenCalledTimes(3);
  });

  test('supplements Pixi with native pointer lifecycle and removes every owned listener', () => {
    const harness = createHarness();
    harness.pointer('pointerdown');
    harness.pointer('pointercancel');

    expect(harness.events.at(-1)).toMatchObject({ type: 'pointercancel', row: 2, col: 3 });
    expect(harness.adapter.getDiagnostics()).toMatchObject({
      mounted: true,
      listenerCount: 9,
      federatedListenerCount: 5,
      nativeListenerCount: 4,
      activePointerId: null
    });

    harness.adapter.destroy();
    expect(harness.removedFederated.map((binding) => binding.type)).toEqual([
      'pointerdown',
      'globalpointermove',
      'pointerup',
      'pointerupoutside',
      'pointerleave'
    ]);
    expect(harness.removedNative.map((binding) => binding.type)).toEqual([
      'pointerdown',
      'pointerup',
      'pointerleave',
      'pointercancel'
    ]);
    expect(harness.removedNative.every((binding) => binding.capture === true)).toBe(true);
    expect(harness.eventSystem.setTargetElement).toHaveBeenLastCalledWith(null);
    expect(harness.adapter.getDiagnostics()).toMatchObject({
      mounted: false,
      destroyed: true,
      listenerCount: 0
    });
  });

  test('destroy cancels a retained press/hover and restores target-owned state', () => {
    const harness = createHarness();
    harness.pointer('pointerdown', { pointerType: 'pen' });
    harness.adapter.syncViewportMetrics({ width: 160, height: 120, resolution: 2 });

    expect(harness.adapter.getDiagnostics()).toMatchObject({ targetWidth: 320, targetHeight: 240 });
    harness.adapter.destroy();

    expect(harness.events.slice(-2).map((event) => event.type)).toEqual([
      'pointercancel',
      'pointerleave'
    ]);
    expect(harness.eventSystem.autoPreventDefault).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(harness.viewport, 'width')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(harness.viewport, 'height')).toBe(false);
    expect(harness.viewport.style).toMatchObject({ pointerEvents: '', touchAction: '', cursor: '' });
  });

  test('retries one frame after a transient layout miss and never retries twice', () => {
    const harness = createHarness();
    harness.controller.hitTestClientPoint
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ key: '2,3', row: 2, col: 3 });

    harness.pointer('pointerdown');
    expect(harness.events).toEqual([]);
    expect(harness.adapter.getDiagnostics().pendingRetryPointerId).toBe(7);

    harness.flushAnimationFrame();
    expect(harness.events.map((event) => event.type)).toEqual(['pointerenter', 'pointerdown']);
    expect(harness.controller.hitTestClientPoint).toHaveBeenCalledTimes(2);
    expect(harness.adapter.getDiagnostics().pendingRetryPointerId).toBeNull();
  });

  test('cancels a pending layout retry when the pointer moves or ends', () => {
    const harness = createHarness();
    harness.controller.hitTestClientPoint.mockReturnValue(null);

    harness.pointer('pointerdown', { clientX: 2, clientY: 3 });
    expect(harness.animationFrames.size).toBe(1);
    harness.pointer('globalpointermove', { clientX: 4, clientY: 5 });
    expect(harness.adapter.getDiagnostics()).toMatchObject({
      pendingRetryPointerId: null,
      pendingMoveCount: 1
    });
    expect(harness.animationFrames.size).toBe(1);
    harness.flushAnimationFrame();
    expect(harness.events).toEqual([]);

    harness.pointer('pointerdown', { clientX: 2, clientY: 3 });
    harness.pointer('pointerupoutside', { clientX: 2, clientY: 3 });
    harness.flushAnimationFrame();
    expect(harness.events).toEqual([]);
  });

  test('coalesces high-frequency moves to one hit test and hover update per frame', () => {
    const harness = createHarness();
    harness.pointer('pointerdown', { pointerType: 'mouse' });
    harness.controller.hitTestClientPoint.mockClear();
    harness.controller.handlePointer.mockClear();
    harness.events.length = 0;

    for (let index = 0; index < 100; index += 1) {
      harness.pointer('globalpointermove', {
        pointerType: 'mouse',
        clientX: index === 99 ? 60 : 20 + index / 10,
        clientY: 30
      });
    }

    expect(harness.controller.hitTestClientPoint).not.toHaveBeenCalled();
    expect(harness.controller.handlePointer).not.toHaveBeenCalled();
    expect(harness.adapter.getDiagnostics()).toMatchObject({
      pendingMoveCount: 1,
      pendingMovePointerIds: [7],
      rawPointerMoveCount: 100,
      processedPointerMoveCount: 0
    });

    harness.flushAnimationFrame();

    expect(harness.controller.hitTestClientPoint).toHaveBeenCalledTimes(1);
    expect(harness.events.map((event) => event.type)).toEqual([
      'pointermove',
      'pointerleave',
      'pointerenter'
    ]);
    expect(harness.events.at(-1)).toMatchObject({ row: 2, col: 4, clientX: 60 });
    expect(harness.adapter.getDiagnostics()).toMatchObject({
      pendingMoveCount: 0,
      rawPointerMoveCount: 100,
      processedPointerMoveCount: 1
    });
  });

  test('flushes before release and retains the largest press excursion in a coalesced frame', () => {
    const harness = createHarness();
    harness.pointer('pointerdown', { pointerType: 'mouse', clientX: 20, clientY: 30 });
    harness.pointer('globalpointermove', { pointerType: 'mouse', clientX: 40, clientY: 30 });
    harness.pointer('globalpointermove', { pointerType: 'mouse', clientX: 21, clientY: 30 });

    expect(harness.animationFrames.size).toBe(1);
    harness.pointer('pointerup', { pointerType: 'mouse', clientX: 21, clientY: 30 });

    expect(harness.animationFrames.size).toBe(0);
    expect(harness.events.map((event) => event.type)).toEqual([
      'pointerenter',
      'pointerdown',
      'pointermove',
      'pointerup'
    ]);
    expect(harness.events[2]).toMatchObject({ clientX: 40, clientY: 30 });
    expect(harness.adapter.getDiagnostics()).toMatchObject({
      pendingMoveCount: 0,
      rawPointerMoveCount: 2,
      processedPointerMoveCount: 1
    });
  });

  test('does not retain a pointer rejected by the shared controller', () => {
    const harness = createHarness();
    harness.controller.handlePointer.mockImplementation((event: any) => {
      harness.events.push(event);
      return event.type !== 'pointerdown';
    });

    harness.pointer('pointerdown');

    expect(harness.adapter.getDiagnostics()).toMatchObject({
      activePointerId: null,
      activeCellKey: null
    });
  });

  test('routes native pointer events from a canvas overlay outside the viewport box', () => {
    const nativeListeners = new Map<string, { listener: (event: any) => void; capture: boolean }>();
    const pointerRoot = {
      style: { pointerEvents: 'none', touchAction: '', cursor: '' },
      addEventListener: (type: string, listener: (event: any) => void, capture: boolean) => {
        nativeListeners.set(type, { listener, capture });
      },
      removeEventListener: (type: string, listener: unknown, capture: boolean) => {
        const binding = nativeListeners.get(type);
        if (binding?.listener === listener && binding.capture === capture) nativeListeners.delete(type);
      },
      setPointerCapture: jest.fn(),
      releasePointerCapture: jest.fn(),
      hasPointerCapture: jest.fn(() => true)
    } as any;
    const viewport = {
      style: { pointerEvents: '', touchAction: '', cursor: '' },
      clientWidth: 100,
      clientHeight: 80,
      getBoundingClientRect: () => ({ width: 100, height: 80, left: 10, top: 20 }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as any;
    const interactionLayer = {
      on: jest.fn(),
      off: jest.fn()
    };
    const eventSystem = {
      autoPreventDefault: true,
      setTargetElement: jest.fn()
    };
    const events: any[] = [];
    const controller = {
      hitTestClientPoint: jest.fn((x: number, y: number) => {
        if (x >= -30 && x < 10 && y >= 20 && y < 60) return { key: '2,-1', row: 2, col: -1 };
        return null;
      }),
      handlePointer: jest.fn((event: any) => {
        events.push(event);
        return true;
      })
    };
    const { createPixiBoardInput } = require('../ui/pixi/board-input.ts');
    const adapter = createPixiBoardInput({ getController: () => controller });
    adapter.mount({
      viewport,
      pointerRoot,
      renderer: { resolution: 2, events: eventSystem },
      interactionLayer
    });

    const nativeEvent = {
      pointerId: 11,
      pointerType: 'mouse',
      button: 0,
      clientX: -10,
      clientY: 30,
      preventDefault: jest.fn()
    };
    nativeListeners.get('pointerdown')?.listener(nativeEvent);
    nativeListeners.get('pointerup')?.listener(nativeEvent);

    expect(Array.from(nativeListeners.keys())).toEqual([
      'pointerdown',
      'pointerup',
      'pointerleave',
      'pointercancel',
      'pointermove'
    ]);
    expect(viewport.addEventListener).not.toHaveBeenCalled();
    expect(eventSystem.setTargetElement).toHaveBeenCalledWith(viewport);
    expect(pointerRoot.style.pointerEvents).toBe('auto');
    expect(pointerRoot.setPointerCapture).toHaveBeenCalledWith(11);
    expect(events.map((event) => `${event.type}:${event.row},${event.col}`)).toEqual([
      'pointerenter:2,-1',
      'pointerdown:2,-1',
      'pointerup:2,-1'
    ]);
    expect(adapter.getDiagnostics()).toMatchObject({
      nativeListenerCount: 5,
      federatedListenerCount: 5
    });
    adapter.destroy();
    expect(pointerRoot.releasePointerCapture).toHaveBeenCalled();
  });

  test('routes document-capture pointers for expansion cells outside the board hit box', () => {
    const nativeListeners = new Map<string, { listener: (event: any) => void; capture: boolean }>();
    const pointerRoot = {
      nodeType: 9,
      addEventListener: (type: string, listener: (event: any) => void, capture: boolean) => {
        nativeListeners.set(type, { listener, capture });
      },
      removeEventListener: (type: string, listener: unknown, capture: boolean) => {
        const binding = nativeListeners.get(type);
        if (binding?.listener === listener && binding.capture === capture) nativeListeners.delete(type);
      }
    } as any;
    const viewport = {
      style: { pointerEvents: '', touchAction: '', cursor: '' },
      clientWidth: 100,
      clientHeight: 80,
      getBoundingClientRect: () => ({ width: 100, height: 80, left: 10, top: 20 }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as any;
    const events: any[] = [];
    const controller = {
      hitTestClientPoint: jest.fn((x: number, y: number) => {
        if (x >= 140 && x < 180 && y >= 40 && y < 80) return { key: '3,8', row: 3, col: 8 };
        return null;
      }),
      handlePointer: jest.fn((event: any) => {
        events.push(event);
        return true;
      })
    };
    const { createPixiBoardInput } = require('../ui/pixi/board-input.ts');
    const adapter = createPixiBoardInput({ getController: () => controller });
    adapter.mount({
      viewport,
      pointerRoot,
      renderer: { resolution: 2, events: { autoPreventDefault: true, setTargetElement: jest.fn() } },
      interactionLayer: { on: jest.fn(), off: jest.fn() }
    });

    const nativeEvent = {
      pointerId: 13,
      pointerType: 'mouse',
      button: 0,
      clientX: 155,
      clientY: 55,
      target: { closest: () => null },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn()
    };
    nativeListeners.get('pointerdown')?.listener(nativeEvent);
    nativeListeners.get('pointerup')?.listener(nativeEvent);

    expect(Array.from(nativeListeners.keys())).toEqual([
      'pointerdown',
      'pointerup',
      'pointercancel',
      'pointermove'
    ]);
    expect(events.map((event) => `${event.type}:${event.row},${event.col}`)).toEqual([
      'pointerenter:3,8',
      'pointerdown:3,8',
      'pointerup:3,8'
    ]);
    expect(nativeEvent.stopPropagation).toHaveBeenCalled();
    expect(adapter.getDiagnostics()).toMatchObject({
      nativeListenerCount: 4,
      activePointerId: null
    });
    adapter.destroy();
  });

  test('does not steal document-capture presses that start on card, HUD, or modal controls', () => {
    const nativeListeners = new Map<string, { listener: (event: any) => void; capture: boolean }>();
    const pointerRoot = {
      nodeType: 9,
      addEventListener: (type: string, listener: (event: any) => void, capture: boolean) => {
        nativeListeners.set(type, { listener, capture });
      },
      removeEventListener: (type: string, listener: unknown, capture: boolean) => {
        const binding = nativeListeners.get(type);
        if (binding?.listener === listener && binding.capture === capture) nativeListeners.delete(type);
      }
    } as any;
    const viewport = {
      style: { pointerEvents: '', touchAction: '', cursor: '' },
      clientWidth: 100,
      clientHeight: 80,
      getBoundingClientRect: () => ({ width: 100, height: 80, left: 10, top: 20 }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as any;
    const handlePointer = jest.fn(() => true);
    const { createPixiBoardInput } = require('../ui/pixi/board-input.ts');
    const adapter = createPixiBoardInput({
      getController: () => ({
        hitTestClientPoint: () => ({ key: '3,8', row: 3, col: 8 }),
        handlePointer
      })
    });
    adapter.mount({
      viewport,
      pointerRoot,
      renderer: { resolution: 2, events: { autoPreventDefault: true, setTargetElement: jest.fn() } },
      interactionLayer: { on: jest.fn(), off: jest.fn() }
    });

    const nativeEvent = {
      pointerId: 14,
      pointerType: 'mouse',
      button: 0,
      clientX: 155,
      clientY: 55,
      target: { closest: (selector: string) => (selector.includes('.card-item') ? {} : null) },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn()
    };
    nativeListeners.get('pointerdown')?.listener(nativeEvent);

    const modalEvent = {
      ...nativeEvent,
      pointerId: 15,
      target: { closest: (selector: string) => (selector.includes('[aria-modal="true"]') ? {} : null) }
    };
    nativeListeners.get('pointerdown')?.listener(modalEvent);

    expect(handlePointer).not.toHaveBeenCalled();
    expect(nativeEvent.stopPropagation).not.toHaveBeenCalled();
    adapter.destroy();
  });
});
