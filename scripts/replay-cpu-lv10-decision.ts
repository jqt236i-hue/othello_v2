#!/usr/bin/env node
import fs = require('node:fs');
import zlib = require('node:zlib');
import crypto = require('node:crypto');
import Pipeline = require('../game/turn/turn_pipeline');
import Core = require('../game/logic/core');
import Presentation = require('../shared/presentation-queue');
import StateHash = require('../shared/state-hash');
import Startup = require('../shared/cpu-opponent-startup-options');
import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import { lv10DecisionPlayer, sampleLv10Position, enumerateLv10Actions, lv10PlacementMoves } from '../game/ai/cpu-lv10-position';
import { searchLv10, LV10_SEARCH_CONFIG } from '../game/ai/cpu-lv10-search';

const clone = (value:any) => JSON.parse(JSON.stringify(value));
const Prng:any = require('../game/schema/prng');
const sha256 = (value:string) => crypto.createHash('sha256').update(value).digest('hex');
function comparable(value:any): string {
    const state=clone(value);
    Presentation.clearPresentationQueues(state.cardState);
    for(const key of ['_defaultRandomSource','_boardOpsRandomSource','_currentActionMeta'])delete state.cardState[key];
    return StateHash.stableStringify(state);
}

/** Reapply a recorded action to isolated authoritative state. This verifies a
 * transition, not a decision; the advisor below only receives public state. */
export function replayLv10RecordedTransition(record:any): {ok:boolean;recordedOk:boolean;exact:boolean;afterSha256:string;recordedAfterSha256:string;counts:{black:number;white:number};rejectedReason:string|null} {
    if(!record?.before?.gameState || !record.before.cardState || !record.before.prngState || !record.action)throw new Error('Invalid action record');
    const before=clone(record.before),rng=Prng.createPRNG(1);
    rng.restoreState(before.prngState);
    before.cardState._defaultRandomSource=rng;
    // Old traces predate the missing-pass-PRNG repair. Preserve their original
    // omitted argument; new traces explicitly record the actual call contract.
    const prngProvided = record.prngProvided ?? record.action.type!=='pass';
    const result=Pipeline.applyTurnSafe(before.cardState,before.gameState,record.player,clone(record.action),
        prngProvided?rng:undefined,clone(record.options || {}));
    const after={gameState:result.gameState,cardState:result.cardState,prngState:rng.getState()};
    return {ok:result.ok,recordedOk:record.ok,exact:result.ok===record.ok && comparable(after)===comparable(record.after),
        afterSha256:sha256(comparable(after)),recordedAfterSha256:sha256(comparable(record.after)),
        counts:Core.countDiscs(after.gameState,after.cardState),rejectedReason:result.rejectedReason || null};
}

export function inspectLv10RecordedDecision(record:any, advise=false): Record<string,unknown> {
    const viewer=lv10DecisionPlayer(record.before);
    const observation=observeLv10Position(record.before,viewer);
    const deck=Startup.getCpuOpponentStartupOptions('9-ending-ash',viewer).deckCardIds;
    if(!deck)throw new Error('Lv9 public deck recipe is unavailable');
    const publicRecipes={black:deck,white:deck};
    const sampled=sampleLv10Position(observation,LV10_SEARCH_CONFIG.scenarioSeeds[0],publicRecipes);
    const opponent=viewer==='black'?'white':'black';
    return {viewer,turnNumber:observation.gameState.turnNumber,observationSha256:sha256(JSON.stringify(observation)),
        counts:Core.countDiscs(observation.gameState,observation.cardState),
        ownPlacementCount:lv10PlacementMoves(sampled,viewer).length,opponentPlacementCount:lv10PlacementMoves(sampled,opponent).length,
        ownHand:observation.cardState.hands[viewer],markers:observation.cardState.markers,
        pending:observation.cardState.pendingEffectByPlayer,recordedAction:record.action,
        candidates:enumerateLv10Actions(sampled,{allowDestroy:(sampled.cardState.hands[viewer]?.length || 0)>=4}),
        ...(advise?{search:searchLv10(observation,{now:()=>performance.now(),publicRecipes}),searchConfig:LV10_SEARCH_CONFIG,
            timingNote:'Current decision code and public priors; wall-clock-limited search may vary. This Node replay does not replace browser match evidence.'}:{})};
}

if(require.main===module) {
    const [command,tracePath,indexText]=process.argv.slice(2),index=Number(indexText);
    if(!['inspect','replay','advise'].includes(command) || !tracePath || !/^\d+$/.test(indexText || '') || !Number.isSafeInteger(index)) {
        throw new Error('Usage: inspect|replay|advise <game.json.gz> <zero-based-record-index>');
    }
    if(fs.statSync(tracePath).size>64*1024**2)throw new Error('Compressed trace exceeds 64 MiB');
    const trace=JSON.parse(zlib.gunzipSync(fs.readFileSync(tracePath),{maxOutputLength:256*1024**2}).toString());
    const record=trace.audit?.records?.[index];
    if(!record)throw new Error('Action record does not exist');
    const result=command==='replay'?replayLv10RecordedTransition(record):inspectLv10RecordedDecision(record,command==='advise');
    console.log(JSON.stringify({tracePath,recordIndex:index,result},null,2));
    if(command==='replay' && !(result as any).exact)process.exitCode=1;
}
