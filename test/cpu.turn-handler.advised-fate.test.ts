const runtime:Record<string,any>=globalThis;

describe.each([10,11,12])('Lv%s uses the controlling CPU under the will of fate',level=>{
    let handler:any;
    afterEach(()=>{
        handler?.resetCpuTurnHandlerState();handler?.setTimers(null);handler?.setCpuUIImpl({});
        for(const key of ['BLACK','WHITE','MATCH_MODE','cpuSmartness','isProcessing','isCardAnimating',
            'VisualPlaybackActive','isGameOver','isDebugLogAvailable','gameState','cardState'])delete runtime[key];
    });
    test.each(['black','white'] as const)('%s controls the other seat with its own advisor and public view',async viewer=>{
        jest.resetModules();
        const Core=require('../game/logic/core'),Cards=require('../game/logic/cards');
        const owner=viewer==='black'?'white':'black';
        const profile=level===12?'12-strategy-cpu':level===11?'11-execution-chaos-dragon':'10-observed-dark-dragon';
        Object.assign(runtime,{BLACK:1,WHITE:-1,MATCH_MODE:'cpu',
            cpuSmartness:{[viewer]:profile,[owner]:'9-ending-ash'},
            isProcessing:false,isCardAnimating:false,VisualPlaybackActive:false,
            isGameOver:()=>false,isDebugLogAvailable:()=>false,
            gameState:Core.createGameState(),cardState:Cards.createCardState()});
        runtime.gameState.currentPlayer=owner==='black'?1:-1;runtime.gameState.turnNumber=8;
        runtime.cardState.lastTurnStartedFor=owner;
        runtime.cardState.fateWillControllerByTurnOwner[owner]=viewer;
        runtime.cardState.hands[owner]=['hard_01'];runtime.cardState.hands[viewer]=['ghost_01'];
        const action={type:'use_card',useCardId:'hard_01',useCardHandIndex:0,useCardOwnerKey:owner};
        const advise=jest.fn(async(_request:any)=>({version:'test',action,continuation:[],transitions:1}));
        const other=jest.fn(),applySelection=jest.fn(async(..._args:any[])=>({ok:true}));
        handler=require('../game/cpu-turn-handler');
        handler.setTimers({waitMs:()=>new Promise(()=>{})});
        handler.setCpuUIImpl({
            resolveRuntimeValue:(key:string)=>runtime[key],
            getCpuCardLogic:()=>Cards,setProcessing:(next:boolean)=>{runtime.isProcessing=next;},
            adviseLv10InWorker:other,adviseLv11InWorker:other,adviseLv12InWorker:other,
            [`adviseLv${level}InWorker`]:advise,applyCpuAdvisedSelection:applySelection
        });
        await handler.runCpuTurn(owner,{autoMode:viewer==='black'});
        expect(advise).toHaveBeenCalledTimes(1);expect(other).not.toHaveBeenCalled();
        const request=advise.mock.calls[0][0];
        expect(request.observation.player).toBe(viewer);
        expect(request.observation.cardState.hands[owner]).toEqual(['hard_01']);
        expect(request.observation.cardState.decks).toBeUndefined();
        expect(applySelection).toHaveBeenCalledTimes(1);
        expect(applySelection.mock.calls[0].slice(0,2)).toEqual([owner,action]);
        const record=handler[`getLv${level}DecisionDiagnostics`]().recent.at(-1);
        expect(record).toMatchObject({player:viewer,action,outcome:'applied',source:'worker'});
    });
});
