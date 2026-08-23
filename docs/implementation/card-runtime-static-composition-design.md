# Card / turn runtime static composition convergence design

- Status: reviewed design; implementation not started; blocked by the implementation start gate in Section 4
- Date: 2026-08-24
- Document role: カード／ターン authority 内に残る runtime discovery と成功形 fallback を外側の明示 composition へ収束させる、supported-runtime gameplay 挙動不変・invalid-composition fail-closed リファクタリングの設計正本
- Target: `game/logic/cards.ts`、`game/cards/effect-resolver.ts`、`game/turn/turn_pipeline_phases.ts` と、そこから到達可能な card-runtime dependency graph、それらを構成する browser / headless / local server / Worker runtime 境界
- Sources of truth: root / nested `AGENTS.md`、`01-rulebook.md`、`docs/architecture-contracts.md` §§3, 5.1, 5.2, 8.1–8.8, 10, 13、現行 root TypeScript 実装、本文の characterization / parity evidence
- Player-visible specification: unchanged
- Public `CardLogic` API surface/signatures: unchanged, including the current 289-key export inventory; invalid-composition success fallback is intentionally removed
- Network wire / saved-data / model-artifact formats: unchanged
- Non-goal summary: card rules, RNG routing, pending state-machine redesign, CPU policy, network protocol, Pixi/UI ownership, classic-lane retirement

## 1. Executive decision

Repository-wide audit の最上位リファクタリング候補として、**card / turn authority の runtime composition convergence** を選定する。

現行コードはカード規則を既に多数の TypeScript module へ分割し、turn pipeline も phase 単位へ分離している。しかし、抽出済み module を authority core が `require`、`globalThis`、`self`、optional module resolver から遅延探索し、一部では必須 context の取得失敗を空の規則 context として継続する。これは「module を分ける」段階の次に残った composition debt である。

本設計の完了形は次のとおり。

1. state 非依存の card / turn service を、runtime activation 時に一度だけ型付きで構成する。
2. 一手・一 command に属する state、action、events、既存 RNG reference は invocation context に閉じ、singleton service に保存しない。
3. canonical required capability は最初の authority mutation より前に全量検証する。
4. `game/` core は、実行中に `require`、global lookup、lazy import、別 rule body fallback を行わない。
5. classic compatibility は boot adapter に限定し、一局中に新旧 authority lane を混ぜない。
6. complete supported runtime の card result、state、snapshot、event order、PRNG consumption、pending contract、public API、外部結果を変えない。required dependency が欠落した invalid composition だけは、現在の success-shaped boolean / alternate-action fallback を許さず、activation failure または tagged `runtime_unavailable` として fail-closed にする。

これは確認済み gameplay bug の修正ではない。過去に Worker preload ordering defect が executable bundle smoke で検出された事実と、現在の明示 architecture contract との距離から、将来の card change を一 runtime だけ異なる rule implementation へ到達させないための予防的な authority convergence である。

## 2. Audit method and candidate review

### 2.1 Eight independent audit passes

実行環境は同時に保持できる subagent identity が3体までだったため、3 identity を再割当して、相互に独立した8件の audit brief を実行した。各 pass は既存計画の再提案を避け、現行 source、contract、tests、Git history を根拠に候補を提出した。

| Pass | Independent lens | Main evidence surfaced |
| --- | --- | --- |
| 1 | architecture / authority boundaries | CardLogic composition、network resource ownership、CPU ports、Worker/local assembly |
| 2 | static code health / maintainability | `cards.ts`、`network-client.ts`、Pixi scene、bootstrap の responsibility concentration |
| 3 | card / turn / gameplay core | pending flow、turn fail-open context、RNG channel、CPU decision boundary |
| 4 | browser UI / Pixi / bootstrap | board-scene lifecycle、typed bootstrap composition、classic compatibility boundary |
| 5 | network authority / parity | viewer delivery、SSE lifecycle、room assembly、session scope、token transport |
| 6 | verification / generation / docs | clean-clone check bootstrap、artifact transaction、Worker delivery proof、CI topology |
| 7 | selfplay / training / model artifacts | TS/Python feature contract、nested parallelism、resume receipt、artifact descriptor |
| 8 | security / concurrency / performance / failure semantics | token URL exposure、session races、SSE resources、card fail-open、CPU decision session |

調査後、main agent が source を再確認し、候補を architecture fit、confirmed evidence、cross-runtime leverage、public decision risk、既存計画との重複で比較した。その main decision をさらに architecture、gameplay authority、implementation feasibility の3 reviewer が独立に反証した。reviewer は方向性を支持したが、RNG / pending / CPU の同時再設計を除外し、hermetic verification を開始前提にし、static services と per-invocation state を分離し、top-level facade だけでなく reachable dependency graph 全体を完了範囲にすることを承認条件とした。本設計はその修正要求を反映している。

### 2.2 Candidate decision matrix

| Candidate | Evidence and leverage | Decision |
| --- | --- | --- |
| Card / turn static composition | 複数 audit が独立に最上位。architecture contract に直接対応し、classic / Vite / headless / local / Worker / selfplay に波及。公開仕様を変えず段階移行可能 | **Selected** |
| Hermetic check/build and atomic artifact verification | clean clone bootstrap の構造的欠落と過去の並行 generation race の証拠あり | **P0 prerequisite / separate owner**。本 refactor と同じ commit に混ぜない |
| Browser `NetworkSessionScope` | 過去の session epoch / stale callback repair と現行 resource 分散から高価値 | Separate large refactor。card authority と同時変更しない |
| Worker/local SSE lifecycle core | duplicated delivery semantics と resource lifecycle が明確 | Separate cross-runtime network plan。Node / Worker I/O 自体は共通化しない |
| TS/Python observation and feature contract | semantic drift を成功形で通す可能性があり training 品質上重要 | Separate training contract plan。長時間 training は本 task で実行しない |
| CPU decision session | RNG、Worker advisory、presentation scheduling の分離に価値 | Typed card runtime の下流候補。難易度・評価式変更と混ぜない |
| Pixi board-scene decomposition | file concentration は大きいが Single Visual Writer と lifecycle contract は既に成立 | New profile / reproduced lifecycle defect が出るまで defer |
| Broad giant-file split / all-global cleanup | 行数だけでは authority 改善や安全な削除を証明しない | Rejected |

選定対象を一つに絞る理由は、network、training、rendering の refactor を同時に行うと、失敗時に authority 差、delivery 差、学習差、presentation 差を切り分けられなくなるためである。本設計は後続候補を否定せず、最も横断的な game-authority debt を一つの green-to-green program として閉じる。

## 3. Current-state evidence

### 3.1 Source concentration is context, not the acceptance metric

2026-08-23 時点の root source line count は次のとおり。

| File | Lines |
| --- | ---: |
| `game/logic/cards.ts` | 5,430 |
| `ui/network-client.ts` | 4,808 |
| `ui/pixi/board-scene.ts` | 3,828 |
| `workers/match-worker.ts` | 3,743 |
| `game/cpu-decision.ts` | 3,572 |
| `cards/card-interaction.ts` | 3,317 |
| `scripts/local-match-server.ts` | 2,809 |
| `game/logic/board_ops.ts` | 2,767 |
| `ui/bootstrap.ts` | 2,557 |
| `game/turn/turn_pipeline_phases.ts` | 1,812 |

