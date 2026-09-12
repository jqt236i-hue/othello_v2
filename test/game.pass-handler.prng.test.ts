import Core = require('../game/logic/core');
import Pipeline = require('../game/turn/turn_pipeline');
import PassHandler = require('../game/pass-handler');
import {replayLv10RecordedTransition} from '../scripts/replay-cpu-lv10-decision';
const Cards = require('../game/logic/cards');
const Prng = require('../game/schema/prng');

test.each(['black','white'])('a %s pass supplies the live RNG for poison destruction and salvation revival', player => {
    const opponent=player==='black'?'white':'black',sign=player==='black'?1:-1;
    const rng=Prng.createPRNG(703),cs=Cards.createCardState(rng),gs=Core.createGameState();
    cs.debugNoDraw=true;cs.hands={black:[],white:[]};cs.decks={black:[],white:[]};
    gs.board=Array.from({length:8},()=>Array(8).fill(sign));
    gs.board[0][0]=-sign;gs.board[0][1]=-sign;gs.board[7][7]=0;gs.currentPlayer=sign;gs.turnNumber=1;
    cs.pendingEffectByPlayer[player]={type:'POISON_WILL',stage:'selectTarget',cardId:'poison_will_01'};
    Cards.applyPoisonWill(cs,gs,player,0,0);
    cs.markers.find((m:any)=>m.data?.type==='POISONED').data.remainingTurns=1;
    cs.markers.push({id:99,kind:'specialStone',owner:opponent,row:0,col:1,
        data:{type:'STONE_SALVATION_GOD',remainingOwnerTurns:12}});
    gs.turnNumber=5;cs.turnIndex=6;
    expect(Core.getLegalMoves(gs,sign,Cards.getCardContext(cs))).toEqual([]);
    const before=rng.getState();
    const beforeSnapshot=JSON.parse(JSON.stringify({gameState:gs,cardState:cs,prngState:before}));
    expect(Pipeline.applyTurnSafe(cs,gs,player,{type:'pass',turnIndex:6}))
        .toMatchObject({ok:false,errorMessage:'BoardOps requires an injected deterministic PRNG.'});
    const previous=Object.fromEntries(['gameState','cardState','TurnPipeline'].map(key=>[key,(global as any)[key]]));
    try {
        Object.assign(global,{gameState:gs,cardState:cs,TurnPipeline:Pipeline});
        const getGamePrng=jest.fn(()=>rng);
        PassHandler.setPassHandlerRuntime({getGamePrng});
        const result=PassHandler.applyPassViaPipeline(player);
        expect(getGamePrng).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ok:true,gameState:{turnNumber:6}});
        expect(Core.countDiscs(result.gameState,result.cardState)[opponent]).toBe(2);
        expect(rng.getState().calls).toBe(before.calls+1);
        const afterSnapshot=JSON.parse(JSON.stringify({gameState:result.gameState,cardState:result.cardState,prngState:rng.getState()}));
        expect(replayLv10RecordedTransition({player,action:{type:'pass',turnIndex:6},prngProvided:true,
            before:beforeSnapshot,after:afterSnapshot,ok:true})).toMatchObject({ok:true,exact:true});
    } finally {
        PassHandler.setPassHandlerRuntime(null);
        for(const [key,value] of Object.entries(previous)) {
            if(value===undefined)delete (global as any)[key];else (global as any)[key]=value;
        }
    }
});
