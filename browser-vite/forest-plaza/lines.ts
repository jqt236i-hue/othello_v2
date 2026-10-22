/**
 * 森の広場でキャラが話すセリフと、仲良し度（なでた回数などで上がる）の保存。
 */

import { PLAZA_LINE_LOADERS } from './lines-index';

export type PlazaCharacterKind = 'stone' | 'cpu' | 'manifest';

export type PlazaLineSituation = 'greet' | 'pet' | 'petMore' | 'idle';

/** 1 キャラ分のセリフ。各場面とも添字が仲良し度の段階（ハートの数 0〜5） */
export type PlazaLineSet = Record<PlazaLineSituation, readonly (readonly string[])[]>;

/** セリフを読み込めなかった時だけ使う、段階によらない最小限のセリフ */
const FALLBACK_LINES: Record<PlazaLineSituation, readonly string[]> = {
  greet: ['やあ！', 'こんにちは！'],
  pet: ['えへへ…', 'くすぐったい！'],
  petMore: ['だいすき！', 'ありがとう'],
  idle: ['ふんふーん♪', '木漏れ日がきもちいい'],
};

const lineSets = new Map<string, PlazaLineSet | null>();
const lineLoads = new Map<string, Promise<void>>();
const lastLines = new Map<string, string>();

/** キャラ ID（`-black` / `-white` の色違いは同じキャラ）からセリフファイルの名前を作る */
export function lineKeyFor(id: string): string {
  return id.replace(/-(black|white)$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/** そのキャラのセリフを読み込む（キャラごとに別ファイルなので、呼んだキャラの分だけ読む）。失敗しても例外は出さない */
export function preloadLines(id: string): Promise<void> {
  const key = lineKeyFor(id);
  let task = lineLoads.get(key);
  if (!task) {
    const loader = PLAZA_LINE_LOADERS[key];
    task = loader
      ? loader().then(
        (module) => { lineSets.set(key, module.default as PlazaLineSet); },
        () => { lineSets.set(key, null); },
      )
      : Promise.resolve().then(() => { lineSets.set(key, null); });
    lineLoads.set(key, task);
  }
  return task;
}

function pick(list: readonly string[], previous: string | undefined): string {
  if (list.length === 0) return '';
  let line = list[Math.floor(Math.random() * list.length)] ?? '';
  // 同じセリフが続かないようにする
  for (let attempt = 0; attempt < 4 && line === previous && list.length > 1; attempt += 1) {
    line = list[Math.floor(Math.random() * list.length)] ?? '';
  }
  return line;
}

/** 仲良し度の段階（ハート 0〜5）から、今回選ぶ段階を決める。ときどきひとつ前の段階の態度に戻る */
function chooseTier(hearts: number): number {
  const tier = Math.min(5, Math.max(0, Math.floor(hearts)));
  return tier > 0 && Math.random() < 0.2 ? tier - 1 : tier;
}

export function pickLine(id: string, situation: PlazaLineSituation, hearts = 0): string {
  const set = lineSets.get(lineKeyFor(id));
  const previous = lastLines.get(id);
  let line = '';
  if (set) {
    const tier = chooseTier(hearts);
    // 段階 0 の petMore は無いので、なでる時のセリフで代える
    const own = set[situation]?.[tier] ?? [];
    line = pick(own.length > 0 ? own : set.pet?.[tier] ?? [], previous);
  }
  if (!line) line = pick(FALLBACK_LINES[situation], previous);
  lastLines.set(id, line);
  return line;
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
