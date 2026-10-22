import * as THREE from 'three';
import type { PlazaCharacter } from '../characters';
import type { ActivityContext, PlazaActivity } from './types';
import { ballModel, disposeProp, propMesh } from './foodModels';
import { BALL_RADIUS, canReward, nearestAvailable, outsidePlaza, stepBall, type BallState } from './ballPhysics';
import { heldPropPose } from './heldPropPose';

type Runner = { phase:'chase'|'return'|'cheer'; repath:number; failures:number; cheer:number; generation:number };
export function createBallActivity(ctx:ActivityContext):PlazaActivity {
  const owner={},ball=ballModel(),basket=new THREE.Group(); basket.name='plaza-ball-basket';
  const basketX=-2.7,basketZ=-2.5;
  const floor=ctx.pathing.groundAt(basketX,basketZ)??.04;
  basket.position.set(basketX,floor,basketZ); ctx.scene.add(basket);
  const base=propMesh(new THREE.CylinderGeometry(.29,.24,.08,20),0x9b6842); base.position.y=.05; basket.add(base);
  for(let i=0;i<16;i++) { const a=i*Math.PI/8,slat=propMesh(new THREE.CylinderGeometry(.018,.022,.38,5),0xc18b54); slat.position.set(Math.cos(a)*.27,.23,Math.sin(a)*.27); basket.add(slat); }
  for(const y of [.12,.36]) { const rim=propMesh(new THREE.TorusGeometry(.28,.025,6,24),0xe0b278); rim.rotation.x=Math.PI/2; rim.position.y=y; basket.add(rim); }
  const sample=ballModel(); sample.name='plaza-ball-display'; sample.position.set(0,.28,0); basket.add(sample);
  const proxy=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.65,14),new THREE.MeshBasicMaterial({visible:false})); proxy.position.y=.30; basket.add(proxy);
  let mode:'idle'|'held'|'flight'|'carried'|'dropped'='idle',disposed=false,carrier:PlazaCharacter|null=null;
  let clock=0,age=0,outTime=0,returnDelay=0;
  const runners=new Map<PlazaCharacter,Runner>(),rewarded=new Map<string,number>();
  const physics:BallState={position:ball.position,velocity:new THREE.Vector3()};
  const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),direction=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  ray.firstHitOnly=true;
  const solids=[...new Set([...ctx.plaza.floorMeshes,...ctx.plaza.playerSolidMeshes])];
  const release=(c:PlazaCharacter) => { const r=runners.get(c); if(!r)return; runners.delete(c); r.generation++; c.lookAt(null); c.release(owner); };
  const cancelRunners=()=>{ for(const c of [...runners.keys()])release(c); };
  const deferReturn=()=> {
    carrier=null; cancelRunners(); ball.removeFromParent(); ctx.scene.add(ball); mode='dropped'; returnDelay=1; ball.visible=false;
  };
  const interrupt=(c:PlazaCharacter)=>{ if(carrier===c)deferReturn(); else release(c); };
  const equip=()=> {
    if(disposed || ctx.hand.current?.id==='plaza-ball')return;
    carrier=null; mode='held'; ball.visible=true;
    const pose=heldPropPose(ctx.player.view,ctx.isTouch,true);
    ball.position.set(pose.x,pose.y,pose.z); ball.rotation.set(0,0,0); ball.scale.setScalar(pose.scale);
    ctx.hand.equip({id:'plaza-ball',icon:'⚽',model:ball,
      onUnequip(){ ball.removeFromParent(); if(mode==='held')mode='idle'; },
      use({direction:aim}) {
        mode='flight'; age=0;outTime=0;ctx.hand.equip(null);ctx.scene.add(ball);ball.scale.setScalar(1);
        // 壁際でも生成位置が壁の向こうへ抜けないよう、球の半径ぶん手前を保つ。
        ray.set(ctx.player.eye,aim);ray.far=.45;
        const clearance=ray.intersectObjects(solids,false)[0]?.distance??.45;
        ball.position.copy(ctx.player.eye).addScaledVector(aim,Math.max(0,Math.min(.20,clearance-BALL_RADIUS-.02)));
        const v=physics.velocity;v.x=aim.x*6.8;v.z=aim.z*6.8;v.y=Math.max(1.5,aim.y*6.8+2.7);
        for(const c of nearestAvailable(ctx.visitors.values(),ball.position)) {
          if(!c.claim(owner,()=>interrupt(c)))continue;
          runners.set(c,{phase:'chase',repath:0,failures:0,cheer:0,generation:0}); ctx.say(c,'play');
        }
      },
    });
  };
  const handle=ctx.addInteractable({id:'ball-basket',label:'ボール',action:'取る',proxy,enabled:()=>mode==='idle'||mode==='held',interact:equip});
  const routeTo=(c:PlazaCharacter,r:Runner,point:THREE.Vector3,returning:boolean)=>{
    const angles=[0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,-Math.PI/4,Math.PI*3/4,-Math.PI*3/4];
    const radius=returning?c.radius+ctx.player.radius+.4:Math.max(.28,c.radius*.65);
    let route:ReturnType<typeof ctx.pathing.find>=null;
    const candidates=angles.map(a=>({x:point.x+Math.cos(a)*radius,z:point.z+Math.sin(a)*radius})).sort((a,b)=>Math.hypot(a.x-c.position.x,a.z-c.position.z)-Math.hypot(b.x-c.position.x,b.z-c.position.z));
    // 動的な衝突で同じ入口に詰まった時は、次の側から回り込む。
    for(let i=0;i<candidates.length;i++) { const goal=candidates[(i+r.failures)%candidates.length]; route=ctx.pathing.find(c.position,goal,c); if(route)break; }
    if(!route){r.failures++;return;}
    // A*の出発格子への丸め戻しで、後ろのキャラへぶつからない。
    if(route.length>1 && Math.hypot(route[0].x-c.position.x,route[0].z-c.position.z)<.20)route.shift();
    const generation=++r.generation;
    c.walkPath(route,returning?2.2:2.8,arrived=>{if(runners.get(c)===r&&r.generation===generation){if(arrived)r.failures=0;else {r.failures++;r.repath=0;}}});
  };
  const reward=(c:PlazaCharacter)=> {ctx.say(c,'play'); if(canReward(clock,rewarded.get(c.info.id))){rewarded.set(c.info.id,clock);ctx.addAffection(c,1);ctx.spawnHearts(c,2);} };
  return {
    update(dt) {
      if(disposed)return;clock+=dt;
      if(mode==='held') {
        const pose=heldPropPose(ctx.player.view,ctx.isTouch,true);
        ball.position.set(pose.x,pose.y,pose.z);ball.scale.setScalar(pose.scale);
      }
      if(mode==='flight'||mode==='carried') {age+=dt;if(age>=35)deferReturn();}
      if(mode==='flight') {
        stepBall(physics,dt,(from,dir,distance)=>{
          direction.set(dir.x,dir.y,dir.z);ray.far=distance+.002;
          let closest: {distance:number;normal:{x:number;y:number;z:number}}|null=null;
          // 球の下端・側面もsweepする。中心線だけでは床を半径ぶん貫通する。
          for(const [x,y,z] of [[0,-BALL_RADIUS,0],[BALL_RADIUS,0,0],[-BALL_RADIUS,0,0],[0,0,BALL_RADIUS],[0,0,-BALL_RADIUS],[0,BALL_RADIUS,0],[0,0,0]]) {
            ray.set(origin.set(from.x+x,from.y+y,from.z+z),direction);
            const hit=ray.intersectObjects(solids,false)[0];if(!hit?.face||closest&&hit.distance>=closest.distance)continue;
            normal.copy(hit.face.normal).applyMatrix3(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).normalize();
            if(normal.dot(direction)>=0)continue;
            closest={distance:hit.distance,normal:{x:normal.x,y:normal.y,z:normal.z}};
          }
          return closest;
        });
        ball.rotation.x+=physics.velocity.z*dt/BALL_RADIUS;ball.rotation.z-=physics.velocity.x*dt/BALL_RADIUS;
        outTime=outsidePlaza(ball.position)?outTime+dt:0;
        if(outTime>=2.5||age>=25)deferReturn();
      }
      if(mode==='dropped') {returnDelay-=dt;if(returnDelay<=0&&!ctx.hand.current)equip();}
      for(const [c,r] of [...runners]) {
        if(runners.get(c)!==r)continue;
        if(r.phase==='chase'&&mode!=='flight') {r.phase='cheer';r.repath=0;}
        const horizontal=Math.hypot(c.position.x-ball.position.x,c.position.z-ball.position.z);
        if(r.phase==='chase'&&horizontal<c.radius+.42&&ball.position.y<c.position.y+Math.max(.6,c.height*.8)&&age>.35) {
          carrier=c;mode='carried';r.phase='return';r.repath=0;r.generation++;c.stopPath(false);
          ball.position.set(0,0,.05);ball.rotation.set(0,0,0);ball.scale.setScalar(Math.min(1,c.height/.65));c.attachments.mouth.add(ball);
          for(const [other,runner] of runners)if(other!==c){runner.phase='cheer';runner.repath=0;other.setPose({bounce:true});}
        }
        if(r.phase==='return'||r.phase==='cheer') {
          const distance=Math.hypot(c.position.x-ctx.player.position.x,c.position.z-ctx.player.position.z);
          if(distance<c.radius+ctx.player.radius+.95) {
            if(r.phase==='return') {
              ball.removeFromParent();ctx.scene.add(ball);ball.visible=true;ball.scale.setScalar(1);
              const away=new THREE.Vector3().subVectors(c.position,ctx.player.position).setY(0).normalize();
              ball.position.copy(ctx.player.position).addScaledVector(away,ctx.player.radius+.45);ball.position.y=(ctx.pathing.groundAt(ball.position.x,ball.position.z)??ctx.player.position.y)+BALL_RADIUS;
              carrier=null;mode='dropped';returnDelay=1;reward(c);release(c);continue;
            }
            r.cheer+=dt;c.stopPath(false);c.setPose({bounce:true});c.lookAt(ctx.player.position);
            if(r.cheer>.8){reward(c);release(c);}continue;
          }
        }
        r.repath-=dt;
        if(r.repath<=0) {
          r.repath=.8;
          routeTo(c,r,r.phase==='chase'?ball.position:ctx.player.position,r.phase!=='chase');
          if(r.failures>=4) { if(carrier===c)deferReturn();else release(c); }
        }
      }
    },
    onCharacterRemoved:interrupt,onCharacterTouched:interrupt,
    dispose(){if(disposed)return;disposed=true;cancelRunners();carrier=null;if(ctx.hand.current?.id==='plaza-ball')ctx.hand.equip(null);handle.dispose();disposeProp(ball);disposeProp(basket);rewarded.clear();},
  };
}
