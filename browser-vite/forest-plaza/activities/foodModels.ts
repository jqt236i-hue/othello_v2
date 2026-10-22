import * as THREE from 'three';
export { FOODS, favoriteFood } from './foodLogic';
export function disposeProp(root: THREE.Object3D): void {
  root.removeFromParent();
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
export function propMesh(geometry: THREE.BufferGeometry, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .78 }));
  mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
/** 実寸約15〜24cm。原点は手/皿の中心。 */
export function foodModel(kind: number): THREE.Group {
  const root = new THREE.Group(); root.name = 'plaza-food-' + kind;
  const sphere = (color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const m = propMesh(new THREE.SphereGeometry(1, 16, 10), color); m.position.set(x,y,z); m.scale.set(sx,sy,sz); root.add(m); return m;
  };
  if (kind === 0) {
    sphere(0xde383c, -.035, .085, 0, .075,.085,.077); sphere(0xec4a42, .035,.085,0,.075,.085,.077);
    const stem = propMesh(new THREE.CylinderGeometry(.009,.012,.06,6),0x62402b); stem.position.y=.18; stem.rotation.z=-.2; root.add(stem);
    const leaf=sphere(0x619644,.04,.19,0,.046,.01,.021); leaf.rotation.z=.35;
  } else if (kind === 1) {
    const loaf=sphere(0xc98740,0,.07,0,.145,.075,.079); loaf.rotation.y=-.25;
    for (let i=-1;i<=1;i++) { const cut=propMesh(new THREE.BoxGeometry(.018,.009,.10),0xf3d6a0); cut.position.set(i*.065,.135,0); cut.rotation.y=.35; root.add(cut); }
  } else if (kind === 2) {
    const shape=new THREE.Shape(); shape.moveTo(-.11,0); shape.quadraticCurveTo(-.13,.025,-.09,.08); shape.lineTo(-.025,.18); shape.quadraticCurveTo(0,.21,.025,.18); shape.lineTo(.09,.08); shape.quadraticCurveTo(.13,.025,.11,0); shape.closePath();
    const rice=propMesh(new THREE.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.012}),0xfff6df); rice.position.z=-.045; root.add(rice);
    const nori=propMesh(new THREE.BoxGeometry(.085,.08,.116),0x233b29); nori.position.y=.035; root.add(nori);
  } else {
    const cookie=propMesh(new THREE.CylinderGeometry(.105,.105,.035,24),0xdba05b); cookie.position.y=.025; root.add(cookie);
    for (const [x,z] of [[-.045,-.04],[.035,-.05],[0,.012],[.06,.035],[-.045,.055]]) { const chip=propMesh(new THREE.SphereGeometry(.014,7,5),0x553322); chip.scale.y=.4; chip.position.set(x,.046,z); root.add(chip); }
  }
  return root;
}
export function ballModel(): THREE.Group {
  const root = new THREE.Group(); root.name='plaza-ball';
  root.add(propMesh(new THREE.SphereGeometry(.16,20,14),0xefb74b));
  for (const axis of [0,1]) { const ring=propMesh(new THREE.TorusGeometry(.158,.012,6,32),0x58a9ab); if(axis) ring.rotation.x=Math.PI/2; root.add(ring); }
  return root;
}
