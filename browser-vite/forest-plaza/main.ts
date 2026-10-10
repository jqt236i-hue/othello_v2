import * as THREE from 'three';
import { PlazaCharacter, type PlazaCharacterInfo, type WalkArea } from './characters';
import { PlazaPlayer, type PlayerWorld } from './player';
import {
  AFFECTION_MAX,
  affectionHearts,
  loadAffection,
  loadComfort,
  loadTimeOfDay,
  saveComfort,
  DEFAULT_COMFORT,
  type PlazaComfortSettings,
  pickLine,
  saveAffection,
  saveTimeOfDay,
  type PlazaLineSituation,
} from './lines';
import { PLAZA_TIMES, loadPlaza, type PlazaScene, type PlazaTimeOfDay } from './scene';

/**
 * 森の広場：森のリバーシ広場の 3D シーンにキャラを呼んで、タップであいさつ・なでて仲良くなる場所。
 * ゲーム本体（index.html）からは iframe で開き、閉じると iframe ごと破棄して GPU のメモリを返す。
 */

interface PlazaCatalog {
  plaza: { url: string; bytes: number };
  characters: PlazaCharacterInfo[];
}

const CLOSE_MESSAGE = 'card-reversi:forest-plaza:close';
const MAX_VISITORS = 6;
/** 広場に入った時に最初からいるキャラの数（入るたびにランダムに選び直す） */
const RANDOM_VISITOR_COUNT = 4;
/** 最初からいるキャラのうち、観測者・執行者・理論の化身（容量が大きい）は 1 体まで */
const RANDOM_MANIFEST_LIMIT = 1;
const KIND_GROUPS: readonly { kind: PlazaCharacterInfo['kind']; label: string }[] = [
  { kind: 'stone', label: '特殊石' },
  { kind: 'cpu', label: 'CPU の中ボス' },
  { kind: 'manifest', label: '観測者・執行者・理論の化身' },
];
/** キャラが歩ける広場の範囲（three 座標。切り株のテーブルのまわりの敷石） */
const WALK_BOUNDS = { minX: -4.6, maxX: 3.2, minZ: -8.4, maxZ: -0.2 };
/** プレイヤーが歩ける範囲（敷石の広場とそのまわり。外の森へは出ない） */
const PLAYER_BOUNDS = { minX: -13.5, maxX: 13.5, minZ: -22.5, maxZ: 5.5 };
/** プレイヤーの最初の位置と向き（広場の入口から切り株のテーブルを見る） */
const PLAYER_START = new THREE.Vector3(0.2, 0, 1.2);
const PLAYER_START_YAW = Math.atan2(0.85, 5.2);
/** 一度に登れる段差と、降りてよい段差（m） */
const PLAYER_STEP_UP = 0.45;
const PLAYER_MAX_DROP = 1.6;
/** あいさつ・なでるが届く距離（目から m） */
const REACH = 3.2;
/** 長押しでなでるまでの時間と、なでる間隔（ms） */
const PET_HOLD_MS = 350;
const PET_INTERVAL_MS = 420;

/** 素材の置き場所。ビルド後は vite-dist/ の下、素材は repo 直下の assets/ */
const assetBase = new URL(window.location.pathname.includes('/vite-dist/') ? '../' : './', window.location.href).href;

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing #${id}`);
  return element as T;
};

