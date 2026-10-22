export interface Vec { x:number; y:number; z:number }
export interface BallState { position:Vec; velocity:Vec }
export interface BallContact { distance:number; normal:Vec }
export const BALL_RADIUS=.16;
export function outsidePlaza(p:Vec):boolean { return p.x < -13.5 || p.x > 13.5 || p.z < -22.5 || p.z > 5.5 || p.y < -3; }
/** 小さい固定刻みでsweepし、高速でも薄い家具を抜けない。
 * sweepは半径を含めた球面の接触距離を返す（中心から面までの距離ではない）。 */
export function stepBall(state:BallState,dt:number,sweep:(from:Vec,direction:Vec,distance:number)=>BallContact|null):void {
  let remaining=Math.min(Math.max(dt,0),.25);
  while(remaining>1e-8) {
    const h=Math.min(remaining,1/120); remaining-=h;
    const v=state.velocity,p=state.position; v.y-=9.8*h;
    const speed=Math.hypot(v.x,v.y,v.z); if(speed<1e-9)continue;
    const d={x:v.x/speed,y:v.y/speed,z:v.z/speed},travel=speed*h;
    const hit=sweep(p,d,travel);
    if(hit) {
      const move=Math.max(0,Math.min(travel,hit.distance-.002));
      p.x+=d.x*move; p.y+=d.y*move; p.z+=d.z*move;
      const n=hit.normal,dot=v.x*n.x+v.y*n.y+v.z*n.z;
      if(dot<0) { const restitution=n.y>.55 && Math.abs(dot)<.65?0:.55; v.x-=(1+restitution)*dot*n.x; v.y-=(1+restitution)*dot*n.y; v.z-=(1+restitution)*dot*n.z; }
      if(n.y>.55) { const friction=Math.exp(-5*h); v.x*=friction; v.z*=friction; if(Math.hypot(v.x,v.z)<.065){v.x=0;v.z=0;} }
    } else { p.x+=v.x*h; p.y+=v.y*h; p.z+=v.z*h; }
  }
}
export function nearestAvailable<T extends {isBusy:boolean;position:{x:number;z:number}}>(characters:Iterable<T>,point:{x:number;z:number},limit=2):T[] {
  return [...characters].filter(c=>!c.isBusy).sort((a,b)=>Math.hypot(a.position.x-point.x,a.position.z-point.z)-Math.hypot(b.position.x-point.x,b.position.z-point.z)).slice(0,Math.max(0,limit));
}
export function canReward(now:number,last:number|undefined):boolean { return last===undefined || now-last>=5; }