`cards.ts` が最大であることは investigation entry point だが、完了条件を行数削減にはしない。既存 facade、card registry、compatibility export を保持したままでも、authority core の dependency selection を一つにできれば本設計の目的は達成できる。

### 3.2 Runtime discovery remains inside authority paths

- `game/logic/cards.ts:9-48` は `__non_webpack_require__`、`globalThis`、safe require と module/global resolver を定義する。
- 同 `:48-81` と `:588-638` は shared constants、state helpers、card modules、resolution modules を runtime-dependent に取得する。
- 同 `:2427-2537` の `applyCardUsage()` は effect resolver へ多数の helper、module、constant、state-bound function を無型 dependency bag として渡す。
- `game/logic/cards-internal/module-resolver.ts:13-79` は local value、runtime require、global value を順に探索し、中間 failure を compatibility resolution として吸収する。
- `game/cards/effect-resolver.ts:6-61` も独自に require/global/fallback resolution を持つ。
- `game/turn/turn_pipeline_phases.ts:1-109` は static loader、runtime require、global fallback の順に phase dependency を探索する。
- 同 `:1432-1444` は card context construction failure を空の protected/permanent/bomb context へ畳める。確認済み誤結果ではないが、dependency failure を valid rule result へ変換できる。

`docs/architecture-contracts.md` は core / authority resolution 内の late runtime lookup と silent success-shaped fallback を禁止し、runtime-specific resolution を outer boundary へ置く。したがって現状は、過去の deliberate compatibility retention を含む既知 debt である。

### 3.3 Cross-runtime delivery makes the debt material

- `workers/match-worker-runtime-preload.ts` は現在 152 件の `installRuntimeModule(...)` registration を持つ。
- production TypeScript だけでも 57 files が `CardLogic.` public surface を参照する。
- `test/game.cards-api-export-inventory.test.ts` は 289 public keys と inventory hash を固定する。これは削減対象ではなく compatibility gate である。
- 2026-08-09 の `87978034e` は executable Worker bundle smoke が検出した card preload dependency ordering defect を修復した。static checker と通常 test green だけでは runtime evaluation order defect を捕捉できなかった具体例である。
- `docs/architecture-contracts.md` §10 は、runtime-only card effect lookup 差が Worker 固有不一致を起こした履歴を理由に fail-closed parity を要求する。

### 3.4 Existing refactors are complete and remain the foundation

本設計は 2026-07 master plan Phase 5 の card facade、CPU extraction、turn stage split を未完としてやり直さない。2026-08 post-convergence work も、当時証明できなかった classic load order や partial runtime fallback を意図的に保持したものとして尊重する。

新しい根拠は次に限定する。

1. 抽出済み module を static service graph として構成する outer owner がまだない。
2. core 内 runtime discovery が stable architecture contract の debt として残る。
3. required capability 不足を最初の mutation より前に検出する complete preflight がない。
4. executable Worker bundle で evaluation-order defect が実際に再発した。

過去計画の checkbox、巨大 file、compiler diagnostic だけを理由に source を動かしてはならない。

## 4. Two implementation gates

### 4.1 Gate A — before task source or test edits

次を満たした後にだけ、characterization-only の Phase A を開始できる。

1. 対象 file と生成面に別 task の未コミット変更がなく、`git status --short` の全 entry を分類できる。
2. 同時進行の card / turn rule、card catalog、visible timing、pending contract 変更がない。
3. clean clone から `npm ci` 後に check/build を起動できる hermetic gate が pass する。
4. `npm run worker:bundle:smoke` が ambient `require` なしの executable Worker bundle で pass する。
5. 現行 289-key export inventory と既存 focused baseline が green である。

Gate A 後も game/runtime product source は変更しない。Phase A は test、fixture、read-only inventory、characterization delivery-check tooling だけを追加する。

### 4.2 Gate B — before product source edits

Phase A 完了後、次をすべて満たして design / plan を再 review した後にだけ contract、factory、composer、consumer source を編集できる。

1. classic、Vite、headless、local server、Worker、small selfplay の baseline runtime lane が記録される。
2. API key + kind、重要 constants、semantic probes が現行 `HEAD` で green になる。
3. fixed-seed state/event/PRNG、turn-start/pending/protection、failure mapping fixture が green になる。
4. graph manifest が root、edge kind、boundary、全 node disposition を持ち、canonical-required node に未分類がない。
5. `MutationEntryManifest` が 289-key facade の全 function を mutator / query / presentation に分類した上で、`writesCanonicalState`、`writesRuntimeState`、`appendsOrDrainsEvents`、`consumesRng`、`pure`、`dependencySensitive` の flags を持つ。全 non-pure function に required cohort、`firstObservableEffect`、preflight owner、failure normalization owner、runtime consumer、test owner がある。dependency-sensitive query には capability cohort、activation-preflight owner、tagged-failure propagation owner、success-shaped fallback 禁止、runtime consumer、test owner がある。`pure` は observable-effect flags がすべて false の時だけ許可されるが、dependency-sensitive ではあり得る。
6. activation failure、Worker preload failure、direct command rejection、preview unavailable、CPU runtime unavailable の exact current mapping と、success-shaped fallback を除去した target mapping が対で記録される。complete supported runtime の wire/schema/result は不変とする。
7. supported runtime が partial module graph を valid production path として使うか否かが確定する。

Gate B が満たせない場合、product source を部分実装せず、design assumption を更新して再 review する。

### 4.3 Hermetic verification is a separate prerequisite commit

現行 wiring は `npm run checkall` が `scripts/run-all-checks.js` を起動し、その shim が git 非追跡・`.gitignore` 対象の `dist/scripts/run-all-checks` を要求する。一方 CI workflow は fresh checkout の `npm ci` 直後に `npm run checkall` を呼ぶ。repository 外の prebuild がない限り clean clone bootstrap が自己完結しないと source から推論できる。現在の checkout で `npm run checkall` が pass した事実は、既存 `dist/` を持つ環境の evidence であり、この反証にはならない。

実装開始前に別の coherent prerequisite commit で、少なくとも次を成立させる。

- `tsc -p tsconfig.build.json` 等の canonical build で、runner と runner が直接起動する全 `dist/scripts/*` checker を最初に同一 snapshot へ build し、その後に checker 本体を一度だけ起動する。
- fresh clone CI で missing `dist` から開始して pass する。
- check failure と test fallback を success-shaped retry に畳まない。
- check 終了時に task-unrelated tracked diff を生成していないことを確認する。
- missing runner だけでなく、各直接参照 checker の欠落も negative fixture で failure として固定する。

artifact staging / atomic promotion、Jest project 分割、docs status lifecycle は有力な別 refactor だが、この prerequisite commit へ抱き合わせない。生成 transaction が別途完了するまでは、本 refactor 中に同じ checkout で複数の generator を並行実行しない。

start gate が満たせない場合、本設計を部分実装せず、hermetic verification owner を先に完了して再評価する。

## 5. Scope and non-goals

### 5.1 In scope

