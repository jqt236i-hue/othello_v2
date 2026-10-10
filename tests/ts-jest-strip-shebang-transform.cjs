"use strict";

// Type checking belongs to `npm run typecheck`; Jest only needs per-file
// transpilation, which avoids building a TypeScript program for every worker.
const tsJest = require("ts-jest").default.createTransformer({
  diagnostics: false,
  tsconfig: { isolatedModules: true }
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
