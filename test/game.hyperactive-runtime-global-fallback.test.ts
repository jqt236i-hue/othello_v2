import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as vm from 'vm';

function transpileCommonJs(sourcePath: string): string {
  const source = fs.readFileSync(sourcePath, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    }
  }).outputText;
}

function runCommonJsModuleInSandbox(sourcePath: string, sandbox: any): any {
  sandbox.module = { exports: {} };
  sandbox.exports = sandbox.module.exports;
  vm.runInContext(transpileCommonJs(sourcePath), sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

function loadHyperactiveWithWorkerLikeGlobals(): any {
  const boardShapePath = path.resolve(__dirname, '..', 'game', 'logic', 'cards', 'hyperactive-board-shape.ts');
  const sourcePath = path.resolve(__dirname, '..', 'game', 'logic', 'cards', 'hyperactive.ts');
  const sandbox: any = {
    console,
    module: { exports: {} },
    exports: {},
    require: () => {
      throw new Error('require is unavailable in this worker-like runtime');
    }
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.SharedConstants = { BLACK: 1, WHITE: -1, EMPTY: 0 };

  vm.createContext(sandbox);
  runCommonJsModuleInSandbox(boardShapePath, sandbox);
  return runCommonJsModuleInSandbox(sourcePath, sandbox);
}

describe('CardHyperactive worker runtime globals', () => {
  test('uses preloaded global constants when require is unavailable', () => {
    const CardHyperactive = loadHyperactiveWithWorkerLikeGlobals();
    const gameState: any = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    gameState.board[2][3] = 1;
    gameState.board[4][4] = -1;
    const cardState: any = {
      markers: [{
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: {
          type: 'ESCAPE_HYPERACTIVE',
          remainingOwnerTurns: 5
        }
      }]
    };

    const result = CardHyperactive.processHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      2,
      3,
      { random: () => 0 },
      { expectedSpecialType: 'ESCAPE_HYPERACTIVE' }
    );

    expect(result.moved).toHaveLength(1);
    expect(result.destroyed).toEqual([]);
    expect(gameState.board[2][3]).toBe(0);
    expect(cardState.markers[0]).toEqual(expect.objectContaining({ row: 1, col: 2 }));
    expect(gameState.board[1][2]).toBe(1);
  });
});
