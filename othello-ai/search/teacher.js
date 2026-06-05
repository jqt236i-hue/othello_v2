"use strict";

const Engine = require("../runtime/engine");

function chooseTeacherMove(legalMoves, context, models) {
  return Engine.chooseEngineMove(legalMoves, context || {}, models || {});
}

module.exports = {
  chooseTeacherMove
};
