declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../../src/types';

<<<<<<< Updated upstream
// work_will is provided as a global by the build system (esbuild-banner.js)
declare const work_will: any;
=======
declare const work_will: Record<string, unknown>;
>>>>>>> Stashed changes

export = work_will;
