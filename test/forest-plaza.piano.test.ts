import { PIANO_SONGS, songNotes, songDuration, midiFrequency, pianoDistanceGain } from '../browser-vite/forest-plaza/activities/pianoSynth';
describe('森の広場 ピアノの楽譜', () => {
  test.each(PIANO_SONGS)('$id は40〜70秒のメロディと伴奏', song => {
    expect(songDuration(song)).toBeGreaterThanOrEqual(40); expect(songDuration(song)).toBeLessThanOrEqual(70);
    const notes = songNotes(song); expect(notes).toHaveLength(112); expect(notes.every(n => n.duration > 0 && n.velocity > 0 && n.velocity <= 1)).toBe(true);
    expect(Math.max(...notes.map(n => n.time + n.duration))).toBeLessThan(songDuration(song));
  });
  test('木漏れ日の冒頭は C5 E5 G5 E5 / D5 F5 A5 F5、四分音符', () => {
    const melody = songNotes(PIANO_SONGS[0]).filter(n => n.velocity >= 0.67).slice(0, 8);
    expect(melody.map(n => n.midi)).toEqual([72,76,79,76,74,77,81,77]);
    expect(melody.map(n => n.time)).toEqual([0,.75,1.5,2.25,3,3.75,4.5,5.25]);
    expect(songNotes(PIANO_SONGS[0]).slice(0, 2).map(n => n.midi)).toEqual([48,72]);
  });
  test('ランタンはA短調、苔の庭はG長調の独立した冒頭', () => {
    expect(songNotes(PIANO_SONGS[1]).filter(n => n.velocity >= .67).slice(0,4).map(n=>n.midi)).toEqual([69,72,76,72]);
    expect(songNotes(PIANO_SONGS[2]).filter(n => n.velocity >= .67).slice(0,4).map(n=>n.midi)).toEqual([67,71,74,71]);
  });
  test('MIDI調律はA4=440Hz、C5=523.251Hz', () => { expect(midiFrequency(69)).toBe(440); expect(midiFrequency(72)).toBeCloseTo(523.251, 2); });
  test('距離減衰は単調で遠方にもかすかに届く', () => {
    expect(pianoDistanceGain(0)).toBe(1); expect(pianoDistanceGain(-1)).toBe(1);
    const gains = [0,2,5,10,30,100].map(pianoDistanceGain); expect(gains).toEqual([...gains].sort((a,b)=>b-a)); expect(gains[5]).toBeGreaterThan(.08);
  });
});
