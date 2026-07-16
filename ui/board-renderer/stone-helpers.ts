type BoardRendererStoneHelperMap = Record<string, any>;

const HELPER_NAMES = Object.freeze([
  'syncBoardPixelSizing',
  'renderBoard',
  'renderBoardFull',
  'getBoardInputController',
  'applyTimeStopLegalEmphasis',
  'resolveBoardExpansionLayerElement',
  'ensureDiscSkeleton',
  'setDiscStoneImage',
  'getDiscHudRoot'
]);

let registeredHelpers: BoardRendererStoneHelperMap = {};

function getGlobalScope(): any {
  return (typeof globalThis !== 'undefined') ? globalThis : {};
}

function normalizeHelpers(helpers: any): BoardRendererStoneHelperMap {
  const normalized: BoardRendererStoneHelperMap = {};
  if (!helpers || typeof helpers !== 'object') return normalized;

  for (const name of HELPER_NAMES) {
    if (typeof helpers[name] === 'function') {
      normalized[name] = helpers[name];
    }
  }

  return normalized;
}

function setBoardRendererStoneHelpers(helpers: any): BoardRendererStoneHelperMap {
  registeredHelpers = normalizeHelpers(helpers);

  try {
    const scope = getGlobalScope();
    scope.BoardRendererStoneHelpers = Object.assign(
      {},
      scope.BoardRendererStoneHelpers || {},
      registeredHelpers
    );
  } catch (e: any) { /* ignore */ }

  return registeredHelpers;
}

function getBoardRendererStoneHelper(name: any): any {
  const key = String(name || '');
  if (typeof registeredHelpers[key] === 'function') {
    return registeredHelpers[key];
  }

  try {
    const scope = getGlobalScope();
    const helperBag = scope && scope.BoardRendererStoneHelpers;
    if (helperBag && typeof helperBag[key] === 'function') {
      return helperBag[key];
    }
    if (scope && typeof scope[key] === 'function') {
      return scope[key];
    }
  } catch (e: any) { /* ignore */ }

  return null;
}

function getBoardRendererStoneHelpers(): BoardRendererStoneHelperMap {
  const output: BoardRendererStoneHelperMap = Object.assign({}, registeredHelpers);

  try {
    const scope = getGlobalScope();
    const helperBag = scope && scope.BoardRendererStoneHelpers;
    if (helperBag && typeof helperBag === 'object') {
      for (const name of HELPER_NAMES) {
        if (typeof helperBag[name] === 'function') {
          output[name] = helperBag[name];
        }
      }
    }
  } catch (e: any) { /* ignore */ }

  return output;
}

const BoardRendererStoneHelpersRegistry = {
  setBoardRendererStoneHelpers,
  getBoardRendererStoneHelper,
  getBoardRendererStoneHelpers
};

export = BoardRendererStoneHelpersRegistry;
