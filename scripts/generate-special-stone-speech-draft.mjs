import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { SPECIAL_STONE_BUBBLE_SPEECH } = require(path.join(root, 'dist/game/turn/turn_pipeline_phase_helpers.js'));

const stones = [
  ['PROTECTED', '弱い石'], ['PERMA_PROTECTED', '強い石'], ['SNIPER', '狙撃石'], ['GHOST', '幽体石'],
  ['SACRIFICE', '犠牲石'], ['AFTERIMAGE_WILL', '残像石'], ['TIME_STOP', '時間停石'],
  ['TIME_STOP_DEITY', '時間停神'], ['REGEN', '復活石'], ['ZOMBIE', '屍石'],
  ['DRAGON', '究極反転龍'], ['BREEDING', '繁殖石'], ['PROLIFERATION', '増殖石'],
  ['HYPERACTIVE', '躍動石'], ['EXTREME_HYPERACTIVE', '極悪躍動魔'],
  ['ESCAPE_HYPERACTIVE', '逃亡石'], ['ROBOT_VACUUM', 'ロボット掃除機石'],
  ['GLUTTONOUS', '悪食石'], ['WILL_HUNTER_KING', '意志狩りの王'], ['WORK', '労働石'],
  ['STONE_SALVATION_GOD', '救済神'], ['DESTROY_DRAGON', '破壊龍'], ['LIGHTNING', '落雷石'],
  ['ULTIMATE_DESTROY_GOD', '究極破壊神'], ['ULTIMATE_HYPERACTIVE', '究極躍動神'],
  ['METEOR_GOD', '因果抹消神石']
];

const scenarioNames = {
  place: '登場', destroy: '破壊・喪失', duration_end: '持続切れ', normal_revert: '通常石化',
  living_will_restored: '生きる意志復活', proliferation_triggered: '増殖成功',
  time_stop_triggered: '時間停止発動', time_stop_deity_triggered: '神刻停止発動',
  regen_triggered: '復活発動', zombie_infection: '感染', zombie_revived: '屍復活',
  card_nullified: 'カード無効化', ghost_protected: '幽体無効化',
  escape_exploded: '逃走不能爆発', special_destroy_triggered: '特殊石撃破', incomeLinesByStep: '収入'
};

const preferredScenarios = [
  'place', 'destroy', 'duration_end', 'normal_revert', 'living_will_restored',
  'proliferation_triggered', 'time_stop_triggered', 'time_stop_deity_triggered',
  'regen_triggered', 'zombie_infection', 'zombie_revived', 'card_nullified',
  'ghost_protected', 'escape_exploded', 'special_destroy_triggered', 'incomeLinesByStep'
];

const out = [
  '# 特殊石キャラクターボイス台本', '',
  '> この台本は `assets/特殊石のキャラ設定メモ/全特殊石・顕現石キャラクター設定.md` の特殊石26種を参照し、',
  '> `game/turn/turn_pipeline_phase_helpers.ts` の実装カタログから機械生成した全文確認用転記です。', '',
  '- 通常・専用シナリオは各5候補、労働収入はstep 1～5の固定文です。',
  '- 全文は改行なし・34文字以下・完全一致重複なしです。',
  '- 罠、爆弾、石状態、配置時効果、顕現石3種は対象外です。',
  '- 顕現石の既存固有セリフは変更・削除せず、新規吹き出しも追加しません。', ''
];

for (const [type, displayName] of stones) {
  const entry = SPECIAL_STONE_BUBBLE_SPEECH[type];
  if (!entry) throw new Error(`Missing speech entry: ${type}`);
  out.push(`## ${displayName}（${type}）`, '');
  for (const scenario of preferredScenarios) {
    const value = entry[scenario];
    if (!value) continue;
    out.push(`### ${scenarioNames[scenario]}（${scenario}）`, '');
    if (Array.isArray(value)) {
      value.forEach((line, index) => out.push(`${index + 1}. ${line}`));
    } else {
      Object.entries(value).forEach(([step, line]) => out.push(`${step}. ${line}`));
    }
    out.push('');
  }
}

fs.writeFileSync(path.join(root, 'special-stone-speech-draft.md'), `${out.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
