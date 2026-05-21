declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

export type StoryTurnManagerRoot = Record<string, any>;

export type SharedUIBootstrapLike = {
  readUIImpl?: (root: StoryTurnManagerRoot, key: string) => Record<string, unknown>;
  writeUIImpl?: (root: StoryTurnManagerRoot, key: string, value: Record<string, unknown>) => void;
};

export function runWithStoryBattleCardInitOptions(
  root: StoryTurnManagerRoot,
  initOptions: unknown,
  callback: () => void,
  shared: SharedUIBootstrapLike | null = resolveSharedUIBootstrap()
): void {
  const previous = shared?.readUIImpl ? shared.readUIImpl(root, 'turn_manager') : readGlobalTurnManagerImpl(root);
  const next = {
    ...previous,
    buildCardInitOptions: () => initOptions,
    readBoardConfig: () => (initOptions as any)?.boardConfig ?? null
  };

  writeTurnManagerImpl(root, next, shared);
  try {
    callback();
  } finally {
    writeTurnManagerImpl(root, previous, shared);
  }
}

export function readCurrentPlayerDeckSpec(root: StoryTurnManagerRoot): unknown {
  const impl = readGlobalTurnManagerImpl(root);
  if (impl && typeof impl.readActiveDeckSpec === 'function') {
    return impl.readActiveDeckSpec();
  }
  return null;
}

function readGlobalTurnManagerImpl(root: StoryTurnManagerRoot): Record<string, unknown> {
  const candidate = root.__uiImpl_turn_manager;
  return candidate && typeof candidate === 'object' ? { ...candidate } : {};
}

function writeTurnManagerImpl(
  root: StoryTurnManagerRoot,
  value: Record<string, unknown>,
  shared: SharedUIBootstrapLike | null
): void {
  if (shared && typeof shared.writeUIImpl === 'function') {
    shared.writeUIImpl(root, 'turn_manager', value);
    return;
  }
  root.__uiImpl_turn_manager = { ...value };
  if (typeof globalThis !== 'undefined') {
    (globalThis as StoryTurnManagerRoot).__uiImpl_turn_manager = { ...value };
  }
}

function resolveSharedUIBootstrap(): SharedUIBootstrapLike | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).SharedUIBootstrap) {
      return (globalThis as any).SharedUIBootstrap;
    }
  } catch (error) {
    // fall through to require
  }
  try {
    return _require('../../shared/ui-bootstrap-shared.js');
  } catch (error) {
    return null;
  }
}
