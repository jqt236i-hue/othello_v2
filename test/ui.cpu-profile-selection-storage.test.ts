import {JSDOM} from 'jsdom';
import Selection = require('../ui/cpu-profile-selection');
import Startup = require('../shared/cpu-opponent-startup-options');

test.each([10, 11, 12])('saved Lv%i profiles restore both colors before initial select options and opening perks are created',(level)=>{
    const dom=new JSDOM('<select id="smartBlack"></select><select id="smartWhite"></select>',{url:'http://localhost/'});
    try {
        const doc=dom.window.document;
        expect(Selection.writeStoredCpuProfile('black',level,doc)).toBe(true);
        const profileId = level === 12 ? '12-strategy-cpu' : level === 11 ? '11-execution-chaos-dragon' : '10-observed-dark-dragon';
        expect(Selection.writeStoredCpuProfile('white',profileId,doc)).toBe(true);
        const restored=Selection.readCpuSmartnessFromSelects(doc);
        expect(restored).toEqual({black:profileId,white:profileId});
        expect(Startup.getCpuOpponentStartupOptions(restored.black,'black')).toMatchObject({initialCharge:99,chargeGainMultiplier:2,cardUseUnlockTurnNumber:6});
        expect(Startup.getCpuOpponentStartupOptions(restored.black,'black').deckCardIds)
            .toEqual(Startup.getCpuOpponentStartupOptions(restored.white,'white').deckCardIds);
        doc.getElementById('smartWhite')!.innerHTML='<option value="2" selected>Lv2</option>';
        expect(Selection.readCpuSmartnessFromSelects(doc).white).toBe(2);
    } finally {dom.window.close();}
});

test('unavailable or corrupt preference storage leaves legal default selections available',()=>{
    const dom=new JSDOM('<select id="smartBlack"></select><select id="smartWhite"></select>',{url:'http://localhost/'});
    try {
        const doc=dom.window.document;
        dom.window.localStorage.setItem(Selection.CPU_PROFILE_STORAGE_KEY,JSON.stringify({black:'unknown',white:300}));
        expect(Selection.readCpuSmartnessFromSelects(doc)).toEqual({black:1,white:1});
        Object.defineProperty(dom.window,'localStorage',{get:()=>{throw new Error('Storage denied');}});
        expect(Selection.writeStoredCpuProfile('black',10,doc)).toBe(false);
        expect(Selection.readCpuSmartnessFromSelects(doc)).toEqual({black:1,white:1});
    } finally {dom.window.close();}
});
