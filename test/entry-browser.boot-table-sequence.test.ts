import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

type BootLoadEntry = {
  moduleKey: string;
  globalNames?: string[];
  lateGlobalNames?: string[];
  defaultGlobalNames?: string[];
  initDebugCardSearch?: boolean;
  initCardInteraction?: boolean;
};

function readEntryBrowserText(): string {
  return fs.readFileSync(path.resolve(__dirname, '..', 'entry-browser.js'), 'utf8');
}

function extractBootLoadEntries(text: string): BootLoadEntry[] {
  const tableMatch = text.match(/var BOOT_LOAD_ENTRIES = (\[[\s\S]*?\]);/);
  if (tableMatch) {
    const context: any = {};
    vm.runInNewContext(`entries = ${tableMatch[1]};`, context);
    return context.entries;
  }

  const start = text.indexOf('var gameState;');
  const end = text.indexOf('// ===== Namespace globals for module resolution =====');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const bootSection = text.slice(start, end);
  const blockRe = /\/\/ ([^\r\n]+)\r?\ntry \{\r?\n([\s\S]*?)\r?\n\} catch \(e\) \{\r?\n\s*handleBootModuleError\("([^"]+)", e\);\r?\n\}/g;
  const entriesByVariable = new Map<string, BootLoadEntry>();
  const entries: BootLoadEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(bootSection)) !== null) {
    const body = match[2];
    const requireMatch = body.match(/var\s+([A-Za-z0-9_$]+)\s*=\s*require\("([^"]+)"\);/);
    if (!requireMatch) continue;
    const variableName = requireMatch[1];
    const entry: BootLoadEntry = { moduleKey: requireMatch[2] };
    const globalNames: string[] = [];
    const defaultGlobalNames: string[] = [];
    const directGlobalRe = new RegExp(`window\\.([A-Za-z0-9_$]+)\\s*=\\s*${variableName}\\s*;`, 'g');
    const defaultGlobalRe = new RegExp(`window\\.([A-Za-z0-9_$]+)\\s*=\\s*${variableName}\\.default\\s*;`, 'g');
    let globalMatch: RegExpExecArray | null;
    while ((globalMatch = directGlobalRe.exec(body)) !== null) globalNames.push(globalMatch[1]);
    while ((globalMatch = defaultGlobalRe.exec(body)) !== null) defaultGlobalNames.push(globalMatch[1]);
    if (body.includes(`${variableName}.initDebugCardSearch()`)) entry.initDebugCardSearch = true;
    if (globalNames.length > 0) entry.globalNames = globalNames;
    if (defaultGlobalNames.length > 0) entry.defaultGlobalNames = defaultGlobalNames;
    entriesByVariable.set(variableName, entry);
    entries.push(entry);
  }

  const directAssignmentRe = /if \(typeof ([A-Za-z0-9_$]+) !== "undefined" && \1\) window\.([A-Za-z0-9_$]+) = \1;/g;
  while ((match = directAssignmentRe.exec(text)) !== null) {
    const entry = entriesByVariable.get(match[1]);
    if (!entry) continue;
    const names = entry.globalNames || [];
    if (!names.includes(match[2])) names.push(match[2]);
    entry.globalNames = names;
  }

  return entries;
}

function getAllGlobalNames(entry: BootLoadEntry | undefined): string[] {
  if (!entry) return [];
  return [
    ...(Array.isArray(entry.globalNames) ? entry.globalNames : []),
    ...(Array.isArray(entry.lateGlobalNames) ? entry.lateGlobalNames : [])
  ];
}

describe('entry-browser boot load table sequence', () => {
  test('preserves classic boot module order and duplicate compatibility loads', () => {
    const entries = extractBootLoadEntries(readEntryBrowserText());
    expect(entries.slice(0, 27).map((entry) => entry.moduleKey)).toEqual([
      './dist/ui/layout-stage',
      './dist/is-env-capable',
      './dist/constants/difficulty-constants',
      './dist/constants/ui-element-cache',
      './dist/constants/animation-constants',
      './dist/cards/catalog',
      './dist/shared-constants',
      './dist/shared/board/dimensions',
      './dist/shared/board/configuration',
      './dist/shared/board/initial-layout',
      './dist/shared/board/expansion-descriptors',
      './dist/shared/board/shape-metadata',
      './dist/shared/board/cell-access',
      './dist/shared/board/corners',
      './dist/shared/board/edge-runs',
      './dist/shared/board/risk-cells',
      './dist/shared/board/shape-iteration',
      './dist/shared/board/legal-moves',
      './dist/shared/board/control-counts',
      './dist/shared/board/canonical-encoding',
      './dist/shared/board/notation',
      './dist/shared/board/padded-coordinates',
      './dist/shared/shared-board-utils',
      './dist/shared/deck-spec',
      './dist/shared/deck-codec',
      './dist/shared/destroy-outcome-contract',
      './dist/shared/manifest-stone-registry'
    ]);
    expect(entries.filter((entry) => entry.moduleKey === './dist/shared/shared-board-utils')).toHaveLength(2);
    expect(entries[entries.length - 1].moduleKey).toBe('./dist/ui/event-handlers');
  });

  test('preserves boot namespace globals that Object.assign cannot create', () => {
    const entries = extractBootLoadEntries(readEntryBrowserText());
    const byModule = new Map(entries.map((entry) => [entry.moduleKey, entry]));
    expect(getAllGlobalNames(byModule.get('./dist/cards/catalog'))).toContain('CardCatalog');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/dimensions'))).toContain('BoardDimensions');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/configuration'))).toContain('BoardConfiguration');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/initial-layout'))).toContain('InitialBoardLayout');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/expansion-descriptors'))).toContain('BoardExpansionDescriptors');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/shape-metadata'))).toContain('BoardShapeMetadata');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/cell-access'))).toContain('BoardCellAccess');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/corners'))).toContain('BoardCorners');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/risk-cells'))).toContain('BoardRiskCells');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/edge-runs'))).toContain('BoardEdgeRuns');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/shape-iteration'))).toContain('BoardShapeIteration');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/legal-moves'))).toContain('BoardLegalMoves');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/control-counts'))).toContain('BoardControlCounts');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/canonical-encoding'))).toContain('CanonicalBoardEncoding');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/notation'))).toContain('BoardNotation');
    expect(getAllGlobalNames(byModule.get('./dist/shared/board/padded-coordinates'))).toContain('PaddedBoardCoordinates');
    expect(getAllGlobalNames(byModule.get('./dist/game/logic/board_ops'))).toContain('BoardOps');
    expect(getAllGlobalNames(byModule.get('./dist/game/logic/core'))).toEqual(expect.arrayContaining(['CoreLogic', 'Core']));
    expect(getAllGlobalNames(byModule.get('./dist/game/logic/cards'))).toContain('CardLogic');
    expect(getAllGlobalNames(byModule.get('./dist/ui/animation-engine'))).toContain('AnimationEngine');
    expect(getAllGlobalNames(byModule.get('./dist/ui/animation-utils'))).toContain('AnimationUtils');
    expect(getAllGlobalNames(byModule.get('./dist/cards/card-renderer'))).toContain('HandAnimationUtilsModule');
    expect(byModule.get('./dist/sound-engine')?.defaultGlobalNames).toContain('SoundEngine');
    expect(getAllGlobalNames(byModule.get('./dist/ui/debug-card-search'))).toContain('DebugCardSearchModule');
    expect(byModule.get('./dist/ui/debug-card-search')?.initDebugCardSearch).toBe(true);
    expect(byModule.get('./dist/cards/card-interaction')?.initCardInteraction).toBe(true);
  });
});
