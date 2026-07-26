import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_ROOT = path.join(REPO_ROOT, 'training', 'python');
const PYTHON = process.env.PYTHON || 'python';
const STANDARD_BOARD = [
  '........',
  '........',
  '........',
  '...WB...',
  '...BW...',
  '........',
  '........',
  '........'
].join('/');

function readPython(fileName: string) {
  return fs.readFileSync(path.join(PYTHON_ROOT, fileName), 'utf8');
}

function runBoardContractProbe(records: object[]) {
  const script = [
    'import json, pathlib, sys, types',
    'repo_root = pathlib.Path(sys.argv[1])',
    'records = json.loads(sys.argv[2])',
    'torch_stub = types.ModuleType("torch")',
    'torch_nn_stub = types.ModuleType("torch.nn")',
    'torch_nn_stub.Module = object',
    'torch_stub.nn = torch_nn_stub',
    'torch_stub.optim = types.SimpleNamespace(Optimizer=object)',
    'sys.modules["torch"] = torch_stub',
    'sys.modules["torch.nn"] = torch_nn_stub',
    'sys.path.insert(0, str(repo_root / "training" / "python"))',
    'import onnx_trainer_common as common',
    'diagnostics = common.BoardInputFilterDiagnostics()',
    'results = []',
    'for record in records:',
    '    result = diagnostics.inspect(record)',
    '    results.append({"accepted": result.accepted, "reason": result.reason})',
    'require_error = None',
    'try:',
    '    common.require_standard_dense_board_record(records[1])',
    'except ValueError as error:',
    '    require_error = str(error)',
    'all_filtered = common.BoardInputFilterDiagnostics()',
    'all_filtered.inspect(records[1])',
    'all_filtered_error = None',
    'try:',
    '    common.raise_no_training_records("no training records", all_filtered)',
    'except ValueError as error:',
    '    all_filtered_error = str(error)',
    'resume_contracts = {}',
    'resume_payloads = {',
    '    "matching": {"formatVersion": 1, "model_state": {}, "modelConfig": {"boardInputContract": {"schema": common.BOARD_INPUT_CONTRACT_SCHEMA}}},',
    '    "plain_state_dict": {"layer.weight": 1},',
    '    "missing_format_version": {"model_state": {}, "modelConfig": {"boardInputContract": {"schema": common.BOARD_INPUT_CONTRACT_SCHEMA}}},',
    '    "unsupported_format_version": {"formatVersion": 2, "model_state": {}, "modelConfig": {"boardInputContract": {"schema": common.BOARD_INPUT_CONTRACT_SCHEMA}}},',
    '    "boolean_format_version": {"formatVersion": True, "model_state": {}, "modelConfig": {"boardInputContract": {"schema": common.BOARD_INPUT_CONTRACT_SCHEMA}}},',
    '    "missing_model_config": {"formatVersion": 1, "model_state": {}},',
    '    "missing_contract": {"formatVersion": 1, "model_state": {}, "modelConfig": {}},',
    '    "mismatch": {"formatVersion": 1, "model_state": {}, "modelConfig": {"boardInputContract": {"schema": "legacy.v0"}}},',
    '}',
    'for name, payload in resume_payloads.items():',
    '    try:',
    '        common.require_resume_board_input_contract(payload, f"{name}.pt")',
    '        resume_contracts[name] = "accepted"',
    '    except ValueError as error:',
    '        resume_contracts[name] = str(error)',
    'print(json.dumps({',
    '    "results": results,',
    '    "diagnostics": diagnostics.to_meta(),',
    '    "requireError": require_error,',
    '    "allFilteredError": all_filtered_error,',
    '    "meta": common.build_board_input_contract_meta(),',
    '    "resumeContracts": resume_contracts,',
    '}))'
  ].join('\n');

  return spawnSync(PYTHON, ['-c', script, REPO_ROOT, JSON.stringify(records)], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
}

function runCardLoaderProbe() {
  const script = [
    'import json, os, pathlib, sys, tempfile, types',
    'from types import SimpleNamespace',
    'repo_root = pathlib.Path(sys.argv[1])',
    'class _Scalar:',
    '    def __init__(self, value): self._value = value',
    '    def item(self): return self._value',
    'class _Tensor:',
    '    def __init__(self, values): self._values = values',
    '    def __ne__(self, other): return _Tensor([value != other for value in self._values])',
    '    def __getitem__(self, key):',
    '        if isinstance(key, _Tensor):',
    '            return _Tensor([value for value, include in zip(self._values, key._values) if include])',
    '        return self._values[key]',
    '    def sum(self): return _Scalar(sum(self._values))',
    '    def tolist(self): return list(self._values)',
    'torch_stub = types.ModuleType("torch")',
    'torch_nn_stub = types.ModuleType("torch.nn")',
    'torch_functional_stub = types.ModuleType("torch.nn.functional")',
    'torch_nn_stub.Module = object',
    'torch_nn_stub.functional = torch_functional_stub',
    'torch_stub.nn = torch_nn_stub',
    'torch_stub.Tensor = _Tensor',
    'torch_stub.float32 = "float32"',
    'torch_stub.long = "long"',
    'torch_stub.optim = types.SimpleNamespace(Optimizer=object)',
    'torch_stub.tensor = lambda values, dtype=None: _Tensor(values)',
    'sys.modules["torch"] = torch_stub',
    'sys.modules["torch.nn"] = torch_nn_stub',
    'sys.modules["torch.nn.functional"] = torch_functional_stub',
    'sys.path.insert(0, str(repo_root / "training" / "python"))',
    'import train_policy_onnx as base',
    'import train_card_onnx as card',
    `board = ${JSON.stringify(STANDARD_BOARD)}`,
    'valid = {',
    '    "board": board, "boardEnvelope": board, "boardMinRow": 0, "boardMinCol": 0,',
    '    "actionType": "use_card", "useCardId": "free_01",',
    '    "usableCardIds": ["free_01"], "player": "black", "outcome": 1,',
    '}',
    'invalid_board = board.replace(".", "#", 1)',
    'invalid = dict(valid, board=invalid_board, boardEnvelope=invalid_board)',
    'handle = tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", suffix=".ndjson")',
    'try:',
    '    handle.write(json.dumps(valid) + "\\n" + json.dumps(invalid) + "\\n")',
    '    handle.close()',
    '    args = SimpleNamespace(',
    '        input=handle.name, winner_sample_boost=0, loser_sample_weight=1,',
    '        draw_sample_weight=1, corner_emergency_sample_boost=0,',
    '        negative_future_disc_sample_boost=0, negative_future_disc_threshold=-1,',
    '        tactical_miss_sample_boost=0, tactical_miss_threshold=0.08,',
    '        hand_pressure_sample_boost=0, pending_target_sample_boost=0,',
    '    )',
    '    data = card.load_card_dataset(args)',
    '    print(json.dumps({',
    '        "trainRecords": data.train_records,',
    '        "cardLabel": data.y_card[0],',
    '        "ignoreIndex": base.IGNORE_INDEX,',
    '        "filter": data.board_input_filter,',
    '    }))',
    'finally:',
    '    if not handle.closed: handle.close()',
    '    os.unlink(handle.name)'
  ].join('\n');

  return spawnSync(PYTHON, ['-c', script, REPO_ROOT], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
}

describe('ONNX trainer standard board input contract', () => {
  test('accepts only authoritative zero-origin dense 8x8 boardEnvelope records', () => {
    const valid = {
      board: STANDARD_BOARD,
      boardEnvelope: STANDARD_BOARD,
      boardMinRow: 0,
      boardMinCol: 0
    };
    const records = [
      valid,
      { ...valid, board: 'poisoned legacy board' },
      { board: STANDARD_BOARD, boardMinRow: 0, boardMinCol: 0 },
      { boardEnvelope: STANDARD_BOARD, boardMinRow: 0, boardMinCol: 0 },
      { ...valid, boardMinRow: -1 },
      { ...valid, boardMinCol: '0' },
      {
        ...valid,
        board: `${STANDARD_BOARD}/........`,
        boardEnvelope: `${STANDARD_BOARD}/........`
      },
      {
        ...valid,
        board: STANDARD_BOARD.replace('........', '.......'),
        boardEnvelope: STANDARD_BOARD.replace('........', '.......')
      },
      {
        ...valid,
        board: STANDARD_BOARD.replace('.', '#'),
        boardEnvelope: STANDARD_BOARD.replace('.', '#')
      },
      {
        ...valid,
        board: STANDARD_BOARD.replace('.', 'X'),
        boardEnvelope: STANDARD_BOARD.replace('.', 'X')
      },
      ['not', 'a', 'record']
    ];
    const result = runBoardContractProbe(records);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout.trim());
    expect(payload.results).toEqual([
      { accepted: true, reason: null },
      { accepted: false, reason: 'board_mirror_mismatch' },
      { accepted: false, reason: 'missing_board_envelope' },
      { accepted: false, reason: 'missing_board_mirror' },
      { accepted: false, reason: 'nonzero_or_invalid_origin' },
      { accepted: false, reason: 'nonzero_or_invalid_origin' },
      { accepted: false, reason: 'row_count_not_8' },
      { accepted: false, reason: 'column_count_not_8' },
      { accepted: false, reason: 'non_playable_cell' },
      { accepted: false, reason: 'unknown_cell_character' },
      { accepted: false, reason: 'record_not_object' }
    ]);
    expect(payload.diagnostics).toMatchObject({
      contract: 'standard_dense_8x8.v1',
      recordsChecked: records.length,
      acceptedRecords: 1,
      rejectedRecords: records.length - 1
    });
    expect(payload.requireError).toContain('board_mirror_mismatch');
    expect(payload.allFilteredError).toContain('all 1 input records were rejected');
    expect(payload.meta.boardInputContract).toMatchObject({
      authoritativeField: 'boardEnvelope',
      requiredMirrorField: 'board',
      requiredOrigin: { row: 0, col: 0 },
      rows: 8,
      cols: 8,
      legacyBoardFallback: false
    });
    expect(payload.resumeContracts.matching).toBe('accepted');
    expect(payload.resumeContracts.plain_state_dict).toContain('versioned trainer payload');
    expect(payload.resumeContracts.missing_format_version).toContain('formatVersion must be 1');
    expect(payload.resumeContracts.unsupported_format_version).toContain('actual=2');
    expect(payload.resumeContracts.boolean_format_version).toContain('actual=True');
    expect(payload.resumeContracts.missing_model_config).toContain('actual=missing');
    expect(payload.resumeContracts.missing_contract).toContain('actual=missing');
    expect(payload.resumeContracts.mismatch).toContain('actual=legacy.v0');
  });

  test.each([
    ['train_policy_onnx.py', 'place_t = place_target_index(rec)'],
    ['train_target_onnx.py', 'target_t = target_index(rec)'],
    ['train_value_onnx.py', 'target = value_target('],
    ['policy_trainer_cnn.py', 'place_t = place_target_index(rec)'],
    ['train_deepcfr_onnx.py', 'if not is_supported_action(rec):']
  ])('%s filters topology before labels and features', (fileName, firstConsumer) => {
    const source = readPython(fileName);
    const filterIndex = source.indexOf('if not board_input_diagnostics.inspect(rec).accepted:');
    const consumerIndex = source.indexOf(firstConsumer, filterIndex);

    expect(filterIndex).toBeGreaterThanOrEqual(0);
    expect(consumerIndex).toBeGreaterThan(filterIndex);
    expect(source).toContain('boardInputFilter');
    expect(source).toContain('build_board_input_contract_meta()');
  });

  test('direct feature builders reject non-contract boards and targets stay inside 8x8', () => {
    const flat = readPython('train_policy_onnx.py');
    const cnn = readPython('policy_trainer_cnn.py');

    expect(flat).toContain('return trainer_common.require_standard_dense_board_record(rec), 0, 0');
    expect(cnn).toContain('rows = trainer_common.require_standard_dense_board_record(rec)');
    expect(flat).toContain('if row < 0 or row >= BOARD_SIZE or col < 0 or col >= BOARD_SIZE:');
    expect(flat).not.toContain('has_shape_aware_board');
  });

  test('card specialist explicitly asks the shared loader for card labels', () => {
    const source = readPython('train_card_onnx.py');
    const loadStart = source.indexOf('def load_card_dataset(');
    const loadEnd = source.indexOf('\ndef train_model(', loadStart);
    const loader = source.slice(loadStart, loadEnd);

    expect(loader).toContain('include_card_labels=True');
    expect(loader).toContain('board_input_filter=source.board_input_filter');

    const result = runCardLoaderProbe();
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout.trim());
    expect(payload.trainRecords).toBe(1);
    expect(payload.cardLabel).not.toBe(payload.ignoreIndex);
    expect(payload.filter).toMatchObject({
      acceptedRecords: 1,
      rejectedRecords: 1,
      rejectionReasons: { non_playable_cell: 1 }
    });
  });

  test('all trainers require matching board contracts when resuming', () => {
    for (const fileName of [
      'train_policy_onnx.py',
      'train_card_onnx.py',
      'train_target_onnx.py',
      'train_value_onnx.py',
      'policy_trainer_cnn.py'
    ]) {
      expect(readPython(fileName)).toContain(
        'expected_board_input_contract=trainer_common.BOARD_INPUT_CONTRACT_SCHEMA'
      );
    }
    const deepCfr = readPython('train_deepcfr_onnx.py');
    const readIndex = deepCfr.indexOf('trainer_common.read_resume_checkpoint(');
    const validateIndex = deepCfr.indexOf(
      'trainer_common.require_resume_board_input_contract(',
      readIndex
    );
    const loadIndex = deepCfr.indexOf('model.load_state_dict(state)', readIndex);
    expect(readIndex).toBeGreaterThanOrEqual(0);
    expect(validateIndex).toBeGreaterThan(readIndex);
    expect(loadIndex).toBeGreaterThan(validateIndex);
  });

  test('coordinate-only target head excludes direction-aware expansion sockets', () => {
    const source = readPython('train_target_onnx.py');
    const listStart = source.indexOf('TARGET_PENDING_TYPES = [');
    const listEnd = source.indexOf(']\\nPENDING_TYPE_INDEX', listStart);
    const pendingTypes = source.slice(listStart, listEnd);

    expect(pendingTypes).not.toContain('"BOARD_EXPANSION_WILL"');
    expect(pendingTypes).not.toContain('"BOARD_EXPANSION_GOD"');
    expect(pendingTypes).toContain('direction-aware heuristic lane');
  });
});
