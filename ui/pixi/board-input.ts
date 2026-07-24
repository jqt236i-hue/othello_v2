export type PixiBoardPointerEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointerupoutside'
  | 'pointercancel'
  | 'pointerenter'
  | 'pointerleave';

export interface PixiBoardInputHit {
  readonly key: string;
  readonly row: number;
  readonly col: number;
}

export interface PixiBoardInputControllerPort {
  hitTestClientPoint(clientX: number, clientY: number): PixiBoardInputHit | null;
  handlePointer(event: Readonly<{
    type: PixiBoardPointerEventType;
    row: number;
    col: number;
    pointerId: number;
    pointerType: string;
    button: number;
    clientX: number;
    clientY: number;
    originalEvent?: Event;
    preventDefault?: () => void;
  }>): unknown;
}

export interface PixiBoardFederatedEventLayerPort {
  on(type: string, listener: (event: unknown) => void): unknown;
  off(type: string, listener: (event: unknown) => void): unknown;
}

export interface PixiBoardFederatedEventSystemPort {
  autoPreventDefault?: boolean;
  setTargetElement(element: HTMLElement | null): void;
}

export interface PixiBoardInputRendererPort {
  readonly events: PixiBoardFederatedEventSystemPort;
  readonly resolution?: number;
}

export interface PixiBoardInputMountTargets {
  readonly viewport: HTMLElement;
  readonly renderer: PixiBoardInputRendererPort;
  readonly interactionLayer: PixiBoardFederatedEventLayerPort;
}

export interface PixiBoardInputViewportMetrics {
  readonly width: number;
  readonly height: number;
  readonly resolution: number;
}

export interface PixiBoardInputOptions {
  readonly getController: () => PixiBoardInputControllerPort | null;
  readonly requestAnimationFrame?: (callback: FrameRequestCallback) => unknown;
  readonly cancelAnimationFrame?: (handle: unknown) => void;
}

export interface PixiBoardInputDiagnostics {
  readonly mounted: boolean;
  readonly destroyed: boolean;
  readonly listenerCount: number;
  readonly federatedListenerCount: number;
  readonly nativeListenerCount: number;
  readonly activePointerId: number | null;
  readonly activeCellKey: string | null;
  readonly hoveredCellKey: string | null;
  readonly pendingRetryPointerId: number | null;
  readonly targetWidth: number;
  readonly targetHeight: number;
}

export interface PixiBoardInput {
  mount(targets: PixiBoardInputMountTargets): void;
  syncViewportMetrics(metrics: PixiBoardInputViewportMetrics): void;
  destroy(): void;
  getDiagnostics(): PixiBoardInputDiagnostics;
}

type ActivePointer = Readonly<{
  pointerId: number;
  hit: PixiBoardInputHit;
}>;

type PointerSnapshot = Readonly<{
  pointerId: number;
  pointerType: string;
  button: number;
  clientX: number;
  clientY: number;
  originalEvent?: Event;
  preventDefault?: () => void;
}>;

type PendingPointerRetry = Readonly<{
  pointerId: number;
  event: PointerSnapshot;
  handle: unknown;
}>;

