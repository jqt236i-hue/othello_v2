"use strict";

const Engine = require("./engine");

const status = {
  loaded: false,
  valueLoaded: false
};

function getStatus() {
  return {
    loaded: status.loaded,
    valueLoaded: status.valueLoaded
  };
}

function setStatus(nextStatus) {
  if (!nextStatus || typeof nextStatus !== "object") return getStatus();
  status.loaded = nextStatus.loaded === true;
  status.valueLoaded = nextStatus.valueLoaded === true;
  return getStatus();
}

function chooseMove(legalMoves, context) {
  const models = context && context.models && typeof context.models === "object"
    ? context.models
    : {};
  return Engine.chooseEngineMove(legalMoves, context || {}, models);
}

module.exports = {
  getStatus,
  setStatus,
  chooseMove
};
