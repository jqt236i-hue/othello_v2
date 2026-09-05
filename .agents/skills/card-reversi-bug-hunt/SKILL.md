---
name: card-reversi-bug-hunt
description: "カードリバーシを実ブラウザで探索し、プレイヤーが遭遇する不具合を再現・原因調査・検証する。実機ゲーム検証、探索的バグハント、回帰調査、そこで確定したバグの修正、修正後の独立サブエージェント全体レビューに使用する。新機能、主観的なUI改善、バランス変更、仕様が欠落・矛盾している挙動には使用しない。"
---

# Card Reversi Bug Hunt

## 目的

プレイヤーと同じブラウザ経路で問題を探索し、候補を再現・切り分けし、明確に証明できたバグだけを修正する。探索件数ではなく、証拠と原因の質を優先する。

探索と原因調査が終わるまで製品コードを変更しない。ユーザーが検証・調査・レビューだけを依頼した場合は、確定バグも含めて報告だけに留める。ユーザーが修正まで明示した場合に限り、後述の確定ゲートをすべて通ったバグを修正する。

修正差分を作ったタスクは、独立サブエージェントによる厳しい最終全体レビューを通過するまで完了ではない。主担当は自分だけで安全性を認定してはならない。今回の修正による回帰、新しいバグ、副作用を確定した場合はそれも修正し、サブエージェント全体レビューを最初からやり直す。

## 最初に確認する正本と境界

1. リポジトリルートと対象ブランチを確認し、root から対象ファイルまでの `AGENTS.md` / `AGENTS.override.md` をすべて読む。
2. プレイヤー向け期待結果は `01-rulebook.md`、関連するカード・ターン・表示・音の詳細は該当する `正本/*.md` を根拠にする。
3. 内部の責務、authority、network、Single Visual Writer、playback settlement は `docs/architecture-contracts.md` を根拠にする。
4. `docs/HUMAN-DEV-GUIDE.md` は人間の判断材料としてのみ参照し、編集しない。
5. テスト、スクリーンショット baseline、現在の実装は証拠にはなるが、それだけを仕様正本にしない。
6. root 実装を正本とし、`dist/`、`worker-public/`、生成 catalog、`public/module-registry.js` を先に編集しない。

複数の正本が矛盾する、期待結果が書かれていない、または自然な挙動が複数ある場合は「仕様判断待ち」とし、推測で修正しない。実装に合わせて正本を書き換え、候補をバグとして正当化してはならない。

## 1. 調査環境を固定する

- 編集前に `git status --short` を実行し、既存変更を関連・無関係・生成物・不明に分類する。
- 修正モードへ進めるのは、開始時のGit可視なdirty state（staged、unstaged、non-ignored untracked）がすべて今回の依頼に関連し、その全体を最終レビュー対象に含められる場合だけとする。一つでも無関係、所有者不明、別taskの変更があれば、hunkを分離できそうでも同じcheckoutでは製品コードを編集しない。読取専用の探索は続け、修正blockerとして報告する。
- baseline commit、既に存在する今回task関連commitの固定range、現在のdirty state、URL、entry lane（classic / Vite）、board backend（Pixi / DOM compatibility）、network mode、viewport、入力方式、シナリオ条件を記録する。patch本文やfile本文を委託prompt・logへ転載せず、credentialやsecretの値を表示しない。
- ブラウザ検証では root `AGENTS.md` の LOCAL DEV SERVER 契約に従う。既存の `npm run serve` を再利用し、正規URL `http://127.0.0.1:8000/` を使い、別の play server を増やさない。
- デプロイ、外部サービス変更、秘密情報の操作、破壊的な git 操作は、ユーザーの明示依頼なしに行わない。

## 2. 実機探索を行う

このスキルでバグ探索を行うときは実ブラウザ操作を必須とし、headless testやprobeだけで探索完了扱いにしない。ブラウザを利用できなければ、その範囲を未検証のまま合格させずblockerとして報告する。[references/exploration-charters.md](references/exploration-charters.md) を読み、依頼内容、最近の差分、症状、変更リスクに合うチャーターだけを選ぶ。全組合せを機械的に回すより、状態遷移と境界を重点的に調べる。

- 起動確認だけで終えず、プレイヤーが行う入力から結果の視覚的 settlement まで操作する。
- 最初の発見と最終再現は、可能な限り通常UIと通常設定で行う。`?debug=1`、テストフック、状態注入は、到達困難な準備や切り分けに限定する。
- 視覚的な候補にはスクリーンショットを残す。Pixi/WebGLではDOM要素の存在だけを描画成功の証拠にしない。
- console error、page error、公開 diagnostics、canonical state、visual state、playback/busy/input lockを問題に応じて記録する。秘密情報や非公開の手札をログへ広げない。
- 一度に一つの条件を変え、正常系との対照、繰り返し、境界値、中断・回復、同等経路の差を調べる。
- 探索中に候補を見つけても、その場で修正しない。まず再現条件と証拠を固定する。

## 3. 再現と原因を調査する

各候補について次を行う。

