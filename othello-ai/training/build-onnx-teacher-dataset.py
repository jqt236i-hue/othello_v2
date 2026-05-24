#!/usr/bin/env python3
"""Build a compact ONNX teacher dataset from current Othello table models.

The output is JSONL so the first conversion step is inspectable and does not
require PyTorch. Training scripts can turn this into tensors/NPZ later.
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
from typing import Any


BOARD_SIZE = 8
POLICY_SCHEMA = "policy_table.v2"
VALUE_SCHEMA = "value_table.v1"
DATASET_SCHEMA = "othello_onnx_teacher_dataset.v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Othello ONNX teacher JSONL.")
    parser.add_argument("--policy-table", required=True, help="Champion policy-table JSON.")
    parser.add_argument("--value-table", required=True, help="Champion value-table JSON.")
    parser.add_argument(
        "--selfplay",
        action="append",
        default=[],
        help="Selfplay NDJSON file or glob. Repeatable.",
    )
    parser.add_argument("--out", required=True, help="Output JSONL path.")
    parser.add_argument("--summary-out", required=True, help="Output summary JSON path.")
    parser.add_argument("--max-records", type=int, default=0, help="Optional sample cap for preflight.")
    parser.add_argument("--min-legal-moves", type=int, default=1)
    return parser.parse_args()


def load_json(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} is not a JSON object")
    return payload


def expand_paths(patterns: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        if not matches and os.path.exists(pattern):
            matches = [pattern]
        for path in matches:
            full = os.path.abspath(path)
            if full in seen or not os.path.isfile(full):
                continue
            seen.add(full)
            out.append(full)
    return sorted(out)


def board_rows(board_key: str) -> list[list[str]] | None:
    rows = str(board_key or "").split("/")
    if len(rows) != BOARD_SIZE:
        return None
    out: list[list[str]] = []
    for row in rows:
        if len(row) != BOARD_SIZE:
            return None
        out.append(list(row))
    return out


def encode_board(rows: list[list[str]]) -> str:
    return "/".join("".join(row) for row in rows)


def transform_coord(row: int, col: int, transform_id: int) -> tuple[int, int]:
    size = BOARD_SIZE
    if transform_id == 0:
        return row, col
    if transform_id == 1:
        return col, size - 1 - row
    if transform_id == 2:
        return size - 1 - row, size - 1 - col
    if transform_id == 3:
        return size - 1 - col, row
    if transform_id == 4:
        return row, size - 1 - col
    if transform_id == 5:
        return size - 1 - col, size - 1 - row
    if transform_id == 6:
        return size - 1 - row, col
    if transform_id == 7:
        return col, row
    return row, col


def transform_board(rows: list[list[str]], transform_id: int) -> list[list[str]]:
    out = [["." for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
    for row in range(BOARD_SIZE):
        for col in range(BOARD_SIZE):
            mapped_row, mapped_col = transform_coord(row, col, transform_id)
            out[mapped_row][mapped_col] = rows[row][col]
    return out


def canonicalize(board_key: str) -> tuple[str, int] | None:
    rows = board_rows(board_key)
    if rows is None:
        return None
    best_key = ""
    best_transform = 0
    for transform_id in range(8):
        encoded = encode_board(transform_board(rows, transform_id))
        if not best_key or encoded < best_key:
            best_key = encoded
            best_transform = transform_id
    return best_key, best_transform


def inverse_transform_coord(row: int, col: int, transform_id: int) -> tuple[int, int]:
    for original_row in range(BOARD_SIZE):
        for original_col in range(BOARD_SIZE):
            mapped = transform_coord(original_row, original_col, transform_id)
            if mapped == (row, col):
                return original_row, original_col
    return row, col


def parse_place_action(action: Any) -> tuple[int, int] | None:
    if not isinstance(action, str):
        return None
    parts = action.split(":")
    if len(parts) != 3 or parts[0] != "place":
        return None
    try:
        row = int(parts[1])
        col = int(parts[2])
    except ValueError:
        return None
    if 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE:
        return row, col
    return None


def to_action_index(row: int, col: int) -> int:
    return row * BOARD_SIZE + col


def lookup_policy_target(
    policy_model: dict[str, Any],
    player: str,
    board_key: str,
    legal_moves: int,
) -> tuple[int | None, str]:
    canonical = canonicalize(board_key)
    if canonical is None:
        return None, "invalid_board"
    canonical_key, transform_id = canonical
    state_key = f"{player}|{canonical_key}|-|{legal_moves}"
    state = policy_model.get("states", {}).get(state_key)
    action = parse_place_action(state.get("bestAction") if isinstance(state, dict) else None)
    if action is None:
        return None, "selfplay"
    original_row, original_col = inverse_transform_coord(action[0], action[1], transform_id)
    return to_action_index(original_row, original_col), "policy_table"


def count_chars(board_key: str, char: str) -> int:
    return board_key.count(char)


def disc_diff(board_key: str, player: str) -> int:
    black = count_chars(board_key, "B")
    white = count_chars(board_key, "W")
    return (black - white) if player == "black" else (white - black)


def corner_diff(board_key: str, player: str) -> int:
    rows = board_rows(board_key)
    if rows is None:
        return 0
    own = "B" if player == "black" else "W"
    opp = "W" if own == "B" else "B"
    corners = [rows[0][0], rows[0][7], rows[7][0], rows[7][7]]
    return sum(1 for c in corners if c == own) - sum(1 for c in corners if c == opp)


def bucket(value: int, steps: list[int]) -> str:
    for step in steps:
        if value <= step:
            return str(step)
    return f">{steps[-1]}"


def value_keys(player: str, board_key: str, legal_moves: int) -> tuple[str, str] | None:
    canonical = canonicalize(board_key)
    if canonical is None:
        return None
    canonical_key, _ = canonical
    exact = f"{player}|{canonical_key}|legal:{legal_moves}"
    empties = count_chars(canonical_key, ".")
    phase = "opening" if empties >= 44 else ("mid" if empties >= 16 else "end")
    abstract = (
        f"{player}|-|{phase}|mob:{bucket(legal_moves, [0, 2, 4, 6, 10, 20])}"
        f"|disc:{bucket(disc_diff(canonical_key, player), [-20, -10, -4, 0, 4, 10, 20])}"
        f"|corner:{bucket(corner_diff(canonical_key, player), [-4, -2, -1, 0, 1, 2, 4])}"
    )
    return exact, abstract


def lookup_value_target(
    value_model: dict[str, Any],
    player: str,
    board_key: str,
    legal_moves: int,
    fallback: Any,
) -> tuple[float, str]:
    keys = value_keys(player, board_key, legal_moves)
    if keys is not None:
        exact, abstract = keys
        state = value_model.get("states", {}).get(exact)
        if isinstance(state, dict) and math.isfinite(float(state.get("avgValue", float("nan")))):
            return max(-1.0, min(1.0, float(state["avgValue"]))), "value_table_exact"
        state = value_model.get("abstractStates", {}).get(abstract)
        if isinstance(state, dict) and math.isfinite(float(state.get("avgValue", float("nan")))):
            return max(-1.0, min(1.0, float(state["avgValue"]))), "value_table_abstract"
    try:
        value = float(fallback)
        if math.isfinite(value):
            return max(-1.0, min(1.0, value)), "selfplay"
    except (TypeError, ValueError):
        pass
    return 0.0, "default"


def write_summary(path: str, summary: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> int:
    args = parse_args()
    policy_model = load_json(args.policy_table)
    value_model = load_json(args.value_table)
    if policy_model.get("schemaVersion") != POLICY_SCHEMA:
        raise ValueError(f"policy table must be {POLICY_SCHEMA}")
    if value_model.get("schemaVersion") != VALUE_SCHEMA:
        raise ValueError(f"value table must be {VALUE_SCHEMA}")

    selfplay_paths = expand_paths(args.selfplay)
    if not selfplay_paths:
        raise ValueError("no selfplay inputs matched")

    stats = {
        "recordsRead": 0,
        "recordsWritten": 0,
        "recordsSkipped": 0,
        "policyTableTargets": 0,
        "selfplayTargets": 0,
        "valueTableExactTargets": 0,
        "valueTableAbstractTargets": 0,
        "selfplayValueTargets": 0,
        "defaultValueTargets": 0,
        "blackSamples": 0,
        "whiteSamples": 0,
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as out:
        for path in selfplay_paths:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    if args.max_records and stats["recordsWritten"] >= args.max_records:
                        break
                    line = line.strip()
                    if not line:
                        continue
                    stats["recordsRead"] += 1
                    try:
                        record = json.loads(line)
                    except json.JSONDecodeError:
                        stats["recordsSkipped"] += 1
                        continue
                    board_key = record.get("board")
                    player = "white" if record.get("player") == "white" else "black"
                    legal_moves = int(record.get("legalMoves") or 0)
                    row = record.get("row")
                    col = record.get("col")
                    if (
                        not isinstance(board_key, str)
                        or legal_moves < args.min_legal_moves
                        or not isinstance(row, int)
                        or not isinstance(col, int)
                        or not (0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE)
                    ):
                        stats["recordsSkipped"] += 1
                        continue

                    policy_target, policy_source = lookup_policy_target(
                        policy_model, player, board_key, legal_moves
                    )
                    if policy_target is None:
                        policy_target = to_action_index(row, col)
                    if policy_source == "policy_table":
                        stats["policyTableTargets"] += 1
                    else:
                        stats["selfplayTargets"] += 1

                    value_target, value_source = lookup_value_target(
                        value_model, player, board_key, legal_moves, record.get("bestValue", record.get("outcome"))
                    )
                    if value_source == "value_table_exact":
                        stats["valueTableExactTargets"] += 1
                    elif value_source == "value_table_abstract":
                        stats["valueTableAbstractTargets"] += 1
                    elif value_source == "selfplay":
                        stats["selfplayValueTargets"] += 1
                    else:
                        stats["defaultValueTargets"] += 1

                    sample = {
                        "schemaVersion": DATASET_SCHEMA,
                        "board": board_key,
                        "player": player,
                        "legalMoves": legal_moves,
                        "policyTarget": policy_target,
                        "policySource": policy_source,
                        "valueTarget": value_target,
                        "valueSource": value_source,
                        "phase": record.get("phase") or "",
                        "gameIndex": record.get("gameIndex"),
                        "ply": record.get("ply"),
                        "sourcePath": os.path.basename(path),
                    }
                    out.write(json.dumps(sample, separators=(",", ":"), ensure_ascii=False) + "\n")
                    stats["recordsWritten"] += 1
                    stats["whiteSamples" if player == "white" else "blackSamples"] += 1
                if args.max_records and stats["recordsWritten"] >= args.max_records:
                    break

    summary = {
        "schemaVersion": "othello_onnx_teacher_dataset_summary.v1",
        "policyTable": os.path.abspath(args.policy_table),
        "valueTable": os.path.abspath(args.value_table),
        "selfplayInputs": selfplay_paths,
        "output": os.path.abspath(args.out),
        "stats": stats,
    }
    write_summary(args.summary_out, summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
