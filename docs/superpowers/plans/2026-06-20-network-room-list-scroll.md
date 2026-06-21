# Network Room List Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC版ネット対戦ロビーで、`ルーム一覧` 枠の中だけを縦スクロールさせて全件閲覧可能にする。

**Architecture:** `#networkRoomListPanel` の内部を「ヘッダー」と「専用 viewport」に分け、viewport の中だけで room card grid をスクロールさせる。phone portrait では viewport を無効化して従来の縦展開を維持する。

**Tech Stack:** TypeScript, vanilla DOM, CSS, Jest

---

### Task 1: Add the failing regression tests

**Files:**
- Modify: `C:/Users/quarr/Desktop/othello_v2/test/ui.match-mode.network-button.test.ts`
- Modify: `C:/Users/quarr/Desktop/othello_v2/test/ui.network-room-list-style.test.ts`

- [ ] **Step 1: Add a DOM regression test for the viewport wrapper**

```ts
test('ネット対戦ロビーはルーム一覧を専用viewportでラップする', async () => {
  const networkBtn = document.getElementById('modeNetworkBtn');
  listRooms.mockResolvedValue({ ok: true, rooms: [] });

  networkBtn.click();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  const viewport = document.getElementById('networkRoomListViewport');
  const list = document.getElementById('networkRoomList');
  expect(viewport).toBeTruthy();
  expect(list).toBeTruthy();
  expect(viewport?.contains(list)).toBe(true);
});
```

- [ ] **Step 2: Add CSS contract tests for desktop and phone portrait**

```ts
const viewportBlock = readCssRuleBlock(layoutCss, '#networkRoomListViewport');
expect(viewportBlock).toMatch(/overflow-y:\s*auto/);
expect(viewportBlock).toMatch(/overflow-x:\s*hidden/);
expect(viewportBlock).toMatch(/min-height:\s*0/);

const mobileViewportBlock = readCssRuleBlock(responsiveCss, 'html.layout-profile-phone-portrait #networkRoomListViewport');
expect(mobileViewportBlock).toMatch(/overflow:\s*visible/);
expect(mobileViewportBlock).toMatch(/max-height:\s*none/);
```

- [ ] **Step 3: Run the focused tests and confirm they fail**

Run: `npx jest test/ui.match-mode.network-button.test.ts test/ui.network-room-list-style.test.ts --runInBand`

Expected: FAIL because `networkRoomListViewport` and its CSS rules do not exist yet

### Task 2: Implement the viewport wrapper and desktop scroll behavior

**Files:**
- Modify: `C:/Users/quarr/Desktop/othello_v2/ui/handlers/match-mode.ts`
- Modify: `C:/Users/quarr/Desktop/othello_v2/styles-layout-info.css`
- Modify: `C:/Users/quarr/Desktop/othello_v2/styles-responsive.css`

- [ ] **Step 1: Wrap `#networkRoomList` in `#networkRoomListViewport`**

```ts
const viewport = document.createElement('div');
viewport.id = 'networkRoomListViewport';
viewport.appendChild(list);

listWrap.appendChild(header);
listWrap.appendChild(viewport);
```

- [ ] **Step 2: Make the new viewport scroll on desktop**

```css
#networkRoomListViewport {
    position: relative;
    z-index: 4;
    min-height: 0;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
}
```

- [ ] **Step 3: Preserve phone portrait full expansion**

```css
html.layout-profile-phone-portrait #networkRoomListViewport {
    max-height: none;
    overflow: visible;
}
```

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run: `npx jest test/ui.match-mode.network-button.test.ts test/ui.network-room-list-style.test.ts --runInBand`

Expected: PASS

### Task 3: Document the behavior and run focused verification

**Files:**
- Modify: `C:/Users/quarr/Desktop/othello_v2/01-rulebook.md`

- [ ] **Step 1: Add the lobby scrolling requirement to the rulebook**

```md
- `ネット対戦` 設定パネルの PC レイアウトでは、`ルーム一覧` を一覧枠の中だけで縦スクロールできるようにし、部屋数が増えても全件確認できるようにする
```

- [ ] **Step 2: Run focused verification**

Run: `npx jest test/ui.match-mode.network-button.test.ts test/ui.network-room-list-style.test.ts --runInBand`

Expected: PASS

- [ ] **Step 3: Inspect the final diff**

Run: `git diff -- 01-rulebook.md ui/handlers/match-mode.ts styles-layout-info.css styles-responsive.css test/ui.match-mode.network-button.test.ts test/ui.network-room-list-style.test.ts docs/superpowers/specs/2026-06-20-network-room-list-scroll-design.md docs/superpowers/plans/2026-06-20-network-room-list-scroll.md`

Expected: Only the room-list viewport scrolling change and its docs/tests appear
