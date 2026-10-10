import * as THREE from 'three';
import { buildFirstPersonArm, buildKnight, type FirstPersonArm, type KnightRig } from './knight';

/**
 * 広場を歩くプレイヤー（リバーシの勇者）。
 * - WASD / 矢印キーで移動、Shift で走る、Space でジャンプ、マウスで見回す（ポインターロック中）
 * - V で一人称 ⇔ 三人称（後ろから全身を見る）を切り替える
 * 当たり判定は main.ts から渡す standAt（その地点の床の高さ。立てなければ null）で行う。
 */

export type PlayerView = 'first' | 'third';
export type PlayerGesture = 'none' | 'wave' | 'pet';

export interface PlayerWorld {
  /** (x, z) に立てるなら床の高さ、壁・家具・崖などで立てなければ null */
  standAt(x: number, z: number): number | null;
  /** キャラとぶつかるか */
  hitsCharacter(x: number, z: number, radius: number): boolean;
}

const EYE_HEIGHT = 1.62;
/** 目の位置を体の中心より少し前に置き、うつむいた時に胴の外側が見えるようにする */
const EYE_FORWARD = 0.14;
const RADIUS = 0.3;
const WALK_SPEED = 2.3;
const RUN_SPEED = 4.4;
const JUMP_SPEED = 3.8;
const GRAVITY = 11;
/** 一度に登れる段差（m） */
const STEP_UP = 0.42;
const MOUSE_SENSITIVITY = 0.0022;
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class PlazaPlayer {
  readonly position = new THREE.Vector3();
  readonly radius = RADIUS;
  yaw = 0;
  pitch = -0.08;
  view: PlayerView = 'first';
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: PlayerWorld;
  private readonly knight: KnightRig;
  private readonly arm: FirstPersonArm;
  private readonly keys = new Set<string>();
  private velocityY = 0;
  private grounded = true;
  private speed = 0;
  private bob = 0;
  private gesture: PlayerGesture = 'none';
  private gestureUntil = 0;
  private readonly thirdOffset = new THREE.Vector3();
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onKeyUp: (event: KeyboardEvent) => void;
  private readonly onBlur: () => void;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: PlayerWorld, start: THREE.Vector3, yaw: number) {
    this.camera = camera;
    this.world = world;
    this.position.copy(start);
    this.yaw = yaw;
    this.knight = buildKnight();
    scene.add(this.knight.root);
    this.arm = buildFirstPersonArm();
    camera.add(this.arm.root);
    if (!camera.parent) scene.add(camera);
    this.setView('first');

    this.onKeyDown = (event) => {
      if (event.code in MOVE_KEYS || event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.keys.add(event.code);
      if (event.code === 'Space') {
        event.preventDefault();
        if (this.grounded) { this.velocityY = JUMP_SPEED; this.grounded = false; }
      }
    };
    this.onKeyUp = (event) => { this.keys.delete(event.code); };
    this.onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** 目の位置（キャラの向き先・届く距離の基準） */
  get eye(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x - Math.sin(this.yaw) * EYE_FORWARD,
      this.position.y + EYE_HEIGHT,
      this.position.z - Math.cos(this.yaw) * EYE_FORWARD,
    );
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * MOUSE_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * MOUSE_SENSITIVITY, -1.35, 1.25);
  }

  setView(view: PlayerView): void {
    this.view = view;
    this.knight.setFirstPerson(view === 'first');
    this.arm.root.visible = view === 'first';
  }

  toggleView(): PlayerView {
    this.setView(this.view === 'first' ? 'third' : 'first');
    return this.view;
  }

  /** 手を振る・なでる動きを seconds 秒だけ見せる */
  playGesture(gesture: PlayerGesture, seconds: number): void {
    this.gesture = gesture;
    this.gestureUntil = performance.now() + seconds * 1000;
  }

  /** 押しているキーをすべて離した扱いにする（メニューを開いた時など） */
  releaseKeys(): void {
    this.keys.clear();
  }

  private tryMove(x: number, z: number): boolean {
    const floor = this.world.standAt(x, z);
    if (floor === null) return false;
    // 登れない段差（低い所へ降りるのはよい）
    if (floor - this.position.y > STEP_UP) return false;
    if (this.world.hitsCharacter(x, z, RADIUS)) return false;
    this.position.x = x;
    this.position.z = z;
    if (this.grounded) {
      if (floor < this.position.y - 0.05) this.grounded = false;
      else this.position.y = floor;
    }
    return true;
  }

  update(dt: number, inputEnabled: boolean): void {
    let ix = 0;
    let iz = 0;
    if (inputEnabled) {
      for (const code of this.keys) {
        const dir = MOVE_KEYS[code];
        if (dir) { ix += dir[0]; iz += dir[1]; }
      }
    }
    const length = Math.hypot(ix, iz);
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const targetSpeed = length > 0 ? (running ? RUN_SPEED : WALK_SPEED) : 0;
    let moved = 0;
    if (length > 0) {
      ix /= length;
      iz /= length;
      // 前（W）はカメラの向き（-Z を yaw だけ回した向き）
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);
      const dx = (forwardX * iz + rightX * ix) * targetSpeed * dt;
      const dz = (forwardZ * iz + rightZ * ix) * targetSpeed * dt;
      // 壁に沿って滑るよう、斜め → 横だけ → 縦だけの順に試す（細かく刻んで抜けを防ぐ）
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
      for (let i = 0; i < steps; i += 1) {
        const sx = dx / steps;
        const sz = dz / steps;
        const before = this.position.clone();
        if (!this.tryMove(this.position.x + sx, this.position.z + sz)) {
          if (!this.tryMove(this.position.x + sx, this.position.z)) this.tryMove(this.position.x, this.position.z + sz);
        }
        moved += Math.hypot(this.position.x - before.x, this.position.z - before.z);
      }
    }
    const actualSpeed = dt > 0 ? moved / dt : 0;
    this.speed += (actualSpeed - this.speed) * Math.min(1, dt * 10);

    // 重力・ジャンプ・着地
    const floor = this.world.standAt(this.position.x, this.position.z);
    if (!this.grounded) {
      this.velocityY -= GRAVITY * dt;
      this.position.y += this.velocityY * dt;
      if (floor !== null && this.position.y <= floor) {
        this.position.y = floor;
        this.velocityY = 0;
        this.grounded = true;
      }
    } else if (floor !== null && floor > this.position.y) {
      this.position.y = floor;
    }

    if (this.gesture !== 'none' && performance.now() > this.gestureUntil) this.gesture = 'none';
    this.knight.setGesture(this.gesture);
    this.arm.setGesture(this.gesture);
    const walkRatio = this.speed / WALK_SPEED;
    this.knight.animate(dt, walkRatio, this.grounded);
    this.arm.animate(dt, walkRatio);
    this.knight.root.position.copy(this.position);
    // 勇者の模型は +Z が正面、カメラは -Z が正面
    this.knight.root.rotation.y = this.yaw + Math.PI;

    this.bob += dt * (7 + walkRatio * 3) * (walkRatio > 0.1 && this.grounded ? 1 : 0);
    const camera = this.camera;
    camera.rotation.order = 'YXZ';
    if (this.view === 'first') {
      const eye = this.eye;
      eye.y += Math.sin(this.bob) * 0.025 * Math.min(1.5, walkRatio);
      camera.position.copy(eye);
      camera.rotation.set(this.pitch, this.yaw, 0);
    } else {
      // 三人称：勇者の後ろ上から見る
      const target = new THREE.Vector3(this.position.x, this.position.y + 1.45, this.position.z);
      const distance = 2.9;
      this.thirdOffset.set(0, 0, distance).applyEuler(new THREE.Euler(this.pitch - 0.18, this.yaw, 0, 'YXZ'));
      camera.position.copy(target).add(this.thirdOffset);
      if (camera.position.y < this.position.y + 0.3) camera.position.y = this.position.y + 0.3;
      camera.lookAt(target);
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.knight.root.removeFromParent();
    this.arm.root.removeFromParent();
    this.knight.dispose();
    this.arm.dispose();
  }
}
