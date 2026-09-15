import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import childProcess = require('node:child_process');
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Reuse every completed game from a verified source, including a failed
 * formal first-ten gate. Never fill an unstarted slot or choose its winners. */
export function lv12AuditedTrainingSchedule(manifest:any,audit:any){
    if(audit.valid!==true||(!audit.complete&&!audit.earlyStopped))throw new Error('Training requires a finished audited source');
    const early=audit.earlyStopped===true;
    if(early&&(manifest.spec?.mode!=='acceptance'||manifest.spec?.acceptance!=='lv12'
        ||audit.completed!==10||audit.earlyStop?.stop!==true))throw new Error('Invalid audited first-ten source');
    const schedule=early?manifest.schedule.slice(0,10):manifest.schedule;
    if(!Array.isArray(audit.games)||audit.games.length!==schedule.length
        ||schedule.some((slot:any,index:number)=>audit.games[index]?.slot?.id!==slot.id)){
        throw new Error('Training source does not cover its full audited schedule');
    }
    return {schedule,unstarted:early?manifest.schedule.slice(10):[]};
}

/** Audited, completed historical games only. Match seeds identify held-out
 * groups; they and the authoritative private state are never model inputs. */
export function exportLv12ValueDataset(specFile:string,output:string,smoke=false){
    if(fs.existsSync(output))throw new Error('Dataset output already exists');
    // The existing training CLI build emits into dist/scripts with a separate
    // rootDir. Load the already-built canonical runtime, without pulling game
    // source into that CLI compilation or duplicating its feature logic.
    const {extractLv12ValueFeatures,LV12_VALUE_FEATURE_NAMES,LV12_PRIOR_VALUE_WEIGHTS}
        =require(path.resolve('dist/game/ai/cpu-lv12-evaluation'));
    const {createLv12ScenarioSampler}=require(path.resolve('dist/game/ai/cpu-lv12-scenarios'));
    const spec=read(specFile),games:any[]=[],rows:any[]=[],sourceReports:any[]=[];
    const seen=new Set<string>();
    for(const source of spec.sources){
        const manifestFile=path.join(source.directory,'manifest.json'),manifest=read(manifestFile),audit=read(source.audit);
        if(audit.manifestSha256!==sha(manifestFile))throw new Error('Missing matching complete journal audit');
        const {schedule,unstarted}=lv12AuditedTrainingSchedule(manifest,audit);
        sourceReports.push({directory:path.resolve(source.directory),auditFile:path.resolve(source.audit),
            auditSha256:sha(source.audit),scheduled:manifest.schedule.length,completed:schedule.length,
            unstarted:unstarted.map((slot:any)=>slot.id),reason:unstarted.length?'Verified formal first-ten stop; unstarted games are not training observations':null});
        for(const slot of schedule){
            const gameDir=path.join(source.directory,'games',slot.id);
            const attempts=fs.readdirSync(gameDir).filter(name=>/^attempt-\d+$/.test(name));
            if(attempts.length!==1)throw new Error('Training input with resumed attempts requires explicit deduplication');
            const directory=path.join(gameDir,attempts[0]),result=read(path.join(directory,'result.json'));
            if(result.status!=='complete')throw new Error('Incomplete training game');
            const id=path.resolve(directory),gameManifest=read(path.join(directory,'manifest.json'));
            if(seen.has(id))throw new Error('Duplicate training game');seen.add(id);
            const journal=path.join(directory,'steps.ndjson'),bytes=fs.readFileSync(journal,'utf8');
            if(!bytes.endsWith('\n'))throw new Error('Truncated training journal');
            const decisions=bytes.trimEnd().split('\n').map(line=>JSON.parse(line)).filter(row=>row.kind==='decision');
            const startup=require(path.join(manifest.commonRoot,'dist/shared/cpu-opponent-startup-options'));
            const recipes=Object.fromEntries(['black','white'].map(player=>[player,
                startup.getCpuOpponentDeckCardIds(gameManifest.identity.profiles[player])]));
            const group=String(slot.seed),first=rows.length;
            for(const row of (smoke?decisions.slice(0,12):decisions)){
                const observation=JSON.parse(row.memories[row.player].identity);
                if(observation.player!==row.player)throw new Error('Wrong observation owner');
                const policyRoot=gameManifest.identity.policies[row.player].spec.root;
                const projected=require(path.join(policyRoot,'dist/game/ai/cpu-lv10-observation')).observeLv10Position(
                    row.transitions.find((step:any)=>step.kind==='action').before,row.player);
                if(JSON.stringify(projected)!==row.memories[row.player].identity)throw new Error('Training input is not the permitted public projection');
                require(path.join(policyRoot,'dist/game/ai/cpu-lv10-advisor-contract')).parseLv10AdvisorRequest({observation});
                // A deterministic hypothetical sample derived exclusively from
                // the player's public observation, exactly as in search.
                const sampled=createLv12ScenarioSampler(observation,[100901,100909,100913],recipes).sample(0);
                const x:number[]=extractLv12ValueFeatures(sampled,row.player);
                if(x.length!==LV12_VALUE_FEATURE_NAMES.length||x.some(value=>!Number.isFinite(value)))throw new Error('Invalid feature vector');
                rows.push({game:games.length,group,index:row.index,x,
                    y:result.result.winner==='draw'?.5:result.result.winner===row.player?1:0});
            }
            games.push({id,group,rows:rows.length-first,winner:result.result.winner,
                journalSha256:sha(journal),auditFile:path.resolve(source.audit),auditSha256:sha(source.audit)});
            if(smoke)break;
        }
        if(smoke)break;
    }
    const dataset={schema:'cpu-lv12-value-dataset.v1',createdAt:new Date().toISOString(),smoke,
        featureNames:LV12_VALUE_FEATURE_NAMES,priorWeights:LV12_PRIOR_VALUE_WEIGHTS,games,rows,sourceReports,
        sourceSpec:{path:path.resolve(specFile),sha256:sha(specFile),exclusions:spec.exclusions||[]},
        inputContract:'Features from public observation and isolated hypothetical world only; seed is grouping metadata',
        weighting:'Each completed game has equal total weight; paired colors share the same validation fold'};
    fs.writeFileSync(output,JSON.stringify(dataset),{flag:'wx'});
    return {output,games:games.length,groups:new Set(games.map(game=>game.group)).size,rows:rows.length,sha256:sha(output)};
}

if(require.main===module){try{main();}catch(error){console.error(error);process.exitCode=1;}}

export function main(){
    const [mode,input,output,option]=process.argv.slice(2);
    if(mode==='export')console.log(JSON.stringify(exportLv12ValueDataset(input,output,option==='--smoke')));
    else if(mode==='fit'){
        const data=read(input);
        if(data.schema!=='cpu-lv12-value-dataset.v1'||data.smoke||data.games.length<16)throw new Error('Training preflight requires a complete dataset with at least 16 games');
        const result=childProcess.spawnSync(path.resolve('.venv/Scripts/python.exe'),
            [path.resolve('training/python/fit_cpu_lv12_value.py'),path.resolve(input),path.resolve(output)],{stdio:'inherit'});
        if(result.status!==0)throw new Error('Value trainer failed');
    }else throw new Error('Usage: fit-cpu-lv12-value export|fit input output [--smoke]');
}
