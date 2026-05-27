module.exports = process.env.JEST_WORKER_ID
    ? require('./generated-throw-chain-playback.ts')
    : require('../../../../dist/game/turn/pipeline-ui/generated-throw-chain-playback');
