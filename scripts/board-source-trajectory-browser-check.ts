import BrowserUiControlSmoke = require('./browser-ui-control-smoke');

export type BoardSourceTrajectoryBrowserBackend = 'dom' | 'pixi';

export interface BoundsRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface BoardSourceTrajectoryBrowserSample {
  readonly profileKey: string;
  readonly fixture: string;
  readonly viewport: string;
  readonly dpr: number;
  readonly direction: string;
  readonly logicalSource: Readonly<{ row: number; col: number }>;
  readonly logicalTarget: Readonly<{ row: number; col: number }>;
  readonly boardViewport: BoundsRect;
  readonly paintedHaloOwner: BoundsRect;
  readonly paintedBoundsUnion: BoundsRect | null;
  readonly expectedClippedPaintedBounds: BoundsRect | null;
  readonly legacyOverflow: boolean;
  readonly frameCount: number;
  readonly elapsedMs: number;
  readonly maxOverlayNodeCount: number;
  readonly maxZIndex: number;
  readonly remainingOverlayNodeCount: number;
  readonly error: string | null;
}

export interface BoardSourceTrajectoryBrowserReport {
  readonly backend: BoardSourceTrajectoryBrowserBackend;
  readonly baseline: boolean;
  readonly captures: readonly Readonly<{
    viewport: string;
    dpr: number;
    smokeOk: boolean;
    smokeErrors: readonly string[];
    samples: readonly BoardSourceTrajectoryBrowserSample[];
  }>[];
}

export interface BoardSourceTrajectoryBrowserEvaluation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export const BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS = Object.freeze([
  'sniperShot',
  'robotVacuumSuck',
  'destroyDragonBreath',
  'meteorGodBlackBeam',
  'lightningDestroyed',
  'udgDestroyed',
  'zombieBite'
] as const);

export const BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS = Object.freeze([
  Object.freeze({ name: 'desktop-dpr1', width: 1366, height: 900, dpr: 1 }),
  Object.freeze({ name: 'mobile-dpr2', width: 430, height: 932, dpr: 2 })
]);

