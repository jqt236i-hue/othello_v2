/** Offline fitted public-state value coefficients.
 * Same values as cpu-lv12-model.ts (source: training/python/fit_cpu_lv12_value.py;
 * 62 historical games, 36 condition groups).
 * Dataset SHA256: dbf33b768801d1b48a138d7fc6f6b63343e3a8bad74b5f3d44f858e64e50df75
 * Fit SHA256: 0e4987d8c2e0b897e74658a82096772d92332ca590ea1d854f9a162f02a7e4df
 * Four grouped folds selected board-and-tempo features, regularization 0.3.
 * Tempo is scaled by available legal placements.
 * This fit is development evidence, not a match-strength qualification.
 * The two trailing stone-supply coefficients were selected by stone-supply match comparisons (see below). */
export const LV13_VALUE_WEIGHTS:readonly number[]=Object.freeze([
    1.0918106317551999,
    2.2730892394028843,
    0.5313048509649553,
    -0.3327473996584492,
    1.4176351799147464,
    -0.0029051112221033823,
    0.9637331880975403,
    0.4235820233351615,
    0.29396267243829294,
    0.8841856493931296,
    0.16134592643142767,
    -0.9305822976525501,
    -0.14639243790206924,
    0,
    -1.3573596133413854,
    4.801188417600151,
    0.5635839848303432,
    0.026303795185024473,
    0.014554466684636717,
    0.09669878694914093,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // stonePlacementLead / stonePlacementLeadEnd（持ち石ルール時のみ非 0 の特徴量）。
    // 持ち石 ON の対旧 Lv13 比較（縮小予算）で 1/2・4/6・10/10・20/20・30/30 を比べ、
    // 10/10 が最良（得点率 0.58〜0.63）。持ち石 ON 240 局の値関数学習も 8.5 / 8.9 を選んだ。
    10,
    10,
    // stable / stableEnd（安定石の差、Lv13 独自。docs/cpu-lv13-development-plan.md 第4段階）。
    // Lv13 自己対局 182 局面の深い読み（遷移 12,288×仮想世界 3 組）の評価に、他の係数を固定して残差を当てはめた値。
    // 高速対局 128 局で 68 勝 59 敗 1 分（誤差の範囲）、2 倍強めの 2.5/-1.5 は 66 勝 62 敗。
    1.18,
    -0.44
]);
