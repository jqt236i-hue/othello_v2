import type {
  BoardCellDirectionHint,
  BoardClientRect,
  BoardDirectionHintKind,
  BoardRenderModel
} from './board-visual/types';

const ACCESSIBILITY_LAYER_CLASS = 'board-accessibility-layer';
const DIRECTION_BUTTON_CLASS = 'board-accessibility-direction-button';
const EXPANSION_HINT_KINDS = new Set<BoardDirectionHintKind>([
  'board-expansion-god',
  'board-expansion-will'
]);

const DIRECTION_POSITIONS: Readonly<Record<string, Readonly<{ x: number; y: number }>>> = Object.freeze({
  up: Object.freeze({ x: 0.5, y: 0.14 }),
  down: Object.freeze({ x: 0.5, y: 0.86 }),
  left: Object.freeze({ x: 0.14, y: 0.5 }),
  right: Object.freeze({ x: 0.86, y: 0.5 }),
  'up-left': Object.freeze({ x: 0.18, y: 0.18 }),
  'up-right': Object.freeze({ x: 0.82, y: 0.18 }),
  'down-left': Object.freeze({ x: 0.18, y: 0.82 }),
  'down-right': Object.freeze({ x: 0.82, y: 0.82 })
});

const DIRECTION_GLYPHS: Readonly<Record<string, string>> = Object.freeze({
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  'up-left': '↖',
  'up-right': '↗',
  'down-left': '↙',
  'down-right': '↘'
});

// The legacy expansion direction control is 20px inside a 44px cell. Keeping
// the ratio makes the transparent semantic hit area coincide with the Pixi
// glyph without turning the whole cell into a second pointer target.
const DIRECTION_HIT_SIZE_RATIO = 20 / 44;

export interface BoardAccessibilityDirectionHint {
  readonly id: string;
  readonly cellKey: string;
  readonly row: number;
  readonly col: number;
  readonly directionKey: string;
  readonly kind: 'board-expansion-god' | 'board-expansion-will';
  readonly ariaLabel: string;
  readonly modelCommitId: number;
  readonly boardDigest: string;
}

export interface BoardAccessibilityLayerSyncOptions {
  readonly model: Pick<BoardRenderModel, 'cells' | 'modelCommitId' | 'boardDigest'>;
  readonly getCellClientRect: (row: number, col: number) => BoardClientRect | null;
}

export interface BoardAccessibilityLayerOptions {
  readonly document?: Document;
  readonly window?: Window | null;
  readonly visualViewport?: VisualViewport | null;
  readonly onActivate: (
    row: number,
    col: number,
    directionKey: string,
    hint: BoardAccessibilityDirectionHint
  ) => void;
  readonly onFocus?: (cellKey: string, hint: BoardAccessibilityDirectionHint) => void;
  readonly onBlur?: (cellKey: string, hint: BoardAccessibilityDirectionHint) => void;
}

export interface BoardAccessibilityLayerDiagnostics {
  readonly mounted: boolean;
  readonly destroyed: boolean;
  readonly buttonCount: number;
  readonly hintIds: readonly string[];
  readonly canvasAriaHidden: boolean;
  readonly viewportScrollListenerActive: boolean;
  readonly windowListenerCount: number;
  readonly visualViewportListenerCount: number;
}

export interface BoardAccessibilityLayer {
  /** Call after the selected board backend has mounted (camera mount clears #board). */
  mount(host: HTMLElement, canvas?: HTMLCanvasElement | null): HTMLElement;
  setCanvas(canvas?: HTMLCanvasElement | null): void;
  sync(options: BoardAccessibilityLayerSyncOptions): void;
  refresh(): void;
  clear(): void;
  getElement(): HTMLElement | null;
  getDiagnostics(): BoardAccessibilityLayerDiagnostics;
  destroy(): void;
}

