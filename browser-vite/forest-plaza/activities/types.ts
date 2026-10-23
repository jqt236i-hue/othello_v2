/**
 * 活動は createXActivity(ctx) を export。index.ts が生成・更新・破棄する。
 * 手動活動: character.claim(owner, interrupted) → pathing.find → walkPath → release。
 * 自動活動: director.register({id, interval, participants, start(chars, finish)})。
 * start の chars は占有済み。終了・失敗・割込みの全経路で finish と自分の後始末を実行。
 * addInteractable は不可視 proxy を登録。dispose() で解除。小物/音の資源は活動が破棄。
 * hand.equip は model を取り付けるだけ。use は対象なしでも呼ばれ、他操作を常に遮断する。
 * 寝る時は player.setPose + director.sleeping=true。onInput/onEscape で起きて全て復元。
 */
import type * as THREE from 'three';
import type { PlazaCharacter, WalkArea } from '../characters';
import type { PlazaPlayer } from '../player';
import type { PlazaLineSituation } from '../lines';
import type { PlazaScene, PlazaTimeOfDay } from '../scene';
import type { PlazaPathing } from './pathing';
import type { ActivityDirector } from './director';
import type { PlazaAudio } from './audio';
export interface InteractionTarget { character: PlazaCharacter | null; direction: THREE.Vector3; point: THREE.Vector3 | null }
export interface Interactable {
  id: string; label: string; action: string;
  proxy: THREE.Object3D;
  reach?: number;
  enabled?(): boolean;
  interact(): void;
}
export interface InteractableHandle { dispose(): void }
export interface HeldItem {
  id: string; icon: string; model: THREE.Object3D;
  /** 絵だけのチップにも、ツールチップと読み上げでは正式名を渡す。 */
  label?: string;
  use(target: InteractionTarget): void;
  onUnequip?(): void;
}
export interface PlazaActivity {
  update(dt: number): void;
  dispose(): void;
  onCharacterRemoved?(character: PlazaCharacter): void;
  /** 通常は割込みの後始末。trueを返すと挨拶/なでを消費（おにごっこの捕獲用）。 */
  onCharacterTouched?(character: PlazaCharacter, kind: 'tap' | 'pet'): boolean | void;
}
export interface ActivityContext {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; player: PlazaPlayer; renderer: THREE.WebGLRenderer;
  visitors: ReadonlyMap<string, PlazaCharacter>; walkArea: WalkArea; pathing: PlazaPathing; plaza: PlazaScene;
  say(character: PlazaCharacter, situation: PlazaLineSituation, vars?: Record<string, string>): void;
  sayText(character: PlazaCharacter, text: string, ms?: number): void;
  spawnHearts(character: PlazaCharacter, count: number): void;
  addAffection(character: PlazaCharacter, amount: number): boolean;
  affection(character: PlazaCharacter): number;
  hearts(character: PlazaCharacter): number;
  addInteractable(spec: Interactable): InteractableHandle;
  hand: { equip(item: HeldItem | null): void; readonly current: HeldItem | null };
  setTime(name: PlazaTimeOfDay | null): void;
  fade(opacity: number, seconds?: number): Promise<void>;
  onEscape(handler: () => boolean): () => void;
  /** 移動/クリック/タップを先取り。true なら既存操作を止める（寝起き用）。 */
  onInput(handler: (kind: 'move' | 'click') => boolean): () => void;
  director: ActivityDirector; audio: PlazaAudio; isTouch: boolean; reach: number;
}
