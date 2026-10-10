import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh/src/index.js';

/**
 * 森のリバーシ広場（Blender 製 v06 を圧縮した GLB）の読み込みと照明。
 * 照明と材質の調整は制作フォルダーのビューア（viewer/index.html）と同じ考え方で、
 * glTF に入らない面光源の補助光をここで置き直す。
 */

export type PlazaTimeOfDay = '朝' | '昼' | '夕方' | '夜';

interface TimeSetting {
  sun: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  sky: number;
  fill: number;
  fillColor: number;
  lamp: number;
  glow: number;
  leaf: number;
  exposure: number;
  env: [[number, number, number], [number, number, number], [number, number, number]];
  hemi: [number, number];
  haze: number;
  fog: [number, number];
  tint: [number, number, number];
  scrim: [number, number];
}

const SUN_DEFAULT: [number, number, number] = [0.6, 0.45, 0.66];

const TIMES: Record<PlazaTimeOfDay, TimeSetting> = {
  朝: {
    sun: [0.55, -0.35, 0.76], sunColor: 0xffd6a0, sunIntensity: 5.2, sky: 0.3, fill: 0.35, fillColor: 0xffe6c8,
    lamp: 0.4, glow: 0.7, leaf: 0.8, exposure: 0.95,
    env: [[0.80, 0.86, 0.90], [0.58, 0.64, 0.60], [0.12, 0.11, 0.09]], hemi: [0xdfe8f0, 0x2a2618],
    haze: 0xc9d4cf, fog: [18, 120], tint: [1.02, 1.04, 1.06], scrim: [0xd6e0dc, 1.5],
  },
  昼: {
    sun: SUN_DEFAULT, sunColor: 0xffe2b4, sunIntensity: 6.5, sky: 0.22, fill: 0.5, fillColor: 0xffd9a6,
    lamp: 1.4, glow: 1.0, leaf: 1.0, exposure: 0.95,
    env: [[0.85, 0.92, 0.75], [0.55, 0.62, 0.45], [0.12, 0.10, 0.07]], hemi: [0xd9e6c4, 0x2a2416],
    haze: 0xb7c4a2, fog: [35, 170], tint: [1, 1, 1], scrim: [0xc3d2aa, 1.0],
  },
  夕方: {
    sun: [-0.72, 0.42, 0.42], sunColor: 0xff9a4c, sunIntensity: 4.2, sky: 0.16, fill: 0.3, fillColor: 0xff9f62,
    lamp: 3.0, glow: 1.5, leaf: 0.5, exposure: 1.0,
    env: [[0.95, 0.62, 0.42], [0.55, 0.36, 0.28], [0.10, 0.06, 0.05]], hemi: [0xf2b08a, 0x2a1810],
    haze: 0xd59a72, fog: [28, 150], tint: [1.08, 0.74, 0.52], scrim: [0xe6a878, 1.3],
  },
  夜: {
    sun: [0.25, -0.45, 0.82], sunColor: 0x9db4ff, sunIntensity: 0.45, sky: 0.08, fill: 0.0, fillColor: 0x8899cc,
    lamp: 3.4, glow: 2.4, leaf: 0.05, exposure: 1.0,
    env: [[0.10, 0.14, 0.28], [0.05, 0.07, 0.13], [0.02, 0.02, 0.03]], hemi: [0x30406a, 0x0a0806],
    haze: 0x0b111e, fog: [22, 130], tint: [0.06, 0.08, 0.15], scrim: [0x1a2740, 1.2],
  },
};

export const PLAZA_TIMES: readonly PlazaTimeOfDay[] = ['朝', '昼', '夕方', '夜'];

/** Blender 座標(x, y, z) → three 座標(x, z, -y) */
export const fromBlender = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, z, -y);

const EMIT_SCALE: Record<string, number> = {
  LanternGlow: 0.05, FlameCore: 0.06, Flame: 0.35, Embers: 0.5, LampShade: 0.45, WindowGlow: 0.6,
};
/** 60W のランタンを書き出した強さ（cd） */
const LAMP_REF = 3261;
const PLAZA_CENTER = fromBlender(0.5, 9.5, 0);
const FLOOR_MESH = /^(Flagstones|Terrain|DeckTop|LandingFloor|AlcoveFloor)$/;
/** プレイヤーだけがぶつかる大きな形（巨木の幹・土手の岩壁と根・森の内側の木） */
const PLAYER_SOLID_MESH = /^(GiantTrees|BankRockWall|BankRoots|ForestInner)$/;
/** 足元の判定に使わない大きな形（地形・森・樹冠・背景）。三角形が多く、毎回の判定が重くなるため除く */
const NON_OBSTACLE_MESH = /^(Backdrop|HazeScrim|Canopy|CanopySheet|ForestRing|ForestInner|Understory|BankPlants|BankRockWall|BankRoots|GiantTrees|Plants|AlcoveRug|Rug)$/;

