#!/usr/bin/env python3
"""Build a simple policy table from self-play NDJSON."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from dataclasses import dataclass
from typing import Dict, Iterable, Tuple


MODEL_SCHEMA_VERSION = "policy_table.v2"
NORMALIZATION = "dihedral8_minlex"


@dataclass
class ActionStat:
    visits: int = 0
    outcome_sum: float = 0.0

    def add(self, outcome: float) -> None:
        self.visits += 1
        self.outcome_sum += float(outcome)

    @property
    def avg_outcome(self) -> float:
        if self.visits <= 0:
            return 0.0
        return self.outcome_sum / self.visits


def decode_board(board_str: str) -> list[list[str]]:
    if not board_str:
        return []
    rows = board_str.split("/")
    return [list(r) for r in rows]


def encode_board(board: list[list[str]]) -> str:
    return "/".join("".join(row) for row in board)


def transform_coord(row: int, col: int, size: int, t: int) -> tuple[int, int]:
    if t == 0:
        return row, col
    if t == 1:
        return col, size - 1 - row
    if t == 2:
        return size - 1 - row, size - 1 - col
    if t == 3:
        return size - 1 - col, row
    if t == 4:
        return row, size - 1 - col
    if t == 5:
        return size - 1 - col, size - 1 - row
    if t == 6:
        return size - 1 - row, col
    if t == 7:
        return col, row
    return row, col


def transform_board(board: list[list[str]], t: int) -> list[list[str]]:
    if not board:
        return []
    size = len(board)
    out = [["." for _ in range(size)] for _ in range(size)]
    for r in range(size):
        for c in range(size):
            nr, nc = transform_coord(r, c, size, t)
            out[nr][nc] = board[r][c]
    return out


def canonicalize_board(board_str: str) -> tuple[str, int]:
    board = decode_board(board_str)
    if not board:
        return board_str, 0
    best = None
    best_t = 0
    for t in range(8):
        transformed = encode_board(transform_board(board, t))
        if best is None or transformed < best:
            best = transformed
            best_t = t
    return best or board_str, best_t


def build_state_key(rec: dict) -> tuple[str, int]:
    player = rec.get("player", "?")
    board = rec.get("board", "")
    pending = rec.get("pendingType") or "-"
    legal_moves = rec.get("legalMoves", 0)
    canonical_board, transform_id = canonicalize_board(board)
    return f"{player}|{canonical_board}|{pending}|{legal_moves}", transform_id


def build_action_key(rec: dict, transform_id: int = 0) -> str:
    action_type = rec.get("actionType") or "unknown"
    if action_type == "place":
        row = rec.get("row")
        col = rec.get("col")
        board = decode_board(rec.get("board", ""))
        size = len(board) if board else 8
        if isinstance(row, int) and isinstance(col, int):
            row, col = transform_coord(row, col, size, transform_id)
        return f"place:{row}:{col}"
    if action_type == "use_card":
        card_id = rec.get("useCardId") or "unknown"
        return f"use_card:{card_id}"
    return str(action_type)


def _to_bucket(value: int, steps: list[int]) -> str:
    for s in steps:
        if value <= s:
            return str(s)
    return f">{steps[-1]}"


def _count_empties(board_str: str) -> int:
    return sum(1 for ch in board_str if ch == ".")


def _disc_diff_from_player(board_str: str, player: str) -> int:
    b = sum(1 for ch in board_str if ch == "B")
    w = sum(1 for ch in board_str if ch == "W")
    return (b - w) if player == "black" else (w - b)


def _corner_diff_from_player(board_str: str, player: str) -> int:
    rows = board_str.split("/") if board_str else []
    if not rows:
        return 0
    size = len(rows)
    corners = [(0, 0), (0, size - 1), (size - 1, 0), (size - 1, size - 1)]
    own = 0
    opp = 0
    own_ch = "B" if player == "black" else "W"
    opp_ch = "W" if own_ch == "B" else "B"
    for r, c in corners:
        ch = rows[r][c]
        if ch == own_ch:
            own += 1
        elif ch == opp_ch:
            opp += 1
    return own - opp


def build_abstract_state_key(rec: dict) -> str:
    player = rec.get("player", "?")
    pending = rec.get("pendingType") or "-"
    legal_moves = int(rec.get("legalMoves", 0) or 0)
    board_raw = rec.get("board", "")
    canonical_board, _ = canonicalize_board(board_raw)
    empties = _count_empties(canonical_board)
    phase = "opening" if empties >= 44 else ("mid" if empties >= 16 else "end")
    mobility_bucket = _to_bucket(legal_moves, [0, 2, 4, 6, 10, 20])
    disc_diff_bucket = _to_bucket(_disc_diff_from_player(canonical_board, player), [-20, -10, -4, 0, 4, 10, 20])
    corner_diff_bucket = _to_bucket(_corner_diff_from_player(canonical_board, player), [-4, -2, -1, 0, 1, 2, 4])
    return f"{player}|{pending}|{phase}|mob:{mobility_bucket}|disc:{disc_diff_bucket}|corner:{corner_diff_bucket}"


def _cell_type(row: int, col: int, size: int = 8) -> str:
    if (row == 0 or row == size - 1) and (col == 0 or col == size - 1):
        return "corner"
    if (row in (1, size - 2)) and (col in (1, size - 2)):
        return "x"
    near_tb = (row in (0, size - 1)) and (col in (1, size - 2))
    near_lr = (col in (0, size - 1)) and (row in (1, size - 2))
    if near_tb or near_lr:
        return "c"
    if row == 0 or row == size - 1 or col == 0 or col == size - 1:
        return "edge"
    return "inner"


def build_abstract_action_key(rec: dict) -> str:
    action_type = rec.get("actionType") or "unknown"
    if action_type == "place":
        row = rec.get("row")
        col = rec.get("col")
        if isinstance(row, int) and isinstance(col, int):
            return f"place_cat:{_cell_type(row, col)}"
        return "place_cat:unknown"
    if action_type == "use_card":
        card_id = rec.get("useCardId") or "unknown"
        return f"use_card:{card_id}"
    return str(action_type)


def iter_ndjson(path: str) -> Iterable[dict]:
    with open(path, "r", encoding="utf-8") as f:
        for line_no, raw in enumerate(f, start=1):
            line = raw.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as err:
                raise ValueError(f"invalid ndjson at line {line_no}: {err}") from err
            if not isinstance(rec, dict):
                continue
            yield rec


def choose_best_action(action_map: Dict[str, ActionStat]) -> Tuple[str, ActionStat]:
    best_key = ""
    best_stat = ActionStat(visits=0, outcome_sum=-10**9)
    for action_key, stat in action_map.items():
        if stat.avg_outcome > best_stat.avg_outcome:
            best_key = action_key
            best_stat = stat
            continue
        if stat.avg_outcome == best_stat.avg_outcome and stat.visits > best_stat.visits:
            best_key = action_key
            best_stat = stat
    return best_key, best_stat


def _materialize_states(table: Dict[str, Dict[str, ActionStat]], min_visits: int) -> tuple[dict, int]:
    states = {}
    kept_states = 0
    for state_key, action_map in table.items():
        total_visits = sum(v.visits for v in action_map.values())
        if total_visits < min_visits:
            continue
        best_key, best_stat = choose_best_action(action_map)
        states[state_key] = {
            "visits": total_visits,
            "bestAction": best_key,
            "bestActionVisits": best_stat.visits,
            "bestActionAvgOutcome": best_stat.avg_outcome,
            "actions": {
                key: {
                    "visits": value.visits,
                    "avgOutcome": value.avg_outcome,
                }
                for key, value in action_map.items()
            },
        }
        kept_states += 1
    return states, kept_states


def train(records: Iterable[dict], min_visits: int) -> dict:
    table: Dict[str, Dict[str, ActionStat]] = {}
    abstract_table: Dict[str, Dict[str, ActionStat]] = {}
    lines = 0
    skipped = 0
    positive = 0

    for rec in records:
        lines += 1
        outcome = rec.get("outcome")
        if outcome is None:
            skipped += 1
            continue
        target = compute_training_target(rec, float(outcome), _TRAINING_CONTEXT["shape_immediate"])

        state_key, transform_id = build_state_key(rec)
        action_key = build_action_key(rec, transform_id)
        state_actions = table.setdefault(state_key, {})
        stat = state_actions.get(action_key)
        if stat is None:
            stat = ActionStat()
            state_actions[action_key] = stat
        stat.add(target)

        abstract_state_key = build_abstract_state_key(rec)
        abstract_action_key = build_abstract_action_key(rec)
        abs_actions = abstract_table.setdefault(abstract_state_key, {})
        abs_stat = abs_actions.get(abstract_action_key)
        if abs_stat is None:
            abs_stat = ActionStat()
            abs_actions[abstract_action_key] = abs_stat
        abs_stat.add(target)

        if float(outcome) > 0:
            positive += 1

    states, kept_states = _materialize_states(table, min_visits)
    abstract_states, kept_abstract_states = _materialize_states(abstract_table, min_visits)

    return {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "normalization": NORMALIZATION,
        "createdAt": dt.datetime.utcnow().isoformat() + "Z",
        "stats": {
            "recordsRead": lines,
            "recordsSkipped": skipped,
            "statesRaw": len(table),
            "statesKept": kept_states,
            "abstractStatesRaw": len(abstract_table),
            "abstractStatesKept": kept_abstract_states,
            "positiveRate": (positive / max(1, lines - skipped)),
            "minVisits": min_visits,
            "shapeImmediate": _TRAINING_CONTEXT["shape_immediate"],
        },
        "states": states,
        "abstractStates": abstract_states,
    }


def compute_training_target(rec: dict, outcome: float, shape_immediate: float) -> float:
    alpha = max(0.0, min(1.0, float(shape_immediate)))
    if alpha <= 0.0:
        return outcome
    try:
        b_before = float(rec.get("blackCountBefore"))
        w_before = float(rec.get("whiteCountBefore"))
        b_after = float(rec.get("blackCountAfter"))
        w_after = float(rec.get("whiteCountAfter"))
        player = rec.get("player")
        before = (b_before - w_before) if player == "black" else (w_before - b_before)
        after = (b_after - w_after) if player == "black" else (w_after - b_after)
        immediate = max(-1.0, min(1.0, (after - before) / 64.0))
    except (TypeError, ValueError):
        immediate = 0.0
    return ((1.0 - alpha) * float(outcome)) + (alpha * immediate)


_TRAINING_CONTEXT = {"shape_immediate": 0.0}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train simple policy table from self-play NDJSON.")
    p.add_argument("--input", required=True, help="Path to NDJSON self-play data.")
    p.add_argument(
        "--model-out",
        default=os.path.join("data", "models", "policy-table.json"),
        help="Output model JSON path.",
    )
    p.add_argument(
        "--min-visits",
        type=int,
        default=3,
        help="Minimum visits per state to keep.",
    )
    p.add_argument(
        "--shape-immediate",
        type=float,
        default=0.25,
        help="Blend ratio [0..1] of immediate disc-diff delta into outcome target.",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.min_visits < 1:
        raise ValueError("--min-visits must be >= 1")
    if args.shape_immediate < 0 or args.shape_immediate > 1:
        raise ValueError("--shape-immediate must be in [0, 1]")

    _TRAINING_CONTEXT["shape_immediate"] = float(args.shape_immediate)

    model = train(iter_ndjson(args.input), args.min_visits)
    out_dir = os.path.dirname(args.model_out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(args.model_out, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)

    stats = model["stats"]
    print(
        "[train_policy_table] "
        f"records={stats['recordsRead']} "
        f"states_kept={stats['statesKept']} "
        f"positive_rate={stats['positiveRate']:.3f} "
        f"out={args.model_out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
