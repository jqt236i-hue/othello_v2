import type {
  BoardAppearanceDescriptor,
  BoardRenderModel,
  BoardRenderTopologyModel,
  BoardViewportLayout,
  BoardVisualFrame,
  BoardVisualThemeDescriptor
} from './types';

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

const FRAME_LAYOUT_FIELDS = Object.freeze([
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'artOverhangTop',
  'artOverhangBottom',
  'artOffsetY'
]);

type RevisionChannel = {
  revision: number;
  fingerprint: string | null;
};

function stableDescriptorString(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'number:NaN';
    if (value === Infinity) return 'number:Infinity';
    if (value === -Infinity) return 'number:-Infinity';
    if (Object.is(value, -0)) return 'number:-0';
    return `number:${value}`;
  }
  if (typeof value === 'bigint') return `bigint:${value.toString()}`;
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error('Board visual frame descriptors must not contain functions or symbols');
  }
  const objectValue = value as object;
  if (ancestors.has(objectValue)) throw new Error('Board visual frame descriptors must not contain cycles');
  ancestors.add(objectValue);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => stableDescriptorString(entry, ancestors)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableDescriptorString(record[key], ancestors)}`).join(',')}}`;
  } finally {
    ancestors.delete(objectValue);
  }
}

function descriptorFingerprint(value: Record<string, unknown>, revisionField: string): string {
  const descriptor: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (key !== revisionField) descriptor[key] = value[key];
  }
  return stableDescriptorString(descriptor);
}

