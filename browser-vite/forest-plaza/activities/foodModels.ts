import * as THREE from 'three';
export { FOODS, favoriteFood } from './foodLogic';
export function disposeProp(root: THREE.Object3D): void {
  root.removeFromParent();
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  materials.forEach(m => { const map=(m as THREE.MeshStandardMaterial).map; if(map)textures.add(map); });
  textures.forEach(t=>t.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
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
    // 赤い皮と白へ反転した半分。輪郭・葉・軸はりんごのまま。
    const red=sphere(0xcd303b, -.035, .085, 0, .075,.085,.077);
    const white=sphere(0xffefd0, .035,.085,0,.075,.085,.077);
    for(const half of [red,white])(half.material as THREE.MeshStandardMaterial).roughness=.38;
    const stem = propMesh(new THREE.CylinderGeometry(.009,.012,.06,6),0x62402b); stem.position.y=.18; stem.rotation.z=-.2; root.add(stem);
    const leaf=sphere(0x619644,.04,.19,0,.046,.01,.021); leaf.rotation.z=.35;
  } else if (kind === 1) {
    const bread=new THREE.Group();bread.rotation.y=-.25;root.add(bread);
    const loaf=sphere(0xa86532,0,.07,0,.145,.075,.079);bread.add(loaf);
    for (const x of [-.105,.105]) { const cut=propMesh(new THREE.BoxGeometry(.012,.007,.062),0xecc485); cut.position.set(x,.122,0); cut.rotation.y=.35; bread.add(cut); }
    // 執行者の焦げ茶の衣・剣を、秤と剣の焼き印へ。紙の札に見えないよう表面に沿わせる。
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const ink=canvas.getContext('2d');
    if(ink){
      ink.strokeStyle='#392014';ink.fillStyle='#392014';ink.lineWidth=22;ink.lineJoin='round';ink.lineCap='round';
      ink.beginPath();ink.moveTo(90,65);ink.lineTo(422,65);ink.lineTo(408,300);ink.quadraticCurveTo(370,400,256,458);ink.quadraticCurveTo(142,400,104,300);ink.closePath();ink.stroke();
      ink.beginPath();ink.moveTo(256,125);ink.lineTo(256,370);ink.moveTo(180,290);ink.lineTo(332,290);ink.moveTo(158,185);ink.lineTo(354,185);ink.moveTo(168,185);ink.lineTo(132,252);ink.lineTo(204,252);ink.closePath();ink.moveTo(344,185);ink.lineTo(308,252);ink.lineTo(380,252);ink.closePath();ink.stroke();
      ink.beginPath();ink.moveTo(234,370);ink.lineTo(278,370);ink.lineTo(256,405);ink.closePath();ink.fill();
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const geometry=new THREE.PlaneGeometry(.145,.112,16,12),positions=geometry.attributes.position;
      for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=-positions.getY(i);positions.setXYZ(i,x,.07+.075*Math.sqrt(Math.max(0,1-(x/.145)**2-(z/.079)**2))+.0013,z);}
      geometry.computeVertexNormals();
      const seal=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.1,roughness:1,side:THREE.DoubleSide}));seal.name='executor-burn-seal';bread.add(seal);
      // 遠め・低い視線でも焼き印がわかるよう、手前の皮にも同じ印を小さく焼く。
      const frontGeometry=new THREE.PlaneGeometry(.105,.075,14,10),frontPositions=frontGeometry.attributes.position;
      for(let i=0;i<frontPositions.count;i++){const x=frontPositions.getX(i),y=.067+frontPositions.getY(i);frontPositions.setXYZ(i,x,y,.079*Math.sqrt(Math.max(0,1-(x/.145)**2-((y-.07)/.075)**2))+.0013);}
      frontGeometry.computeVertexNormals();const frontSeal=new THREE.Mesh(frontGeometry,seal.material);frontSeal.name='executor-front-burn-seal';bread.add(frontSeal);
    }
  } else if (kind === 2) {
    const shape=new THREE.Shape(); shape.moveTo(-.11,0); shape.quadraticCurveTo(-.13,.025,-.09,.08); shape.lineTo(-.025,.18); shape.quadraticCurveTo(0,.21,.025,.18); shape.lineTo(.09,.08); shape.quadraticCurveTo(.13,.025,.11,0); shape.closePath();
    const rice=propMesh(new THREE.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.012}),0xfff6df); rice.position.z=-.045; root.add(rice);
    const cloak=new THREE.Shape();cloak.moveTo(-.0525,0);cloak.lineTo(.0525,0);cloak.lineTo(.033,.14);cloak.lineTo(-.033,.14);cloak.closePath();
    const nori=propMesh(new THREE.ExtrudeGeometry(cloak,{depth:.116,bevelEnabled:false}),0x11191b);nori.position.z=-.058;root.add(nori);
    // 黒い海苔に白ごまの星と、一つだけ光る丸い目。どちら側から持っても同じ顔。
    for(const side of [-1,1]) {
      for(const [x,y] of [[-.037,.019],[.034,.018],[-.029,.115],[.028,.123],[-.018,.061],[.016,.012],[.033,.065]]) {
        const sesame=sphere(0xf4ead7,x,y,side*.060,.0027,.004,.0015);sesame.rotation.z=x*15;
      }
      const eye=sphere(0xfff9e6,0,.098,side*.061,.016,.016,.0025);
      const material=eye.material as THREE.MeshStandardMaterial;material.emissive.set(0xfff1cc);material.emissiveIntensity=.65;
    }
  } else {
    const cookie=propMesh(new THREE.CylinderGeometry(.105,.105,.035,24),0xdba05b); cookie.position.y=.025; root.add(cookie);
    // 丸いクッキーの中に、外枠＋7本ずつの線で正確に8×8の盤を描く。
    const extent=.142,cell=extent/8;
    for(let i=0;i<=8;i++)for(const horizontal of [false,true]) {
      const line=propMesh(new THREE.BoxGeometry(horizontal?extent:.0022,.0025,horizontal?.0022:extent),0x56331d);
      const offset=-extent/2+i*cell;line.position.set(horizontal?0:offset,.0445,horizontal?offset:0);root.add(line);
    }
    for(const [column,row,white] of [[3,3,1],[4,3,0],[3,4,0],[4,4,1],[2,3,0],[5,4,1]]) {
      const stone=propMesh(new THREE.CylinderGeometry(.0066,.0066,.0045,12),white?0xfff1d5:0x292421);
      stone.position.set(-extent/2+(column+.5)*cell,.048,-extent/2+(row+.5)*cell);root.add(stone);
    }
  }
  return root;
}
export function ballModel(): THREE.Group {
  const root = new THREE.Group(); root.name='plaza-ball';
  root.add(propMesh(new THREE.SphereGeometry(.16,20,14),0xefb74b));
  for (const axis of [0,1]) { const ring=propMesh(new THREE.TorusGeometry(.158,.012,6,32),0x58a9ab); if(axis) ring.rotation.x=Math.PI/2; root.add(ring); }
  return root;
}
