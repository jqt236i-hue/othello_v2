import * as path from 'path';
const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-onnx-runtime.js'));
const SharedBoardUtils = require(path.resolve(__dirname, '..', 'shared', 'shared-board-utils.js'));

function createRightExpansionBoard(cells) {
  const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
  const gameState = {
    board,
    boardConfig: { rows: 8, cols: 8, shape: 'rectangle' },
    boardExpansion: {
      active: true,
      side: 'right',
      row: Array.isArray(cells) && cells.length ? cells[0].row : 0,
      owner: 0,
      usedByPlayer: { black: false, white: false },
      cells: (cells || []).map((cell) => ({
        side: 'right',
        row: cell.row,
        col: 8,
        owner: cell.owner
      }))
    }
  };
  return SharedBoardUtils.createBoardContext(gameState, null);
}

describe('policy-onnx-runtime', () => {
  beforeEach(() => {
    global.ort = {
      Tensor: function Tensor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    };
    runtime.clearModel();
    runtime.configure({
      enabled: true,
      minLevel: 6,
      sourceUrl: 'data/models/policy-net.onnx',
      metaUrl: 'data/models/policy-net.onnx.meta.json',
      enableWebGpuExecution: false,
      readQuerySearch: null,
      readWebGpuEnabled: null,
      nowMs: null,
      ortApi: global.ort
    });
  });

  afterEach(() => {
    delete global.ort;
  });

  test('chooseMove returns null without loaded model', async () => {
    const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      playerKey: 'white',
      level: 6,
      board: [[0]],
      legalMovesCount: 1
    });
    expect(selected).toBeNull();
  });

  test('loadFromUrl opts into WebGPU from injected query reader', async () => {
    jest.resetModules();
    const create = jest.fn(async () => ({
      inputNames: ['obs'],
      outputNames: ['logits'],
      run: jest.fn()
    }));
    const InferenceSession = function InferenceSession() {};
    InferenceSession.create = create;
    global.ort = {
      Tensor: function Tensor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      },
      InferenceSession
    };
    jest.doMock('onnxruntime-web', () => global.ort);
    const freshRuntime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-onnx-runtime.js'));
    freshRuntime.configure({
      enabled: true,
      minLevel: 6,
      readQuerySearch: () => '?onnxWebGpu=1',
      ortApi: global.ort
    });

    const ok = await freshRuntime.loadFromUrl('model.onnx', 'meta.json', jest.fn(async () => ({ ok: false })));

    expect(ok).toBe(true);
    expect(create).toHaveBeenCalledWith('model.onnx', { executionProviders: ['webgpu', 'wasm'] });
  });

  test('loadFromUrl reconstructs ONNX bytes from chunk manifest', async () => {
    jest.resetModules();
    const create = jest.fn(async () => ({
      inputNames: ['obs'],
      outputNames: ['logits'],
      run: jest.fn()
    }));
    const InferenceSession = function InferenceSession() {};
    InferenceSession.create = create;
    global.ort = {
      Tensor: function Tensor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      },
      InferenceSession
    };
    jest.doMock('onnxruntime-web', () => global.ort);
    const freshRuntime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-onnx-runtime.js'));
    const fetchImpl = jest.fn(async (url) => {
      if (url === 'model.onnx') {
        const manifest = {
          assetType: 'policy_table.chunks.v1',
          sourceBytes: 6,
          chunks: [
            { url: 'model.onnx.chunk.000', bytes: 3 },
            { url: 'model.onnx.chunk.001', bytes: 3 }
          ]
        };
        return {
          ok: true,
          arrayBuffer: async () => Buffer.from(JSON.stringify(manifest), 'utf8')
        };
      }
      if (url === 'model.onnx.chunk.000') {
        return { ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
      }
      if (url === 'model.onnx.chunk.001') {
        return { ok: true, arrayBuffer: async () => Uint8Array.from([4, 5, 6]).buffer };
      }
      if (url === 'meta.json') {
        return {
          ok: true,
          json: async () => ({ inputName: 'obs', outputName: 'logits', schemaVersion: freshRuntime.MODEL_SCHEMA_VERSION })
        };
      }
      return { ok: false };
    });

    const ok = await freshRuntime.loadFromUrl('model.onnx', 'meta.json', fetchImpl);

    expect(ok).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.any(Uint8Array), { executionProviders: ['wasm'] });
    expect(Array.from(create.mock.calls[0][0])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('chooseMove returns null on non-8x8 board even when model is loaded', async () => {
    const scores = new Float32Array(64);
    scores[0] = 5.0;
    runtime.__setLoadedForTest({
      run: jest.fn(async () => ({
        logits: { data: scores }
      }))
    }, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 70
    });

    const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      playerKey: 'white',
      level: 6,
      board: Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => 0)),
      legalMovesCount: 1
    });

    expect(selected).toBeNull();
  });

  test('chooseMove selects move with highest logit among legal candidates', async () => {
    const scores = new Float32Array(64);
    scores[0] = 0.1;  // (0,0)
    scores[9] = 3.2;  // (1,1)
    scores[18] = 2.4; // (2,2)
    const session = {
      run: jest.fn(async () => ({
        logits: { data: scores }
      }))
    };
    runtime.__setLoadedForTest(session, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 70
    });

    const candidates = [
      { row: 0, col: 0, flips: [] },
      { row: 1, col: 1, flips: [] },
      { row: 2, col: 2, flips: [] }
    ];
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    const selected = await runtime.chooseMove(candidates, {
      playerKey: 'white',
      level: 6,
      board,
      legalMovesCount: candidates.length,
      deckCount: 30,
      ownDeckCount: 5,
      initialDeckSize: 30
    });
    expect(selected).toEqual(candidates[1]);
    const obs = session.run.mock.calls[0][0].obs.data;
    expect(obs[68]).toBeCloseTo(30 / 60, 6);
  });

  test('chooseMove uses own-deck ratio when model metadata requests it', async () => {
    const scores = new Float32Array(64);
    scores[0] = 4.5;
    const session = {
      run: jest.fn(async () => ({
        logits: { data: scores }
      }))
    };
    runtime.__setLoadedForTest(session, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 70,
      deckCountFeature: 'own_deck_ratio_v1'
    });

    const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      playerKey: 'white',
      level: 6,
      board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
      legalMovesCount: 1,
      deckCount: 30,
      ownDeckCount: 5,
      initialDeckSize: 30
    });

    expect(selected).toEqual({ row: 0, col: 0, flips: [] });
    const obs = session.run.mock.calls[0][0].obs.data;
    expect(obs[68]).toBeCloseTo(5 / 30, 6);
  });

  test('chooseMove supports padded 10x10 expansion indexes for new models', async () => {
    const scores = new Float32Array(100);
    scores[SharedBoardUtils.toPaddedBoardIndex(0, 0)] = 0.5;
    scores[SharedBoardUtils.toPaddedBoardIndex(0, 8)] = 4.4;
    const session = {
      run: jest.fn(async () => ({
        logits: { data: scores }
      }))
    };
    runtime.__setLoadedForTest(session, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 116,
      baseInputDim: 116,
      outputDim: 100,
      paddedBoardMinCoord: -1,
      paddedBoardMaxCoord: 8,
      paddedBoardSize: 10,
      actionSpace: 'place_padded10+card_choice'
    });

    const board = createRightExpansionBoard([{ row: 0, owner: 0 }]);
    board.gameState.board[0][0] = -1;
    const candidates = [
      { row: 0, col: 0, flips: [] },
      { row: 0, col: 8, flips: [] }
    ];
    const selected = await runtime.chooseMove(candidates, {
      playerKey: 'white',
      level: 6,
      board,
      legalMovesCount: candidates.length
    });

    expect(selected).toEqual(candidates[1]);
    const obs = session.run.mock.calls[0][0].obs.data;
    expect(obs.length).toBe(116);
    expect(obs[0]).toBe(0);
    expect(obs[SharedBoardUtils.toPaddedBoardIndex(0, 0)]).toBe(1);
  });

  test('chooseMove skips padded ONNX when an existing expansion cell is outside its feature envelope', async () => {
    const scores = new Float32Array(100);
    scores[SharedBoardUtils.toPaddedBoardIndex(0, 0)] = 4.4;
    const session = {
      run: jest.fn(async () => ({
        logits: { data: scores }
      }))
    };
    runtime.__setLoadedForTest(session, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 116,
      baseInputDim: 116,
      outputDim: 100,
      paddedBoardMinCoord: -1,
      paddedBoardMaxCoord: 8,
      paddedBoardSize: 10,
      actionSpace: 'place_padded10+card_choice'
    });

    const board = createRightExpansionBoard([{ row: -2, owner: 0 }]);
    expect(SharedBoardUtils.buildBoardTopology(board).existingKeys.has('-2,8')).toBe(true);
    const candidate = { row: 0, col: 0, flips: [] };
    const selected = await runtime.chooseMove([candidate], {
      playerKey: 'white',
      level: 6,
      board,
      legalMovesCount: 1
    });

    expect(selected).toBeNull();
    expect(session.run).not.toHaveBeenCalled();
  });

  test('chooseMove encodes scalar, card, and pending features in a stable vector layout', async () => {
    const scores = new Float32Array(64);
    scores[0] = 1.0;
    const session = {
      run: jest.fn(async () => ({
        logits: { data: scores }
      }))
    };
    runtime.__setLoadedForTest(session, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 124,
      baseInputDim: 116,
      outputDim: 64,
      cardActionIds: ['card_a', 'card_b', 'card_c'],
      pendingTypes: ['DESTROY_ONE_STONE', 'SWAP_WITH_ENEMY']
    });

    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    board[0][0] = 1;
    board[1][1] = -1;

    const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      playerKey: 'white',
      level: 6,
      board,
      legalMovesCount: 3,
      blackCountBefore: 20,
      whiteCountBefore: 10,
      ownCharge: 33,
      oppCharge: 11,
      deckCount: 30,
      ownCornersBefore: 1,
      oppCornersBefore: 2,
      ownEdgesBefore: 3,
      oppEdgesBefore: 4,
      hasCornerMoveNow: true,
      hasEdgeMoveNow: false,
      cornerEmergency: true,
      cornerHoldMode: false,
      highBonusMoveAvailable: true,
      maxLegalMoveBonus: 4,
      handCardIds: ['card_a', 'card_a', 'card_b'],
      usableCardIds: ['card_b'],
      pendingType: 'DESTROY_ONE_STONE'
    });

    expect(selected).toEqual({ row: 0, col: 0, flips: [] });
    const obs = session.run.mock.calls[0][0].obs.data;
    expect(obs.length).toBe(124);
    expect(obs[SharedBoardUtils.toPaddedBoardIndex(0, 0)]).toBe(-1);
    expect(obs[100]).toBeCloseTo(3 / 60, 6);
    expect(obs[101]).toBeCloseTo(-10 / 64, 6);
    expect(obs[102]).toBeCloseTo(33 / 99, 6);
    expect(obs[103]).toBeCloseTo(11 / 99, 6);
    expect(obs[104]).toBeCloseTo(30 / 60, 6);
    expect(obs[105]).toBe(1);
    expect(obs[106]).toBeCloseTo(1 / 4, 6);
    expect(obs[107]).toBeCloseTo(2 / 4, 6);
    expect(obs[108]).toBeCloseTo(3 / 24, 6);
    expect(obs[109]).toBeCloseTo(4 / 24, 6);
    expect(obs[110]).toBe(1);
    expect(obs[111]).toBe(0);
    expect(obs[112]).toBe(1);
    expect(obs[113]).toBe(0);
    expect(obs[114]).toBe(1);
    expect(obs[115]).toBeCloseTo(4 / 5, 6);
    expect(obs[116]).toBeCloseTo(2 / 5, 6);
    expect(obs[117]).toBeCloseTo(1 / 5, 6);
    expect(obs[118]).toBe(0);
    expect(obs[119]).toBe(0);
    expect(obs[120]).toBe(1);
    expect(obs[121]).toBe(0);
    expect(obs[122]).toBe(1);
    expect(obs[123]).toBe(0);
  });

  test('chooseMove returns null on custom boards when using legacy standard-8x8 model metadata', async () => {
    const session = {
      run: jest.fn(async () => ({
        logits: { data: new Float32Array(64) }
      }))
    };
    runtime.__setLoadedForTest(session, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 70
    });

    const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      playerKey: 'white',
      level: 6,
      board: Array.from({ length: 7 }, () => Array.from({ length: 9 }, () => 0)),
      legalMovesCount: 1
    });

    expect(selected).toBeNull();
    expect(session.run).not.toHaveBeenCalled();
  });

  test('choosePendingTarget selects highest score among legal targets', async () => {
    const targetScores = new Float32Array(64);
    targetScores[8] = 0.4;   // (1,0)
    targetScores[27] = 2.9;  // (3,3)
    targetScores[63] = 1.1;  // (7,7)

    runtime.__setTargetModelForTest({
      run: jest.fn(async () => ({
        target_logits: { data: targetScores }
      }))
    }, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      targetOutputName: 'target_logits',
      inputDim: 105,
      pendingTypes: ['DESTROY_ONE_STONE', 'TELEPORT_WILL']
    });

    const targets = [
      { row: 1, col: 0 },
      { row: 3, col: 3 },
      { row: 7, col: 7 }
    ];

    const selected = await runtime.choosePendingTarget(targets, {
      playerKey: 'white',
      level: 6,
      pendingType: 'TELEPORT_WILL',
      board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
      legalMovesCount: 3
    });

    expect(selected).toEqual(targets[1]);
    expect(runtime.getStatus().targetModelLoaded).toBe(true);
  });

  test('choosePendingTarget supports padded expansion targets for new models', async () => {
    const targetScores = new Float32Array(100);
    targetScores[SharedBoardUtils.toPaddedBoardIndex(1, 0)] = 0.4;
    targetScores[SharedBoardUtils.toPaddedBoardIndex(0, 8)] = 3.6;

    runtime.__setTargetModelForTest({
      run: jest.fn(async () => ({
        target_logits: { data: targetScores }
      }))
    }, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      targetOutputName: 'target_logits',
      inputDim: 118,
      baseInputDim: 116,
      outputDim: 100,
      paddedBoardMinCoord: -1,
      paddedBoardMaxCoord: 8,
      paddedBoardSize: 10,
      actionSpace: 'pending_target_padded10',
      pendingTypes: ['DESTROY_ONE_STONE', 'TELEPORT_WILL']
    });

    const board = createRightExpansionBoard([{ row: 0, owner: 0 }]);
    const targets = [
      { row: 1, col: 0 },
      { row: 0, col: 8 }
    ];

    const selected = await runtime.choosePendingTarget(targets, {
      playerKey: 'white',
      level: 6,
      pendingType: 'TELEPORT_WILL',
      board,
      legalMovesCount: 2
    });

    expect(selected).toEqual(targets[1]);
  });

  test('evaluatePosition returns scalar value from value model', async () => {
    runtime.__setValueModelForTest({
      run: jest.fn(async () => ({
        value: { data: new Float32Array([0.625]) }
      }))
    }, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      valueOutputName: 'value',
      inputDim: 80
    });

    const value = await runtime.evaluatePosition({
      playerKey: 'white',
      level: 6,
      board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
      legalMovesCount: 4
    });

    expect(value).toBeCloseTo(0.625, 6);
    expect(runtime.getStatus().valueModelLoaded).toBe(true);
  });

  test('evaluatePosition accepts padded board features for new value models', async () => {
    const session = {
      run: jest.fn(async () => ({
        value: { data: new Float32Array([0.25]) }
      }))
    };
    runtime.__setValueModelForTest(session, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      valueOutputName: 'value',
      inputDim: 116,
      baseInputDim: 116,
      paddedBoardMinCoord: -1,
      paddedBoardMaxCoord: 8,
      paddedBoardSize: 10,
      actionSpace: 'position_value'
    });

    const board = createRightExpansionBoard([{ row: 0, owner: 0 }]);
    board.gameState.board[0][0] = -1;
    const value = await runtime.evaluatePosition({
      playerKey: 'white',
      level: 6,
      board,
      legalMovesCount: 2
    });

    expect(value).toBeCloseTo(0.25, 6);
    expect(session.run.mock.calls[0][0].obs.data.length).toBe(116);
  });

  test('standard board contract overrides legacy padded metadata on every inference entry', async () => {
    const boardInputContract = { schema: 'standard_dense_8x8.v1' };
    const placementScores = new Float32Array(100);
    placementScores[SharedBoardUtils.toPaddedBoardIndex(0, 0)] = 2.5;
    const placementSession = {
      run: jest.fn(async () => ({ logits: { data: placementScores } }))
    };
    runtime.__setLoadedForTest(placementSession, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 116,
      baseInputDim: 116,
      outputDim: 100,
      paddedBoardSize: 10,
      actionSpace: 'place_padded10',
      boardInputContract
    });

    const targetScores = new Float32Array(100);
    targetScores[SharedBoardUtils.toPaddedBoardIndex(0, 0)] = 3.5;
    const targetSession = {
      run: jest.fn(async () => ({ target_logits: { data: targetScores } }))
    };
    runtime.__setTargetModelForTest(targetSession, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      targetOutputName: 'target_logits',
      inputDim: 117,
      baseInputDim: 116,
      outputDim: 100,
      paddedBoardSize: 10,
      actionSpace: 'pending_target_padded10',
      pendingTypes: ['DESTROY_ONE_STONE'],
      boardInputContract
    });

    const valueSession = {
      run: jest.fn(async () => ({ value: { data: new Float32Array([0.75]) } }))
    };
    runtime.__setValueModelForTest(valueSession, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      valueOutputName: 'value',
      inputDim: 116,
      baseInputDim: 116,
      paddedBoardSize: 10,
      actionSpace: 'position_value',
      boardInputContract
    });

    const expandedBoard = createRightExpansionBoard([{ row: 0, owner: 0 }]);
    const candidate = { row: 0, col: 0, flips: [] };
    const expandedContext = {
      playerKey: 'white',
      level: 6,
      board: expandedBoard,
      legalMovesCount: 1,
      pendingType: 'DESTROY_ONE_STONE',
      candidateMoves: [candidate]
    };

    await expect(runtime.runInference(expandedContext)).resolves.toBeNull();
    await expect(runtime.chooseMove([candidate], expandedContext)).resolves.toBeNull();
    await expect(runtime.choosePendingTarget([candidate], expandedContext)).resolves.toBeNull();
    await expect(runtime.evaluatePosition(expandedContext)).resolves.toBeNull();
    expect(placementSession.run).not.toHaveBeenCalled();
    expect(targetSession.run).not.toHaveBeenCalled();
    expect(valueSession.run).not.toHaveBeenCalled();

    const standardBoard = Array.from({ length: 8 }, () => Array(8).fill(0));
    const standardContext = { ...expandedContext, board: standardBoard };
    await expect(runtime.chooseMove([candidate], standardContext)).resolves.toBe(candidate);
    await expect(runtime.choosePendingTarget([candidate], standardContext)).resolves.toBe(candidate);
    await expect(runtime.evaluatePosition(standardContext)).resolves.toBeCloseTo(0.75, 6);
    expect(placementSession.run).toHaveBeenCalledTimes(1);
    expect(targetSession.run).toHaveBeenCalledTimes(1);
    expect(valueSession.run).toHaveBeenCalledTimes(1);

    for (const invalidOwner of [null, Number.NaN, 2, '0']) {
      const malformedBoard = standardBoard.map((row) => row.slice());
      malformedBoard[0][0] = invalidOwner as any;
      const malformedContext = { ...standardContext, board: malformedBoard };
      await expect(runtime.runInference(malformedContext)).resolves.toBeNull();
      await expect(runtime.chooseMove([candidate], malformedContext)).resolves.toBeNull();
      await expect(runtime.choosePendingTarget([candidate], malformedContext)).resolves.toBeNull();
      await expect(runtime.evaluatePosition(malformedContext)).resolves.toBeNull();
    }

    const ringTarget = { row: -1, col: 0, flips: [] };
    await expect(runtime.runInference({
      ...standardContext,
      candidateMoves: [ringTarget]
    })).resolves.toBeNull();
    await expect(runtime.runInference({
      ...standardContext,
      pendingTarget: ringTarget
    })).resolves.toBeNull();
    await expect(runtime.chooseMove([ringTarget], standardContext)).resolves.toBeNull();
    await expect(runtime.choosePendingTarget([ringTarget], standardContext)).resolves.toBeNull();
    expect(placementSession.run).toHaveBeenCalledTimes(1);
    expect(targetSession.run).toHaveBeenCalledTimes(1);
    expect(valueSession.run).toHaveBeenCalledTimes(1);
  });

  test('coordinate target runtime rejects ambiguous direction-aware sockets', async () => {
    const session = {
      run: jest.fn(async () => ({
        target_logits: { data: new Float32Array(100) }
      }))
    };
    runtime.__setTargetModelForTest(session, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      targetOutputName: 'target_logits',
      inputDim: 118,
      baseInputDim: 116,
      outputDim: 100,
      paddedBoardSize: 10,
      actionSpace: 'pending_target_padded10',
      pendingTypes: ['BOARD_EXPANSION_WILL']
    });
    const targets = [
      { row: 0, col: 0, directionKey: 'up' },
      { row: 0, col: 0, directionKey: 'left' }
    ];

    const selected = await runtime.choosePendingTarget(targets, {
      playerKey: 'white',
      level: 6,
      pendingType: 'BOARD_EXPANSION_WILL',
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      legalMovesCount: targets.length
    });

    expect(selected).toBeNull();
    expect(session.run).not.toHaveBeenCalled();
  });

  test('getStatus exposes latency summaries after ONNX calls', async () => {
    const scores = new Float32Array(64);
    scores[0] = 1.25;
    const nowValues = [100, 112];
    runtime.configure({
      nowMs: jest.fn(() => nowValues.shift() ?? 112)
    });
    runtime.__setLoadedForTest({
      run: jest.fn(async () => ({
        logits: { data: scores }
      }))
    }, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 70
    });

    await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      playerKey: 'white',
      level: 6,
      board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
      legalMovesCount: 1
    });

    const status = runtime.getStatus();
    expect(status.latency).toBeTruthy();
    expect(status.latency.overall.count).toBe(1);
    expect(status.latency.overall.totalMs).toBe(12);
    expect(status.latency.perOperation.chooseMove.count).toBe(1);
    expect(status.latency.perOperation.chooseMove.totalMs).toBe(12);
  });
});
