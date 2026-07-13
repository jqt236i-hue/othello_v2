#!/usr/bin/env python3
"""Build and verify full-coverage WOFF2 files from the canonical TTF sources."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import brotli
import fontTools
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "scripts" / "assets" / "font-sources"
OUTPUT_DIR = ROOT / "assets" / "fonts"
MANIFEST_PATH = OUTPUT_DIR / "font-build-manifest.json"
FONT_NAMES = (
    "cinzel-400",
    "cinzel-700",
    "cinzel-900",
    "shippori-mincho-400",
    "shippori-mincho-700",
    "shippori-mincho-800",
    "kaisei-tokumin-400",
    "kaisei-tokumin-700",
    "kaisei-tokumin-800",
    "zen-antique-soft-400",
    "yusei-magic-400",
    "rocknroll-one-400",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def name_value(font: TTFont, name_id: int) -> str:
    values: list[str] = []
    for record in font["name"].names:
        if record.nameID != name_id:
            continue
        try:
            value = record.toUnicode().strip()
        except Exception:
            continue
        if value and value not in values:
            values.append(value)
    return " | ".join(values)


def metadata(font: TTFont) -> dict[str, Any]:
    os2 = font["OS/2"]
    hhea = font["hhea"]
    head = font["head"]
    post = font["post"]
    cmap = font.getBestCmap() or {}
    return {
        "family": name_value(font, 1),
        "subfamily": name_value(font, 2),
        "fullName": name_value(font, 4),
        "weightClass": int(os2.usWeightClass),
        "widthClass": int(os2.usWidthClass),
        "fsSelection": int(os2.fsSelection),
        "macStyle": int(head.macStyle),
        "italicAngle": float(post.italicAngle),
        "glyphCount": len(font.getGlyphOrder()),
        "codepointCount": len(cmap),
        "codepointsSha256": hashlib.sha256(
            ",".join(str(value) for value in sorted(cmap)).encode("ascii")
        ).hexdigest(),
        "glyphOrderSha256": hashlib.sha256(
            "\n".join(font.getGlyphOrder()).encode("utf-8")
        ).hexdigest(),
        "metrics": {
            "hheaAscender": int(hhea.ascent),
            "hheaDescender": int(hhea.descent),
            "hheaLineGap": int(hhea.lineGap),
            "typoAscender": int(os2.sTypoAscender),
            "typoDescender": int(os2.sTypoDescender),
            "typoLineGap": int(os2.sTypoLineGap),
            "winAscent": int(os2.usWinAscent),
            "winDescent": int(os2.usWinDescent),
        },
    }


def build_woff2(source: Path, output: Path) -> None:
    font = TTFont(source, recalcBBoxes=False, recalcTimestamp=False)
    try:
        font.flavor = "woff2"
        output.parent.mkdir(parents=True, exist_ok=True)
        font.save(output, reorderTables=False)
    finally:
        font.close()


def compare_source_and_output(source: Path, output: Path) -> dict[str, Any]:
    if not output.is_file():
        raise RuntimeError(f"missing WOFF2 output: {output.relative_to(ROOT)}")
    source_font = TTFont(source, recalcBBoxes=False, recalcTimestamp=False)
    output_font = TTFont(output, recalcBBoxes=False, recalcTimestamp=False)
    try:
        source_metadata = metadata(source_font)
        output_metadata = metadata(output_font)
    finally:
        source_font.close()
        output_font.close()
    if source_metadata != output_metadata:
        raise RuntimeError(
            f"font metadata mismatch for {source.name}:\n"
            + json.dumps(
                {"source": source_metadata, "output": output_metadata},
                ensure_ascii=False,
                indent=2,
            )
        )
    source_size = source.stat().st_size
    output_size = output.stat().st_size
    return {
        "source": source.relative_to(ROOT).as_posix(),
        "output": output.relative_to(ROOT).as_posix(),
        "sourceBytes": source_size,
        "outputBytes": output_size,
        "savedBytes": source_size - output_size,
        "sourceSha256": sha256(source),
        "outputSha256": sha256(output),
        **source_metadata,
    }


def expected_manifest(check_only: bool) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    for name in FONT_NAMES:
        source = SOURCE_DIR / f"{name}.ttf"
        output = OUTPUT_DIR / f"{name}.woff2"
        if not source.is_file():
            raise RuntimeError(f"missing canonical font source: {source.relative_to(ROOT)}")
        if not check_only:
            build_woff2(source, output)
        entries.append(compare_source_and_output(source, output))
    return {
        "schemaVersion": 1,
        "format": "woff2",
        "coverage": "full",
        "fontToolsVersion": fontTools.__version__,
        "brotliVersion": brotli.__version__,
        "fonts": entries,
        "totals": {
            "sourceBytes": sum(entry["sourceBytes"] for entry in entries),
            "outputBytes": sum(entry["outputBytes"] for entry in entries),
            "savedBytes": sum(entry["savedBytes"] for entry in entries),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify committed outputs without rewriting")
    args = parser.parse_args()
    manifest = expected_manifest(args.check)
    rendered = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not MANIFEST_PATH.is_file():
            raise RuntimeError(f"missing font manifest: {MANIFEST_PATH.relative_to(ROOT)}")
        if MANIFEST_PATH.read_text(encoding="utf-8") != rendered:
            raise RuntimeError("font-build-manifest.json is stale; run npm run assets:fonts:build")
    else:
        MANIFEST_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    print(
        f"Verified {len(manifest['fonts'])} full WOFF2 files; "
        f"saved {manifest['totals']['savedBytes']:,} bytes."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
