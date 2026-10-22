export interface PathPoint { x: number; y: number; z: number }
export interface PathOptions {
  groundAt(x: number, z: number): number | null;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  radius?: number;
  blocked?(x: number, z: number): boolean;
  step?: number;
  maxStep?: number;
  maxVisited?: number;
  /** 静的な半径・段差・範囲検査済みの高さ。動的障害は探索ごとに別途評価する。 */
  staticHeightAt?(x: number, z: number): number | null;
}
/** 家具は動かないので、キャラ半径ごとの静的高さを探索をまたいで共有する。 */
export function createStaticPathHeights(groundAt: PathOptions['groundAt'], bounds: PathOptions['bounds']) {
  const caches = new Map<string, (x: number, z: number) => number | null>();
  return {
    forRadius(radius: number, step = 0.25, maxStep = 0.4): (x: number, z: number) => number | null {
      const key = `${radius}:${step}:${maxStep}`;
      const existing = caches.get(key); if (existing) return existing;
      const minX = Math.ceil(bounds.minX / step), minZ = Math.ceil(bounds.minZ / step);
      const width = Math.floor(bounds.maxX / step) - minX + 1, depth = Math.floor(bounds.maxZ / step) - minZ + 1;
      const values = new Float64Array(width * depth); values.fill(NaN);
      const get = (x: number, z: number): number | null => {
        if (x-radius < bounds.minX || x+radius > bounds.maxX || z-radius < bounds.minZ || z+radius > bounds.maxZ) return null;
        const ix = Math.round(x / step) - minX, iz = Math.round(z / step) - minZ, index = iz * width + ix;
        if (ix < 0 || ix >= width || iz < 0 || iz >= depth) return null;
        const cached = values[index]; if (!Number.isNaN(cached)) return cached === Infinity ? null : cached;
        let y = groundAt(x,z);
        if (y !== null) for (const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius]]) {
          const side = groundAt(x+dx,z+dz);
          if (side === null || Math.abs(side-y) > maxStep) { y = null; break; }
        }
        values[index] = y ?? Infinity; return y;
      };
      caches.set(key,get); return get;
    },
    get size(): number { return caches.size; },
  };
}
/** 重なっている時だけ、さらに近づかない移動で離脱できる。 */
export function clearsDynamicObstacle(from: {x:number;z:number}, to: {x:number;z:number}, obstacle: {x:number;z:number}, clearance: number): boolean {
  const dx=to.x-obstacle.x, dz=to.z-obstacle.z, fx=from.x-obstacle.x, fz=from.z-obstacle.z;
  const next=dx*dx+dz*dz;
  return next >= clearance*clearance || next + 1e-8 >= fx*fx+fz*fz;
}
interface Workspace {
  busy: boolean; stamp: number;
  best: Float64Array; heights: Float64Array; parents: Int32Array;
  seen: Uint32Array; heightSeen: Uint32Array; closed: Uint32Array;
  heapIndices: Int32Array; heapGs: Float64Array; heapFs: Float64Array; heapOrders: Uint32Array;
}
// 同期APIの作業配列を使い回す。世代で初期化を省き、連続要求で大量のMap/文字列/GCを作らない。
// groundAt等から再入された場合だけ別の作業配列を確保する。
const workspacePool = new Map<number, Workspace[]>();
function acquire(size: number): Workspace {
  let pool=workspacePool.get(size); if (!pool) {pool=[];workspacePool.set(size,pool);}
  let work=pool.find(w=>!w.busy);
  if (!work) {work={busy:false,stamp:0,best:new Float64Array(size),heights:new Float64Array(size),parents:new Int32Array(size),seen:new Uint32Array(size),heightSeen:new Uint32Array(size),closed:new Uint32Array(size),heapIndices:new Int32Array(size*2),heapGs:new Float64Array(size*2),heapFs:new Float64Array(size*2),heapOrders:new Uint32Array(size*2)};pool.push(work);}
  work.busy=true;work.stamp=(work.stamp+1)>>>0;
  if (!work.stamp) {work.seen.fill(0);work.heightSeen.fill(0);work.closed.fill(0);work.stamp=1;}
  return work;
}
const NEIGHBORS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;
/** 必要な格子だけ評価するA*。斜めの角抜けを許さず、到達不能ならnull。同期契約は変えない。 */
export function findPath(from: { x: number; z: number }, to: { x: number; z: number }, options: PathOptions): PathPoint[] | null {
  const step=options.step??0.25, radius=options.radius??0.3, maxStep=options.maxStep??0.4, b=options.bounds;
  if (!(step>0)) return null;
  const minX=Math.ceil(b.minX/step), minZ=Math.ceil(b.minZ/step);
  const width=Math.floor(b.maxX/step)-minX+1, depth=Math.floor(b.maxZ/step)-minZ+1;
  if (width<=0||depth<=0) return null;
  const sx=Math.round(from.x/step)-minX, sz=Math.round(from.z/step)-minZ;
  const tx=Math.round(to.x/step)-minX, tz=Math.round(to.z/step)-minZ;
  if (sx<0||sx>=width||sz<0||sz>=depth||tx<0||tx>=width||tz<0||tz>=depth) return null;
  const work=acquire(width*depth), {best,heights,parents,seen,heightSeen,closed,stamp}=work;
  try {
    const height=(x:number,z:number):number=>{
      if(x<0||x>=width||z<0||z>=depth)return Infinity;
      const index=z*width+x;if(heightSeen[index]===stamp)return heights[index];
      heightSeen[index]=stamp;
      const wx=(x+minX)*step,wz=(z+minZ)*step;
      let y:number|null=null;
      if(wx-radius>=b.minX&&wx+radius<=b.maxX&&wz-radius>=b.minZ&&wz+radius<=b.maxZ&&!options.blocked?.(wx,wz)){
        if(options.staticHeightAt)y=options.staticHeightAt(wx,wz);
        else{
          y=options.groundAt(wx,wz);
          if(y!==null)for(const[dx,dz]of [[radius,0],[-radius,0],[0,radius],[0,-radius]]){
            const side=options.groundAt(wx+dx,wz+dz);
            if(side===null||Math.abs(side-y)>maxStep){y=null;break;}
          }
        }
      }
      return heights[index]=y??Infinity;
    };
    if(height(sx,sz)===Infinity||height(tx,tz)===Infinity)return null;
    const heuristic=(x:number,z:number)=>{const dx=Math.abs(tx-x),dz=Math.abs(tz-z);return Math.max(dx,dz)+(Math.SQRT2-1)*Math.min(dx,dz);};
    let order=0, heapLength=0;
    let {heapIndices,heapGs,heapFs,heapOrders}=work;
    const copy=(to:number,from:number)=>{heapIndices[to]=heapIndices[from];heapGs[to]=heapGs[from];heapFs[to]=heapFs[from];heapOrders[to]=heapOrders[from];};
    const before=(f:number,o:number,other:number)=>f<heapFs[other]||(f===heapFs[other]&&o<heapOrders[other]);
    const push=(index:number,g:number,f:number)=>{
      if(heapLength===heapIndices.length){
        const size=heapLength*2;
        const indices=new Int32Array(size),gs=new Float64Array(size),fs=new Float64Array(size),orders=new Uint32Array(size);
        indices.set(heapIndices);gs.set(heapGs);fs.set(heapFs);orders.set(heapOrders);
        work.heapIndices=heapIndices=indices;work.heapGs=heapGs=gs;work.heapFs=heapFs=fs;work.heapOrders=heapOrders=orders;
      }
      const sequence=order++;let i=heapLength++;
      while(i>0){const p=(i-1)>>1;if(!before(f,sequence,p))break;copy(i,p);i=p;}
      heapIndices[i]=index;heapGs[i]=g;heapFs[i]=f;heapOrders[i]=sequence;
    };
    const pop=()=>{
      const last=--heapLength;
      if(last===0)return;
      const index=heapIndices[last],g=heapGs[last],f=heapFs[last],sequence=heapOrders[last];let i=0;
      while(i*2+1<heapLength){let child=i*2+1;if(child+1<heapLength&&before(heapFs[child+1],heapOrders[child+1],child))child++;if(!before(heapFs[child],heapOrders[child],last))break;copy(i,child);i=child;}
      heapIndices[i]=index;heapGs[i]=g;heapFs[i]=f;heapOrders[i]=sequence;
    };
    const start=sz*width+sx,target=tz*width+tx;
    push(start,0,heuristic(sx,sz));best[start]=0;seen[start]=stamp;parents[start]=-1;
    let visited=0;
    while(heapLength&&visited<(options.maxVisited??14000)){
      const index=heapIndices[0],currentG=heapGs[0];pop();
      if(closed[index]===stamp||currentG!==best[index])continue;
      if(index===target){const path:PathPoint[]=[];for(let n=index;n!==-1;n=parents[n])path.push({x:(n%width+minX)*step,y:heights[n],z:(Math.floor(n/width)+minZ)*step});return path.reverse();}
      closed[index]=stamp;visited++;
      const x=index%width,z=Math.floor(index/width),baseY=heights[index];
      for(const[dx,dz]of NEIGHBORS){
        const nx=x+dx,nz=z+dz,y=height(nx,nz);
        if(y===Infinity||Math.abs(y-baseY)>maxStep)continue;
        const next=nz*width+nx;if(closed[next]===stamp)continue;
        if(dx&&dz){const a=height(x+dx,z),c=height(x,z+dz);if(a===Infinity||c===Infinity||Math.abs(a-baseY)>maxStep||Math.abs(c-baseY)>maxStep||Math.abs(a-y)>maxStep||Math.abs(c-y)>maxStep)continue;}
        const g=currentG+(dx&&dz?Math.SQRT2:1);
        if(seen[next]===stamp&&g>=best[next])continue;
        seen[next]=stamp;best[next]=g;parents[next]=index;
        push(next,g,g+heuristic(nx,nz));
      }
    }
    return null;
  } finally {work.busy=false;}
}
export interface PlazaPathing {
  find(from: { x: number; z: number }, to: { x: number; z: number }, self?: import('../characters').PlazaCharacter): PathPoint[] | null;
  groundAt(x: number, z: number): number | null;
}
