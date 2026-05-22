import {
  encodeStoryBoardCode,
  safeDecodeStoryBoardCode,
  validateStoryInitialBoardSetup
} from '../core/story-board-codec';
import type { StoryInitialBoardCell, StoryInitialBoardSetup, StorySide } from '../core/story-schema';

type BoardEditorRoot = Record<string, any>;
type EditMode = 'cycle' | 'black' | 'white' | 'empty';
export type StoryBoardPreviewMode = 'cpu' | 'reversi' | 'othello';
type PreviewSharedBootstrap = {
  readUIImpl?: (root: Window, key: string) => Record<string, unknown>;
  writeUIImpl?: (root: Window, key: string, value: Record<string, unknown>) => void;
};
type PreviewTurnManagerModule = {
  getUIImpl?: () => Record<string, unknown>;
  replaceUIImpl?: (value: Record<string, unknown>) => void;
  setUIImpl?: (value: Record<string, unknown>) => void;
};
type StoryBoardPreviewInitOptions = {
  boardConfig: { rows: number; cols: number };
  initialBoardSetup: { currentPlayer: StorySide; board: number[][] };
  cardlessMode?: true;
  initialDeckCardIdsByPlayer?: { black: []; white: [] };
};

type BoardEditorState = {
  rows: 6 | 8;
  cols: 6 | 8;
  currentPlayer: StorySide;
  cells: StoryInitialBoardCell[][];
  editMode: EditMode;
  previewMode: StoryBoardPreviewMode;
};

type BoardEditorRefs = {
  status: HTMLElement;
  sizeSelect: HTMLSelectElement;
  currentPlayerSelect: HTMLSelectElement;
  summary: HTMLElement;
  grid: HTMLElement;
  codeOutput: HTMLTextAreaElement;
  stageSnippet: HTMLTextAreaElement;
  diagnostics: HTMLElement;
  previewModeSelect: HTMLSelectElement;
  previewCpuLevel: HTMLSelectElement;
  previewStartButton: HTMLButtonElement;
  previewStatus: HTMLElement;
  previewFrame: HTMLIFrameElement;
  brushButtons: Record<EditMode, HTMLButtonElement>;
  resetOpeningButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  loadCodeButton: HTMLButtonElement;
  copyCodeButton: HTMLButtonElement;
};

const STORAGE_KEY = 'story.boardEditor.state.v1';
const PREVIEW_INIT_STORAGE_KEY = 'story.boardEditor.previewInit.v1';

