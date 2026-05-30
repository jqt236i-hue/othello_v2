declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file log-messages.js
 * @description Centralized log message templates for UI/animation flows.
 */

// Keep wording consistent across the UI.
const LOG_MESSAGES = {
    silverCharge: (gain: any) => `銀の意志：布石 +${gain}（3倍）`,
    goldCharge: (gain: any) => `金の意志：布石 +${gain}（4倍）`,
    rainbowCharge: (gain: any) => `虹の意志：布石 +${gain}（6倍）`,
    crystalCharge: (gain: any) => `演算の意志：数字マス布石 +${gain}（2倍）`,
    plunderPoints: (amount: any) => `吸収：${amount}ポイントを吸収`,

    protectNext: (ownerName: any) => `${ownerName}: 次の石を保護`,
    permaProtectNext: (ownerName: any) => `${ownerName}: 次の石を永続保護`,
    timeBombPlaced: (ownerName: any) => `⏱️ ${ownerName}: 時限爆弾を設置（6→5...）`,
    dragonPlaced: (ownerName: any) => `🐉 ${ownerName}: 究極反転龍を配置`,
    destroyDragonPlaced: (ownerName: any) => `🔥 ${ownerName}: 破壊龍を配置`,
    udgPlaced: (ownerName: any) => `💥 ${ownerName}: 究極破壊神を配置`,
    ultimateHyperactivePlaced: (ownerName: any) => `${ownerName}: 究極多動神を配置`,
    hyperactivePlaced: (ownerName: any) => `${ownerName}: 多動の意志を配置`,
    extremeHyperactivePlaced: (ownerName: any) => `${ownerName}: 極悪多動魔を配置`,
    escapeHyperactivePlaced: (ownerName: any) => `${ownerName}: 逃げる意志を配置`,

    doublePlaceActivated: (label: any, remaining: any, infinite: any) => {
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
    temptApplied: (playerLabel: any, posText: any) => `${playerLabel}が誘惑の意志で ${posText} の支配権を奪った`,
    temptGhostBlocked: (playerLabel: any, posText: any) => `${playerLabel}が誘惑の意志で ${posText} を選択（幽体が誘惑を受け流した）`,
    captureApplied: (playerLabel: any, posText: any, cardName: any) => `${playerLabel}が捕獲の意志で ${posText} から${cardName}を回収した`,
    captureGhostBlocked: (playerLabel: any, posText: any) => `${playerLabel}が捕獲の意志で ${posText} を選択（幽体が捕獲を受け流した）`,
    destroyApplied: (playerLabel: any, posText: any) => `${playerLabel}が破壊の意志で ${posText} を破壊`,
    destroyDefault: (playerLabel: any, posText: any) => `${playerLabel}が破壊の意志で ${posText} に効果を発動`,
    destroyProliferated: (playerLabel: any, posText: any) => `${playerLabel}が破壊の意志で ${posText} を破壊（増殖石が分裂）`,
    destroyRegenerated: (playerLabel: any, posText: any) => `${playerLabel}が破壊の意志で ${posText} を破壊（復活の意志で再生）`,
    destroyLivingWillRestored: (playerLabel: any, posText: any) => `${playerLabel}が破壊の意志で ${posText} を破壊（生きる意志で復活）`,
    destroyGhostBlocked: (playerLabel: any, posText: any) => `${playerLabel}が破壊の意志で ${posText} を選択（幽霊石が破壊を防いだ）`,
    destroyEvaded: (playerLabel: any, posText: any) => `${playerLabel}が破壊の意志で ${posText} を選択（意志狩りの王が回避）`,
    swapApplied: (playerLabel: any, posText: any) => `${playerLabel}が交換の意志で ${posText} を自分の石に変換`,
    destroyFailed: () => '破壊できませんでした（保護されている可能性があります）',
    swapFailed: () => '交換できません（保護/爆弾の可能性）',
    chainExtraFlips: (count: any) => `連鎖系: 追加反転 ${count}枚`,
    placedWithFlips: (playerLabel: any, posText: any, count: any) => `${playerLabel}: ${posText} に置き、${count}枚反転`,
    regenTriggered: (count: any) => `復活の意志: ${count}個が再生`,
    regenCapture: (count: any) => `再生後の挟み反転: ${count}枚`,

    doublePlaceRemaining: (playerLabel: any, remaining: any, label: any) => `>> ${playerLabel}の${label || '連続手番'}（残り${remaining}回）`,
    fatalErrorContinue: () => 'エラーが発生しました。手動で続行するかリセットしてください。',
    bombExploded: (posText: any) => `💥 時限爆弾が爆発！ ${posText} を中心に破壊`,
    dragonConverted: (playerName: any, count: any) => `🐉 ${playerName}の究極反転龍が周囲${count}個の石を変化！`,
    dragonConvertedImmediate: (playerName: any, count: any) => `🐉 ${playerName}の究極反転龍が即時に周囲${count}個の石を変化！`,
    breedingSpawned: (playerName: any, count: any) => `🌱 ${playerName}の繁殖の意志が${count}個の石を生成！`,
    breedingSpawnedImmediate: (playerName: any, count: any) => `🌱 ${playerName}の繁殖の意志が即時に${count}個の石を生成！`,
    udgDestroyed: (playerName: any, count: any) => `💥 ${playerName}の究極破壊神が周囲${count}個の石を破壊！`,
    udgDestroyedImmediate: (playerName: any, count: any) => `💥 ${playerName}の究極破壊神が即時に周囲${count}個の石を破壊！`,
    hyperactiveMoved: (count: any) => `多動の意志が${count}回移動`,
    hyperactiveDestroyed: (count: any) => `多動の意志が${count}個消滅`,
    extremeHyperactiveMoved: (count: any) => `極悪多動魔が${count}回移動`,
    extremeHyperactiveDestroyed: (count: any) => `極悪多動魔が${count}個消滅`,
    extremeHyperactiveRepelled: (count: any) => `極悪多動魔が隣接石を${count}個退避`,
    escapeHyperactiveMoved: (count: any) => `逃げる意志が${count}回移動`,
    escapeHyperactiveDestroyed: (count: any) => `逃げる意志が${count}個消滅`,
    gluttonousMoved: (count: any) => `悪食石が${count}回移動`,
    gluttonousDestroyed: (count: any) => `悪食石が${count}個消滅`,
    ultimateHyperactiveMoved: (count: any) => `究極多動神が${count}回移動`,
    ultimateHyperactiveDestroyed: (count: any) => `究極多動神が${count}個消滅`,
    ultimateHyperactiveFlipped: (count: any) => `究極多動神が${count}枚反転`,
    hyperactiveMovedImmediate: () => '多動の意志が即時に移動',
    hyperactiveDestroyedImmediate: () => '多動の意志が即時に消滅'
};

if (typeof module === 'object' && module.exports) {
    module.exports = LOG_MESSAGES;
}

export {};
