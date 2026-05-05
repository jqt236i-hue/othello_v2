declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file log-messages.js
 * @description Centralized log message templates for UI/animation flows.
 */

// Keep wording consistent across the UI.
const LOG_MESSAGES: Record<string, (...args: any[]) => string> = {
    silverCharge: (gain: number) => `銀の意志：布石 +${gain}（3倍）`,
    goldCharge: (gain: number) => `金の意志：布石 +${gain}（4倍）`,
    rainbowCharge: (gain: number) => `虹の意志：布石 +${gain}（6倍）`,
    crystalCharge: (gain: number) => gain > 0 ? `水晶の意志：数字マス布石 +${gain}（4倍）` : '水晶の意志：数字マスなしで増加なし',
    plunderPoints: (amount: number) => `吸収：${amount}ポイントを吸収`,

    protectNext: (ownerName: string) => `${ownerName}: 次の石を保護`,
    permaProtectNext: (ownerName: string) => `${ownerName}: 次の石を永続保護`,
    timeBombPlaced: (ownerName: string) => `⏱️ ${ownerName}: 時限爆弾を設置（6→5...）`,
    dragonPlaced: (ownerName: string) => `🐉 ${ownerName}: 究極反転龍を配置`,
    destroyDragonPlaced: (ownerName: string) => `🔥 ${ownerName}: 破壊龍を配置`,
    udgPlaced: (ownerName: string) => `💥 ${ownerName}: 究極破壊神を配置`,
    ultimateHyperactivePlaced: (ownerName: string) => `${ownerName}: 究極多動神を配置`,
    hyperactivePlaced: (ownerName: string) => `${ownerName}: 多動の意志を配置`,
    extremeHyperactivePlaced: (ownerName: string) => `${ownerName}: 極悪多動魔を配置`,
    escapeHyperactivePlaced: (ownerName: string) => `${ownerName}: 逃げる意志を配置`,

    doublePlaceActivated: (label: string, remaining: number, infinite: boolean) => {
        const safeLabel = (typeof label === 'string' && label.trim()) ? label.trim() : '二連投石';
        if (infinite === true) return `${safeLabel}発動：合法手が尽きるまで置ける`;
        const safeRemaining = Number.isFinite(Number(remaining)) ? Math.max(0, Math.trunc(Number(remaining))) : 1;
        return `${safeLabel}発動：このターンあと${safeRemaining}回置ける`;
    },
    destroySelectPrompt: () => '破壊対象を選んでください (石のあるマスのみ)',
    swapSelectPrompt: () => '交換対象（相手の石）を選んでください',
    normalStoneSelectPrompt: () => '通常石を選んでください',
    temptSelectPrompt: () => '対象の相手特殊石を選んでください',
    captureSelectPrompt: () => '捕獲する相手特殊石を選んでください',
    temptApplied: (playerLabel: string, posText: string) => `${playerLabel}が誘惑の意志で ${posText} の支配権を奪った`,
    captureApplied: (playerLabel: string, posText: string, cardName: string) => `${playerLabel}が捕獲の意志で ${posText} から${cardName}を回収した`,
    destroyApplied: (playerLabel: string, posText: string) => `${playerLabel}が破壊神で ${posText} を破壊`,
    swapApplied: (playerLabel: string, posText: string) => `${playerLabel}が交換の意志で ${posText} を自分の石に変換`,
    destroyFailed: () => '破壊できませんでした（保護されている可能性があります）',
    swapFailed: () => '交換できません（保護/爆弾の可能性）',
    chainExtraFlips: (count: number) => `連鎖系: 追加反転 ${count}枚`,
    placedWithFlips: (playerLabel: string, posText: string, count: number) => `${playerLabel}: ${posText} に置き、${count}枚反転`,
    regenTriggered: (count: number) => `復活の意志: ${count}個が再生`,
    regenCapture: (count: number) => `再生後の挟み反転: ${count}枚`,

    doublePlaceRemaining: (playerLabel: string, remaining: number, label: string) => `>> ${playerLabel}の${label || '連続手番'}（残り${remaining}回）`,
    fatalErrorContinue: () => 'エラーが発生しました。手動で続行するかリセットしてください。',
    bombExploded: (posText: string) => `💥 時限爆弾が爆発！ ${posText} を中心に破壊`,
    dragonConverted: (playerName: string, count: number) => `🐉 ${playerName}の究極反転龍が周囲${count}個の石を変化！`,
    dragonConvertedImmediate: (playerName: string, count: number) => `🐉 ${playerName}の究極反転龍が即時に周囲${count}個の石を変化！`,
    breedingSpawned: (playerName: string, count: number) => `🌱 ${playerName}の繁殖の意志が${count}個の石を生成！`,
    breedingSpawnedImmediate: (playerName: string, count: number) => `🌱 ${playerName}の繁殖の意志が即時に${count}個の石を生成！`,
    udgDestroyed: (playerName: string, count: number) => `💥 ${playerName}の究極破壊神が周囲${count}個の石を破壊！`,
    udgDestroyedImmediate: (playerName: string, count: number) => `💥 ${playerName}の究極破壊神が即時に周囲${count}個の石を破壊！`,
    hyperactiveMoved: (count: number) => `多動の意志が${count}回移動`,
    hyperactiveDestroyed: (count: number) => `多動の意志が${count}個消滅`,
    extremeHyperactiveMoved: (count: number) => `極悪多動魔が${count}回移動`,
    extremeHyperactiveDestroyed: (count: number) => `極悪多動魔が${count}個消滅`,
    extremeHyperactiveRepelled: (count: number) => `極悪多動魔が隣接石を${count}個退避`,
    escapeHyperactiveMoved: (count: number) => `逃げる意志が${count}回移動`,
    escapeHyperactiveDestroyed: (count: number) => `逃げる意志が${count}個消滅`,
    gluttonousMoved: (count: number) => `悪食石が${count}回移動`,
    gluttonousDestroyed: (count: number) => `悪食石が${count}個消滅`,
    ultimateHyperactiveMoved: (count: number) => `究極多動神が${count}回移動`,
    ultimateHyperactiveDestroyed: (count: number) => `究極多動神が${count}個消滅`,
    ultimateHyperactiveFlipped: (count: number) => `究極多動神が${count}枚反転`,
    hyperactiveMovedImmediate: () => '多動の意志が即時に移動',
    hyperactiveDestroyedImmediate: () => '多動の意志が即時に消滅'
};

if (typeof module === 'object' && module.exports) {
    module.exports = LOG_MESSAGES;
}

export {};
