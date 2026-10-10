/**
 * 森の広場でキャラが話すセリフと、仲良し度（なでた回数などで上がる）の保存。
 */

export type PlazaCharacterKind = 'stone' | 'cpu' | 'manifest';

export type PlazaLineSituation = 'greet' | 'pet' | 'petMore' | 'idle';

const COMMON_LINES: Record<PlazaLineSituation, readonly string[]> = {
  greet: ['やあ！', 'あそびに来てくれたの？', 'こんにちは！', '今日もいい天気だね', '盤の上より、ここが好き'],
  pet: ['えへへ…', 'くすぐったい！', 'もっとなでて', 'ふふっ', 'ころころ…'],
  petMore: ['だいすき！', 'ずっとここにいたいな', '次の対局もがんばるね', 'きみの手、あったかい'],
  idle: ['ふんふーん♪', 'ピアノ、だれか弾かないかな', '木漏れ日がきもちいい', 'おなかすいたなあ', 'ひなたぼっこ中…'],
};

const KIND_LINES: Partial<Record<PlazaCharacterKind, Partial<Record<PlazaLineSituation, readonly string[]>>>> = {
  cpu: {
    greet: ['ここでは勝負はなしだ', '…休戦だ。今日だけな', 'ふん、なれ合いは好かん…が、悪くない'],
    pet: ['な、なにをする！', '…別に嫌ではない', 'こ、子ども扱いするな'],
    petMore: ['次の対局、手加減はしないぞ', '…また来い'],
  },
};

const CHARACTER_LINES: Record<string, Partial<Record<PlazaLineSituation, readonly string[]>>> = {
  observer: {
    greet: ['あなたの一手を、ここでも観測している', '盤の外の世界も、悪くない'],
    pet: ['…観測対象に触れられるのは、初めて', '不思議な感覚…'],
    petMore: ['この記録は、消さずにおく', 'あなたとの時間は、計算できない'],
    idle: ['風の揺らぎを観測中', '木々の枝分かれは、盤面の分岐に似ている'],
  },
  executor: {
    greet: ['執行の時ではない。くつろげ', '今日は剣を置いてきた'],
    pet: ['…む', '執行者をなでる者など、お前くらいだ'],
    petMore: ['お前の盤は、私が守ろう', '悪くない休息だ'],
  },
  theory: {
    greet: ['休息もまた、理論の一部', 'ようこそ。ここは計算の外側だ'],
    pet: ['その手の動き…規則性がない', '理論では説明できない心地よさ'],
    petMore: ['きみとの仲良し度、すでに最適解', '証明終了。きみが好きだ'],
  },
  'fire-will': { greet: ['ぽかぽかしてる？'], pet: ['あちち…じゃなくて、うれしい！'] },
  'water-will': { greet: ['しっとり、いい空気'], pet: ['ぷるぷる…'] },
  'grass-will': { greet: ['ここ、草がいっぱいで最高！'], pet: ['葉っぱがそよそよする〜'] },
  'TIME_BOMB': { pet: ['あ、あんまり揺らさないで…！'] },
  'CROSS_BOMB': { pet: ['ドキドキしちゃう…'] },
  'X_BOMB': { pet: ['ドキドキしちゃう…'] },
  'ZOMBIE': { greet: ['うぅ…こんにちは…'], pet: ['あったかい手…生き返る…'] },
  'ROBOT_VACUUM_WILL': { idle: ['落ち葉、ぜんぶ吸っちゃうぞ'], pet: ['ピピッ、なでなで検知'] },
};

function pick(list: readonly string[]): string {
  return list[Math.floor(Math.random() * list.length)] ?? '';
}

export function pickLine(id: string, kind: PlazaCharacterKind, situation: PlazaLineSituation): string {
  const own = CHARACTER_LINES[id]?.[situation];
  const byKind = KIND_LINES[kind]?.[situation];
  // 固有のセリフ・種類ごとのセリフを優先して選ぶ（観測者たちは固有のセリフだけ）
  if (own && (kind === 'manifest' || Math.random() < 0.7)) return pick(own);
  if (byKind && Math.random() < 0.7) return pick(byKind);
  return pick(COMMON_LINES[situation]);
}

const AFFECTION_STORAGE_KEY = 'cardReversi.forestPlaza.affection.v1';
const TIME_STORAGE_KEY = 'cardReversi.forestPlaza.time.v1';
const COMFORT_STORAGE_KEY = 'cardReversi.forestPlaza.comfort.v1';

/** 仲良し度の上限と、ハートの数（最大 5）への換算 */
export const AFFECTION_MAX = 100;

export function affectionHearts(value: number): number {
  return Math.min(5, Math.floor(value / 20));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない環境（プライベートモードなど）では、その場限りにする
  }
}

export function loadAffection(): Record<string, number> {
  const value = readJson<Record<string, number>>(AFFECTION_STORAGE_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

export function saveAffection(value: Record<string, number>): void {
  writeJson(AFFECTION_STORAGE_KEY, value);
}

/**
 * 3D 酔い対策の設定。初期値は酔いにくい側（揺れなし・視野広め・動く時に周りを暗くする）
 * - fov: 視野の広さ（度）。広いほど酔いにくい人が多い
 * - sensitivity: 見回す速さの倍率
 * - headBob: 歩く時の視点の揺れ（入れると揺れる）
 * - vignette: 移動・見回し中に画面の周りを暗くする（周辺視野の流れを減らす）
 */
export interface PlazaComfortSettings {
  fov: number;
  sensitivity: number;
  headBob: boolean;
  vignette: boolean;
}

export const DEFAULT_COMFORT: Readonly<PlazaComfortSettings> = { fov: 80, sensitivity: 0.8, headBob: false, vignette: true };

export function loadComfort(): PlazaComfortSettings {
  const value = readJson<Partial<PlazaComfortSettings> | null>(COMFORT_STORAGE_KEY, null) ?? {};
  const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
  return {
    fov: num(value.fov, 60, 100, DEFAULT_COMFORT.fov),
    sensitivity: num(value.sensitivity, 0.2, 2, DEFAULT_COMFORT.sensitivity),
    headBob: typeof value.headBob === 'boolean' ? value.headBob : DEFAULT_COMFORT.headBob,
    vignette: typeof value.vignette === 'boolean' ? value.vignette : DEFAULT_COMFORT.vignette,
  };
}

export function saveComfort(value: PlazaComfortSettings): void {
  writeJson(COMFORT_STORAGE_KEY, value);
}

export function loadTimeOfDay(): string | null {
  const value = readJson<unknown>(TIME_STORAGE_KEY, null);
  return typeof value === 'string' ? value : null;
}

export function saveTimeOfDay(value: string): void {
  writeJson(TIME_STORAGE_KEY, value);
}
