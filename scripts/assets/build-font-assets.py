#!/usr/bin/env python3
"""Build and verify full and runtime-corpus subset WOFF2 font assets."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any, Iterable

import brotli
import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "scripts" / "assets" / "font-sources"
OUTPUT_DIR = ROOT / "assets" / "fonts"
MANIFEST_PATH = OUTPUT_DIR / "font-build-manifest.json"
CSS_PATH = ROOT / "styles-base.css"
CSS_START_MARKER = "/* FONT_ASSETS_GENERATED_START */"
CSS_END_MARKER = "/* FONT_ASSETS_GENERATED_END */"
FALLBACK_PROBE = "丈"
SUBSET_BUILD_FINGERPRINT = "layout-all-hinting-full-names-v1"
FONT_CONFIGS = (
    ("cinzel-400", "CR-Cinzel", 400),
    ("cinzel-700", "CR-Cinzel", 700),
    ("cinzel-900", "CR-Cinzel", 900),
    ("shippori-mincho-400", "CR-Shippori Mincho", 400),
    ("shippori-mincho-700", "CR-Shippori Mincho", 700),
    ("shippori-mincho-800", "CR-Shippori Mincho", 800),
    ("kaisei-tokumin-400", "CR-Kaisei Tokumin", 400),
    ("kaisei-tokumin-700", "CR-Kaisei Tokumin", 700),
    ("kaisei-tokumin-800", "CR-Kaisei Tokumin", 800),
    ("zen-antique-soft-400", "CR-Zen Antique Soft", 400),
    ("yusei-magic-400", "CR-Yusei Magic", 400),
    ("rocknroll-one-400", "CR-RocknRoll One", 400),
)
CORPUS_DIRECTORIES = (
    "browser-vite",
    "cards",
    "constants",
    "game",
    "shared",
    "ui",
    "utils",
    "workers",
)
CORPUS_GENERATED_FILES = (
    "shared/observation-gacha-catalog.generated.js",
    "shared/gacha-hand-catalog.generated.js",
    "cards/catalog.generated.js",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def digest_text(values: Iterable[str]) -> str:
    digest = hashlib.sha256()
    for value in values:
        encoded = value.encode("utf-8")
        digest.update(len(encoded).to_bytes(8, "big"))
        digest.update(encoded)
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


def vertical_metrics(font: TTFont) -> dict[str, int]:
    os2 = font["OS/2"]
    hhea = font["hhea"]
    head = font["head"]
    return {
        "unitsPerEm": int(head.unitsPerEm),
        "hheaAscender": int(hhea.ascent),
        "hheaDescender": int(hhea.descent),
        "hheaLineGap": int(hhea.lineGap),
        "typoAscender": int(os2.sTypoAscender),
        "typoDescender": int(os2.sTypoDescender),
        "typoLineGap": int(os2.sTypoLineGap),
        "winAscent": int(os2.usWinAscent),
        "winDescent": int(os2.usWinDescent),
    }


def advance_width_digest(font: TTFont) -> str:
    cmap = font.getBestCmap() or {}
    metrics = font["hmtx"].metrics
    rows = []
    for codepoint, glyph_name in sorted(cmap.items()):
        advance, left_side_bearing = metrics[glyph_name]
        rows.append(f"{codepoint}:{advance}:{left_side_bearing}")
    return digest_text(rows)


def metadata(font: TTFont) -> dict[str, Any]:
    os2 = font["OS/2"]
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
        "codepointsSha256": digest_text(str(value) for value in sorted(cmap)),
        "advanceWidthsSha256": advance_width_digest(font),
        "metrics": vertical_metrics(font),
    }


def build_full_woff2(source: Path, output: Path) -> None:
    font = TTFont(source, recalcBBoxes=False, recalcTimestamp=False)
    try:
        font.flavor = "woff2"
        output.parent.mkdir(parents=True, exist_ok=True)
        font.save(output, reorderTables=False)
    finally:
        font.close()


def build_subset_woff2(source: Path, output: Path, codepoints: set[int]) -> None:
    font = TTFont(source, recalcBBoxes=False, recalcTimestamp=False)
    try:
        options = subset.Options()
        options.layout_features = ["*"]
        options.hinting = True
        options.recalc_timestamp = False
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.name_legacy = True
        options.notdef_glyph = True
        options.notdef_outline = True
        options.recommended_glyphs = True
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=sorted(codepoints))
        subsetter.subset(font)
        font.flavor = "woff2"
        output.parent.mkdir(parents=True, exist_ok=True)
        font.save(output, reorderTables=False)
    finally:
        font.close()


def font_snapshot(path: Path) -> tuple[dict[str, Any], set[int], dict[int, tuple[int, int]]]:
    font = TTFont(path, recalcBBoxes=False, recalcTimestamp=False)
    try:
        cmap = font.getBestCmap() or {}
        metrics = font["hmtx"].metrics
        widths = {
            codepoint: tuple(int(value) for value in metrics[glyph_name])
            for codepoint, glyph_name in cmap.items()
        }
        return metadata(font), set(cmap), widths
    finally:
        font.close()


def collect_corpus_sources() -> list[Path]:
    sources: set[Path] = {ROOT / "index.html"}
    sources.update(ROOT.glob("styles-*.css"))
    sources.update(ROOT.glob("*.ts"))
    for relative_dir in CORPUS_DIRECTORIES:
        directory = ROOT / relative_dir
        if not directory.is_dir():
            continue
        for path in directory.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in {".ts", ".json"}:
                continue
            if "__tests__" in path.parts:
                continue
            sources.add(path)
    for relative_path in CORPUS_GENERATED_FILES:
        path = ROOT / relative_path
        if path.is_file():
            sources.add(path)
    return sorted((path for path in sources if path.is_file()), key=lambda path: path.relative_to(ROOT).as_posix())


def collect_corpus() -> tuple[list[Path], set[int], str]:
    sources = collect_corpus_sources()
    codepoints: set[int] = set()
    for source in sources:
        content = source.read_bytes()
        text = content.decode("utf-8")
        codepoints.update(
            ord(character)
            for character in text
            if ord(character) >= 0x20 and not 0xD800 <= ord(character) <= 0xDFFF
        )
    probe_codepoint = ord(FALLBACK_PROBE)
    if probe_codepoint in codepoints:
        raise RuntimeError(
            f"fallback probe {FALLBACK_PROBE} U+{probe_codepoint:04X} entered the runtime corpus; choose a new explicit probe"
        )
    return sources, codepoints, digest_text(
        source.relative_to(ROOT).as_posix() for source in sources
    )


def unicode_ranges(codepoints: Iterable[int]) -> list[str]:
    values = sorted(set(codepoints))
    if not values:
        return []
    ranges: list[tuple[int, int]] = []
    start = values[0]
    end = start
    for value in values[1:]:
        if value == end + 1:
            end = value
            continue
        ranges.append((start, end))
        start = end = value
    ranges.append((start, end))
    return [
        f"U+{start:X}" if start == end else f"U+{start:X}-{end:X}"
        for start, end in ranges
    ]


def render_unicode_range(ranges: list[str], indent: str = "        ") -> list[str]:
    if not ranges:
        return [f"{indent}U+0"]
    lines = []
    for index in range(0, len(ranges), 8):
        chunk = ", ".join(ranges[index:index + 8])
        suffix = "," if index + 8 < len(ranges) else ""
        lines.append(f"{indent}{chunk}{suffix}")
    return lines


def render_font_face(family: str, weight: int, output: str, ranges: list[str]) -> list[str]:
    lines = [
        "@font-face {",
        f'    font-family: "{family}";',
        f'    src: url("{output}") format("woff2");',
        f"    font-weight: {weight};",
        "    font-style: normal;",
        "    font-display: swap;",
        "    unicode-range:",
        *render_unicode_range(ranges),
        "    ;",
        "}",
    ]
    return lines


def render_css_block(entries: list[dict[str, Any]]) -> str:
    lines = [CSS_START_MARKER, "/* Generated by scripts/assets/build-font-assets.py. Do not edit this block. */"]
    for entry in entries:
        lines.append("")
        lines.extend(render_font_face(
            f"{entry['cssFamily']} Subset",
            entry["weight"],
            f"assets/fonts/{Path(entry['subset']['output']).name}",
            entry["subset"]["unicodeRanges"],
        ))
        lines.append("")
        lines.extend(render_font_face(
            f"{entry['cssFamily']} Full",
            entry["weight"],
            f"assets/fonts/{Path(entry['full']['output']).name}",
            entry["full"]["unicodeRanges"],
        ))
    lines.extend(["", CSS_END_MARKER])
    return "\n".join(lines)


def replace_css_block(source: str, block: str) -> str:
    start = source.find(CSS_START_MARKER)
    end = source.find(CSS_END_MARKER)
    if start < 0 or end < start:
        raise RuntimeError("styles-base.css is missing the generated font asset markers")
    end += len(CSS_END_MARKER)
    return f"{source[:start]}{block}{source[end:]}"


def compare_font_assets(
    name: str,
    css_family: str,
    weight: int,
    source: Path,
    full_output: Path,
    subset_output: Path,
    corpus_codepoints: set[int],
) -> dict[str, Any]:
    if not full_output.is_file():
        raise RuntimeError(f"missing full WOFF2 output: {full_output.relative_to(ROOT)}")
    if not subset_output.is_file():
        raise RuntimeError(f"missing subset WOFF2 output: {subset_output.relative_to(ROOT)}")
    source_metadata, source_cmap, source_widths = font_snapshot(source)
    full_metadata, full_cmap, full_widths = font_snapshot(full_output)
    subset_metadata, subset_cmap, subset_widths = font_snapshot(subset_output)
    if source_metadata != full_metadata or source_cmap != full_cmap or source_widths != full_widths:
        raise RuntimeError(f"full WOFF2 metadata or coverage mismatch for {name}")
    required = source_cmap.intersection(corpus_codepoints)
    missing = required.difference(subset_cmap)
    unexpected = subset_cmap.difference(source_cmap)
    if missing or unexpected:
        raise RuntimeError(
            f"subset coverage mismatch for {name}: missing={len(missing)} unexpected={len(unexpected)}"
        )
    if source_metadata["metrics"] != subset_metadata["metrics"]:
        raise RuntimeError(f"subset vertical metrics mismatch for {name}")
    for codepoint in source_cmap.intersection(subset_cmap):
        if source_widths[codepoint] != subset_widths[codepoint]:
            raise RuntimeError(f"subset advance-width mismatch for {name} U+{codepoint:04X}")
    source_size = source.stat().st_size
    full_size = full_output.stat().st_size
    subset_size = subset_output.stat().st_size
    return {
        "name": name,
        "cssFamily": css_family,
        "weight": weight,
        "source": source.relative_to(ROOT).as_posix(),
        "sourceBytes": source_size,
        "sourceSha256": sha256(source),
        "sourceMetadata": source_metadata,
        "full": {
            "output": full_output.relative_to(ROOT).as_posix(),
            "bytes": full_size,
            "sha256": sha256(full_output),
            "codepointCount": len(full_cmap),
            "codepointsSha256": digest_text(str(value) for value in sorted(full_cmap)),
            "unicodeRanges": unicode_ranges(full_cmap),
            "fallbackProbeSupported": ord(FALLBACK_PROBE) in full_cmap,
        },
        "subset": {
            "output": subset_output.relative_to(ROOT).as_posix(),
            "bytes": subset_size,
            "sha256": sha256(subset_output),
            "codepointCount": len(subset_cmap),
            "codepointsSha256": digest_text(str(value) for value in sorted(subset_cmap)),
            "unicodeRanges": unicode_ranges(subset_cmap),
            "corpusSupportedCodepoints": len(required),
            "corpusMissingCodepoints": len(missing),
            "advanceWidthsSha256": subset_metadata["advanceWidthsSha256"],
            "metrics": subset_metadata["metrics"],
        },
        "savedBytesVsFull": full_size - subset_size,
    }


def expected_manifest(check_only: bool) -> tuple[dict[str, Any], str]:
    corpus_sources, corpus_codepoints, corpus_sha256 = collect_corpus()
    corpus_codepoints_sha256 = digest_text(str(value) for value in sorted(corpus_codepoints))
    previous_manifest: dict[str, Any] = {}
    if not check_only and MANIFEST_PATH.is_file():
        try:
            previous_manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            previous_manifest = {}
    previous_entries = {
        entry.get("name"): entry
        for entry in previous_manifest.get("fonts", [])
        if isinstance(entry, dict) and entry.get("name")
    }
    previous_corpus_digest = (
        previous_manifest.get("corpus", {}).get("codepointsSha256")
        if isinstance(previous_manifest.get("corpus"), dict)
        else None
    )
    entries: list[dict[str, Any]] = []
    for name, css_family, weight in FONT_CONFIGS:
        source = SOURCE_DIR / f"{name}.ttf"
        full_output = OUTPUT_DIR / f"{name}.woff2"
        subset_output = OUTPUT_DIR / f"{name}-subset.woff2"
        if not source.is_file():
            raise RuntimeError(f"missing canonical font source: {source.relative_to(ROOT)}")
        if not check_only:
            previous_entry = previous_entries.get(name, {})
            previous_full = previous_entry.get("full", {}) if isinstance(previous_entry, dict) else {}
            previous_subset = previous_entry.get("subset", {}) if isinstance(previous_entry, dict) else {}
            reusable = (
                previous_manifest.get("schemaVersion") == 2
                and previous_manifest.get("fontToolsVersion") == fontTools.__version__
                and previous_manifest.get("brotliVersion") == brotli.__version__
                and previous_manifest.get("subsetBuildFingerprint") == SUBSET_BUILD_FINGERPRINT
                and previous_corpus_digest == corpus_codepoints_sha256
                and previous_entry.get("sourceSha256") == sha256(source)
                and full_output.is_file()
                and subset_output.is_file()
                and previous_full.get("sha256") == sha256(full_output)
                and previous_subset.get("sha256") == sha256(subset_output)
            )
            if not reusable:
                build_full_woff2(source, full_output)
                build_subset_woff2(source, subset_output, corpus_codepoints)
        entries.append(compare_font_assets(
            name,
            css_family,
            weight,
            source,
            full_output,
            subset_output,
            corpus_codepoints,
        ))
    manifest = {
        "schemaVersion": 2,
        "format": "woff2",
        "coverage": "runtime-corpus-subset-with-full-fallback",
        "fontToolsVersion": fontTools.__version__,
        "brotliVersion": brotli.__version__,
        "subsetBuildFingerprint": SUBSET_BUILD_FINGERPRINT,
        "fallbackProbe": {
            "text": FALLBACK_PROBE,
            "codepoint": f"U+{ord(FALLBACK_PROBE):04X}",
        },
        "corpus": {
            "sources": [path.relative_to(ROOT).as_posix() for path in corpus_sources],
            "sourceCount": len(corpus_sources),
            "codepointCount": len(corpus_codepoints),
            "codepointsSha256": corpus_codepoints_sha256,
            "sourcesSha256": corpus_sha256,
            "unicodeRanges": unicode_ranges(corpus_codepoints),
        },
        "fonts": entries,
        "totals": {
            "sourceBytes": sum(entry["sourceBytes"] for entry in entries),
            "fullBytes": sum(entry["full"]["bytes"] for entry in entries),
            "subsetBytes": sum(entry["subset"]["bytes"] for entry in entries),
            "savedBytesVsFull": sum(entry["savedBytesVsFull"] for entry in entries),
        },
    }
    return manifest, render_css_block(entries)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify committed outputs without rewriting")
    args = parser.parse_args()
    manifest, css_block = expected_manifest(args.check)
    rendered_manifest = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    current_css = CSS_PATH.read_text(encoding="utf-8")
    expected_css = replace_css_block(current_css, css_block)
    if args.check:
        if not MANIFEST_PATH.is_file():
            raise RuntimeError(f"missing font manifest: {MANIFEST_PATH.relative_to(ROOT)}")
        if MANIFEST_PATH.read_text(encoding="utf-8") != rendered_manifest:
            raise RuntimeError("font-build-manifest.json is stale; run npm run assets:fonts:build")
        if current_css != expected_css:
            raise RuntimeError("styles-base.css font block is stale; run npm run assets:fonts:build")
    else:
        MANIFEST_PATH.write_text(rendered_manifest, encoding="utf-8", newline="\n")
        CSS_PATH.write_text(expected_css, encoding="utf-8", newline="\n")
    print(
        f"Verified {len(manifest['fonts'])} subset/full WOFF2 pairs; "
        f"saved {manifest['totals']['savedBytesVsFull']:,} bytes for the runtime corpus."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
