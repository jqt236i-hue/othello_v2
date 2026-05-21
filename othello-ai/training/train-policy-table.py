#!/usr/bin/env python3
"""Train the pure Reversi browser policy table from self-play NDJSON."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
from collections import defaultdict


MODEL_SCHEMA_VERSION = "policy_table.v2"
NORMALIZATION = "dihedral8_minlex"


def iter_ndjson(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def decode_board(board: str) -> list[list[str]]:
    return [list(row) for row in str(board or "").split("/") if row]


def encode_board(board: list[list[str]]) -> str:
    return "/".join("".join(row) for row in board)


def transform_coord(row: int, col: int, size: int, transform_id: int) -> tuple[int, int]:
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


def transform_board(board: list[list[str]], transform_id: int) -> list[list[str]]:
    size = len(board)
    out = [["." for _ in range(size)] for _ in range(size)]
    for row in range(size):
        for col in range(size):
            mapped_row, mapped_col = transform_coord(row, col, size, transform_id)
            out[mapped_row][mapped_col] = board[row][col]
    return out


def canonicalize_board(board: str) -> tuple[str, int]:
    parsed = decode_board(board)
    if not parsed:
        return "", 0
    best_key = ""
    best_transform = 0
    for transform_id in range(8):
        encoded = encode_board(transform_board(parsed, transform_id))
        if not best_key or encoded < best_key:
            best_key = encoded
            best_transform = transform_id
    return best_key, best_transform


def to_bucket(value: float, steps: list[int]) -> str:
    for step in steps:
        if value <= step:
            return str(step)
    return f">{steps[-1]}"


def count_disc_diff(board_key: str, player: str) -> int:
    black = board_key.count("B")
    white = board_key.count("W")
    return black - white if player == "black" else white - black


def count_corners(board_key: str, player: str) -> int:
    rows = [row for row in board_key.split("/") if row]
    if not rows:
        return 0
    own = "B" if player == "black" else "W"
    opp = "W" if own == "B" else "B"
    size = len(rows)
    corners = [rows[0][0], rows[0][size - 1], rows[size - 1][0], rows[size - 1][size - 1]]
    return sum(1 for c in corners if c == own) - sum(1 for c in corners if c == opp)


def cell_type(row: int, col: int, size: int = 8) -> str:
    if (row == 0 or row == size - 1) and (col == 0 or col == size - 1):
        return "corner"
    if (row == 1 or row == size - 2) and (col == 1 or col == size - 2):
        return "x"
    if ((row == 0 or row == size - 1) and (col == 1 or col == size - 2)) or (
        (col == 0 or col == size - 1) and (row == 1 or row == size - 2)
    ):
        return "c"
    if row == 0 or row == size - 1 or col == 0 or col == size - 1:
        return "edge"
    return "inner"


def positional_value(row: int, col: int) -> float:
    return {
        "corner": 1.0,
        "edge": 0.35,
        "inner": 0.0,
        "c": -0.35,
        "x": -0.75,
    }.get(cell_type(row, col), 0.0)


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def training_target(rec: dict, outcome_weight: float, search_weight: float, positional_weight: float) -> float:
    outcome = float(rec.get("outcome", 0.0) or 0.0)
    search = rec.get("searchValue", rec.get("bestValue", None))
    search_value = float(search) if search is not None else outcome
    row = int(rec.get("row", -1))
    col = int(rec.get("col", -1))
    positional = positional_value(row, col) if row >= 0 and col >= 0 else 0.0
    total = max(1e-9, abs(outcome_weight) + abs(search_weight) + abs(positional_weight))
    return clamp(((outcome * outcome_weight) + (search_value * search_weight) + (positional * positional_weight)) / total, -1.0, 1.0)


def make_abstract_state_key(player: str, board_key: str, legal_moves: int) -> str:
    empties = board_key.count(".")
    phase = "opening" if empties >= 44 else ("mid" if empties >= 16 else "end")
    mobility = to_bucket(legal_moves, [0, 2, 4, 6, 10, 20])
    disc = to_bucket(count_disc_diff(board_key, player), [-20, -10, -4, 0, 4, 10, 20])
    corner = to_bucket(count_corners(board_key, player), [-4, -2, -1, 0, 1, 2, 4])
    return f"{player}|-|{phase}|mob:{mobility}|disc:{disc}|corner:{corner}"


def train(args: argparse.Namespace) -> dict:
    table: dict[str, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"visits": 0.0, "sum": 0.0}))
    abstract_table: dict[str, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"visits": 0.0, "sum": 0.0}))
    stats = {
        "recordsRead": 0,
        "recordsSkipped": 0,
        "blackRecords": 0,
        "whiteRecords": 0,
        "weightedRecords": 0.0,
    }
    for rec in iter_ndjson(args.input):
        stats["recordsRead"] += 1
        try:
            player = "white" if rec.get("player") == "white" else "black"
            row = int(rec.get("row"))
            col = int(rec.get("col"))
            legal_moves = int(rec.get("legalMoves", 0) or 0)
            board_key, transform_id = canonicalize_board(str(rec.get("board", "")))
            if not board_key:
                raise ValueError("missing board")
        except Exception:
            stats["recordsSkipped"] += 1
            continue
        weight = float(args.white_sample_weight if player == "white" else args.black_sample_weight)
        target = training_target(rec, args.outcome_weight, args.search_weight, args.positional_weight)
        mapped_row, mapped_col = transform_coord(row, col, 8, transform_id)
        state_key = f"{player}|{board_key}|-|{legal_moves}"
        action_key = f"place:{mapped_row}:{mapped_col}"
        abstract_key = make_abstract_state_key(player, board_key, legal_moves)
        abstract_action_key = f"place_cat:{cell_type(row, col)}"
        for target_table, key, action in ((table, state_key, action_key), (abstract_table, abstract_key, abstract_action_key)):
            stat = target_table[key][action]
            stat["visits"] += weight
            stat["sum"] += target * weight
        stats["weightedRecords"] += weight
        stats["whiteRecords" if player == "white" else "blackRecords"] += 1

    def materialize(src: dict[str, dict[str, dict[str, float]]]) -> tuple[dict, int]:
        out = {}
        for key, actions in src.items():
            total_visits = sum(one["visits"] for one in actions.values())
            if total_visits < args.min_visits:
                continue
            best_action = max(actions.items(), key=lambda item: (item[1]["sum"] / max(1e-9, item[1]["visits"]), item[1]["visits"]))[0]
            best = actions[best_action]
            out[key] = {
                "visits": total_visits,
                "bestAction": best_action,
                "bestActionVisits": best["visits"],
                "bestActionAvgOutcome": best["sum"] / max(1e-9, best["visits"]),
                "actions": {
                    action: {
                        "visits": stat["visits"],
                        "avgOutcome": stat["sum"] / max(1e-9, stat["visits"]),
                    }
                    for action, stat in actions.items()
                },
            }
        return out, len(out)

    states, kept_states = materialize(table)
    abstract_states, kept_abstract_states = materialize(abstract_table)
    stats.update({
        "statesRaw": len(table),
        "statesKept": kept_states,
        "abstractStatesRaw": len(abstract_table),
        "abstractStatesKept": kept_abstract_states,
        "minVisits": args.min_visits,
        "outcomeWeight": args.outcome_weight,
        "searchWeight": args.search_weight,
        "positionalWeight": args.positional_weight,
        "blackSampleWeight": args.black_sample_weight,
        "whiteSampleWeight": args.white_sample_weight,
    })
    return {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "normalization": NORMALIZATION,
        "createdAt": dt.datetime.utcnow().isoformat() + "Z",
        "stats": stats,
        "states": states,
        "abstractStates": abstract_states,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--model-out", required=True)
    parser.add_argument("--min-visits", type=int, default=2)
    parser.add_argument("--outcome-weight", type=float, default=0.3)
    parser.add_argument("--search-weight", type=float, default=0.7)
    parser.add_argument("--positional-weight", type=float, default=0.05)
    parser.add_argument("--black-sample-weight", type=float, default=1.0)
    parser.add_argument("--white-sample-weight", type=float, default=1.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    model = train(args)
    os.makedirs(os.path.dirname(os.path.abspath(args.model_out)), exist_ok=True)
    with open(args.model_out, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)
    s = model["stats"]
    print(f"[othello-policy-train] records={s['recordsRead']} states={s['statesKept']} abstract={s['abstractStatesKept']} out={args.model_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
