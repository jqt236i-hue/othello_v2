import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { PlazaCharacterKind } from './lines';

/**
 * 広場を歩き回るキャラ（1 体 = 1 つの GLB）。
 * 歩く・立ち止まる・タップへの反応・なでられた時の伸び縮みを、GLB のアニメーションと
 * 手続きの動き（跳ねる・傾く）を重ねて表す。
 */

export interface PlazaCharacterInfo {
  id: string;
  label: string;
  kind: PlazaCharacterKind;
  url: string;
  height: number;
  animations: string[];
  bytes: number;
}

type ClipTag = 'idle' | 'move' | 'action' | 'dance';

const CLIP_CANDIDATES: Record<ClipTag, RegExp[]> = {
  idle: [/^Idle$/i, /Sway/i],
  move: [/^Walk$/i, /^Move$/i, /^Fly$/i, /Walk/i],
  action: [/^Action$/i],
  dance: [/Dance/i],
};

function resolveClip(clips: THREE.AnimationClip[], tag: ClipTag): THREE.AnimationClip | null {
  for (const pattern of CLIP_CANDIDATES[tag]) {
    const clip = clips.find((candidate) => pattern.test(candidate.name));
    if (clip) return clip;
  }
  return null;
}

/** 広場で見せる高さ（m）。小さすぎる・大きすぎる素材は見やすい範囲に収める */
function displayHeight(info: PlazaCharacterInfo): number {
  if (info.kind === 'manifest') return 1.85;
  return THREE.MathUtils.clamp(info.height, 0.55, 2.3) * (info.height <= 1.3 ? 0.85 : 0.8);
}

let sharedLoader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!sharedLoader) {
    sharedLoader = new GLTFLoader();
    sharedLoader.setMeshoptDecoder(MeshoptDecoder);
  }
  return sharedLoader;
}

type CharacterState = 'idle' | 'walk' | 'react' | 'petted';

export interface WalkArea {
  /** その場所に立てるか（家具や他のキャラと重ならないか）を調べて、足元の高さを返す。立てなければ null */
  standHeight(x: number, z: number, self: PlazaCharacter | null): number | null;
  /** 他のキャラとぶつからないか（毎フレーム呼ぶ軽い判定） */
  isFree(x: number, z: number, self: PlazaCharacter): boolean;
  /** 歩ける範囲から候補の地点を 1 つ選ぶ */
  randomPoint(): THREE.Vector2;
}

export class PlazaCharacter {
  readonly info: PlazaCharacterInfo;
  readonly root = new THREE.Group();
  /** 当たり判定（見えない円柱。形そのものより判定が軽い） */
  readonly hitProxy: THREE.Mesh;
  readonly height: number;
  readonly radius: number;
  private readonly body = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly model: THREE.Object3D;
  private readonly actions: Partial<Record<ClipTag, THREE.AnimationAction>> = {};
  private currentClip: ClipTag | null = null;
  private state: CharacterState = 'idle';
  private stateTime = 0;
  private stateDuration = 2;
  private readonly target = new THREE.Vector3();
  private startY = 0;
  private targetY = 0;
  private walkDistance = 0;
  private readonly walkStart = new THREE.Vector3();
  private yaw = 0;
  private desiredYaw = 0;
  private hopPhase = 0;
  private squash = 0;
  private squashVelocity = 0;
  private reactSpin = 0;
  private reactJump = 0;
  private faceTarget: THREE.Vector3 | null = null;
  private disposed = false;

