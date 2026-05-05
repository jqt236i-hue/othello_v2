declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

<<<<<<< Updated upstream
/** @type {any} */
('../../dist/game/turn/turn_pipeline_phase_helpers');
=======
import type { CardState, GameState, PlayerKey } from '../../src/types';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
('../../dist/game/turn/turn_pipeline_phase_helpers') as unknown as void;
>>>>>>> Stashed changes

export = require;
