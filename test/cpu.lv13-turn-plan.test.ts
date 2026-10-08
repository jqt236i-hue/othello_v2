import {searchLv13} from '../game/ai/cpu-lv13-search';
import {sampleLv10Position,applyLv10Action,currentLv10Player} from '../game/ai/cpu-lv10-position';
import {runLv10Turn,type Lv10PlanMemory} from '../game/cpu-lv10-turn';
const corner=require('./fixtures/cpu-lv13-keep-relocation-corner.json');

// Self-play position (turn 19, white): buoyancy card, its target, then the
// placement. One searched turn of three actions.
function setup(){
    // A different seed from the search worlds: the live hidden state is unknown.
    let state=sampleLv10Position(corner.observation,7,corner.publicRecipes);
    const plan:Lv10PlanMemory={expectedIdentity:null,continuation:[],turnBudgetMs:4600,turnIdentity:null,spentMs:0};
    const memory={identity:null as string|null,actions:[] as any[],plan};
    const requests:any[]=[],results:any[]=[],applied:any[]=[];
    let reject=false;
    const deps={getState:()=>state,getPublicRecipes:()=>corner.publicRecipes,isCurrent:()=>true,rejectedActions:memory,
        advise:async(request:any)=>{
            requests.push(request);
            const result=searchLv13(request.observation,{publicRecipes:request.publicRecipes,excludedActions:request.excludedActions,maxTransitions:512});
            results.push(result);
            return JSON.parse(JSON.stringify(result));
        },
        apply:async(action:any)=>{
            if(reject)return false;
            const result=applyLv10Action(state,action);
            if(result.ok){state=result.state;applied.push(action);}
            return result;
        }};
    const turn=state.gameState.turnNumber;
    const inTurn=()=>currentLv10Player(state)==='white'&&state.gameState.turnNumber===turn;
    return {deps,plan,requests,results,applied,inTurn,
        get state(){return state;},set state(next){state=next;},setReject(value:boolean){reject=value;}};
}

test('the searched turn is followed: one search for the card, its target and the placement',async()=>{
    const t=setup();
    const records=[];
    while(t.inTurn()&&records.length<8)records.push(await runLv10Turn('white',t.deps));
    expect(t.requests).toHaveLength(1);
    expect(t.requests[0].maxMs).toBe(4600);
    const searched=t.results[0];
    expect(searched.continuation.length).toBeGreaterThanOrEqual(2);
    expect(t.applied).toEqual([searched.action,...searched.continuation]);
    expect(records.map(record=>!!record.followedPlan)).toEqual([false,...searched.continuation.map(()=>true)]);
    expect(records.every(record=>record.outcome==='applied')).toBe(true);
},120000);

test('a public change the plan did not predict is searched again with the rest of the turn budget',async()=>{
    const t=setup();
    await runLv10Turn('white',t.deps);
    expect(t.plan.continuation.length).toBeGreaterThan(0);
    // The opponent's hand grew: the observation differs from the predicted one.
    t.state.cardState.hands.black.push('destroy_01');
    t.state.cardState.handCostAdjustmentsByPlayer?.black?.push(null);
    const spentBefore=t.plan.spentMs;
    expect(spentBefore).toBeGreaterThan(0);
    const second=await runLv10Turn('white',t.deps);
    expect(second.followedPlan).toBeUndefined();
    expect(t.requests).toHaveLength(2);
    expect(t.requests[1].maxMs).toBeCloseTo(Math.max(100,4600-spentBefore),5);
    expect(t.requests[1].maxMs).toBeLessThan(4600);
},120000);

test('a rejected planned action drops the plan and the next step searches',async()=>{
    const t=setup();
    await runLv10Turn('white',t.deps);
    t.setReject(true);
    const rejected=await runLv10Turn('white',t.deps);
    expect(rejected).toMatchObject({followedPlan:true,outcome:'rejected'});
    expect(t.plan).toMatchObject({expectedIdentity:null,continuation:[]});
    t.setReject(false);
    const next=await runLv10Turn('white',t.deps);
    expect(next.followedPlan).toBeUndefined();
    expect(t.requests).toHaveLength(2);
},120000);
