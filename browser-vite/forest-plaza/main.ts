import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlazaCharacter, type PlazaCharacterInfo, type WalkArea } from './characters';
import {
  AFFECTION_MAX,
  affectionHearts,
  loadAffection,
  loadTimeOfDay,
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
/** カメラの注視点を動かせる範囲 */
const TARGET_BOUNDS = new THREE.Box3(new THREE.Vector3(-6, 0.3, -13), new THREE.Vector3(6, 2.6, 0.5));

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
    if (!roster.hidden) setRosterOpen(false);
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
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 600);
  camera.position.set(0.5, 2.0, 2.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-0.4, 0.55, -2.8);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.4;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.screenSpacePanning = false;
  controls.update();

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

  const walkArea: WalkArea = {
    isFree(x, z, self) {
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

  // ------------------------------------------------------------ タップ・なでる
  const pointer = new THREE.Vector2();
  const hitRaycaster = new THREE.Raycaster();
  const pickCharacter = (clientX: number, clientY: number): PlazaCharacter | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    hitRaycaster.setFromCamera(pointer, camera);
    const proxies = Array.from(visitors.values(), (character) => character.hitProxy);
    const hit = hitRaycaster.intersectObjects(proxies, false)[0];
    return hit ? (hit.object.userData.plazaCharacter as PlazaCharacter) : null;
  };

  interface Press {
    character: PlazaCharacter;
    pointerId: number;
    lastX: number;
    lastY: number;
    moved: number;
    stroke: number;
    pets: number;
  }
  let press: Press | null = null;
  const lastTap = new Map<string, number>();

  const doTap = (character: PlazaCharacter) => {
    character.react(camera.position);
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
    character.pet(camera.position);
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

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const character = pickCharacter(event.clientX, event.clientY);
    if (!character) return;
    press = { character, pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY, moved: 0, stroke: 0, pets: 0 };
    // キャラの上で押した時は、カメラを回さずになでる操作にする
    controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
    hint.classList.add('is-faded');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (press && event.pointerId === press.pointerId) {
      const distance = Math.hypot(event.clientX - press.lastX, event.clientY - press.lastY);
      press.lastX = event.clientX;
      press.lastY = event.clientY;
      press.moved += distance;
      press.stroke += distance;
      if (press.moved > 10 && press.stroke >= 80) {
        press.stroke = 0;
        press.pets += 1;
        doPet(press.character, press.pets);
      }
      return;
    }
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      canvas.style.cursor = pickCharacter(event.clientX, event.clientY) ? 'pointer' : '';
    }
  });
  const endPress = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.pointerId) return;
    if (press.moved <= 10 && event.type === 'pointerup') doTap(press.character);
    press = null;
    controls.enabled = true;
  };
  canvas.addEventListener('pointerup', endPress);
  canvas.addEventListener('pointercancel', endPress);

  // 確認用（?debug=1 の時だけ）：キャラの画面上の位置を返す
  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    (window as unknown as { __forestPlazaDebug?: unknown }).__forestPlazaDebug = {
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
  window.setTimeout(() => hint.classList.add('is-faded'), 9000);

  let nextChatter = performance.now() + 9000;
  const clock = new THREE.Clock();
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    for (const character of visitors.values()) character.update(dt, walkArea);
    updateHearts(dt);
    controls.update();
    controls.target.clamp(TARGET_BOUNDS.min, TARGET_BOUNDS.max);
    if (camera.position.y < 0.35) camera.position.y = 0.35;
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
