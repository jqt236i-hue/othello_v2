import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, type Browser } from 'playwright';

type BackendKind = 'dom' | 'pixi';

function resolveMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.wasm') return 'application/wasm';
  if (ext === '.onnx') return 'application/octet-stream';
  return 'application/octet-stream';
}

function createStaticServer(rootDir: string): http.Server {
  return http.createServer((req, res) => {
    const rawUrl = String(req?.url || '/').split('?')[0] || '/';
    let decoded = '/index.html';
    try {
      decoded = decodeURIComponent(rawUrl === '/' ? '/index.html' : rawUrl);
    } catch (_error) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    const filePath = path.resolve(rootDir, `.${decoded}`);
    const normalizedRoot = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
    if (filePath !== rootDir && !filePath.startsWith(normalizedRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.setHeader('Content-Type', resolveMimeType(filePath));
      res.end(data);
    });
  });
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener('error', onError);
      reject(error);
    };
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve();
    });
  });
  const address = server.address() as any;
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: http.Server | null | undefined): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function findRepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'index.html'))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(startDir);
}

function evaluateWriterLaneEvidence(evidence: any): { ok: boolean; errors: string[] } {
  const backend = String(evidence?.backend || 'unknown');
  const errors: string[] = [];
  if (evidence?.observedBackend !== backend) {
    errors.push(`${backend}: requested backend resolved as ${evidence?.observedBackend || 'missing'}`);
  }
  const records = Array.isArray(evidence?.records) ? evidence.records : [];
  const byLabel = new Map(records.map((record: any) => [record.label, record]));
  const initial = byLabel.get('initial-settled') as any;
  const duringDirect = byLabel.get('during-direct-render') as any;
  const duringScheduled = byLabel.get('during-scheduler-render') as any;
  const final = byLabel.get('final-settled') as any;
  if (!initial?.cell?.hasStone) errors.push(`${backend}: initial settled stone is missing`);
  for (const record of [duringDirect, duringScheduled]) {
    if (!record?.cell?.hasStone) errors.push(`${backend}: active writer exposed the canonical final cell early`);
    if (record?.visualDigest !== initial?.visualDigest) {
      errors.push(`${backend}: active writer changed the settled visual digest before settlement`);
    }
    if (record?.writerMode !== 'playback') errors.push(`${backend}: active writer mode was not playback`);
  }
  if (final?.cell?.hasStone) errors.push(`${backend}: settled final frame retained the removed stone`);
  if (!initial?.visualDigest || final?.visualDigest === initial.visualDigest) {
    errors.push(`${backend}: final visual digest did not advance`);
  }
  if (final?.writerMode !== 'idle') errors.push(`${backend}: writer did not return to idle`);
  if (backend === 'pixi') {
    const diagnostics = final?.backendDiagnostics || {};
    const timeline = diagnostics.timeline || {};
    const playback = diagnostics.playback || {};
    const pool = diagnostics.pool || {};
    if (diagnostics.tickerRunning === true
      || timeline.tickerRunning === true
      || Number(timeline.activeRunCount || 0) !== 0) {
      errors.push('pixi: private ticker remained active after writer settlement');
    }
    if (Number(playback.inFlightEffectCount || 0) !== 0
      || Number(pool.activePlaybackGhostCount || 0) !== 0
      || Number(pool.activePlaybackHighlightLeaseCount || 0) !== 0) {
      errors.push('pixi: playback projection resources remained active after writer settlement');
    }
  }
  for (const error of evidence?.consoleErrors || []) errors.push(`${backend}: console error: ${error}`);
  for (const error of evidence?.pageErrors || []) errors.push(`${backend}: page error: ${error}`);
  return { ok: errors.length === 0, errors };
}

