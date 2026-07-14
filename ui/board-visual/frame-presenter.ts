import type { BoardAppearanceDescriptor, BoardRenderTopologyModel, BoardVisualFrame } from './types';

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
    if (Number.isFinite(value)) target.style.setProperty(property, `calc(${value}px * var(--layout-stage-scale))`);
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

  host.setAttribute('data-board-skin-id', appearance.boardSkinId);
  if (appearance.boardImageUrl) host.style.setProperty('--board-surface-texture-image', cssUrl(appearance.boardImageUrl));
  if (rootElement) {
    rootElement.setAttribute('data-board-skin-id', appearance.boardSkinId);
    rootElement.setAttribute('data-board-frame-skin-id', appearance.boardFrameSkinId);
    rootElement.setAttribute('data-stone-skin-id', appearance.stoneSkinId);
    if (appearance.boardImageUrl) rootElement.style.setProperty('--board-surface-texture-image', cssUrl(appearance.boardImageUrl));
    if (appearance.blackStoneImageUrl) rootElement.style.setProperty('--normal-stone-black-image', cssUrl(appearance.blackStoneImageUrl));
    if (appearance.whiteStoneImageUrl) rootElement.style.setProperty('--normal-stone-white-image', cssUrl(appearance.whiteStoneImageUrl));
    applyFrameLayout(rootElement, appearance.boardFrameLayout);
  }
  if (boardFrame) {
    boardFrame.setAttribute('data-board-frame-skin-id', appearance.boardFrameSkinId);
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
  resolveBoardAppearanceDescriptor,
  topologyNeedsOversizeLayout,
  presentBoardFrame
};
