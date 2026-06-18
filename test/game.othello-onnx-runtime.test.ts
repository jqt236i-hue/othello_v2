import * as path from 'path';

describe('othello-onnx-runtime', () => {
  beforeEach(() => {
    global.ort = {
      Tensor: function Tensor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    } as any;
  });

  afterEach(() => {
    delete (global as any).ort;
  });

  test('loadFromUrl reconstructs chunked ONNX asset before session create', async () => {
    jest.resetModules();
    const create = jest.fn(async () => ({
      inputNames: ['obs'],
      outputNames: ['logits', 'value'],
      run: jest.fn()
    }));
    const InferenceSession = function InferenceSession() {} as any;
    InferenceSession.create = create;
    (global as any).ort = {
      Tensor: function Tensor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      },
      InferenceSession
    };
    jest.doMock('onnxruntime-web', () => (global as any).ort);
    const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'othello-onnx-runtime.ts'));
    runtime.clearModel();
    runtime.configure({
      enabled: true,
      minLevel: 6,
      ortApi: (global as any).ort
    });

    const fetchImpl = jest.fn(async (url) => {
      if (url === 'othello-model.onnx') {
        const manifest = {
          assetType: 'policy_table.chunks.v1',
          sourceBytes: 4,
          chunks: [
            { url: 'othello-model.onnx.chunk.000', bytes: 2 },
            { url: 'othello-model.onnx.chunk.001', bytes: 2 }
          ]
        };
        return {
          ok: true,
          arrayBuffer: async () => Buffer.from(JSON.stringify(manifest), 'utf8')
        };
      }
      if (url === 'othello-model.onnx.chunk.000') {
        return { ok: true, arrayBuffer: async () => Uint8Array.from([9, 8]).buffer };
      }
      if (url === 'othello-model.onnx.chunk.001') {
        return { ok: true, arrayBuffer: async () => Uint8Array.from([7, 6]).buffer };
      }
      if (url === 'meta.json') {
        return {
          ok: true,
          json: async () => ({ inputName: 'obs', placeOutputName: 'logits', valueOutputName: 'value' })
        };
      }
      return { ok: false };
    });

    const ok = await runtime.loadFromUrl('othello-model.onnx', 'meta.json', fetchImpl);

    expect(ok).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.any(Uint8Array), { executionProviders: ['wasm'] });
    expect(Array.from(create.mock.calls[0][0])).toEqual([9, 8, 7, 6]);
    expect(runtime.getStatus().loaded).toBe(true);
  });

  test('chooseMove uses exact endgame solve before ONNX inference', async () => {
    jest.resetModules();
    const session = {
      inputNames: ['obs'],
      outputNames: ['logits', 'value'],
      run: jest.fn(async () => ({
        logits: { data: new Float32Array(64) },
        value: { data: new Float32Array([0]) }
      }))
    };
    const InferenceSession = function InferenceSession() {} as any;
    InferenceSession.create = jest.fn(async () => session);
    (global as any).ort = {
      Tensor: function Tensor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      },
      InferenceSession
    };
    jest.doMock('onnxruntime-web', () => (global as any).ort);
    const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'othello-onnx-runtime.ts'));
    runtime.clearModel();
    const exactSolveNowMs = jest.fn(() => 1000);
    runtime.configure({
      enabled: true,
      minLevel: 6,
      exactSolveEmpties: 1,
      exactSolveNowMs,
      ortApi: (global as any).ort
    });
    const ok = await runtime.loadFromUrl('model.onnx', 'meta.json', jest.fn(async () => ({ ok: false })));
    expect(ok).toBe(true);

    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => -1));
    board[7][6] = 1;
    board[7][7] = 0;
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(9999);
    let selected;
    try {
      selected = await runtime.chooseMove([{ row: 7, col: 7, flips: [{ row: 7, col: 6 }] }], {
        board,
        playerKey: 'white',
        level: 6,
        legalMovesCount: 1
      });
      expect(dateSpy).not.toHaveBeenCalled();
    } finally {
      dateSpy.mockRestore();
    }

    expect(selected).toEqual({ row: 7, col: 7, flips: [{ row: 7, col: 6 }] });
    expect(exactSolveNowMs).toHaveBeenCalled();
    expect(session.run).not.toHaveBeenCalled();
    expect(runtime.getStatus().inferenceCalls).toBe(0);
  });

  test('configure nowMs controls ONNX inference latency status', async () => {
    jest.resetModules();
    const scores = new Float32Array(64);
    scores[0] = 2;
    const session = {
      inputNames: ['obs'],
      outputNames: ['logits', 'value'],
      run: jest.fn(async () => ({
        logits: { data: scores },
        value: { data: new Float32Array([0]) }
      }))
    };
    const InferenceSession = function InferenceSession() {} as any;
    InferenceSession.create = jest.fn(async () => session);
    (global as any).ort = {
      Tensor: function Tensor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      },
      InferenceSession
    };
    jest.doMock('onnxruntime-web', () => (global as any).ort);
    const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'othello-onnx-runtime.ts'));
    runtime.clearModel();
    const nowValues = [200, 234];
    runtime.configure({
      enabled: true,
      minLevel: 6,
      useValueRerank: false,
      exactSolveEmpties: 0,
      nowMs: jest.fn(() => nowValues.shift() ?? 234),
      ortApi: (global as any).ort
    });
    const ok = await runtime.loadFromUrl('model.onnx', 'meta.json', jest.fn(async () => ({ ok: false })));
    expect(ok).toBe(true);

    const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
      playerKey: 'white',
      level: 6,
      legalMovesCount: 1
    });

    expect(selected).toEqual({ row: 0, col: 0, flips: [] });
    const status = runtime.getStatus();
    expect(status.inferenceCalls).toBe(1);
    expect(status.inferenceAverageMs).toBe(34);
    expect(status.inferenceMaxMs).toBe(34);
  });
});
