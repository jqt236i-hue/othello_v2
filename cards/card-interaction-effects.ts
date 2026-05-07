/**
 * Card interaction effects stub — implementation incomplete.
 * This module provides card-type-specific help text overrides.
 * Fallback logic in cards/card-interaction.ts generates generic text from descriptions.
 */

const quickCardEffectByType: Record<string, string> = {};
const detailCardEffectByType: Record<string, string> = {};

function getQuickCardEffect(cardDef: any) {
  if (!cardDef) return '';
  const type = cardDef.type;
  if (type && quickCardEffectByType[type]) return quickCardEffectByType[type];
  const desc = cardDef.desc || cardDef.desc_ja || '';
  const firstSentence = desc.split('。').map((s: string) => s.trim()).filter(Boolean)[0] || desc;
  return firstSentence.length > 32 ? `${firstSentence.slice(0, 32)}...` : firstSentence;
}

function getDetailCardEffect(cardDef: any) {
  if (!cardDef) return '';
  const type = cardDef.type;
  if (type && detailCardEffectByType[type]) return detailCardEffectByType[type];
  const desc = cardDef.desc || cardDef.desc_ja || '';
  return desc.replace(/。/g, '。\n').trim();
}

export = {
  quickCardEffectByType,
  detailCardEffectByType,
  getQuickCardEffect,
  getDetailCardEffect
};
