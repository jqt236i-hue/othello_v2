/**
 * 「森の広場」（キャラと触れ合う 3D の場所）で使う素材を作る。
 *
 * - 広場: Blender で作った 森のリバーシ広場.glb（v06）を圧縮して assets/forest-plaza/plaza.glb へ
 * - キャラ: 特殊石・CPU の中ボス・観測者／執行者／理論の化身の GLB を圧縮して assets/forest-plaza/characters/ へ
 * - 一覧: assets/forest-plaza/catalog.json（表示名・高さ・アニメーション名・容量）
 *
 * 圧縮は形状の meshopt 化とテクスチャの WebP 化・縮小だけで、材質や形は変えない。
 * 元素材の場所は既定値（制作者の PC）か環境変数 FOREST_PLAZA_SOURCE_* で渡す。
 *
 * 使い方（npm run build:ts の後）:
 *   npm run assets:forest-plaza                       # 全部（作成済みで元が古くないものは飛ばす）
 *   npm run assets:forest-plaza -- --force            # 全部作り直す
 *   npm run assets:forest-plaza -- --only plaza       # 広場だけ（characters でキャラだけ）
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, path.basename(path.dirname(__dirname)) === 'dist' ? '../..' : '..');
const OUT = path.join(ROOT, 'assets', 'forest-plaza');

const SOURCES = {
  plaza: process.env.FOREST_PLAZA_SOURCE_PLAZA
    || 'F:\\01-創作系-CREATIVE\\Blender\\森のリバーシ広場\\exports\\森のリバーシ広場.glb',
  characters: process.env.FOREST_PLAZA_SOURCE_CHARACTERS
    || 'E:\\作曲系\\3dモデル完成品\\キャラクター',
  manifest: process.env.FOREST_PLAZA_SOURCE_MANIFEST
    || 'E:\\作曲系\\3dモデル完成品\\観測者、執行者系統',
};

/** 特殊石: [元フォルダ名, モデルID]。表示名はフォルダ名の「_」より前 */
const STONES: readonly (readonly [string, string])[] = [
  ['火石_fire-will', 'fire-will'],
  ['水石_water-will', 'water-will'],
  ['草石_grass-will', 'grass-will'],
  ['金の石_gold_stone', 'gold_stone'],
  ['銀の石_silver.stone', 'silver.stone'],
  ['虹の石_rainbow_stone', 'rainbow_stone'],
  ['労働石_work_stone', 'work_stone'],
  ['罠石_trap_stone', 'trap_stone'],
  ['弱い石_protected_next_stone', 'protected_next_stone'],
  ['強い石_perma_protect_next_stone', 'perma_protect_next_stone'],
  ['復活石_regen_stone', 'regen_stone'],
  ['落雷石_rakurai', 'rakurai'],
  ['残像石_ZAN', 'ZAN'],
  ['狙撃石_sna', 'sna'],
  ['時限爆弾_TIME_BOMB', 'TIME_BOMB'],
  ['十字爆弾_CROSS_BOMB', 'CROSS_BOMB'],
  ['クロス爆弾_X_BOMB', 'X_BOMB'],
  ['時間停石_TIME_STOP', 'TIME_STOP'],
  ['増殖石_PROLIFERATION_WILL', 'PROLIFERATION_WILL'],
  ['繁殖石_BREEDING_WILL', 'BREEDING_WILL'],
  ['躍動石_HYPERACTIVE_WILL', 'HYPERACTIVE_WILL'],
  ['逃亡石_ESCAPE_WILL', 'ESCAPE_WILL'],
  ['犠牲石_SACRIFICE_WILL', 'SACRIFICE_WILL'],
  ['悪食石_GLUTTONOUS_WILL', 'GLUTTONOUS_WILL'],
  ['屍石_ZOMBIE', 'ZOMBIE'],
  ['幽体石・黒_GHOST_WILL-black', 'GHOST_WILL-black'],
  ['幽体石・白_GHOST_WILL-white', 'GHOST_WILL-white'],
  ['ロボット掃除機石_ROBOT_VACUUM_WILL', 'ROBOT_VACUUM_WILL'],
  ['極悪躍動魔_EXTREME_HYPERACTIVE_WILL', 'EXTREME_HYPERACTIVE_WILL'],
  ['意志狩りの王・黒_WILL_HUNTER_KING-black', 'WILL_HUNTER_KING-black'],
  ['意志狩りの王・白_WILL_HUNTER_KING-white', 'WILL_HUNTER_KING-white'],
  ['破壊龍_DESTROY_DRAGON', 'DESTROY_DRAGON'],
  ['究極反転龍_ultimate_reverse_dragon', 'ultimate_reverse_dragon'],
  ['時間停神_TIME_STOP_DEITY', 'TIME_STOP_DEITY'],
  ['因果抹消神石_METEOR_GOD', 'METEOR_GOD'],
  ['救済神_STONE_SALVATION_GOD', 'STONE_SALVATION_GOD'],
  ['森羅万象神_SHINRA_BANSHO_GOD', 'SHINRA_BANSHO_GOD'],
  ['究極躍動神_ULTIMATE_HYPERACTIVE_GOD', 'ULTIMATE_HYPERACTIVE_GOD'],
  ['究極破壊神_ULTIMATE_DESTROY_GOD', 'ULTIMATE_DESTROY_GOD'],
  ['究極労働神_ULTIMATE_WORK_GOD', 'ULTIMATE_WORK_GOD'],
];

