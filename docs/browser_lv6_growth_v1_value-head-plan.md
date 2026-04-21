# browser_lv6_growth_v1 value head 改良計画

最終更新: 2026-04-18

## 目的

`browser_lv6_growth_v1` は現在の昇格判定が `quick-only` で、自己対局も policy-table 主体です。  
このレーンでは value head 学習の寄与が小さい一方で、学習時間、checkpoint、ONNX 成果物、昇格引数の複雑さだけが増えていました。  
目的は、レーン単位で value head を明示的に切り替えられるようにし、このレーンでは安全に無効化することです。

## 診断

1. quick / quality / final の主要判定は policy-table ベースで、value ONNX を直接見ていない。
2. 自己対局生成も value ONNX を読まない。
3. 一方で training cycle は毎周期 value 学習、value checkpoint、promotion bundle を作っていた。
4. そのため `browser_lv6_growth_v1` では、value head は補助用途しか持たないのに、運用コストだけが残っていた。

## 設計方針

1. `trainValueEvery` は残し、頻度制御と有効/無効制御を分離する。
2. 新フラグ `--train-value-head` / `--no-train-value-head` を追加する。
3. 無効時は以下を一貫して止める。
   - value 学習 step
   - value 用成果物パス生成
   - value checkpoint carry-over
   - candidate / target の value ONNX bundle
   - promotion / onnx gate への value 引数
4. summary に `trainValueHeadEnabled` を残し、後から run を見ても条件が分かるようにする。

## 実装手順

1. training cycle の CLI に value head enable/disable を追加する。
2. iteration path と carry-over を value head 有効時だけ生成する。
3. command builder を修正し、value bundle を条件付きにする。
4. `browser_lv6_growth_v1` profile から value 専用フラグを外し、`--no-train-value-head` を明示する。
5. 単体テストを追加し、value あり / value なし両方の経路を固定する。
6. 学習を新設定で再起動し、ログから反映を確認する。

## 完了条件

1. `browser_lv6_growth_v1` の resolved command に `--no-train-value-head` が入る。
2. `train_value_onnx.py` が起動されない。
3. promotion / onnx gate 引数に value ONNX が含まれない。
4. summary に `trainValueHeadEnabled=false` が残る。
5. 既存の value 有効レーンは従来どおり動く。