async function captureWriterLane(browser: Browser, appUrl: string, backend: BackendKind): Promise<any> {
  const page = await browser.newPage({ viewport: { width: 980, height: 760 } });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (typeof message.type === 'function' && message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error?.message ? String(error.message) : String(error));
  });
  try {
    await page.goto(`${appUrl}/?debug=1&boardRenderer=${backend}&noanim=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForFunction(() => {
      const root = window as any;
      return root.__uiInitialized === true
        && !!root.__boardVisualDebug
        && typeof root.__boardVisualDebug.getBackendDiagnostics === 'function'
        && typeof root.renderBoard === 'function'
        && typeof root.require === 'function';
    }, null, { timeout: 30000 });
    await page.evaluate(async () => (window as any).__boardVisualDebug.waitForIdle());

    const records = await page.evaluate(async (requestedBackend: BackendKind) => {
      const root = window as any;
      const debug = root.__boardVisualDebug;
      const boardRenderer = root.require('ui/board-renderer');
      const boardUtils = root.require('shared/shared-board-utils');
      const core = root.require('game/logic/core');
      if (!boardRenderer || typeof boardRenderer.claimBoardVisualWriter !== 'function'
        || typeof boardRenderer.settleBoardVisualWriter !== 'function') {
        throw new Error('board writer public API is unavailable');
      }
      if (!core || !boardUtils || typeof root.forceFullRender !== 'function') {
        throw new Error('board writer fixture runtime is unavailable');
      }
      const row = 2;
      const col = 2;
      const createState = (stone: number) => {
        const state = core.createGameState({ rows: 8, cols: 8, shape: 'rectangle' });
        state.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        state.board[row][col] = stone;
        state.boardExpansion = {
          active: false,
          side: null,
          row: null,
          owner: 0,
          usedByPlayer: { black: false, white: false },
          cells: []
        };
        boardUtils.attachBoardShape(state.board, {
          boardConfig: state.boardConfig,
          boardExpansion: state.boardExpansion,
          cardState: root.cardState
        });
        return state;
      };
      root.cardState = root.cardState && typeof root.cardState === 'object' ? root.cardState : {};
      root.cardState.markers = [];
      root.cardState.pendingEffectByPlayer = { black: null, white: null };
      root.cardState.presentationEvents = [];
      root.cardState._presentationEventsPersist = [];
      root.gameState = createState(-1);
      await Promise.resolve(root.forceFullRender(document.getElementById('board')));
      await debug.waitForIdle();

      const stoneSnapshot = () => {
        const cell = debug.getRenderedCell(row, col);
        const stone = cell?.stone || null;
        const pixiStone = stone && typeof stone.visible === 'boolean';
        return {
          hasCell: !!cell,
          hasStone: pixiStone ? stone.visible === true && !!stone.owner : !!stone,
          owner: stone?.owner || null,
          visualSignature: cell?.visualSignature || null
        };
      };
      const output: any[] = [];
      const record = (label: string) => output.push({
        label,
        cell: stoneSnapshot(),
        writerMode: debug.getWriterMode(),
        visualDigest: debug.getVisualFrameDigest(),
        backendDiagnostics: debug.getBackendDiagnostics()
      });

      record('initial-settled');
      const token = boardRenderer.claimBoardVisualWriter(`browser-writer-check:${requestedBackend}`, 'local');
      root.gameState = createState(0);
      root.renderBoard();
      record('during-direct-render');

      if (root.RenderScheduler?.requestBoardRender && root.RenderScheduler?.flushVisualUpdates) {
        root.RenderScheduler.requestBoardRender({
          source: 'playback-board-writer-browser-check',
          reason: 'active-writer-coalescing'
        });
        root.RenderScheduler.flushVisualUpdates({ ignorePlayback: true });
      } else {
        root.renderBoard();
      }
      record('during-scheduler-render');

      await boardRenderer.settleBoardVisualWriter(token);
      await debug.waitForIdle();
      record('final-settled');
      return {
        requestedBackend,
        observedBackend: debug.getBackendKind(),
        records: output
      };
    }, backend);
    return {
      backend,
      observedBackend: records.observedBackend,
      records: records.records,
      consoleErrors,
      pageErrors
    };
  } finally {
    await page.close();
  }
}

async function runPlaybackBoardWriterBrowserCheck(options?: {
  rootDir?: string;
  launch?: typeof chromium.launch;
  log?: boolean;
}): Promise<any> {
  const rootDir = findRepoRoot(options?.rootDir || __dirname);
  const server = createStaticServer(rootDir);
  let browser: Browser | null = null;
  try {
    const appUrl = await listen(server);
    const launch = options?.launch
      ? options.launch
      : (launchOptions: Parameters<typeof chromium.launch>[0]) => chromium.launch(launchOptions);
    browser = await launch({ channel: 'chrome', headless: true });
    const lanes: any[] = [];
    for (const backend of ['dom', 'pixi'] as const) lanes.push(await captureWriterLane(browser, appUrl, backend));
    const evaluations = lanes.map((lane) => ({
      backend: lane.backend,
      ...evaluateWriterLaneEvidence(lane)
    }));
    const result = {
      schemaVersion: 'playback_board_writer_browser_check.v2',
      appUrl,
      lanes,
      evaluations,
      ok: evaluations.every((evaluation) => evaluation.ok)
    };
    if (options?.log !== false) console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      throw new Error(evaluations.flatMap((evaluation) => evaluation.errors).join('; '));
    }
    return result;
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

if (require.main === module) {
  runPlaybackBoardWriterBrowserCheck().catch((error) => {
    console.error(`[playback-board-writer-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  evaluateWriterLaneEvidence,
  runPlaybackBoardWriterBrowserCheck
};