  private constructor(info: PlazaCharacterInfo, gltfScene: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.info = info;
    this.model = gltfScene;
    this.height = displayHeight(info);
    this.mixer = new THREE.AnimationMixer(gltfScene);

    gltfScene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      // スキンメッシュは動くと視錐台の判定から外れて消えることがあるため無効にする
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
    });

    const idle = resolveClip(clips, 'idle');
    const dance = resolveClip(clips, 'dance');
    const move = resolveClip(clips, 'move');
    const action = resolveClip(clips, 'action');
    if (idle) this.actions.idle = this.mixer.clipAction(idle);
    if (dance) this.actions.dance = this.mixer.clipAction(dance);
    if (move) this.actions.move = this.mixer.clipAction(move);
    if (action) {
      const a = this.mixer.clipAction(action);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = false;
      this.actions.action = a;
    }

    // 実測の高さで拡大し、足元を地面に合わせる（待機の最初の姿勢で測る）
    const first = this.actions.idle ?? this.actions.dance;
    if (first) { first.play(); this.mixer.update(0); }
    gltfScene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    gltfScene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        const skinned = mesh as THREE.SkinnedMesh;
        skinned.computeBoundingBox();
        if (skinned.boundingBox) part.copy(skinned.boundingBox);
      } else {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) part.copy(mesh.geometry.boundingBox);
      }
      part.applyMatrix4(mesh.matrixWorld);
      box.union(part);
    });
    const measured = box.isEmpty() ? { minY: 0, height: info.height || 1, width: 0.8 } : {
      minY: box.min.y,
      height: Math.max(0.2, box.max.y - box.min.y),
      width: Math.max(box.max.x - box.min.x, box.max.z - box.min.z),
    };
    const scale = this.height / measured.height;
    gltfScene.scale.setScalar(scale);
    gltfScene.position.y = -measured.minY * scale;
    this.radius = THREE.MathUtils.clamp(measured.width * scale * 0.5, 0.25, 0.9);
    this.playClip('idle', 0);

    this.body.add(gltfScene);
    this.root.add(this.body);

    const proxyGeometry = new THREE.CylinderGeometry(this.radius * 1.1, this.radius * 1.1, this.height * 1.05, 10);
    proxyGeometry.translate(0, this.height * 0.525, 0);
    this.hitProxy = new THREE.Mesh(proxyGeometry, new THREE.MeshBasicMaterial({ visible: false }));
    this.hitProxy.userData.plazaCharacter = this;
    this.root.add(this.hitProxy);

    // 種類ごとに少しずつ動きの速さを変えて、同じ動きにそろわないようにする
    this.mixer.timeScale = 0.9 + Math.random() * 0.2;
    this.hopPhase = Math.random() * Math.PI * 2;
  }

  static async load(info: PlazaCharacterInfo, baseUrl: string): Promise<PlazaCharacter> {
    const gltf = await getLoader().loadAsync(new URL(info.url, baseUrl).href);
    return new PlazaCharacter(info, gltf.scene, gltf.animations);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  /** 頭の上（吹き出しやハートを出す位置） */
  headPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.root.position).setY(this.root.position.y + this.height * (1 + this.squash * 0.2) + 0.15);
  }

  placeAt(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
    this.yaw = Math.random() * Math.PI * 2;
    this.desiredYaw = this.yaw;
    this.root.rotation.y = this.yaw;
    this.enterIdle(1 + Math.random() * 3);
  }

  private playClip(tag: ClipTag, fade: number): void {
    // 待機の代わりに踊りしかない素材（観測者たち）は踊りを待機にする
    const resolved = this.actions[tag] ? tag : (tag === 'idle' && this.actions.dance ? 'dance' : 'idle');
    if (this.currentClip === resolved) return;
    const next = this.actions[resolved];
    if (!next) return;
    const prev = this.currentClip ? this.actions[this.currentClip] : undefined;
    next.reset().setEffectiveWeight(1).play();
    if (prev && prev !== next) prev.crossFadeTo(next, fade, false);
    this.currentClip = resolved;
  }

  private enterIdle(duration: number): void {
    this.state = 'idle';
    this.stateTime = 0;
    this.stateDuration = duration;
    this.faceTarget = null;
    this.playClip('idle', 0.35);
  }

  private tryStartWalk(area: WalkArea): void {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const point = area.randomPoint();
      const dx = point.x - this.root.position.x;
      const dz = point.y - this.root.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 1.2 || distance > 6) continue;
      const y = area.standHeight(point.x, point.y, this);
      if (y === null) continue;
      // 途中に家具が無いか、0.5m ごとに確かめる
      let blocked = false;
      const steps = Math.ceil(distance / 0.5);
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        if (area.standHeight(this.root.position.x + dx * t, this.root.position.z + dz * t, this) === null) { blocked = true; break; }
      }
      if (blocked) continue;
      this.target.set(point.x, y, point.y);
      this.walkStart.copy(this.root.position);
      this.startY = this.root.position.y;
      this.targetY = y;
      this.walkDistance = distance;
      this.desiredYaw = Math.atan2(dx, dz);
      this.state = 'walk';
      this.stateTime = 0;
      this.playClip('move', 0.3);
      return;
    }
    this.enterIdle(1.5 + Math.random() * 2);
  }

  /** タップされた：振り向いて跳ねる */
  react(camera: THREE.Vector3): void {
    this.state = 'react';
    this.stateTime = 0;
    this.stateDuration = 2.4;
    this.faceTarget = camera.clone();
    this.reactJump = 1;
    this.reactSpin = Math.random() < 0.35 ? Math.PI * 2 : 0;
    this.squashVelocity -= 3;
    if (this.actions.action) {
      if (this.currentClip === 'action') this.actions.action.reset().play();
      else this.playClip('action', 0.15);
    } else {
      this.playClip('idle', 0.25);
    }
  }

  /** なでられている：その場で止まり、こちらを向いて伸び縮みする */
  pet(camera: THREE.Vector3): void {
    if (this.state !== 'petted') {
      this.state = 'petted';
      this.playClip('idle', 0.25);
    }
    this.stateTime = 0;
    this.stateDuration = 1.6;
    this.faceTarget = camera.clone();
    this.squashVelocity -= 2.2;
  }

  update(dt: number, area: WalkArea): void {
    if (this.disposed) return;
    this.mixer.update(dt);
    this.stateTime += dt;

    switch (this.state) {
      case 'idle':
        if (this.stateTime >= this.stateDuration) this.tryStartWalk(area);
        break;
      case 'walk': {
        const speed = 0.55 + this.height * 0.18;
        const pos = this.root.position;
        const dx = this.target.x - pos.x;
        const dz = this.target.z - pos.z;
        const remaining = Math.hypot(dx, dz);
        if (remaining < 0.05) {
          this.enterIdle(2 + Math.random() * 5);
          break;
        }
        const step = Math.min(remaining, speed * dt);
        const nx = pos.x + (dx / remaining) * step;
        const nz = pos.z + (dz / remaining) * step;
        // 歩いている途中に他のキャラが割り込んだら止まる
        if (!area.isFree(nx, nz, this)) {
          this.enterIdle(0.8 + Math.random());
          break;
        }
        pos.x = nx;
        pos.z = nz;
        const traveled = Math.hypot(pos.x - this.walkStart.x, pos.z - this.walkStart.z);
        pos.y = THREE.MathUtils.lerp(this.startY, this.targetY, Math.min(1, traveled / Math.max(0.01, this.walkDistance)));
        this.desiredYaw = Math.atan2(dx, dz);
        if (!this.actions.move) this.hopPhase += dt * 9;
        break;
      }
      case 'react':
      case 'petted':
        if (this.stateTime >= this.stateDuration) this.enterIdle(1.5 + Math.random() * 2.5);
        break;
      default:
        break;
    }

    if (this.faceTarget) {
      this.desiredYaw = Math.atan2(this.faceTarget.x - this.root.position.x, this.faceTarget.z - this.root.position.z);
    }
    let delta = this.desiredYaw - this.yaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.yaw += delta * Math.min(1, dt * 6);

    // 手続きの動き：跳ねる・回る・伸び縮み（ばねで戻す）
    this.squashVelocity += (-this.squash * 60 - this.squashVelocity * 7) * dt;
    this.squash += this.squashVelocity * dt;
    let lift = 0;
    if (this.state === 'walk' && !this.actions.move) lift = Math.abs(Math.sin(this.hopPhase)) * 0.12 * this.height;
    if (this.reactJump > 0) {
      this.reactJump = Math.max(0, this.reactJump - dt * 1.8);
      const k = 1 - this.reactJump;
      lift += Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.35 * Math.min(1.4, this.height);
    }
    let spin = 0;
    if (this.reactSpin > 0) {
      const done = Math.min(1, this.stateTime / 0.7);
      spin = this.reactSpin * (1 - Math.pow(1 - done, 3));
      if (done >= 1) this.reactSpin = 0;
    }
    this.root.rotation.y = this.yaw + spin;
    this.body.position.y = lift;
    const s = THREE.MathUtils.clamp(this.squash, -0.35, 0.35);
    this.body.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
  }

  dispose(): void {
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.root.removeFromParent();
    this.hitProxy.geometry.dispose();
    (this.hitProxy.material as THREE.Material).dispose();
    this.model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
        }
        material.dispose();
      }
      const skinned = mesh as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh) skinned.skeleton.dispose();
    });
  }
}
