jest.mock('three', () => {
  class Vector3 {
    constructor(public x=0, public y=0, public z=0) {}
    set(x:number,y:number,z:number){this.x=x;this.y=y;this.z=z;return this;}
    clone(){return new Vector3(this.x,this.y,this.z);}
    copy(p:Vector3){return this.set(p.x,p.y,p.z);}
    add(p:Vector3){this.x+=p.x;this.y+=p.y;this.z+=p.z;return this;}
    distanceTo(p:Vector3){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}
  }
  class Material { opacity=1; dispose(){} }
  class Object3D {
    position=new Vector3(); scale={setScalar(){}}; visible=true; name=''; children:Object3D[]=[]; parent:Object3D|null=null;
    constructor(public geometry?:unknown, public material?:unknown){}
    add(child:Object3D){child.removeFromParent();this.children.push(child);child.parent=this;}
    removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
    getObjectByName(name:string){return this.children.find(c=>c.name===name);}
  }
  return {Vector3,Scene:Object3D,Mesh:Object3D,PointLight:class extends Object3D{intensity=0;},Sprite:class extends Object3D{constructor(material:unknown){super(undefined,material);}},
    BoxGeometry:class{dispose(){}},MeshBasicMaterial:Material,SpriteMaterial:Material,CanvasTexture:class{dispose(){}}};
});
import * as THREE from 'three';
import { createSleepActivity } from '../browser-vite/forest-plaza/activities/sleep';
import type { ActivityContext, Interactable } from '../browser-vite/forest-plaza/activities/types';
import type { PlazaCharacter } from '../browser-vite/forest-plaza/characters';

const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
function setup() {
  let spec!: Interactable, input!: () => boolean, escape!: () => boolean;
  const unInput = jest.fn(), unEscape = jest.fn(), unregister = jest.fn();
  const player = { position: new THREE.Vector3(), eye: new THREE.Vector3(10.95,1.314,-6.15), view: 'first', isFixed: false,
    setPose: jest.fn((pose: unknown) => { player.isFixed = !!pose; }), setView: jest.fn() };
  const visitors = new Map<string, PlazaCharacter>();
  const ctx = { scene: new THREE.Scene(), player, visitors, hand: { current: null }, director: { sleeping: false },
    addInteractable: (s: Interactable) => { spec = s; return { dispose: unregister }; },
    onInput: (f: () => boolean) => { input = f; return unInput; }, onEscape: (f: () => boolean) => { escape = f; return unEscape; },
    fade: jest.fn(async () => {}), setTime: jest.fn(), hearts: () => 2,
    pathing: { groundAt: () => 0, find: jest.fn((from, to) => [{ x: from.x, y: 0, z: from.z }, { x: to.x, y: 0, z: to.z }]) },
    walkArea: { standHeight: () => 0 }, say: jest.fn(), spawnHearts: jest.fn(), addAffection: jest.fn(),
  } as unknown as ActivityContext;
  const activity = createSleepActivity(ctx);
  function character(id: string, height = 1) {
    let done: ((arrived: boolean) => void) | undefined;
    const c = { info: { id }, root: {rotation:{clone:()=>({}),set(){},copy(){}},updateWorldMatrix(){},children:[]}, position: new THREE.Vector3(0, 0, -2), isBusy: false, height, radius: .3, lyingClearance: .2,
      claim: jest.fn(() => { c.isBusy = true; return true; }), release: jest.fn(() => { c.isBusy = false; }),
      walkPath: jest.fn((route, _speed, callback) => { done = callback; c.position.set(route[route.length-1].x, 0, route[route.length-1].z); }),
      stopPath: jest.fn(), lookAt: jest.fn(), setPose: jest.fn(), headPosition: (v: THREE.Vector3) => v.copy(c.position),
    };
    visitors.set(id, c as unknown as PlazaCharacter);
    return { c, arrive: () => { const f = done; done = undefined; f?.(true); } };
  }
  return { ctx, player, visitors, activity, character, unInput, unEscape, unregister, start: () => spec.interact(), input: () => input(), escape: () => escape() };
}

