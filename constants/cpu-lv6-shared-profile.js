module.exports = process.env.JEST_WORKER_ID ? require('./cpu-lv6-shared-profile.ts') : require("../dist/constants/cpu-lv6-shared-profile");
