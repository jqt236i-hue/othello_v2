module.exports = process.env.JEST_WORKER_ID
    ? require('./playback-utils.ts')
    : require('../../../../dist/game/turn/pipeline-ui/playback-utils');
