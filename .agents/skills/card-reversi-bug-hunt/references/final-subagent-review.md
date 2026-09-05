# 独立サブエージェント最終全体レビュー

この資料は、バグ修正で製品差分を作った場合に必ず読む。目的は元の症状だけを直して終わることではなく、変更全体が正しく、今回の修正による回帰、新しいバグ、副作用を残していないことを、実装を担当していないサブエージェントに厳しく確認させることである。

主担当は自分だけで安全性を認定してはならない。サブエージェントレビューは読取専用で行い、レビュー中は主担当も編集を止める。レビュアーの指摘を直すのは主担当とし、共有checkoutで同時編集しない。

## 1. 主担当がレビュー資料を固定する

委託前に次を揃える。

1. ユーザー依頼、元の再現手順、確定バグとした根拠、非ゴール。
2. task開始時のbaseline commit。既に今回task関連commitがある場合は、baselineから現在HEADまでの固定rangeをcommit IDで記録する。
3. 開始時と現在のGit可視なdirty files。修正へ進めるのは、staged、unstaged、non-ignored untrackedの全dirty stateが今回の依頼に関連し、その全体をレビュー対象にできる場合だけとする。一つでも無関係、所有者不明、別taskの変更があれば製品コードを編集しない。
4. 実行したfocused test、build、browser/network checkと結果。初回失敗、retry、未実行checkも含める。
5. 期待結果の根拠となる`01-rulebook.md`、関連`正本/*.md`、`docs/architecture-contracts.md`、適用される`AGENTS.md` / `AGENTS.override.md`。
6. 変更したsource、test、docs、生成物、mirror、現在のstaged/unstaged/untracked全体。raw patchやfile本文をbriefへ貼らず、レビュアーが共有checkoutから直接読む。新しいcommitを最終レビュー前に作る許可を意味しない。
7. `scripts/workspace_fingerprint.py` schema version 1の出力。helperはSHA-256とbinary-safeなtag/payload length-prefix recordsを使い、HEAD、porcelain-v1 `-z` status、staged/unstaged binary diff、全non-ignored untracked path/mode/contentまたはsymlink targetをcanonical順で集約する。各実行内で連続2 snapshotが一致しない場合は失敗する。
8. baseline commit、今回task関連commitの固定range、exact helper command、exact helper JSON、dirty state全体を唯一の固定review scopeとする。独自の連結や別方式のreview bundle fingerprintは作らない。untracked fileはGit diffに現れないため、briefにはpath、kind、byte length、content hashだけを記録し、本文は転記しない。レビュアーが共有checkout上のファイルを直接全文読み、新規追加としてレビューする。

サブエージェントには主担当の「安全だと思う」「ここだけ見ればよい」「問題なしのはず」といった結論を渡さない。元の依頼と生の証拠は渡すが、望む判定へ誘導しない。委託機能がcontext量を選べる場合は、`fork_turns="none"`または必要最小限を使い、下記のreview briefだけを与える。

レビュー中は主担当も編集しない。別sessionを含めexact helper JSONがcheck point間で変わった場合、変更のtask ownershipにかかわらず、そのpassは結果内容にかかわらず無効とし、更新後の固定review scopeで全体レビューを再委託する。

helperが保証するのは、開始・終了・結果採用直前の各check pointで得た連続安定snapshotの一致であり、途中で変更され同一byteへ戻るABA mutationの不存在ではない。並行編集の通知、process、timestampなど変更の兆候を認識した場合はdigestが同じでもpassを無効にする。checkoutを静止できない場合はblockerとする。

### Fingerprint command

主担当とレビュアーは同じskill fileと同じ引数を使う。独自の連結・hash手順へ置き換えない。

```powershell
python -X utf8 "<skill path>\scripts\workspace_fingerprint.py" --repo "<repository root>" --task-untracked "<今回task関連のuntracked Git path>"
```