- 現在の runtime module/global resolution path と fallback reachability の inventory。
- canonical graph root、edge kind、outer boundary、全 node disposition を固定する machine-readable manifest。
- immutable、state-independent な `CardRuntimeServices` と `TurnRuntimeServices` contract。
- current call-site values だけを一 invocation に束ねる `CardInvocationContext`。これは RNG source や action metadata の取得経路を変えない。
- required / runtime-adapter-required / optional presentation-debug / classic-compatibility の capability classification。
- runtime construction / command preflight と typed internal failure。
- whole `CardLogic` object を探索・cache する consumer を、既存 behavior を表す narrow port へ切り替えること。`pending-coordinator` の state machine 自体は変更しない。
- headless / local、Worker preload、Vite、classic の outer composer。
- `applyCardUsage()` の current stage order を保持した card resolution cutover。
- turn phase manifest の static cutover。turn sequence 自体は再設計しない。
- core 内の migrated `require` / global lookup / duplicate fallback body の削除。
- 289-key facade の全 non-pure function に対する fail-before-first-observable-effect preflight。canonical/runtime state write、event append/drain、PRNG draw を対象にし、`applyCardUsage()` / `applyTurn()` だけを代表入口として完了扱いにしない。
- dependency-sensitive query が required capability failure を `true`、empty result、別 query、別 CPU actionへ畳まない tagged-failure propagation。
- tagged `runtime_unavailable` を既存 UI preview / CPU legality boundary まで損失なく伝えるために必要な最小 adapter 変更。complete-runtime policy、canonical legality、wire schema、通常 UI flow を変えずに表現できない場合は stop condition とする。
- reintroduction を防ぐ structural guard と executable Worker delivery proof。
- 完了後の `docs/architecture-contracts.md` debt / owner update と generated browser / Worker delivery refresh。

### 5.2 Explicit non-goals

- `01-rulebook.md`、card catalog、card cost、target、effect、timing、text、sound、animation の変更。
- 289-key `cardsApi` の縮小、rename、signature break。
- `_defaultRandomSource`、`_boardOpsRandomSource`、`_currentActionMeta.randomSource` の除去や RNG routing redesign。
- PRNG algorithm、seed、candidate ordering、random draw count の変更。
- pending selection state machine、pending payload、`pendingEffectId`、refund semantics の再設計。
- CPU policy、Lv別強さ、Worker advisory protocol、minimum think timing の変更。
- network command、snapshot、projection、SSE、token、session lifecycle の変更。
- Worker/local command runtime や room-deck owner の再実装。
- board topology/kernel、Pixi/DOM backend、Single Visual Writer、UI bootstrap 全体の再設計。
- classic browser lane の廃止。classic は outer compatibility adapter として維持する。
- long selfplay / training job、model update、model artifact format 変更。

## 6. Target architecture

### 6.1 Ownership and control flow

```text
runtime boundary
  headless/local | Worker preload | Vite bootstrap | classic boot adapter
          |
          v
compose + validate immutable services
  CardRuntimeServices + TurnRuntimeServices
          |
          v
public CardLogic compatibility facade / static turn phase manifest
          |
          v
per command or turn CardInvocationContext
  current state refs + player/action + events + existing RNG reference
          |
          v
canonical validation -> mutation -> pending/immediate result -> events
```

Outer composer は runtime 固有の module delivery だけを知る。card / turn core は、一度渡された service がどの loader、bundle、global registration から来たかを知らない。

### 6.2 Required import DAG

Final import direction は file layer 単位で次に固定する。

| Layer | Preferred owner | May import | Must not import |
| --- | --- | --- | --- |
| Contracts | `game/logic/card-runtime-contracts.ts` | type-only domain/shared contracts | composer、factory、facade、runtime adapter |
| Canonical leaf implementations | existing `cards/*`、`card-resolution/*`、`cards-internal/*` | contracts、shared/headless helpers、approved leaf edges | facade、composer、browser/Worker/local adapters |
| Service composer | `game/logic/card-runtime-composer.ts` | contracts、validators、canonical leaf modules | factory、legacy facade、runtime adapters |
| Canonical implementation factory | `game/logic/cards-runtime-factory.ts` | contracts and named narrow ports | composer、legacy facade、runtime adapters、whole `CardLogic` |
| Legacy facade projection | `game/logic/cards-legacy-facade.ts` | factory、default composer | runtime-specific adapters、UI/network authority |
| Stable compatibility entry | `game/logic/cards.ts` | legacy facade projection only | leaf rule bodies、runtime discovery |
| Runtime adapters | Worker preload、Vite bootstrap、classic boot adapter、headless/local composition boundary | contracts、factory、runtime-specific composer/registration | imports from core back into adapter are forbidden |

Composer は facade / factory を import せず、factory は composer / facade を import しない。facade または outer adapter だけが complete services と factory を結合する。これにより `cards.ts -> composer -> cards.ts` cycle を作らない。

Transition では current implementation body を cycle-free factory へ mechanical extraction し、未移行 capability の current resolver は明示された temporary migration owner として残せる。ただし `CohortOwnershipManifest` が capability ごとに old または injected の一方だけを construction 時に選び、実行 failure 後に別 owner を retry しない。全 cohort cutover 後に temporary owner と manifest を削除する。

Production entry が new composer に未接続の preparation phase では、Worker、Vite、classic ごとの **non-shipping fixture entry** から built proof を取る。fixture entry は production と同じ compiler / bundler settings、alias、plugin、module order を再利用し、temporary output だけへ build する。production registry、`vite-dist/`、`worker-public/`、公開 entry には登録しない。card cohort の本番切替以降は fixture ではなく actual production entry を delivery proof の owner とし、全 production entry が complete graph を証明した cleanup phase で fixture source と fixture-only build wiring を削除する。

### 6.3 Static services and invocation state are different lifetimes

Conceptual contract は次の形とする。正確な symbol 名は実装時に既存 type naming と照合するが、lifetime と禁止事項は変更しない。

```ts
interface CardRuntimeServices {
  readonly state: CardStateServices;
  readonly deckAndHand: CardDeckHandServices;
  readonly targeting: CardTargetingServices;
  readonly boardAndTopology: CardBoardServices;
  readonly markersAndProtection: CardMarkerServices;
  readonly resolution: CardResolutionServices;
  readonly pending: CardPendingServices;
  readonly presentationMetadata?: CardPresentationMetadataServices;
}

interface TurnRuntimeServices {
  readonly card: CardRuntimeServices;
  readonly phases: TurnPhaseManifest;
  readonly boardOps: TurnBoardServices;
  readonly protectionContext: ProtectionContextServices;
}

interface CardInvocationContext {
  readonly cardState: CardState;
  readonly gameState: GameState;
  readonly player: PlayerKey;
  readonly action?: CanonicalAction;
  readonly events: GameEvent[];
  readonly randomSource?: ExistingRandomSource;
  readonly actionMeta?: ExistingActionMeta;
}
```

Rules:

