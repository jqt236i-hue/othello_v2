import {countLv13StableStones,LV13_VALUE_FEATURE_NAMES} from '../game/ai/cpu-lv13-evaluation';

// 8x8 board from rows of '.', 'X' (black, +1) and 'O' (white, -1).
const board=(rows:string[])=>{
    const owners=new Map<string,number>();
    const cells:{row:number;col:number}[]=[];
    rows.forEach((line,row)=>[...line].forEach((ch,col)=>{
        if(ch==='#')return; // hole / outside the board
        cells.push({row,col});
        owners.set(`${row},${col}`,ch==='X'?1:ch==='O'?-1:0);
    }));
    return {owners,cells};
};
const E='........';
const count=(rows:string[])=>{const {owners,cells}=board(rows);return countLv13StableStones(owners,cells);};

test('the stable-stone features are the last two Lv13 features',()=>{
    expect(LV13_VALUE_FEATURE_NAMES.slice(-2)).toEqual(['stable','stableEnd']);
});

test('corners and edge runs anchored to a corner are stable, floating edge runs are not',()=>{
    expect(count([E,E,E,E,E,E,E,E])).toBe(0);
    expect(count(['X.......',E,E,E,E,E,E,E])).toBe(1);
    expect(count(['XXX.....',E,E,E,E,E,E,E])).toBe(3);
    expect(count(['XXXO....',E,E,E,E,E,E,E])).toBe(3);
    expect(count(['.XXX....',E,E,E,E,E,E,E])).toBe(0);
    expect(count(['O......O',E,E,E,E,E,E,E])).toBe(-2);
});

test('inner stones need every line covered: a corner triangle is stable, a 2x2 block leaves its inner stone open',()=>{
    expect(count(['XXXX....','XXX.....','XX......','X.......',E,E,E,E])).toBe(10);
    // (1,1) can still be flipped along the anti-diagonal through (0,2) and (2,0).
    expect(count(['XX......','XX......',E,E,E,E,E,E])).toBe(3);
    expect(count(['XX......','X.X.....',E,E,E,E,E,E])).toBe(3);
});

test('a completely filled line protects its stones along that line',()=>{
    expect(count(['XXXXXOOO',E,E,E,E,E,E,E])).toBe(2);
    expect(count(['XXXXOOOO',E,E,E,E,E,E,E])).toBe(0);
});

test('holes and irregular boards act as walls',()=>{
    // A hole next to the stone closes the horizontal line like the board edge would.
    expect(count(['#X......',E,E,E,E,E,E,E])).toBe(1);
    expect(count(['.X......','#.......',E,E,E,E,E,E])).toBe(0);
});
