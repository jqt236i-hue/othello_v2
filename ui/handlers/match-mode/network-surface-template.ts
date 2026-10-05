'use strict';

export const NETWORK_MODAL_INNER_HTML = `
<div id="networkModalHeader">
    <div class="network-title">ネット対戦</div>
    <button id="networkCloseBtn" class="btn-small" type="button" aria-label="ネット対戦設定を閉じる">×</button>
</div>
<div id="networkModalBody">
    <div id="networkPanel">
        <details id="networkAdvancedSettings">
            <summary>詳細設定</summary>
            <input id="networkServerInput" type="text" value="" placeholder="接続先URL（空欄でこのサイト）" />
        </details>
        <section class="network-section" aria-label="部屋を作成する">
            <div class="network-section-title">部屋を作成する</div>
            <div class="network-create-fields">
                <label class="network-field" for="networkPlayerNameInput">
                    <span class="network-field-label">名前 <span class="network-field-required">※必須</span></span>
                    <input id="networkPlayerNameInput" type="text" placeholder="名前を入力してください" maxlength="7" autocomplete="off" spellcheck="false" />
                </label>
                <label class="network-field" for="networkRoomIdInput">
                    <span class="network-field-label">ルーム名 <span class="network-field-optional">任意</span></span>
                    <input id="networkRoomIdInput" type="text" placeholder="ルーム名を入力してください" maxlength="20" autocomplete="off" spellcheck="false" />
                </label>
                <label class="network-field" for="networkRoomPasswordInput">
                    <span class="network-field-label">パスワード <span class="network-field-optional">任意</span></span>
                    <input id="networkRoomPasswordInput" type="password" placeholder="空欄で公開" maxlength="20" autocomplete="off" spellcheck="false" />
                </label>
            </div>
        </section>
        <div id="networkActionRow" aria-label="ネット対戦操作">
            <button id="networkRoomSettingsBtn" class="btn-small" type="button" aria-label="部屋作成設定" aria-controls="networkRoomSettingsPopup" aria-expanded="false">⚙</button>
            <button id="networkCreateBtn" class="btn-small" type="button">部屋作成</button>
            <div id="networkRoomSettingsBackdrop" aria-hidden="true"></div>
            <div id="networkRoomSettingsPopup" role="dialog" aria-modal="true" aria-label="部屋作成設定" aria-hidden="true">
                <div id="networkRoomSettingsPopupTitle">設定</div>
                <button id="networkRoomSettingsCloseBtn" class="btn-small" type="button" aria-label="部屋作成設定を閉じる">×</button>
                <div id="networkBoardSizeRow">
                    <div id="networkBoardSizeHeader">
                        <span id="networkBoardSizeTitle">盤面サイズ</span>
                        <span id="networkBoardSizeSummary" class="board-size-control-summary">8x8</span>
                    </div>
                    <label class="board-size-editor-label" for="networkBoardShapeSelect">形状</label>
                    <select id="networkBoardShapeSelect" class="compact-select">
                        <option value="rectangle">通常</option>
                        <option value="circle">円形</option>
                    </select>
                    <div id="networkBoardSizeInputs">
                        <label class="board-size-editor-label" for="networkBoardSizeRowsInput">縦</label>
                        <input id="networkBoardSizeRowsInput" class="compact-number-input" type="number" min="4" max="16" step="1" inputmode="numeric" value="8" />
                        <span class="board-size-editor-separator">x</span>
                        <label class="board-size-editor-label" for="networkBoardSizeColsInput">横</label>
                        <input id="networkBoardSizeColsInput" class="compact-number-input" type="number" min="4" max="16" step="1" inputmode="numeric" value="8" />
                    </div>
                    <div id="networkBoardSizeNote" class="board-size-editor-note">部屋作成前に変更できます</div>
                </div>
                <label id="networkTurnTimeOptionRow" for="networkTurnTimeSecondsInput">
                    <span>持ち時間</span>
                    <span id="networkTurnTimeInputGroup">
                        <input id="networkTurnTimeSecondsInput" class="compact-number-input" type="number" min="3" max="1800" step="1" inputmode="numeric" value="120" aria-describedby="networkTurnTimeNote" />
                        <span>秒</span>
                    </span>
                    <span id="networkTurnTimeNote">3〜1800秒 / ホイールは10秒刻み</span>
                </label>
                <label id="networkStoneSupplyOptionRow" for="networkStoneSupplyCheckbox">
                    <input id="networkStoneSupplyCheckbox" type="checkbox" checked />
                    持ち石ルール
                </label>
                <label id="networkDebugOptionRow" for="networkEnableDebugCheckbox">
                    <input id="networkEnableDebugCheckbox" type="checkbox" />
                    デバッグモードを有効化
                </label>
                <label id="networkAutoOptionRow" for="networkEnableAutoCheckbox">
                    <input id="networkEnableAutoCheckbox" type="checkbox" />
                    オートプレイを許可
                </label>
                <label id="networkAllCardsDeckOptionRow" for="networkAllCardsDeckCheckbox">
                    <input id="networkAllCardsDeckCheckbox" type="checkbox" />
                    両者全カードデッキ
                </label>
            </div>
        </div>
        <button id="networkJoinBtn" class="btn-small network-hidden-control" type="button" hidden>参加</button>
        <button id="networkLeaveBtn" class="btn-small network-hidden-control" type="button" hidden>退出</button>
        <button id="networkCopyRoomBtn" class="btn-small network-hidden-control" type="button" hidden>部屋番号コピー</button>
        <div id="networkStatusText"></div>
        <div id="networkDeckInfo"></div>
    </div>
</div>
`;

export const NETWORK_CHAT_INNER_HTML = `
<button id="networkChatToggle" type="button" aria-expanded="false">対戦チャット</button>
<div id="networkChatBody">
    <div id="networkChatMessages" aria-live="polite" aria-atomic="false"></div>
    <div id="networkChatInputRow">
        <input id="networkChatInput" type="text" maxlength="20" placeholder="20文字まで" autocomplete="off" spellcheck="false" />
        <button id="networkChatSendBtn" class="btn-small" type="button">送信</button>
    </div>
</div>
`;