export function initStoryBoardEditor(doc: Document = document): void {
  const refs = readRefs(doc);
  const root = (doc.defaultView ?? globalThis) as BoardEditorRoot;
  const restored = loadStoredState(root);
  const state: BoardEditorState = restored ?? createDefaultBoardEditorState(8);
  let painting = false;
  let previewReadyPromise: Promise<Window> | null = null;

  bindToolbarEvents();
  bindPreviewEvents();
  renderAll();
  setStatus(restored ? '前回の初期盤面を復元しました。' : '初期盤面を作成できます。');

  function bindToolbarEvents(): void {
    refs.sizeSelect.addEventListener('change', () => {
      const nextSize = Number(refs.sizeSelect.value) === 6 ? 6 : 8;
      const nextState = createDefaultBoardEditorState(nextSize);
      state.rows = nextState.rows;
      state.cols = nextState.cols;
      state.cells = nextState.cells;
      state.currentPlayer = 'black';
      state.editMode = 'cycle';
      persistState(root, state);
      renderAll();
      setStatus(`${nextSize}x${nextSize} の標準配置へ切り替えました。`);
    });

    refs.currentPlayerSelect.addEventListener('change', () => {
      state.currentPlayer = refs.currentPlayerSelect.value === 'white' ? 'white' : 'black';
      persistState(root, state);
      renderOutputs();
      setStatus(`次の手番を${state.currentPlayer === 'black' ? '黒' : '白'}に変更しました。`);
    });

    refs.previewModeSelect.addEventListener('change', () => {
      state.previewMode = normalizePreviewMode(refs.previewModeSelect.value);
      persistState(root, state);
      setStatus(`プレビュー対戦モードを${state.previewMode === 'reversi' ? 'リバーシ' : '通常'}に変更しました。`);
    });

    Object.entries(refs.brushButtons).forEach(([mode, button]) => {
      button.addEventListener('click', () => {
        state.editMode = mode as EditMode;
        persistState(root, state);
        renderBrushButtons();
        setStatus(resolveEditModeMessage(state.editMode));
      });
    });

    refs.resetOpeningButton.addEventListener('click', () => {
      state.cells = createOpeningCells(state.rows, state.cols);
      state.currentPlayer = 'black';
      persistState(root, state);
      renderAll();
      setStatus('標準配置へ戻しました。');
    });

    refs.clearButton.addEventListener('click', () => {
      state.cells = createEmptyCells(state.rows, state.cols);
      persistState(root, state);
      renderAll();
      setStatus('盤面を全消去しました。');
    });

    refs.loadCodeButton.addEventListener('click', () => {
      const result = safeDecodeStoryBoardCode(refs.codeOutput.value);
      const firstError = result.issues.find((issue) => issue.severity === 'error');
      if (!result.ok || !result.setup || firstError) {
        setStatus(firstError ? `読込失敗: ${firstError.message}` : '盤面コードを読み込めませんでした。', true);
        renderDiagnostics(result.issues);
        return;
      }
      state.rows = result.setup.rows;
      state.cols = result.setup.cols;
      state.cells = cloneCells(result.setup.cells);
      state.currentPlayer = result.setup.currentPlayer;
      state.editMode = 'cycle';
      persistState(root, state);
      renderAll();
      setStatus('盤面コードから復元しました。');
    });

    refs.copyCodeButton.addEventListener('click', async () => {
      const code = refs.codeOutput.value.trim();
      if (!code) {
        setStatus('コピーできる盤面コードがありません。', true);
        return;
      }
      try {
        await doc.defaultView?.navigator.clipboard.writeText(code);
        setStatus('盤面コードをコピーしました。');
      } catch (error) {
        setStatus('盤面コードのコピーに失敗しました。', true);
      }
    });
  }

  function bindPreviewEvents(): void {
    refs.previewStartButton.addEventListener('click', async () => {
      const setup = buildSetup(state);
      const issues = validateStoryInitialBoardSetup(setup);
      renderDiagnostics(issues);
      const firstError = issues.find((issue) => issue.severity === 'error');
      if (firstError) {
        setStatus(`CPUプレビューを開始できません: ${firstError.message}`, true);
        return;
      }

      refs.previewStatus.textContent = '既存ゲームを読み込み中...';
      refs.previewStartButton.disabled = true;
      try {
        const previewSetup = buildPlayerStartPreviewSetup(setup);
        writePreviewInitPayload(root, previewSetup, state.previewMode, Number(refs.previewCpuLevel.value) || 3);
        previewReadyPromise = null;
        refs.previewFrame.src = buildPreviewUrl(state.previewMode);
        const previewWindow = await ensurePreviewWindow();
        await preparePreviewWindow(previewWindow, {
          previewMode: state.previewMode,
          whiteCpuLevel: Number(refs.previewCpuLevel.value) || 3,
          initOptions: previewSetup
        });
        await stabilizePreviewBattle(previewWindow, previewSetup, state.previewMode);
        refs.previewStatus.textContent = 'CPUプレビューを開始しました。';
        setStatus('CPUプレビューを開始しました。');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        refs.previewStatus.textContent = `CPUプレビュー開始失敗: ${message}`;
        setStatus(`CPUプレビュー開始失敗: ${message}`, true);
      } finally {
        refs.previewStartButton.disabled = false;
      }
    });

    doc.defaultView?.addEventListener('pointerup', () => {
      painting = false;
    });
  }

  function renderAll(): void {
    refs.sizeSelect.value = String(state.rows);
    refs.currentPlayerSelect.value = state.currentPlayer;
    refs.previewModeSelect.value = state.previewMode;
    renderBrushButtons();
    renderBoard();
    renderOutputs();
  }

  function renderBrushButtons(): void {
    Object.entries(refs.brushButtons).forEach(([mode, button]) => {
      button.classList.toggle('is-active', state.editMode === mode);
    });
  }

  function renderBoard(): void {
    refs.grid.textContent = '';
    refs.grid.style.gridTemplateColumns = `repeat(${state.cols}, 72px)`;
    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'story-board-editor-cell';
        const cell = state.cells[row][col];
        if (cell === 'black') button.classList.add('is-black');
        if (cell === 'white') button.classList.add('is-white');
        button.setAttribute('aria-label', `${row + 1}行 ${col + 1}列`);
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          painting = true;
          applyCellEdit(row, col);
        });
        button.addEventListener('pointerenter', () => {
          if (!painting || state.editMode === 'cycle') return;
          applyCellEdit(row, col);
        });
        refs.grid.appendChild(button);
      }
    }
  }

  function applyCellEdit(row: number, col: number): void {
    const current = state.cells[row][col];
    state.cells[row][col] = nextCellValue(current, state.editMode);
    persistState(root, state);
    renderBoard();
    renderOutputs();
  }

  function renderOutputs(): void {
    const setup = buildSetup(state);
    const issues = validateStoryInitialBoardSetup(setup);
    renderDiagnostics(issues);
    const firstError = issues.find((issue) => issue.severity === 'error');
    const blackCount = countCells(state.cells, 'black');
    const whiteCount = countCells(state.cells, 'white');
    const emptyCount = countCells(state.cells, null);
    refs.summary.textContent = `黒 ${blackCount} / 白 ${whiteCount} / 空 ${emptyCount}\n次の手番: ${state.currentPlayer === 'black' ? '黒' : '白'}`;
    if (firstError) {
      refs.codeOutput.value = '';
      refs.stageSnippet.value = '';
      return;
    }
    const boardCode = encodeStoryBoardCode(setup);
    refs.codeOutput.value = boardCode;
    refs.stageSnippet.value = `initialBoardCode: '${boardCode}'`;
  }

  function renderDiagnostics(issues: Array<{ severity: 'error' | 'warning'; message: string }>): void {
    refs.diagnostics.textContent = '';
    if (issues.length === 0) {
      const ok = document.createElement('div');
      ok.className = 'story-board-editor-diagnostic is-ok';
      ok.textContent = 'この盤面は盤面コードとして使えます。';
      refs.diagnostics.appendChild(ok);
      return;
    }
    issues.forEach((issue) => {
      const line = document.createElement('div');
      line.className = `story-board-editor-diagnostic ${issue.severity === 'error' ? 'is-error' : 'is-warning'}`;
      line.textContent = issue.message;
      refs.diagnostics.appendChild(line);
    });
  }

  async function ensurePreviewWindow(): Promise<Window> {
    if (!previewReadyPromise) {
      previewReadyPromise = new Promise<Window>((resolve, reject) => {
        waitForPreviewWindow(resolve, reject);
      });
    }
    return previewReadyPromise;
  }

  function waitForPreviewWindow(resolve: (windowRef: Window) => void, reject: (error: Error) => void): void {
    const deadline = Date.now() + 30000;
    const attempt = () => {
      const previewWindow = refs.previewFrame.contentWindow;
      if (!previewWindow) {
        if (Date.now() > deadline) {
          reject(new Error('preview iframe is not available.'));
          return;
        }
        scheduleAttempt(attempt);
        return;
      }
      try {
        if (
          typeof previewWindow.resetGame === 'function'
          && (previewWindow as unknown as BoardEditorRoot).gameState
          && (previewWindow as unknown as BoardEditorRoot).cardState
          && previewWindow.document
          && previewWindow.document.readyState === 'complete'
          && previewWindow.document.getElementById('board')
        ) {
          resolve(previewWindow);
          return;
        }
      } catch (error) {
        // keep polling until timeout
      }
      if (Date.now() > deadline) {
        reject(new Error('preview iframe did not finish booting.'));
        return;
      }
      scheduleAttempt(attempt);
    };
    attempt();
  }

  async function preparePreviewWindow(
    previewWindow: Window,
    options: { previewMode: StoryBoardPreviewMode; whiteCpuLevel: number; initOptions: StoryInitialBoardSetup }
  ): Promise<void> {
    await waitForPreviewResetOverride(previewWindow);
    await applyPreviewMatchMode(previewWindow, options.previewMode);
    const previewDoc = previewWindow.document;
    const whiteLevelSelect = previewDoc.getElementById('smartWhite') as HTMLSelectElement | null;
    if (whiteLevelSelect) {
      whiteLevelSelect.value = String(clampCpuLevel(options.whiteCpuLevel));
      whiteLevelSelect.dispatchEvent(new previewWindow.Event('change', { bubbles: true }));
    }
    const blackLevelSelect = previewDoc.getElementById('smartBlack') as HTMLSelectElement | null;
    if (blackLevelSelect) {
      blackLevelSelect.value = '1';
      blackLevelSelect.dispatchEvent(new previewWindow.Event('change', { bubbles: true }));
    }
    resetPreviewBattleWithInitOptions(
      previewWindow,
      buildStoryBoardPreviewInitOptions(options.initOptions, options.previewMode)
    );
  }

}