1. 独立に2回以上再現するか、同じ失敗を決定的に示す focused test / probe に変換する。
2. 期待結果を正本の具体的な節または明示されたarchitecture invariantへ結び付ける。
3. 実際の結果をスクリーンショット、例外、ログ、状態差分、診断値のいずれかで示す。
4. stale build、cache、誤ったURL、play server、テスト専用状態、操作手順の誤りを除外する。
5. 必要に応じて、`input -> UI command -> canonical game state -> events[] -> playback -> visual settlement` の順に所有層を追う。networkでは `publish/SSE -> authoritative snapshot -> presentation journal -> visual settlement` も追う。
6. classic/Vite、local/network、browser/headless、Pixi/DOM compatibility の比較は、その間のparityが契約され、問題に関係する場合だけ行う。DOM compatibilityを通常Pixiの代替実装として扱わない。
7. 同じ根本原因による複数症状は一件へ統合する。

## 4. 候補を分類する

候補は必ず次のいずれかに分類する。

- **確定バグ**: 下記の確定ゲートをすべて満たす。
- **未確定**: 症状はあるが、再現、期待結果、証拠、または原因のいずれかが不足する。
- **仕様判断待ち**: 仕様が欠落・矛盾するか、UX・演出・バランスの選択が必要になる。
- **環境／検証起因**: stale build、server、browser automation、fixture、debug setupなどが原因で、製品の通常経路ではない。
- **改善提案**: 正常動作はしており、分かりやすさ、好み、テンポ、見た目などを改善できる可能性がある。

Severity（プレイヤーへの影響）と Confidence（バグである確実性）は別に記録する。重大そうに見えるだけでは確定バグへ昇格させない。

### 確定ゲート

次をすべて満たす場合だけ「確定バグ」とする。

1. サポートされた通常経路と有効な事前条件で発生する。debug専用状態や不正入力だけではない。
2. 2回以上再現するか、決定的な失敗テスト／probeがある。
3. 期待結果が明示仕様・architecture invariant・契約されたruntime parityのいずれかで一意に定まる。または通常操作が unhandled exception、永続的進行不能、入力の永久lock、canonical state破損、権限・秘密情報漏洩を起こす。
4. 実際の違反を示す客観的証拠がある。
5. 環境、古い生成物、検証ハーネス、意図された変更による差を除外した。
6. 原因の所有層が絞られ、最小修正に新しい製品仕様、バランス、UI方針、公開API、保存形式、network contractの選択を必要としない。
7. 修正後に同じ実機経路と適切なfocused checkで否定できる。

失敗テストやpixel diffだけでは確定しない。期待値やbaselineが現在も正しい根拠を確認する。

## 5. 確定バグだけを修正する

- 確定判定とは別に、ユーザーの依頼が製品コードの修正まで明示的に許可していることを確認する。調査・検証・レビュー依頼では修正しない。
- 一件ずつ、rootのsource of truthへ最小かつ一貫した修正を行う。原因修正に必要でないリファクタ、見た目改善、仕様変更を混ぜない。
- 編集対象の近くにある `AGENTS.md` / `AGENTS.override.md`、既存helper、authority boundary、teardown/recovery契約を先に確認する。
- ゲーム層をheadlessに保ち、UIをauthorityにせず、`events[]`の順序とSingle Visual Writerを守る。
- 既存のfocused coverageが証明できるなら重複テストを増やさない。Level 2/3の回帰で不足している場合は、修正前に失敗を示すか、修正と同時にregression coverageを追加する。
- テストを通すためにskip、削除、期待値の弱体化をしない。期待値変更が必要になった時点で仕様判断待ちへ戻す。
- player-visibleなroot変更ではfocused check後に `npm run build:vite` を行う。これは `build:browser` を含み、通常のVite配信とrootの起動文書を更新する。network contractではparity checkと必要なmirror生成をroot規約に従って選ぶ。
- 同じ実機手順を再実行し、隣接する正常系を少なくとも一つ確認する。ブラウザではURL、lane、backend、network mode、操作、console/page error、スクリーンショットまたはpublic diagnosticsを記録する。
- 修正途中でゲートを満たさないと判明した場合は、追加の製品変更を止め、作業ツリーの所有権を守ったうえで未確定または仕様判断待ちとして報告する。
- focused verificationが通っても、次の独立サブエージェント全体レビューが終わる前にcommitや完了報告をしない。

## 6. 必須の独立サブエージェント全体レビュー

修正差分を一つでも作った場合は、focused verification後に主担当の編集を止め、報告・commit前に [references/final-subagent-review.md](references/final-subagent-review.md) を最初から最後まで読み、専任のサブエージェントへ読取専用の独立レビューを委託する。主担当だけの自己レビュー、focused testの再実行、一般的な「問題なさそう」という確認で代用してはならない。

