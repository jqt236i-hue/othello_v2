declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__
  : require;

// Compatibility import path for focused DOM renderer tests. The shared,
// backend-neutral projection now lives under board-visual.
const BoardVisualModelBuilder = _require('../board-visual/model-builder');

export = BoardVisualModelBuilder;
