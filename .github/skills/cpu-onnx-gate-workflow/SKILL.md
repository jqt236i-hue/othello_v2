---
name: 'cpu-onnx-gate-workflow'
description: 'browser ONNX gate, runtime guard, benchmark script, fallback 判定を、この repo の shared profile と browser runtime 前提に合わせて安全に直すワークフロー。Use when editing scripts/benchmark-policy-onnx-gate.js, ui/handlers/cpu-policy.js, game/ai/policy-onnx-runtime.js, game/cpu-decision.js, or related ONNX gate tests in this card-othello repository.'
argument-hint: 'どの gate や fallback を直したいか。browser, runtime, benchmark, profile のどこかも書く'
---

# CPU ONNX Gate Workflow

このスキルは、browser 側 ONNX 利用条件、runtime guard、benchmark script、fallback 判定を同じ前提でそろえる時の手順です。

## When to Use

- browser では ONNX を使うのに benchmark では違う判定になる時
- runtime guard や unsupported case の fallback を直したい時
- shared profile と UI handler の gate 条件をそろえたい時
- ONNX まわりの test や benchmark が意図せず変わった時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `constants/cpu-lv6-shared-profile.js`
- `scripts/benchmark-policy-onnx-gate.js`
- `ui/handlers/cpu-policy.js`
- `game/ai/policy-onnx-runtime.js`
- `game/cpu-decision.js`
- 関連 test: `test/ui.cpu-policy-handler.test.js`, `test/game.cpu-policy-table-runtime.test.js`, `test/selfplay.benchmark-policy.test.js`

## Common Traps

- shared profile、browser handler、benchmark script の判定を別々に動かすこと
- unsupported case で曖昧な半成功を返し、fallback を見えにくくすること
- runtime guard を 1 面だけ変えて、別経路を古いまま残すこと
- fallback 経路の存在を test や報告から落とすこと

## Procedure

1. 問題が shared profile、browser handler、runtime、benchmark、fallback のどこにあるかを先に固定する。
2. gate 条件を 1 つの考え方に寄せ、各 surface の条件が同じ意味になるようにそろえる。
3. unsupported な入力や runtime 不可時は、明示的な fallback 経路へ落とす。
4. browser と benchmark の両方で見える契約を崩していないかを確認する。
5. 関連 test と benchmark 側の確認結果を同じ報告にまとめる。

## Validation Bundle

- `test/ui.cpu-policy-handler.test.js`
- `test/game.cpu-policy-table-runtime.test.js`
- `test/game.cpu-policy-onnx-runtime.test.js`
- `test/selfplay.benchmark-policy.test.js`
- `test/selfplay.policy-onnx-gate.test.js`
- `test/cpu.turn-handler.onnx-hold.test.js`
- `test/cpu.lv6-shared-profile.test.js`

## Completion Checklist

- browser, runtime, benchmark の gate 条件がそろっている
- fallback が明示的で、曖昧な成功にしていない
- 関連 test / benchmark 確認を報告している
- `01-rulebook.md` 更新有無を報告している
