module.exports = process.env.JEST_WORKER_ID
    ? require('./card-economy-sound-cues.ts')
    : require('../../../../dist/game/turn/pipeline-ui/card-economy-sound-cues');
