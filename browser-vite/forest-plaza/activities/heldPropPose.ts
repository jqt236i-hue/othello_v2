/** 一人称の小物だけを縮小し、手や三人称の実寸は変えない。 */
export function heldPropPose(view: 'first' | 'third', touch: boolean, ball: boolean) {
  if (view === 'third') return { scale: 1, x: .14, y: ball ? -.08 : -.05, z: -.10 };
  return { scale: .55, x: touch ? -.10 : 0, y: ball ? -.08 : -.05, z: ball ? -.01 : -.025 };
}
