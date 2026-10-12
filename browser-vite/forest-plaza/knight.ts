import * as THREE from 'three';

/**
 * プレイヤーの姿「リバーシの勇者」（黒い鎧・閉じた兜・マント）を three.js の基本形状で組み立てる。
 * 添付の立ち絵を元にした簡易モデルで、完全な再現ではない。
 * - 全身（三人称視点・影）: buildKnight()
 * - 一人称視点で画面右下に見える右腕: buildFirstPersonArm()
 */

interface KnightMaterials {
  armor: THREE.MeshStandardMaterial;
  armorDark: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  visor: THREE.MeshStandardMaterial;
}

function createMaterials(): KnightMaterials {
  return {
    armor: new THREE.MeshStandardMaterial({ color: 0x3a3b42, metalness: 0.85, roughness: 0.38 }),
    armorDark: new THREE.MeshStandardMaterial({ color: 0x24252b, metalness: 0.8, roughness: 0.45 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x1b1a1e, metalness: 0, roughness: 0.92, side: THREE.DoubleSide }),
    leather: new THREE.MeshStandardMaterial({ color: 0x3b2a20, metalness: 0.1, roughness: 0.7 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x8a744a, metalness: 0.9, roughness: 0.35 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.2, roughness: 0.6, emissive: 0x0c1a1c, emissiveIntensity: 1 }),
  };
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 肩から先の腕（肩当て・上腕・肘・籠手・手）。原点が肩、-Y 方向へ垂れる */
function buildArm(mats: KnightMaterials, side: 1 | -1): THREE.Group {
  const arm = new THREE.Group();
  const pauldron = mesh(new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.armor, 0.01 * side, 0.03, 0);
  pauldron.scale.set(1.15, 0.9, 1.05);
  arm.add(pauldron);
  const pauldronRim = mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 18), mats.trim, 0.01 * side, 0.0, 0);
  pauldronRim.rotation.x = Math.PI / 2;
  arm.add(pauldronRim);
  arm.add(mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.26, 10), mats.armorDark, 0, -0.15, 0));
  const elbow = new THREE.Group();
  elbow.position.set(0, -0.3, 0);
  elbow.name = 'elbow';
  elbow.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), mats.armor));
  // 前腕：重ねた板金と、手首で広がる籠手の袖口
  elbow.add(mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.2, 12), mats.armorDark, 0, -0.11, 0));
  for (const [y, r] of [[-0.05, 0.058], [-0.11, 0.054], [-0.17, 0.05]] as const) {
    elbow.add(mesh(new THREE.CylinderGeometry(r, r * 0.95, 0.045, 12), mats.armor, 0, y, 0));
  }
  const ridge = mesh(new THREE.BoxGeometry(0.014, 0.17, 0.02), mats.trim, 0, -0.11, 0.055);
  elbow.add(ridge);
  const flare = mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.06, 12, 1, true), mats.armor, 0, -0.225, 0);
  elbow.add(flare);
  // 手：甲・指 4 本・親指（籠手の黒い指）
  const hand = new THREE.Group();
  hand.name = 'hand';
  hand.position.set(0, -0.29, 0);
  hand.add(mesh(new THREE.BoxGeometry(0.08, 0.075, 0.035), mats.armorDark));
  hand.add(mesh(new THREE.BoxGeometry(0.082, 0.03, 0.04), mats.armor, 0, 0.005, 0.006));
  for (let i = 0; i < 4; i += 1) {
    const finger = mesh(new THREE.BoxGeometry(0.017, 0.06, 0.02), mats.armorDark, (i - 1.5) * 0.02, -0.065, 0.004);
    finger.rotation.x = 0.25;
    hand.add(finger);
  }
  const thumb = mesh(new THREE.BoxGeometry(0.02, 0.05, 0.022), mats.armorDark, -0.048 * side, -0.02, 0.018);
  thumb.rotation.z = 0.5 * side;
  hand.add(thumb);
  elbow.add(hand);
  arm.add(elbow);
  return arm;
}