function readRefs(doc: Document): BoardEditorRefs {
  return {
    status: requireElement(doc, 'storyBoardEditorStatus'),
    sizeSelect: requireElement(doc, 'storyBoardSizeSelect') as HTMLSelectElement,
    currentPlayerSelect: requireElement(doc, 'storyBoardCurrentPlayerSelect') as HTMLSelectElement,
    summary: requireElement(doc, 'storyBoardSummary'),
    grid: requireElement(doc, 'storyBoardGrid'),
    codeOutput: requireElement(doc, 'storyBoardCodeOutput') as HTMLTextAreaElement,
    stageSnippet: requireElement(doc, 'storyBoardStageSnippet') as HTMLTextAreaElement,
    diagnostics: requireElement(doc, 'storyBoardDiagnostics'),
    previewModeSelect: requireElement(doc, 'storyBoardPreviewModeSelect') as HTMLSelectElement,
    previewCpuLevel: requireElement(doc, 'storyBoardPreviewCpuLevel') as HTMLSelectElement,
    previewStartButton: requireElement(doc, 'storyBoardPreviewStartBtn') as HTMLButtonElement,
    previewStatus: requireElement(doc, 'storyBoardPreviewStatus'),
    previewFrame: requireElement(doc, 'storyBoardPreviewFrame') as HTMLIFrameElement,
    brushButtons: {
      cycle: requireElement(doc, 'storyBoardBrushCycleBtn') as HTMLButtonElement,
      black: requireElement(doc, 'storyBoardBrushBlackBtn') as HTMLButtonElement,
      white: requireElement(doc, 'storyBoardBrushWhiteBtn') as HTMLButtonElement,
      empty: requireElement(doc, 'storyBoardBrushEmptyBtn') as HTMLButtonElement
    },
    resetOpeningButton: requireElement(doc, 'storyBoardResetOpeningBtn') as HTMLButtonElement,
    clearButton: requireElement(doc, 'storyBoardClearBtn') as HTMLButtonElement,
    loadCodeButton: requireElement(doc, 'storyBoardLoadCodeBtn') as HTMLButtonElement,
    copyCodeButton: requireElement(doc, 'storyBoardCopyCodeBtn') as HTMLButtonElement
  };
}

