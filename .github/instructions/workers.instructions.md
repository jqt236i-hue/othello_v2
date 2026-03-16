---
applyTo: 'workers/**/*.mjs,workers/**/*.js,utils/match-authority.js'
---

# workers instruction

この文書は worker / backend authority 向けの局所ルールだけを置きます。server-authoritative な契約と projection を守るための差分ルールです。

## この領域で守ること

- authority は server 側に寄せ、client-authored state を正本扱いしない。
- seat token、stateVersion、SSE、heartbeat、projection は同じ契約で扱う。
- root 側の worker 実装を正本とし、deploy 面や mirror 面は後でそろえる。

## 禁止

- browser DOM や UI 都合を worker に持ち込まない。
- local server と worker を別契約のまま進化させない。
- 曖昧な fallback や silent success で authority の不整合を隠さない。

## 変更時チェック

- authority と projection の責務が混ざっていない。
- seat token / SSE / heartbeat / reconnect 契約に抜けがない。
- local server や smoke test と矛盾していない。
