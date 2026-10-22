import * as THREE from 'three';
import type { PlazaCharacter } from '../characters';
import type { PathPoint } from './pathing';
import type { ActivityContext, PlazaActivity } from './types';

// 実測: 長手X、枕+X、布団上面0.954m。支柱の内側へは歩かせない。
const SURFACE = 0.954;
const APPROACHES = [[10, -4.25], [10.75, -4], [8.5, -4.5], [8.25, -4.5], [8, -4.25], [8, -4], [9.75, -4], [10.5, -4], [11, -3.75]];
interface Companion {
  character: PlazaCharacter; home: THREE.Vector3; landing: THREE.Vector3;
  phase: 'approach' | 'settling' | 'asleep' | 'return'; retry: number; elapsed: number;
}

export function createSleepActivity(ctx: ActivityContext): PlazaActivity {
  const owner = {};
  let disposed = false, generation = 0;
  let phase: 'idle' | 'enter' | 'sleep' | 'wake' = 'idle';
  let companion: Companion | null = null;
  let elapsed = 0, together = 0, rewards = 0, nextLine = 10;
  let removeInput: (() => void) | undefined, removeEscape: (() => void) | undefined;
  let previousView = ctx.player.view;
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.12, 1.82), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.set(10.4, 0.89, -6.6);
  const handle = ctx.addInteractable({ id: 'sleep-bed', label: 'ベッド', action: '寝る', proxy,
    enabled: () => !disposed && phase === 'idle' && companion?.phase !== 'return' && !ctx.player.isFixed && !ctx.hand.current,
    interact: () => { void start(); } });

  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const paint = canvas.getContext('2d');
  if (paint) { paint.font = 'bold 44px sans-serif'; paint.textAlign = 'center'; paint.fillStyle = '#c9d8ff'; paint.fillText('z', 32, 47); }
  const texture = new THREE.CanvasTexture(canvas);
  const symbols = Array.from({ length: 3 }, () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false }));
    sprite.scale.setScalar(0.17); sprite.visible = false; ctx.scene.add(sprite); return sprite;
  });
  // 寝床周りだけの弱い読書灯。既存の光源・材質・夜の明るさは変更しない。
  const bedLight = new THREE.PointLight(0xffcf9a, 0, 6, 2);
  bedLight.name = 'SleepBedLight'; bedLight.position.set(10.1, 2.2, -5.65);
  let lightAmount = 0;
  function removeBedLight(): void { bedLight.removeFromParent(); bedLight.intensity = 0; lightAmount = 0; }
  const head = new THREE.Vector3();
  const present = (c: PlazaCharacter) => ctx.visitors.get(c.info.id) === c;

  function clearCompanion(c: Companion, restore = true): void {
    if (companion === c) companion = null; // stopPathの同期コールバックより先に無効化。
    if (!present(c.character)) return;
    c.character.stopPath(false); c.character.lookAt(null); c.character.setPose({});
    c.character.root.rotation.z = 0;
    if (restore && c.phase !== 'approach' && c.phase !== 'return') c.character.position.copy(c.landing);
    c.character.release(owner);
  }

  // 自然スポーンは格子の間に立つ。単純な四捨五入先が家具に入る場合だけ、
  // 足元から安全につながる近隣の格子へ接続する（本人の半径を縮めない）。
  function routeBetween(c: PlazaCharacter, goal: { x: number; z: number }): PathPoint[] | null {
    const r = c.radius * 0.8;
    const floor = (x: number, z: number): number | null => {
      const y = ctx.pathing.groundAt(x, z);
      if (y === null) return null;
      for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const side = ctx.pathing.groundAt(x + dx, z + dz);
        if (side === null || Math.abs(side - y) > 0.4) return null;
      }
      return y;
    };
    const anchor = (p: { x: number; z: number }): PathPoint | null => {
      const x = Math.round(p.x * 4) / 4, z = Math.round(p.z * 4) / 4;
      const choices = [[0,0], [-.25,0], [.25,0], [0,-.25], [0,.25], [-.25,-.25], [.25,-.25], [-.25,.25], [.25,.25]]
        .map(([dx,dz]) => ({x:x+dx,z:z+dz})).sort((a,b) => Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
      for (const q of choices) {
        const y = floor(q.x, q.z);
        if (y === null || Math.hypot(q.x-p.x,q.z-p.z) > 0.45) continue;
        let safe = true;
        for (let i=0;i<=4;i++) if (floor(p.x+(q.x-p.x)*i/4,p.z+(q.z-p.z)*i/4) === null) { safe = false; break; }
        if (safe) return {...q,y};
      }
      return null;
    };
    const from = anchor(c.position), to = anchor(goal);
    if (!from || !to) return null;
    const route = ctx.pathing.find(from, to, c);
    if (!route) return null;
    return [{x:c.position.x,y:c.position.y,z:c.position.z}, ...route, {x:goal.x,y:floor(goal.x,goal.z) ?? to.y,z:goal.z}];
  }

  function routeToBed(c: PlazaCharacter): PathPoint[] | null {
    for (const [x, z] of APPROACHES) {
      const route = routeBetween(c, { x, z });
      if (route) return route;
    }
    return null;
  }

  function beginReturn(c: Companion): void {
    if (companion !== c || !present(c.character)) return;
    const wasOnBed = c.phase === 'asleep' || c.phase === 'settling';
    c.phase = 'return'; c.elapsed = 0; c.retry = 0;
    c.character.stopPath(false); c.character.setPose({}); c.character.lookAt(null);
    c.character.root.rotation.z = 0;
    if (wasOnBed) c.character.position.copy(c.landing);
    walkHome(c);
  }

  function walkHome(c: Companion): void {
    if (companion !== c || c.phase !== 'return') return;
    const goals = [c.home, { x: 2, z: -2 }, { x: 1, z: -4 }, { x: 0, z: -1 }];
    for (const goal of goals) {
      const route = routeBetween(c.character, goal);
      if (!route) continue;
      c.retry = Infinity;
      c.character.walkPath(route, 1.25, arrived => {
        if (companion !== c || c.phase !== 'return') return;
        if (arrived) clearCompanion(c, false); else c.retry = 0.8;
      });
      return;
    }
    c.retry = 0.8;
  }

  async function settle(c: Companion): Promise<void> {
    if (phase !== 'sleep' || companion !== c) return;
    c.phase = 'settling'; c.landing.copy(c.character.position);
    ctx.say(c.character, 'sleepIn');
    const token = generation;
    await ctx.fade(1, 0.3);
    if (disposed || generation !== token || companion !== c || phase !== 'sleep') return;
    // 身長だけでなく装飾込みの幅を測る。低く幅広の石は長手Xに幅を沿わせる。
    const character = c.character, savedRotation = character.root.rotation.clone();
    character.root.rotation.set(0, 0, 0); character.root.updateWorldMatrix(true, true);
    const body = character.root.children[0];
    const bounds = body ? new THREE.Box3().setFromObject(body) : null;
    const width = bounds && !bounds.isEmpty() ? bounds.max.x - bounds.min.x : character.radius * 2;
    character.root.rotation.copy(savedRotation); character.root.updateWorldMatrix(true, true);
    const lengthwise = character.height <= 1.75 && width <= 0.7;
    const crosswise = character.height <= 0.68 && width <= 2.09;
    if (lengthwise || crosswise) {
      character.position.set(lengthwise ? 11.05 - character.height : 10.4, SURFACE, lengthwise ? -7.02 : -6.85);
      character.lookAt(character.position.clone().add(lengthwise ? new THREE.Vector3(-4, 0, 0) : new THREE.Vector3(0, 0, 4)));
      character.setPose({ posture: 'lie', breathing: true });
    } else {
      c.character.position.copy(c.landing);
      c.character.lookAt(new THREE.Vector3(10.8, SURFACE, -6.6));
      c.character.setPose({ posture: 'sit', offsetY: c.character.height * 0.28, breathing: true });
      c.character.root.rotation.z = 0.12;
    }
    // 相手の顔を下寄り・少し横に置く。身体は枕+Xのまま、顔向きだけを暗転中に決める。
    const face = character.position.clone();
    if (lengthwise || crosswise) {
      face.y = SURFACE + character.lyingClearance + 0.15;
      if (lengthwise) face.x += character.height * 0.85;
      else face.z -= character.height * 0.65;
    } else face.y += character.height * 0.78;
    const eye = ctx.player.eye, dx = face.x - eye.x, dz = face.z - eye.z;
    const lookYaw = Math.atan2(-dx, -dz) + 0.08;
    const pitch = Math.atan2(face.y - eye.y, Math.hypot(dx, dz)) + 0.18;
    ctx.player.setPose({ position: new THREE.Vector3(9.5, SURFACE, -6.15), yaw: -Math.PI / 2,
      lookYaw, pitch, lying: true, eyeHeight: 0.36, yawLimit: 0.45, pitchLimit: 0.68 });
    c.phase = 'asleep'; together = 0; nextLine = 10;
    await ctx.fade(0.13, 0.8);
  }

  function approach(c: Companion, route: PathPoint[]): void {
    c.retry = Infinity;
    c.character.walkPath(route, 1.35, arrived => {
      if (companion !== c || c.phase !== 'approach') return;
      if (arrived) { c.landing.copy(c.character.position); if (phase === 'sleep') void settle(c); else c.retry = 0.1; }
      else c.retry = 0.8;
    });
  }

  async function start(): Promise<void> {
    if (disposed || phase !== 'idle' || ctx.player.isFixed || ctx.hand.current) return;
    // 帰還中に再度寝る時も前の占有を残さない。
    if (companion) { if (companion.phase === 'return') return; clearCompanion(companion); }
    phase = 'enter'; const token = ++generation; previousView = ctx.player.view;
    elapsed = together = rewards = 0; nextLine = 10; lightAmount = 0;
    ctx.scene.add(bedLight);
    ctx.director.sleeping = true;
    const wakeInput = () => { if (phase === 'idle') return false; void wake(); return true; };
    removeInput = ctx.onInput(wakeInput); removeEscape = ctx.onEscape(wakeInput);
    await ctx.fade(1, 0.4);
    if (disposed || generation !== token) return;
    ctx.player.setPose({ position: new THREE.Vector3(9.5, SURFACE, -6.15), yaw: -Math.PI / 2, pitch: 0.95,
      lying: true, eyeHeight: 0.36, yawLimit: 0.38, pitchLimit: 0.2 });
    ctx.setTime('夜');
    // 同点は無作為順。占有中・経路のない相手は次点へ。
    const candidates = [...ctx.visitors.values()].map(character => ({ character, rank: ctx.hearts(character), tie: Math.random() }))
      .sort((a, b) => b.rank - a.rank || a.tie - b.tie);
    for (const { character } of candidates) {
      if (character.isBusy) continue;
      const route = routeToBed(character);
      if (!route || !character.claim(owner, () => { if (companion?.character === character) { clearCompanion(companion); void wake(); } })) continue;
      companion = { character, home: character.position.clone(), landing: character.position.clone(), phase: 'approach', retry: 0, elapsed: 0 };
      approach(companion, route); break;
    }
    phase = 'sleep';
    await ctx.fade(0, 0.4);
    if (!disposed && generation === token && phase === 'sleep') void ctx.fade(0.13, 3);
  }

  async function wake(): Promise<void> {
    if (disposed || phase === 'idle' || phase === 'wake') return;
    phase = 'wake'; const token = ++generation;
    for (const sprite of symbols) sprite.visible = false;
    await ctx.fade(1, 0.4);
    if (disposed || token !== generation) return;
    removeBedLight();
    ctx.player.setPose(null); ctx.player.setView(previousView); ctx.setTime(null);
    if (companion) {
      const c = companion;
      if (present(c.character)) { ctx.say(c.character, 'wake'); ctx.spawnHearts(c.character, 3); beginReturn(c); }
      else companion = null;
    }
    await ctx.fade(0, 0.6);
    if (disposed || token !== generation) return;
    phase = 'idle'; ctx.director.sleeping = false;
    removeInput?.(); removeEscape?.(); removeInput = removeEscape = undefined;
  }

  return {
    update(dt) {
      if (disposed) return;
      const lighting = phase === 'enter' || phase === 'sleep';
      lightAmount = Math.max(0, Math.min(1, lightAmount + dt / (lighting ? 2.8 : -1.6)));
      bedLight.intensity = 14 * lightAmount * lightAmount * (3 - 2 * lightAmount);
      const c = companion;
      if (c && !present(c.character)) { companion = null; void wake(); }
      if (c && companion === c) {
        c.elapsed += dt;
        if (c.phase === 'return') {
          c.retry -= dt;
          if (c.retry <= 0) walkHome(c);
          // 静的経路が動的障害で塞がれ続けても家具の外の安全な元の足場へ戻す。
          if (c.elapsed > 30 && companion === c) {
            const y = ctx.walkArea.standHeight(c.home.x, c.home.z, c.character);
            if (y !== null) { c.character.position.set(c.home.x, y, c.home.z); clearCompanion(c, false); }
          }
        } else if (c.phase === 'approach') {
          c.retry -= dt;
          if (c.retry <= 0 && phase === 'sleep') {
            if (c.character.position.distanceTo(c.landing) < 0.1 && c.elapsed > 1 && c.landing.x > 8) void settle(c);
            else { const route = routeToBed(c.character); if (route) approach(c, route); else clearCompanion(c, false); }
          }
          if (c.elapsed > 35 && companion === c && c.phase === 'approach') beginReturn(c);
        }
      }
      if (phase !== 'sleep') return;
      elapsed += dt;
      if (elapsed >= 60) { void wake(); return; }
      if (companion?.phase === 'asleep') {
        together += dt;
        if (together >= nextLine) { ctx.say(companion.character, 'sleep'); nextLine += 10; }
        while (rewards < 6 && together >= (rewards + 1) * 8) { ctx.addAffection(companion.character, 1); rewards++; }
        companion.character.headPosition(head);
      } else head.set(10.95, SURFACE + 0.45, -6.15);
      for (let i = 0; i < symbols.length; i++) {
        const t = (elapsed * 0.28 + i / symbols.length) % 1;
        const sprite = symbols[i]; sprite.visible = true;
        sprite.position.copy(head).add(new THREE.Vector3(Math.sin(t * 4 + i) * 0.12, 0.15 + t * 0.65, 0));
        sprite.material.opacity = Math.sin(t * Math.PI) * 0.6;
        sprite.scale.setScalar(0.12 + t * 0.1);
      }
    },
    onCharacterRemoved(character) {
      if (companion?.character !== character) return;
      clearCompanion(companion); if (phase !== 'idle') void wake();
    },
    onCharacterTouched(character) {
      if (phase !== 'idle') return true;
      if (companion?.character === character) clearCompanion(companion, false);
    },
    dispose() {
      if (disposed) return;
      disposed = true; generation++; removeBedLight();
      removeInput?.(); removeEscape?.(); handle.dispose();
      if (companion) clearCompanion(companion);
      if (phase !== 'idle') { ctx.player.setPose(null); ctx.player.setView(previousView); ctx.setTime(null); }
      ctx.director.sleeping = false; void ctx.fade(0, 0);
      proxy.removeFromParent(); proxy.geometry.dispose(); (proxy.material as THREE.Material).dispose();
      for (const sprite of symbols) { sprite.removeFromParent(); sprite.material.dispose(); }
      texture.dispose();
    },
  };
}
