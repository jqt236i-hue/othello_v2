import * as THREE from 'three';
import type { PlazaCharacter } from '../characters';
import type { PathPoint } from './pathing';
import type { ActivityContext, PlazaActivity } from './types';
import { createPianoVoice, PIANO_SONGS, songDuration, type PianoVoice } from './pianoSynth';

interface Guest { character: PlazaCharacter; owner: object; home: THREE.Vector3; arrived: boolean; retries: number; goal: PathPoint }
interface Performance { performer: PlazaCharacter; finish: () => void; home: THREE.Vector3; approach: PathPoint; phase: 'walk' | 'play' | 'applause'; elapsed: number; song: number; voice: PianoVoice | null; guests: Guest[]; retries: number; lineAt: number; retryDelay: number }
export function createPianoActivity(ctx: ActivityContext): PlazaActivity {
  const keys = new THREE.Vector3(3.8, 1.12, -8.85), sourcePosition = new THREE.Vector3(4.3, 1.2, -8.85);
  let disposed = false, current: Performance | null = null, previousSong = -1, cooldown = 0;
  const returning = new Map<PlazaCharacter, { owner: object; home: THREE.Vector3; waiting: number; owned: boolean; walking: boolean }>();
  const fill = ctx.plaza.root.getObjectByName('PianoFill') as THREE.PointLight | undefined;
  const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const proxies = [[4.9, 1.05, -9, 3.5, 1.7, 2.2], [3.15, 0.75, -8.85, 1.15, 1.1, 0.8]].map(p => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), proxyMaterial); mesh.position.set(p[0], p[1], p[2]); return mesh;
  });
  const symbols = new THREE.Group(); symbols.name = 'PianoNotes'; ctx.scene.add(symbols);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const paint = canvas.getContext('2d')!; paint.fillStyle = '#ffe5a3'; paint.font = '96px serif'; paint.textAlign = 'center'; paint.fillText('♪', 64, 100);
  const texture = new THREE.CanvasTexture(canvas);
  const noteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  for (let i = 0; i < 5; i++) { const sprite = new THREE.Sprite(noteMaterial); sprite.scale.setScalar(0.28); symbols.add(sprite); }
  symbols.visible = false;

  function releaseGuest(guest: Guest) { guest.character.lookAt(null); guest.character.release(guest.owner); }
  function returnHome(character: PlazaCharacter, home: THREE.Vector3) {
    if (disposed || ![...ctx.visitors.values()].includes(character)) return;
    const item = { owner: {}, home, waiting: 0.5, owned: false, walking: false }; returning.set(character, item);
  }
  function finish(success: boolean, removed?: PlazaCharacter) {
    const s = current; if (!s) return; current = null; cooldown = 60 + Math.random() * 46; // directorの次の抽選（最大14秒）を含め60〜120秒
    s.voice?.stop(); symbols.visible = false; if (fill) fill.intensity = 0;
    s.performer.stopPath(false); s.performer.lookAt(null);
    if (s.phase !== 'walk') s.performer.position.set(s.approach.x, s.approach.y, s.approach.z);
    s.finish();
    if (s.performer !== removed) returnHome(s.performer, s.home);
    for (const guest of s.guests) { releaseGuest(guest); if (guest.character !== removed) returnHome(guest.character, guest.home); }
    // 報酬は完奏して拍手が始まる時だけ。割込み・失敗では与えない。
    void success;
  }
  function pathToBench(c: PlazaCharacter): PathPoint[] | null {
    for (const [x, z] of [[2.25, -8.75], [2, -8.5], [1.75, -8.25], [1.5, -8]]) {
      const path = ctx.pathing.find(c.position, { x, z }, c); if (path) return path;
    }
    return null;
  }
  function collectGuests(s: Performance) {
    const spots = [[1.5, -7.5], [0.5, -8.25], [2.5, -6.5], [1, -6.75]];
    for (const c of ctx.visitors.values()) {
      if (c === s.performer || c.isBusy || s.guests.length >= (ctx.isTouch ? 2 : 3)) continue;
      for (const [x, z] of spots) {
        if (Math.hypot(s.approach.x - x, s.approach.z - z) < c.radius + s.performer.radius + 0.35) continue;
        if (s.guests.some(g => Math.hypot(g.goal.x - x, g.goal.z - z) < c.radius + g.character.radius + 0.35)) continue;
        const path = ctx.pathing.find(c.position, { x, z }, c); if (!path) continue;
        const guest: Guest = { character: c, owner: {}, home: c.position.clone(), arrived: false, retries: 0, goal: path[path.length - 1] };
        if (!c.claim(guest.owner, () => removeGuest(c))) break;
        s.guests.push(guest); walkGuest(s, guest, path); break;
      }
    }
  }
  function removeGuest(c: PlazaCharacter) {
    const s = current; if (!s) return; const index = s.guests.findIndex(g => g.character === c); if (index < 0) return;
    const [guest] = s.guests.splice(index, 1); releaseGuest(guest); returnHome(c, guest.home);
  }
  function walkGuest(s: Performance, guest: Guest, path: PathPoint[]) {
    guest.character.walkPath(path, 0.95, arrived => {
      if (current !== s || !s.guests.includes(guest)) return;
      if (!arrived) {
        const retry = guest.retries++ < 1 && ctx.pathing.find(guest.character.position, guest.goal, guest.character);
        if (retry) walkGuest(s, guest, retry); else removeGuest(guest.character); return;
      }
      guest.arrived = true; guest.character.lookAt(keys); guest.character.setPose({ posture: 'stand', rhythm: PIANO_SONGS[s.song].bpm / 120, breathing: true }); ctx.say(guest.character, 'listen');
    });
  }
  function seat(s: Performance) {
    if (current !== s) return;
    s.phase = 'play'; s.elapsed = 0;
    // rootの沈み込みを相殺。小柄なキャラは鍵盤まで少し浮く自然な魔法の演奏。
    const c = s.performer, boost = Math.max(0, 0.85 - c.height) * 0.35;
    c.position.set(3.18, 0.93 + c.height * 0.28 + boost, -8.85);
    c.root.rotation.y = Math.PI / 2; c.lookAt(keys); c.setPose({ posture: 'sit', breathing: true, rhythm: PIANO_SONGS[s.song].bpm / 120 });
    ctx.say(c, 'pianoPlay'); symbols.visible = true; if (fill) fill.intensity = 5;
    const audio = ctx.audio.context(); if (audio && ctx.audio.master) s.voice = createPianoVoice(audio, ctx.audio.master, PIANO_SONGS[s.song]);
    collectGuests(s);
  }
  function walkPerformer(s: Performance, path: PathPoint[]) {
    s.performer.walkPath(path, 1.1, arrived => {
      if (current !== s) return;
      if (arrived) seat(s);
      else if (s.retries++ < 4) s.retryDelay = 1; else finish(false);
    });
  }
  function start(c: PlazaCharacter, end: () => void, path: PathPoint[]) {
    const song = (previousSong + 1 + Math.floor(Math.random() * (PIANO_SONGS.length - 1))) % PIANO_SONGS.length; previousSong = song;
    const s: Performance = { performer: c, finish: end, home: c.position.clone(), approach: path[path.length - 1], phase: 'walk', elapsed: 0, song, voice: null, guests: [], retries: 0, lineAt: 11, retryDelay: 0 };
    current = s; walkPerformer(s, path);
  }
  function request() {
    if (disposed || current || ctx.director.sleeping) return;
    const candidates = [...ctx.visitors.values()].filter(c => !c.isBusy && !returning.has(c)).map(c => ({ c, tie: Math.random() })).sort((a, b) => ctx.hearts(b.c) - ctx.hearts(a.c) || a.tie - b.tie);
    for (const { c } of candidates) { const path = pathToBench(c); if (!path) continue; const owner = {}; if (c.claim(owner, () => finish(false))) { start(c, () => c.release(owner), path); break; } }
  }
  const handles = proxies.map((proxy, i) => ctx.addInteractable({ id: i ? 'piano-bench' : 'piano', label: i ? 'ベンチ' : 'ピアノ', action: '弾いてもらう', proxy, enabled: () => !disposed && !current && !ctx.director.sleeping, interact: request }));
  const unregister = ctx.director.register({ id: 'piano', interval: [8, 14], probability: 1, participants: 1, maxConcurrent: 1,
    eligible: c => !disposed && !current && cooldown <= 0 && !returning.has(c),
    start([c], end) { if (current || cooldown > 0) return false; const path = pathToBench(c); if (!path) return false; start(c, end, path); return true; },
  });
  return {
    update(dt) {
      if (disposed) return; cooldown = Math.max(0, cooldown - dt);
      for (const [c, item] of returning) {
        item.waiting -= dt; if (item.waiting > 0 || item.walking || (c.isBusy && !item.owned)) continue;
        if (!item.owned) { if (!c.claim(item.owner, () => { returning.delete(c); c.lookAt(null); c.release(item.owner); })) continue; item.owned = true; }
        const path = ctx.pathing.find(c.position, item.home, c) ?? ctx.pathing.find(c.position, { x: 0, z: -2 }, c);
        // プレイヤー等で出口がふさがれている間は、家具の脇で待つ。通路が空けば再探索。
        if (!path) { item.waiting = 2; continue; }
        item.walking = true;
        c.walkPath(path, 1, arrived => { if (returning.get(c) !== item) return; item.walking = false; if (arrived) { returning.delete(c); c.release(item.owner); } else item.waiting = 2; });
      }
      const s = current; if (!s) return; s.elapsed += dt;
      if (s.phase === 'walk') {
        if (s.elapsed > 50) { finish(false); return; }
        if (s.retryDelay > 0) { s.retryDelay -= dt; if (s.retryDelay <= 0) { const path = pathToBench(s.performer); if (path) { s.approach = path[path.length - 1]; walkPerformer(s, path); } else if (s.retries++ < 4) s.retryDelay = 1; else finish(false); } }
        return;
      }
      if (fill) fill.intensity = s.phase === 'play' ? 5 : 0;
      if (s.phase === 'applause') { if (s.elapsed >= 2) finish(true); return; }
      const delta = sourcePosition.clone().sub(ctx.camera.position), right = new THREE.Vector3(1, 0, 0).applyQuaternion(ctx.camera.quaternion);
      s.voice?.update(delta.length(), delta.normalize().dot(right) * 0.85);
      symbols.children.forEach((sprite, i) => { const t = (s.elapsed * 0.32 + i / 5) % 1; sprite.position.set(3.9 + Math.sin(t * 5 + i) * 0.65, 1.6 + t * 1.4, -8.9 + Math.cos(t * 5 + i) * 0.65); sprite.scale.setScalar(0.2 + Math.sin(t * Math.PI) * 0.13); });
      if (s.elapsed >= s.lineAt) { s.lineAt += 12 + Math.random() * 7; const guest = s.guests.find(g => g.arrived); if (guest) ctx.say(guest.character, 'listen'); }
      if (s.elapsed >= songDuration(PIANO_SONGS[s.song])) {
        s.phase = 'applause'; s.elapsed = 0; s.voice?.stop(); s.voice = null; symbols.visible = false;
        ctx.addAffection(s.performer, 2); ctx.spawnHearts(s.performer, 3);
        for (const g of s.guests) if (g.arrived) { g.character.setPose({ posture: 'stand', bounce: true }); ctx.addAffection(g.character, 1); ctx.spawnHearts(g.character, 2); }
      }
    },
    onCharacterTouched(c) { if (current?.performer === c) finish(false); else removeGuest(c); const item = returning.get(c); if (item) { returning.delete(c); c.release(item.owner); returnHome(c, item.home); const pending = returning.get(c); if (pending) pending.waiting = 3; } },
    onCharacterRemoved(c) { if (current?.performer === c) finish(false, c); else removeGuest(c); const item = returning.get(c); if (item) { returning.delete(c); c.release(item.owner); } },
    dispose() {
      if (disposed) return; disposed = true; finish(false); unregister();
      for (const [c, item] of returning) { c.lookAt(null); c.release(item.owner); } returning.clear();
      for (const handle of handles) handle.dispose(); for (const proxy of proxies) { proxy.removeFromParent(); proxy.geometry.dispose(); } proxyMaterial.dispose();
      symbols.removeFromParent(); symbols.clear(); noteMaterial.dispose(); texture.dispose(); if (fill) fill.intensity = 0;
    },
  };
}
