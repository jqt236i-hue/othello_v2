import { auditExperimentProcesses, makeExperimentSchedule, summarizeExperiment, experimentEarlyStop, runExperimentSchedule,
    LV12_ACCEPTANCE, type ExperimentSpec } from '../scripts/cpu-experiment-protocol';
import { lv12PolicyFingerprint } from '../scripts/run-cpu-experiment';
import fs = require('node:fs');

test('formal candidate identity includes changed sampling/model helpers',()=>{
    const bytes:Record<string,string>={'cpu-lv12-search.js':'search','cpu-lv12-evaluation.js':'value','cpu-lv12-scenarios.js':'prior1'};
    const list=jest.spyOn(fs,'readdirSync').mockReturnValue(Object.keys(bytes) as any);
    const read=jest.spyOn(fs,'readFileSync').mockImplementation(file=>Buffer.from(bytes[String(file).split(/[\\/]/).pop()!]));
    try{
        const before=lv12PolicyFingerprint('.');
        expect(before.files.map(file=>file.name)).toContain('cpu-lv12-scenarios.js');
        bytes['cpu-lv12-scenarios.js']='prior2';
        expect(lv12PolicyFingerprint('.').sha256).not.toBe(before.sha256);
    }finally{read.mockRestore();list.mockRestore();}
});

const policy = { root: '.', module: 'game/ai/cpu-lv12-search', search: 'searchLv12', config: 'LV12_SEARCH_CONFIG' };
const spec: ExperimentSpec = { label: 'lv12-protocol-test', mode: 'acceptance', acceptance: 'lv12', out: '.',
    paired: 15, blackOnly: 0, whiteOnly: 0, concurrency: 4, candidate: policy, opponent: policy };

test('Lv12 reserves 15 unused pairs, and the first ten are five complete color-balanced pairs', () => {
    const result = makeExperimentSchedule(spec, new Set());
    expect(result.conditions).toHaveLength(15);
    expect(result.schedule).toHaveLength(30);
    expect(result.schedule.filter(slot => slot.candidateColor === 'black')).toHaveLength(15);
    const first = result.schedule.slice(0,10);
    expect(first.filter(slot => slot.candidateColor === 'black')).toHaveLength(5);
    expect(new Set(first.map(slot => slot.condition)).size).toBe(5);
    expect(() => makeExperimentSchedule(spec, new Set([result.conditions[14].seed]))).toThrow('already issued');
    expect(() => makeExperimentSchedule({...spec, concurrency: 5}, new Set())).toThrow('at most four');
    expect(makeExperimentSchedule({...spec, concurrency: 1}, new Set())).toEqual(result);
});

test('audited development replay keeps all first-ten pairs in their original order and cannot become a formal redraw',()=>{
    const original=makeExperimentSchedule(spec,new Set()).schedule.slice(0,10);
    const used=new Set(original.map(slot=>slot.seed));
    const replay={...spec,mode:'development' as const,paired:5,
        developmentReplayOf:{manifest:'previous/manifest.json',audit:'previous/audit.json'}};
    const result=makeExperimentSchedule(replay,used,original);
    expect(result.schedule).toEqual(original);
    expect(result.schedule).not.toBe(original);
    expect(result.conditions).toHaveLength(5);
    expect(()=>makeExperimentSchedule({...spec,developmentReplayOf:replay.developmentReplayOf},used,original)).toThrow('only be replayed');
    expect(()=>makeExperimentSchedule(replay,used)).toThrow('audited source evidence');
    expect(()=>makeExperimentSchedule(replay,new Set(),original)).toThrow('unissued');
    expect(()=>makeExperimentSchedule(replay,used,original.slice(0,8))).toThrow('all five');
    const duplicate=original.map(slot=>({...slot}));duplicate[1].candidateColor=duplicate[0].candidateColor;
    expect(()=>makeExperimentSchedule(replay,used,duplicate)).toThrow('replay pair');
});

test('independent process audit detects a fifth simultaneous match and an early eleventh launch', () => {
    const {schedule}=makeExperimentSchedule(spec,new Set());
    const base=Date.parse('2026-09-14T00:00:00Z');
    const history=schedule.map((slot,index)=>({slot:slot.id,code:0,
        startedAt:new Date(base+index*100).toISOString(),finishedAt:new Date(base+index*100+50).toISOString()}));
    expect(auditExperimentProcesses(spec,schedule,history).peakConcurrentGames).toBe(1);
    const overlapping=history.map((row,index)=>index<5?{...row,finishedAt:new Date(base+550).toISOString()}:row);
    expect(()=>auditExperimentProcesses(spec,schedule,overlapping)).toThrow('Concurrent game limit');
    const premature=history.map((row,index)=>index===0?{...row,finishedAt:new Date(base+1050).toISOString()}:row);
    expect(()=>auditExperimentProcesses(spec,schedule,premature)).toThrow('Eleventh game');
});

test('exactly four losses in the declared first ten stop Lv12; a draw is not a loss', () => {
    const {schedule} = makeExperimentSchedule(spec, new Set());
    const scores = schedule.map((slot,i) => ({id:slot.id, initialSha256:String(slot.seed),
        winner:i<4 ? (slot.candidateColor === 'black' ? 'white' as const : 'black' as const) : slot.candidateColor}));
    expect(experimentEarlyStop(schedule, scores.slice(0,9), LV12_ACCEPTANCE).ready).toBe(false);
    expect(experimentEarlyStop(schedule, scores.slice(0,10).reverse(), LV12_ACCEPTANCE)).toMatchObject({ready:true,losses:4,stop:true});
    const drawn = scores.map((row,i) => i===3 ? {...row,winner:'draw' as const} : row);
    expect(experimentEarlyStop(schedule, drawn, LV12_ACCEPTANCE)).toMatchObject({ready:true,losses:3,stop:false});
});

test.each([24,25])('Lv12 requires 25 actual wins across all thirty, wins=%s', wins => {
    const {conditions,schedule} = makeExperimentSchedule(spec,new Set());
    const scores = schedule.map((slot,i) => ({id:slot.id,initialSha256:String(slot.seed),winner:i<wins ? slot.candidateColor : 'draw' as const}));
    const result = summarizeExperiment(spec,conditions,schedule,scores);
    expect(result.winRate).toBe(wins/30);
    expect(result.meetsWinGate).toBe(wins>=25);
    expect(summarizeExperiment(spec,conditions,schedule,scores.slice(0,29)).meetsWinGate).toBe(false);
});

test('Lv12 barrier waits for all ten specified slots before any remaining slot starts', async () => {
    const {schedule} = makeExperimentSchedule(spec,new Set());
    let running=0,peak=0; const started:string[]=[],finished:string[]=[];
    await runExperimentSchedule(spec,schedule,async slot => {
        running++; peak=Math.max(peak,running); started.push(slot.id);
        await new Promise(resolve=>setTimeout(resolve,slot.id===schedule[0].id?25:1));
        running--;finished.push(slot.id);
    },()=>false,()=>{
        expect(running).toBe(0);expect(started).toEqual(schedule.slice(0,10).map(slot=>slot.id));
        expect(finished).toHaveLength(10);return false;
    });
    expect(peak).toBe(4);expect(started).toHaveLength(10);
});
