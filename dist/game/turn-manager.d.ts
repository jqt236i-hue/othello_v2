export const __uiImpl_turn_manager: any;
export const cpuSmartness: {
    black: number;
    white: number;
} | undefined;
export function resetGame(): void;
/**
 * ターン開始処理
 * Turn Start Logic coordination
 * @param {number} player - BLACK (1) or WHITE (-1)
 */
export function onTurnStart(player: number): Promise<{
    playbackEvents: any[];
}>;
export function handleCellClick(row: any, col: any): void;
export function isAnimationInProgress(): any;
export function setUIImpl(obj: any): void;
export class setUIImpl {
    constructor(obj: any);
    __uiImpl_turn_manager: any;
}
export function startActionSaveInterval(): void;
export function stopActionSaveInterval(): void;
export function watchdogPing(nowMs: any): void;
export function canLocalUserOperateCurrentTurn(): boolean;
export function setTurnManagerTimerService(service: any): void;
export function requestUIRender(): void;
//# sourceMappingURL=turn-manager.d.ts.map