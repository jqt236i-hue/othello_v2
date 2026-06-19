/**
 * @file turn_pipeline.ts
 * @description Pure turn driver used by headless tests and local runtime.
 */

'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const CardLogic = _require('../logic/cards');
const Core = _require('../logic/core');
const TurnPipelinePhases = _require('./turn_pipeline_phases');
const BoardOps = _require('../logic/board_ops');
const SubPlacementContinuation = _require('./sub-placement-continuation');
const TurnPipelineFactory = _require('./turn_pipeline_factory');

const pipeline = TurnPipelineFactory.createTurnPipelineModule({
  CardLogic,
  Core,
  TurnPipelinePhases,
  BoardOps,
  SubPlacementContinuation
});

export = {
  applyTurn: pipeline.applyTurn,
  applyTurnSafe: pipeline.applyTurnSafe
};