- service groups are narrow, readonly capability sets; one untyped 90-field god objectへ名前を付け替えない。
- root aggregate を受け取れるのは composer、facade、top-level orchestrator だけとする。leaf module は named narrow port または reviewed `Pick<>` だけを受け、root aggregate、whole `CardLogic`、`any` dependency bag、index signature を受けない。
- runtime construction 後に、imported module object 自体ではなく、コピーして作った capability wrapper shell を shallow-freeze する。shared module export を deep-freeze して他 consumer の挙動を変えない。
- `cardState`、`gameState`、pending instance、events array、room identity、seat token、UI callback を static service に保存しない。
- invocation context は top-level orchestrator だけが扱い、leaf には stage-specific subset を渡す。`randomSource` / `actionMeta` は現行 stage ですでに存在する時だけ投影し、composer / preflight が解決・生成しない。
- explicit argument、`meta.randomSource`、`meta.prng`、`_boardOpsRandomSource`、`_currentActionMeta.randomSource`、`_defaultRandomSource`、default/throw の current precedence と bind/unbind timing を変えない。
- service preflight は function / constant / contract presence だけを検証し、target enumeration、effect preparation、board mutation、random draw を実行しない。
- presentation metadata service は canonical result を決めない。optional にできるのは diagnostics / presentation-only capability に限る。
- 289-key surface は `LegacyCardLogicApi` compatibility facade にだけ残し、internal service contract として再定義しない。
- `pending-coordinator` 等の long-lived consumer は whole facade を cache せず、必要な pending capability だけを runtime construction 時に受け取る。runtime replacement 後に旧 instance を保持しないことを test する。

Public compatibility proof は sorted key hash だけに依存しない。key + value kind schema、重要 constant value、representative semantic probes、global registration names、module/default unwrap を併用する。transpile や default parameter に左右される function source hash / `function.length` は stable contract にしない。

### 6.4 Capability classification and failure policy

| Class | Examples | Missing behavior |
| --- | --- | --- |
| Canonical required | effect resolver、pending manager、BoardOps、target/legality、marker/protection context、required turn phases | runtime construction または command preflight で mutation 前 fail-closed |
| Runtime-adapter required | Worker game-runtime port、browser card bridge、classic public registration | 当該 runtime activation を失敗させ、gameplay を開始しない |
| Optional presentation/debug | diagnostics、debug logger、noncanonical presentation annotation | explicit no-op 可。canonical state/result へ影響しないことを test |
| Classic compatibility export | historical global names、CommonJS/default unwrap、legacy signature facade | boot adapter が全量提供。core は探索しない |

required capability が一件でも不足する incomplete service graph は作らない。partial manager、classifier-only object、empty protection context を valid canonical runtime とみなさない。

### 6.5 Failure must precede authority mutation

単に late lookup を `throw` へ置換すると、temporary RNG field binding、card cost、discard、marker、event append の後に失敗できるため不十分である。必要 capability は `_boardOpsRandomSource` / action metadata 等の一時 field を含む最初の write より前に全量検査する。

- local / headless: typed internal runtime-dependency failure。input state deep equality を保持する。
- Worker authority: room state、stateVersion、accepted operation、journal、save、broadcast を一切変更せず、既存 public rejection shapeへ正規化する。
- Vite browser: game runtime activation 前に失敗し、card action を有効化しない。
- classic browser: boot 時に complete compatibility adapter を構成できなければ gameplay を開始しないか、明示された whole-lane compatibility bootへ戻る。一 action の途中で effect 単位 fallback はしない。

新しい raw exception や internal module name を network payload へ露出しない。public wire schema を増やさず、existing public failure category へ mapping する。正確な mapping は Phase 1 characterization で runtime ごとに固定する。

Canonical apply と non-authoritative preview は failure policy を分ける。authoritative apply は typed rejection と state/version/PRNG/events/pending の不変を保証する。内部では rule-level unavailable と別の tagged `runtime_unavailable` を維持する。UI は外側で preview unavailable と表示できるが canonical legality `false` として保存・送信しない。CPU / legality owner は別 action を選ばず、action selection、PRNG draw、command mutation 前に decision を中止する。generic exception や Worker 500 にせず、Gate B で固定した existing outer failure category へだけ正規化する。

### 6.6 Card resolution keeps the existing transaction order

`applyCardUsage()` は既存の外部 signature と stage order を維持する。

1. card / player / target / charge / pending precondition validation;
2. current consumption / hand / discard / usage bookkeeping;
3. pending effect creation or continuation;
4. immediate canonical resolution;
5. existing presentation metadata and ordered `events[]` result;
6. current cleanup / refund / failure semantics.

本 refactor はこの sequence を再設計しない。dependency bag を narrow service groups と current invocation context へ置換し、各 stage の output を exact characterization と比較する。

`game/cards/effect-resolver.ts` の cancellation compatibility path は次の3状態を別 fixture にする。

1. complete manager;
2. manager absent;
3. classifier present / canonical cancel capability absent.

Complete canonical manager と「override は無いが canonical manager は存在する」supported path は current refund/pending/result の exact parity を保つ。真の incomplete / partial graph は card result parity 対象ではなく activation/preflight failure・zero mutation とする。ただし supported runtime または public compatibility contract が3番の partial success pathへ到達すると Gate B で判明した場合は stop condition とし、本 refactor では削除しない。current result preservation と activation failure を同じ path に同時要求しない。

### 6.7 Turn pipeline is composed, not redesigned

既存 turn stage split と public phase signature を土台にする。変更対象は次だけである。

- `turn_pipeline_phases.ts:35-109` の runtime-dependent phase discovery;
- parent orchestrator に残る duplicate / success-shaped fallback rule body;
- required phase manifest の preflight;
- outer composer からの explicit injection。

次は exact invariant である。

- turn-start snapshot と marker processing order;
- pre-placement、placement、immediate effect、charge、handoff order;
- pending 中の auto-pass 禁止;
- end-turn / continue-turn / pass / game-end classification;
- timeout / AUTO も shared match-command entry を通ること;
- `events[]` の value、count、order;
- protection / permanent protection / bomb context semantics。

空 protection context fallback は、全 supported runtime が complete canonical context service を持つと証明した後にだけ削除する。

### 6.8 Runtime-specific composition

#### Headless and local server

- canonical TypeScript module を static import する default composer を使う。
- local server は shared match-command runtime を迂回せず、既存 command entry へ complete game runtime を渡す。
- parallel headless games / selfplay games は static services を共有できるが、invocation context は共有しない。

#### Worker

- `workers/match-worker-runtime-preload.ts` が非同期 delivery / evaluation を完了し、validated frozen `MatchGameRuntime` を同期 command entry へ渡す。
- `executeMatchCommand()` 開始後に require、global lookup、Promise、lazy import を行わない。
- preload failure 時は room mutation、version increment、accepted operation、journal、save、broadcast を行わない。
- Worker module-scope cache を canonical room state、snapshot、saved recordへ入れない。
- migrated module の preload global registration は、全 bundle parity 証明後に削減する。件数削減自体を goal にしない。

#### Vite

- ESM bootstrap が canonical composer を static module graph から構成する。
- existing optional Pixi boundary や UI DI ownership は変更しない。
- CardLogic public facade は current consumer に、各 lane 内で現在と同じ singleton identity semantics、keys、call signature を提供する。

#### Classic