const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
beforeAll(() => { Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => null }) } }); });
afterAll(() => { if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document'); });

describe('森の広場 添い寝の寿命と復元', () => {
  test('暖色光はゆっくり点き、起床と途中終了で必ずシーンから外れる', async () => {
    const s=setup(); expect(s.ctx.scene.getObjectByName('SleepBedLight')).toBeUndefined();
    s.start(); await flush(); const light=s.ctx.scene.getObjectByName('SleepBedLight') as THREE.PointLight;
    s.activity.update(.5); expect(light.intensity).toBeGreaterThan(0); expect(light.intensity).toBeLessThan(14);
    s.activity.update(3); expect(light.intensity).toBe(14);
    s.escape(); await flush(); expect(s.ctx.scene.getObjectByName('SleepBedLight')).toBeUndefined(); expect(light.intensity).toBe(0);
    s.start(); await flush(); s.activity.dispose(); expect(s.ctx.scene.getObjectByName('SleepBedLight')).toBeUndefined();
  });
  test('相手到着の暗転中だけ顔の向きを変え、身体は枕方向を保つ', async () => {
    const s=setup(),a=s.character('small');s.start();await flush();
    expect(s.player.setPose.mock.calls[0][0]).not.toHaveProperty('lookYaw');
    a.arrive();await flush();const pose=s.player.setPose.mock.calls[1][0] as {yaw:number;lookYaw:number;pitch:number};
    expect(pose.yaw).toBe(-Math.PI/2);expect(pose.lookYaw).not.toBe(pose.yaw);expect(pose.pitch).toBeLessThan(.95);s.activity.dispose();
  });
  test('キャラなしでも寝られ、Escを消費して時間・姿勢・登録を戻す', async () => {
    const s = setup(); s.start(); await flush();
    expect(s.player.isFixed).toBe(true); expect(s.ctx.director.sleeping).toBe(true);
    expect(s.escape()).toBe(true); await flush();
    expect(s.player.isFixed).toBe(false); expect(s.ctx.setTime).toHaveBeenLastCalledWith(null);
    expect(s.ctx.director.sleeping).toBe(false); expect(s.unInput).toHaveBeenCalledTimes(1);
    expect(s.unEscape).toHaveBeenCalledTimes(1); s.activity.dispose(); s.activity.dispose(); expect(s.unregister).toHaveBeenCalledTimes(1);
  });
  test('到着後に横臥し、8秒おき最大6加算、60秒で起床後は敷石まで占有する', async () => {
    const s = setup(), a = s.character('small'); s.start(); await flush(); a.arrive(); await flush();
    expect(a.c.setPose).toHaveBeenCalledWith({ posture: 'lie', breathing: true });
    for (let i=0;i<59;i++) s.activity.update(1);
    expect(s.ctx.addAffection).toHaveBeenCalledTimes(6);
    s.activity.update(1); await flush();
    expect(s.ctx.say).toHaveBeenCalledWith(a.c, 'wake'); expect(s.player.isFixed).toBe(false);
    expect(a.c.isBusy).toBe(true); a.arrive(); expect(a.c.isBusy).toBe(false); s.activity.dispose();
  });
  test('四捨五入先が家具でも本人半径を保って隣の安全な格子へつなぐ', async () => {
    const s = setup(), a = s.character('between-grid'); a.c.position.set(.12,0,-2);
    s.ctx.pathing.groundAt = (x,z) => x === 0 && z === -2 ? null : 0;
    s.start(); await flush();
    expect(s.ctx.pathing.find).toHaveBeenCalledWith({x:.25,y:0,z:-2},expect.anything(),a.c);
    expect(a.c.claim).toHaveBeenCalled(); expect(a.c.radius).toBe(.3); s.activity.dispose();
  });
  test('低く幅広い石は長手に幅を沿わせて布団で眠れる', async () => {
    const s = setup(), a = s.character('wide-small', .4675); a.c.radius = .9;
    s.start(); await flush(); a.arrive(); await flush();
    expect(a.c.setPose).toHaveBeenCalledWith({posture:'lie',breathing:true});
    expect(a.c.position.x).toBe(10.4); expect(a.c.position.y).toBe(.954); s.activity.dispose();
  });
  test('大柄な相手は足場に座り眠り、途中帰還で安全に起きる', async () => {
    const s = setup(), a = s.character('large', 1.85); s.start(); await flush(); a.arrive(); await flush();
    expect(a.c.setPose).toHaveBeenCalledWith({posture:'sit',offsetY:1.85*.28,breathing:true});
    s.activity.onCharacterRemoved!(a.c as unknown as PlazaCharacter); s.visitors.delete('large'); await flush();
    expect(s.player.isFixed).toBe(false); expect(s.ctx.director.sleeping).toBe(false); s.activity.dispose();
  });
  test('暗転中に閉じても遅い継続が寝姿勢や時間帯を再設定しない', async () => {
    const s = setup(); let finish!: () => void;
    (s.ctx.fade as jest.Mock).mockImplementationOnce(() => new Promise<void>(r => { finish = r; }));
    s.start(); s.activity.dispose(); finish(); await flush();
    expect(s.player.isFixed).toBe(false); expect(s.ctx.setTime).not.toHaveBeenCalledWith('夜');
    expect(s.ctx.director.sleeping).toBe(false);
  });
  test('相手の移乗暗転中に起床しても後から横臥しない', async () => {
    const s = setup(), a = s.character('small'); s.start(); await flush();
    let finish!: () => void;
    (s.ctx.fade as jest.Mock).mockImplementationOnce(() => new Promise<void>(r => { finish = r; }));
    a.arrive(); expect(s.input()).toBe(true); await flush(); finish(); await flush();
    expect(a.c.setPose).not.toHaveBeenCalledWith({posture:'lie',breathing:true});
    expect(s.player.isFixed).toBe(false); expect(s.ctx.director.sleeping).toBe(false); s.activity.dispose();
  });
  test('寝ている間は相手以外へのあいさつ・なでるも消費する', async () => {
    const s = setup(), a = s.character('other'); s.start(); await flush();
    expect(s.activity.onCharacterTouched!(a.c as unknown as PlazaCharacter, 'pet')).toBe(true);
    s.activity.dispose();
  });
  test('仲良し順に到達可能な相手を選びクリックを起床だけに消費する', async () => {
    const s = setup(), a = s.character('unreachable'), b = s.character('reachable');
    s.ctx.hearts = c => c.info.id === 'unreachable' ? 5 : 1;
    (s.ctx.pathing.find as jest.Mock).mockImplementation((from, to, c) => c === a.c ? null : [{x:to.x,y:0,z:to.z}]);
    s.start(); await flush(); expect(a.c.claim).not.toHaveBeenCalled(); expect(b.c.claim).toHaveBeenCalled();
    expect(s.input()).toBe(true); await flush(); expect(s.player.isFixed).toBe(false); s.activity.dispose();
  });
});
