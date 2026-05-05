declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../../src/types';

<<<<<<< Updated upstream
// destroy_dragon is provided as a global by the build system (esbuild-banner.js)
declare const destroy_dragon: any;
=======
declare const destroy_dragon: Record<string, unknown>;
>>>>>>> Stashed changes

export = destroy_dragon;