function requireElement(doc: Document, id: string): HTMLElement {
  const element = doc.getElementById(id);
  if (!element) {
    throw new Error(`story board editor element not found: ${id}`);
  }
  return element;
}

function createDefaultBoardEditorState(size: 6 | 8): BoardEditorState {
  return {
    rows: size,
    cols: size,
    currentPlayer: 'black',
    cells: createOpeningCells(size, size),
    editMode: 'cycle',
    previewMode: 'cpu'
  };
}

export function buildStoryBoardPreviewInitOptions(
  setup: StoryInitialBoardSetup,
  previewMode: StoryBoardPreviewMode
): StoryBoardPreviewInitOptions {
  const baseOptions = {
    boardConfig: {
      rows: setup.rows,
      cols: setup.cols
    },
    initialBoardSetup: {
      currentPlayer: setup.currentPlayer,
      board: setup.cells.map((line) => line.map((cell) => {
        if (cell === 'black') return 1;
        if (cell === 'white') return -1;
        return 0;
      }))
    }
  };
  if (previewMode === 'reversi') {
    return {
      ...baseOptions,
      cardlessMode: true,
      initialDeckCardIdsByPlayer: { black: [], white: [] }
    };
  }
  return baseOptions;
}

function writePreviewInitPayload(
  root: BoardEditorRoot,
  setup: StoryInitialBoardSetup,
  previewMode: StoryBoardPreviewMode,
  whiteCpuLevel: number
): void {
  const initOptions = buildStoryBoardPreviewInitOptions(setup, previewMode);
  const payload = {
    initOptions,
    previewMode: normalizePreviewMode(previewMode),
    whiteCpuLevel: clampCpuLevel(whiteCpuLevel)
  };
  root.sessionStorage?.setItem(PREVIEW_INIT_STORAGE_KEY, JSON.stringify(payload));
}