export interface PlazaScene {
  root: THREE.Object3D;
  /** 足元の高さを調べる対象（敷石・地面・デッキ） */
  floorMeshes: THREE.Mesh[];
  /** キャラが歩いて通り抜けない家具・小物（切り株のテーブル・ピアノ・岩など、形の小さいもの） */
  obstacleMeshes: THREE.Mesh[];
  /** プレイヤーがぶつかる形（obstacleMeshes に巨木・土手を足したもの） */
  playerSolidMeshes: THREE.Mesh[];
  setTime(name: PlazaTimeOfDay): void;
  dispose(): void;
}

function makeSkyEnvironment(
  renderer: THREE.WebGLRenderer,
  top: [number, number, number],
  mid: [number, number, number],
  low: [number, number, number],
): THREE.Texture {
  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(10, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Vector3(...top) },
      mid: { value: new THREE.Vector3(...mid) },
      low: { value: new THREE.Vector3(...low) },
    },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 p; void main(){ float h = normalize(p).y;
      vec3 c = h > 0. ? mix(mid, top, pow(h, .6)) : mix(mid, low, pow(-h, .5));
      gl_FragColor = vec4(c, 1.); }`,
  });
  scene.add(new THREE.Mesh(geometry, material));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  geometry.dispose();
  material.dispose();
  return texture;
}

function asStandard(material: THREE.Material): THREE.MeshPhysicalMaterial {
  return material as THREE.MeshPhysicalMaterial;
}

export async function loadPlaza(
  url: string,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  onProgress: (ratio: number) => void,
  options: { shadowMapSize?: number } = {},
): Promise<PlazaScene> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url, (event) => {
    if (event.total) onProgress(event.loaded / event.total);
  });
  const root = gltf.scene;

  const hemi = new THREE.HemisphereLight(0xd9e6c4, 0x2a2416, 0.35);
  scene.add(hemi);
  const fillLights: { light: THREE.DirectionalLight | THREE.SpotLight; base: number }[] = [];
  const addFill = (
    light: THREE.DirectionalLight | THREE.SpotLight,
    from: [number, number, number],
    to: [number, number, number],
    base: number,
  ) => {
    light.position.copy(fromBlender(...from));
    light.target.position.copy(fromBlender(...to));
    scene.add(light, light.target);
    fillLights.push({ light, base });
  };
  addFill(new THREE.DirectionalLight(0xffd9a6, 1), [0, -4, 5], [0, 10, 2.2], 0.9);
  addFill(new THREE.SpotLight(0xffcc8c, 1, 0, 0.55, 0.8, 2), [-7.5, 10.5, 5.5], [-4.6, 17.6, 2.5], 260);
  addFill(new THREE.SpotLight(0xffd29a, 1, 0, 0.6, 0.8, 2), [-2.0, 4.0, 4.5], [-6.6, 9.0, 2.0], 90);

  let sun: THREE.DirectionalLight | null = null;
  const lamps: { light: THREE.PointLight; base: number }[] = [];
  let backdropMaterial: THREE.MeshBasicMaterial | null = null;
  let hazeMaterial: THREE.MeshBasicMaterial | null = null;
  let canopySheet: THREE.Mesh | null = null;
  const glowMaterials = new Map<THREE.MeshStandardMaterial, number>();
  const leafMaterials = new Map<THREE.MeshStandardMaterial, number>();
  const floorMeshes: THREE.Mesh[] = [];
  const obstacleMeshes: THREE.Mesh[] = [];
  const playerSolidMeshes: THREE.Mesh[] = [];
  const ownedMaterials: THREE.Material[] = [];

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const raw of materials) {
        const m = asStandard(raw);
        if (m.name === 'Backdrop') {
          const texture = m.emissiveMap || m.map;
          backdropMaterial = new THREE.MeshBasicMaterial({ map: texture, fog: false, side: THREE.DoubleSide });
          ownedMaterials.push(backdropMaterial);
          mesh.material = backdropMaterial;
          mesh.renderOrder = -1;
          continue;
        }
        if (m.name === 'HazeScrim') {
          const texture = m.emissiveMap || m.map;
          const haze = new THREE.MeshBasicMaterial({
            color: 0xbfd0a8, alphaMap: texture, transparent: true, opacity: 1,
            depthWrite: false, fog: false, side: THREE.DoubleSide,
          });
          // alphaMap は G を読むので、アルファを持つ画像からアルファを使うよう差し替える
          haze.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <alphamap_fragment>',
              'diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;',
            );
          };
          hazeMaterial = haze;
          ownedMaterials.push(haze);
          mesh.material = haze;
          mesh.renderOrder = 2;
          continue;
        }
        if (m.alphaTest > 0) { m.side = THREE.DoubleSide; m.shadowSide = THREE.DoubleSide; }
        if (m.name === 'PianoBlack') { m.envMapIntensity = 0.25; m.clearcoat = 0.06; m.clearcoatRoughness = 0.45; m.roughness = 0.42; m.specularIntensity = 0.1; }
        if (m.name === 'PianoLidInner') { m.envMapIntensity = 0.25; m.clearcoat = 0.06; m.clearcoatRoughness = 0.45; m.roughness = 0.4; m.specularIntensity = 0.16; }
        if (m.name === 'Brass') m.roughness = Math.max(m.roughness, 0.5);
        if (m.name === 'StoneBlack' || m.name === 'StoneWhite') m.roughness = Math.max(m.roughness, 0.3);
        if (/^(Fern|BroadLeaf|Vine|Foliage|CanopyLeaves)$/.test(m.name) && !leafMaterials.has(m)) leafMaterials.set(m, m.emissiveIntensity);
        if (m.name === 'Fern' && !m.userData.tinted) { m.color.multiplyScalar(0.42); m.userData.tinted = true; }
        if (m.name === 'BroadLeaf' && !m.userData.tinted) { m.color.multiplyScalar(0.6); m.userData.tinted = true; }
        if (m.name === 'PianoInside' && !m.userData.tinted) { m.envMapIntensity = 0.4; m.metalness = 0.55; m.roughness = 0.6; m.color.multiplyScalar(0.7); m.userData.tinted = true; }
        if (m.name === 'ReversiBoard') { m.clearcoat = 0; m.envMapIntensity = 0.4; }
        if (/^(LanternGlow|FlameCore|Flame|Embers|LampShade|WindowGlow)$/.test(m.name) && !glowMaterials.has(m)) {
          m.emissiveIntensity *= EMIT_SCALE[m.name] ?? 0.4;
          glowMaterials.set(m, m.emissiveIntensity);
        }
      }
      const names = `${mesh.name} ${mesh.parent ? mesh.parent.name : ''}`;
      const isBack = /Backdrop|HazeScrim/.test(names);
      mesh.castShadow = !isBack && !/Terrain/.test(names);
      mesh.receiveShadow = !isBack;
      // 材質が複数ある形は、ノード名のグループの下に部品ごとのメッシュとして読み込まれる
      const nodeName = mesh.parent && !(mesh.parent as THREE.Object3D & { isScene?: boolean }).isScene && mesh.parent !== root
        ? mesh.parent.name
        : mesh.name;
      if (FLOOR_MESH.test(mesh.name) || FLOOR_MESH.test(nodeName)) floorMeshes.push(mesh);
      else if (PLAYER_SOLID_MESH.test(mesh.name) || PLAYER_SOLID_MESH.test(nodeName)) playerSolidMeshes.push(mesh);
      else if (!NON_OBSTACLE_MESH.test(mesh.name) && !NON_OBSTACLE_MESH.test(nodeName)) obstacleMeshes.push(mesh);
      if (!Array.isArray(mesh.material) && mesh.material.name === 'CanopyLeaves') {
        // 木漏れ日の天井：影だけ落として画面には描かない
        canopySheet = mesh;
        mesh.material.colorWrite = false;
        mesh.material.depthWrite = false;
      }
    }
    const directional = object as THREE.DirectionalLight;
    if (directional.isDirectionalLight) sun = directional;
    const point = object as THREE.PointLight;
    if (point.isPointLight) {
      point.decay = 2;
      point.distance = 0;
      let base = /PianoFill/.test(point.name) ? 0 : point.intensity;
      if (/^Lantern/.test(point.name)) base = Math.min(base, LAMP_REF * 1.5);
      point.color.set(0xffb066);
      lamps.push({ light: point, base });
    }
  });
  scene.add(root);
  root.updateMatrixWorld(true);
  playerSolidMeshes.push(...obstacleMeshes);
  // 足元・当たり判定の光線を速くする（三角形の索引木を作る。数十万三角形で 1 回の判定が 1ms 未満になる）
  for (const mesh of new Set([...floorMeshes, ...playerSolidMeshes])) {
    if (!mesh.geometry.boundsTree) mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
    mesh.raycast = acceleratedRaycast;
  }

  const sunLight = sun as THREE.DirectionalLight | null;
  if (sunLight) {
    sunLight.removeFromParent();
    scene.add(sunLight, sunLight.target);
    sunLight.castShadow = true;
    const shadowCamera = sunLight.shadow.camera;
    shadowCamera.left = -26; shadowCamera.right = 26; shadowCamera.top = 26; shadowCamera.bottom = -26;
    shadowCamera.near = 5; shadowCamera.far = 140;
    const shadowSize = options.shadowMapSize ?? 2048;
    sunLight.castShadow = shadowSize > 0;
    sunLight.shadow.mapSize.set(Math.max(1, shadowSize), Math.max(1, shadowSize));
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.04;
  }
  const sheet = canopySheet as THREE.Mesh | null;
  const canopyBase = sheet ? sheet.position.clone() : null;

  const envCache = new Map<PlazaTimeOfDay, THREE.Texture>();
  const sheetOffset = (d: number[]): [number, number] => [d[0] / d[2] * 8.2, d[1] / d[2] * 8.2];

  function setTime(name: PlazaTimeOfDay): void {
    const t = TIMES[name];
    const d = new THREE.Vector3(...t.sun).normalize();
    if (sunLight) {
      sunLight.position.copy(PLAZA_CENTER).addScaledVector(fromBlender(d.x, d.y, d.z), 65);
      sunLight.target.position.copy(PLAZA_CENTER);
      sunLight.color.set(t.sunColor);
      sunLight.intensity = t.sunIntensity;
    }
    if (sheet && canopyBase) {
      const a = sheetOffset([d.x, d.y, d.z]);
      const b = sheetOffset(new THREE.Vector3(...SUN_DEFAULT).normalize().toArray());
      sheet.position.copy(canopyBase).add(new THREE.Vector3(a[0] - b[0], 0, -(a[1] - b[1])));
    }
    let env = envCache.get(name);
    if (!env) {
      env = makeSkyEnvironment(renderer, ...t.env);
      envCache.set(name, env);
    }
    scene.environment = env;
    scene.environmentIntensity = t.sky;
    hemi.intensity = t.sky * 0.6;
    hemi.color.set(t.hemi[0]);
    hemi.groundColor.set(t.hemi[1]);
    const haze = new THREE.Color(t.haze);
    scene.background = haze.clone();
    scene.fog = new THREE.Fog(haze, t.fog[0], t.fog[1]);
    const backdrop = backdropMaterial as THREE.MeshBasicMaterial | null;
    if (backdrop) backdrop.color.setRGB(...t.tint);
    const hazeMat = hazeMaterial as THREE.MeshBasicMaterial | null;
    if (hazeMat) { hazeMat.color.set(t.scrim[0]); hazeMat.opacity = Math.min(1, t.scrim[1]); }
    for (const { light, base } of fillLights) { light.color.set(t.fillColor); light.intensity = base * t.fill; }
    for (const { light, base } of lamps) light.intensity = base * t.lamp / LAMP_REF;
    glowMaterials.forEach((base, material) => { material.emissiveIntensity = base * t.glow; });
    leafMaterials.forEach((base, material) => { material.emissiveIntensity = base * t.leaf; });
    renderer.toneMappingExposure = t.exposure;
  }

  function dispose(): void {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.boundsTree = undefined;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
        }
        material.dispose();
      }
    });
    ownedMaterials.forEach((material) => material.dispose());
    envCache.forEach((texture) => texture.dispose());
    if (sunLight) sunLight.shadow.dispose();
  }

  return { root, floorMeshes, obstacleMeshes, playerSolidMeshes, setTime, dispose };
}
