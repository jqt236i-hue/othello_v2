# -*- coding: utf-8 -*-
"""Markdown novels -> self-contained commercial reader HTML."""
from __future__ import annotations

import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "読む.html"

VOLUMES = [
    {
        "id": "vol1",
        "label": "第一巻",
        "title": "終わった人間",
        "file": "第1巻_終わった人間.md",
        "blurb": "世界大会決勝から、理論盤界の入口まで。",
    },
    {
        "id": "vol2",
        "label": "第二巻",
        "title": "骸の虚影",
        "file": "第2巻_骸の虚影.md",
        "blurb": "父との対局、観測の罪、黒白の分岐。",
    },
    {
        "id": "vol3",
        "label": "第三巻",
        "title": "観測者の道",
        "file": "第3巻_観測者の道.md",
        "blurb": "続きを探す道と、観測者ルートの結末。",
    },
    {
        "id": "vol4",
        "label": "第四巻",
        "title": "執行者の道",
        "file": "第4巻_執行者の道.md",
        "blurb": "循環を守る道と、どちらからでも届く結末。",
    },
]


def slug(text: str) -> str:
    text = re.sub(r"[^\w一-龠ぁ-んァ-ンー]+", "-", text, flags=re.UNICODE)
    return text.strip("-") or "section"


def split_chapter_title(title: str) -> tuple[str, str]:
    if "　" in title:
        left, right = title.split("　", 1)
        return left.strip(), right.strip()
    return "", title.strip()


def flush_paragraphs(buf: list[str], out: list[str]) -> None:
    text = "\n".join(buf).strip()
    buf.clear()
    if not text:
        return
    if text.strip() in {"＊　＊　＊", "*　*　*", "＊ ＊ ＊"}:
        out.append('<p class="scene-break" aria-hidden="true">＊　＊　＊</p>')
        return
    cls = ' class="dialogue"' if text.startswith("「") or text.startswith("『") else ""
    out.append(f"<p{cls}>{html.escape(text).replace(chr(10), '<br>')}</p>")


def render_markdown_body(md: str, vol_id: str) -> tuple[str, list[dict]]:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    toc: list[dict] = []
    buf: list[str] = []
    chapter_i = 0
    skip_volume_title = True

    def new_heading(tag: str, title: str, kind: str) -> None:
        nonlocal chapter_i
        flush_paragraphs(buf, out)
        chapter_i += 1
        hid = f"{vol_id}-{kind}-{chapter_i}-{slug(title)}"
        label, name = split_chapter_title(title)
        toc.append({"id": hid, "label": label, "title": name or title, "kind": kind})
        if kind == "chapter":
            out.append(f'<section class="chapter" id="{html.escape(hid)}">')
            out.append('<header class="chapter-head">')
            if label:
                out.append(f'<p class="chapter-label">{html.escape(label)}</p>')
            out.append(f"<h2>{html.escape(name or title)}</h2>")
            out.append("</header>")
        else:
            out.append(
                f'<h3 id="{html.escape(hid)}" class="subhead">{html.escape(title)}</h3>'
            )

    open_chapter = False
    for raw in lines:
        line = raw.rstrip()
        if line.startswith("# Reversi Destiny"):
            continue
        if skip_volume_title and line.startswith("## 第"):
            skip_volume_title = False
            continue
        if line.startswith("# "):
            if open_chapter:
                out.append("</section>")
            new_heading("h2", line[2:].strip(), "chapter")
            open_chapter = True
            continue
        if line.startswith("## "):
            flush_paragraphs(buf, out)
            title = line[3:].strip()
            new_heading("h3", title, "sub")
            continue
        if not line.strip():
            flush_paragraphs(buf, out)
            continue
        buf.append(line)
    flush_paragraphs(buf, out)
    if open_chapter:
        out.append("</section>")
    return "\n".join(out), toc


