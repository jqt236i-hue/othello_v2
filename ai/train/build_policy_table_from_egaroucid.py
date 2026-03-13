#!/usr/bin/env python3
"""Distill Egaroucid train-data (board64 + score) into policy_table.v2.

Input line format:
    <64 chars board in X/O/-> <score>

- board uses side-to-move perspective:
  X = side to move, O = opponent, - = empty.
- score is estimated final disc difference for side to move.

This script builds/reuses a SQLite index of board->score, then creates a
bootstrap policy table by selecting legal move(s) with the best inferred
next-position score.
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import sqlite3
from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, Iterable, Iterator, List, Optional, Sequence, Tuple

import train_policy_table as policy_table


BOARD_SIZE = 8
BOARD_CELLS = BOARD_SIZE * BOARD_SIZE
DIRS = (
    (-1, -1), (-1, 0), (-1, 1),
    (0, -1),           (0, 1),
    (1, -1),  (1, 0),  (1, 1),
)
MISSING = object()


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


class LruScoreCache:
    def __init__(self, max_size: int) -> None:
        self.max_size = max(0, int(max_size))
        self._data: "OrderedDict[str, Optional[int]]" = OrderedDict()

    def get(self, key: str):
        if self.max_size <= 0:
            return MISSING
        if key not in self._data:
            return MISSING
        value = self._data.pop(key)
        self._data[key] = value
        return value

    def set(self, key: str, value: Optional[int]) -> None:
        if self.max_size <= 0:
            return
        if key in self._data:
            self._data.pop(key)
        self._data[key] = value
        while len(self._data) > self.max_size:
            self._data.popitem(last=False)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Build bootstrap policy_table.v2 from Egaroucid train data."
    )
    p.add_argument(
        "--input",
        nargs="+",
        required=True,
        help="Input txt files or glob patterns. Example: data/egaroucid/**/*.txt",
    )
    p.add_argument(
        "--index-db",
        default=os.path.join("data", "egaroucid", "score-index.sqlite3"),
        help="SQLite index path for board->score lookups.",
    )
    p.add_argument(
        "--rebuild-index",
        action="store_true",
        help="Rebuild board->score index from --input.",
    )
    p.add_argument(
        "--max-index-lines",
        type=int,
        default=0,
        help="Max lines to index (0 = all).",
    )
    p.add_argument(
        "--max-lines",
        type=int,
        default=1_000_000,
        help="Max source lines to distill for model creation (0 = all).",
    )
    p.add_argument(
        "--min-discs",
        type=int,
        default=4,
        help="Minimum total discs in source position to use (default: 4).",
    )
    p.add_argument(
        "--max-discs",
        type=int,
        default=63,
        help="Maximum total discs in source position to use (default: 63).",
    )
    p.add_argument(
        "--all-legal-actions",
        action="store_true",
        help="Store all legal actions with inferred outcomes (default: best-only).",
    )
    p.add_argument(
        "--missing-next",
        choices=("skip", "disc-diff", "parent-score"),
        default="skip",
        help=(
            "Fallback when next board score is missing in index: "
            "skip | disc-diff | parent-score (default: skip)."
        ),
    )
    p.add_argument(
        "--cache-size",
        type=int,
        default=200_000,
        help="LRU cache size for board->score lookups (default: 200000).",
    )
    p.add_argument(
        "--progress-every",
        type=int,
        default=100_000,
        help="Print progress every N source lines (default: 100000).",
    )
    p.add_argument(
        "--min-visits",
        type=int,
        default=3,
        help="Minimum visits per state to keep in output model.",
    )
    p.add_argument(
        "--score-scale",
        type=float,
        default=64.0,
        help="Scale for normalizing score into [-1,1] outcome (default: 64).",
    )
    p.add_argument(
        "--model-out",
        default=os.path.join("data", "models", "policy-table.egaroucid.bootstrap.json"),
        help="Output policy table path.",
    )
    p.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose logs.",
    )
    args = p.parse_args()

    if args.max_index_lines < 0:
        raise ValueError("--max-index-lines must be >= 0")
    if args.max_lines < 0:
        raise ValueError("--max-lines must be >= 0")
    if args.min_discs < 0 or args.min_discs > 64:
        raise ValueError("--min-discs must be in [0,64]")
    if args.max_discs < 0 or args.max_discs > 64:
        raise ValueError("--max-discs must be in [0,64]")
    if args.max_discs < args.min_discs:
        raise ValueError("--max-discs must be >= --min-discs")
    if args.cache_size < 0:
        raise ValueError("--cache-size must be >= 0")
    if args.progress_every < 0:
        raise ValueError("--progress-every must be >= 0")
    if args.min_visits < 1:
        raise ValueError("--min-visits must be >= 1")
    if args.score_scale <= 0:
        raise ValueError("--score-scale must be > 0")
    return args


def expand_input_files(patterns: Sequence[str]) -> List[str]:
    out: List[str] = []
    seen = set()
    for one in patterns:
        matches = glob.glob(one, recursive=True)
        if not matches:
            matches = [one]
        for m in matches:
            full = os.path.abspath(m)
            if full in seen:
                continue
            if not os.path.isfile(full):
                continue
            seen.add(full)
            out.append(full)
    out.sort()
    return out


def iter_lines(paths: Sequence[str]) -> Iterator[Tuple[str, int, str]]:
    for file_path in paths:
        with open(file_path, "r", encoding="utf-8") as f:
            for line_no, raw in enumerate(f, start=1):
                yield file_path, line_no, raw.rstrip("\n")


def parse_train_line(line: str) -> Optional[Tuple[str, int]]:
    text = line.strip()
    if not text:
        return None
    parts = text.split()
    if len(parts) < 2:
        return None
    board = parts[0].strip()
    if len(board) != BOARD_CELLS:
        return None
    if any(ch not in ("X", "O", "-") for ch in board):
        return None
    try:
        score = int(parts[1])
    except ValueError:
        return None
    return board, score


def board64_to_ints(board64: str) -> List[int]:
    out: List[int] = []
    for ch in board64:
        if ch == "X":
            out.append(1)
        elif ch == "O":
            out.append(-1)
        else:
            out.append(0)
    return out


def int_board_to_egaroucid(board: Sequence[int], side_to_move: int) -> str:
    chars = []
    for cell in board:
        if cell == side_to_move:
            chars.append("X")
        elif cell == -side_to_move:
            chars.append("O")
        else:
            chars.append("-")
    return "".join(chars)


def int_board_to_project(board: Sequence[int], player: str) -> str:
    own = 1 if player == "black" else -1
    rows = []
    for r in range(BOARD_SIZE):
        row_chars = []
        for c in range(BOARD_SIZE):
            cell = board[(r * BOARD_SIZE) + c]
            if cell == own:
                row_chars.append("B")
            elif cell == -own:
                row_chars.append("W")
            else:
                row_chars.append(".")
        rows.append("".join(row_chars))
    return "/".join(rows)


def count_discs(board: Sequence[int]) -> int:
    return sum(1 for v in board if v != 0)


def count_disc_diff(board: Sequence[int], player: int) -> int:
    own = 0
    opp = 0
    for v in board:
        if v == player:
            own += 1
        elif v == -player:
            opp += 1
    return own - opp


def gather_flips(board: Sequence[int], row: int, col: int, player: int) -> List[int]:
    if row < 0 or row >= BOARD_SIZE or col < 0 or col >= BOARD_SIZE:
        return []
    idx = (row * BOARD_SIZE) + col
    if board[idx] != 0:
        return []
    all_flips: List[int] = []
    for dr, dc in DIRS:
        rr = row + dr
        cc = col + dc
        line: List[int] = []
        while 0 <= rr < BOARD_SIZE and 0 <= cc < BOARD_SIZE:
            cur_idx = (rr * BOARD_SIZE) + cc
            cur = board[cur_idx]
            if cur == -player:
                line.append(cur_idx)
                rr += dr
                cc += dc
                continue
            if cur == player and line:
                all_flips.extend(line)
            break
    return all_flips


def legal_moves(board: Sequence[int], player: int) -> List[Tuple[int, int]]:
    out: List[Tuple[int, int]] = []
    for row in range(BOARD_SIZE):
        for col in range(BOARD_SIZE):
            if gather_flips(board, row, col, player):
                out.append((row, col))
    return out


def apply_move(board: Sequence[int], row: int, col: int, player: int) -> Optional[List[int]]:
    flips = gather_flips(board, row, col, player)
    if not flips:
        return None
    idx = (row * BOARD_SIZE) + col
    out = list(board)
    out[idx] = player
    for one in flips:
        out[one] = player
    return out


def clamp_signed(value: float) -> float:
    return max(-1.0, min(1.0, float(value)))


def get_index_count(conn: sqlite3.Connection) -> int:
    cur = conn.execute("SELECT COUNT(*) FROM score_index")
    row = cur.fetchone()
    return int(row[0] if row else 0)


def ensure_index_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS score_index ("
        " board TEXT PRIMARY KEY,"
        " score INTEGER NOT NULL"
        ")"
    )


def rebuild_index(
    conn: sqlite3.Connection,
    files: Sequence[str],
    max_lines: int,
    progress_every: int,
) -> Dict[str, int]:
    conn.execute("DROP TABLE IF EXISTS score_index")
    ensure_index_schema(conn)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA temp_store=MEMORY")

    rows_read = 0
    rows_valid = 0
    rows_written = 0
    batch: List[Tuple[str, int]] = []
    batch_size = 5000

    for _, _, line in iter_lines(files):
        rows_read += 1
        parsed = parse_train_line(line)
        if not parsed:
            continue
        rows_valid += 1
        batch.append(parsed)
        if len(batch) >= batch_size:
            conn.executemany(
                "INSERT OR REPLACE INTO score_index(board, score) VALUES (?, ?)",
                batch,
            )
            rows_written += len(batch)
            conn.commit()
            batch = []
        if progress_every > 0 and (rows_read % progress_every) == 0:
            print(
                f"[egaroucid-index] read={rows_read} valid={rows_valid} "
                f"written={rows_written}",
                flush=True,
            )
        if max_lines > 0 and rows_read >= max_lines:
            break

    if batch:
        conn.executemany(
            "INSERT OR REPLACE INTO score_index(board, score) VALUES (?, ?)",
            batch,
        )
        rows_written += len(batch)
        conn.commit()

    return {
        "rowsRead": rows_read,
        "rowsValid": rows_valid,
        "rowsWritten": rows_written,
        "rowsIndexed": get_index_count(conn),
    }


def lookup_score(
    cursor: sqlite3.Cursor,
    cache: LruScoreCache,
    board64: str,
) -> Optional[int]:
    cached = cache.get(board64)
    if cached is not MISSING:
        return cached
    cursor.execute("SELECT score FROM score_index WHERE board = ?", (board64,))
    row = cursor.fetchone()
    score = int(row[0]) if row else None
    cache.set(board64, score)
    return score


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


def materialize_states(
    table: Dict[str, Dict[str, ActionStat]],
    min_visits: int,
) -> Tuple[dict, int]:
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


def infer_move_score(
    cursor: sqlite3.Cursor,
    cache: LruScoreCache,
    next_board: Sequence[int],
    parent_score: int,
    missing_next: str,
) -> Optional[float]:
    opp_moves = legal_moves(next_board, -1)
    if opp_moves:
        key = int_board_to_egaroucid(next_board, -1)
        score = lookup_score(cursor, cache, key)
        if score is not None:
            return float(-score)
    else:
        own_moves = legal_moves(next_board, 1)
        if own_moves:
            key = int_board_to_egaroucid(next_board, 1)
            score = lookup_score(cursor, cache, key)
            if score is not None:
                return float(score)
        else:
            return float(count_disc_diff(next_board, 1))

    if missing_next == "disc-diff":
        return float(count_disc_diff(next_board, 1))
    if missing_next == "parent-score":
        return float(parent_score)
    return None


def distill_policy_table(
    conn: sqlite3.Connection,
    files: Sequence[str],
    max_lines: int,
    min_discs: int,
    max_discs: int,
    all_legal_actions: bool,
    missing_next: str,
    cache_size: int,
    score_scale: float,
    min_visits: int,
    progress_every: int,
    verbose: bool,
) -> Tuple[dict, Dict[str, int]]:
    table: Dict[str, Dict[str, ActionStat]] = {}
    abstract_table: Dict[str, Dict[str, ActionStat]] = {}

    cache = LruScoreCache(cache_size)
    cursor = conn.cursor()

    lines_read = 0
    lines_valid = 0
    lines_used = 0
    disc_filtered = 0
    no_legal_move = 0
    no_scored_action = 0
    action_samples = 0
    positive_actions = 0

    for _, _, line in iter_lines(files):
        lines_read += 1
        parsed = parse_train_line(line)
        if not parsed:
            continue
        lines_valid += 1
        board64, parent_score = parsed
        board = board64_to_ints(board64)

        discs = count_discs(board)
        if discs < min_discs or discs > max_discs:
            disc_filtered += 1
            continue

        legal = legal_moves(board, 1)
        if not legal:
            no_legal_move += 1
            continue

        move_scores: List[Tuple[int, int, float]] = []
        for row, col in legal:
            next_board = apply_move(board, row, col, 1)
            if next_board is None:
                continue
            inferred = infer_move_score(
                cursor=cursor,
                cache=cache,
                next_board=next_board,
                parent_score=parent_score,
                missing_next=missing_next,
            )
            if inferred is None:
                continue
            move_scores.append((row, col, inferred))

        if not move_scores:
            no_scored_action += 1
            continue

        lines_used += 1
        if not all_legal_actions:
            move_scores.sort(key=lambda x: x[2], reverse=True)
            move_scores = [move_scores[0]]

        for player in ("black", "white"):
            board_str = int_board_to_project(board, player)
            base_rec = {
                "player": player,
                "board": board_str,
                "pendingType": "-",
                "legalMoves": len(legal),
            }
            state_key, transform_id = policy_table.build_state_key(base_rec)
            state_actions = table.setdefault(state_key, {})

            abstract_state_key = policy_table.build_abstract_state_key(base_rec)
            abstract_actions = abstract_table.setdefault(abstract_state_key, {})

            for row, col, raw_score in move_scores:
                outcome = clamp_signed(raw_score / score_scale)
                action_rec = {
                    **base_rec,
                    "actionType": "place",
                    "row": row,
                    "col": col,
                }
                action_key = policy_table.build_action_key(action_rec, transform_id)
                stat = state_actions.get(action_key)
                if stat is None:
                    stat = ActionStat()
                    state_actions[action_key] = stat
                stat.add(outcome)

                abstract_action_key = policy_table.build_abstract_action_key(action_rec)
                abs_stat = abstract_actions.get(abstract_action_key)
                if abs_stat is None:
                    abs_stat = ActionStat()
                    abstract_actions[abstract_action_key] = abs_stat
                abs_stat.add(outcome)

                action_samples += 1
                if outcome > 0:
                    positive_actions += 1

        if progress_every > 0 and (lines_read % progress_every) == 0:
            print(
                f"[egaroucid-distill] read={lines_read} valid={lines_valid} "
                f"used={lines_used} action_samples={action_samples} "
                f"states_raw={len(table)} abstract_states_raw={len(abstract_table)}",
                flush=True,
            )
        if max_lines > 0 and lines_read >= max_lines:
            break

    states, kept_states = materialize_states(table, min_visits)
    abstract_states, kept_abstract_states = materialize_states(abstract_table, min_visits)

    if verbose:
        print(
            f"[egaroucid-distill] materialized states={kept_states}/{len(table)} "
            f"abstract={kept_abstract_states}/{len(abstract_table)}",
            flush=True,
        )

    model = {
        "schemaVersion": policy_table.MODEL_SCHEMA_VERSION,
        "normalization": policy_table.NORMALIZATION,
        "createdAt": dt.datetime.now(dt.UTC).isoformat().replace("+00:00", "Z"),
        "stats": {
            "recordsRead": lines_read,
            "recordsValid": lines_valid,
            "recordsUsed": lines_used,
            "recordsDiscFiltered": disc_filtered,
            "recordsNoLegalMove": no_legal_move,
            "recordsNoScoredAction": no_scored_action,
            "statesRaw": len(table),
            "statesKept": kept_states,
            "abstractStatesRaw": len(abstract_table),
            "abstractStatesKept": kept_abstract_states,
            "actionSamples": action_samples,
            "positiveRate": (positive_actions / max(1, action_samples)),
            "minVisits": min_visits,
            "scoreScale": score_scale,
            "allLegalActions": bool(all_legal_actions),
            "missingNext": missing_next,
            "sourceFormat": "egaroucid_board64_score_v1",
            "notes": (
                "Source data terms prohibit redistribution. "
                "Keep raw train-data local."
            ),
        },
        "states": states,
        "abstractStates": abstract_states,
    }

    counters = {
        "linesRead": lines_read,
        "linesValid": lines_valid,
        "linesUsed": lines_used,
        "discFiltered": disc_filtered,
        "noLegalMove": no_legal_move,
        "noScoredAction": no_scored_action,
        "actionSamples": action_samples,
        "statesRaw": len(table),
        "statesKept": kept_states,
        "abstractStatesRaw": len(abstract_table),
        "abstractStatesKept": kept_abstract_states,
    }
    return model, counters


def main() -> int:
    args = parse_args()
    files = expand_input_files(args.input)
    if not files:
        raise ValueError("no input files found from --input")

    os.makedirs(os.path.dirname(os.path.abspath(args.index_db)), exist_ok=True)
    conn = sqlite3.connect(os.path.abspath(args.index_db))
    conn.execute("PRAGMA busy_timeout=30000")
    ensure_index_schema(conn)

    try:
        indexed_rows = get_index_count(conn)
        index_stats = None
        if args.rebuild_index or indexed_rows <= 0:
            print(
                f"[egaroucid-index] building index file={args.index_db} "
                f"inputs={len(files)}",
                flush=True,
            )
            index_stats = rebuild_index(
                conn=conn,
                files=files,
                max_lines=int(args.max_index_lines),
                progress_every=int(args.progress_every),
            )
            print(
                f"[egaroucid-index] done indexed_rows={index_stats['rowsIndexed']} "
                f"read={index_stats['rowsRead']} valid={index_stats['rowsValid']}",
                flush=True,
            )
        else:
            print(
                f"[egaroucid-index] reusing existing index rows={indexed_rows} "
                f"file={args.index_db}",
                flush=True,
            )

        print(
            f"[egaroucid-distill] start max_lines={args.max_lines} "
            f"discs={args.min_discs}..{args.max_discs} "
            f"all_legal_actions={args.all_legal_actions} "
            f"missing_next={args.missing_next}",
            flush=True,
        )
        model, counters = distill_policy_table(
            conn=conn,
            files=files,
            max_lines=int(args.max_lines),
            min_discs=int(args.min_discs),
            max_discs=int(args.max_discs),
            all_legal_actions=bool(args.all_legal_actions),
            missing_next=str(args.missing_next),
            cache_size=int(args.cache_size),
            score_scale=float(args.score_scale),
            min_visits=int(args.min_visits),
            progress_every=int(args.progress_every),
            verbose=bool(args.verbose),
        )
        if index_stats:
            model["indexStats"] = index_stats
        model["sourceFiles"] = files

        out_path = os.path.abspath(args.model_out)
        out_dir = os.path.dirname(out_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(model, f, ensure_ascii=False, indent=2)

        print(
            "[egaroucid-distill] "
            f"read={counters['linesRead']} valid={counters['linesValid']} "
            f"used={counters['linesUsed']} action_samples={counters['actionSamples']} "
            f"states_kept={counters['statesKept']} "
            f"abstract_kept={counters['abstractStatesKept']} "
            f"out={out_path}",
            flush=True,
        )
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