function finite(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function positive(value: unknown, fallback = 1): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function pointerId(event: any): number {
  const numeric = Number(event?.pointerId);
  return Number.isInteger(numeric) ? numeric : 0;
}

function pointerType(event: any): string {
  return String(event?.pointerType || 'mouse').trim().toLowerCase() || 'mouse';
}

function sameHit(left: PixiBoardInputHit | null, right: PixiBoardInputHit | null): boolean {
  return !!left && !!right && left.key === right.key;
}

function nativeEventOf(event: any): Event | undefined {
  const candidate = event?.nativeEvent || event?.originalEvent?.nativeEvent || event?.originalEvent;
  return candidate && typeof candidate === 'object' ? candidate as Event : undefined;
}

function pointerSnapshot(event: any): PointerSnapshot {
  const nativeEvent = nativeEventOf(event) as any;
  const source = nativeEvent || event || {};
  const preventDefault = () => {
    if (nativeEvent && typeof nativeEvent.preventDefault === 'function') nativeEvent.preventDefault();
    else if (event && typeof event.preventDefault === 'function') event.preventDefault();
  };
  return Object.freeze({
    pointerId: pointerId(source),
    pointerType: pointerType(source),
    button: Number.isInteger(Number(source.button)) ? Number(source.button) : 0,
    clientX: finite(source.clientX ?? event?.clientX ?? event?.client?.x),
    clientY: finite(source.clientY ?? event?.clientY ?? event?.client?.y),
    originalEvent: nativeEvent,
    preventDefault
  });
}

export function createPixiBoardInput(options: PixiBoardInputOptions): PixiBoardInput {
  if (!options || typeof options.getController !== 'function') {
    throw new Error('Pixi board input requires a controller resolver');
  }
  let viewport: HTMLElement | null = null;
  let renderer: PixiBoardInputRendererPort | null = null;
  let interactionLayer: PixiBoardFederatedEventLayerPort | null = null;
  let destroyed = false;
  let active: ActivePointer | null = null;
  let hovered: PixiBoardInputHit | null = null;
  let pendingRetry: PendingPointerRetry | null = null;
  let lastPointerEvent: PointerSnapshot | null = null;
  let previousAutoPreventDefault: boolean | undefined;
  let previousStyle: Readonly<{ pointerEvents: string; touchAction: string; cursor: string }> | null = null;
  let previousMetrics: Readonly<{
    hadWidth: boolean;
    hadHeight: boolean;
    width: unknown;
    height: unknown;
  }> | null = null;
  const federatedBindings: Array<Readonly<{
    type: string;
    listener: (event: unknown) => void;
  }>> = [];
  const nativeBindings: Array<Readonly<{
    target: EventTarget;
    type: string;
    listener: EventListener;
    capture: boolean;
  }>> = [];

  const addFederatedListener = (type: string, listener: (event: unknown) => void) => {
    interactionLayer!.on(type, listener);
    federatedBindings.push(Object.freeze({ type, listener }));
  };

  const addNativeListener = (
    target: EventTarget,
    type: string,
    listener: EventListener,
    capture = false
  ) => {
    target.addEventListener(type, listener, capture);
    nativeBindings.push(Object.freeze({ target, type, listener, capture }));
  };

  const resolveController = (): PixiBoardInputControllerPort | null => {
    if (destroyed) return null;
    const candidate = options.getController();
    return candidate
      && typeof candidate.hitTestClientPoint === 'function'
      && typeof candidate.handlePointer === 'function'
      ? candidate
      : null;
  };

  const scheduleFrame = (callback: FrameRequestCallback): unknown => {
    if (options.requestAnimationFrame) return options.requestAnimationFrame(callback);
    const ownerWindow = viewport?.ownerDocument?.defaultView;
    return typeof ownerWindow?.requestAnimationFrame === 'function'
      ? ownerWindow.requestAnimationFrame(callback)
      : null;
  };

  const cancelFrame = (handle: unknown): void => {
    if (handle == null) return;
    if (options.cancelAnimationFrame) {
      options.cancelAnimationFrame(handle);
      return;
    }
    const ownerWindow = viewport?.ownerDocument?.defaultView;
    if (typeof ownerWindow?.cancelAnimationFrame === 'function') {
      ownerWindow.cancelAnimationFrame(Number(handle));
    }
  };

  const clearPendingRetry = (expectedPointerId?: number): void => {
    if (!pendingRetry) return;
    if (typeof expectedPointerId === 'number' && pendingRetry.pointerId !== expectedPointerId) return;
    const pending = pendingRetry;
    pendingRetry = null;
    cancelFrame(pending.handle);
  };

  const resolveHit = (
    controller: PixiBoardInputControllerPort,
    event: PointerSnapshot
  ): PixiBoardInputHit | null => controller.hitTestClientPoint(event.clientX, event.clientY);

  const dispatch = (
    controller: PixiBoardInputControllerPort,
    type: PixiBoardPointerEventType,
    hit: PixiBoardInputHit,
    event: PointerSnapshot
  ): boolean => controller.handlePointer(Object.freeze({
    type,
    row: hit.row,
    col: hit.col,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    clientX: event.clientX,
    clientY: event.clientY,
    originalEvent: event.originalEvent,
    preventDefault: event.preventDefault
  })) === true;

  const updateHover = (
    controller: PixiBoardInputControllerPort,
    next: PixiBoardInputHit | null,
    event: PointerSnapshot
  ) => {
    if (sameHit(hovered, next)) return;
    const previous = hovered;
    hovered = next;
    if (previous) dispatch(controller, 'pointerleave', previous, event);
    if (next) dispatch(controller, 'pointerenter', next, event);
  };

  const beginPointer = (event: PointerSnapshot, allowLayoutRetry: boolean): void => {
    if (event.button !== 0 || active || pendingRetry) return;
    const controller = resolveController();
    if (!controller) return;
    const hit = resolveHit(controller, event);
    if (!hit) {
      if (!allowLayoutRetry) return;
      const retryPointerId = event.pointerId;
      const handle = scheduleFrame(() => {
        if (!pendingRetry || pendingRetry.pointerId !== retryPointerId) return;
        const retryEvent = pendingRetry.event;
        pendingRetry = null;
        beginPointer(retryEvent, false);
      });
      if (handle != null) {
        pendingRetry = Object.freeze({ pointerId: retryPointerId, event, handle });
      }
      return;
    }
    updateHover(controller, hit, event);
    if (!dispatch(controller, 'pointerdown', hit, event)) return;
    active = Object.freeze({ pointerId: event.pointerId, hit });
  };

  const onPointerDown = (raw: unknown) => {
    lastPointerEvent = pointerSnapshot(raw);
    beginPointer(lastPointerEvent, true);
  };

  const onGlobalPointerMove = (raw: unknown) => {
    const event = pointerSnapshot(raw);
    lastPointerEvent = event;
    clearPendingRetry(event.pointerId);
    const controller = resolveController();
    if (!controller) return;
    const hit = resolveHit(controller, event);
    if (active && active.pointerId === event.pointerId) {
      // Movement authority remains in BoardInputController. Keeping the press
      // cell here prevents a virtual-cell transition from orphaning longpress.
      dispatch(controller, 'pointermove', active.hit, event);
    }
    updateHover(controller, hit, event);
  };

  const finishPointer = (event: PointerSnapshot, cancelled: boolean, outside = false) => {
    clearPendingRetry(event.pointerId);
    if (!active || active.pointerId !== event.pointerId) return;
    const controller = resolveController();
    const pressed = active;
    active = null;
    if (!controller) return;
    if (cancelled) {
      dispatch(controller, 'pointercancel', pressed.hit, event);
      return;
    }
    const released = outside ? null : resolveHit(controller, event);
    dispatch(controller, sameHit(pressed.hit, released) ? 'pointerup' : 'pointerupoutside', pressed.hit, event);
  };

  const onPointerUp = (raw: unknown) => {
    lastPointerEvent = pointerSnapshot(raw);
    finishPointer(lastPointerEvent, false, false);
  };

  const onPointerUpOutside = (raw: unknown) => {
    lastPointerEvent = pointerSnapshot(raw);
    finishPointer(lastPointerEvent, false, true);
  };

  const onNativePointerDown = (raw: Event) => {
    lastPointerEvent = pointerSnapshot(raw);
    beginPointer(lastPointerEvent, true);
  };

  const onNativePointerUp = (raw: Event) => {
    lastPointerEvent = pointerSnapshot(raw);
    finishPointer(lastPointerEvent, false, false);
  };

  const onNativePointerLeave = (raw: Event) => {
    onPointerLeave(raw);
  };

  const onNativePointerCancel = (raw: Event) => {
    lastPointerEvent = pointerSnapshot(raw);
    finishPointer(lastPointerEvent, true);
  };

  const onPointerLeave = (raw: unknown) => {
    const event = pointerSnapshot(raw);
    lastPointerEvent = event;
    clearPendingRetry(event.pointerId);
    const controller = resolveController();
    if (!controller) return;
    const previous = hovered;
    hovered = null;
    if (previous) dispatch(controller, 'pointerleave', previous, event);
    if (active && active.pointerId === event.pointerId) {
      const pressed = active;
      active = null;
      if (!previous || previous.key !== pressed.hit.key) {
        dispatch(controller, 'pointercancel', pressed.hit, event);
      }
    }
  };

  function syncViewportMetrics(metrics: PixiBoardInputViewportMetrics): void {
    if (destroyed) return;
    if (!viewport) throw new Error('Pixi board input must be mounted before viewport metrics sync');
    const width = positive(metrics?.width);
    const height = positive(metrics?.height);
    const resolution = positive(metrics?.resolution, positive(renderer?.resolution));
    // Pixi EventSystem.mapPositionToPoint supports custom HTMLElements but
    // reads canvas-like width/height fields. Keep their backing dimensions in
    // step with the viewport CSS box and renderer resolution.
    (viewport as any).width = Math.max(1, Math.round(width * resolution));
    (viewport as any).height = Math.max(1, Math.round(height * resolution));
  }

  function mount(targets: PixiBoardInputMountTargets): void {
    if (destroyed) throw new Error('Pixi board input is destroyed');
    const nextViewport = targets?.viewport;
    const nextRenderer = targets?.renderer;
    const nextInteractionLayer = targets?.interactionLayer;
    if (!nextViewport || typeof nextViewport.addEventListener !== 'function') {
      throw new Error('Pixi board input viewport is unavailable');
    }
    if (!nextRenderer?.events || typeof nextRenderer.events.setTargetElement !== 'function') {
      throw new Error('Pixi board Federated EventSystem is unavailable');
    }
    if (!nextInteractionLayer
      || typeof nextInteractionLayer.on !== 'function'
      || typeof nextInteractionLayer.off !== 'function') {
      throw new Error('Pixi board interaction layer is unavailable');
    }
    if (viewport) {
      if (viewport !== nextViewport
        || renderer !== nextRenderer
        || interactionLayer !== nextInteractionLayer) {
        throw new Error('Pixi board input cannot mount a second target');
      }
      return;
    }
    viewport = nextViewport;
    renderer = nextRenderer;
    interactionLayer = nextInteractionLayer;
    previousStyle = Object.freeze({
      pointerEvents: viewport.style.pointerEvents,
      touchAction: viewport.style.touchAction,
      cursor: viewport.style.cursor
    });
    previousMetrics = Object.freeze({
      hadWidth: Object.prototype.hasOwnProperty.call(viewport, 'width'),
      hadHeight: Object.prototype.hasOwnProperty.call(viewport, 'height'),
      width: (viewport as any).width,
      height: (viewport as any).height
    });
    previousAutoPreventDefault = renderer.events.autoPreventDefault;

    renderer.events.autoPreventDefault = false;
    renderer.events.setTargetElement(viewport);
    // EventSystem deliberately installs touch-action:none. This board keeps
    // input in Pixi while browser-native overflow pan and pinch remain owned
    // by the scroll viewport.
    viewport.style.pointerEvents = 'auto';
    viewport.style.touchAction = 'pan-x pan-y pinch-zoom';
    const rect = typeof viewport.getBoundingClientRect === 'function'
      ? viewport.getBoundingClientRect()
      : null;
    syncViewportMetrics({
      width: positive(rect?.width, positive(viewport.clientWidth)),
      height: positive(rect?.height, positive(viewport.clientHeight)),
      resolution: positive(renderer.resolution)
    });

    addFederatedListener('pointerdown', onPointerDown);
    addFederatedListener('globalpointermove', onGlobalPointerMove);
    addFederatedListener('pointerup', onPointerUp);
    addFederatedListener('pointerupoutside', onPointerUpOutside);
    addFederatedListener('pointerleave', onPointerLeave);
    // Capture the native press/release before Pixi's target listener. Some
    // browsers do not produce a Federated hit for this transparent viewport,
    // while the shared controller can still resolve the canonical cell from
    // client coordinates. The retained active pointer makes the subsequent
    // Federated event a no-op, so this remains one input path rather than a
    // duplicate dispatch.
    addNativeListener(viewport, 'pointerdown', onNativePointerDown as EventListener, true);
    addNativeListener(viewport, 'pointerup', onNativePointerUp as EventListener, true);
    addNativeListener(viewport, 'pointerleave', onNativePointerLeave as EventListener, true);
    // Pixi 8.18's PointerEvent path does not subscribe to pointercancel. The
    // native supplement is also required when a touch becomes viewport scrolling.
    addNativeListener(viewport, 'pointercancel', onNativePointerCancel as EventListener, true);
  }

  function destroy(): void {
    if (destroyed) return;
    clearPendingRetry();
    const controller = resolveController();
    if (controller && lastPointerEvent) {
      if (active) {
        try { dispatch(controller, 'pointercancel', active.hit, lastPointerEvent); } catch (_error) { /* cleanup continues */ }
      }
      if (hovered) {
        try { dispatch(controller, 'pointerleave', hovered, lastPointerEvent); } catch (_error) { /* cleanup continues */ }
      }
    }
    for (const binding of federatedBindings.splice(0)) {
      try { interactionLayer?.off(binding.type, binding.listener); } catch (_error) { /* cleanup continues */ }
    }
    for (const binding of nativeBindings.splice(0)) {
      binding.target.removeEventListener(binding.type, binding.listener, binding.capture);
    }
    try { renderer?.events.setTargetElement(null); } catch (_error) { /* application teardown continues */ }
    if (renderer?.events && typeof previousAutoPreventDefault === 'boolean') {
      renderer.events.autoPreventDefault = previousAutoPreventDefault;
    }
    if (viewport && previousMetrics) {
      if (previousMetrics.hadWidth) (viewport as any).width = previousMetrics.width;
      else delete (viewport as any).width;
      if (previousMetrics.hadHeight) (viewport as any).height = previousMetrics.height;
      else delete (viewport as any).height;
    }
    if (viewport && previousStyle) {
      viewport.style.pointerEvents = previousStyle.pointerEvents;
      viewport.style.touchAction = previousStyle.touchAction;
      viewport.style.cursor = previousStyle.cursor;
    }
    destroyed = true;
    active = null;
    hovered = null;
    lastPointerEvent = null;
    previousStyle = null;
    previousMetrics = null;
    viewport = null;
    renderer = null;
    interactionLayer = null;
  }

  function getDiagnostics(): PixiBoardInputDiagnostics {
    return Object.freeze({
      mounted: !!viewport,
      destroyed,
      listenerCount: federatedBindings.length + nativeBindings.length,
      federatedListenerCount: federatedBindings.length,
      nativeListenerCount: nativeBindings.length,
      activePointerId: active?.pointerId ?? null,
      activeCellKey: active?.hit.key ?? null,
      hoveredCellKey: hovered?.key ?? null,
      pendingRetryPointerId: pendingRetry?.pointerId ?? null,
      targetWidth: viewport ? finite((viewport as any).width) : 0,
      targetHeight: viewport ? finite((viewport as any).height) : 0
    });
  }

  return Object.freeze({ mount, syncViewportMetrics, destroy, getDiagnostics });
}
