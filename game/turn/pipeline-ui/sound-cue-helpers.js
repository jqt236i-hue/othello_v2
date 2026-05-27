module.exports = process.env.JEST_WORKER_ID
    ? require('./sound-cue-helpers.ts')
    : require('../../../../dist/game/turn/pipeline-ui/sound-cue-helpers');
