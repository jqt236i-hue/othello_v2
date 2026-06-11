"use strict";

const tsJest = require("ts-jest").default.createTransformer({
  diagnostics: false
});

function stripShebang(output) {
  if (typeof output === "string") {
    return output.replace(/^#![^\r\n]*(\r?\n)?/, "");
  }
  if (output && typeof output.code === "string") {
    return Object.assign({}, output, {
      code: output.code.replace(/^#![^\r\n]*(\r?\n)?/, "")
    });
  }
  return output;
}

module.exports = {
  canInstrument: tsJest.canInstrument,
  getCacheKey: tsJest.getCacheKey
    ? tsJest.getCacheKey.bind(tsJest)
    : undefined,
  process(sourceText, sourcePath, transformOptions) {
    return stripShebang(tsJest.process(sourceText, sourcePath, transformOptions));
  }
};
