import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import { replaceProductionCheckpoint, runProductionGame, type ProductionGameSpec } from '../scripts/run-production-selfplay';
import { verifyProductionSelfplay } from '../scripts/verify-production-selfplay';
import {recoverCpuExperiment} from '../scripts/recover-cpu-experiment';

let directory: string;
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'production-selfplay-test-')); });

// Test runs keep their journals for diagnosis; no recursive cleanup of a path
// computed from environment or test output is necessary.
function spec(name: string): ProductionGameSpec {
    const policy = { root: process.cwd(), module: 'game/ai/cpu-lv10-search', search: 'searchLv10', config: 'LV10_SEARCH_CONFIG', maxTransitions: 8 };
    return { seed: 20260914, out: path.join(directory, name), profiles: { black: 10, white: 10 },
        policies: { black: policy, white: policy }, maxDecisions: 1000, timeoutMs: 120000 };
}

test('a durable stop resumes with the same state and decision memory and does not duplicate moves', async () => {
    const stopFile = path.join(directory, 'stop.json');
    const firstSpec = { ...spec('first'), stopFile };
    const first = await runProductionGame(firstSpec, (_record, count) => {
        if (count === 3) fs.writeFileSync(stopFile, '{}');
    });
    expect(first.status).toBe('stopped'); expect(first.decisions).toBe(3);
    const checkpoint = path.join(firstSpec.out, 'checkpoint.json');
    const resumed = await runProductionGame({ ...spec('resumed'), resumeFrom: checkpoint });
    expect(resumed.status).toBe('complete');
    const uninterrupted = await runProductionGame(spec('uninterrupted'));
    expect(resumed.result).toEqual(uninterrupted.result);
    expect(resumed.finalStateHash).toEqual(uninterrupted.finalStateHash);
    expect(resumed.decisions).toBe(uninterrupted.decisions);
    const audit = verifyProductionSelfplay(path.join(directory, 'resumed'));
    expect(audit).toMatchObject({ valid: true, status: 'complete', decisions: resumed.decisions });
    expect(audit.decisionRecords).toHaveLength(resumed.decisions);
    expect(verifyProductionSelfplay(path.join(directory, 'uninterrupted'))).toMatchObject({ valid: true, status: 'complete', decisions: uninterrupted.decisions });
    const rows = fs.readFileSync(path.join(directory, 'resumed/steps.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(rows[1].index).toBe(4);
    expect(new Set(rows.slice(1).map(row => row.index)).size).toBe(rows.length - 1);
    await expect(runProductionGame({ ...spec('duplicate'), resumeFrom: path.join(directory, 'resumed/checkpoint.json') })).rejects.toThrow('Resume checkpoint');
// Two complete games each retain their 120-second limit; the encompassing
// test also performs both replay audits and must allow their combined work.
}, 300000);

test('changed decision budgets cannot resume a prior declared game', async () => {
    const stopFile = path.join(directory, 'stop.json'); fs.writeFileSync(stopFile, '{}');
    const first = spec('first'); await runProductionGame({ ...first, stopFile });
    const next = spec('next'); next.policies.black = { ...next.policies.black, maxTransitions: 16 };
    await expect(runProductionGame({ ...next, resumeFrom: path.join(first.out, 'checkpoint.json') })).rejects.toThrow('Resume checkpoint');
});

test('a fractional transition budget is rejected before creating a game attempt', async () => {
    const game = spec('fractional'); game.policies.black = { ...game.policies.black, maxTransitions: 1.5 };
    await expect(runProductionGame(game)).rejects.toThrow('Transition budget must be an integer');
    expect(fs.existsSync(game.out)).toBe(false);
});

test('a transient checkpoint replacement lock retries the same bytes without replaying any action',async()=>{
    const target=path.join(directory,'checkpoint.json'),pending=path.join(directory,'checkpoint.pending.json');
    fs.writeFileSync(target,'old');fs.writeFileSync(pending,'new');
    const original=fs.renameSync;
    let targetAttempts=0;
    const rename=jest.spyOn(fs,'renameSync').mockImplementation((from,to)=>{
        if(from===pending&&to===target&&++targetAttempts===1){
            throw Object.assign(new Error('reader lock'),{code:'EPERM'});
        }
        return original(from,to);
    });
    const retries:any[]=[];
    try{
        await replaceProductionCheckpoint(pending,target,(code,attempt)=>retries.push({code,attempt}));
        expect(retries).toEqual([{code:'EPERM',attempt:1}]);expect(targetAttempts).toBe(2);
        expect(fs.readFileSync(target,'utf8')).toBe('new');expect(fs.existsSync(pending)).toBe(false);
    }finally{rename.mockRestore();}
});

test('process disappearance recovery replays the durable prefix, preserves bytes and refuses a live owner',async()=>{
    const first=spec('lost'),stopFile=path.join(directory,'stop.json');
    await runProductionGame({...first,stopFile},(_record,count)=>{if(count===3)fs.writeFileSync(stopFile,'{}');});
    fs.renameSync(path.join(first.out,'result.json'),path.join(first.out,'simulated-preloss-result.json'));
    const processFile=path.join(directory,'processes.json');
    const history=[{slot:'one',pid:process.pid,output:first.out,startedAt:'2026-09-14T00:00:00Z'}];
    fs.writeFileSync(processFile,JSON.stringify(history));
    expect(()=>recoverCpuExperiment(directory,'simulated process loss')).toThrow('still exists');
    history[0].pid=2147483647;fs.writeFileSync(processFile,JSON.stringify(history));
    const journal=fs.readFileSync(path.join(first.out,'steps.ndjson'));
    const checkpoint=fs.readFileSync(path.join(first.out,'checkpoint.json'));
    const recovered=recoverCpuExperiment(directory,'simulated process loss');
    expect(recovered.attempts[0]).toMatchObject({slot:'one',decisions:3,replay:{valid:true}});
    expect(fs.readFileSync(path.join(first.out,'steps.ndjson'))).toEqual(journal);
    expect(fs.readFileSync(path.join(first.out,'checkpoint.json'))).toEqual(checkpoint);
    expect(JSON.parse(fs.readFileSync(processFile,'utf8'))[0]).toMatchObject({code:null,interruption:{kind:'process-loss'}});
    expect(verifyProductionSelfplay(first.out)).toMatchObject({valid:true,status:'stopped',decisions:3});
},120000);

test('confirmed simultaneous termination preserves original exits and refuses CPU errors or a selected subset',async()=>{
    const stopAt='2026-09-15T05:34:59.259Z',exitCode=1073807364;
    const history:any[]=[],saved:any[]=[];
    for(let index=0;index<2;index++){
        const game=spec(`terminated-${index}`),stopFile=path.join(directory,`fixture-stop-${index}.json`);
        await runProductionGame({...game,stopFile},(_record,count)=>{if(count===3)fs.writeFileSync(stopFile,'{}');});
        fs.renameSync(path.join(game.out,'result.json'),path.join(game.out,'simulated-pretermination-result.json'));
        fs.writeFileSync(game.out+'.stderr.log','');
        history.push({slot:`slot-${index}`,pid:2147483647-index,output:game.out,
            startedAt:'2026-09-15T05:30:00.000Z',finishedAt:stopAt,code:exitCode});
        saved.push({journal:fs.readFileSync(path.join(game.out,'steps.ndjson')),checkpoint:fs.readFileSync(path.join(game.out,'checkpoint.json'))});
    }
    const processFile=path.join(directory,'processes.json');
    const saveHistory=()=>fs.writeFileSync(processFile,JSON.stringify(history));
    saveHistory();fs.writeFileSync(path.join(directory,'stop-request.json'),JSON.stringify({requestedAt:stopAt,reason:'owner signal'}));
    expect(()=>recoverCpuExperiment(directory,'observed termination')).toThrow('No unfinished process records');
    expect(()=>recoverCpuExperiment(directory,'ordinary CPU error',{confirmedTerminationExitCode:1})).toThrow('Unsupported termination');
    history[1].code=1;saveHistory();
    expect(()=>recoverCpuExperiment(directory,'subset must fail',{confirmedTerminationExitCode:exitCode})).toThrow('every failed process');
    history[1].code=exitCode;saveHistory();
    fs.writeFileSync(history[1].output+'.stderr.log','Error: CPU failed\n');
    expect(()=>recoverCpuExperiment(directory,'CPU stderr must fail',{confirmedTerminationExitCode:exitCode})).toThrow('CPU failure inspection');
    fs.writeFileSync(history[1].output+'.stderr.log','');
    fs.writeFileSync(path.join(history[1].output,'failure.json'),'{}');
    expect(()=>recoverCpuExperiment(directory,'saved failure must fail',{confirmedTerminationExitCode:exitCode})).toThrow('saved result/CPU failure');
    expect(history.every(entry=>!fs.existsSync(path.join(entry.output,'result.json')))).toBe(true);
    fs.unlinkSync(path.join(history[1].output,'failure.json'));
    const recovered=recoverCpuExperiment(directory,'both owners externally terminated; initiating actor unknown',{confirmedTerminationExitCode:exitCode});
    expect(recovered.attempts).toHaveLength(2);
    const report=JSON.parse(fs.readFileSync(recovered.recoveryFile,'utf8'));
    expect(report.originalProcessHistory).toEqual(history);
    expect(report.terminationEvidence.exitCode).toBe(exitCode);
    for(const [index,entry] of JSON.parse(fs.readFileSync(processFile,'utf8')).entries()){
        expect(entry).toMatchObject({code:null,interruption:{kind:'process-loss',originalExit:{code:exitCode,finishedAt:stopAt}}});
        expect(fs.readFileSync(path.join(entry.output,'steps.ndjson'))).toEqual(saved[index].journal);
        expect(fs.readFileSync(path.join(entry.output,'checkpoint.json'))).toEqual(saved[index].checkpoint);
        expect(verifyProductionSelfplay(entry.output)).toMatchObject({valid:true,status:'stopped',decisions:3});
    }
},120000);
