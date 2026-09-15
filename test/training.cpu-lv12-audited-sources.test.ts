import {lv12AuditedTrainingSchedule} from '../training/scripts/fit-cpu-lv12-value';

const schedule=Array.from({length:30},(_,index)=>({id:`${Math.floor(index/2)+1}-${index%2?'white':'black'}`}));
const manifest={spec:{mode:'acceptance',acceptance:'lv12'},schedule};
const full={valid:true,complete:true,completed:30,games:schedule.map(slot=>({slot}))};
const early={...full,complete:false,earlyStopped:true,completed:10,earlyStop:{stop:true},games:full.games.slice(0,10)};

test('training includes every audited first-ten game and records all twenty unstarted slots',()=>{
    expect(lv12AuditedTrainingSchedule(manifest,early)).toEqual({schedule:schedule.slice(0,10),unstarted:schedule.slice(10)});
    expect(lv12AuditedTrainingSchedule(manifest,full)).toEqual({schedule,unstarted:[]});
});

test('training rejects incomplete or selectively chosen recorded games',()=>{
    expect(()=>lv12AuditedTrainingSchedule(manifest,{...early,valid:false})).toThrow('finished audited');
    expect(()=>lv12AuditedTrainingSchedule(manifest,{...early,earlyStopped:false})).toThrow('finished audited');
    expect(()=>lv12AuditedTrainingSchedule(manifest,{...early,completed:9})).toThrow('Invalid audited');
    expect(()=>lv12AuditedTrainingSchedule(manifest,{...early,earlyStop:{stop:false}})).toThrow('Invalid audited');
    expect(()=>lv12AuditedTrainingSchedule(manifest,{...early,games:early.games.slice(1)})).toThrow('full audited schedule');
    expect(()=>lv12AuditedTrainingSchedule(manifest,{...early,games:early.games.slice().reverse()})).toThrow('full audited schedule');
});
