export interface BoardLayoutRuntimeDependencies {
  resolveBoardShape(): Readonly<{ rows: number; cols: number }>;
  requestRender(): void;
  getPerfBenchmarks?(): any;
  domLayoutGeometry: {
    readBoardFrameGeometryForLayout(host: any, appearance: any, revision: number): any;
  };
}

export interface BoardLayoutRuntime {
  syncBoardPixelSizing(boardElement: any, shapeInput?: any): any;
  syncBoardExpansionLayerGeometry(boardElement: any, shapeInput?: any): any;
  resolveBoardExpansionLayerElement(boardElement: any, createIfMissing?: any): any;
  applyBoardCssVars(boardElement: any): any;
  capPixiBoardViewport(host: any, topology: any): void;
  readBoardCellSize(host: any, topology?: any): number;
  readBoardFrameGeometry(host: any, appearance: any): any;
  getRevision(): number;
  invalidateHost(host: any): void;
  resetSession(): void;
  destroyPageRuntime(): void;
}

export function createBoardLayoutRuntime(dependencies: BoardLayoutRuntimeDependencies): BoardLayoutRuntime {
  if (!dependencies || typeof dependencies.resolveBoardShape !== 'function'
    || typeof dependencies.requestRender !== 'function' || !dependencies.domLayoutGeometry
    || typeof dependencies.domLayoutGeometry.readBoardFrameGeometryForLayout !== 'function') {
    throw new Error('Board layout runtime dependencies are incomplete');
  }

  // PR2 N3 syncBoardPixelSizing dirty gate.
  // Revision 2 (PR2 v2):
  //   signature expanded from (rows, cols, frameExists) to a 12-key composite that
  //   also catches element identity swaps, skin switches, layout scale changes,
  //   frame padding changes, and devicePixelRatio shifts. getComputedStyle() is
  //   intentionally NOT used in signature computation (would reflow inside the
  //   gate we just opened to remove reflow). The dirty flag is forced true on:
  //     - module load (initial sync)
  //     - _handleBoardPixelSizingViewportChange (window/frame resize)
  //     - _ensureBoardPixelSizingObserver when the observed frame is swapped
  //     - ResizeObserver-less / frame-absent fallback paths
  //     - visibilitychange (when document becomes visible)
  //     - pageshow (bfcache restoration)
  let _boardPixelSizingSignature: string | null = null;
  let _boardPixelSizingDirty = true;
  let _boardPixelSizingRevision = 0;
  let boardPixelSizingObserver: any = null;
  let boardPixelSizingObservedFrame: any = null;
  let boardPixelSizingObservedElement: any = null;
  let boardPixelSizingWindowHandlerInstalled = false;
  let _boardPixelSizingPageStateHandlersInstalled = false;
  const _boardElementIdentityToken = new WeakMap<any, number>();
  const _frameElementIdentityToken = new WeakMap<any, number>();
  let _nextBoardElementIdentity = 1;
  let _nextFrameElementIdentity = 1;
  const _boardPixelSizingShapeByElement = new WeakMap<any, any>();
  const _boardPixelSizingMeasurementByElement = new WeakMap<any, { signature: string; measurement: any }>();
  const _pixiViewportSizingSignatureByElement = new WeakMap<any, string>();
  const STANDARD_BOARD_BASELINE_ROWS = 8;
  const STANDARD_BOARD_BASELINE_COLS = 8;
  const BOARD_FRAME_OVERSIZE_TOLERANCE_PX = 1;

  function _isBoardShapeOversizeForPixelSizing(shape: any) {
      const rows = shape && Number.isFinite(shape.rows) ? shape.rows : STANDARD_BOARD_BASELINE_ROWS;
      const cols = shape && Number.isFinite(shape.cols) ? shape.cols : STANDARD_BOARD_BASELINE_COLS;
      return rows > STANDARD_BOARD_BASELINE_ROWS || cols > STANDARD_BOARD_BASELINE_COLS;
  }

  function _normalizeBoardShapeForPixelSizing(shapeOrState: any) {
      const rows = Number(shapeOrState && shapeOrState.rows);
      const cols = Number(shapeOrState && shapeOrState.cols);
      if (Number.isFinite(rows) && Number.isFinite(cols)) {
          const normalizedRows = Math.max(1, Math.trunc(rows));
          const normalizedCols = Math.max(1, Math.trunc(cols));
          const baseRowsValue = Number(shapeOrState && shapeOrState.baseRows);
          const baseColsValue = Number(shapeOrState && shapeOrState.baseCols);
          const minRowValue = Number(shapeOrState && shapeOrState.minRow);
          const minColValue = Number(shapeOrState && shapeOrState.minCol);
          const baseRows = Number.isFinite(baseRowsValue) ? Math.max(1, Math.trunc(baseRowsValue)) : normalizedRows;
          const baseCols = Number.isFinite(baseColsValue) ? Math.max(1, Math.trunc(baseColsValue)) : normalizedCols;
          const minRow = Number.isFinite(minRowValue) ? Math.trunc(minRowValue) : 0;
          const minCol = Number.isFinite(minColValue) ? Math.trunc(minColValue) : 0;
          return {
              rows: normalizedRows,
              cols: normalizedCols,
              baseRows,
              baseCols,
              minRow,
              minCol,
              maxRow: minRow + normalizedRows - 1,
              maxCol: minCol + normalizedCols - 1
          };
      }
      const fallbackShape = dependencies.resolveBoardShape();
      return {
          rows: fallbackShape.rows,
          cols: fallbackShape.cols,
          baseRows: fallbackShape.rows,
          baseCols: fallbackShape.cols,
          minRow: 0,
          minCol: 0,
          maxRow: fallbackShape.rows - 1,
          maxCol: fallbackShape.cols - 1
      };
  }

  function _clearBoardPixelSizingVars(boardElement: any) {
      if (boardElement && boardElement.style) {
          boardElement.style.removeProperty('width');
          boardElement.style.removeProperty('height');
          boardElement.style.removeProperty('left');
          boardElement.style.removeProperty('top');
          boardElement.style.removeProperty('transform');
          boardElement.style.removeProperty('--board-cell-size-px');
          boardElement.style.removeProperty('--board-cell-scale');
          boardElement.style.removeProperty('--board-disc-inset-px');
          boardElement.style.removeProperty('--board-disc-size-px');
      }
      _clearBoardExpansionLayerGeometry(boardElement);
      const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
      _clearBoardFramePixelSizingVars(frameElement);
      _setBoardOversizeLayoutState(frameElement, false);
  }

  function _getBoardFrameElementForPixelSizing(boardElement: any) {
      if (!boardElement) return null;
      if (typeof boardElement.closest === 'function') {
          const closestFrame = boardElement.closest('#board-frame');
          if (closestFrame) return closestFrame;
      }
      if (typeof document !== 'undefined' && document && typeof document.getElementById === 'function') {
          return document.getElementById('board-frame');
      }
      return null;
  }

  function resolveBoardExpansionLayerElement(boardElement: any, createIfMissing?: any) {
      if (typeof document === 'undefined' || !document) return null;
      const boardFrame = _getBoardFrameElementForPixelSizing(boardElement);
      const boardStack = boardFrame && boardFrame.parentElement
          ? boardFrame.parentElement
          : (boardElement && boardElement.parentElement ? boardElement.parentElement : null);
      if (!boardStack) return null;

      let layer = null;
      if (typeof boardStack.querySelector === 'function') {
          layer = boardStack.querySelector('#board-expansion-layer');
      }
      const rendererKind = boardElement && typeof boardElement.getAttribute === 'function'
          ? boardElement.getAttribute('data-board-renderer')
          : null;
      const mayCreateCompatibilityLayer = !!createIfMissing && rendererKind === 'dom';
      if (layer || !mayCreateCompatibilityLayer || typeof document.createElement !== 'function') {
          return layer;
      }

      layer = document.createElement('div');
      layer.id = 'board-expansion-layer';
      layer.setAttribute('aria-hidden', 'true');
      const chargeHudLayer = typeof boardStack.querySelector === 'function'
          ? boardStack.querySelector('#charge-hud-layer')
          : null;
      if (chargeHudLayer && chargeHudLayer.parentNode === boardStack) {
          boardStack.insertBefore(layer, chargeHudLayer);
      } else if (boardFrame && boardFrame.parentNode === boardStack) {
          boardStack.insertBefore(layer, boardFrame.nextSibling);
      } else {
          boardStack.appendChild(layer);
      }
      return layer;
  }
  function _clearBoardExpansionLayerGeometry(boardElement: any) {
      const expansionLayer = resolveBoardExpansionLayerElement(boardElement, false);
      if (!expansionLayer || !expansionLayer.style) return;
      expansionLayer.style.removeProperty('left');
      expansionLayer.style.removeProperty('top');
      expansionLayer.style.removeProperty('width');
      expansionLayer.style.removeProperty('height');
      expansionLayer.style.removeProperty('--board-rows');
      expansionLayer.style.removeProperty('--board-cols');
  }

  function _isDomCompatibilityBoardForPixelSizing(boardElement: any) {
      return !!(
          boardElement
          && typeof boardElement.getAttribute === 'function'
          && boardElement.getAttribute('data-board-renderer') === 'dom'
      );
  }

  function _getBaseViewportShapeForPixelSizing(shape: any) {
      const baseRows = Number.isFinite(shape && shape.baseRows) ? Math.max(1, Math.trunc(shape.baseRows)) : shape.rows;
      const baseCols = Number.isFinite(shape && shape.baseCols) ? Math.max(1, Math.trunc(shape.baseCols)) : shape.cols;
      return {
          rows: baseRows,
          cols: baseCols,
          baseRows,
          baseCols,
          minRow: 0,
          minCol: 0,
          maxRow: baseRows - 1,
          maxCol: baseCols - 1
      };
  }

  function syncBoardExpansionLayerGeometry(boardElement: any, shapeInput?: any) {
      const expansionLayer = resolveBoardExpansionLayerElement(boardElement, true);
      const shape = _normalizeBoardShapeForPixelSizing(shapeInput);
      if (!expansionLayer || !expansionLayer.style) return shape;
      const baseViewportShape = _getBaseViewportShapeForPixelSizing(shape);

      // The compatibility expansion layer is positioned over the fixed initial
      // board viewport. Its percentages must therefore use the initial shape,
      // not the sparse render bounds that include attached expansion cells.
      expansionLayer.style.setProperty('--board-rows', String(baseViewportShape.rows));
      expansionLayer.style.setProperty('--board-cols', String(baseViewportShape.cols));

      if (!boardElement) return shape;

      let width = 0;
      let height = 0;
      let left = 0;
      let top = 0;

      if (typeof boardElement.getBoundingClientRect === 'function') {
          const boardRect = boardElement.getBoundingClientRect();
          width = Number.isFinite(boardRect.width) ? boardRect.width : 0;
          height = Number.isFinite(boardRect.height) ? boardRect.height : 0;
          const offsetParent = expansionLayer.offsetParent || expansionLayer.parentElement;
          if (offsetParent && typeof offsetParent.getBoundingClientRect === 'function') {
              const offsetRect = offsetParent.getBoundingClientRect();
              left = Number.isFinite(boardRect.left) && Number.isFinite(offsetRect.left) ? boardRect.left - offsetRect.left : 0;
              top = Number.isFinite(boardRect.top) && Number.isFinite(offsetRect.top) ? boardRect.top - offsetRect.top : 0;
          }
      }

      if (!(width > 0)) {
          const styleWidth = Number.parseFloat(boardElement.style && boardElement.style.width ? boardElement.style.width : '0');
          width = Number.isFinite(styleWidth) ? styleWidth : 0;
      }
      if (!(height > 0)) {
          const styleHeight = Number.parseFloat(boardElement.style && boardElement.style.height ? boardElement.style.height : '0');
          height = Number.isFinite(styleHeight) ? styleHeight : 0;
      }
      if (!Number.isFinite(left) || !Number.isFinite(top)) {
          left = 0;
          top = 0;
      }

      expansionLayer.style.left = `${left}px`;
      expansionLayer.style.top = `${top}px`;
      if (width > 0) expansionLayer.style.width = `${width}px`;
      else expansionLayer.style.removeProperty('width');
      if (height > 0) expansionLayer.style.height = `${height}px`;
      else expansionLayer.style.removeProperty('height');

      return shape;
  }

  function _clearBoardFramePixelSizingVars(frameElement: any) {
      if (!frameElement || !frameElement.style) return;
      frameElement.style.removeProperty('--board-frame-outer-width');
      frameElement.style.removeProperty('--board-frame-outer-height');
  }

  function _getBoardLayoutContainerForPixelSizing(frameElement: any) {
      if (frameElement && typeof frameElement.closest === 'function') {
          const closestContainer = frameElement.closest('#game-container');
          if (closestContainer) return closestContainer;
      }
      if (typeof document !== 'undefined' && document && typeof document.getElementById === 'function') {
          return document.getElementById('game-container');
      }
      return null;
  }

  function _setBoardOversizeLayoutState(frameElement: any, active: any) {
      const oversizeActive = !!active;
      if (typeof document !== 'undefined' && document && document.body && document.body.classList) {
          document.body.classList.toggle('board-oversize-active', oversizeActive);
      }
      const layoutContainer = _getBoardLayoutContainerForPixelSizing(frameElement);
      if (layoutContainer && layoutContainer.classList) {
          layoutContainer.classList.toggle('board-oversize-active', oversizeActive);
      }
  }

  function _measureBoardFrameBaseOuterSize(frameElement: any) {
      if (!frameElement || typeof document === 'undefined' || !document || typeof document.createElement !== 'function') {
          return null;
      }
      const probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.position = 'absolute';
      probe.style.left = '0';
      probe.style.top = '0';
      probe.style.width = 'calc(var(--board-frame-inner-size) + var(--board-frame-padding-left) + var(--board-frame-padding-right))';
      probe.style.height = 'calc(var(--board-frame-inner-size) + var(--board-frame-padding-top) + var(--board-frame-padding-bottom))';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.boxSizing = 'border-box';
      probe.style.padding = '0';
      probe.style.margin = '0';
      probe.style.border = '0';
      frameElement.appendChild(probe);
      let rect: any = null;
      if (typeof probe.getBoundingClientRect === 'function') {
          rect = probe.getBoundingClientRect();
      }
      frameElement.removeChild(probe);
      if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
      return { width: rect.width, height: rect.height };
  }

  function _getContentRectSizeForPixelSizing(element: any) {
      if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function' || typeof element.getBoundingClientRect !== 'function') {
          return null;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const borderX = Number.parseFloat(style.borderLeftWidth || '0') + Number.parseFloat(style.borderRightWidth || '0');
      const borderY = Number.parseFloat(style.borderTopWidth || '0') + Number.parseFloat(style.borderBottomWidth || '0');
      const width = rect.width - (Number.isFinite(borderX) ? borderX : 0);
      const height = rect.height - (Number.isFinite(borderY) ? borderY : 0);
      if (!(width > 0) || !(height > 0)) return null;
      return { width, height };
  }

  function _getBoardBoxMetricsForPixelSizing(boardElement: any) {
      if (!boardElement || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
          return { borderX: 0, borderY: 0, boxSizing: '' };
      }
      const style = window.getComputedStyle(boardElement);
      const borderX = Number.parseFloat(style.borderLeftWidth || '0') + Number.parseFloat(style.borderRightWidth || '0');
      const borderY = Number.parseFloat(style.borderTopWidth || '0') + Number.parseFloat(style.borderBottomWidth || '0');
      return {
          borderX: Number.isFinite(borderX) ? borderX : 0,
          borderY: Number.isFinite(borderY) ? borderY : 0,
          boxSizing: String(style.boxSizing || '').trim().toLowerCase()
      };
  }

  function _getBoardFrameMetricsForPixelSizing(boardElement: any) {
      const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
      if (frameElement && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && typeof frameElement.getBoundingClientRect === 'function') {
          const frameStyle = window.getComputedStyle(frameElement);
          const paddingX = Number.parseFloat(frameStyle.paddingLeft || '0') + Number.parseFloat(frameStyle.paddingRight || '0');
          const paddingY = Number.parseFloat(frameStyle.paddingTop || '0') + Number.parseFloat(frameStyle.paddingBottom || '0');
          const measuredBaseOuterSize = _measureBoardFrameBaseOuterSize(frameElement);
          const fallbackRect = frameElement.getBoundingClientRect();
          const baseOuterWidth = measuredBaseOuterSize && measuredBaseOuterSize.width > 0
              ? measuredBaseOuterSize.width
              : fallbackRect.width;
          const baseOuterHeight = measuredBaseOuterSize && measuredBaseOuterSize.height > 0
              ? measuredBaseOuterSize.height
              : fallbackRect.height;
          const normalizedPaddingX = Number.isFinite(paddingX) ? paddingX : 0;
          const normalizedPaddingY = Number.isFinite(paddingY) ? paddingY : 0;
          const innerWidth = baseOuterWidth - normalizedPaddingX;
          const innerHeight = baseOuterHeight - normalizedPaddingY;
          if (innerWidth > 0 && innerHeight > 0) {
              return {
                  frameElement,
                  baseOuterWidth,
                  baseOuterHeight,
                  paddingX: normalizedPaddingX,
                  paddingY: normalizedPaddingY,
                  innerWidth,
                  innerHeight
              };
          }
      }
      return null;
  }

  function _getBoardBaseSizeForPixelSizing(boardElement: any) {
      const frameMetrics = _getBoardFrameMetricsForPixelSizing(boardElement);
      if (frameMetrics) {
          return {
              frameMetrics,
              width: frameMetrics.innerWidth,
              height: frameMetrics.innerHeight,
              baselineCellSize: Math.max(1, Math.floor(Math.min(
                  frameMetrics.innerWidth / STANDARD_BOARD_BASELINE_COLS,
                  frameMetrics.innerHeight / STANDARD_BOARD_BASELINE_ROWS
              )))
          };
      }
      const contentRect = _getContentRectSizeForPixelSizing(boardElement);
      if (!contentRect) return null;
      return {
          frameMetrics: null,
          width: contentRect.width,
          height: contentRect.height,
          baselineCellSize: 0
      };
  }

  function _applyBoardFramePixelSizing(frameMetrics: any, outerWidth: any, outerHeight: any, shape: any) {
      if (!frameMetrics || !frameMetrics.frameElement || !frameMetrics.frameElement.style) return;
      const frameWidth = Math.max(frameMetrics.baseOuterWidth, outerWidth + frameMetrics.paddingX);
      const frameHeight = Math.max(frameMetrics.baseOuterHeight, outerHeight + frameMetrics.paddingY);
      const allowFrameExpansion = _isBoardShapeOversizeForPixelSizing(shape);
      const oversizeActive = allowFrameExpansion && (
          frameWidth > (frameMetrics.baseOuterWidth + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)
          || frameHeight > (frameMetrics.baseOuterHeight + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)
      );
      if (allowFrameExpansion && frameWidth > (frameMetrics.baseOuterWidth + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)) {
          frameMetrics.frameElement.style.setProperty('--board-frame-outer-width', `${frameWidth}px`);
      } else {
          frameMetrics.frameElement.style.removeProperty('--board-frame-outer-width');
      }
      if (allowFrameExpansion && frameHeight > (frameMetrics.baseOuterHeight + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)) {
          frameMetrics.frameElement.style.setProperty('--board-frame-outer-height', `${frameHeight}px`);
      } else {
          frameMetrics.frameElement.style.removeProperty('--board-frame-outer-height');
      }
      _setBoardOversizeLayoutState(frameMetrics.frameElement, oversizeActive);
  }

  // PR2 v2: page-state listeners (visibilitychange / pageshow). Visible-tab
  // transitions and bfcache restoration can re-introduce viewport / DPR
  // changes without firing resize, so we always re-sync on those events.
  function _handleBoardPixelSizingVisibilityChange() {
      if (typeof document !== 'undefined' && document && (document as any).visibilityState === 'visible') {
          _boardPixelSizingDirty = true;
      }
  }

  function _handleBoardPixelSizingPageShow() {
      _boardPixelSizingDirty = true;
  }

  function _installBoardPixelSizingPageStateHandlers() {
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
      if (_boardPixelSizingPageStateHandlersInstalled) return;
      window.addEventListener('visibilitychange', _handleBoardPixelSizingVisibilityChange);
      window.addEventListener('pageshow', _handleBoardPixelSizingPageShow);
      _boardPixelSizingPageStateHandlersInstalled = true;
  }

  // PR2 v2: stable identity tokens for boardEl / frameEl. Same ref always returns
  // the same token; a ref swap gets a fresh token which immediately invalidates
  // the cached signature.
  function _getBoardElementIdentityToken(el: any): number {
      if (!el) return 0;
      let t = _boardElementIdentityToken.get(el);
      if (t === undefined) {
          t = _nextBoardElementIdentity++;
          _boardElementIdentityToken.set(el, t);
      }
      return t;
  }

  function _getFrameElementIdentityToken(el: any): number {
      if (!el) return 0;
      let t = _frameElementIdentityToken.get(el);
      if (t === undefined) {
          t = _nextFrameElementIdentity++;
          _frameElementIdentityToken.set(el, t);
      }
      return t;
  }

  // PR2 v2: sizing signature. All entries are stable across normal renders and
  // change only at the boundaries where _boardPixelSizingDirty is forced true:
  //   1-2: shape rows/cols
  //   3-6: base shape and world-coordinate origin
  //   7-8: boardEl / frameEl WeakMap identity tokens
  //   9-10: root data-board-skin-id / data-board-frame-skin-id (skin switch)
  //   11: --layout-stage-scale (inline root style, layout profile scale)
  //   12-15: --board-frame-padding-{top,right,bottom,left} (frame skin switch)
  //   16: window.devicePixelRatio (DPR shift)
  //   17: active renderer kind (DOM compatibility uses the fixed base viewport)
  // getComputedStyle() is intentionally avoided here (would force layout
  // inside the very gate that exists to avoid layout).
  function _computeBoardPixelSizingSignature(boardElement: any, shape: any): string {
      const frameEl = _getBoardFrameElementForPixelSizing(boardElement);
      const docEl = (typeof document !== 'undefined' && document && document.documentElement) || null;
      const rootStyle = (docEl && (docEl as any).style) || null;
      const rootDataset = (docEl && (docEl as any).dataset) || null;
      const dpr = (typeof window !== 'undefined' && Number.isFinite((window as any).devicePixelRatio))
          ? String((window as any).devicePixelRatio) : '0';
      const boardSkinId = rootDataset ? String((rootDataset as any).boardSkinId || '') : '';
      const frameSkinId = rootDataset ? String((rootDataset as any).boardFrameSkinId || '') : '';
      const rendererKind = boardElement && typeof boardElement.getAttribute === 'function'
          ? String(boardElement.getAttribute('data-board-renderer') || '')
          : '';
      const layoutScale = rootStyle ? rootStyle.getPropertyValue('--layout-stage-scale') : '';
      const padTop = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-top') : '';
      const padRight = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-right') : '';
      const padBottom = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-bottom') : '';
      const padLeft = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-left') : '';
      return [
          shape.rows,
          shape.cols,
          shape.baseRows,
          shape.baseCols,
          shape.minRow,
          shape.minCol,
          _getBoardElementIdentityToken(boardElement),
          _getFrameElementIdentityToken(frameEl),
          boardSkinId,
          frameSkinId,
          layoutScale,
          padTop, padRight, padBottom, padLeft,
          dpr,
          rendererKind
      ].join('|');
  }

  function _getBoardAnchorOffsetForPixelSizing(shape: any, cellSize: number) {
      const baseRows = Number.isFinite(shape && shape.baseRows) ? shape.baseRows : shape.rows;
      const baseCols = Number.isFinite(shape && shape.baseCols) ? shape.baseCols : shape.cols;
      const minRow = Number.isFinite(shape && shape.minRow) ? shape.minRow : 0;
      const minCol = Number.isFinite(shape && shape.minCol) ? shape.minCol : 0;
      const maxRow = Number.isFinite(shape && shape.maxRow) ? shape.maxRow : (minRow + shape.rows - 1);
      const maxCol = Number.isFinite(shape && shape.maxCol) ? shape.maxCol : (minCol + shape.cols - 1);
      const topGrowth = Math.max(0, -minRow);
      const leftGrowth = Math.max(0, -minCol);
      const bottomGrowth = Math.max(0, maxRow - (baseRows - 1));
      const rightGrowth = Math.max(0, maxCol - (baseCols - 1));
      return {
          x: ((rightGrowth - leftGrowth) * cellSize) / 2,
          y: ((bottomGrowth - topGrowth) * cellSize) / 2
      };
  }

  function _measureBoardPixelSizing(boardElement: any, shape: any) {
      const signature = _computeBoardPixelSizingSignature(boardElement, shape);
      const cached = boardElement && _boardPixelSizingMeasurementByElement.get(boardElement);
      if (!_boardPixelSizingDirty && cached && cached.signature === signature) {
          return cached.measurement;
      }
      const baseSize = _getBoardBaseSizeForPixelSizing(boardElement);
      if (!baseSize || !(baseSize.width > 0) || !(baseSize.height > 0)) {
          if (boardElement) _boardPixelSizingMeasurementByElement.delete(boardElement);
          return null;
      }
      const measuredCellSize = Math.max(1, Math.floor(Math.min(baseSize.width / shape.cols, baseSize.height / shape.rows)));
      const baselineCellSize = Math.max(0, Number(baseSize.baselineCellSize) || 0);
      const baseRows = Number.isFinite(shape.baseRows) ? shape.baseRows : shape.rows;
      const baseCols = Number.isFinite(shape.baseCols) ? shape.baseCols : shape.cols;
      const baseMaxGrid = Math.max(baseRows, baseCols);
      const initialBoardScale = baseMaxGrid > STANDARD_BOARD_BASELINE_ROWS
          ? STANDARD_BOARD_BASELINE_ROWS / baseMaxGrid
          : 1;
      const scaledBaselineCellSize = baselineCellSize > 0
          ? Math.max(1, Math.floor(baselineCellSize * initialBoardScale))
          : measuredCellSize;
      const cellSize = baseMaxGrid > STANDARD_BOARD_BASELINE_ROWS
          ? scaledBaselineCellSize
          : Math.max(1, Math.max(measuredCellSize, baselineCellSize));
      const measurement = cellSize > 0 ? { baseSize, baselineCellSize, cellSize } : null;
      if (boardElement && measurement) {
          _boardPixelSizingMeasurementByElement.set(boardElement, { signature, measurement });
      }
      return measurement;
  }

  function _handleBoardPixelSizingViewportChange() {
      if (!boardPixelSizingObservedElement) return;
      // Window/frame resize must always re-sync even when the signature is unchanged.
      _boardPixelSizingDirty = true;
      dependencies.requestRender();
  }

  function _ensureBoardPixelSizingObserver(boardElement: any) {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !boardPixelSizingWindowHandlerInstalled) {
          window.addEventListener('resize', _handleBoardPixelSizingViewportChange, { passive: true });
          boardPixelSizingWindowHandlerInstalled = true;
          // PR2 v2: page-state listeners installed alongside the resize listener
          // so they share the same one-time setup contract.
          _installBoardPixelSizingPageStateHandlers();
      }

      boardPixelSizingObservedElement = boardElement || boardPixelSizingObservedElement;
      const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
      // PR2 v2: in fallback / frame-detached paths, the cached signature can no
      // longer be trusted to represent current state, so force the next
      // syncBoardPixelSizing() call into the full path.
      if (typeof ResizeObserver !== 'function' || !frameElement) {
          _boardPixelSizingDirty = true;
          return;
      }
      if (boardPixelSizingObserver && boardPixelSizingObservedFrame === frameElement) return;

      if (boardPixelSizingObserver && typeof boardPixelSizingObserver.disconnect === 'function') {
          try {
              boardPixelSizingObserver.disconnect();
          } catch (e: any) { /* ignore */ }
      }

      boardPixelSizingObservedFrame = frameElement;
      try {
          boardPixelSizingObserver = new ResizeObserver(_handleBoardPixelSizingViewportChange);
          boardPixelSizingObserver.observe(frameElement);
      } catch (e: any) {
          boardPixelSizingObserver = null;
      }
      // PR2 (N3 dirty gate): when the observed frame element is swapped (or this
      // is the first live element), the cached signature no longer applies.
      // Force re-sync on the next syncBoardPixelSizing call.
      _boardPixelSizingDirty = true;
  }
  function syncBoardPixelSizing(boardElement: any, shapeInput?: any) {
      const perfBenchmarks = dependencies.getPerfBenchmarks?.();
      if (perfBenchmarks) perfBenchmarks.perfStart('syncBoardPixelSizing');
      try {
          const rememberedShape = boardElement && _boardPixelSizingShapeByElement.get(boardElement);
          const shape = _normalizeBoardShapeForPixelSizing(shapeInput || rememberedShape);
      if (!boardElement || !boardElement.style) return shape;
      if (shapeInput) _boardPixelSizingShapeByElement.set(boardElement, shape);

      _ensureBoardPixelSizingObserver(boardElement);

      // PR2 (N3 dirty gate): skip the body when signature is unchanged and no
      // force-dirty flag was set. The skipped steps include getComputedStyle,
      // getBoundingClientRect (incl. the snap-to-whole-pixel call), every
      // style.* write, and the follow-on syncBoardExpansionLayerGeometry.
      // PR2 v2: signature expanded to 12 keys (shape, element identity tokens,
      // root skin ids, layout-stage-scale, frame padding vars, DPR) so that
      // skin switches and layout-scale changes invalidate the cached gate.
      const _currentSig = _computeBoardPixelSizingSignature(boardElement, shape);
      if (!_boardPixelSizingDirty && _currentSig === _boardPixelSizingSignature) {
          return shape;
      }

      const isDomCompatibilityBoard = _isDomCompatibilityBoardForPixelSizing(boardElement);
      const viewportShape = isDomCompatibilityBoard
          ? _getBaseViewportShapeForPixelSizing(shape)
          : shape;
      const boxMetrics = _getBoardBoxMetricsForPixelSizing(boardElement);
      const measurement = _measureBoardPixelSizing(boardElement, viewportShape);
      if (!measurement) {
          _clearBoardPixelSizingVars(boardElement);
          return shape;
      }
      const { baseSize, baselineCellSize, cellSize } = measurement;

      const discInset = Math.max(1, Math.round(cellSize * 0.0505));
      const discSize = Math.max(1, cellSize - (discInset * 2));
      const contentWidth = cellSize * viewportShape.cols;
      const contentHeight = cellSize * viewportShape.rows;
      const outerWidth = contentWidth + (boxMetrics.boxSizing === 'border-box' ? boxMetrics.borderX : 0);
      const outerHeight = contentHeight + (boxMetrics.boxSizing === 'border-box' ? boxMetrics.borderY : 0);
      boardElement.style.width = `${outerWidth}px`;
      boardElement.style.height = `${outerHeight}px`;
      boardElement.style.setProperty('--board-cell-size-px', `${cellSize}px`);
      boardElement.style.setProperty('--board-cell-scale', baselineCellSize > 0 ? String(cellSize / baselineCellSize) : '1');
      boardElement.style.setProperty('--board-disc-inset-px', `${discInset}px`);
      boardElement.style.setProperty('--board-disc-size-px', `${discSize}px`);
      boardElement.style.setProperty('--board-rows', String(viewportShape.rows));
      boardElement.style.setProperty('--board-cols', String(viewportShape.cols));
      _applyBoardFramePixelSizing(baseSize.frameMetrics, outerWidth, outerHeight, viewportShape);

      const anchorOffset = _getBoardAnchorOffsetForPixelSizing(viewportShape, cellSize);
      boardElement.style.left = anchorOffset.x ? `${anchorOffset.x}px` : '';
      boardElement.style.top = anchorOffset.y ? `${anchorOffset.y}px` : '';
      boardElement.style.removeProperty('transform');
      if (!isDomCompatibilityBoard && typeof boardElement.getBoundingClientRect === 'function') {
          const snappedRect = boardElement.getBoundingClientRect();
          const snapX = Number.isFinite(snappedRect.left) ? (Math.round(snappedRect.left) - snappedRect.left) : 0;
          const snapY = Number.isFinite(snappedRect.top) ? (Math.round(snappedRect.top) - snappedRect.top) : 0;
          if (Math.abs(snapX) > 0.001 || Math.abs(snapY) > 0.001) {
              // Keep the board aligned to whole pixels without compositing the full board via transform.
              boardElement.style.left = `${anchorOffset.x + snapX}px`;
              boardElement.style.top = `${anchorOffset.y + snapY}px`;
          }
      }
      syncBoardExpansionLayerGeometry(boardElement, shape);
      // The writes above change the live board/frame geometry. Do not let the
      // pre-write measurement seed the Pixi viewport; the first post-sync read
      // establishes the reusable settled-layout measurement instead.
      _boardPixelSizingMeasurementByElement.delete(boardElement);
      // PR2 (N3 dirty gate): commit new signature and clear the dirty flag so
      // the next call (with the same signature) can early-return.
      _boardPixelSizingSignature = _currentSig;
      _boardPixelSizingDirty = false;
      _boardPixelSizingRevision = _boardPixelSizingRevision >= Number.MAX_SAFE_INTEGER
          ? 1
          : _boardPixelSizingRevision + 1;
      return shape;
      } finally {
          if (perfBenchmarks) perfBenchmarks.perfEnd('syncBoardPixelSizing');
      }
  }

  function _applyBoardCssVarsForBoardRenderer(boardElement: any) {
      const shape = dependencies.resolveBoardShape();
      if (boardElement && boardElement.style) {
          boardElement.style.setProperty('--board-rows', String(shape.rows));
          boardElement.style.setProperty('--board-cols', String(shape.cols));
      }
      syncBoardPixelSizing(boardElement, shape);
      return shape;
  }

  function _capPixiBoardViewportForBoardRenderer(host: any, topology: any) {
      const cellSize = _readBoardCellSizeForLayout(host, topology);
      const viewportSizingSignature = [
          getRevision(),
          Number(topology && topology.renderRows) || 0,
          Number(topology && topology.renderCols) || 0,
          Number(topology && topology.baseRows) || 0,
          Number(topology && topology.baseCols) || 0,
          Number(topology && topology.minRow) || 0,
          Number(topology && topology.minCol) || 0,
          cellSize
      ].join('|');
      if (host && _pixiViewportSizingSignatureByElement.get(host) === viewportSizingSignature) {
          return;
      }
      const shape = _normalizeBoardShapeForPixelSizing({
          rows: topology.renderRows,
          cols: topology.renderCols,
          baseRows: topology.baseRows,
          baseCols: topology.baseCols,
          minRow: topology.minRow,
          minCol: topology.minCol
      });
      const measurement = _measureBoardPixelSizing(host, shape);
      const boxMetrics = _getBoardBoxMetricsForPixelSizing(host);
      const availableWidth = Number(measurement && measurement.baseSize && measurement.baseSize.width);
      const availableHeight = Number(measurement && measurement.baseSize && measurement.baseSize.height);
      const baseContentWidth = Math.min(
          shape.baseCols * cellSize,
          availableWidth > 0 ? availableWidth : Number.POSITIVE_INFINITY
      );
      const baseContentHeight = Math.min(
          shape.baseRows * cellSize,
          availableHeight > 0 ? availableHeight : Number.POSITIVE_INFINITY
      );
      const borderWidth = boxMetrics.boxSizing === 'border-box' ? boxMetrics.borderX : 0;
      const borderHeight = boxMetrics.boxSizing === 'border-box' ? boxMetrics.borderY : 0;

      // #board is the physical viewport in the Pixi lane. The logical render
      // bounds live only on #board-scroll-surface, so expansion never grows the
      // DOM frame/backbuffer and the camera can preserve upper/left anchors by
      // adjusting scroll in the same apply.
      host.style.width = `${baseContentWidth + borderWidth}px`;
      host.style.height = `${baseContentHeight + borderHeight}px`;
      host.style.removeProperty('left');
      host.style.removeProperty('top');
      host.style.removeProperty('transform');

      const frameElement = _getBoardFrameElementForPixelSizing(host);
      _clearBoardFramePixelSizingVars(frameElement);
      _setBoardOversizeLayoutState(frameElement, false);

      if (typeof host.getBoundingClientRect === 'function') {
          const viewportRect = host.getBoundingClientRect();
          const snapX = Number.isFinite(viewportRect.left) ? Math.round(viewportRect.left) - viewportRect.left : 0;
          const snapY = Number.isFinite(viewportRect.top) ? Math.round(viewportRect.top) - viewportRect.top : 0;
          if (Math.abs(snapX) > 0.001) host.style.left = `${snapX}px`;
          if (Math.abs(snapY) > 0.001) host.style.top = `${snapY}px`;
      }
      if (host) _pixiViewportSizingSignatureByElement.set(host, viewportSizingSignature);
  }

  function _readBoardCellSizeForLayout(host: any, topology?: any) {
      if (host && topology) {
          const shape = _normalizeBoardShapeForPixelSizing({
              rows: topology.renderRows,
              cols: topology.renderCols,
              baseRows: topology.baseRows,
              baseCols: topology.baseCols,
              minRow: topology.minRow,
              minCol: topology.minCol
          });
          const measurement = _measureBoardPixelSizing(host, shape);
          if (measurement && measurement.cellSize > 0) return measurement.cellSize;
      }
      try {
          const value = parseFloat(String(host && host.style && host.style.getPropertyValue('--board-cell-size-px') || ''));
          if (Number.isFinite(value) && value > 0) return value;
      } catch (e: any) { /* use unit fallback */ }
      return 1;
  }

  function _readBoardFrameGeometryForLayout(host: any, appearance: any) {
      return dependencies.domLayoutGeometry.readBoardFrameGeometryForLayout(
          host,
          appearance,
          getRevision()
      );
  }

  function getRevision(): number {
    return _boardPixelSizingRevision;
  }

  function invalidateHost(host: any): void {
    _boardPixelSizingSignature = null;
    _boardPixelSizingDirty = true;
    if (!host) return;
    _boardPixelSizingMeasurementByElement.delete(host);
    _pixiViewportSizingSignatureByElement.delete(host);
  }

  function resetSession(): void {
    invalidateHost(boardPixelSizingObservedElement);
  }

  function destroyPageRuntime(): void {
    if (boardPixelSizingObserver && typeof boardPixelSizingObserver.disconnect === 'function') {
      try { boardPixelSizingObserver.disconnect(); } catch (error: any) { /* best-effort page teardown */ }
    }
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      if (boardPixelSizingWindowHandlerInstalled) window.removeEventListener('resize', _handleBoardPixelSizingViewportChange);
      if (_boardPixelSizingPageStateHandlersInstalled) {
        window.removeEventListener('visibilitychange', _handleBoardPixelSizingVisibilityChange);
        window.removeEventListener('pageshow', _handleBoardPixelSizingPageShow);
      }
    }
    boardPixelSizingObserver = null;
    boardPixelSizingObservedFrame = null;
    boardPixelSizingObservedElement = null;
    boardPixelSizingWindowHandlerInstalled = false;
    _boardPixelSizingPageStateHandlersInstalled = false;
    _boardPixelSizingSignature = null;
    _boardPixelSizingDirty = true;
  }

  return Object.freeze({
    syncBoardPixelSizing,
    syncBoardExpansionLayerGeometry,
    resolveBoardExpansionLayerElement,
    applyBoardCssVars: _applyBoardCssVarsForBoardRenderer,
    capPixiBoardViewport: _capPixiBoardViewportForBoardRenderer,
    readBoardCellSize: _readBoardCellSizeForLayout,
    readBoardFrameGeometry: _readBoardFrameGeometryForLayout,
    getRevision,
    invalidateHost,
    resetSession,
    destroyPageRuntime
  });
}