def render_notes(md: str) -> str:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    buf: list[str] = []
    in_list = False
    in_table = False
    table_rows: list[str] = []

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    def close_table() -> None:
        nonlocal in_table, table_rows
        if not in_table:
            return
        out.append('<table class="note-table">')
        for i, row in enumerate(table_rows):
            cells = [c.strip() for c in row.strip("|").split("|")]
            tag = "th" if i == 0 else "td"
            if i == 1 and all(re.fullmatch(r":?-{3,}:?", c or "") for c in cells):
                continue
            tds = "".join(f"<{tag}>{html.escape(c)}</{tag}>" for c in cells)
            out.append(f"<tr>{tds}</tr>")
        out.append("</table>")
        in_table = False
        table_rows = []

    def flush() -> None:
        text = "\n".join(buf).strip()
        buf.clear()
        if text:
            out.append(f"<p>{html.escape(text).replace(chr(10), '<br>')}</p>")

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("|"):
            close_list()
            flush()
            in_table = True
            table_rows.append(line)
            continue
        if in_table:
            close_table()
        if line.startswith("# "):
            close_list()
            flush()
            out.append(f"<h2>{html.escape(line[2:].strip())}</h2>")
            continue
        if line.startswith("## "):
            close_list()
            flush()
            out.append(f"<h3>{html.escape(line[3:].strip())}</h3>")
            continue
        if line.startswith("- "):
            flush()
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{html.escape(line[2:].strip())}</li>")
            continue
        if not line.strip():
            close_list()
            flush()
            continue
        close_list()
        buf.append(line)
    close_list()
    close_table()
    flush()
    return "\n".join(out)


def build() -> str:
    volume_html = []
    toc_html = []
    for vol in VOLUMES:
        md = (ROOT / vol["file"]).read_text(encoding="utf-8")
        body, toc = render_markdown_body(md, vol["id"])
        items = []
        for item in toc:
            label = f'<span class="toc-label">{html.escape(item["label"])}</span>' if item["label"] else ""
            klass = ' class="has-label"' if item["label"] else ""
            items.append(
                f'<a{klass} href="#{html.escape(item["id"])}">{label}'
                f'<span>{html.escape(item["title"])}</span></a>'
            )
        toc_html.append(
            f'''<section class="toc-vol">
              <h3><span>{html.escape(vol["label"])}</span>{html.escape(vol["title"])}</h3>
              <p class="toc-blurb">{html.escape(vol["blurb"])}</p>
              <div class="toc-links">{"".join(items)}</div>
            </section>'''
        )
        volume_html.append(
            f'''<article class="volume" id="{vol["id"]}" data-volume="{vol["id"]}">
              <header class="volume-open">
                <p class="volume-label">{html.escape(vol["label"])}</p>
                <h1>{html.escape(vol["title"])}</h1>
                <p class="volume-rule" aria-hidden="true"></p>
              </header>
              {body}
            </article>'''
        )

    notes = render_notes((ROOT / "00_凡例.md").read_text(encoding="utf-8"))
    return TEMPLATE.replace("%%TOC%%", "\n".join(toc_html)).replace(
        "%%VOLUMES%%", "\n".join(volume_html)
    ).replace("%%NOTES%%", notes)


