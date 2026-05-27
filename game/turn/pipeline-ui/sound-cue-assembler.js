module.exports = process.env.JEST_WORKER_ID
    ? require('./sound-cue-assembler.ts')
    : require('../../../../dist/game/turn/pipeline-ui/sound-cue-assembler');
