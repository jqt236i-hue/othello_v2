'use strict';

export const RULES_HELP_INNER_HTML = `
<div id="rules-help-title-row">
            <div id="rules-help-title">help</div>
            <button id="rules-help-close-btn" type="button" aria-label="helpを閉じる">×</button>
        </div>
        <div id="rules-help-tabs" role="tablist" aria-label="help tabs">
            <button id="rules-help-tab-catalog" class="rules-help-tab is-active" type="button" role="tab"
                aria-selected="true" aria-controls="rules-help-page-catalog" data-help-tab="catalog">カード図鑑</button>
            <button id="rules-help-tab-effects" class="rules-help-tab" type="button" role="tab"
                aria-selected="false" aria-controls="rules-help-page-effects" data-help-tab="effects">効果一覧</button>
            <button id="rules-help-tab-guide" class="rules-help-tab" type="button" role="tab"
                aria-selected="false" aria-controls="rules-help-page-guide" data-help-tab="guide">ルールと操作</button>
            <button id="rules-help-tab-protection-map" class="rules-help-tab" type="button" role="tab"
                aria-selected="false" aria-controls="rules-help-page-protection-map" data-help-tab="protection-map">耐性貫通表</button>
            <button id="rules-help-tab-counters" class="rules-help-tab" type="button" role="tab"
                aria-selected="false" aria-controls="rules-help-page-counters" data-help-tab="counters">石マーカー</button>
        </div>
        <div id="rules-help-pages">
            <section id="rules-help-page-catalog" class="rules-help-page is-active" data-help-page="catalog"
                aria-hidden="false">
                <div id="rules-help-catalog-controls" aria-label="カード図鑑の絞り込み">
                    <label id="rules-help-card-search-label" for="rules-help-card-search">検索</label>
                    <div id="rules-help-card-search-row">
                        <input id="rules-help-card-search" type="search" placeholder="カード名・効果・タグ" autocomplete="off"
                            spellcheck="false" aria-labelledby="rules-help-card-search-label"
                            aria-controls="rules-help-card-list" />
                        <button id="rules-help-card-filter-clear" type="button" aria-disabled="true" disabled>クリア</button>
                    </div>
                    <div id="rules-help-card-tag-filters" role="group" aria-label="効果タグで絞り込み"></div>
                    <div id="rules-help-card-filter-status" role="status" aria-live="polite" aria-atomic="true">0 / 0枚</div>
                </div>
                <div id="rules-help-catalog-layout">
                    <div id="rules-help-card-list" role="listbox" aria-label="カード一覧"></div>
                    <div id="rules-help-card-detail">
                        <div id="rules-help-card-name">カードを選択してください</div>
                        <div id="rules-help-card-desc">左の一覧からカードを押すと、効果を表示します。</div>
                    </div>
                </div>
            </section>
            <section id="rules-help-page-effects" class="rules-help-page" data-help-page="effects" aria-hidden="true">
                <dl id="rules-help-effects-list">
                    <div class="rules-help-effect-item">
                        <dt>多動状態</dt>
                        <dd>両者ターン開始時マス移動する、基本ランダム移動。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>反転回避</dt>
                        <dd>反転されるとき、元位置から最も近い空きマスに移動して避ける。隣接に空きがない場合、次に近い空きマスに移動し回避する。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>破壊回避</dt>
                        <dd>破壊されるとき、元位置から最も近い空きマスに移動して避ける。隣接に空きがない場合、次に近い空きマスに移動し回避する。空きマスがなければ回避できない。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>特殊石</dt>
                        <dd>通常石ではなく、盤面に残って次ターン以降も能力主体として生きる石。罠石・時限爆弾は含み、顕現石・石状態・盤面マーカー・配置時効果は含まない。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>穴マス</dt>
                        <dd>マスを永続の穴にする。穴マスには誰も置けず、移動先にもならず、反転経路も遮断する。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>抹消</dt>
                        <dd>そのマスの石を取り除きます。完全保護や反転保護でも防げません。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>絶対執行</dt>
                        <dd>盤界の執行者専用の抹消。不可侵以外の保護を貫通して特殊石を穴マスにする。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>反転保護</dt>
                        <dd>反転されない。挟める列ごと無効できる。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>完全保護</dt>
                        <dd>石に対する敵対的・強制的な効果を無効化。自分への強化・維持効果は受けられ、マス破壊は貫通する。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>不可侵</dt>
                        <dd>顕現石や森羅万象神を、反転・破壊・状態付与・抹消・絶対執行など盤面干渉効果の対象から外す保護。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>マス破壊</dt>
                        <dd>マスごと穴にして永続封鎖。誰も置けず、反転経路も遮断する。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>破壊／爆発</dt>
                        <dd>石を破壊して盤面から消す効果。反転保護では防げないが、完全保護・不可侵には効かない。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>連鎖反転</dt>
                        <dd>通常反転の後さらに挟める列ができた場合追加で一方向だけ反転させる。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>禁忌反転</dt>
                        <dd>挟めなくても反転可能。実際に反転する枚数が最大の列1方向のみ選ぶ。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>封鎖</dt>
                        <dd>一時的にそのマスを塞ぐ。両者とも置けず、移動でも入れない。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>凍結</dt>
                        <dd>そのマスと上の石の反転・破壊・持続減少を止める。</dd>
                    </div>
                    <div class="rules-help-effect-item">
                        <dt>時間停止</dt>
                        <dd>発動したプレイヤーが2ターン連続で行動する。</dd>
                    </div>
                </dl>
            </section>
            <section id="rules-help-page-guide" class="rules-help-page" data-help-page="guide" aria-hidden="true">
                <div id="rules-help-guide-layout">
                    <div id="rules-help-guide-slide-frame" role="group" aria-label="カードリバーシ説明スライド">
                        <img
                            id="rules-help-guide-slide-img"
                            data-card-reversi-logical-src="assets/images/help/player-guide/card-reversi-player-guide-slide-01.png"
                            width="1920"
                            height="1080"
                            alt="カードリバーシ説明スライド 1 / 8"
                            draggable="false"
                            decoding="async">
                    </div>
                    <div id="rules-help-guide-controls" aria-label="説明スライドのページ操作">
                        <button id="rules-help-guide-prev" class="btn-small" type="button">前へ</button>
                        <div id="rules-help-guide-page-status" aria-live="polite" aria-atomic="true">1 / 8</div>
                        <button id="rules-help-guide-next" class="btn-small" type="button">次へ</button>
                    </div>
                </div>
            </section>
            <section id="rules-help-page-protection-map" class="rules-help-page" data-help-page="protection-map"
                aria-hidden="true">
                <div id="rules-help-protection-map-layout">
                    <div id="rules-help-protection-map-controls" aria-label="耐性貫通表のページ操作">
                        <button id="rules-help-protection-map-prev" class="btn-small" type="button">前へ</button>
                        <div id="rules-help-protection-map-page-status" aria-live="polite" aria-atomic="true">1 / 2</div>
                        <button id="rules-help-protection-map-next" class="btn-small" type="button">次へ</button>
                    </div>
                    <div id="rules-help-protection-map-frame" role="group" aria-label="耐性貫通表">
                        <img
                            id="rules-help-protection-map-img"
                            data-card-reversi-logical-src="assets/images/help/protection-penetration/protection-penetration-quick-reference.png"
                            width="1600"
                            height="1080"
                            alt="耐性貫通の〇×早見表 1 / 2"
                            draggable="false"
                            decoding="async">
                    </div>
                </div>
            </section>
            <section id="rules-help-page-counters" class="rules-help-page" data-help-page="counters"
                aria-hidden="true">
                <div id="rules-help-counters-layout">
                    <section class="rules-help-counter-summary" aria-labelledby="rules-help-counters-title">
                        <div class="rules-help-counter-summary-copy">
                            <div id="rules-help-counters-title" class="rules-help-counter-summary-title">石の上のマーカーの見方
                            </div>
                            <div class="rules-help-counter-summary-text">
                                石の上に出る数字やバッジは、位置と形で意味が変わります。下中央の数字は石本体やカウントダウン系、
                                右上と左下の小さい数字は回避回数系、中央左のピンクハートバッジは復活回数、中央右の灰色バッジは反転保護と覚えると見分けやすいです。
                            </div>
                            <div class="rules-help-counter-summary-note">
                                色や輪郭が少し違っても、同じ位置に出るマーカーはほぼ同じ意味です。数字の詳しい意味も、石情報で確認できます。
                            </div>
                        </div>
                        <div class="rules-help-counter-demo" aria-hidden="true">
                            <div class="disc black" data-image-state="loaded"
                                style="--stone-image: var(--normal-stone-black-image);">
                                <div class="disc__face">
                                    <div class="disc__base-image"></div>
                                    <div class="disc__overlay-image"></div>
                                </div>
                                <div class="disc__hud">
                                    <div class="countdown-timer">5</div>
                                    <div class="stone-flip-protection-badge">反</div>
                                    <div class="stone-regen-badge" data-count="3"><span class="stone-regen-badge-value">3</span></div>
                                    <div class="stone-timer flip-evade-timer">3</div>
                                    <div class="stone-timer destroy-evade-timer">1</div>
                                </div>
                            </div>
                        </div>
                    </section>
                    <div id="rules-help-counters-list">
                        <div class="rules-help-counter-row rules-help-counter-row-header" aria-hidden="true">
                            <div class="rules-help-counter-cell">見本</div>
                            <div class="rules-help-counter-cell">意味</div>
                            <div class="rules-help-counter-cell">読み方</div>
                        </div>
                        <div class="rules-help-counter-row">
                            <div class="rules-help-counter-cell rules-help-counter-cell--demo">
                                <div class="rules-help-counter-demo" aria-hidden="true">
                                    <div class="disc black" data-image-state="loaded"
                                        style="--stone-image: var(--normal-stone-black-image);">
                                        <div class="disc__face">
                                            <div class="disc__base-image"></div>
                                            <div class="disc__overlay-image"></div>
                                        </div>
                                        <div class="disc__hud">
                                            <div class="guard-timer">3</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rules-help-counter-cell">
                                <div class="rules-help-counter-label">上側の青い数字</div>
                                <div class="rules-help-counter-meaning">完全保護の残りターン</div>
                            </div>
                            <div class="rules-help-counter-cell rules-help-counter-cell--note">
                                守る石など、上から掛かっている保護が切れるまでの残りターンです。
                            </div>
                        </div>
                        <div class="rules-help-counter-row">
                            <div class="rules-help-counter-cell rules-help-counter-cell--demo">
                                <div class="rules-help-counter-demo" aria-hidden="true">
                                    <div class="disc black" data-image-state="loaded"
                                        style="--stone-image: var(--normal-stone-black-image);">
                                        <div class="disc__face">
                                            <div class="disc__base-image"></div>
                                            <div class="disc__overlay-image"></div>
                                        </div>
                                        <div class="disc__hud">
                                            <div class="special-timer">5</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rules-help-counter-cell">
                                <div class="rules-help-counter-label">下中央の丸い数字</div>
                                <div class="rules-help-counter-meaning">特殊石本体の持続ターン</div>
                            </div>
                            <div class="rules-help-counter-cell rules-help-counter-cell--note">
                                一般的な特殊石の残りターンです。龍・繁殖・労働石などでも、本体側の持続表示として読みます。
                            </div>
                        </div>
                        <div class="rules-help-counter-row">
                            <div class="rules-help-counter-cell rules-help-counter-cell--demo">
                                <div class="rules-help-counter-demo" aria-hidden="true">
                                    <div class="disc black" data-image-state="loaded"
                                        style="--stone-image: var(--normal-stone-black-image);">
                                        <div class="disc__face">
                                            <div class="disc__base-image"></div>
                                            <div class="disc__overlay-image"></div>
                                        </div>
                                        <div class="disc__hud">
                                            <div class="stone-regen-badge" data-count="3"><span class="stone-regen-badge-value">3</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rules-help-counter-cell">
                                <div class="rules-help-counter-label">中央左のピンクハートバッジ</div>
                                <div class="rules-help-counter-meaning">復活可能回数</div>
                            </div>
                            <div class="rules-help-counter-cell rules-help-counter-cell--note">
                                復活の意志で付いた石が、反転や破壊からあと何回まで復活できるかを表します。
                            </div>
                        </div>
                        <div class="rules-help-counter-row">
                            <div class="rules-help-counter-cell rules-help-counter-cell--demo">
                                <div class="rules-help-counter-demo" aria-hidden="true">
                                    <div class="disc black" data-image-state="loaded"
                                        style="--stone-image: var(--normal-stone-black-image);">
                                        <div class="disc__face">
                                            <div class="disc__base-image"></div>
                                            <div class="disc__overlay-image"></div>
                                        </div>
                                        <div class="disc__hud">
                                            <div class="countdown-timer">4</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rules-help-counter-cell">
                                <div class="rules-help-counter-label">下中央の赤い三角形数字</div>
                                <div class="rules-help-counter-meaning">カウントダウン専用の残り回数</div>
                            </div>
                            <div class="rules-help-counter-cell rules-help-counter-cell--note">
                                時限爆弾の起爆まで、時間停石の発動まで、強い石の昇格までなどに使われます。
                            </div>
                        </div>
                        <div class="rules-help-counter-row">
                            <div class="rules-help-counter-cell rules-help-counter-cell--demo">
                                <div class="rules-help-counter-demo" aria-hidden="true">
                                    <div class="disc black" data-image-state="loaded"
                                        style="--stone-image: var(--normal-stone-black-image);">
                                        <div class="disc__face">
                                            <div class="disc__base-image"></div>
                                            <div class="disc__overlay-image"></div>
                                        </div>
                                        <div class="disc__hud">
                                            <div class="stone-timer flip-evade-timer">2</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rules-help-counter-cell">
                                <div class="rules-help-counter-label">右上の数字</div>
                                <div class="rules-help-counter-meaning">反転回避の残り回数</div>
                            </div>
                            <div class="rules-help-counter-cell rules-help-counter-cell--note">
                                反転をあと何回まで避けられるかを表します。
                            </div>
                        </div>
                        <div class="rules-help-counter-row">
                            <div class="rules-help-counter-cell rules-help-counter-cell--demo">
                                <div class="rules-help-counter-demo" aria-hidden="true">
                                    <div class="disc black" data-image-state="loaded"
                                        style="--stone-image: var(--normal-stone-black-image);">
                                        <div class="disc__face">
                                            <div class="disc__base-image"></div>
                                            <div class="disc__overlay-image"></div>
                                        </div>
                                        <div class="disc__hud">
                                            <div class="stone-timer destroy-evade-timer">1</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rules-help-counter-cell">
                                <div class="rules-help-counter-label">左下の小さい数字</div>
                                <div class="rules-help-counter-meaning">破壊回避の残り回数</div>
                            </div>
                            <div class="rules-help-counter-cell rules-help-counter-cell--note">
                                破壊をあと何回まで避けられるかを表します。
                            </div>
                        </div>
                        <div class="rules-help-counter-row">
                            <div class="rules-help-counter-cell rules-help-counter-cell--demo">
                                <div class="rules-help-counter-demo" aria-hidden="true">
                                    <div class="disc black" data-image-state="loaded"
                                        style="--stone-image: var(--normal-stone-black-image);">
                                        <div class="disc__face">
                                            <div class="disc__base-image"></div>
                                            <div class="disc__overlay-image"></div>
                                        </div>
                                        <div class="disc__hud">
                                            <div class="stone-flip-protection-badge">反</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="rules-help-counter-cell">
                                <div class="rules-help-counter-label">中央右の灰色バッジ</div>
                                <div class="rules-help-counter-meaning">反転保護の目印</div>
                            </div>
                            <div class="rules-help-counter-cell rules-help-counter-cell--note">
                                反転されない石を表します。灰色の五角形に「反」と表示されます。
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
`;
