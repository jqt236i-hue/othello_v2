import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as Phases from '../game/turn/turn_pipeline_phases.js';

const prng = { shuffle: (items: any[]) => items, random: () => 0 };

function createStates() {
  const cardState = CardLogic.createCardState(prng);
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  cardState.debugNoDraw = true;
  cardState.charge.black = 0;
  cardState.charge.white = 0;
  return { cardState, gameState };
}

function addWork(cardState: any, gameState: any, row: number, col: number, remaining = 2, stage = 3, owner = 'black') {
  gameState.board[row][col] = owner === 'black' ? Core.BLACK : Core.WHITE;
  CardLogic.addMarker(cardState, 'specialStone', row, col, owner, {
    type: 'WORK', ownerColor: owner, remainingOwnerTurns: remaining, workStage: stage
  });
  return cardState.markers.find((marker: any) => marker.row === row && marker.col === col && marker.data.type === 'WORK');
}

function start(cardState: any, gameState: any, logic: any = CardLogic) {
  const events: any[] = [];
  Phases.applyTurnStartPhase(logic, Core, cardState, gameState, 'black', events, prng);
  return events;
}

function incomeEvents(cardState: any) {
  return cardState.presentationEvents.filter((event: any) => event.type === 'WORK_INCOME');
}

describe('出稼ぎの開始処理は治癒後の固定登場順キューで解決する', () => {
  test('キューを持たない旧単独開始APIでも既存の収入処理を維持する', () => {
    const { cardState, gameState } = createStates();
    const work = addWork(cardState, gameState, 3, 3);

    CardLogic.onTurnStart(cardState, 'black', gameState, prng);

    expect(cardState.charge.black).toBe(8);
    expect(work.data.remainingOwnerTurns).toBe(1);
    expect(incomeEvents(cardState)).toHaveLength(1);
  });

  test('残り1でも既存の治癒+3を先に受け、収入後も残り3で存続する', () => {
    const { cardState, gameState } = createStates();
    const work = addWork(cardState, gameState, 3, 3, 1, 4);
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, null, { type: 'HEALING_CELL', remainingTurns: 8 });

    const events = start(cardState, gameState);

    expect(cardState.markers).toContain(work);
    expect(work.data.remainingOwnerTurns).toBe(3);
    expect(work.data.workStage).toBe(0);
    expect(cardState.charge.black).toBe(16);
    expect(events).toContainEqual(expect.objectContaining({ type: 'water_duration_added_start' }));
    const incomeIndex = cardState.presentationEvents.findIndex((event: any) => event.type === 'WORK_INCOME');
    const tickIndex = cardState.presentationEvents.findIndex((event: any) => event.type === 'STATUS_TICK' && event.meta?.timer === 3);
    expect(incomeIndex).toBeGreaterThanOrEqual(0);
    expect(tickIndex).toBeGreaterThan(incomeIndex);
  });

  test('先に登場した爆弾で失われた個体からは収入も減算も発生しない', () => {
    const { cardState, gameState } = createStates();
    gameState.board[3][3] = Core.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: -10
    });
    const work = addWork(cardState, gameState, 3, 4);

    start(cardState, gameState);

    expect(gameState.board[3][4]).toBe(Core.EMPTY);
    expect(cardState.markers).not.toContain(work);
    expect(cardState.charge.black).toBe(0);
    expect(incomeEvents(cardState)).toHaveLength(0);
    expect(work.data.remainingOwnerTurns).toBe(2);
  });

  test('出稼ぎが先に登場していれば収入後に後続爆弾が爆発し、演出も同順になる', () => {
    const { cardState, gameState } = createStates();
    addWork(cardState, gameState, 3, 4);
    gameState.board[3][3] = Core.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: -10
    });

    start(cardState, gameState);

    expect(cardState.charge.black).toBe(8);
    expect(gameState.board[3][4]).toBe(Core.EMPTY);
    const incomeIndex = cardState.presentationEvents.findIndex((event: any) => event.type === 'WORK_INCOME');
    const destroyIndex = cardState.presentationEvents.findIndex((event: any) => event.type === 'DESTROY');
    expect(incomeIndex).toBeGreaterThanOrEqual(0);
    expect(destroyIndex).toBeGreaterThan(incomeIndex);
  });

  test('配列順ではなくcreatedSeqで個体ごとに収入を解決する', () => {
    const { cardState, gameState } = createStates();
    const first = addWork(cardState, gameState, 1, 1, 2, 3);
    const second = addWork(cardState, gameState, 5, 5, 2, 4);
    cardState.markers.reverse();
    cardState.charge.black = 90;

    start(cardState, gameState);

    expect(incomeEvents(cardState).map((event: any) => [event.row, event.col, event.gained])).toEqual([
      [1, 1, 8], [5, 5, 1]
    ]);
    expect(first.data.remainingOwnerTurns).toBe(1);
    expect(second.data.remainingOwnerTurns).toBe(1);
  });

  test('開始中に消滅した個体を同じ座標の新個体に置き換えても、その開始では発動しない', () => {
    const { cardState, gameState } = createStates();
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: -10
    });
    const oldWork = addWork(cardState, gameState, 3, 4);
    let replacement: any;
    let generated: any;
    const logic = {
      ...CardLogic,
      tickBombAt: () => {
        cardState.markers = cardState.markers.filter((marker: any) => marker !== oldWork);
        replacement = addWork(cardState, gameState, 3, 4);
        generated = addWork(cardState, gameState, 5, 5);
        return {};
      }
    };

    start(cardState, gameState, logic);

    expect(cardState.charge.black).toBe(0);
    expect(incomeEvents(cardState)).toHaveLength(0);
    expect(replacement.data.remainingOwnerTurns).toBe(2);
    expect(generated.data.remainingOwnerTurns).toBe(2);
  });

  test('凍結中と相手所有の出稼ぎは収入・持続減算をしない', () => {
    const { cardState, gameState } = createStates();
    const frozen = addWork(cardState, gameState, 2, 2);
    const opponent = addWork(cardState, gameState, 5, 5, 2, 3, 'white');
    CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'white', { type: 'FREEZE', remainingOwnerTurns: 5 });

    start(cardState, gameState);

    expect(cardState.charge.black).toBe(0);
    expect(cardState.charge.white).toBe(0);
    expect(frozen.data.remainingOwnerTurns).toBe(2);
    expect(opponent.data.remainingOwnerTurns).toBe(2);
  });

  test('寿命終了時の収入と終了演出は1回だけ発生し石の色は維持する', () => {
    const { cardState, gameState } = createStates();
    const work = addWork(cardState, gameState, 3, 3, 1, 4);

    start(cardState, gameState);
    start(cardState, gameState);

    expect(cardState.charge.black).toBe(16);
    expect(cardState.markers).not.toContain(work);
    expect(gameState.board[3][3]).toBe(Core.BLACK);
    expect(incomeEvents(cardState)).toEqual([
      expect.objectContaining({ gained: 16, removed: true, reason: 'duration_end' })
    ]);
  });
});