function buildPreviewUrl(previewMode: StoryBoardPreviewMode): string {
  const query = new URLSearchParams({
    storyBoardPreview: '1',
    storyBoardPreviewMode: normalizePreviewMode(previewMode),
    t: String(Date.now())
  });
  return `../../index.html?${query.toString()}`;
}

function createEmptyCells(rows: 6 | 8, cols: 6 | 8): StoryInitialBoardCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

function createOpeningCells(rows: 6 | 8, cols: 6 | 8): StoryInitialBoardCell[][] {
  const cells = createEmptyCells(rows, cols);
  const anchorRow = Math.floor((rows - 2) / 2);
  const anchorCol = Math.floor((cols - 2) / 2);
  cells[anchorRow][anchorCol] = 'white';
  cells[anchorRow][anchorCol + 1] = 'black';
  cells[anchorRow + 1][anchorCol] = 'black';
  cells[anchorRow + 1][anchorCol + 1] = 'white';
  return cells;
}

function cloneCells(cells: StoryInitialBoardCell[][]): StoryInitialBoardCell[][] {
  return cells.map((line) => line.slice());
}

function buildSetup(state: BoardEditorState): StoryInitialBoardSetup {
  return {
    rows: state.rows,
    cols: state.cols,
    cells: cloneCells(state.cells),
    currentPlayer: state.currentPlayer
  };
}

function buildPlayerStartPreviewSetup(setup: StoryInitialBoardSetup): StoryInitialBoardSetup {
  return {
    ...setup,
    currentPlayer: 'black',
    cells: cloneCells(setup.cells)
  };
}

function nextCellValue(current: StoryInitialBoardCell, mode: EditMode): StoryInitialBoardCell {
  if (mode === 'black') return 'black';
  if (mode === 'white') return 'white';
  if (mode === 'empty') return null;
  if (current === null) return 'black';
  if (current === 'black') return 'white';
  return null;
}

function countCells(cells: StoryInitialBoardCell[][], target: StoryInitialBoardCell): number {
  let count = 0;
  cells.forEach((line) => {
    line.forEach((cell) => {
      if (cell === target) count += 1;
    });
  });
  return count;
}

function normalizePreviewMode(value: unknown): StoryBoardPreviewMode {
  return value === 'reversi' || value === 'othello' ? 'reversi' : 'cpu';
}

function clampCpuLevel(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(6, Math.floor(value)));
}

