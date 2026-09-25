import { makeExperimentSchedule, summarizeExperiment, experimentEarlyStop, LV13_ACCEPTANCE,
    type ExperimentSpec } from '../scripts/cpu-experiment-protocol';

const policy = {root:'.',module:'game/ai/cpu-lv13-search',search:'searchLv13',config:'LV13_SEARCH_CONFIG'};
const spec:ExperimentSpec = {label:'lv13-protocol-test',mode:'acceptance',acceptance:'lv13',out:'.',
    paired:10,blackOnly:0,whiteOnly:10,concurrency:4,candidate:policy,opponent:policy};

test('Lv13 fixes twenty unused conditions and the required seat order before results',()=>{
    const result=makeExperimentSchedule(spec,new Set());
    expect(result.conditions).toHaveLength(20);
    expect(result.schedule).toHaveLength(30);
    expect(result.schedule.filter(s=>s.candidateColor==='white')).toHaveLength(20);
    expect(result.schedule.slice(0,10).filter(s=>s.candidateColor==='white')).toHaveLength(7);
    expect(result.schedule.slice(10).filter(s=>s.candidateColor==='white')).toHaveLength(13);
    expect(result.conditions.filter(c=>c.kind==='paired')).toHaveLength(10);
    expect(makeExperimentSchedule({...spec,concurrency:1},new Set())).toEqual(result);
    expect(()=>makeExperimentSchedule(spec,new Set([result.conditions[19].seed]))).toThrow('already issued');
    expect(()=>makeExperimentSchedule({...spec,concurrency:5},new Set())).toThrow('at most four');
});

test('four losses stop only after all first ten finish; draws are not losses',()=>{
    const {schedule}=makeExperimentSchedule(spec,new Set());
    const scores=schedule.slice(0,10).map((slot,index)=>({id:slot.id,initialSha256:'same',
        winner:index<3 ? (slot.candidateColor==='black'?'white':'black') as 'black'|'white' : 'draw' as const}));
    expect(experimentEarlyStop(schedule,scores,LV13_ACCEPTANCE)).toMatchObject({ready:true,stop:false,losses:3});
    scores[3].winner=schedule[3].candidateColor==='black'?'white':'black';
    expect(experimentEarlyStop(schedule,scores.slice(0,9),LV13_ACCEPTANCE)).toMatchObject({ready:false,stop:false});
    expect(experimentEarlyStop(schedule,scores,LV13_ACCEPTANCE)).toMatchObject({ready:true,stop:true,losses:4});
});

test('twenty-four wins fail, twenty-five wins pass the strength tally',()=>{
    const {schedule,conditions}=makeExperimentSchedule(spec,new Set());
    for(const wins of [24,25]){
        const scores=schedule.map((slot,index)=>({id:slot.id,initialSha256:'same',
            winner:index<wins?slot.candidateColor:'draw' as const}));
        const result=summarizeExperiment(spec,conditions,schedule,scores);
        expect(result.wins).toBe(wins);
        expect(result.winRate).toBe(wins/30);
        expect(result.meetsWinGate).toBe(wins>=25);
        expect(result).toMatchObject({complete:true});
    }
});
