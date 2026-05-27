module.exports = process.env.JEST_WORKER_ID
    ? require('./core-sound-cues.ts')
    : require('../../../../dist/game/turn/pipeline-ui/core-sound-cues');