`--task-untracked`は今回task関連のuntracked fileごとに繰り返す。PATHはGitが示すrepository-relative pathを文字どおり渡し、directory separatorには`/`を使う。`\`はseparatorへ変換せず、存在する場合はfilename中のliteral characterとして扱う。該当ファイルがなければ引数を省略する。出力の`schemaVersion`が`1`でない、`consecutiveMatchingSnapshots`が`2`でない、または`helperSha256`が存在しない場合はblockerとする。helperが失敗する、または同じ引数で同じcheckoutを再計算できない場合もレビューを開始・採用しない。

出力JSONはworkspace aggregate、helper自身のhash、今回task関連untracked metadataだけをbriefへ含める。raw patch、raw diff、file本文はbriefへ含めない。Git可視な変更にcredentialやsecretが含まれる疑いがある場合は、値や該当行をprompt、log、findingへコピーせず、secret混入をblockerとして返す。

## 2. 委託brief

実際のpath、baseline、今回task関連のfilesへ置き換えて使う。

```text
あなたはCard Reversiの独立最終レビュアーです。読取専用でレビューし、ファイルを編集・stage・commitしないでください。

最初に `$card-reversi-bug-hunt` を使用し、<skill path>/SKILL.md と <skill path>/references/final-subagent-review.md を省略せず全文読んでください。このbriefとskillが矛盾する場合は、ユーザーの明示指示とskillの厳しいreview gateを優先してください。

目的:
- 今回の修正による回帰、新しいバグ、副作用を発見する
- 元の症状だけでなく、固定commit rangeと現在のdirty state全体、その影響先を監査する
- 仕様が明確な確定問題だけをfindingとし、仕様判断や主観的改善を混ぜない

必ず行うこと:
1. rootから対象までのAGENTS.md / AGENTS.override.md、関連する仕様正本とarchitecture contractを読む
2. baseline commit、今回task関連commitの固定range、現在のdirty stateをすべて確認する
3. 変更したsymbolのcaller/consumerと、関係するbrowser/headless/network/Worker/generated経路を追う
4. 元の再現、隣接正常系、関連する境界・失敗・回復経路、実行済みcheckの十分性を評価する
5. authority/presentation、events順序、Single Visual Writer、lock/teardown、runtime parity、privacyへの副作用を変更範囲に応じて監査する

出力:
- findingsを重要度順に先に書く
- 各findingにfile/line、再現または具体的な失敗経路、期待結果の根拠、影響、Confidenceを含める
- 未確定、仕様判断待ち、無関係な既存問題は確定findingと分ける
- 確定findingがなければ「確認範囲内に追加の確定問題なし」と明記し、確認範囲と未検証領域を列挙する