/** 入るたびに最初からいるキャラをランダムに選ぶ（同じキャラは重ならない） */
function pickRandomVisitors(characters: readonly PlazaCharacterInfo[]): string[] {
  const pool = characters.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked: string[] = [];
  let manifests = 0;
  for (const entry of pool) {
    if (picked.length >= Math.min(RANDOM_VISITOR_COUNT, MAX_VISITORS)) break;
    if (entry.kind === 'manifest') {
      if (manifests >= RANDOM_MANIFEST_LIMIT) continue;
      manifests += 1;
    }
    picked.push(entry.id);
  }
  return picked;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)}MB`;
}

function heartsText(value: number): string {
  const n = affectionHearts(value);
  return '♥'.repeat(n) + '♡'.repeat(5 - n);
}

function createHeartTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ff6f9a';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(32, 54);
    ctx.bezierCurveTo(4, 34, 6, 10, 22, 10);
    ctx.bezierCurveTo(28, 10, 32, 16, 32, 20);
    ctx.bezierCurveTo(32, 16, 36, 10, 42, 10);
    ctx.bezierCurveTo(58, 10, 60, 34, 32, 54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface HeartParticle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface Bubble {
  element: HTMLDivElement;
  until: number;
}

async function boot(): Promise<void> {
  const view = $('plazaView');
  const loading = $('plazaLoading');
  const loadingBar = $('plazaLoadingBar');
  const loadingText = $('plazaLoadingText');
  const bubbleLayer = $('plazaBubbles');
  const roster = $('plazaRoster');
  const rosterList = $('plazaRosterList');
  const callButton = $<HTMLButtonElement>('plazaCallBtn');
  const info = $('plazaInfo');
  const infoName = $('plazaInfoName');
  const infoHearts = $('plazaInfoHearts');
  const hint = $('plazaHint');
  $('plazaRosterMax').textContent = String(MAX_VISITORS);

  /** マウスを捕まえられない環境での操作中か（ドラッグで見回す） */
  let freeMode = false;
  let exitFreeMode = () => { freeMode = false; };
  const closePlaza = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: CLOSE_MESSAGE }, window.location.origin);
    } else {
      window.location.href = `${assetBase}index.html`;
    }
  };
  $('plazaCloseBtn').addEventListener('click', closePlaza);
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // マウスを捕まえている間の Esc はブラウザがマウスを戻すのに使う（広場は閉じない）
    if (document.pointerLockElement) return;
    if (freeMode) { exitFreeMode(); return; }
    const comfortOpen = document.getElementById('plazaComfort');
    if (comfortOpen && !comfortOpen.hidden) { comfortOpen.hidden = true; $('plazaComfortBtn').setAttribute('aria-expanded', 'false'); }
    else if (!roster.hidden) setRosterOpen(false);
    else closePlaza();
  });

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(80, 1, 0.03, 600);
  camera.position.set(0.2, 1.6, 1.2);

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const catalogResponse = await fetch(`${assetBase}assets/forest-plaza/catalog.json`, { cache: 'no-cache' });
  if (!catalogResponse.ok) throw new Error(`catalog ${catalogResponse.status}`);
  const catalog = (await catalogResponse.json()) as PlazaCatalog;
  const characterById = new Map(catalog.characters.map((entry) => [entry.id, entry]));

  const plaza: PlazaScene = await loadPlaza(`${assetBase}${catalog.plaza.url}`, scene, renderer, (ratio) => {
    const percent = Math.round(ratio * 100);
    loadingBar.style.width = `${percent}%`;
    loadingText.textContent = `${percent}%（${formatMegabytes(catalog.plaza.bytes)}）`;
  });
  const savedTime = loadTimeOfDay();
  let timeOfDay: PlazaTimeOfDay = (PLAZA_TIMES as readonly string[]).includes(savedTime ?? '')
    ? savedTime as PlazaTimeOfDay
    : '昼';
  plaza.setTime(timeOfDay);

  // 時間帯ボタン
  const timesBox = $('plazaTimes');
  const timeButtons = PLAZA_TIMES.map((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plaza-btn plaza-btn-small';
    button.textContent = name;
    button.addEventListener('click', () => {
      timeOfDay = name;
      plaza.setTime(name);
      saveTimeOfDay(name);
      syncTimeButtons();
    });
    timesBox.appendChild(button);
    return button;
  });
  const syncTimeButtons = () => timeButtons.forEach((button, index) => {
    button.setAttribute('aria-pressed', PLAZA_TIMES[index] === timeOfDay ? 'true' : 'false');
  });
  syncTimeButtons();

  // ------------------------------------------------------------ 歩ける場所
  const visitors = new Map<string, PlazaCharacter>();
  const loadingIds = new Set<string>();
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const rayOrigin = new THREE.Vector3();
  const standCache = new Map<string, number | null>();

  /** 家具を除いた足元の高さ（0.25m 格子でキャッシュ）。家具の上なら null */
  const groundAt = (x: number, z: number): number | null => {
    const key = `${Math.round(x * 4)},${Math.round(z * 4)}`;
    if (standCache.has(key)) return standCache.get(key) ?? null;
    rayOrigin.set(Math.round(x * 4) / 4, 3.5, Math.round(z * 4) / 4);
    raycaster.set(rayOrigin, down);
    raycaster.far = 6;
    let floor = 0;
    const floorHits = raycaster.intersectObjects(plaza.floorMeshes, false);
    if (floorHits.length) floor = floorHits[0].point.y;
    const obstacleHits = raycaster.intersectObjects(plaza.obstacleMeshes, false);
    const blocked = obstacleHits.some((hit) => hit.point.y > floor + 0.12 && hit.point.y < floor + 2.6);
    const value = blocked ? null : floor;
    standCache.set(key, value);
    return value;
  };

  // ------------------------------------------------------------ プレイヤー（リバーシの勇者）
  const allSolid = [...new Set([...plaza.floorMeshes, ...plaza.playerSolidMeshes])];
  const solidRay = new THREE.Raycaster();
  solidRay.firstHitOnly = true;
  const groundRay = new THREE.Raycaster();
  const sideDir = new THREE.Vector3();
  const sideOrigin = new THREE.Vector3();
  let player: PlazaPlayer | null = null;
  const playerFrom = new THREE.Vector3();

  /** 足元の床の高さ（プレイヤー用。家具・木・壁の中や、登れない段差・深い段差の先なら null） */
  const playerFloorAt = (x: number, z: number, fromY: number): number | null => {
    groundRay.set(sideOrigin.set(x, fromY + 2.0, z), down);
    groundRay.far = 2.0 + PLAYER_MAX_DROP + 0.5;
    const hits = groundRay.intersectObjects(allSolid, false);
    let floor: number | null = null;
    for (const hit of hits) {
      // 頭から登れる高さまでの間に何かあれば、そこには立てない（机・幹・低い天井）
      if (hit.point.y > fromY + PLAYER_STEP_UP) {
        if (hit.point.y < fromY + 1.85) return null;
        continue;
      }
      floor = hit.point.y;
      break;
    }
    if (floor === null || floor < fromY - PLAYER_MAX_DROP) return null;
    return floor;
  };

  const playerWorld: PlayerWorld = {
    standAt(x, z) {
      if (x < PLAYER_BOUNDS.minX || x > PLAYER_BOUNDS.maxX || z < PLAYER_BOUNDS.minZ || z > PLAYER_BOUNDS.maxZ) return null;
      const from = player ? playerFrom.copy(player.position) : playerFrom.set(x, PLAYER_START.y, z);
      const dx = x - from.x;
      const dz = z - from.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 1e-5) {
        // 進む先に壁・幹が無いか、膝と胸の高さで横向きに確かめる（真上からの光線では垂直な壁が見えないため）
        sideDir.set(dx / distance, 0, dz / distance);
        for (const height of [0.6, 1.3]) {
          solidRay.set(sideOrigin.set(from.x, from.y + height, from.z), sideDir);
          solidRay.far = distance + 0.3;
          if (solidRay.intersectObjects(plaza.playerSolidMeshes, false).length) return null;
        }
      }
      const center = playerFloorAt(x, z, from.y);
      if (center === null) return null;
      // 体の幅（半径 0.25m）の 4 点でも立てるか確かめ、幹や家具の縁にめり込まないようにする
      for (const [ox, oz] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]] as const) {
        if (playerFloorAt(x + ox, z + oz, from.y) === null) return null;
      }
      return center;
    },
    clearDistance(from, to) {
      sideDir.subVectors(to, from);
      const length = sideDir.length();
      if (length < 1e-5) return 0;
      solidRay.set(from, sideDir.divideScalar(length));
      solidRay.far = length;
      const hit = solidRay.intersectObjects(plaza.playerSolidMeshes, false)[0];
      return hit ? hit.distance : length;
    },
    hitsCharacter(x, z, radius) {
      if (!player) return false;
      for (const character of visitors.values()) {
        const minDistance = radius + character.radius;
        const dx = character.position.x - x;
        const dz = character.position.z - z;
        if (dx * dx + dz * dz >= minDistance * minDistance) continue;
        // 既に重なっている時は、離れる向きだけ許す
        const nx = character.position.x - player.position.x;
        const nz = character.position.z - player.position.z;
        if (dx * dx + dz * dz < nx * nx + nz * nz) return true;
      }
      return false;
    },
  };

  const walkArea: WalkArea = {
    isFree(x, z, self) {
      if (player) {
        const minDistance = self.radius + player.radius + 0.1;
        const dx = player.position.x - x;
        const dz = player.position.z - z;
        const nx = player.position.x - self.position.x;
        const nz = player.position.z - self.position.z;
        if (dx * dx + dz * dz < minDistance * minDistance && dx * dx + dz * dz < nx * nx + nz * nz) return false;
      }
      for (const other of visitors.values()) {
        if (other === self) continue;
        const minDistance = self.radius + other.radius + 0.1;
        const dx = other.position.x - x;
        const dz = other.position.z - z;
        if (dx * dx + dz * dz < minDistance * minDistance) {
          // 既に重なっている時は、離れる向きの移動だけ許す
          const nowX = other.position.x - self.position.x;
          const nowZ = other.position.z - self.position.z;
          if (dx * dx + dz * dz < nowX * nowX + nowZ * nowZ) return false;
        }
      }
      return true;
    },
    standHeight(x, z, self) {
      if (x < WALK_BOUNDS.minX || x > WALK_BOUNDS.maxX || z < WALK_BOUNDS.minZ || z > WALK_BOUNDS.maxZ) return null;
      const r = self ? self.radius * 0.8 : 0.3;
      // キャラの足元の中心と、まわり 4 点で家具が無いか確かめる
      const samples: [number, number][] = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
      let height = 0;
      for (const [ox, oz] of samples) {
        const y = groundAt(x + ox, z + oz);
        if (y === null) return null;
        if (ox === 0 && oz === 0) height = y;
      }
      if (self) {
        if (player && (player.position.x - x) ** 2 + (player.position.z - z) ** 2 < (self.radius + player.radius + 0.3) ** 2) return null;
        for (const other of visitors.values()) {
          if (other === self) continue;
          const minDistance = self.radius + other.radius + 0.25;
          if ((other.position.x - x) ** 2 + (other.position.z - z) ** 2 < minDistance * minDistance) return null;
        }
      }
      return height;
    },
    randomPoint() {
      return new THREE.Vector2(
        THREE.MathUtils.randFloat(WALK_BOUNDS.minX, WALK_BOUNDS.maxX),
        THREE.MathUtils.randFloat(WALK_BOUNDS.minZ, WALK_BOUNDS.maxZ),
      );
    },
  };

  // ------------------------------------------------------------ ハートと吹き出し
  const heartTexture = createHeartTexture();
  const hearts: HeartParticle[] = [];
  const spawnHearts = (character: PlazaCharacter, count: number) => {
    const head = character.headPosition(new THREE.Vector3());
    for (let i = 0; i < count; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexture, transparent: true, depthWrite: false }));
      sprite.position.copy(head).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.1, (Math.random() - 0.5) * 0.4));
      sprite.scale.setScalar(0.18 + Math.random() * 0.08);
      scene.add(sprite);
      hearts.push({
        sprite,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.55 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3),
        life: 0,
        maxLife: 1.1 + Math.random() * 0.4,
      });
    }
  };
  const updateHearts = (dt: number) => {
    for (let i = hearts.length - 1; i >= 0; i -= 1) {
      const heart = hearts[i];
      heart.life += dt;
      heart.sprite.position.addScaledVector(heart.velocity, dt);
      heart.velocity.x *= 0.98;
      const k = heart.life / heart.maxLife;
      (heart.sprite.material as THREE.SpriteMaterial).opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (heart.life >= heart.maxLife) {
        heart.sprite.removeFromParent();
        heart.sprite.material.dispose();
        hearts.splice(i, 1);
      }
    }
  };

  const bubbles = new Map<string, Bubble>();
  const say = (character: PlazaCharacter, situation: PlazaLineSituation) => {
    let bubble = bubbles.get(character.info.id);
    if (!bubble) {
      const element = document.createElement('div');
      element.className = 'plaza-bubble';
      bubbleLayer.appendChild(element);
      bubble = { element, until: 0 };
      bubbles.set(character.info.id, bubble);
    }
    bubble.element.textContent = pickLine(character.info.id, character.info.kind, situation);
    bubble.element.classList.remove('is-hidden');
    bubble.until = performance.now() + 2800;
  };
  const projected = new THREE.Vector3();
  const updateBubbles = () => {
    const now = performance.now();
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (const [id, bubble] of bubbles) {
      const character = visitors.get(id);
      if (!character || now > bubble.until) {
        bubble.element.classList.add('is-hidden');
        continue;
      }
      character.headPosition(projected);
      projected.y += 0.1;
      projected.project(camera);
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      bubble.element.classList.toggle('is-hidden', !visible);
      bubble.element.style.transform = `translate(${((projected.x + 1) / 2) * width}px, ${((1 - projected.y) / 2) * height}px) translate(-50%, -100%)`;
    }
  };

  // ------------------------------------------------------------ 仲良し度
  const affection = loadAffection();
  let affectionDirty = false;
  const showInfo = (character: PlazaCharacter) => {
    info.hidden = false;
    infoName.textContent = character.info.label;
    infoHearts.textContent = heartsText(affection[character.info.id] ?? 0);
    infoHearts.title = `仲良し度 ${affection[character.info.id] ?? 0} / ${AFFECTION_MAX}`;
  };
  /** 仲良し度を上げる。ハートが増えたら true */
  const addAffection = (character: PlazaCharacter, amount: number): boolean => {
    const id = character.info.id;
    const before = affection[id] ?? 0;
    const after = Math.min(AFFECTION_MAX, before + amount);
    affection[id] = after;
    affectionDirty = true;
    showInfo(character);
    return affectionHearts(after) > affectionHearts(before);
  };
  window.setInterval(() => {
    if (!affectionDirty) return;
    affectionDirty = false;
    saveAffection(affection);
  }, 2000);
  window.addEventListener('pagehide', () => saveAffection(affection));

  // ------------------------------------------------------------ 呼ぶキャラの一覧
  const rosterButtons = new Map<string, HTMLButtonElement>();
  let visitorOrder: string[] = pickRandomVisitors(catalog.characters);

  const syncRoster = () => {
    for (const [id, button] of rosterButtons) {
      const active = visitorOrder.includes(id);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('is-loading', loadingIds.has(id));
      const heartsElement = button.querySelector('.plaza-roster-hearts');
      if (heartsElement) heartsElement.textContent = heartsText(affection[id] ?? 0);
    }
  };

  const setRosterOpen = (open: boolean) => {
    roster.hidden = !open;
    callButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) syncRoster();
  };
  callButton.addEventListener('click', () => setRosterOpen(roster.hidden !== false));
  $('plazaRosterClose').addEventListener('click', () => setRosterOpen(false));

  for (const group of KIND_GROUPS) {
    const entries = catalog.characters.filter((entry) => entry.kind === group.kind);
    if (!entries.length) continue;
    const heading = document.createElement('div');
    heading.className = 'plaza-roster-group';
    heading.textContent = group.label;
    rosterList.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'plaza-roster-grid';
    for (const entry of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'plaza-roster-item';
      const name = document.createElement('span');
      name.className = 'plaza-roster-name';
      name.textContent = entry.label;
      const meta = document.createElement('span');
      meta.className = 'plaza-roster-meta';
      const heartsElement = document.createElement('span');
      heartsElement.className = 'plaza-roster-hearts';
      meta.appendChild(heartsElement);
      if (entry.bytes >= 3e6) {
        const size = document.createElement('span');
        size.className = 'plaza-roster-size';
        size.textContent = formatMegabytes(entry.bytes);
        meta.appendChild(size);
      }
      button.append(name, meta);
      button.addEventListener('click', () => toggleVisitor(entry.id));
      grid.appendChild(button);
      rosterButtons.set(entry.id, button);
    }
    rosterList.appendChild(grid);
  }

  const spawnVisitor = async (id: string) => {
    const entry = characterById.get(id);
    if (!entry || visitors.has(id) || loadingIds.has(id)) return;
    loadingIds.add(id);
    syncRoster();
    try {
      const character = await PlazaCharacter.load(entry, assetBase);
      if (!visitorOrder.includes(id)) {
        character.dispose();
        return;
      }
      // 空いている場所に置く（見つからなければ広場の中ほど）
      let placed = false;
      for (let attempt = 0; attempt < 40 && !placed; attempt += 1) {
        const point = walkArea.randomPoint();
        const y = walkArea.standHeight(point.x, point.y, character);
        if (y === null) continue;
        character.placeAt(point.x, y, point.y);
        placed = true;
      }
      if (!placed) character.placeAt(1.6, 0, -2.4);
      scene.add(character.root);
      visitors.set(id, character);
      say(character, 'greet');
    } catch (error) {
      console.warn('[forest-plaza] failed to load character', id, error);
      visitorOrder = visitorOrder.filter((value) => value !== id);
    } finally {
      loadingIds.delete(id);
      syncRoster();
    }
  };

  const removeVisitor = (id: string) => {
    const character = visitors.get(id);
    if (character) {
      character.dispose();
      visitors.delete(id);
    }
    const bubble = bubbles.get(id);
    if (bubble) {
      bubble.element.remove();
      bubbles.delete(id);
    }
  };

  function toggleVisitor(id: string): void {
    if (visitorOrder.includes(id)) {
      visitorOrder = visitorOrder.filter((value) => value !== id);
      removeVisitor(id);
    } else {
      // いっぱいの時は、いちばん前に呼んだキャラに帰ってもらう
      while (visitorOrder.length >= MAX_VISITORS) {
        const leaving = visitorOrder.shift();
        if (leaving) removeVisitor(leaving);
      }
      visitorOrder.push(id);
      void spawnVisitor(id);
    }
    syncRoster();
  }

  // ------------------------------------------------------------ 一人称の操作（あいさつ・なでる）
  const crosshair = $('plazaCrosshair');
  const aimLabel = $('plazaAimLabel');
  const startPanel = $('plazaStart');
  const viewButton = $<HTMLButtonElement>('plazaViewBtn');
  const canvas = renderer.domElement;
  const hitRaycaster = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0);

  player = new PlazaPlayer(scene, camera, playerWorld, PLAYER_START, PLAYER_START_YAW);
  {
    const startFloor = playerFloorAt(PLAYER_START.x, PLAYER_START.z, 3);
    player.position.y = startFloor ?? 0;
  }
  const activePlayer = player;

  // ------------------------------------------------------------ 酔い対策
  const comfortPanel = $('plazaComfort');
  const comfortButton = $<HTMLButtonElement>('plazaComfortBtn');
  const fovInput = $<HTMLInputElement>('plazaFov');
  const sensInput = $<HTMLInputElement>('plazaSens');
  const vignetteInput = $<HTMLInputElement>('plazaVignette');
  const headBobInput = $<HTMLInputElement>('plazaHeadBob');
  const vignette = $('plazaVignetteOverlay');
  let comfort: PlazaComfortSettings = loadComfort();
  const applyComfort = () => {
    camera.fov = comfort.fov;
    camera.updateProjectionMatrix();
    activePlayer.comfort.sensitivity = comfort.sensitivity;
    activePlayer.comfort.headBob = comfort.headBob ? 1 : 0;
    fovInput.value = String(comfort.fov);
    sensInput.value = String(comfort.sensitivity);
    vignetteInput.checked = comfort.vignette;
    headBobInput.checked = comfort.headBob;
    $('plazaFovValue').textContent = `${comfort.fov}°`;
    $('plazaSensValue').textContent = `×${comfort.sensitivity.toFixed(1)}`;
    if (!comfort.vignette) vignette.style.opacity = '0';
  };
  const updateComfort = (patch: Partial<PlazaComfortSettings>) => {
    comfort = { ...comfort, ...patch };
    saveComfort(comfort);
    applyComfort();
  };
  fovInput.addEventListener('input', () => updateComfort({ fov: Number(fovInput.value) }));
  sensInput.addEventListener('input', () => updateComfort({ sensitivity: Number(sensInput.value) }));
  vignetteInput.addEventListener('change', () => updateComfort({ vignette: vignetteInput.checked }));
  headBobInput.addEventListener('change', () => updateComfort({ headBob: headBobInput.checked }));
  $('plazaComfortReset').addEventListener('click', () => updateComfort({ ...DEFAULT_COMFORT }));
  const setComfortOpen = (open: boolean) => {
    comfortPanel.hidden = !open;
    comfortButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setRosterOpen(false);
  };
  comfortButton.addEventListener('click', () => setComfortOpen(comfortPanel.hidden !== false));
  $('plazaComfortClose').addEventListener('click', () => setComfortOpen(false));
  callButton.addEventListener('click', () => setComfortOpen(false));
  applyComfort();
  let vignetteLevel = 0;
  /** 移動・見回しの大きさに合わせて画面の周りを暗くする（ゆっくり変える） */
  const updateVignette = (dt: number) => {
    if (!comfort.vignette) return;
    const target = (activePlayer.view === 'first' ? 0.8 : 0.4) * activePlayer.motionAmount;
    vignetteLevel += (target - vignetteLevel) * (1 - Math.exp(-dt * (target > vignetteLevel ? 10 : 4)));
    vignette.style.opacity = vignetteLevel.toFixed(3);
  };

  /** 照準（画面の真ん中。マウスを捕まえていない時はマウスの位置）の先にいる、手の届くキャラ */
  const aimedCharacter = (ndc: THREE.Vector2 = screenCenter): PlazaCharacter | null => {
    hitRaycaster.setFromCamera(ndc, camera);
    const proxies = Array.from(visitors.values(), (character) => character.hitProxy);
    const hit = hitRaycaster.intersectObjects(proxies, false)[0];
    if (!hit) return null;
    if (hit.point.distanceTo(activePlayer.eye) > REACH) return null;
    // 間に壁や木があれば届かない
    solidRay.set(hitRaycaster.ray.origin, hitRaycaster.ray.direction);
    solidRay.far = hit.distance;
    if (solidRay.intersectObjects(plaza.playerSolidMeshes, false).length) return null;
    return hit.object.userData.plazaCharacter as PlazaCharacter;
  };
  const lastTap = new Map<string, number>();
  const doTap = (character: PlazaCharacter) => {
    activePlayer.playGesture('wave', 0.9);
    character.react(activePlayer.eye);
    spawnHearts(character, 2);
    say(character, 'greet');
    const now = performance.now();
    if (now - (lastTap.get(character.info.id) ?? 0) > 1500) {
      lastTap.set(character.info.id, now);
      addAffection(character, 1);
    } else {
      showInfo(character);
    }
  };

  const doPet = (character: PlazaCharacter, count: number) => {
    activePlayer.playGesture('pet', 0.6);
    character.pet(activePlayer.eye);
    spawnHearts(character, 1);
    const levelUp = addAffection(character, 1);
    const level = affectionHearts(affection[character.info.id] ?? 0);
    if (levelUp) {
      spawnHearts(character, 6);
      say(character, 'petMore');
    } else if (count % 4 === 1) {
      say(character, level >= 3 && Math.random() < 0.5 ? 'petMore' : 'pet');
    }
  };

  // マウスを捕まえて（ポインターロック）見回す。捕まえていない間は「歩きはじめる」案内を出す。
  // ブラウザが捕まえるのを断った時は、ドラッグで見回し、キャラを直接クリックする操作に切り替える
  const isLocked = () => document.pointerLockElement === canvas;
  const isActive = () => isLocked() || freeMode;
  const pointerNdc = new THREE.Vector2();
  const setPointerNdc = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  };
  const aimPoint = () => (isLocked() ? screenCenter : pointerNdc);
  const syncLock = () => {
    const locked = isLocked();
    const active = isActive();
    startPanel.hidden = active;
    crosshair.hidden = !locked;
    hint.classList.toggle('is-faded', !active);
    if (!active) {
      activePlayer.releaseKeys();
      press = null;
    }
  };
  const enterFreeMode = () => {
    freeMode = true;
    syncLock();
  };
  exitFreeMode = () => {
    freeMode = false;
    syncLock();
  };
  const lockPointer = () => {
    setRosterOpen(false);
    setComfortOpen(false);
    try {
      const request = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (request && typeof request.then === 'function') request.then(() => { freeMode = false; syncLock(); }, enterFreeMode);
    } catch {
      enterFreeMode();
    }
  };
  document.addEventListener('pointerlockchange', syncLock);
  document.addEventListener('pointerlockerror', enterFreeMode);
  $('plazaStartBtn').addEventListener('click', lockPointer);

  interface Press { since: number; lastPet: number; pets: number; character: PlazaCharacter | null; dragged: number }
  let press: Press | null = null;

  canvas.addEventListener('mousemove', (event) => {
    setPointerNdc(event);
    if (isLocked()) {
      activePlayer.look(event.movementX, event.movementY);
      return;
    }
    if (freeMode && (event.buttons & 1) && press) {
      press.dragged += Math.abs(event.movementX) + Math.abs(event.movementY);
      // キャラの上で押していない時、または押したまま大きく動かした時は見回す
      if (!press.character || press.dragged > 12) activePlayer.look(event.movementX, event.movementY);
    }
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    setPointerNdc(event);
    if (!isActive()) { lockPointer(); return; }
    press = { since: performance.now(), lastPet: 0, pets: 0, character: aimedCharacter(aimPoint()), dragged: 0 };
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !press) return;
    // 短く押して離した時はあいさつ（長押しでなでていた時・見回していた時は何もしない）
    if (press.pets === 0 && press.dragged <= 12) {
      const character = aimedCharacter(aimPoint()) ?? press.character;
      if (character) doTap(character);
    }
    press = null;
  });
  const updatePress = (now: number) => {
    if (!press || press.dragged > 12 || now - press.since < PET_HOLD_MS || now - press.lastPet < PET_INTERVAL_MS) return;
    const character = aimedCharacter(aimPoint());
    if (!character) return;
    press.lastPet = now;
    press.pets += 1;
    doPet(character, press.pets);
  };
  const setViewLabel = () => {
    viewButton.textContent = activePlayer.view === 'first' ? '視点: 一人称' : '視点: 三人称';
  };
  const toggleView = () => {
    activePlayer.toggleView();
    setViewLabel();
  };
  viewButton.addEventListener('click', toggleView);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyV' && !event.repeat) toggleView();
  });
  setViewLabel();

  let aimed: PlazaCharacter | null = null;
  const updateAim = () => {
    const next = isActive() ? aimedCharacter(aimPoint()) : null;
    canvas.style.cursor = freeMode && next ? 'pointer' : '';
    if (next === aimed) return;
    aimed = next;
    crosshair.classList.toggle('is-target', Boolean(next));
    aimLabel.textContent = next ? `${next.info.label}　クリック：あいさつ／長押し：なでる` : '';
    if (next) showInfo(next);
  };
  // 確認用（?debug=1 の時だけ）：キャラの画面上の位置、プレイヤーの位置、マウスを捕まえずに歩く操作
  let debugInput = false;
  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    (window as unknown as { __forestPlazaDebug?: unknown }).__forestPlazaDebug = {
      player: () => ({ x: activePlayer.position.x, y: activePlayer.position.y, z: activePlayer.position.z, yaw: activePlayer.yaw, pitch: activePlayer.pitch, view: activePlayer.view }),
      setInput: (enabled: boolean) => { debugInput = enabled; },
      look: (yaw: number, pitch: number) => { activePlayer.yaw = yaw; activePlayer.pitch = pitch; },
      aimed: () => aimedCharacter()?.info.id ?? null,
      tap: () => { const c = aimedCharacter(); if (c) doTap(c); return c?.info.id ?? null; },
      pet: () => { const c = aimedCharacter(); if (c) doPet(c, 1); return c?.info.id ?? null; },
      characters: () => Array.from(visitors.values(), (character) => {
        const point = character.position.clone();
        point.y += character.height * 0.5;
        point.project(camera);
        return {
          id: character.info.id,
          x: ((point.x + 1) / 2) * window.innerWidth,
          y: ((1 - point.y) / 2) * window.innerHeight,
        };
      }),
    };
  }

  // ------------------------------------------------------------ 起動
  for (const id of visitorOrder) void spawnVisitor(id);
  syncRoster();
  loading.classList.add('is-done');
  window.setTimeout(() => { loading.hidden = true; }, 400);
  syncLock();

  let nextChatter = performance.now() + 9000;
  const clock = new THREE.Clock();
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    for (const character of visitors.values()) character.update(dt, walkArea);
    updateHearts(dt);
    activePlayer.update(dt, (isActive() || debugInput) && roster.hidden === true && comfortPanel.hidden === true);
    updateVignette(dt);
    updatePress(performance.now());
    updateAim();
    renderer.render(scene, camera);
    updateBubbles();
    const now = performance.now();
    if (now > nextChatter) {
      nextChatter = now + 12000 + Math.random() * 14000;
      const list = Array.from(visitors.values());
      const speaker = list[Math.floor(Math.random() * list.length)];
      if (speaker) say(speaker, 'idle');
    }
  };
  renderer.setAnimationLoop(frame);

  // 見えていない間（別タブ・最小化）は描画を止める
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
      saveAffection(affection);
    } else {
      clock.getDelta();
      renderer.setAnimationLoop(frame);
    }
  });

  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    for (const id of Array.from(visitors.keys())) removeVisitor(id);
    activePlayer.dispose();
    plaza.dispose();
    heartTexture.dispose();
    renderer.dispose();
  });
}

boot().catch((error: unknown) => {
  console.error('[forest-plaza] failed to start', error);
  const text = document.getElementById('plazaLoadingText');
  if (text) text.textContent = '読み込みに失敗しました。閉じてからもう一度開いてください。';
});
