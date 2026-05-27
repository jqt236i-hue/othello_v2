module.exports = process.env.JEST_WORKER_ID
    ? require('./selection-sound-cues.ts')
    : require('../../../../dist/game/turn/pipeline-ui/selection-sound-cues');
