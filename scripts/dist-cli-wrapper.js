"use strict";

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

function resolveDistScript(scriptName) {
  const candidates = [
    path.join(__dirname, "..", "dist", "scripts", scriptName),
    path.join(__dirname, "..", "dist", "training", "scripts", scriptName)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function wrapDistCli(wrapperModule, scriptName) {
  const distScript = resolveDistScript(scriptName);
  if (require.main === wrapperModule) {
    const result = spawnSync(process.execPath, [distScript].concat(process.argv.slice(2)), {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });
    if (result.error) {
      console.error(result.error && result.error.message ? result.error.message : result.error);
      process.exit(1);
    }
    process.exit(Number.isInteger(result.status) ? result.status : 1);
  }
  return require(distScript);
}

module.exports = {
  resolveDistScript,
  wrapDistCli
};