対象タスク: <ユーザー依頼>
skill path: <card-reversi-bug-huntの絶対path>
baseline: <task開始時commit>
task commit range: <既存task関連commitがあればimmutable commit IDのrange。なければnone>
review target: <現在の全dirty file path。全て今回task関連であること。raw patch/file本文は含めない>
fingerprint command: <version 1 helperの絶対path、repo、全task-untracked引数>
workspace fingerprint: <helperが出力したexact JSON。schemaVersion 1 / consecutiveMatchingSnapshots 2 / helperSha256>
元の証拠: <再現、expected、actual>
実行済みcheck: <commandと結果>
```

## 3. サブエージェントが全diffを読む

レビュアーは開始時にbriefのexact fingerprint commandを再実行し、schema version、helper path、引数、helper hash、workspace fingerprint、untracked metadataを含むexact JSONが一致することを確認する。次に`git status --short`、`git diff --name-status`、固定commit range、staged/unstaged diffを使い、全hunkを確認する。briefのdirty file一覧と実際の全dirty stateが一致しない、または今回taskと無関係・所有者不明のdirty changeが一つでもある場合はblockerとして返す。

Git diffだけに依存しない。untracked fileはmetadataのhashを照合した後、共有checkout上で一つずつ全文読み、新規追加ファイルとして内容、caller/consumer、test validityをレビューする。statusの`??`とfile listだけではレビュー済みとみなさず、本文をbriefへ転載しない。credentialやsecretを検出した場合は値や該当行を引用せずblockerとして返す。

各hunkについて次を確認する。

- 元の根本原因を直しており、症状だけを隠すfallback、silent no-op、広い`catch`、timeout解除になっていないか。
- 条件が広すぎて正常系を変えないか、狭すぎて別入口から同じバグが残らないか。
- default、null/undefined、empty、境界値、重複、順序、非同期完了、cancel/reset/reconnectで意味が変わらないか。
- 型、戻り値、例外、event順序、stateVersion、operation identity、座標、owner/player表現をcallerとconsumerが同じ意味で扱うか。
- timer、listener、observer、ticker、Worker、subscription、callbackにownerとteardownがあり、古いgenerationが現在状態を変更しないか。
- busy/input/playback/selection lockがsuccess、failure、cancel、reset、reconnect、backend replacementの全terminal pathで正しいownerからsettleするか。
- テスト期待値を実装へ合わせただけ、assertionを弱めただけ、skipしただけになっていないか。
- debug log、test hook、TODO、temporary artifact、不要import、dead branch、重複helper、意図しない書式変更が残っていないか。
- root source、生成物、browser artifact、Worker mirrorが正しい生成経路で同期され、mirrorをsource-editしていないか。

説明できないhunk、未確認のcaller、証拠と一致しないtestがあれば、具体的なfindingまたは未検証事項として返す。

結果を返す直前にexact fingerprint commandを再実行する。開始時のexact JSONと異なる、helperが失敗する、または並行編集の兆候がある場合は、所有者にかかわらずレビュー結果を合格判定に使わず、「shared checkout変更によりpass無効」と返す。主担当も結果採用直前に同じcommandと引数でexact JSONを照合する。

## 4. 影響先と構造境界を監査する

変更に関係する項目だけを選ぶが、選んだ境界は明示的に確認する。

### Game / UI / presentation

- canonical resultをgame/authorityが決め、UI previewやanimation stateが結果を上書きしていない。
- `events[]`の順序、pending selection identity、turn handoffが変わっていない。
- Single Visual Writerを守り、PixiとDOM compatibility、複数canvas/ticker、別settlement pathを同時に作っていない。
- canonical state、visual state、busy/input/playback lockが成功後と回復後に収束する。

### Network / parity / privacy

- publish、SSE、snapshot、reconnect、idempotency、stateVersion、operationIdの優先順位を壊していない。
- Workerとlocal server、browserとheadless、必要なclassic/Vite経路が同じ契約を維持する。
- opponent hand、seat token、内部hashなどの非公開情報をdiagnosticsやpublic payloadへ広げていない。

### Lifecycle / delivery

- reset、destroy、reconnect、backend replacement後に古い非同期処理が残らない。
- browser bundle、module registry、cachebuster、assets、Worker mirrorが変更リスクに応じて更新される。
- performance hot pathへ不要なper-frame allocation、全state scan、再構築、無制限queueを増やしていない。

## 5. 回帰と副作用を実行経路で探す

レビュアーは既存の検証証拠を評価し、不足時は安全な読取専用diagnosticやcheckを実行できる。製品ファイルを書き換えるcheckは使わない。report、screenshot、cacheなどを書き出す必要がある場合は共有checkout外の隔離された一時場所を使い、固定review scopeへ副作用を加えない。

1. **元の経路**: 修正前の再現手順が解消し、最終stateまでsettleする。
2. **隣接正常系**: 同じ関数・入力・state machineを使うが、バグ条件を満たさない通常操作が従来どおり動く。
3. **負または境界経路**: 無効入力、empty、端座標、重複入力、最大/最小、対象なしなど関連する境界。
4. **中断・回復経路**: animation中入力、cancel、reset、reload、reconnect、context loss、例外など関連する回復。
5. **同等runtime**: 契約されたparityがある場合だけ、classic/Vite、local/network、browser/headless、Pixi/DOM compatibilityを比較する。

実ブラウザ変更では、HTTP 200やshell DOMだけでなく、実際の操作、active backend、console/page error、スクリーンショットまたはpublic diagnostics、次の入力が可能になることまで確認する。

安全判定に不可欠なcheckが実行不能で、同等の証拠もない場合はblockerとして返す。理由を記載するだけで合格にしない。blast radius上で非必須のcheckだけを未検証範囲または残留リスクとして扱える。

## 6. Findingsの基準

サブエージェントのfindingも、スキル本体の分類と確定ゲートに耐える必要がある。

- **今回の差分に起因する確定バグ／回帰／副作用**: actionable findingとして返す。
- **元バグと同じ根本原因で、明示された元契約を完全に回復するために必要な確定欠陥**: 根拠と最小の失敗経路を付けて返す。
- **未確定／仕様判断待ち／改善提案**: 確定findingと分け、なぜ修正不可かを書く。
- **それ以外の既存バグ**: task blockerにせず、別件候補として分ける。隣接しているだけでは元の修正scopeに含めない。

SeverityとConfidenceを分ける。高Severityでも根拠が足りなければ確定findingにしない。確定findingがゼロの場合も、確認範囲、実行したcheck、未検証領域、残留リスクを必ず返す。

## 7. 主担当の修正・再委託ループ

1. 主担当はfindingの再現、仕様根拠、taskとの因果を確認し、同じ確定ゲートで分類する。
2. 今回の差分に起因する確定問題、または元バグと同じ根本原因で元契約の完全な回復に必要な確定欠陥だけを修正する。
3. focused verificationと必要なbuild/browser/network checkを再実行する。
4. 主担当の編集を再び止め、更新後の固定commit rangeとdirty state全体をサブエージェントへ再委託する。
5. 再レビューも追加修正部分だけに限定せず、この資料の手順1から全体をやり直させる。

主担当は全findingをID付き台帳へ残し、`修正済み`、`根拠付きで未確定`、`仕様判断待ち`、`無関係な既存問題`、`blocker`のいずれかに分類する。修正しなかったactionable findingには反証を付ける。次のreview briefへ前回findingと台帳を追加し、新しいレビュアーへ反証も独立再評価させる。初回レビューでは主担当の結論を渡さないが、再レビューでは未解決findingを隠さない。

可能なら再レビューは前回と別のサブエージェントへ委託する。利用可能枠などの制約で同じレビュアーを使う場合は、新しいturnで更新後のbaseline、全diff、check evidenceを渡し、前回結論に依存せず読み直すよう明示する。複数レビュアーの意見が割れた場合は多数決にせず、主担当が証拠を追加して確定ゲートを再評価する。

最新のレビュー一周で新しい確定問題がゼロであり、finding台帳に未解決のactionable findingがなくなるまで繰り返す。レビュアーが主担当の反証を退けた場合は多数決にせず、追加証拠で確定ゲートを再評価する。サブエージェントが利用できない、必要資料へ到達できない、または同じblockerが繰り返される場合は、主担当だけで完了扱いにせずblockerを報告する。

## 8. 完了記録

次を記録して初めて完了できる。

- 委託したサブエージェントとレビュー回数。
- 各passのversion 1 fingerprint commandとexact JSONが、開始・終了・結果採用時に一致し、固定review scopeが不変だったこと。raw contentやsecretは記録しない。
- 各回で確認したdiff、caller/consumer、runtime、実機シナリオ。
- 発見した回帰・副作用、主担当の修正、再レビュー結果。なければ「確認範囲内に追加の確定問題なし」。
- finding台帳と、修正しなかったfindingに対する反証・最新レビュアーの再評価。
- 実行したcheckと結果、実行しなかったcheckと理由。
- 未確定候補、仕様判断待ち、未検証範囲、残留リスク。
- 最終の固定commit range、dirty state全体、`git status --short`、commit。

サブエージェントの「問題なし」という一文だけでは合格にしない。確認範囲と証拠があり、最終差分の後に行われたレビューであることを確認し、「独立サブエージェントの最終全体レビューで、確認範囲内に未修正の確定回帰・副作用なし」と報告する。