TEMPLATE = r"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Reversi Destiny ～黒白の運命～</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Shippori+Mincho:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --paper: #f4ead6;
      --paper-edge: #e7d9bc;
      --ink: #2a241c;
      --ink-soft: #5b5146;
      --rule: #c9b89a;
      --accent: #1c1c1c;
      --stone-w: #f7f3ea;
      --stone-b: #161616;
      --shadow: rgba(40, 28, 12, 0.12);
      --header-h: 3.4rem;
      --toc-w: 18rem;
      --measure: 40em;
      --fs: 18px;
      --lh: 2.18;
      --tap: 44px;
    }
    html[data-theme="white"] {
      --paper: #fbfaf6;
      --paper-edge: #ece8dc;
      --ink: #222;
      --ink-soft: #666;
      --rule: #ddd6c8;
    }
    html[data-theme="night"] {
      --paper: #161412;
      --paper-edge: #24201c;
      --ink: #e8dfd0;
      --ink-soft: #b3a792;
      --rule: #3a342c;
      --shadow: rgba(0, 0, 0, 0.4);
      --stone-w: #efe7d6;
      --stone-b: #0c0c0c;
    }
    * { box-sizing: border-box; }
    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    html, body {
      margin: 0;
      min-height: 100%;
      background: var(--paper);
      color: var(--ink);
      scroll-padding-top: calc(var(--header-h) + 0.6rem);
    }
    html.toc-open, html.sheet-open { overflow: hidden; }
    body {
      font-family: "Noto Serif JP", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", serif;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    button, a { font: inherit; color: inherit; }
    button {
      background: none;
      border: 0;
      cursor: pointer;
      padding: 0;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    /* Cover */
    .cover {
      min-height: 100vh;
      min-height: 100dvh;
      background:
        radial-gradient(circle at 50% 42%, rgba(255,255,255,0.05), transparent 28%),
        linear-gradient(#0d0d0d, #161616 55%, #0a0a0a);
      color: #f4ead6;
      display: grid;
      place-items: center;
      padding: max(2rem, env(safe-area-inset-top)) 1.2rem max(2.4rem, env(safe-area-inset-bottom));
      position: relative;
      overflow: hidden;
    }
    .cover::before {
      content: "";
      position: absolute;
      inset: 8% 10%;
      background-image:
        linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: radial-gradient(circle at 50% 40%, #000 20%, transparent 72%);
      pointer-events: none;
    }
    .cover-inner {
      position: relative;
      max-width: 28rem;
      text-align: center;
    }
    .stones {
      width: 7.4rem;
      height: 4.6rem;
      margin: 0 auto 1.8rem;
      position: relative;
    }
    .stone {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 50%;
      position: absolute;
      top: 0.5rem;
      box-shadow: 0 10px 24px rgba(0,0,0,0.45);
    }
    .stone.b { left: 0.4rem; background: radial-gradient(circle at 35% 32%, #3a3a3a, #111 62%); }
    .stone.w { right: 0.4rem; background: radial-gradient(circle at 35% 32%, #fff, #e6e0d4 70%); }
    .cover-kicker {
      letter-spacing: 0.62em;
      font-size: 0.72rem;
      color: #cbbfa6;
      margin: 0 0 0.9rem 0.62em;
    }
    .cover h1 {
      font-family: "Shippori Mincho", "Noto Serif JP", serif;
      font-weight: 700;
      font-size: clamp(1.8rem, 6vw, 2.5rem);
      letter-spacing: 0.12em;
      margin: 0;
      line-height: 1.35;
    }
    .cover h1 small {
      display: block;
      margin-top: 0.45rem;
      font-size: 0.62em;
      letter-spacing: 0.28em;
      font-weight: 600;
    }
    .cover-rule {
      width: 4.5rem;
      height: 1px;
      background: #cbbfa6;
      margin: 1.5rem auto;
    }
    .cover-copy {
      margin: 0;
      color: #d9ccb3;
      letter-spacing: 0.18em;
      font-size: 0.92rem;
    }
    .cover-start {
      margin-top: 2.2rem;
      border: 1px solid #d9ccb3;
      padding: 0.85rem 1.8rem;
      min-height: var(--tap);
      min-width: 12rem;
      letter-spacing: 0.42em;
      font-size: 0.82rem;
      color: #f4ead6;
    }
    .cover-start:hover { background: #f4ead6; color: #111; }
    .cover-vols {
      margin: 2.4rem 0 0;
      padding: 0;
      list-style: none;
      text-align: left;
      color: #cfc3aa;
      font-size: 0.9rem;
      line-height: 1.9;
    }
    .cover-vols li { display: grid; grid-template-columns: 4.6em 1fr; gap: 0.6rem; letter-spacing: 0.08em; }
    .cover-vols span { color: #8f8676; }

    /* App chrome */
    .app { display: none; }
    html.is-reading .cover { display: none; }
    html.is-reading .app { display: block; }
    .icon-btn {
      min-width: var(--tap);
      min-height: var(--tap);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      letter-spacing: 0.08em;
      font-size: 0.78rem;
      color: var(--ink);
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      min-height: var(--header-h);
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0 0.55rem 0 0.8rem;
      padding-top: env(safe-area-inset-top);
      background: var(--paper);
      background: color-mix(in srgb, var(--paper) 92%, transparent);
      border-bottom: 1px solid var(--rule);
      backdrop-filter: blur(10px);
    }
    .brand {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }
    .brand strong {
      font-family: "Shippori Mincho", serif;
      font-size: 0.86rem;
      letter-spacing: 0.12em;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand small {
      color: var(--ink-soft);
      font-size: 0.68rem;
      letter-spacing: 0.14em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tools {
      display: flex;
      gap: 0.15rem;
      align-items: center;
      flex-wrap: nowrap;
      flex-shrink: 0;
    }
    .tools button, .tools select, .sheet button, .sheet select {
      min-height: 2.1rem;
      padding: 0 0.55rem;
      border: 1px solid transparent;
      color: var(--ink-soft);
      letter-spacing: 0.06em;
      font-size: 0.74rem;
      border-radius: 999px;
      white-space: nowrap;
    }
    .tools button:hover, .tools select:hover { color: var(--ink); border-color: var(--rule); }
    .tools select, .sheet select { background: transparent; outline: none; }

    .toc-backdrop, .sheet-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(20, 16, 12, 0.4);
      z-index: 30;
    }
    html.toc-open .toc-backdrop,
    html.sheet-open .sheet-backdrop { display: block; }
    .toc {
      background: var(--paper);
      overflow: auto;
      padding: 1.1rem 1rem 2rem;
    }
    .toc-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      margin-bottom: 0.8rem;
    }
    .toc h2 {
      font-family: "Shippori Mincho", serif;
      font-size: 1rem;
      letter-spacing: 0.28em;
      margin: 0;
    }
    .toc-vol { margin: 0 0 1.3rem; }
    .toc-vol h3 {
      margin: 0;
      font-size: 0.95rem;
      letter-spacing: 0.08em;
    }
    .toc-vol h3 span {
      display: block;
      color: var(--ink-soft);
      font-size: 0.7rem;
      letter-spacing: 0.22em;
      font-weight: 500;
    }
    .toc-blurb { margin: 0.25rem 0 0.5rem; color: var(--ink-soft); font-size: 0.78rem; }
    .toc-links { display: grid; gap: 0.08rem; }
    .toc a {
      text-decoration: none;
      padding: 0.42rem 0.3rem;
      display: block;
      font-size: 0.84rem;
      line-height: 1.5;
      border-radius: 4px;
    }
    .toc a.has-label {
      display: grid;
      grid-template-columns: 4.6em 1fr;
      gap: 0.4rem;
      align-items: baseline;
    }
    .toc a:hover { background: color-mix(in srgb, var(--rule) 35%, transparent); }
    .toc-label { color: var(--ink-soft); letter-spacing: 0.08em; font-size: 0.74em; }
    .toc-foot { margin-top: 1.2rem; padding-top: 0.9rem; border-top: 1px solid var(--rule); }
    .toc-foot a { letter-spacing: 0.16em; }

    .reader-main { min-width: 0; }
    .page {
      max-width: var(--measure);
      margin: 0 auto;
      padding: 2.4rem 1.6rem 5rem;
      font-size: var(--fs);
      line-height: var(--lh);
      letter-spacing: 0.04em;
    }
    .chapter, .volume-open { scroll-margin-top: calc(var(--header-h) + 0.8rem); }
    .volume { padding-bottom: 2rem; }
    .volume + .volume { margin-top: 1.2rem; }
    .volume-open {
      text-align: center;
      padding: 3.4rem 0 2.8rem;
    }
    .volume-label {
      margin: 0;
      letter-spacing: 0.42em;
      color: var(--ink-soft);
      font-size: 0.78em;
      text-indent: 0.42em;
    }
    .volume-open h1 {
      font-family: "Shippori Mincho", serif;
      font-weight: 700;
      font-size: 1.85em;
      letter-spacing: 0.2em;
      margin: 0.7rem 0 0;
    }
    .volume-rule {
      width: 3.2rem;
      height: 1px;
      margin: 1.4rem auto 0;
      background: var(--rule);
    }
    .chapter { padding-top: 0.2rem; }
    .chapter-head {
      text-align: center;
      margin: 3em 0 2.1em;
    }
    .chapter-label {
      margin: 0;
      color: var(--ink-soft);
      letter-spacing: 0.38em;
      font-size: 0.78em;
      text-indent: 0.38em;
    }
    .chapter-head h2 {
      font-family: "Shippori Mincho", serif;
      font-weight: 700;
      font-size: 1.28em;
      letter-spacing: 0.16em;
      margin: 0.55rem 0 0;
      line-height: 1.5;
    }
    .subhead {
      font-family: "Shippori Mincho", serif;
      font-size: 1.02em;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-align: center;
      margin: 2.4em 0 1.3em;
    }
    .page p { margin: 0; text-indent: 1em; }
    .scene-break {
      text-align: center;
      text-indent: 0 !important;
      letter-spacing: 0.55em;
      color: var(--ink-soft);
      margin: 1.8em 0 !important;
    }
    .notes {
      display: none;
      max-width: var(--measure);
      margin: 0 auto;
      padding: 2.4rem 1.6rem 5rem;
      font-size: 0.95rem;
      line-height: 1.95;
    }
    html.show-notes .page { display: none; }
    html.show-notes .notes { display: block; }
    .notes h2, .notes h3 { font-family: "Shippori Mincho", serif; letter-spacing: 0.12em; }
    .notes ul { padding-left: 1.2em; }
    .note-table { width: 100%; border-collapse: collapse; font-size: 0.88em; margin: 1em 0 1.4em; }
    .note-table th, .note-table td {
      border-bottom: 1px solid var(--rule);
      text-align: left;
      padding: 0.45em 0.4em;
      vertical-align: top;
    }
    .pager {
      max-width: var(--measure);
      margin: 0 auto;
      padding: 0 1.6rem 3.5rem;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      color: var(--ink-soft);
      font-size: 0.85rem;
      letter-spacing: 0.12em;
    }
    .pager button {
      min-height: var(--tap);
      padding: 0 0.8rem;
    }
    .pager button:hover { color: var(--ink); }
    .sheet {
      display: none;
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      background: var(--paper);
      border-top: 1px solid var(--rule);
      padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
      box-shadow: 0 -12px 32px var(--shadow);
    }
    html.sheet-open .sheet { display: block; }
    html.sheet-open .pager { visibility: hidden; pointer-events: none; }
    .sheet-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      margin-bottom: 0.8rem;
    }
    .sheet h3 {
      margin: 0;
      font-family: "Shippori Mincho", serif;
      letter-spacing: 0.16em;
      font-size: 0.95rem;
    }
    .sheet-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-bottom: 0.7rem;
    }
    .sheet-row button, .sheet-row select {
      min-height: var(--tap);
      border: 1px solid var(--rule) !important;
      font-size: 1rem;
    }

    html[data-dir="vertical"] .page {
      max-width: none;
      writing-mode: vertical-rl;
      height: calc(100dvh - var(--header-h) - 1.5rem);
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2rem 3rem 2rem 2.2rem;
    }
    html[data-dir="vertical"] .volume-open,
    html[data-dir="vertical"] .chapter-head,
    html[data-dir="vertical"] .subhead,
    html[data-dir="vertical"] .scene-break { text-align: center; }
    html[data-dir="vertical"] .pager,
    html[data-dir="vertical"] .notes { display: none; }
    html[data-dir="vertical"].show-notes .notes {
      display: block;
      writing-mode: vertical-rl;
      height: calc(100dvh - var(--header-h) - 1.5rem);
      overflow-x: auto;
      max-width: none;
    }

    /* PC */
    @media (min-width: 860px) {
      .mobile-only { display: none !important; }
      html.is-reading .app {
        display: grid;
        grid-template-columns: var(--toc-w) minmax(0, 1fr);
        grid-template-rows: auto 1fr;
        min-height: 100dvh;
      }
      .topbar { grid-column: 1 / -1; }
      html.is-reading .toc {
        grid-column: 1;
        grid-row: 2;
        position: sticky;
        top: var(--header-h);
        height: calc(100dvh - var(--header-h));
        border-right: 1px solid var(--rule);
        background: color-mix(in srgb, var(--paper) 72%, var(--paper-edge));
      }
      .reader-main { grid-column: 2; grid-row: 2; }
      .toc-head .icon-btn { display: none; }
      .page, .notes { padding: 2.6rem 2rem 4.5rem; }
    }

    /* Phone */
    @media (max-width: 859.98px) {
      .pc-only { display: none !important; }
      :root { --fs: 17px; --lh: 1.95; --header-h: 3.15rem; }
      .cover-inner { max-width: 22rem; }
      .cover-start { width: min(16rem, 100%); }
      .cover-copy { letter-spacing: 0.1em; font-size: 0.86rem; }
      .cover-vols { font-size: 0.86rem; }
      .brand strong { font-size: 0.78rem; }
      .topbar { gap: 0.15rem; }
      .toc {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 40;
        width: min(22rem, 100vw);
        height: 100dvh;
        transform: translateX(-105%);
        transition: transform 0.22s ease;
        padding-top: max(1rem, env(safe-area-inset-top));
        background: color-mix(in srgb, var(--paper) 82%, var(--paper-edge));
        box-shadow: 12px 0 32px var(--shadow);
      }
      html.toc-open .toc { transform: none; }
      .toc a { min-height: 2.4rem; padding: 0.55rem 0.35rem; }
      .page, .notes {
        padding: 1.35rem 1.05rem calc(5.6rem + env(safe-area-inset-bottom));
        letter-spacing: 0.02em;
      }
      .volume-open { padding: 2.2rem 0 1.8rem; }
      .volume-open h1 { font-size: 1.5em; letter-spacing: 0.14em; }
      .chapter-head { margin: 2.2em 0 1.5em; }
      .chapter-head h2 { font-size: 1.16em; }
      .pager {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 15;
        max-width: none;
        margin: 0;
        background: var(--paper);
        border-top: 1px solid var(--rule);
        padding: 0.15rem 0.6rem calc(0.25rem + env(safe-area-inset-bottom));
      }
      html[data-dir="vertical"] .page {
        height: calc(100dvh - var(--header-h) - 4.2rem - env(safe-area-inset-bottom));
        padding: 1.2rem 1.6rem;
      }
      html[data-dir="vertical"] .pager { display: flex; }
    }
  </style>
</head>
<body>
  <section class="cover" id="cover">
    <div class="cover-inner">
      <div class="stones" aria-hidden="true">
        <span class="stone b"></span>
        <span class="stone w"></span>
      </div>
      <p class="cover-kicker">NOVEL</p>
      <h1>Reversi Destiny<small>～黒白の運命～</small></h1>
      <div class="cover-rule"></div>
      <p class="cover-copy">黒と白の、そのあいだを読む</p>
      <button class="cover-start" type="button" id="start">本編を開く</button>
      <ul class="cover-vols">
        <li><span>第一巻</span>終わった人間</li>
        <li><span>第二巻</span>骸の虚影</li>
        <li><span>第三巻</span>観測者の道</li>
        <li><span>第四巻</span>執行者の道</li>
      </ul>
    </div>
  </section>

  <div class="app" id="app">
    <header class="topbar">
      <button class="icon-btn mobile-only" type="button" id="toc-btn" aria-controls="toc" aria-label="目次を開く">目次</button>
      <div class="brand">
        <strong>Reversi Destiny</strong>
        <small id="now-reading">～黒白の運命～</small>
      </div>
      <div class="tools">
        <button class="pc-only" type="button" data-fs="-">A−</button>
        <button class="pc-only" type="button" data-fs="+">A＋</button>
        <button class="pc-only dir-btn" type="button">縦組</button>
        <select class="pc-only theme-sel" aria-label="紙面">
          <option value="ivory">生成り</option>
          <option value="white">白</option>
          <option value="night">夜</option>
        </select>
        <button class="pc-only cover-btn" type="button">表紙</button>
        <button class="icon-btn mobile-only" type="button" id="sheet-btn" aria-controls="sheet">設定</button>
      </div>
    </header>

    <div class="toc-backdrop" id="toc-backdrop"></div>
    <aside class="toc" id="toc" aria-label="目次">
      <div class="toc-head">
        <h2>目次</h2>
        <button class="icon-btn mobile-only" type="button" id="toc-close" aria-label="目次を閉じる">閉じる</button>
      </div>
      %%TOC%%
      <div class="toc-foot">
        <a href="#notes" id="notes-link">凡例</a>
      </div>
    </aside>

    <div class="reader-main">
      <main class="page" id="page">
        %%VOLUMES%%
      </main>
      <section class="notes" id="notes">
        %%NOTES%%
      </section>
      <nav class="pager">
        <button type="button" id="prev">前の章</button>
        <button type="button" id="next">次の章</button>
      </nav>
    </div>

    <div class="sheet-backdrop" id="sheet-backdrop"></div>
    <div class="sheet" id="sheet" role="dialog" aria-label="表示設定">
      <div class="sheet-head">
        <h3>表示</h3>
        <button class="icon-btn" type="button" id="sheet-close">閉じる</button>
      </div>
      <div class="sheet-row">
        <button type="button" data-fs="-">A−</button>
        <button type="button" data-fs="+">A＋</button>
        <button class="dir-btn" type="button">縦組</button>
        <select class="theme-sel" aria-label="紙面">
          <option value="ivory">生成り</option>
          <option value="white">白</option>
          <option value="night">夜</option>
        </select>
      </div>
      <div class="sheet-row">
        <button class="cover-btn" type="button">表紙に戻る</button>
      </div>
    </div>
  </div>

  <script>
    const root = document.documentElement;
    const mqPc = window.matchMedia("(min-width: 860px)");
    const defaultFs = mqPc.matches ? 18 : 17;
    const saved = JSON.parse(localStorage.getItem("rd-novel") || "{}");
    if (!saved.fs) saved.fs = defaultFs;

    const apply = () => {
      root.style.setProperty("--fs", saved.fs + "px");
      root.dataset.theme = saved.theme || "ivory";
      root.dataset.dir = saved.dir || "horizontal";
      document.querySelectorAll(".dir-btn").forEach((btn) => {
        btn.textContent = saved.dir === "vertical" ? "横組" : "縦組";
      });
      document.querySelectorAll(".theme-sel").forEach((sel) => {
        sel.value = saved.theme || "ivory";
      });
      localStorage.setItem("rd-novel", JSON.stringify(saved));
    };
    apply();

    const openApp = () => {
      root.classList.add("is-reading");
      root.classList.remove("show-notes");
    };
    const closeOverlays = () => {
      root.classList.remove("toc-open", "sheet-open");
    };
    document.getElementById("start").addEventListener("click", openApp);
    document.querySelectorAll(".cover-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.classList.remove("is-reading", "show-notes");
        closeOverlays();
        window.scrollTo(0, 0);
      });
    });

    const toc = document.getElementById("toc");
    const openToc = (v) => {
      root.classList.toggle("toc-open", v);
      if (v) root.classList.remove("sheet-open");
    };
    const openSheet = (v) => {
      root.classList.toggle("sheet-open", v);
      if (v) root.classList.remove("toc-open");
    };
    document.getElementById("toc-btn").addEventListener("click", () => openToc(!root.classList.contains("toc-open")));
    document.getElementById("toc-close").addEventListener("click", () => openToc(false));
    document.getElementById("toc-backdrop").addEventListener("click", () => openToc(false));
    document.getElementById("sheet-btn").addEventListener("click", () => openSheet(!root.classList.contains("sheet-open")));
    document.getElementById("sheet-close").addEventListener("click", () => openSheet(false));
    document.getElementById("sheet-backdrop").addEventListener("click", () => openSheet(false));
    mqPc.addEventListener("change", () => closeOverlays());
    toc.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", (e) => {
        if (a.id === "notes-link") {
          e.preventDefault();
          root.classList.add("show-notes");
          openToc(false);
          document.getElementById("now-reading").textContent = "凡例";
          window.scrollTo(0, 0);
          return;
        }
        root.classList.remove("show-notes");
        openToc(false);
        openApp();
      });
    });

    document.querySelectorAll("[data-fs]").forEach((btn) => {
      btn.addEventListener("click", () => {
        saved.fs = Math.min(24, Math.max(14, saved.fs + (btn.dataset.fs === "+" ? 1 : -1)));
        apply();
      });
    });
    document.querySelectorAll(".dir-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        saved.dir = saved.dir === "vertical" ? "horizontal" : "vertical";
        apply();
      });
    });
    document.querySelectorAll(".theme-sel").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        saved.theme = e.target.value;
        apply();
      });
    });

    const chapterEls = [...document.querySelectorAll(".chapter")];
    const goto = (delta) => {
      root.classList.remove("show-notes");
      closeOverlays();
      const y = window.scrollY + 80;
      let i = chapterEls.findIndex((el, idx) => {
        const next = chapterEls[idx + 1];
        return el.offsetTop <= y && (!next || next.offsetTop > y);
      });
      if (i < 0) i = 0;
      const target = chapterEls[i + delta];
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.getElementById("prev").addEventListener("click", () => goto(-1));
    document.getElementById("next").addEventListener("click", () => goto(1));

    const updateNow = () => {
      if (root.classList.contains("show-notes")) return;
      const y = window.scrollY + 120;
      let label = "～黒白の運命～";
      document.querySelectorAll(".volume").forEach((vol) => {
        if (vol.offsetTop <= y) {
          const h = vol.querySelector(".volume-open h1");
          const lab = vol.querySelector(".volume-label");
          if (h && lab) label = lab.textContent + "　" + h.textContent;
        }
      });
      document.querySelectorAll(".chapter").forEach((ch) => {
        if (ch.offsetTop <= y) {
          const t = ch.querySelector("h2");
          if (t) label = t.textContent;
        }
      });
      document.getElementById("now-reading").textContent = label;
    };
    window.addEventListener("scroll", updateNow, { passive: true });

    if (location.hash && location.hash !== "#cover") {
      openApp();
      if (location.hash === "#notes") root.classList.add("show-notes");
    }
  </script>
</body>
</html>
"""


if __name__ == "__main__":
    html_out = build()
    OUT.write_text(html_out, encoding="utf-8")
    print("wrote", OUT, OUT.stat().st_size)
