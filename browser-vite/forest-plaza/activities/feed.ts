import * as THREE from 'three';
import type { PlazaCharacter } from '../characters';
import type { ActivityContext, PlazaActivity } from './types';
import { FOODS, favoriteFood, foodModel, disposeProp, propMesh } from './foodModels';
import { heldPropPose } from './heldPropPose';

export function createFeedActivity(ctx: ActivityContext): PlazaActivity {
  const owner = {}, table = new THREE.Group(); table.name='plaza-food-table'; ctx.scene.add(table);
  const original = ctx.plaza.root.getObjectByName('KitchenFood');
  const originalVisible=original?.visible; if(original) original.visible=false;
  const handles: {dispose():void}[]=[];
  const meals=new Map<PlazaCharacter,{model:THREE.Group;time:number;kind:number;scale:number}>();
  let disposed=false;
  const finish=(c:PlazaCharacter) => { const meal=meals.get(c); if(!meal)return; meals.delete(c); disposeProp(meal.model); c.lookAt(null); c.release(owner); };
  const take=(kind:number) => {
    if(disposed)return;
    const model=foodModel(kind), id='food-'+kind;
    model.rotation.x=-Math.PI/2;
    const pose=heldPropPose(ctx.player.view,ctx.isTouch,false);
    model.position.set(pose.x,pose.y,pose.z); model.scale.setScalar(pose.scale);
    ctx.hand.equip({id,icon:FOODS[kind].icon,model,onUnequip:()=>disposeProp(model),use({character:c}) {
      if(!c || c.isBusy || meals.has(c) || c.position.distanceTo(ctx.player.position)>ctx.reach || !c.claim(owner,()=>finish(c)))return;
      const received=foodModel(kind),scale=Math.min(1,c.height/.8); received.scale.setScalar(scale);
      meals.set(c,{model:received,time:0,kind,scale}); c.attachments.mouth.add(received);
      c.lookAt(ctx.player.position); c.setPose({posture:'stand',chew:true}); ctx.hand.equip(null);
    }});
  };
  FOODS.forEach((food,kind)=>{
    const x=-9.27+kind*.41,z=-1.38;
    const plate=propMesh(new THREE.CylinderGeometry(.185,.16,.025,24),0xeee5d1); plate.position.set(x,.907,z); table.add(plate);
    const model=foodModel(kind); model.position.set(x,.925,z); table.add(model);
    const proxy=new THREE.Mesh(new THREE.BoxGeometry(.38,.36,.55),new THREE.MeshBasicMaterial({visible:false})); proxy.position.set(x,1.04,z+.07); table.add(proxy);
    handles.push(ctx.addInteractable({id:'food-'+kind,label:food.name,action:'取る',proxy,interact:()=>take(kind)}));
  });
  return {
    update(dt) {
      if(disposed)return;
      if(ctx.hand.current?.id.startsWith('food-')) {
        const pose=heldPropPose(ctx.player.view,ctx.isTouch,false),model=ctx.hand.current.model;
        model.position.set(pose.x,pose.y,pose.z);model.scale.setScalar(pose.scale);
      }
      for(const [c,meal] of meals) {
        meal.time+=dt; c.lookAt(ctx.player.position);
        meal.model.scale.setScalar(meal.scale*Math.max(.015,1-meal.time/3));
        if(meal.time>=3) { const favorite=favoriteFood(c.info.id)===meal.kind; ctx.say(c,favorite?'eatFavorite':'eat',{food:FOODS[meal.kind].name}); ctx.addAffection(c,favorite?5:2); ctx.spawnHearts(c,favorite?7:3); finish(c); }
      }
    },
    onCharacterRemoved:finish,onCharacterTouched:finish,
    dispose() { if(disposed)return; disposed=true; if(ctx.hand.current?.id.startsWith('food-'))ctx.hand.equip(null); for(const c of [...meals.keys()])finish(c); handles.forEach(h=>h.dispose()); disposeProp(table); if(original)original.visible=originalVisible!; },
  };
}