function resolveEditModeMessage(mode: EditMode): string {
  if (mode === 'cycle') return 'クリックごとに 空 → 黒 → 白 → 空 で切り替えます。';
  if (mode === 'black') return '黒を連続で置けます。';
  if (mode === 'white') return '白を連続で置けます。';
  return '空マスに戻せます。';
}

function setStatus(message: string, isError = false): void {
  const status = document.getElementById('storyBoardEditorStatus');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? 'var(--story-board-editor-error)' : 'var(--story-board-editor-subtle)';
}

function persistState(root: BoardEditorRoot, state: BoardEditorState): void {
  try {
    root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // ignore storage failures
  }
}

function loadStoredState(root: BoardEditorRoot): BoardEditorState | null {
  try {
    const raw = root.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object') return null;
    const size = Number(parsed.rows) === 6 ? 6 : 8;
    const currentPlayer = parsed.currentPlayer === 'white' ? 'white' : 'black';
    const cells = Array.isArray(parsed.cells) ? parsed.cells : null;
    if (!cells) return null;
    const normalized: BoardEditorState = {
      rows: size,
      cols: size,
      currentPlayer,
      previewMode: normalizePreviewMode(parsed.previewMode),
      editMode: parsed.editMode === 'black' || parsed.editMode === 'white' || parsed.editMode === 'empty' || parsed.editMode === 'cycle'
        ? parsed.editMode
        : 'cycle',
      cells: cells.map((line: unknown) => {
        const source = Array.isArray(line) ? line : [];
        return source.slice(0, size).map((cell) => {
          if (cell === 'black' || cell === 'white') return cell;
          return null;
        }).concat(Array.from({ length: Math.max(0, size - source.length) }, () => null));
      }).slice(0, size)
    };
    while (normalized.cells.length < size) {
      normalized.cells.push(Array.from({ length: size }, () => null));
    }
    return normalized;
  } catch (error) {
    return null;
  }
}

function scheduleAttempt(callback: () => void): void {
  window.setTimeout(callback, 250);
}

function resolvePreviewTurnManager(previewWindow: Window): PreviewTurnManagerModule | null {
  try {
    const requireFn = (previewWindow as unknown as BoardEditorRoot).require;
    if (typeof requireFn !== 'function') return null;
    const turnManager = requireFn('game/turn-manager');
    return turnManager && typeof turnManager === 'object'
      ? turnManager as PreviewTurnManagerModule
      : null;
  } catch (error) {
    return null;
  }
}

async function waitForPreviewResetOverride(previewWindow: Window): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() <= deadline) {
    const previewRoot = previewWindow as unknown as BoardEditorRoot;
    const previewDoc = previewWindow.document;
    const gameReady = !!(
      previewDoc
      && previewDoc.readyState === 'complete'
      && previewDoc.getElementById('board')
      && previewRoot.gameState
      && previewRoot.cardState
      && typeof previewRoot.resetGame === 'function'
    );
    const turnManager = resolvePreviewTurnManager(previewWindow);
    if (
      gameReady
      && typeof previewRoot.processCpuTurn === 'function'
      && turnManager
      && typeof turnManager.getUIImpl === 'function'
      && (typeof turnManager.replaceUIImpl === 'function' || typeof turnManager.setUIImpl === 'function')
    ) {
      return;
    }

    const shared = (previewWindow as unknown as BoardEditorRoot).SharedUIBootstrap;
    if (
      gameReady
      && typeof previewRoot.processCpuTurn === 'function'
      && shared
      && typeof shared === 'object'
      && typeof (shared as PreviewSharedBootstrap).readUIImpl === 'function'
      && typeof (shared as PreviewSharedBootstrap).writeUIImpl === 'function'
    ) {
      return;
    }

    await delayPreviewResetOverride(previewWindow, 100);
  }
  throw new Error('preview game reset hook is not ready.');
}

function delayPreviewResetOverride(previewWindow: Window, ms: number): Promise<void> {
  return new Promise((resolve) => {
    previewWindow.setTimeout(resolve, ms);
  });
}

