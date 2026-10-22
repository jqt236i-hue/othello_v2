jest.mock('three', () => {
  class Vector3 {
    constructor(public x=0,public y=0,public z=0){}
    set(x:number,y:number,z:number){this.x=x;this.y=y;this.z=z;return this;}
    clone(){return new Vector3(this.x,this.y,this.z);}
    sub(v:Vector3){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
    length(){return Math.hypot(this.x,this.y,this.z);}
    normalize(){const l=this.length()||1;this.x/=l;this.y/=l;this.z/=l;return this;}
    applyQuaternion(){return this;} dot(v:Vector3){return this.x*v.x+this.y*v.y+this.z*v.z;}
  }
  class Object3D {
    position=new Vector3();rotation={y:0};quaternion={};scale={setScalar(){}};children:Object3D[]=[];name='';parent:Object3D|null=null;visible=true;intensity=0;
    constructor(public geometry?:unknown,public material?:unknown){}
    add(...children:Object3D[]){for(const c of children){this.children.push(c);c.parent=this;}}
    getObjectByName(name:string):Object3D|undefined{if(this.name===name)return this;for(const c of this.children){const found=c.getObjectByName(name);if(found)return found;}return undefined;}
    removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
    clear(){this.children=[];}
  }
  class Resource {dispose(){}}
  return {Vector3,Group:Object3D,Scene:Object3D,PerspectiveCamera:Object3D,PointLight:Object3D,Mesh:Object3D,Sprite:class extends Object3D{constructor(m:unknown){super(undefined,m);}},BoxGeometry:Resource,MeshBasicMaterial:Resource,SpriteMaterial:Resource,CanvasTexture:Resource};
});
import * as THREE from 'three';
import { createPianoActivity } from '../browser-vite/forest-plaza/activities/piano';
import type { ActivityContext, Interactable } from '../browser-vite/forest-plaza/activities/types';
import type { PlazaCharacter } from '../browser-vite/forest-plaza/characters';
import type { AutoEvent } from '../browser-vite/forest-plaza/activities/director';
const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
beforeAll(() => Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width:128,height:128,getContext:()=>({fillText(){}}) }) } }));
afterAll(() => { if (savedDocument) Object.defineProperty(globalThis,'document',savedDocument); else Reflect.deleteProperty(globalThis,'document'); });
function setup() {
  const visitors = new Map<string,PlazaCharacter>(), specs: Interactable[] = [], handles = [jest.fn(),jest.fn()], unregister=jest.fn(); let event!:AutoEvent;
  const root=new THREE.Group(), fill=new THREE.PointLight(); fill.name='PianoFill';root.add(fill);
  const ctx={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),plaza:{root},visitors,isTouch:false,
    director:{sleeping:false,register:(s:AutoEvent)=>{event=s;return unregister;}},audio:{context:()=>null,master:null},
    pathing:{find:jest.fn((from,to)=>[{x:from.x,y:0,z:from.z},{x:to.x,y:.05,z:to.z}])},
    hearts:(c:PlazaCharacter)=>c.info.id==='favorite'?5:0,say:jest.fn(),spawnHearts:jest.fn(),addAffection:jest.fn(),
    addInteractable:(s:Interactable)=>{specs.push(s);return {dispose:handles[specs.length-1]};},
  } as unknown as ActivityContext;
  function character(id:string,height=1) {
    let owner:unknown=null, done:((ok:boolean)=>void)|undefined;
    const c={info:{id},root:new THREE.Group(),position:new THREE.Vector3(0,0,-2),height,radius:.3,
      get isBusy(){return owner!==null;},claim:jest.fn((o:unknown)=>{if(owner&&owner!==o)return false;owner=o;return true;}),
      release:jest.fn((o:unknown)=>{if(owner===o){owner=null;const cb=done;done=undefined;cb?.(false);}}),
      walkPath:jest.fn((_p,_v,cb)=>{done=cb;}),stopPath:jest.fn(()=>{const cb=done;done=undefined;cb?.(false);}),setPose:jest.fn(),lookAt:jest.fn(),
    };visitors.set(id,c as unknown as PlazaCharacter);
    return {c:c as unknown as PlazaCharacter,arrive:()=>{const cb=done;done=undefined;cb?.(true);}};
  }
  const activity=createPianoActivity(ctx);
  return {ctx,activity,specs,character,fill,handles,unregister,getEvent:()=>event};
}
describe('森の広場 ピアノの寿命',()=>{
  test('仲良し優先、大小とも座面を補正して+Xの鍵盤を向く',()=>{
    for(const height of [.4675,1.85]){const s=setup(),a=s.character('other'),b=s.character('favorite',height);s.specs[0].interact();expect(b.c.isBusy).toBe(true);expect(a.c.isBusy).toBe(false);b.arrive();expect(b.c.position.y-height*.28).toBeGreaterThanOrEqual(.93);expect(b.c.root.rotation.y).toBe(Math.PI/2);expect(s.ctx.say).toHaveBeenCalledWith(b.c,'pianoPlay');expect(s.fill.intensity).toBe(5);s.activity.dispose();expect(b.c.isBusy).toBe(false);}
  });
  test('到着前の割込み後に遅い到着が来ても再開しない',()=>{
    const s=setup(),a=s.character('favorite');s.specs[0].interact();s.activity.onCharacterTouched!(a.c,'pet');a.arrive();expect(s.ctx.say).not.toHaveBeenCalled();expect(s.fill.intensity).toBe(0);expect(a.c.isBusy).toBe(false);s.activity.dispose();
  });
  test('完奏だけに演奏者+2と聴き手+1、帰路を終えると両者を解放',()=>{
    const s=setup(),a=s.character('favorite'),b=s.character('listener');s.specs[0].interact();a.arrive();b.arrive();s.activity.update(70);expect(s.ctx.addAffection).toHaveBeenCalledWith(a.c,2);expect(s.ctx.addAffection).toHaveBeenCalledWith(b.c,1);s.activity.update(2);s.activity.update(1);a.arrive();b.arrive();expect(a.c.isBusy).toBe(false);expect(b.c.isBusy).toBe(false);expect(s.fill.intensity).toBe(0);s.activity.dispose();
  });
  test('なで割込みは3秒待ち、帰路の近い出発格子へ逆戻りしない',()=>{
    const s=setup(),a=s.character('favorite');s.specs[0].interact();a.arrive();
    s.activity.onCharacterTouched!(a.c,'pet');
    const before=(a.c.walkPath as jest.Mock).mock.calls.length;
    s.activity.update(2.9);expect(a.c.walkPath).toHaveBeenCalledTimes(before);
    s.activity.update(.2);expect(a.c.walkPath).toHaveBeenCalledTimes(before+1);
    expect((a.c.walkPath as jest.Mock).mock.calls.at(-1)[0]).toHaveLength(1);
    a.arrive();expect(a.c.isBusy).toBe(false);s.activity.dispose();
  });
  test('演奏者の帰還で聴衆も片付き報酬なし、disposeは二重呼出し安全',()=>{
    const s=setup(),a=s.character('favorite'),b=s.character('listener');s.specs[0].interact();a.arrive();b.arrive();s.activity.onCharacterRemoved!(a.c);expect(a.c.isBusy).toBe(false);expect(b.c.isBusy).toBe(false);expect(s.ctx.addAffection).not.toHaveBeenCalled();s.activity.dispose();s.activity.dispose();expect(s.unregister).toHaveBeenCalledTimes(1);for(const h of s.handles)expect(h).toHaveBeenCalledTimes(1);expect(s.ctx.scene.getObjectByName('PianoNotes')).toBeUndefined();
  });
  test('自動イベントのfinishを中断でも一度だけ呼ぶ',()=>{
    const s=setup(),a=s.character('a'),end=jest.fn();a.c.claim('director');s.getEvent().start([a.c],end);a.arrive();s.activity.onCharacterTouched!(a.c,'tap');s.activity.dispose();expect(end).toHaveBeenCalledTimes(1);
  });
});