/** 腰から先の脚（腿・膝・すね当て・ブーツ）。原点が股関節 */
function buildLeg(mats: KnightMaterials): THREE.Group {
  const leg = new THREE.Group();
  leg.add(mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.42, 10), mats.armorDark, 0, -0.22, 0));
  const knee = new THREE.Group();
  knee.position.set(0, -0.45, 0);
  knee.name = 'knee';
  const kneeCap = mesh(new THREE.SphereGeometry(0.06, 10, 8), mats.armor, 0, 0, 0.025);
  kneeCap.scale.set(1, 1, 0.9);
  knee.add(kneeCap);
  knee.add(mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.38, 10), mats.armor, 0, -0.21, 0));
  const boot = mesh(new THREE.BoxGeometry(0.11, 0.09, 0.22), mats.leather, 0, -0.43, 0.04);
  knee.add(boot);
  const toe = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.06), mats.armorDark, 0, -0.45, 0.16);
  knee.add(toe);
  leg.add(knee);
  return leg;
}

/** マント：背中で丸く、裾が広がる布。原点は首の後ろ */
function buildCape(mats: KnightMaterials): THREE.Mesh {
  const width = 0.78;
  const length = 1.38;
  const geometry = new THREE.PlaneGeometry(width, length, 10, 14);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (length / 2 - y) / length; // 0 = 首、1 = 裾
    const spread = 1 + t * 0.55;
    const nx = x * spread;
    const curve = -Math.pow(nx / (width * 0.5 * spread), 2) * (0.12 + t * 0.06);
    pos.setXYZ(i, nx, y - length / 2, curve - t * 0.12 + Math.sin(nx * 9) * 0.015 * t);
  }
  geometry.computeVertexNormals();
  const cape = mesh(geometry, mats.cloth);
  cape.name = 'cape';
  return cape;
}

export interface KnightRig {
  root: THREE.Group;
  /** 歩きの速さ（0〜1 程度。走ると 1 を超える）と経過時間で手足とマントを動かす */
  animate(dt: number, speed: number, grounded: boolean): void;
  /** あいさつ（手を振る）・なでる（腕を前へ）の動き */
  setGesture(gesture: 'none' | 'wave' | 'pet'): void;
  /** 一人称視点では、目の前に来る兜・腕・襟を隠して胴と脚だけ見せる */
  setFirstPerson(firstPerson: boolean): void;
  dispose(): void;
}

