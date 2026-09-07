/** Runs only in disposable comparison pages, never the production CPU. */
export function installJointTurnExperiment(options: { color: string }) {
    const root = window as any;
    const req = root.require;
    const policy = req('game/ai/cpu-policy-pending-targets');
    const cards = req('game/logic/cards');
    const system = req('card-system');
    const core = req('game/logic/core');
    const authority = req('utils/match-authority');
    const prng = req('game/schema/prng');
    const pipeline = req('game/turn/turn_pipeline');
    const placementPolicy = req('game/ai/cpu-policy-core');
    const boardUtils = req('shared/shared-board-utils');
    const evaluate = (gs: any, cs: any, sign: number) => {
        const board = boardUtils.createBoardContext(gs, cs);
        const inBoard = (b: any, r: number, c: number) => boardUtils.hasPlayableCell(b, r, c);
        const getLegalMovesBasic = (_b: any, p: number) => core.getLegalMoves(gs, p, { ...cards.getCardContext(cs), cardState: cs });
        const features = req('game/ai/cpu-policy-board-features').createCpuPolicyBoardFeatures({
            SharedBoardUtils: boardUtils, inBoard, getLegalMovesBasic,
            isCorner: boardUtils.isCornerCell, isXSquare: boardUtils.isXSquare, isCSquare: boardUtils.isCSquare,
            hasOwnedAdjacentCorner: (b: any, r: number, c: number, p: number) => boardUtils.getCornerCells(b).some((corner: any) => Math.abs(corner.row - r) <= 1 && Math.abs(corner.col - c) <= 1 && boardUtils.getCellValue(b, corner.row, corner.col) === p)
        });
        const parity = req('game/ai/cpu-policy-lookahead-parity').createCpuPolicyLookaheadParity({ SharedBoardUtils: boardUtils, inBoard });
        const evaluator = req('game/ai/cpu-policy-lookahead-evaluation').createCpuPolicyLookaheadEvaluation({
            ...features, ...parity, SharedBoardUtils: boardUtils, inBoard, getLegalMovesBasic,
            isCorner: boardUtils.isCornerCell, isEdge: boardUtils.isEdgeCell,
            countBoardDiscsForPlayer: (b: any, p: number) => {
                const values = boardUtils.collectBoardCoordinates(b).map((cell: any) => boardUtils.getCellValue(b, cell.row, cell.col));
                return { own: values.filter((v: number) => v === p).length, opp: values.filter((v: number) => v === -p).length, empties: values.filter((v: number) => v === 0).length };
            }
        });
        return core.isGameOver(gs) ? evaluator.evaluateTerminalBoardForLookahead(board, sign) : evaluator.evaluateBoardForLookahead(board, sign);
    };

    const clone = (v: any) => JSON.parse(JSON.stringify(v));
    const canonical = (v: any) => JSON.stringify(v, (_k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])) : x);
    const publicState = (gs: any, cs: any, player: string) => {
        const s = authority.projectSnapshotForViewer(clone({gameState:gs,cardState:cs}),player);
        for(const k of ['_defaultRandomSource','_boardOpsRandomSource','_currentActionMeta','presentationEvents','_presentationEventsPersist','chargeDeltaEvents']) delete s.cardState[k];
        cards.ensureCardCopyState(s.cardState);
        for(const owner of ['black','white']) (s.cardState.handCostAdjustmentsByPlayer?.[owner]||[]).forEach((adjustment:any,index:number)=>{
            if(!adjustment)return;
            const id=s.cardState._handCopyIdsByPlayer[owner][index];
            if(Number.isFinite(adjustment.overrideCost))s.cardState.cardCostOverridesByCopyId[id]={cost:adjustment.overrideCost};
            if(Number.isFinite(adjustment.delta))s.cardState.cardCostModifiersByCopyId[id]=[{delta:adjustment.delta}];
        });
        return s;
    };
    // Compare game-relevant state, not UI bookkeeping or hidden hand contents.
    const fingerprint = (gs: any, cs: any, player: string) => canonical({
        board:gs.board, expansion:gs.boardExpansion, boardConfig:gs.boardConfig,currentPlayer:gs.currentPlayer,turnNumber:gs.turnNumber,
        markers:cs.markers,charge:cs.charge,ownHand:cs.hands[player],used:cs.hasUsedCardThisTurnByPlayer,
        pending:Object.fromEntries(['black','white'].map(p=>[p,cs.pendingEffectByPlayer[p] ? {type:cs.pendingEffectByPlayer[p].type,stage:cs.pendingEffectByPlayer[p].stage}:null]))
    });
    root.__cardHoldEvents=[];
    let plan: any = null, simulating=false;
    const oldApply=pipeline.applyTurnSafe;
    const actionKey=(a:any)=>{
        const targets=Object.keys(a).filter(k=>k.endsWith('Target'));
        return canonical(a.type==='use_card'?{type:a.type,cardId:a.useCardId}:a.type==='place'?{
            type:a.type,...(targets.length?{}:{row:a.row,col:a.col}),...Object.fromEntries(targets.map(k=>[k,a[k]]))}:a);
    };
    pipeline.applyTurnSafe=function(cs:any,gs:any,player:string,action:any,...args:any[]){
        const pending= !simulating && plan && player===options.color ? plan.queue[0] : null;
        const matched=pending && pending.before===fingerprint(gs,cs,player) && actionKey(pending.action)===actionKey(action);
        const result=oldApply.call(this,cs,gs,player,action,...args);
        if(!simulating && plan && player===options.color){
            if(matched && result.ok && pending.after===fingerprint(result.gameState,result.cardState,player)){
                plan.event.executed++; plan.queue.shift();
                if(!plan.queue.length){plan.event.completed=true;plan=null;}
            }else{
                const diff=(a:string,b:string)=>{const x=JSON.parse(a),y=JSON.parse(b);return Object.keys({...x,...y}).filter(k=>canonical(x[k])!==canonical(y[k]));};
                plan.event.mismatch={expected:pending?.action,actual:actionKey(action),beforeKeys:pending?diff(pending.before,fingerprint(gs,cs,player)):[],afterKeys:pending?diff(pending.after,fingerprint(result.gameState,result.cardState,player)):[],ok:result.ok};
                plan.event.aborted='actual_action_or_state_mismatch';plan=null;
            }
        }
        return result;
    };
    const take=(player:string,kind:string)=>{
        if(!plan||player!==options.color)return null;
        const next=plan.queue[0];
        if(!next||fingerprint(root.gameState,root.cardState,player)!==next.before){
            if(next){const a=JSON.parse(next.before),b=JSON.parse(fingerprint(root.gameState,root.cardState,player));plan.event.staleDifference=Object.keys({...a,...b}).filter(k=>canonical(a[k])!==canonical(b[k])).map(k=>({key:k,expected:a[k],actual:b[k]}));}
            plan.event.aborted='stale_plan';plan=null;return null;
        }
        return kind==='target' && Object.keys(next.action).some(k=>k.endsWith('Target')) || kind==='move' && Number.isInteger(next.action.row) ? next.action : null;
    };
    const oldTarget=policy.choosePendingTargetWithPolicyAsync;
    policy.choosePendingTargetWithPolicyAsync=async function(player:string,type:string,targets:any[],...rest:any[]){
        const a=take(player,'target');
        const entry=req('game/logic/cards-internal/pending-selection-registry').getPendingSelectionEntry(type);
        if(a&&entry?.action?.field&&a[entry.action.field]){
            const t=a[entry.action.field], found=targets.find(x=>x.row===t.row&&x.col===t.col&&(!t.directionKey||x.directionKey===t.directionKey));
            if(found)return found;
        }
        return oldTarget.call(this,player,type,targets,...rest);
    };
    root.__jointTakeMove=(moves:any[],player:string)=>{
        const a=take(player,'move');
        return a ? moves.find(m=>m.row===a.row&&m.col===a.col)||null : null;
    };
    root.__jointCardDecision=(player:string,choice:any,prepared:any)=>{
        if(player!==options.color||!choice||!prepared?.legalMovesCount||plan)return {choice,prepared};
        const before=canonical({gs:root.gameState,cs:root.cardState,rng:system.getGamePrng().getState()});
        const start=performance.now(), sign=player==='black'?1:-1;
        const view=publicState(root.gameState,root.cardState,player);
        let steps=0;
        const apply=(s:any,a:any)=>{
            if(++steps>53)throw Error('Joint plan exceeded step bound');
            const x=clone(s),rng=prng.createPRNG(19076000);
            let r:any;simulating=true;
            try{r=pipeline.applyTurnSafe(x.cardState,x.gameState,player,a,rng,{skipTurnStart:true});}finally{simulating=false;}
            if(!r.ok||rng.getState().calls>0)return null;
            const state=publicState(r.gameState,r.cardState,player);
            return {state,step:{action:a,before:fingerprint(s.gameState,s.cardState,player),after:fingerprint(state.gameState,state.cardState,player)}};
        };
        const evaluateMoves=(s:any,queue:any[])=>{
            const board=boardUtils.createBoardContext(s.gameState,s.cardState);
            const moves=core.getLegalMoves(s.gameState,sign,{...cards.getCardContext(s.cardState),cardState:s.cardState});
            moves.sort((a:any,b:any)=>placementPolicy.scoreMoveHeuristic(b,6,board)-placementPolicy.scoreMoveHeuristic(a,6,board)||a.row-b.row||a.col-b.col);
            let best:any=null;
            for(const m of moves.slice(0,4)){
                const result=apply(s,{type:'place',row:m.row,col:m.col});
                if(!result||result.state.cardState.pendingEffectByPlayer[player])continue;
                const value=evaluate(result.state.gameState,result.state.cardState,sign);
                if(!best||value>best.value)best={value,queue:[...queue,result.step]};
            }return best;
        };
        let selected:any=null, skipped:any=null;
        try{
            const used=apply(view,{type:'use_card',useCardId:choice.cardId,useCardOwnerKey:player});
            if(!used)skipped='card_use_random_or_rejected';
            else{
                const pending=used.state.cardState.pendingEffectByPlayer[player];
                const entry=req('game/logic/cards-internal/pending-selection-registry').getPendingSelectionEntry(pending?.type);
                if(!pending)selected=evaluateMoves(used.state,[used.step]);
                else if(entry?.target&&entry?.action&&entry.turnOutcome==='continue_turn'&&pending.stage==='selectTarget'){
                    const args=[used.state.cardState,used.state.gameState];if(entry.target.argsKey!=='board')args.push(player);if(entry.target.argsKey==='player_pending')args.push(pending);
                    const targets=cards[entry.target.method](...args).slice(0,32), branches:any[]=[];
                    for(const t of targets){
                        const target:any={row:t.row,col:t.col};if(t.directionKey)target.directionKey=t.directionKey;
                        const result=apply(used.state,{type:'place',[entry.action.field]:target});
                        if(result&&!result.state.cardState.pendingEffectByPlayer[player]&&result.state.gameState.currentPlayer===sign)
                            branches.push({result,value:evaluate(result.state.gameState,result.state.cardState,sign)});
                    }
                    branches.sort((a,b)=>b.value-a.value);
                    for(const b of branches.slice(0,4)){
                        const option=evaluateMoves(b.result.state,[used.step,b.result.step]);
                        if(option&&(!selected||option.value>selected.value))selected=option;
                    }
                }else skipped='unsupported_pending';
                if(selected&&!prepared.decisionContext?.forceUseCard){
                    const hold=evaluateMoves(view,[]);
                    if(hold&&hold.value>selected.value){selected=hold;}
                }
            }
            if(canonical({gs:root.gameState,cs:root.cardState,rng:system.getGamePrng().getState()})!==before)throw Error('Joint planning changed live state');
            const event:any={player,kind:'joint-plan',cardId:choice.cardId,changed:false,planned:!!selected,steps,extraMs:performance.now()-start,liveUnchanged:true,skipped:skipped||(!selected?'no_complete_plan':null),executed:0,completed:false};
            root.__cardHoldEvents.push(event);
            if(!selected)return {choice,prepared};
            event.actions=selected.queue.map((q:any)=>q.action);event.value=selected.value;
            // A plan is an intervention even if its card matches the original choice.
            event.changed=true;
            plan={queue:selected.queue,event};
            return {choice:selected.queue[0].action.type==='use_card'?choice:null,prepared};
        }catch(error){root.__cardHoldEvents.push({player,error:String(error)});throw error;}
    };
}

export function patchJointTurnRegistry(source:string):string {
    const card='return { choice: choice || null, prepared };';
    const move='let move = null;\n        // Lv1 fast path:';
    if(source.split(card).length!==2)throw Error('Joint card hook must match once');
    // Registry embeds module code as JSON strings.
    const escapedMove=JSON.stringify(move).slice(1,-1);
    if(source.split(escapedMove).length!==2)throw Error('Joint move hook must match once');
    return source.replace(card,'return window.__jointCardDecision(playerKey, choice || null, prepared);')
        .replace(escapedMove,JSON.stringify('let move = window.__jointTakeMove(candidateMoves, playerKey);\n        // Lv1 fast path:').slice(1,-1));
}