/** CPU の中ボス: [元フォルダ名, モデルID, 表示名]（LV3 は制作保留） */
const CPU_BOSSES: readonly (readonly [string, string, string])[] = [
  ['CPU レベル1_CPU_LV1', 'CPU_LV1', '盤喰いの小鬼'],
  ['CPU レベル2_CPU_LV2', 'CPU_LV2', '反転の影'],
  ['CPU レベル4_CPU_LV4', 'CPU_LV4', '盤面支配者'],
  ['CPU レベル5_CPU_LV5', 'CPU_LV5', '終局を告げる者'],
];

/** 観測者・執行者・理論の化身: [元の相対パス, 出力ID, 表示名] */
const MANIFESTS: readonly (readonly [string, string, string])[] = [
  ['盤理の観測者/exports/Observer_Will_v3.glb', 'observer', '盤理の観測者'],
  ['盤界の執行者/exports/BoardExecutor_v3.glb', 'executor', '盤界の執行者'],
  ['理論の化身/exports/TheoryIncarnation_v2_cloth.glb', 'theory', '理論の化身'],
];

const CHARACTER_TEXTURE_MAX = 1024;
const MANIFEST_TEXTURE_MAX = 2048;
const PLAZA_TEXTURE_MAX = 2048;
const PLAZA_LITE_TEXTURE_MAX = 1024;

type CharacterKind = 'stone' | 'cpu' | 'manifest';

interface CharacterEntry {
  id: string;
  label: string;
  kind: CharacterKind;
  url: string;
  height: number;
  animations: string[];
  bytes: number;
}

interface Catalog {
  plaza: { url: string; bytes: number; sourceBytes: number; liteUrl?: string; liteBytes?: number };
  characters: CharacterEntry[];
}

interface Job {
  id: string;
  label: string;
  kind: CharacterKind;
  src: string;
  textureMax: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function createIO(): Promise<any> {
  const core: any = await import('@gltf-transform/core');
  const extensions: any = await import('@gltf-transform/extensions');
  const meshopt: any = await import('meshoptimizer');
  await meshopt.MeshoptDecoder.ready;
  await meshopt.MeshoptEncoder.ready;
  return new core.NodeIO()
    .registerExtensions(extensions.ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': meshopt.MeshoptDecoder,
      'meshopt.encoder': meshopt.MeshoptEncoder,
    });
}