interface DirectionButtonRecord {
  readonly button: HTMLButtonElement;
  hint: BoardAccessibilityDirectionHint;
  pointerDownHint: BoardAccessibilityDirectionHint | null;
  focused: boolean;
}

function normalizeDirection(value: unknown): string {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  if (normalized === 'top') return 'up';
  if (normalized === 'bottom') return 'down';
  return normalized;
}

function directionGlyph(directionKey: string): string {
  return DIRECTION_GLYPHS[normalizeDirection(directionKey)] || '•';
}

export function getBoardExpansionDirectionAriaLabel(directionKey: string): string {
  return `盤面を${directionGlyph(directionKey)}方向へ拡張`;
}

function isExpansionHint(hint: BoardCellDirectionHint): hint is BoardCellDirectionHint & {
  kind: 'board-expansion-god' | 'board-expansion-will';
} {
  return EXPANSION_HINT_KINDS.has(hint.kind);
}

function finiteRect(rect: BoardClientRect | null): rect is BoardClientRect {
  return !!rect
    && [rect.left, rect.top, rect.width, rect.height].every((value) => Number.isFinite(Number(value)))
    && rect.width > 0
    && rect.height > 0;
}

function directAccessibilityLayers(host: HTMLElement): HTMLElement[] {
  return Array.from(host.children).filter((child): child is HTMLElement => (
    child.nodeType === 1 && (child as HTMLElement).classList.contains(ACCESSIBILITY_LAYER_CLASS)
  ));
}

function semanticHints(
  model: Pick<BoardRenderModel, 'cells' | 'modelCommitId' | 'boardDigest'>
): BoardAccessibilityDirectionHint[] {
  const result: BoardAccessibilityDirectionHint[] = [];
  const seen = new Set<string>();
  for (const cell of model.cells || []) {
    const hints = cell && cell.interaction && Array.isArray(cell.interaction.directionHints)
      ? cell.interaction.directionHints
      : [];
    for (const rawHint of hints) {
      if (!rawHint || !isExpansionHint(rawHint)) continue;
      const directionKey = normalizeDirection(rawHint.directionKey);
      if (!DIRECTION_POSITIONS[directionKey]) continue;
      const rawId = String(rawHint.id == null ? '' : rawHint.id).trim();
      const id = rawId || `${rawHint.kind}:${cell.key}:${directionKey}`;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(Object.freeze({
        id,
        cellKey: cell.key,
        row: cell.row,
        col: cell.col,
        directionKey,
        kind: rawHint.kind,
        ariaLabel: getBoardExpansionDirectionAriaLabel(directionKey),
        modelCommitId: Number(model.modelCommitId),
        boardDigest: String(model.boardDigest || '')
      }));
    }
  }
  return result;
}

function localButtonGeometry(
  host: HTMLElement,
  rect: BoardClientRect,
  directionKey: string
): Readonly<{ left: number; top: number; size: number }> {
  const hostRect = host.getBoundingClientRect();
  const position = DIRECTION_POSITIONS[directionKey] || DIRECTION_POSITIONS.right;
  const size = Math.max(1, Math.min(rect.width, rect.height) * DIRECTION_HIT_SIZE_RATIO);
  return Object.freeze({
    left: rect.left - hostRect.left + rect.width * position.x - size / 2,
    top: rect.top - hostRect.top + rect.height * position.y - size / 2,
    size
  });
}

function elementClientBounds(element: HTMLElement | null): Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> | null {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null;
  const rect = element.getBoundingClientRect();
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![rect.left, rect.top, width, height].every((value) => Number.isFinite(Number(value)))) return null;
  if (width <= 0 || height <= 0) return null;
  return Object.freeze({
    left: Number(rect.left),
    top: Number(rect.top),
    right: Number(rect.left) + width,
    bottom: Number(rect.top) + height
  });
}