- classic script registry / load order から compatibility adapter が service graph を一度構成する。
- historical global name と module/default unwrap は adapter に限定する。
- boot 完了後に core が global を再探索しない。
- temporary rollback が必要な場合も boot で lane を一度選び、一局中に切り替えない。
- final completion では duplicate rule implementation を残さず、classic adapter も同じ canonical services を構成する。

### 6.9 No production shadow execution

old/new resolver を同じ production action 上で shadow 実行しない。state mutation と PRNG consumption を二重化するためである。比較は同一 seed / canonical input から old 用と new 用の state/runtime を別々に構築し、独立した instrumented PRNG を current precedence の全 alias に同じ初期状態で束縛する。call ledger、selected source、ending state、non-shared identity と canonical output の exact equality を検証する。generic deep clone や同じ mutable PRNG object の共有を parity proof にしない。

Old/new state parity は raw object identity を直接比較しない。`_defaultRandomSource` 等の runtime-only function/object reference を Gate B inventory に基づく deterministic descriptorへ正規化し、残る canonical state を deep equality で比較する。runtime reference は別に presence、alias-group topology、selected source、non-shared old/new identity、serializable PRNG state、call ledger を厳密比較する。snapshot/save JSON は通常どおり exact equality とする。一つの execution が dependency failure で無変更かを調べる failure-atomicity test だけは、同じ instance の pre/post raw equality を使用する。

## 7. Migration strategy

### 7.1 Migration-state invariants

| Phase | Production owner | New composition state | Preflight state | Valid completion claim |
| --- | --- | --- | --- | --- |
| Gate A / Phase A | current legacy path in every lane | inventory / fixtures only | current behavior | characterization only |
| Gate B / contract shell | current legacy path | contracts and validators exist | validator side-effect-free | no production cutover |
| Factory extraction | current legacy behavior through cycle-free factory/facade | default composer testable | current behavior | import DAG established, behavior unchanged |
| Runtime preparation | current legacy path in every lane | headless/local、Worker、Vite、classic composers construct complete graphs in harness | composition validation only | all lanes ready; command path is not yet lookup-free |
| Card cohort cutover | selected card cohort uses injected services in **all** lanes; unmigrated cohorts use fixed legacy owner | same `CohortOwnershipManifest` in every lane | selected cohort preflight active before any write | selected cohort exact parity only |
| Turn cohort cutover | selected turn cohort uses static manifest in all lanes | all runtime composers ready | selected turn preflight active before RNG temp binding or other write | selected cohort exact parity only |
| Enforcement / cleanup | all canonical-required nodes use static services | temporary legacy owner removed | aggregate preflight active | manifest canonical-required closure lookup-free and failure-atomic |

Runtime preparation と production cutover を分ける。headless だけ先に new authority へ切り替えず、各 cohort は all supported lanes の composer / built-delivery proof が揃った一つの ownership manifest で切り替える。unmigrated cohort の current owner は production path として明示するが、new failure 後に old owner を retry する fallback にはしない。

### 7.2 Phase A — Gate and characterize

- hermetic verification prerequisite を別 commit で完了する。
- export key + kind、重要 constant、global、loader selection、partial fallback、required/optional dependency inventory を machine-readable に固定する。
- fixed-seed card / turn / pending / protection / cancellation fixture を追加する。
- classic / Vite / headless / local / Worker / selfplay の current module selection と output baseline を記録する。
- graph roots、edge kinds、outer boundary、全 node disposition と failure mapping table を固定し、Gate B review を通す。

### 7.3 Phase B — Introduce typed composition shell and cycle-free factory

- state-independent service contracts と validators を追加する。
- current implementation body を `cards-runtime-factory.ts` へ mechanical extraction し、`cards.ts` を stable facade entry に縮める。移動と behavior cutover を同じ diff にしない。
- required import DAG を成立させ、current behavior は temporary migration owner から同じ dependencies を選ぶ。
- static composer から同じ modules を受け取る service graph を作り、consumer cutover 前に service completeness を test する。
- `check:card-runtime-boundary` をこの phase で導入し、現行 canonical lookup を owner / reason / removal cohort 付き legacy allowlist として固定する。以後の各 cohort は allowlist を単調に縮小し、cleanup phase で canonical allowlist を0件にする。
- public `CardLogic` surface と turn phase signatures は変更しない。
- `cards.ts` / facade / factory graph は current owner のままでも production-reachable であるため、`worker:prepare` で browser/Worker delivery を同一 commit に同期し、actual legacy Vite/classic/Worker entries の parity を通す。

### 7.4 Phase C — Prepare every runtime composer outside the core

- headless / local、Worker preload、Vite、classic の順に outer composer を構築・検証するが、production owner は current legacy path のまま維持する。
- injected service と旧 resolver selection の identity を construction harness で比較する。production mutation の shadow execution はしない。
- runtime boot / Worker reconstruction / classic partial-load failure を characterize する。
- built dist child process と built Vite/classic browser harness が API schema と fixed-seed fixture を実行できる状態にする。
- `cards/card-interaction.ts` の preview/query と `game/cpu-decision.ts` の legality/candidate evaluation に、tagged `runtime_unavailable` を success-shaped boolean、別 query、別 actionへ畳まず外側へ伝える dormant adapter を準備する。この phase では production consumer に接続しない。
- preparation module は production entry / generated registry から到達不能な non-shipping module として隔離し、その不在を証明する。Worker preload 等の既存 production-reachable graph を変更する preparation は `worker:prepare` と actual current-owner entry proof を同じ preparation commit に含める。

### 7.5 Phase D — Cut over card resolution by all-lane cohort

- state/deck-hand、target/legality、board/marker/protection、pending port、resolution の bounded cohorts で consumer を cut over する。
- cohort ごとに全 supported lane の composer を同じ ownership manifest へ切り替える。切替前に `MutationEntryManifest` がその cohort に割り当てた全 non-pure function で required preflight を active にし、state/runtime write、event append/drain、PRNG draw の最初の `firstObservableEffect` より前に完了させる。direct `applyCardUsage()` entry だけの proof で代用しない。
- 同じ cohort の dependency-sensitive query と UI/CPU dormant adapter を同じ ownership switch で有効化し、required capability failure を `true`、empty result、別 query、別 CPU actionへ fallback させない。
- exact state/event/PRNG/pending と built delivery comparison を通し、resolver / duplicate fallback を一つずつ削除する。
- production cutover が browser / Worker delivery を変える各 cohort は `worker:prepare` を実行し、説明可能な生成差分を ownership switch と**同じ cohort commit**に含める。生成物なしの中間 production revision や後続 cohort への持ち越しを許可しない。
- `applyCardUsage()` public signature と transaction order を維持する。

### 7.6 Phase E — Cut over turn phases by all-lane cohort

- static phase manifest を explicit injection へ切り替える。
- protection context と required phase capability を、temporary RNG field binding、event operation、PRNG draw を含む最初の observable effect より前の preflight へ入れる。`MutationEntryManifest` 上の turn-start / direct `applyTurn()` / command wrapper non-pure entry をすべて含める。
- turn sequence、timeout/AUTO entry、pending outcome を変えず、parent fallback body を削除する。
- turn production cutover 後に `worker:prepare` と actual built production-entry proof を同一 revision で通し、生成差分を ownership switch と同じ cohort commit に含める。