- サブエージェントには、元の依頼、正本、元バグの再現証拠、baseline commit、既に存在する今回task関連commitの固定range（ある場合）、現在のGit可視なdirty file一覧、実行済みcheckを渡す。raw patchやfile本文はbriefへ貼らず、レビュアーが共有checkoutから直接読む。主担当の安全判定や望む結論を教えて追認させない。
- `scripts/workspace_fingerprint.py` schema version 1を、referenceに記載した同一commandでレビュー開始・終了・結果採用直前に実行する。helperはHEAD、porcelain status、staged/unstaged binary diff、全non-ignored untracked contentをbinary-safeなlength-prefix形式で集約hashし、raw contentを出力しない。今回task関連のuntracked fileはbriefへ全文転記せずpath、kind、byte length、content hashだけを渡し、レビュアーが共有checkout上で直接全文を読む。secretを検出または疑う場合は値を出力せずblockerとする。
- baseline commit、今回task関連commitの固定range、exact helper command、exact helper JSON、現在のdirty state全体を唯一の固定review scopeとする。別方式のreview bundle fingerprintを作らない。各check pointのexact helper JSONが異なる場合、所有者にかかわらずそのreview passは無効として全体を再委託する。helperは各check point内で連続2 snapshotの一致を確認するが、同一内容へ戻る一時的なABA変更までは証明しない。並行編集の兆候がある、またはcheckoutを静止できない場合もpassを無効にする。
- サブエージェントは編集せず、固定rangeの全commitとdirty stateの全hunk、その変更から到達するcaller、consumer、runtime、生成・mirror経路、変更しなかった隣接経路を確認する。
- レビューは元の再現だけでなく、隣接正常系、無効入力または境界値、中断・失敗・reset/reconnectなどの回復経路、触れたarchitecture invariantを対象にする。
- サブエージェントのfindingも同じ分類と確定ゲートへ通す。仕様が曖昧な候補や主観的改善は修正しない。
- 今回の修正に起因する確定した回帰・別バグ・副作用、または元バグと同じ根本原因で明示された元契約を完全に回復するために必要な確定欠陥は主担当が修正する。それ以外の既存バグは元の修正範囲内とみなさない。修正後は関連checkだけで終えず、サブエージェントへ更新後の固定commit rangeとdirty state全体のレビューを再委託する。可能なら新しいサブエージェントを使い、同じレビュアーを使う場合も前回結論に依存せず手順1から読み直させる。
- 全findingをID付き台帳へ残し、`修正済み`、`根拠付きで未確定`、`仕様判断待ち`、`無関係な既存問題`、`blocker`のいずれかにする。主担当が修正しなかったactionable findingとその反証も次のサブエージェントへ渡し、独立に再評価させる。未解決findingを黙って閉じない。
- 元の依頼と無関係な既存バグは勝手にscopeへ取り込まず、証拠付きで別件として報告する。
- サブエージェント機能が利用できない、レビューが必要資料へ到達できない、またはレビュアーが完了できない場合は、主担当だけで合格扱いにせずblockerとして報告する。

次をすべて満たすまで完了扱いにしない。

1. サブエージェントが固定rangeの全commitとdirty stateの全hunk、その影響範囲を独立にレビューし、確認範囲と証拠を返した。
2. version 1 helperによる開始・終了・結果採用直前のexact JSONが一致し、固定review scopeが各check pointで不変である。不一致が出たpassや、並行編集の兆候があるpassは採用していない。
3. 固定rangeとdirty stateに不要・偶発・一時ファイルがなく、各hunkの意図を説明できる。
4. 元の不具合、少なくとも一つの隣接正常系、リスクに応じた失敗・回復経路が確認済みである。
5. 安全判定に必要なfocused test、typecheck/build、browser/network checkが成功している。必要checkが実行不能で同等の証拠もない場合はblockerとし、非必須checkだけを未検証範囲・残留リスクとして扱う。
6. 最新のサブエージェントレビューで、今回の差分に起因する未修正の確定バグ、回帰、副作用が残っていない。修正を挟んだ場合は、その後の全体再レビューまで完了している。
7. finding台帳に未解決のactionable findingがなく、主担当が修正しなかったfindingと反証を最新レビュアーが再評価している。
8. 未確定、仕様判断待ち、未検証範囲、残留リスクを隠さず分離している。
9. `git diff --check`、固定range、dirty state全体、`git status --short`を最終確認し、リポジトリのcommit policyに従ってcommitした。

同じblocking conditionが繰り返され、製品判断や新しい権限なしに解消できない場合は、成功扱いにせず具体的なblockerとして報告する。

## 7. 報告する

結論を先にし、次を明確に分ける。

1. 検証環境と実際に操作した範囲
2. 確定して修正したバグ
3. 確定したが修正しなかったバグと理由
4. 未確定・仕様判断待ち・環境起因・改善提案として変更しなかった候補
5. 委託したサブエージェントレビューの固定review scope、finding台帳、見つけて追加修正した回帰・副作用、再委託した回数。最新レビューで追加の確定問題がなければその旨
6. 実行したcheckと結果、実行しなかった重要なcheck
7. 変更ファイル、commit、残留リスク、未検証領域

各findingには、短い題名、分類、Severity、Confidence、事前条件、再現手順、再現回数、期待結果と根拠、実際の結果と証拠、原因または所有層、処置を含める。

問題が見つからなかった場合は「検証した範囲では確定バグなし」と表現する。ゲーム全体にバグがないとは断言しない。