export function buildKnight(): KnightRig {
  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = 'KnightPlayer';
  const body = new THREE.Group();
  root.add(body);

  // 胴体
  const torso = mesh(new THREE.CapsuleGeometry(0.19, 0.26, 6, 14), mats.armor, 0, 1.3, 0);
  torso.scale.set(1.05, 1, 0.72);
  body.add(torso);
  const chestRidge = mesh(new THREE.BoxGeometry(0.03, 0.3, 0.06), mats.armorDark, 0, 1.33, 0.13);
  body.add(chestRidge);
  const gorget = mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.1, 14), mats.armorDark, 0, 1.55, 0);
  body.add(gorget);
  const belt = mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 20), mats.leather, 0, 1.05, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.1, 0.8, 1);
  body.add(belt);
  const buckle = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), mats.trim, 0, 1.05, 0.15);
  body.add(buckle);
  // 草摺（腰の板）
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const plate = mesh(new THREE.BoxGeometry(0.12, 0.17, 0.02), mats.armorDark, Math.sin(a) * 0.18, 0.95, Math.cos(a) * 0.13);
    plate.rotation.y = a;
    plate.rotation.x = -0.18;
    body.add(plate);
  }
  // 兜
  const head = new THREE.Group();
  head.position.set(0, 1.68, 0);
  const helm = mesh(new THREE.SphereGeometry(0.125, 18, 14), mats.armor);
  helm.scale.set(0.95, 1.18, 1.05);
  head.add(helm);
  const faceplate = mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.16, 14, 1, false, -Math.PI * 0.45, Math.PI * 0.9), mats.armorDark, 0, -0.03, 0.012);
  head.add(faceplate);
  const visor = mesh(new THREE.BoxGeometry(0.15, 0.018, 0.04), mats.visor, 0, 0.015, 0.11);
  head.add(visor);
  const crest = mesh(new THREE.BoxGeometry(0.018, 0.08, 0.24), mats.armorDark, 0, 0.13, -0.01);
  head.add(crest);
  body.add(head);
  // マントの襟（肩を覆う布）
  const mantle = mesh(new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), mats.cloth, 0, 1.5, -0.02);
  mantle.scale.set(1.2, 0.8, 0.95);
  body.add(mantle);
  const cape = buildCape(mats);
  cape.position.set(0, 1.56, -0.13);
  body.add(cape);

  const leftArm = buildArm(mats, -1);
  leftArm.position.set(-0.27, 1.5, 0);
  const rightArm = buildArm(mats, 1);
  rightArm.position.set(0.27, 1.5, 0);
  body.add(leftArm, rightArm);
  const leftLeg = buildLeg(mats);
  leftLeg.position.set(-0.1, 0.95, 0);
  const rightLeg = buildLeg(mats);
  rightLeg.position.set(0.1, 0.95, 0);
  body.add(leftLeg, rightLeg);

  const leftElbow = leftArm.getObjectByName('elbow') as THREE.Object3D;
  const rightElbow = rightArm.getObjectByName('elbow') as THREE.Object3D;
  const leftKnee = leftLeg.getObjectByName('knee') as THREE.Object3D;
  const rightKnee = rightLeg.getObjectByName('knee') as THREE.Object3D;

  let phase = 0;
  let time = 0;
  let gesture: 'none' | 'wave' | 'pet' = 'none';
  let gestureBlend = 0;

  function animate(dt: number, speed: number, grounded: boolean): void {
    time += dt;
    const walk = Math.min(1.4, speed);
    phase += dt * (4 + walk * 5) * (walk > 0.05 ? 1 : 0);
    const swing = Math.sin(phase) * 0.55 * Math.min(1, walk);
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftKnee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.7 * Math.min(1, walk);
    rightKnee.rotation.x = Math.max(0, Math.sin(phase)) * 0.7 * Math.min(1, walk);
    if (!grounded) {
      leftLeg.rotation.x = -0.35; rightLeg.rotation.x = 0.2; leftKnee.rotation.x = 0.6; rightKnee.rotation.x = 0.3;
    }
    body.position.y = Math.abs(Math.sin(phase)) * 0.03 * Math.min(1, walk);
    leftArm.rotation.x = -swing * 0.7;
    leftArm.rotation.z = -0.12;
    leftElbow.rotation.x = -0.25 - Math.max(0, swing) * 0.3;
    gestureBlend += ((gesture === 'none' ? 0 : 1) - gestureBlend) * Math.min(1, dt * 8);
    const idleRight = { x: swing * 0.7, z: 0.12, elbow: -0.25 - Math.max(0, -swing) * 0.3 };
    let gx = idleRight.x;
    let gz = idleRight.z;
    let ge = idleRight.elbow;
    if (gesture === 'wave') {
      gx = -0.2; gz = 2.5 + Math.sin(time * 12) * 0.25; ge = -0.4;
    } else if (gesture === 'pet') {
      gx = -1.25; gz = 0.15 + Math.sin(time * 9) * 0.25; ge = -0.35;
    }
    rightArm.rotation.x = THREE.MathUtils.lerp(idleRight.x, gx, gestureBlend);
    rightArm.rotation.z = THREE.MathUtils.lerp(idleRight.z, gz, gestureBlend);
    rightElbow.rotation.x = THREE.MathUtils.lerp(idleRight.elbow, ge, gestureBlend);
    cape.rotation.x = 0.06 + Math.min(1.4, walk) * 0.32 + Math.sin(time * 1.7 + phase * 0.5) * 0.04 + (grounded ? 0 : 0.35);
    head.rotation.y = Math.sin(time * 0.6) * 0.04;
  }

  function setGesture(next: 'none' | 'wave' | 'pet'): void {
    gesture = next;
  }

  function setFirstPerson(firstPerson: boolean): void {
    for (const part of [head, leftArm, rightArm, mantle, gorget]) part.visible = !firstPerson;
  }

  function dispose(): void {
    root.traverse((object) => {
      const m = object as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    Object.values(mats).forEach((material) => material.dispose());
  }

  return { root, animate, setGesture, setFirstPerson, dispose };
}

export interface FirstPersonArm {
  root: THREE.Group;
  animate(dt: number, speed: number): void;
  setGesture(gesture: 'none' | 'wave' | 'pet'): void;
  dispose(): void;
}

/** 一人称視点の右腕（カメラの子にする）。画面の右下に籠手と手が見え、歩くと揺れ、あいさつで手を振り、なでる時は前へ伸ばす */
export function buildFirstPersonArm(): FirstPersonArm {
  const mats = createMaterials();
  const root = new THREE.Group();
  // 肘から先（籠手と手）だけを使う。原点が肘、-Y 方向に手がある
  const source = buildArm(mats, 1);
  const forearm = source.getObjectByName('elbow') as THREE.Object3D;
  forearm.removeFromParent();
  forearm.position.set(0, 0, 0);
  forearm.traverse((object) => {
    const m = object as THREE.Mesh;
    if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; }
  });
  // マントの袖口を少し見せて、勇者の腕らしくする
  const sleeve = mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.09, 12, 1, true), mats.cloth, 0, 0.02, 0);
  sleeve.castShadow = false;
  forearm.add(sleeve);
  root.add(forearm);
  source.traverse((object) => {
    const m = object as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });

  const rest = { x: 0.26, y: -0.25, z: -0.24, pitch: 1.75, yaw: 0.55, roll: 0.35 };
  let time = 0;
  let bob = 0;
  let gesture: 'none' | 'wave' | 'pet' = 'none';
  let blend = 0;

  function animate(dt: number, speed: number): void {
    time += dt;
    const walk = Math.min(1.4, speed);
    bob += dt * (6 + speed * 5) * (speed > 0.05 ? 1 : 0);
    blend += ((gesture === 'none' ? 0 : 1) - blend) * Math.min(1, dt * 10);
    // pitch: X 軸の回転。π/2 で手が真正面（-Z）、それより大きいと上を向く
    let pitch = rest.pitch;
    let yaw = rest.yaw;
    let roll = rest.roll;
    let x = rest.x + Math.sin(bob) * 0.012 * walk;
    let y = rest.y + Math.abs(Math.cos(bob)) * 0.012 * walk + Math.sin(time * 1.6) * 0.004;
    let z = rest.z;
    if (gesture === 'wave') {
      pitch = THREE.MathUtils.lerp(pitch, 2.5, blend);
      roll = THREE.MathUtils.lerp(roll, 0.1 + Math.sin(time * 12) * 0.35, blend);
      y += 0.06 * blend;
    } else if (gesture === 'pet') {
      pitch = THREE.MathUtils.lerp(pitch, 1.62, blend);
      yaw = THREE.MathUtils.lerp(yaw, 0.15 + Math.sin(time * 9) * 0.2, blend);
      z -= 0.12 * blend;
      x -= 0.06 * blend;
      y += 0.03 * blend;
    }
    forearm.rotation.set(pitch, yaw, roll, 'YXZ');
    forearm.position.set(x, y, z);
  }

  function setGesture(next: 'none' | 'wave' | 'pet'): void {
    gesture = next;
  }

  function dispose(): void {
    root.traverse((object) => {
      const m = object as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    Object.values(mats).forEach((material) => material.dispose());
  }

  return { root, animate, setGesture, dispose };
}