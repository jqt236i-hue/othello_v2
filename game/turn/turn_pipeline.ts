/**
 * @file turn_pipeline.ts
 * @description Pure turn driver used by headless tests and local runtime.
 */

'use strict';

import CardLogic = require('../logic/cards');
import Core = require('../logic/core');
import TurnPipelinePhases = require('./turn_pipeline_phases');
import BoardOps = require('../logic/board_ops');
import SubPlacementContinuation = require('./sub-placement-continuation');
import TurnPipelineFactory = require('./turn_pipeline_factory');

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