function modelFingerprint(model: BoardRenderModel): string {
  const topology = model.topology;
  const sortedKeys = (values: readonly string[]) => Array.from(values || []).sort();
  const cells = Array.from(model.cells || [])
    .map((cell) => ({
      key: String(cell && cell.key || ''),
      visualSignature: typeof cell?.visualSignature === 'string' ? cell.visualSignature : cell
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return stableDescriptorString({
    topology: {
      ...topology,
      existingKeys: sortedKeys(topology.existingKeys),
      playableKeys: sortedKeys(topology.playableKeys),
      holeKeys: sortedKeys(topology.holeKeys)
    },
    cells,
    keyboardCursorKey: model.keyboardCursorKey,
    viewerContext: model.viewerContext,
    currentPlayer: model.currentPlayer,
    canControlCurrentTurn: model.canControlCurrentTurn,
    isHumanTurn: model.isHumanTurn
  });
}

function resolveChannelRevision(channel: RevisionChannel, fingerprint: string): number {
  if (channel.fingerprint !== fingerprint) {
    channel.fingerprint = fingerprint;
    channel.revision = Math.min(Number.MAX_SAFE_INTEGER, channel.revision + 1);
  }
  return channel.revision;
}

/**
 * Keeps model, geometry, skin resources, and theme invalidation independent.
 * `frameToken` is intentionally excluded: it is a writer/settlement identity,
 * not a visual-content revision.
 */
function createBoardVisualFrameRevisionComposer() {
  const model = { revision: 0, fingerprint: null } as RevisionChannel;
  const layout = { revision: 0, fingerprint: null } as RevisionChannel;
  const appearance = { revision: 0, fingerprint: null } as RevisionChannel;
  const theme = { revision: 0, fingerprint: null } as RevisionChannel;

  return Object.freeze({
    compose(frame: BoardVisualFrame): BoardVisualFrame {
      if (!frame || !frame.model || !frame.layout || !frame.appearance || !frame.theme) {
        throw new Error('A complete board visual frame is required for revision composition');
      }
      const modelRevision = resolveChannelRevision(
        model,
        modelFingerprint(frame.model)
      );
      const layoutRevision = resolveChannelRevision(
        layout,
        descriptorFingerprint(frame.layout as unknown as Record<string, unknown>, 'revision')
      );
      const appearanceRevision = resolveChannelRevision(
        appearance,
        descriptorFingerprint(frame.appearance as unknown as Record<string, unknown>, 'revision')
      );
      const themeRevision = resolveChannelRevision(
        theme,
        descriptorFingerprint(frame.theme as unknown as Record<string, unknown>, 'revision')
      );
      const nextModel: BoardRenderModel = Object.freeze({ ...frame.model, visualRevision: modelRevision });
      const nextLayout: BoardViewportLayout = Object.freeze({ ...frame.layout, revision: layoutRevision });
      const nextAppearance: BoardAppearanceDescriptor = Object.freeze({
        ...frame.appearance,
        revision: appearanceRevision
      });
      const nextTheme: BoardVisualThemeDescriptor = Object.freeze({ ...frame.theme, revision: themeRevision });
      return Object.freeze({
        model: nextModel,
        layout: nextLayout,
        appearance: nextAppearance,
        theme: nextTheme,
        frameToken: String(frame.frameToken || ''),
        renderSessionId: String(frame.renderSessionId || '')
      });
    },
    getRevisions() {
      return Object.freeze({
        model: model.revision,
        layout: layout.revision,
        appearance: appearance.revision,
        theme: theme.revision
      });
    }
  });
}

function resolveModule(root: any, globalKey: string, path: string): any {
  try {
    if (root && root[globalKey]) return root[globalKey];
  } catch (e) { /* ignore */ }
  try {
    return _require(path);
  } catch (e) {
    return null;
  }
}

function copyFrameLayout(value: unknown): Readonly<Record<string, number>> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const layout: Record<string, number> = {};
  for (const key of FRAME_LAYOUT_FIELDS) {
    const numeric = Number(source[key]);
    if (Number.isFinite(numeric)) layout[key] = numeric;
  }
  return Object.freeze(layout);
}

function datasetValue(element: any, key: string): string {
  return String(element && element.dataset && element.dataset[key] || '').trim();
}

function resolveDefinition(moduleValue: any, method: string, id: string, root: any): any {
  try {
    return moduleValue && typeof moduleValue[method] === 'function'
      ? moduleValue[method](id, root)
      : null;
  } catch (e) {
    return null;
  }
}

function resolveBoardAppearanceDescriptor(
  host: HTMLElement | null,
  revision = 0
): BoardAppearanceDescriptor {
  const doc = host && host.ownerDocument
    ? host.ownerDocument
    : (typeof document !== 'undefined' ? document : null);
  const root = doc && doc.defaultView
    ? doc.defaultView
    : (typeof window !== 'undefined' ? window : null);
  const rootElement = doc && doc.documentElement;
  const boardFrame = host && typeof host.closest === 'function' ? host.closest('#board-frame') as HTMLElement | null : null;
  const boardCatalog = resolveModule(root, 'BoardSkinCatalogModule', '../board-skin/catalog');
  const stoneCatalog = resolveModule(root, 'StoneSkinCatalogModule', '../stone-skin/catalog');
  const requestedBoardSkinId = datasetValue(host, 'boardSkinId')
    || datasetValue(rootElement, 'boardSkinId')
    || String(boardCatalog && boardCatalog.DEFAULT_BOARD_SKIN_ID || 'bluegreen-felt');
  const requestedFrameSkinId = datasetValue(boardFrame, 'boardFrameSkinId')
    || datasetValue(rootElement, 'boardFrameSkinId')
    || String(boardCatalog && boardCatalog.DEFAULT_BOARD_FRAME_SKIN_ID || 'marsh-forged-iron');
  const requestedStoneSkinId = datasetValue(rootElement, 'stoneSkinId')
    || String(stoneCatalog && stoneCatalog.DEFAULT_STONE_SKIN_ID || 'o-stone');
  const board = resolveDefinition(boardCatalog, 'getBoardSkinDefinition', requestedBoardSkinId, root);
  const frame = resolveDefinition(boardCatalog, 'getBoardFrameSkinDefinition', requestedFrameSkinId, root);
  const stone = resolveDefinition(stoneCatalog, 'getStoneSkinDefinition', requestedStoneSkinId, root);
  return Object.freeze({
    boardSkinId: String(board && board.id || requestedBoardSkinId),
    boardImageUrl: String(board && board.imagePath || ''),
    boardFrameSkinId: String(frame && frame.id || requestedFrameSkinId),
    boardFrameLayout: copyFrameLayout(frame && frame.layout),
    stoneSkinId: String(stone && stone.id || requestedStoneSkinId),
    blackStoneImageUrl: String(stone && stone.blackImagePath || ''),
    whiteStoneImageUrl: String(stone && stone.whiteImagePath || ''),
    revision: Math.max(0, Math.trunc(Number(revision) || 0))
  });
}

function cssUrl(path: string): string {
  return `url("${String(path || '').replace(/"/g, '\\"')}")`;
}

function setAttributeIfChanged(target: HTMLElement | null, name: string, value: string) {
  if (!target || target.getAttribute(name) === value) return;
  target.setAttribute(name, value);
}

function setStylePropertyIfChanged(target: HTMLElement | null, property: string, value: string) {
  if (!target || !target.style || target.style.getPropertyValue(property) === value) return;
  target.style.setProperty(property, value);
}

function applyFrameLayout(target: HTMLElement | null, layout: Readonly<Record<string, string | number>>) {
  if (!target || !target.style) return;
  const propertyByField: Record<string, string> = {
    paddingTop: '--board-frame-padding-top',
    paddingRight: '--board-frame-padding-right',
    paddingBottom: '--board-frame-padding-bottom',
    paddingLeft: '--board-frame-padding-left',
    artOverhangTop: '--board-frame-art-overhang-top',
    artOverhangBottom: '--board-frame-art-overhang-bottom',
    artOffsetY: '--board-frame-art-offset-y'
  };
  for (const field of FRAME_LAYOUT_FIELDS) {
    const property = propertyByField[field];
    const value = Number(layout && layout[field]);
    if (Number.isFinite(value)) setStylePropertyIfChanged(target, property, `calc(${value}px * var(--layout-stage-scale))`);
    else target.style.removeProperty(property);
  }
}

function topologyNeedsOversizeLayout(topology: BoardRenderTopologyModel): boolean {
  const baseMaxGrid = Math.max(1, topology.baseRows, topology.baseCols);
  const baseScale = baseMaxGrid > 8 ? 8 / baseMaxGrid : 1;
  return topology.renderRows * baseScale > 8.0001 || topology.renderCols * baseScale > 8.0001;
}

function presentBoardFrame(host: HTMLElement, frame: BoardVisualFrame) {
  if (!host || !frame) return;
  const doc = host.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const rootElement = doc && doc.documentElement as HTMLElement | null;
  const boardFrame = typeof host.closest === 'function' ? host.closest('#board-frame') as HTMLElement | null : null;
  const appearance = frame.appearance;
  const hasVoidCells = frame.model.cells.length < frame.model.topology.renderRows * frame.model.topology.renderCols;
  host.classList.toggle('board-has-void-cells', hasVoidCells);
  if (boardFrame && boardFrame.classList) boardFrame.classList.toggle('board-has-void-cells', hasVoidCells);

  setAttributeIfChanged(host, 'data-board-skin-id', appearance.boardSkinId);
  if (appearance.boardImageUrl) setStylePropertyIfChanged(host, '--board-surface-texture-image', cssUrl(appearance.boardImageUrl));
  if (rootElement) {
    setAttributeIfChanged(rootElement, 'data-board-skin-id', appearance.boardSkinId);
    setAttributeIfChanged(rootElement, 'data-board-frame-skin-id', appearance.boardFrameSkinId);
    setAttributeIfChanged(rootElement, 'data-stone-skin-id', appearance.stoneSkinId);
    if (appearance.boardImageUrl) setStylePropertyIfChanged(rootElement, '--board-surface-texture-image', cssUrl(appearance.boardImageUrl));
    if (appearance.blackStoneImageUrl) setStylePropertyIfChanged(rootElement, '--normal-stone-black-image', cssUrl(appearance.blackStoneImageUrl));
    if (appearance.whiteStoneImageUrl) setStylePropertyIfChanged(rootElement, '--normal-stone-white-image', cssUrl(appearance.whiteStoneImageUrl));
    applyFrameLayout(rootElement, appearance.boardFrameLayout);
  }
  if (boardFrame) {
    setAttributeIfChanged(boardFrame, 'data-board-frame-skin-id', appearance.boardFrameSkinId);
    applyFrameLayout(boardFrame, appearance.boardFrameLayout);
  }
  const oversize = topologyNeedsOversizeLayout(frame.model.topology);
  if (doc && doc.body && doc.body.classList) doc.body.classList.toggle('board-oversize-active', oversize);
  const gameContainer = boardFrame && typeof boardFrame.closest === 'function'
    ? boardFrame.closest('#game-container')
    : (doc && doc.getElementById ? doc.getElementById('game-container') : null);
  if (gameContainer && gameContainer.classList) gameContainer.classList.toggle('board-oversize-active', oversize);
}

export = {
  createBoardVisualFrameRevisionComposer,
  resolveBoardAppearanceDescriptor,
  topologyNeedsOversizeLayout,
  presentBoardFrame
};
