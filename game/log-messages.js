/**
 * @file log-messages.js
 * @description Centralized log message templates for UI/animation flows.
 */

// Keep wording consistent across the UI.
const LOG_MESSAGES = {
    silverCharge: (gain) => `銀の意志：布石 +${gain}（3倍）`,
    goldCharge: (gain) => `金の意志：布石 +${gain}（4倍）`,
    plunderPoints: (amount) => `略奪：${amount}ポイントを奪取`,
    plunderCards: (count) => `略奪：${count}枚のカードを奪取`,

    protectNext: (ownerName) => `${ownerName}: 次の石を保護`,
    permaProtectNext: (ownerName) => `${ownerName}: 次の石を永続保護`,
    timeBombPlaced: (ownerName) => `⏱️ ${ownerName}: 時限爆弾を設置（6→5...）`,
    dragonPlaced: (ownerName) => `🐉 ${ownerName}: 究極反転龍を配置`,
    udgPlaced: (ownerName) => `💥 ${ownerName}: 究極破壊神を配置`,
    hyperactivePlaced: (ownerName) => `${ownerName}: 多動の意志を配置`,

    doublePlaceActivated: () => '二連投石発動：このターンもう1回置ける',
    destroySelectPrompt: () => '破壊対象を選んでください (石のあるマスのみ)',
    swapSelectPrompt: () => '交換対象（相手の石）を選んでください',
    normalStoneSelectPrompt: () => '通常石を選んでください',
    temptSelectPrompt: () => '対象の相手特殊石を選んでください',
    inheritApplied: (playerLabel, posText) => `${playerLabel}が意志の継承で ${posText} を強い意志に変換`,
    temptApplied: (playerLabel, posText) => `${playerLabel}が誘惑の意志で ${posText} の支配権を奪った`,
    destroyApplied: (playerLabel, posText) => `${playerLabel}が破壊神で ${posText} を破壊`,
    swapApplied: (playerLabel, posText) => `${playerLabel}が交換の意志で ${posText} を自分の石に変換`,
    destroyFailed: () => '破壊できませんでした（保護されている可能性があります）',
    swapFailed: () => '交換できません（保護/爆弾の可能性）',
    chainExtraFlips: (count) => `連鎖の意志: 追加反転 ${count}枚`,
    placedWithFlips: (playerLabel, posText, count) => `${playerLabel}: ${posText} に置き、${count}枚反転`,
    regenTriggered: (count) => `再生の意志: ${count}個が再生`,
    regenCapture: (count) => `再生後の挟み反転: ${count}枚`,

    doublePlaceRemaining: (playerLabel, remaining) => `>> ${playerLabel}の連続手番（残り${remaining}回）`,
    fatalErrorContinue: () => 'エラーが発生しました。手動で続行するかリセットしてください。',
    bombExploded: (posText) => `💥 時限爆弾が爆発！ ${posText} を中心に破壊`,
    dragonConverted: (playerName, count) => `🐉 ${playerName}の究極反転龍が周囲${count}個の石を変化！`,
    dragonConvertedImmediate: (playerName, count) => `🐉 ${playerName}の究極反転龍が即時に周囲${count}個の石を変化！`,
    breedingSpawned: (playerName, count) => `🌱 ${playerName}の繁殖の意志が${count}個の石を生成！`,
    breedingSpawnedImmediate: (playerName, count) => `🌱 ${playerName}の繁殖の意志が即時に${count}個の石を生成！`,
    udgDestroyed: (playerName, count) => `💥 ${playerName}の究極破壊神が周囲${count}個の石を破壊！`,
    udgDestroyedImmediate: (playerName, count) => `💥 ${playerName}の究極破壊神が即時に周囲${count}個の石を破壊！`,
    hyperactiveMoved: (count) => `多動の意志が${count}回移動`,
    hyperactiveDestroyed: (count) => `多動の意志が${count}個消滅`,
    hyperactiveMovedImmediate: () => '多動の意志が即時に移動',
    hyperactiveDestroyedImmediate: () => '多動の意志が即時に消滅'
};

if (typeof module === 'object' && module.exports) {
    module.exports = LOG_MESSAGES;
}
