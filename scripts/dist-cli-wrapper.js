"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

function wrapDistCli(wrapperModule, scriptName) {
  const distScript = path.join(__dirname, "..", "dist", "scripts", scriptName);
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
  wrapDistCli
};
