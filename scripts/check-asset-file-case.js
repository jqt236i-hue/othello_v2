const cli = require("../dist/scripts/check-asset-file-case");

if (require.main === module) {
  process.exit(cli.main());
}

module.exports = cli;
