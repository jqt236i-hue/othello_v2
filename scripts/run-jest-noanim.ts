/** Cross-platform Jest entry that enables the NOANIM test contract. */
process.env.NOANIM = '1';
require(require.resolve('jest/bin/jest'));