function finite(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function rectWithin(inner: BoundsRect | null, outer: BoundsRect, epsilon = 1): boolean {
  if (!inner) return true;
  return inner.left >= outer.left - epsilon
    && inner.top >= outer.top - epsilon
    && inner.right <= outer.right + epsilon
    && inner.bottom <= outer.bottom + epsilon;
}

export function evaluateBoardSourceTrajectoryBrowserReport(
  report: BoardSourceTrajectoryBrowserReport
): BoardSourceTrajectoryBrowserEvaluation {
  const errors: string[] = [];
  if (!report || !Array.isArray(report.captures) || !report.captures.length) {
    return Object.freeze({ ok: false, errors: Object.freeze(['browser captures are missing']) });
  }
  for (const capture of report.captures) {
    const prefix = `${capture.viewport}/dpr${capture.dpr}`;
    if (!capture.smokeOk) {
      errors.push(`${prefix}: startup smoke failed: ${capture.smokeErrors.join('; ')}`);
    }
    for (const profileKey of BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS) {
      for (const fixture of ['normal', 'scrolled-expanded']) {
        const sample = capture.samples.find((candidate: BoardSourceTrajectoryBrowserSample) => (
          candidate.profileKey === profileKey && candidate.fixture === fixture
        ));
        if (!sample) {
          errors.push(`${prefix}/${fixture}: ${profileKey} sample is missing`);
          continue;
        }
        if (sample.error) errors.push(`${prefix}/${fixture}/${profileKey}: ${sample.error}`);
        if (!sample.paintedBoundsUnion) {
          errors.push(`${prefix}/${fixture}/${profileKey}: no painted bounds were observed`);
        }
        if (sample.frameCount < 1) {
          errors.push(`${prefix}/${fixture}/${profileKey}: no animation frame was sampled`);
        }
        if (sample.remainingOverlayNodeCount !== 0) {
          errors.push(`${prefix}/${fixture}/${profileKey}: transient overlay leaked`);
        }
        if (!rectWithin(sample.expectedClippedPaintedBounds, sample.paintedHaloOwner)) {
          errors.push(`${prefix}/${fixture}/${profileKey}: expected clipped paint exceeds two-cell halo owner`);
        }
      }
    }
  }
  if (report.baseline && report.backend === 'dom') {
    const longRange = report.captures.flatMap((capture) => capture.samples).filter((sample) => (
      sample.fixture === 'long-range-offscreen-sniper'
    ));
    if (!longRange.length || longRange.some((sample) => sample.legacyOverflow !== true)) {
      errors.push('long-range DOM sniper legacy overflow was not reproduced in every supported viewport');
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function backendFromArgs(argv: readonly string[]): BoardSourceTrajectoryBrowserBackend {
  const argument = argv.find((value) => value.startsWith('--backend='));
  const backend = String(argument ? argument.slice('--backend='.length) : 'dom').trim().toLowerCase();
  if (backend !== 'dom' && backend !== 'pixi') {
    throw new Error(`unsupported board source trajectory backend: ${backend}`);
  }
  return backend;
}

async function captureViewport(
  rootDir: string,
  backend: BoardSourceTrajectoryBrowserBackend,
  viewport: typeof BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS[number]
): Promise<BoardSourceTrajectoryBrowserReport['captures'][number]> {
  if (backend !== 'dom') {
    throw new Error('Pixi source trajectory browser capture is installed during the backend cutover phase');
  }
  const smoke = await BrowserUiControlSmoke.runBrowserUiControlSmoke({
    rootDir,
    entryPath: '/?boardRenderer=pixi',
    readyOnly: true,
    log: false,
    pageOptions: {
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr
    },
    afterReady: async (page: any) => page.evaluate(async (input: any) => {
      const root = window as any;
      const presenter = typeof root.require === 'function'
        ? root.require('ui/presentation/global-board-effect-presenter')
        : root.GlobalBoardEffectPresenter;
      if (!presenter) throw new Error('global board effect presenter is unavailable');
      const boardViewportElement = document.getElementById('board-scroll-viewport')
        || document.getElementById('board');
      if (!boardViewportElement) throw new Error('board viewport is unavailable');

      const serializeRect = (raw: any) => ({
        left: Number(raw.left),
        top: Number(raw.top),
        right: Number(raw.right),
        bottom: Number(raw.bottom),
        width: Number(raw.width),
        height: Number(raw.height)
      });
      const intersect = (first: any, second: any) => {
        if (!first) return null;
        const left = Math.max(first.left, second.left);
        const top = Math.max(first.top, second.top);
        const right = Math.min(first.right, second.right);
        const bottom = Math.min(first.bottom, second.bottom);
        if (right <= left || bottom <= top) return null;
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      };
      const union = (first: any, second: any) => {
        if (!first) return second;
        if (!second) return first;
        const left = Math.min(first.left, second.left);
        const top = Math.min(first.top, second.top);
        const right = Math.max(first.right, second.right);
        const bottom = Math.max(first.bottom, second.bottom);
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      };
      const overflow = (paint: any, owner: any) => !!paint && (
        paint.left < owner.left - 1
        || paint.top < owner.top - 1
        || paint.right > owner.right + 1
        || paint.bottom > owner.bottom + 1
      );
      const effectElements = () => Array.from(document.querySelectorAll(
        '.transient-overlay-batch *, .zombie-bite-global-overlay, .zombie-bite-global-overlay *'
      )) as HTMLElement[];
      const conservativePaintRect = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.001) return null;
        // Full-screen overlay/svg roots are layout owners, not painted pixels.
        // Their leaf paths/shapes carry the actual visible bounds.
        if (element.children.length) return null;
        const raw = element.getBoundingClientRect();
        if (!(raw.width > 0 && raw.height > 0)) return null;
        const pxValues = `${style.boxShadow || ''} ${style.filter || ''}`
          .match(/-?\d+(?:\.\d+)?px/g)
          ?.map((value) => Math.abs(Number.parseFloat(value))) || [];
        const halo = Math.min(96, pxValues.length ? Math.max(...pxValues) : 0);
        return {
          left: raw.left - halo,
          top: raw.top - halo,
          right: raw.right + halo,
          bottom: raw.bottom + halo,
          width: raw.width + halo * 2,
          height: raw.height + halo * 2
        };
      };
      const definitions = [
        { profileKey: 'sniperShot', eventType: 'destroy', cause: 'SNIPER_WILL', reason: 'sniper_shot', direction: 'source-to-target' },
        { profileKey: 'robotVacuumSuck', eventType: 'destroy', cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck', direction: 'target-to-source' },
        { profileKey: 'destroyDragonBreath', eventType: 'destroy', cause: 'DESTROY_DRAGON_WILL', reason: 'destroy_dragon_breath', direction: 'source-to-target' },
        { profileKey: 'meteorGodBlackBeam', eventType: 'destroy', cause: 'METEOR_GOD', reason: 'meteor_god_cell_destroy', direction: 'source-to-target' },
        { profileKey: 'lightningDestroyed', eventType: 'destroy', cause: 'LIGHTNING_WILL', reason: 'lightning_destroyed', direction: 'source-to-target' },
        { profileKey: 'udgDestroyed', eventType: 'destroy', cause: 'ULTIMATE_DESTROY_GOD', reason: 'udg_destroyed', direction: 'source-to-target' },
        { profileKey: 'zombieBite', eventType: 'flip', cause: 'ZOMBIE', reason: 'zombie_infection', direction: 'source-to-target' }
      ];
      const fixtures = [
        { name: 'normal', originRow: 0, originCol: 0, source: { row: 2, col: 2 }, target: { row: 5, col: 5 } },
        { name: 'scrolled-expanded', originRow: 4, originCol: 4, source: { row: 5, col: 5 }, target: { row: 8, col: 8 } }
      ];
      const boardRaw = boardViewportElement.getBoundingClientRect();
      const boardViewport = serializeRect(boardRaw);
      const cellSize = Math.max(1, Math.min(boardViewport.width, boardViewport.height) / 8);
      const paintedHaloOwner = {
        left: boardViewport.left - cellSize * 2,
        top: boardViewport.top - cellSize * 2,
        right: boardViewport.right + cellSize * 2,
        bottom: boardViewport.bottom + cellSize * 2,
        width: boardViewport.width + cellSize * 4,
        height: boardViewport.height + cellSize * 4
      };
      const samples: any[] = [];

      const runOne = async (definition: any, fixture: any) => {
        let settled = false;
        let error: any = null;
        let frameCount = 0;
        let paintedBoundsUnion: any = null;
        let maxOverlayNodeCount = 0;
        let maxZIndex = 0;
        let randomState = 0x6d2b79f5;
        const getCellClientRect = (row: number, col: number) => {
          const left = boardViewport.left + (Number(col) - fixture.originCol) * cellSize;
          const top = boardViewport.top + (Number(row) - fixture.originRow) * cellSize;
          return { left, top, right: left + cellSize, bottom: top + cellSize, width: cellSize, height: cellSize };
        };
        const target = {
          r: fixture.target.row,
          col: fixture.target.col,
          sourceRow: fixture.source.row,
          sourceCol: fixture.source.col,
          ownerBefore: 'white',
          ownerAfter: 'black',
          projectileOwner: 'black',
          cause: definition.cause,
          reason: definition.reason,
          meta: { sourceRow: fixture.source.row, sourceCol: fixture.source.col }
        };
        const timer = {
          setTimeout(fn: () => void, ms: number) { return window.setTimeout(fn, ms); },
          clearTimeout(id: number) { window.clearTimeout(id); }
        };
        const startedAt = performance.now();
        const promise = Promise.resolve(definition.eventType === 'flip'
          ? presenter.presentZombieBiteSourceAnimation({ type: 'flip', target }, {
            isNoAnim: () => false,
            getCellClientRect,
            sleep: (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
            timer: () => timer,
            playbackScope: `baseline:${definition.profileKey}`,
            documentRef: document
          })
          : presenter.presentDestroySourceAnimation({ type: 'destroy', target }, {
            isNoAnim: () => false,
            getCellClientRect,
            sleep: (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
            timer: () => timer,
            playbackScope: `baseline:${definition.profileKey}`,
            random: () => {
              randomState ^= randomState << 13;
              randomState ^= randomState >>> 17;
              randomState ^= randomState << 5;
              return (randomState >>> 0) / 0x100000000;
            },
            suppressTargetImpact: true,
            documentRef: document
          })).catch((candidate: any) => {
            error = candidate;
          }).finally(() => {
            settled = true;
          });
        while (!settled && frameCount < 180) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          frameCount += 1;
          const elements = effectElements();
          maxOverlayNodeCount = Math.max(maxOverlayNodeCount, elements.length);
          for (const element of elements) {
            const zIndex = Number.parseInt(getComputedStyle(element).zIndex || '0', 10);
            if (Number.isFinite(zIndex)) maxZIndex = Math.max(maxZIndex, zIndex);
            paintedBoundsUnion = union(paintedBoundsUnion, conservativePaintRect(element));
          }
        }
        await promise;
        const elapsedMs = performance.now() - startedAt;
        await Promise.resolve();
        const remainingOverlayNodeCount = effectElements().length;
        return {
          profileKey: definition.profileKey,
          fixture: fixture.name,
          viewport: input.viewport,
          dpr: input.dpr,
          direction: definition.direction,
          logicalSource: fixture.source,
          logicalTarget: fixture.target,
          boardViewport,
          paintedHaloOwner,
          paintedBoundsUnion,
          expectedClippedPaintedBounds: intersect(paintedBoundsUnion, paintedHaloOwner),
          legacyOverflow: overflow(paintedBoundsUnion, paintedHaloOwner),
          frameCount,
          elapsedMs,
          maxOverlayNodeCount,
          maxZIndex,
          remainingOverlayNodeCount,
          error: error ? String(error.message || error) : null
        };
      };

      for (const fixture of fixtures) {
        for (const definition of definitions) samples.push(await runOne(definition, fixture));
      }
      samples.push(await runOne(definitions[0], {
        name: 'long-range-offscreen-sniper',
        originRow: 4,
        originCol: 4,
        source: { row: 0, col: 0 },
        target: { row: 15, col: 15 }
      }));
      return samples;
    }, { viewport: viewport.name, dpr: viewport.dpr })
  });
  const samples = Array.isArray(smoke.afterReadyResult)
    ? smoke.afterReadyResult as BoardSourceTrajectoryBrowserSample[]
    : [];
  return Object.freeze({
    viewport: viewport.name,
    dpr: viewport.dpr,
    smokeOk: smoke.evaluation.ok,
    smokeErrors: Object.freeze(smoke.evaluation.errors.slice()),
    samples: Object.freeze(samples.slice())
  });
}

export async function runBoardSourceTrajectoryBrowserCheck(options?: {
  readonly rootDir?: string;
  readonly backend?: BoardSourceTrajectoryBrowserBackend;
  readonly baseline?: boolean;
}): Promise<Readonly<{
  report: BoardSourceTrajectoryBrowserReport;
  evaluation: BoardSourceTrajectoryBrowserEvaluation;
}>> {
  const rootDir = options?.rootDir || process.cwd();
  const backend = options?.backend || 'dom';
  const captures = [];
  for (const viewport of BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS) {
    captures.push(await captureViewport(rootDir, backend, viewport));
  }
  const report: BoardSourceTrajectoryBrowserReport = Object.freeze({
    backend,
    baseline: options?.baseline === true,
    captures: Object.freeze(captures)
  });
  return Object.freeze({ report, evaluation: evaluateBoardSourceTrajectoryBrowserReport(report) });
}

if (require.main === module) {
  const backend = backendFromArgs(process.argv.slice(2));
  const baseline = process.argv.includes('--baseline');
  runBoardSourceTrajectoryBrowserCheck({ backend, baseline }).then(({ report, evaluation }) => {
    console.log(JSON.stringify({ report, evaluation }, null, 2));
    if (!evaluation.ok) process.exitCode = 1;
  }).catch((error) => {
    console.error(`[board-source-trajectory-browser-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