async function optimize(io: any, src: string, dst: string, textureMax: number, keepScene: boolean, normalMax = 512) {
  const fn: any = await import('@gltf-transform/functions');
  const meshopt: any = await import('meshoptimizer');
  const sharp: any = (await import('sharp')).default;
  const doc = await io.read(src);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const bounds = fn.getBounds(scene);
  const animations: string[] = root.listAnimations().map((a: any) => String(a.getName()));
  const transforms = [
    fn.dedup(),
    fn.prune({ keepAttributes: true, keepLeaves: keepScene }),
    fn.resample({ tolerance: 1e-4 }),
    // 広場の法線マップは細部の凹凸だけなので半分の大きさにする（容量の大半を占めるため）
    ...(keepScene
      ? [fn.textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^normalTexture$/, resize: [normalMax, normalMax], quality: 86, effort: 80 })]
      : []),
    fn.textureCompress({
      encoder: sharp, targetFormat: 'webp', resize: [textureMax, textureMax], quality: 86, effort: 80,
      ...(keepScene ? { slots: /^(?!normalTexture$)/ } : {}),
    }),
    fn.meshopt({ encoder: meshopt.MeshoptEncoder, level: 'medium' }),
  ];
  await doc.transform(...transforms);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  await io.write(dst, doc);
  return {
    height: Math.round((bounds.max[1] - bounds.min[1]) * 1000) / 1000,
    animations,
    bytes: fs.statSync(dst).size,
    sourceBytes: fs.statSync(src).size,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function isUpToDate(src: string, dst: string): boolean {
  return fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs;
}

function characterJobs(): Job[] {
  return [
    ...STONES.map(([dir, id]): Job => ({
      id, label: dir.slice(0, dir.indexOf('_')), kind: 'stone',
      src: path.join(SOURCES.characters, dir, `${id}.glb`), textureMax: CHARACTER_TEXTURE_MAX,
    })),
    ...CPU_BOSSES.map(([dir, id, label]): Job => ({
      id, label, kind: 'cpu',
      src: path.join(SOURCES.characters, dir, `${id}.glb`), textureMax: CHARACTER_TEXTURE_MAX,
    })),
    ...MANIFESTS.map(([rel, id, label]): Job => ({
      id, label, kind: 'manifest',
      src: path.join(SOURCES.manifest, rel), textureMax: MANIFEST_TEXTURE_MAX,
    })),
  ];
}

function readCatalog(file: string): Catalog | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Catalog;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const onlyIndex = argv.indexOf('--only');
  const only = onlyIndex >= 0 ? argv[onlyIndex + 1] : null;
  const catalogPath = path.join(OUT, 'catalog.json');
  const previous = readCatalog(catalogPath);
  const io = await createIO();
  const failures: string[] = [];

  let plaza = previous?.plaza ?? { url: 'assets/forest-plaza/plaza.glb', bytes: 0, sourceBytes: 0 };
  if (!only || only === 'plaza') {
    const dst = path.join(OUT, 'plaza.glb');
    if (!force && isUpToDate(SOURCES.plaza, dst) && isUpToDate(SOURCES.plaza, path.join(OUT, 'plaza-lite.glb')) && previous?.plaza?.liteUrl) {
      console.log('skip plaza');
    } else {
      const started = Date.now();
      const info = await optimize(io, SOURCES.plaza, dst, PLAZA_TEXTURE_MAX, true);
      // スマホ向けの軽い版（テクスチャを 1/4 の面積に。GPU のメモリが少ない端末で落ちないように）
      const liteDst = path.join(OUT, 'plaza-lite.glb');
      const lite = await optimize(io, SOURCES.plaza, liteDst, PLAZA_LITE_TEXTURE_MAX, true, 256);
      plaza = { url: 'assets/forest-plaza/plaza.glb', bytes: info.bytes, sourceBytes: info.sourceBytes, liteUrl: 'assets/forest-plaza/plaza-lite.glb', liteBytes: lite.bytes };
      console.log(`ok   plaza-lite -> ${(lite.bytes / 1e6).toFixed(2)}MB`);
      console.log(`ok   plaza ${(info.sourceBytes / 1e6).toFixed(1)}MB -> ${(info.bytes / 1e6).toFixed(2)}MB (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
  }

  const previousById = new Map((previous?.characters ?? []).map((entry) => [entry.id, entry]));
  const characters: CharacterEntry[] = [];
  for (const job of characterJobs()) {
    const dst = path.join(OUT, 'characters', `${job.id}.glb`);
    const url = `assets/forest-plaza/characters/${job.id}.glb`;
    const old = previousById.get(job.id);
    if (only && only !== 'characters') {
      if (old) characters.push(old);
      continue;
    }
    try {
      if (!force && old && isUpToDate(job.src, dst)) {
        characters.push({ ...old, label: job.label, kind: job.kind });
        continue;
      }
      const info = await optimize(io, job.src, dst, job.textureMax, false);
      characters.push({ id: job.id, label: job.label, kind: job.kind, url, height: info.height, animations: info.animations, bytes: info.bytes });
      console.log(`ok   ${job.id.padEnd(28)} ${(info.sourceBytes / 1e6).toFixed(1)}MB -> ${(info.bytes / 1e6).toFixed(2)}MB h=${info.height} ${info.animations.join(',')}`);
    } catch (error) {
      failures.push(`${job.id}: ${error instanceof Error ? error.message : String(error)}`);
      if (old) characters.push(old);
    }
  }

  const catalog: Catalog = { plaza, characters };
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  const total = plaza.bytes + characters.reduce((sum, entry) => sum + entry.bytes, 0);
  console.log(`catalog: ${characters.length} characters, total ${(total / 1e6).toFixed(1)}MB`);
  if (failures.length) {
    console.error(`failed ${failures.length}:\n  ${failures.join('\n  ')}`);
    return 1;
  }
  return 0;
}

main().then((code) => { process.exitCode = code; }, (error) => {
  console.error(error);
  process.exitCode = 1;
});