function isDirectionButtonVisible(
  host: HTMLElement,
  scrollViewport: HTMLElement | null,
  rect: BoardClientRect,
  directionKey: string
): boolean {
  const position = DIRECTION_POSITIONS[directionKey] || DIRECTION_POSITIONS.right;
  const size = Math.max(1, Math.min(rect.width, rect.height) * DIRECTION_HIT_SIZE_RATIO);
  const left = rect.left + rect.width * position.x - size / 2;
  const top = rect.top + rect.height * position.y - size / 2;
  const right = left + size;
  const bottom = top + size;
  const visibleBounds = elementClientBounds(scrollViewport) || elementClientBounds(host);
  return !visibleBounds || (
    right > visibleBounds.left
    && left < visibleBounds.right
    && bottom > visibleBounds.top
    && top < visibleBounds.bottom
  );
}

export function createBoardAccessibilityLayer(
  options: BoardAccessibilityLayerOptions
): BoardAccessibilityLayer {
  if (!options || typeof options.onActivate !== 'function') {
    throw new Error('Board accessibility layer requires an activation callback');
  }
  let host: HTMLElement | null = null;
  let layer: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let scrollViewport: HTMLElement | null = null;
  let destroyed = false;
  let listenersMounted = false;
  let latestHints: readonly BoardAccessibilityDirectionHint[] = Object.freeze([]);
  let latestCellRectBridge: BoardAccessibilityLayerSyncOptions['getCellClientRect'] | null = null;
  const records = new Map<string, DirectionButtonRecord>();
  let windowRef = typeof options.window !== 'undefined'
    ? options.window
    : (options.document?.defaultView || null);
  let visualViewport = typeof options.visualViewport !== 'undefined'
    ? options.visualViewport
    : (windowRef?.visualViewport || null);

  function assertAlive(): void {
    if (destroyed) throw new Error('Board accessibility layer is destroyed');
  }

  function markCanvasAriaHidden(nextCanvas?: HTMLCanvasElement | null): void {
    if (typeof nextCanvas !== 'undefined') canvas = nextCanvas;
    if (host && (!canvas || !host.contains(canvas))) canvas = host.querySelector('canvas');
    canvas?.setAttribute('aria-hidden', 'true');
  }

  function ensureAttached(): void {
    if (host && layer && layer.parentNode !== host) host.appendChild(layer);
  }

  function refreshListener(): void {
    refresh();
  }

  function bindScrollViewport(): void {
    if (!host) return;
    const nextViewport = host.querySelector('#board-scroll-viewport') as HTMLElement | null;
    if (nextViewport === scrollViewport) return;
    scrollViewport?.removeEventListener('scroll', refreshListener);
    scrollViewport = nextViewport;
    scrollViewport?.addEventListener('scroll', refreshListener, { passive: true });
  }

  function bindEnvironmentListeners(): void {
    if (listenersMounted) return;
    windowRef?.addEventListener('resize', refreshListener);
    windowRef?.addEventListener('scroll', refreshListener, { passive: true });
    visualViewport?.addEventListener('resize', refreshListener);
    visualViewport?.addEventListener('scroll', refreshListener);
    listenersMounted = true;
  }

  function unbindListeners(): void {
    scrollViewport?.removeEventListener('scroll', refreshListener);
    scrollViewport = null;
    if (!listenersMounted) return;
    windowRef?.removeEventListener('resize', refreshListener);
    windowRef?.removeEventListener('scroll', refreshListener);
    visualViewport?.removeEventListener('resize', refreshListener);
    visualViewport?.removeEventListener('scroll', refreshListener);
    listenersMounted = false;
  }

  function notifyBlur(record: DirectionButtonRecord): void {
    if (!record.focused) return;
    record.focused = false;
    options.onBlur?.(record.hint.cellKey, record.hint);
  }

  function removeRecord(id: string, record: DirectionButtonRecord): void {
    if (record.button.ownerDocument.activeElement === record.button) record.button.blur();
    record.pointerDownHint = null;
    notifyBlur(record);
    record.button.remove();
    records.delete(id);
  }

  function createButton(hint: BoardAccessibilityDirectionHint): DirectionButtonRecord {
    const doc = options.document || host!.ownerDocument;
    const button = doc.createElement('button');
    const record: DirectionButtonRecord = { button, hint, pointerDownHint: null, focused: false };
    button.type = 'button';
    button.className = DIRECTION_BUTTON_CLASS;
    button.setAttribute('role', 'button');
    button.tabIndex = 0;
    button.addEventListener('pointerdown', (event) => {
      if (
        destroyed
        || records.get(record.hint.id) !== record
        || (Number.isFinite(Number(event.button)) && Number(event.button) !== 0)
      ) return;
      // Focus-driven presentation sync may update the keyed record before the
      // browser emits click. Preserve the canonical identity seen on press.
      record.pointerDownHint = record.hint;
    });
    button.addEventListener('pointercancel', () => {
      record.pointerDownHint = null;
    });
    button.addEventListener('keydown', () => {
      // Native keyboard activation does not belong to an earlier pointer press.
      record.pointerDownHint = null;
    });
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (destroyed || records.get(record.hint.id) !== record) return;
      const activationHint = record.pointerDownHint || record.hint;
      record.pointerDownHint = null;
      options.onActivate(
        activationHint.row,
        activationHint.col,
        activationHint.directionKey,
        activationHint
      );
    });
    // Native <button> activation owns Enter/Space and emits one click. A
    // parallel keydown handler can double-dispatch in real browsers.
    button.addEventListener('focus', () => {
      if (destroyed || records.get(record.hint.id) !== record || record.focused) return;
      record.focused = true;
      options.onFocus?.(record.hint.cellKey, record.hint);
    });
    button.addEventListener('blur', () => {
      record.pointerDownHint = null;
      notifyBlur(record);
    });
    return record;
  }

  function updateButton(
    record: DirectionButtonRecord,
    hint: BoardAccessibilityDirectionHint,
    rect: BoardClientRect
  ): void {
    record.hint = hint;
    const { button } = record;
    const geometry = localButtonGeometry(host!, rect, hint.directionKey);
    button.dataset.hintId = hint.id;
    button.dataset.cellKey = hint.cellKey;
    button.dataset.direction = hint.directionKey;
    button.setAttribute('aria-label', hint.ariaLabel);
    button.textContent = directionGlyph(hint.directionKey);
    button.hidden = false;
    button.tabIndex = 0;
    button.style.left = `${geometry.left}px`;
    button.style.top = `${geometry.top}px`;
    button.style.width = `${geometry.size}px`;
    button.style.height = `${geometry.size}px`;
    button.style.pointerEvents = 'auto';
  }

  function hideButton(record: DirectionButtonRecord, hint: BoardAccessibilityDirectionHint): void {
    record.hint = hint;
    if (record.button.ownerDocument.activeElement === record.button) record.button.blur();
    notifyBlur(record);
    record.button.hidden = true;
    record.button.tabIndex = -1;
    record.button.style.pointerEvents = 'none';
  }

  function renderLatestHints(): void {
    if (!host || !layer || !latestCellRectBridge) return;
    const nextIds = new Set<string>();
    let childIndex = 0;
    for (const hint of latestHints) {
      const rect = latestCellRectBridge(hint.row, hint.col);
      const visible = finiteRect(rect)
        && isDirectionButtonVisible(host, scrollViewport, rect, hint.directionKey);
      let record = records.get(hint.id);
      if (!record && visible) {
        record = createButton(hint);
        records.set(hint.id, record);
      }
      if (!record) continue;
      if (visible) updateButton(record, hint, rect);
      else hideButton(record, hint);
      const expectedChild = layer.children.item(childIndex);
      if (expectedChild !== record.button) layer.insertBefore(record.button, expectedChild);
      childIndex += 1;
      nextIds.add(hint.id);
    }
    for (const [id, record] of Array.from(records.entries())) {
      if (!nextIds.has(id)) removeRecord(id, record);
    }
  }

  function mount(nextHost: HTMLElement, nextCanvas?: HTMLCanvasElement | null): HTMLElement {
    assertAlive();
    if (!nextHost || typeof nextHost.appendChild !== 'function') {
      throw new Error('Board accessibility layer mount host is unavailable');
    }
    if (host && host !== nextHost) {
      throw new Error('Board accessibility layer cannot mount a second host');
    }
    host = nextHost;
    if (typeof options.window === 'undefined' && !windowRef) {
      windowRef = host.ownerDocument.defaultView;
    }
    if (typeof options.visualViewport === 'undefined' && !visualViewport) {
      visualViewport = windowRef?.visualViewport || null;
    }
    if (!layer) {
      const existingLayers = directAccessibilityLayers(host);
      layer = existingLayers.shift() || (options.document || host.ownerDocument).createElement('div');
      layer.className = ACCESSIBILITY_LAYER_CLASS;
      layer.dataset.boardAccessibilityLayer = 'true';
      layer.style.position = 'absolute';
      layer.style.inset = '0';
      layer.style.overflow = 'hidden';
      layer.style.pointerEvents = 'none';
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      for (const duplicate of existingLayers) duplicate.remove();
    }
    ensureAttached();
    markCanvasAriaHidden(nextCanvas);
    bindScrollViewport();
    bindEnvironmentListeners();
    return layer;
  }

  function setCanvas(nextCanvas?: HTMLCanvasElement | null): void {
    assertAlive();
    markCanvasAriaHidden(nextCanvas);
  }

  function sync(syncOptions: BoardAccessibilityLayerSyncOptions): void {
    assertAlive();
    if (!host || !layer) throw new Error('Board accessibility layer must be mounted before sync');
    if (!syncOptions || !syncOptions.model || typeof syncOptions.getCellClientRect !== 'function') {
      throw new Error('Board accessibility layer sync requires a render model and cell rect bridge');
    }
    // A Pixi camera mount intentionally clears #board. Reattaching here makes
    // the API safe when bootstrap mounts the semantic layer around async backend
    // readiness, while still preserving one direct child layer.
    ensureAttached();
    markCanvasAriaHidden();
    bindScrollViewport();
    latestHints = Object.freeze(semanticHints(syncOptions.model));
    latestCellRectBridge = syncOptions.getCellClientRect;
    renderLatestHints();
  }

  function refresh(): void {
    if (destroyed || !host || !layer || !latestCellRectBridge) return;
    ensureAttached();
    markCanvasAriaHidden();
    bindScrollViewport();
    renderLatestHints();
  }

  function clear(): void {
    for (const [id, record] of Array.from(records.entries())) removeRecord(id, record);
    latestHints = Object.freeze([]);
    latestCellRectBridge = null;
  }

  function getDiagnostics(): BoardAccessibilityLayerDiagnostics {
    return Object.freeze({
      mounted: !!host && !!layer && layer.parentNode === host,
      destroyed,
      buttonCount: records.size,
      hintIds: Object.freeze(Array.from(records.keys())),
      canvasAriaHidden: canvas?.getAttribute('aria-hidden') === 'true',
      viewportScrollListenerActive: !!scrollViewport,
      windowListenerCount: listenersMounted && windowRef ? 2 : 0,
      visualViewportListenerCount: listenersMounted && visualViewport ? 2 : 0
    });
  }

  function destroy(): void {
    if (destroyed) return;
    clear();
    unbindListeners();
    layer?.remove();
    host = null;
    layer = null;
    canvas = null;
    destroyed = true;
  }

  return Object.freeze({
    mount,
    setCanvas,
    sync,
    refresh,
    clear,
    getElement: () => layer,
    getDiagnostics,
    destroy
  });
}
