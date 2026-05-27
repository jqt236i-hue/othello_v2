module.exports = process.env.JEST_WORKER_ID
    ? require('./destroy-sound-cues.ts')
    : require('../../../../dist/game/turn/pipeline-ui/destroy-sound-cues');