function resetPreviewBattleWithInitOptions(
  previewWindow: Window,
  initOptions: StoryBoardPreviewInitOptions
): void {
  const previewRoot = previewWindow as unknown as BoardEditorRoot;
  const resetGame = previewRoot.resetGame;
  if (typeof resetGame !== 'function') {
    throw new Error('preview resetGame is not available.');
  }

  const turnManager = resolvePreviewTurnManager(previewWindow);
  const shared = previewRoot.SharedUIBootstrap as PreviewSharedBootstrap | undefined;
  const previous = readPreviewTurnManagerImpl(previewRoot, turnManager, shared);
  const next = {
    ...previous,
    buildCardInitOptions: () => initOptions,
    readBoardConfig: () => initOptions.boardConfig
  };

  writePreviewTurnManagerImpl(previewRoot, turnManager, shared, next);
  try {
    resetGame.call(previewWindow, { skipNetworkPublish: true, source: 'story_board_preview' });
    previewRoot.__storyBoardPreviewInitialSetupApplied = true;
  } finally {
    writePreviewTurnManagerImpl(previewRoot, turnManager, shared, previous);
  }
}

function readPreviewTurnManagerImpl(
  previewRoot: BoardEditorRoot,
  turnManager: PreviewTurnManagerModule | null,
  shared?: PreviewSharedBootstrap
): Record<string, unknown> {
  if (turnManager && typeof turnManager.getUIImpl === 'function') {
    return turnManager.getUIImpl();
  }
  if (shared && typeof shared.readUIImpl === 'function') {
    return shared.readUIImpl(previewRoot as unknown as Window, 'turn_manager') ?? {};
  }
  const candidate = previewRoot.__uiImpl_turn_manager;
  return candidate && typeof candidate === 'object' ? { ...candidate } : {};
}

function writePreviewTurnManagerImpl(
  previewRoot: BoardEditorRoot,
  turnManager: PreviewTurnManagerModule | null,
  shared: PreviewSharedBootstrap | undefined,
  value: Record<string, unknown>
): void {
  if (turnManager && typeof turnManager.replaceUIImpl === 'function') {
    turnManager.replaceUIImpl(value);
    return;
  }
  if (turnManager && typeof turnManager.setUIImpl === 'function') {
    turnManager.setUIImpl(value);
    return;
  }
  if (shared && typeof shared.writeUIImpl === 'function') {
    shared.writeUIImpl(previewRoot as unknown as Window, 'turn_manager', value);
    return;
  }
  previewRoot.__uiImpl_turn_manager = { ...value };
}

async function stabilizePreviewBattle(
  previewWindow: Window,
  setup: StoryInitialBoardSetup,
  previewMode: StoryBoardPreviewMode
): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() <= deadline) {
    const previewRoot = previewWindow as unknown as BoardEditorRoot;
    if (previewRoot.__storyBoardPreviewInitialSetupApplied === true) return;
    if (isPreviewBattleApplied(previewWindow, setup, previewMode)) {
      return;
    } else {
      applyPreviewMatchModeGlobals(previewWindow, previewMode);
    }
    await delayPreviewResetOverride(previewWindow, 200);
  }
  if (!isPreviewBattleApplied(previewWindow, setup, previewMode)) {
    throw new Error('preview battle setup was overwritten by the game bootstrap.');
  }
}