### 7.7 Phase F — Enforce and remove compatibility debt

- Gate B graph manifest が canonical-required と分類した closure の `require`、`globalThis`、`self`、success-shaped module fallback を structural guard で禁止する。top-level fileだけをscanして完了扱いにせず、全 node に migrated / outer-adapter allowlisted / out-of-scope consumer / generated-wrapper の disposition を持たせる。
- classic / Worker outer adapter に必要な compatibility resolution だけ allowlist し、owner と sunset condition を記録する。
- final adapter が同じ canonical service graph を構成した時点で old core resolver lane を削除する。
- actual headless/local、Worker、Vite、classic production entry が complete graph を証明した後、non-shipping fixture entry、fixture-only CLI mode/package wiring、temporary-output expectation を削除する。
- この phase は preflight を初めて有効化する phase ではない。各 cohort preflight を集約確認し、temporary owner / allowlist / fallback を削除する phase である。

### 7.8 Phase G — Delivery and stable contract update

- `docs/architecture-contracts.md` を actual implemented owner に合わせて更新する。
- browser / Vite / Worker generated delivery を canonical scripts から再生成する。
- focused、network parity、Worker executable bundle、full Jest、browser lane、small selfplay の final bundle を実行する。
- independent final review で差分と evidence を再確認する。

各 phase は coherent green commit とし、既存 resolver を削除する commit は replacement、characterization、runtime parity が同じ commit または直前の verified commit に存在することを条件とする。

生成同期の基準は ownership switch の有無ではなく **production reachability** とする。`cards.ts` の mechanical extraction、Worker preload preparation、dormant adapter の誤った production import を含め、browser / Worker production graph を変える全 commit は `worker:prepare` を実行し、説明可能な registry/cachebuster/mirror diff と actual current-owner production-entry proof を同じ commit に含める。同期を避けられるのは、fixture / dormant module が production graph と shipping output の双方から到達不能であることを machine check した場合だけである。

## 8. Compatibility and invariant matrix

| Invariant | Required proof |
| --- | --- |
| `CardLogic` public surface | 289 keys、key + kind schema、inventory hash、重要 constant、semantic probes、global names、CommonJS/default unwrap、legacy signatures exact equality |
| Public effect / dependency entries | 289-key全function分類、effect/dependency flags、全non-pure functionのcohort / first-observable-effect / preflight / failure-owner / runtime-consumer / test-owner、およびdependency-sensitive queryのactivation-preflight / tagged-failure propagation / fallback prohibition completeness |
| Canonical state | runtime-only reference を deterministic descriptor 化した old/new `gameState` / `cardState` canonical comparator equality |
| Serialization | snapshot / save JSON、authoritative / projected hash equality |
| Card accounting | charge、hand、discard、usage count、refund exact equality |
| Pending | full payload、target order、`pendingEffectId`、continue/end outcome exact equality |
| Events | `events[]` と presentation metadata の value / count / order exact equality |
| Randomness | PRNG call count、draw order、ending `prngState` exact equality |
| Board semantics | protection、permanent protection、bomb、marker、blocked cell、expanded topology equality |
| Turn flow | turn-start anchor、placement/immediate/charge/handoff、pass/continue/end equality |
| Network authority | accept/reject、version、operation record、journal、snapshot、SSE payload equality |
| Runtime parity | classic、Vite、headless、local、Worker、CPU、small selfplay result equality |
| Headless boundary | `game/` に DOM、sound、timer、network client dependency を追加しない |
| Failure atomicity | required capability missing で first mutation 前 failure、input state unchanged |

Existing malformed / partial compatibility behavior は勝手に canonicalize しない。fixture で current behavior を特定し、supported runtime の valid path なら outer adapter へ明示移管する。unsupported partial module graph なら activation failure にするが、public error/wire shape は変えない。

## 9. Verification design

### 9.1 Characterization before movement

最低限、次を fixture manifest に含める。

- all card API exports and descriptors;
- key + kind schema、重要 constants、representative semantic probes;
- representative immediate, pending, cancel, refund, targetless, multi-stage, turn-start, marker/protection, board expansion cards;
- complete / absent / partial cancellation manager;
- standard and expanded board topology;
- AUTO / timeout command entry;
- CPU and selfplay calls through the public CardLogic surface;
- classic and Vite boot module identity;
- Worker bundle evaluation and Durable Object reconstruction;
- required dependency omission at each composition class。
- RNG source precedence、bind/unbind timing、selected alias、call ledger、independent identity。
- runtime-only RNG/action reference の presence、alias-group topology、deterministic descriptor と canonical-state comparator。

カードを「代表数件だけ」で完了扱いにせず、catalog/card type と resolver family の coverage matrix を machine-readable に作る。card-specific tests が既に exact behavior を証明する場合は重複 test を追加せず、manifest から既存 test owner を参照する。

### 9.2 Focused and structural gates

Implementation plan は次を minimum bundle とする。

```powershell
npm run typecheck
npm run build:ts
npm run check:window
npm run check:card-runtime-boundary
npm run check:card-runtime-dist-parity
npm run match:card-runtime-delivery-check
npx jest --runInBand --runTestsByPath `
  test/game.cards-api-export-inventory.test.ts `
  test/game.turn-pipeline-phases-mode-di.test.ts `
  test/game.turn-pipeline-action-stage.test.ts `
  test/game.card-usage-pending-stage.test.ts `
  test/cards.pending-selection-contract.test.ts `
  test/scripts.worker-runtime-preload.test.ts `
  test/workers.match-worker-card-preload.test.ts `
  test/browser-vite.classic-compat-loader.test.ts
npm run test:network:parity
npm run worker:prepare
npm run worker:bundle:smoke
npm run checkall
npm run test:jest
```

`checkall` と `test:jest` の順序は、pretest の重複 retry で最初の failure reason を隠さないよう明示する。exact command は実装時の `package.json` authority に合わせて更新し、実行したものと未実行のものを分けて記録する。

Runtime preparation 中だけ `npm run match:card-runtime-worker-fixture-check` を使い、production-equivalent Worker fixture entry を temporary output へ bundle/execute する。この fixture-only command と entry source は全 actual production-entry proof 後に削除し、final gate には残さない。

New structural / delivery checks:

- Gate B manifest の canonical-required closure 内の ambient runtime lookup prohibition;
- `MutationEntryManifest` が 289-key facade の全 function を分類し、effect/dependency flags を完全に持ち、全 non-pure function に cohort、first observable effect、preflight / failure owner、runtime consumer、test owner、全 dependency-sensitive query に activation-preflight / tagged-failure propagation owner と success-shaped fallback prohibition を持つこと;
- runtime service completeness and immutability;
- no stateful value in static service graph;
- leaf が root aggregate、whole `CardLogic`、`any` dependency bag、index signature を受けないこと;
- migrated Worker preload global key の再導入 prohibition;
- public export inventory and classic registry order;
- failure-before-mutation negative fixtures。
- `check:card-runtime-boundary`: typed contract shell phase で導入し、manifest roots と outer-adapter roots を分け、outer → core は許可、core → adapter は禁止する。`require`、`__non_webpack_require__`、resolver helper、`globalThis`、`self`、computed global key、dynamic import、whole-facade cache を検出し、negative self-fixture を持つ。現行 lookup は owner / reason / removal cohort 付き allowlist に固定し、各 cohort で単調に減らし、final canonical allowlist を0件にする。
- `check:card-runtime-dist-parity`: Jest を経由しない child process が built `dist/game/logic/cards` と legacy wrapper を load し、さらに built local match server を ephemeral port で起動・command fixture 実行・teardown して、API schema と fixed-seed fixture digest を比較する。
- `match:card-runtime-delivery-check`: actual built Vite / classic entry を ephemeral test server で開き、`window.CardLogic` の API schema と独立 PRNG fixture の state/events/ledger を比較する。server は test lifecycle が teardown する。

