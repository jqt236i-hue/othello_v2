import { compareCpuData, compareCpuModelData, runCpuSearchBenchmarks, runCpuModelBenchmarks } from '../scripts/godot-cpu-benchmark';
import fs = require('node:fs');

test('CPU comparison rejects missing/extra decisions, altered actions and invalid numeric output at an exact path', () => {
    const expected = { records: [{ result: { action: { type: 'place', row: 2, col: 3 }, value: .5 } }] };
    expect(compareCpuData(expected, expected)).toEqual([]);
    const actual = JSON.parse(JSON.stringify(expected)); actual.records[0].result.action.row = 4;
    expect(compareCpuData(expected, actual)).toEqual(['/records/0/result/action/row']);
    expect(compareCpuData(expected, { records: [] })).toContain('/records/0');
    expect(compareCpuData({ value: .5 }, { value: null })).toEqual(['/value']);
    expect(compareCpuData({ value: .5 }, { value: NaN })).toEqual(['/value']);
    expect(compareCpuData({ value: .5 }, { value: .5000001 }, 1e-5)).toEqual([]);
    expect(compareCpuData({ value: .5 }, { value: .51 }, 1e-5)).toEqual(['/value']);
});

test('ONNX tolerance applies only to output tensor values, never chosen coordinates or features', () => {
    const ref = { records: [{ selected: { row: 2 }, runs: [{ input: [1], outputs: { logits: { data: [.5] } } }] }] };
    const near = JSON.parse(JSON.stringify(ref)); near.records[0].runs[0].outputs.logits.data[0] += .000001;
    expect(compareCpuModelData(ref, near)).toEqual([]);
    near.records[0].runs[0].input[0] += .000001;
    expect(compareCpuModelData(ref, near)).toEqual(['/records/0/runs/0/input/0']);
    near.records[0].selected.row += .000001;
    expect(compareCpuModelData(ref, near)).toContain('/records/0/selected/row');
});

test('bounded CPU reference checks every shipped full-rule search without private match state or mutation', () => {
    const report = runCpuSearchBenchmarks(process.cwd(), false, 8);
    expect(report.records).toHaveLength(12);
    expect(report.profiles.map(p => p.level)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13]);
    for (const record of report.records) {
        expect(record.result.transitions).toBeLessThanOrEqual(8);
        expect(record.result.elapsedMs).toBeNull();
        expect(record.observation.prngState).toBeUndefined();
    }
    expect(() => runCpuSearchBenchmarks(process.cwd(), false, 0)).toThrow('transitions');
});

test('missing deployed model fails explicitly before an inference success can be recorded', async () => {
    const actualExists = fs.existsSync;
    const missing = jest.spyOn(fs, 'existsSync').mockImplementation(file => String(file).replace(/\\/g, '/').endsWith('data/models/othello/policy-value.onnx') ? false : actualExists(file));
    try { await expect(runCpuModelBenchmarks()).rejects.toThrow('MODEL_MISSING'); }
    finally { missing.mockRestore(); }
});