function isPreviewBattleApplied(
  previewWindow: Window,
  setup: StoryInitialBoardSetup,
  previewMode: StoryBoardPreviewMode
): boolean {
  const previewRoot = previewWindow as unknown as BoardEditorRoot;
  const gameState = previewRoot.gameState;
  const cardState = previewRoot.cardState;
  const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
  if (!board || board.length !== setup.rows) return false;
  const normalizedMode = normalizePreviewMode(previewMode);
  const currentMode = typeof previewRoot.getCurrentMatchMode === 'function'
    ? previewRoot.getCurrentMatchMode()
    : (previewRoot.MATCH_MODE || previewRoot.__MATCH_MODE);
  if (currentMode !== normalizedMode) return false;
  if (normalizedMode === 'reversi' && cardState?.cardlessMode !== true) return false;
  if (normalizedMode === 'cpu' && cardState?.cardlessMode === true) return false;
  const expectedPlayer = setup.currentPlayer === 'white' ? -1 : 1;
  if (gameState.currentPlayer !== expectedPlayer) return false;
  for (let row = 0; row < setup.rows; row += 1) {
    if (!Array.isArray(board[row]) || board[row].length !== setup.cols) return false;
    for (let col = 0; col < setup.cols; col += 1) {
      const expected = setup.cells[row][col] === 'black'
        ? 1
        : (setup.cells[row][col] === 'white' ? -1 : 0);
      if (board[row][col] !== expected) return false;
    }
  }
  return true;
}

async function applyPreviewMatchMode(
  previewWindow: Window,
  previewMode: StoryBoardPreviewMode
): Promise<void> {
  const normalizedMode = normalizePreviewMode(previewMode);
  applyPreviewMatchModeGlobals(previewWindow, normalizedMode);
}

function applyPreviewMatchModeGlobals(previewWindow: Window, previewMode: StoryBoardPreviewMode): void {
  const normalizedMode = normalizePreviewMode(previewMode);
  const previewRoot = previewWindow as unknown as BoardEditorRoot;
  const previewDoc = previewWindow.document;
  const reversiActive = normalizedMode === 'reversi';
  try {
    previewRoot.MATCH_MODE = normalizedMode;
    previewRoot.__MATCH_MODE = normalizedMode;
    previewRoot.getCurrentMatchMode = () => normalizedMode;
    previewRoot.isReversiModeActive = () => reversiActive;
    previewRoot.isOthelloModeActive = () => reversiActive;
    previewRoot.REVERSI_MODE_ACTIVE = reversiActive;
    previewRoot.__REVERSI_MODE_ACTIVE = reversiActive;
    previewRoot.OTHELLO_MODE_ACTIVE = reversiActive;
    previewRoot.__OTHELLO_MODE_ACTIVE = reversiActive;
  } catch (error) {
    try {
      previewWindow.console.warn('[story-board-editor] preview mode global update failed:', error);
    } catch (consoleError) {
      // Console may be unavailable while the iframe is unloading.
    }
  }

  try {
    previewDoc.body?.classList.toggle('reversi-mode-active', reversiActive);
    previewDoc.body?.classList.toggle('othello-mode-active', reversiActive);
    const hiddenElementIds = [
      'deck-white',
    'deck-black',
    'hand-white',
    'hand-black',
    'effect-live-panel',
      'deckBuilderOpenBtn',
      'gachaOpenBtn',
      'charge-black',
      'charge-white',
      'charge-delta-black-increase',
      'charge-delta-black-decrease',
      'charge-delta-white-increase',
      'charge-delta-white-decrease'
    ];
    hiddenElementIds.forEach((id) => {
      const element = previewDoc.getElementById(id);
      if (!element) return;
      element.hidden = reversiActive;
      element.setAttribute('aria-hidden', reversiActive ? 'true' : 'false');
    });
    const cpuButton = previewDoc.getElementById('modeCpuBtn') as HTMLButtonElement | null;
    const reversiButton = (previewDoc.getElementById('modeReversiBtn') || previewDoc.getElementById('modeOthelloBtn')) as HTMLButtonElement | null;
    if (cpuButton) cpuButton.style.outline = normalizedMode === 'cpu' ? '2px solid #90ee90' : '';
    if (reversiButton) reversiButton.style.outline = reversiActive ? '2px solid #90ee90' : '';
  } catch (error) {
    try {
      previewWindow.console.warn('[story-board-editor] preview mode UI update failed:', error);
    } catch (consoleError) {
      // Console may be unavailable while the iframe is unloading.
    }
  }
}