同一 fixture / seed / action 列は、それぞれ同じ初期 seed/input から独立再構築した factory direct call、legacy facade、headless pipeline、small selfplay、local authority、built Worker bundle、built Vite、built classic lane で比較する。source Jest が `.ts` を直接選択するだけでは `dist` / bundle delivery proof にならないため、source、built dist、Worker bundle、browser bundle を別 gate として記録する。

Actual production-entry proof owner は次に固定し、各 production cohort の同一 revision で通す。

| Lane | Actual proof owner |
| --- | --- |
| source/headless | cohort exact Jest fixture through the production facade |
| built Node/headless | built facade/legacy wrapper through `check:card-runtime-dist-parity` |
| local authority | built local match server ephemeral command scenario owned and torn down by `check:card-runtime-dist-parity` |
| Worker | canonical Wrangler entry through `worker:bundle:smoke` after `worker:prepare` |
| Vite | actual built production Vite entry through `match:card-runtime-delivery-check` |
| classic | actual built production classic entry through `match:card-runtime-delivery-check` |
| CPU / small selfplay | fixed-seed production-facade fixture with tagged-unavailable and action/PRNG ledger proof |

### 9.3 Runtime and browser proof

Browser check が必要な phase では repository play server を `http://127.0.0.1:8000/` に一つだけ維持する。

- default Vite lane: Pixi normal backend で representative immediate / pending card、turn handoff、console/page errors を確認する。
- explicit classic lane: same public CardLogic keys と同じ representative actions を確認する。
- DOM compatibility backend は card composition が backend 非依存であることを focused boot test が既に証明しない場合だけ確認する。
- Worker/local parity: same command fixture から version、state hash、pending、events / presentation journal を比較する。

HTTP 200 や shell DOM だけを gameplay readiness の証拠にしない。URL、entry lane、active backend、network mode、actions、console/page error、diagnostics/screenshot evidence を記録する。

### 9.4 Performance and training proof

本 refactor は performance improvement を goal にしない。runtime construction が action hot path に入っていないこと、card action latency と bundle size が明白に退行していないことだけを before/after 同一 scenario で確認する。

long selfplay / training は実行しない。fixed-seed small sample で public CardLogic result、record count、PRNG ending state が一致することを確認する。

## 10. Risks and controls

| Risk | Control |
| --- | --- |
| typed god objectへ置換するだけ | narrow readonly service groups、field-count / dependency-owner review、stateful value guard |
| root aggregate が leaf へ流れる | composer/facade/orchestrator only rule、leaf signature structural guard、`any` / index-signature prohibition |
| circular dependency を避けるため global を再導入 | composition root で cycle を解き、core import graph guard を通す。解けなければ stop condition |
| preflight 自体が rule evaluation / RNG を行う | presence/schema validation only、PRNG call-count negative test |
| representative apply entry だけ守りquery/presentation entryがRNG・event・runtime stateを変更、またはdependency failureを成功形へ畳む | 289-key `MutationEntryManifest`、effect/dependency flags、全non-pure functionのfirst-observable-effect/preflight owner、dependency-sensitive queryのtagged propagation、cohortごとのcompleteness gate |
| production entry 未接続の composer を built proof できない | production-equivalent non-shipping fixture entry、temporary output、shipping manifest absence test、本番切替後はactual entry proof |
| state-bound closure が singleton に残る | per-invocation context と concurrent two-game fixture |
| generic clone が PRNG identity/behavior を変える | same seed/input から runtime/state/PRNG を独立再構築し、source precedence と call ledger を比較 |
| independent PRNG の function identity が raw state equality を壊す | runtime-only reference descriptor + canonical-state comparator、alias topology separate proof、failure時だけsame-instance pre/post raw equality |
| failure が temporary RNG binding / cost / event mutation / PRNG draw 後に起きる | cohort preflight before first observable effect、state/runtime/event/PRNG equality failure fixture |
| classic partial load を壊す | current load-order inventory、boot adapter、whole-lane selection、public key/global tests |
| Worker evaluation order が再発する | executable bundle smoke、preload metadata/ordering proof、command-start後lazy lookup禁止 |
| old/new rule body が恒久化 | cohortごとの deletion gate、final structural scan、compat adapterはdelegation only |
| 一部 runtime だけ先に new authority へ移る | all-lane composer preparation、one cohort ownership manifest、production cutoverは全lane同時 |
| RNG / pending cleanupへscope creep | explicit non-goals、diff review、separate follow-up design requirement |
| production switch と生成物を別 revision にしてlaneがずれる | ownership switchと`worker:prepare`生成物を同一cohort commitに固定、single checkout writer、status/diff checks |
| owner不変のfactory extraction/preload preparationでproduction deliveryがstaleになる | production reachability基準、同一commit `worker:prepare`、actual current-owner entry proof、non-shipping absence check |
| broad full-suite failureの原因が不明 | focused first、phase commits、failure reasonをretryで隠さない |

## 11. Stop and rollback conditions

次のいずれかが成立した場合、その cohort の cutover を進めず design / plan を更新する。

- supported runtime の normal valid path が、現在の core fallback を実際に必要としている。
- supported runtime / public compatibility が incomplete cancellation manager の partial-success mutation path を必要としている。
- classic module order または Worker preload selection を characterization できない。
- Worker が synchronous command mutation 前に complete service graph を構成できない。
- old/new fixture で PRNG call count、ending state、pending payload、event order、snapshot/hash が一件でも変わる。
- cyclic dependency 解消に stateful global、runtime service locator、UI/network dependency が必要になる。
- per-effect / per-phase fallback しか rollback 手段を作れず、whole-lane boot selection を維持できない。
- command runtime、room-deck、network projection、CPU policy、pending state machine、RNG routing の再実装が必要になる。
- `runtime_unavailable` を CPU / legality の canonical false に畳まないと移行できない。
- hermetic gate または executable Worker bundle smoke が red のまま source cutover を要求される。

Rollback は coherent phase commit 単位で行い、一 action の途中で旧 resolver へ戻さない。task-owned commit だけを対象にし、unrelated user changes を revert しない。

## 12. Completion criteria

本 refactor は次をすべて満たした時だけ complete とする。

