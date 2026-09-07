const Joint = require('../scripts/cpu-joint-turn-experiment');
const JointVm = require('vm');
const JointCards = require('../game/logic/cards');
const JointCore = require('../game/logic/core');
const JointPrng = require('../game/schema/prng');
const JointPipeline = require('../game/turn/turn_pipeline');
require('../game/logic/presentation').setPresentationRuntime({emitPresentationEvent:require('../game/logic/board_ops').emitPresentationEvent});

test('joint experiment patches the actual card and final placement paths exactly once', () => {
    const source=require('fs').readFileSync('public/module-registry.js','utf8');
    expect(Joint.patchJointTurnRegistry(source)).toContain('__jointTakeMove(candidateMoves, playerKey)');
    expect(()=>Joint.patchJointTurnRegistry('')).toThrow();
});

test.each([[false,false],[true,false],[false,true]])('joint plan execution: stale=%s discounted=%s', async (stale, discounted) => {
    const rng=JointPrng.createPRNG(123),cs=JointCards.createCardState(rng),gs=JointCore.createGameState();
    const cardId='guard_01';
    cs.hands.black=[cardId];cs.charge.black=99;JointCards.ensureCardCopyState(cs);
    if(discounted)cs.cardCostOverridesByCopyId[cs._handCopyIdsByPlayer.black[0]]={cost:0};
    const policy={choosePendingTargetWithPolicyAsync:async (_p:any,_t:any,targets:any[])=>targets[0]};
    const isolatedPipeline={...JointPipeline};
    const root:any={gameState:gs,cardState:cs,require:(name:string)=>name==='game/ai/cpu-policy-pending-targets'?policy:name==='game/turn/turn_pipeline'?isolatedPipeline:name==='card-system'?{getGamePrng:()=>rng}:require('../'+name)};
    JointVm.runInNewContext(`(${Joint.installJointTurnExperiment.toString()})({color:'black'})`,{window:root,performance:{now:()=>0}});
    const before=JSON.stringify({gs,cs,rng:rng.getState()});
    root.__jointCardDecision('black',{cardId,cardDef:JointCards.getCardDef(cardId)},{legalMovesCount:4,decisionContext:{forceUseCard:true}});
    expect(JSON.stringify({gs,cs,rng:rng.getState()})).toBe(before);
    const event=root.__cardHoldEvents[0];
    expect(event.planned).toBe(true);
    expect(event.steps).toBeLessThanOrEqual(53);
    if(stale){
        root.gameState.turnNumber++;
        expect(root.__jointTakeMove([{row:2,col:3}],'black')).toBeNull();
        expect(event.aborted).toBe('stale_plan');
        expect(event.executed).toBe(0);
        return;
    }
    for(const action of event.actions){
        if(Number.isInteger(action.row)){
            const moves=JointCore.getLegalMoves(root.gameState,1,{...JointCards.getCardContext(root.cardState),cardState:root.cardState});
            expect(root.__jointTakeMove(moves,'black')).toMatchObject({row:action.row,col:action.col});
        }
        const targetKey=Object.keys(action).find(k=>k.endsWith('Target'));
        const actualAction=targetKey?{...action,row:action[targetKey].row,col:action[targetKey].col}:action;
        const result=isolatedPipeline.applyTurnSafe(root.cardState,root.gameState,'black',actualAction,rng,{skipTurnStart:true});
        expect(result.ok).toBe(true);root.gameState=result.gameState;root.cardState=result.cardState;
    }
    expect(event.completed).toBe(true);
    expect(event.executed).toBe(event.actions.length);
});