1. graph manifest の canonical-required node に未分類・未移行が0件で、supported runtime の card / turn core が validated static services から実行される。
2. manifest が定義する canonical-required closure に runtime `require`、global lookup、lazy import、success-shaped rule fallback がない。
3. `CardLogic` 289-key public inventory と existing signatures / globals が一致する。
4. `MutationEntryManifest` が全 facade function を分類し、effect/dependency flags、全 non-pure function の入口・first observable effect・preflight / failure owner・runtime consumer・test owner、全 dependency-sensitive query の activation-preflight / tagged propagation / fallback prohibition に未記入がない。
5. canonical-state comparator、snapshot/save、hash、events、PRNG descriptor/ledger、pending、turn outcome の exact parity matrix が green。
6. required dependency omission が全 non-pure function の first observable effect 前に fail-closed し、canonical/runtime state、PRNG、events、network authority state/version/journal/broadcast を変えない。
7. classic / Vite / headless / local / Worker / CPU / small selfplay の relevant lane が green。
8. `worker:prepare` と executable `worker:bundle:smoke` が同一 revision で pass する。
9. focused tests、network parity、`checkall`、full Jest、browser proof が pass し、実行結果が記録される。
10. old core resolver / duplicate fallback body が削除され、compatibility adapter は delegation only である。
11. `docs/architecture-contracts.md` と actual owner、generated browser/Worker delivery、final task-owned diff が同期する。
12. independent final review の findings を修正または明示的に disposition する。
13. `git status --short` と staged diff を確認し、task-owned coherent commits だけを作る。
14. non-Jest built-dist、canonical Worker bundle、actual built Vite/classic delivery parity が final revision で pass し、transitional fixture entry / fixture-only wiring が残らない。
15. production-reachable browser/Worker graphを変えた各commitが同一commitの生成同期を持ち、省略commitはnon-shipping/unreachableのmachine proofを記録する。

## 13. Self-review and independent review record

### 13.1 Main self-review findings incorporated

- Initial idea は card composition、TurnExecutionContext、RNG hidden-state cleanup、pending state-machine を一 program へ含めていた。PRNG / network / snapshot blast radius が大きすぎるため、RNG と pending redesign を non-goal にした。
- Initial idea は `CardRuntimeDependencies` という一つの大 bag を想定していた。現行 untyped deps bag の名前替えになるため、narrow static service groups と invocation context の lifetime separation へ修正した。
- Initial idea は check/build debt を候補比較だけに置いていた。clean clone bootstrap が未証明のため、separate prerequisite commit を Gate A にし、test-only characterization 後の Gate B も追加した。
- File size を ranking evidence に使いすぎないよう、acceptance criteria を authority / parity / failure atomicity に変更した。
- Initial source guard は top-level card / turn files だけを想定していた。子 module の evaluation-time global capture を残せるため、Gate B manifest の canonical-required closure 全体へ拡張した。
- Initial gate は characterization fixture を source-edit 前提に置く循環があった。Gate A（environment baseline）と Gate B（test-only characterization 後、product source 前）へ分離した。
- Initial transition は headless/local を先に production cutover する読み方ができた。全 runtime composer を先に準備し、capability cohort ごとに全 lane を同じ ownership manifest で切り替える方式へ修正した。
- Initial module layout は composer/facade cycle を防ぐ import direction が不足していた。contracts → leaf / composer / factory → facade → stable entry / adapters の file-level DAG を固定した。

### 13.2 Independent review findings incorporated

- 2026-07 / 2026-08 completed refactor を未完扱いせず、deliberately retained compatibility の final composition cutover と位置付けた。
- card composition と turn phase cutover を別 phase にし、一括 rewrite を禁止した。
- complete / absent / partial cancellation manager を別 fixture にした。
- Worker preload を独立 migration phase とし、command mutation 開始後の async / lookup を禁止した。
- classic rollback を boot-time whole-lane selection に限定し、effect-level fallback を禁止した。
- preflight を first mutation 前へ移し、network version / journal / broadcast の非変更を failure proof に追加した。
- production shadow execution を禁止し、比較を isolated fixture harness だけで行うよう修正した。その後 PRNG identity review を受け、generic clone ではなく同一 seed/input からの独立 runtime 再構築へさらに強化した。
- 289-key inventory hashだけでは value kind / constant / semantics を証明できないため、key + kind schema、重要 constant、semantic probes を追加した。
- `pending-coordinator` の whole-facade cache を narrow pending port へ切り替えるが、pending state machine / payload / timing は変更しないと明記した。
- authoritative apply の fail-closed と preview / CPU analysis の unavailable result を分離し、generic exception や Worker 500 を禁止した。
- preview / CPU analysis の内部 failure を tagged `runtime_unavailable` とし、canonical card-illegal `false` や別 action 選択へ畳まないよう修正した。
- Generic deep clone comparison を廃止し、同一 seed/input から独立 runtime/state/instrumented PRNG を再構築する parity protocolへ修正した。
- Independent PRNG の function identity が raw state equality を壊すため、runtime-only reference descriptor / alias topology と canonical-state comparator を分離した。failure atomicity は同一 instance の pre/post raw equality を維持する。
- Full preflight を final cleanup で初めて有効化せず、各 cohort cutover 前に direct apply/turn entry まで有効化するよう修正した。
- Built dist child-process proof と actual built Vite/classic browser proof の named owner / npm gate を追加した。
- Structural guard を final cleanup まで遅らせず typed contract shell phase に前倒しし、owner / reason / removal cohort 付き legacy allowlist を各 cohort で単調に縮小する ratchet にした。
- 289-key facade の全 function を `MutationEntryManifest` で分類し、canonical/runtime state write、event append/drain、PRNG draw の effect flags、dependency-sensitive query、全 non-pure function の first observable effect / preflight / failure owner を固定するため、representative `applyCardUsage()` / `applyTurn()` だけでは完了できないようにした。
- UI preview と CPU legality/candidate query の success-shaped fallback が別action/booleanを作れるため、Step 5でdormant tagged-failure adapterを準備し、該当cohortと同時に有効化する工程を追加した。
- Production entry 未接続の preparation phase は production-equivalent non-shipping fixture entry と専用Worker fixture commandを使い、card cohort 本番切替後は actual production entry を lane別 proof owner にする二段階へ修正した。全actual proof後にtransitional fixture source/wiringを退役する。
- All-lane ownership switch と script-generated browser/Worker delivery を同一 cohort commit に固定し、中間 revision のlane driftを禁止した。
- Generation sync の trigger を ownership switch から production reachability へ広げ、Step 3 factory extraction、Step 4 Worker preload、Step 5 dormant preparationにも同一commit同期またはnon-shipping absence proofを要求した。

### 13.3 Residual design uncertainty

- 現行 classic partial-load compatibility のうち、supported normal path と historical-only path の境界は Phase A inventory で確定する。
- public network / preview / CPU failure mapping は wire schema を変えない前提だが、current exact response は Gate B までに plan execution recordへ固定し、design / plan を再 review する。未確定のまま product source edit を開始しない。
- clean clone `checkall` failure は source wiring からの推論であり、external CI prebuild の有無は未確認である。実装開始前に actual fresh-clone proof が必要である。
- full Jest は過去記録で約16分規模であり、final gate の実行時間を確保する。Jest project redesign は本 scope 外である。

これらは source cutover 前に解消すべき discovery であり、推測で compatibility behavior を削除する許可ではない。
