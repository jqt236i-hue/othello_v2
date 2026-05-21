#!/usr/bin/env python3
"""Train the pure Reversi browser value table from self-play NDJSON."""

from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import os
from collections import defaultdict

_POLICY_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "train-policy-table.py")
_POLICY_SPEC = importlib.util.spec_from_file_location("othello_train_policy_table", _POLICY_SCRIPT)
if _POLICY_SPEC is None or _POLICY_SPEC.loader is None:
    raise RuntimeError(f"failed to load policy trainer helpers: {_POLICY_SCRIPT}")
_POLICY = importlib.util.module_from_spec(_POLICY_SPEC)
_POLICY_SPEC.loader.exec_module(_POLICY)

NORMALIZATION = _POLICY.NORMALIZATION
canonicalize_board = _POLICY.canonicalize_board
clamp = _POLICY.clamp
iter_ndjson = _POLICY.iter_ndjson
make_abstract_state_key = _POLICY.make_abstract_state_key
training_target = _POLICY.training_target


MODEL_SCHEMA_VERSION = "value_table.v1"


def train(args: argparse.Namespace) -> dict:
    table: dict[str, dict[str, float]] = defaultdict(lambda: {"visits": 0.0, "sum": 0.0})
    abstract_table: dict[str, dict[str, float]] = defaultdict(lambda: {"visits": 0.0, "sum": 0.0})
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
            legal_moves = int(rec.get("legalMoves", 0) or 0)
            board_key, _transform_id = canonicalize_board(str(rec.get("board", "")))
            if not board_key:
                raise ValueError("missing board")
        except Exception:
            stats["recordsSkipped"] += 1
            continue
        weight = float(args.white_sample_weight if player == "white" else args.black_sample_weight)
        target = clamp(training_target(rec, args.outcome_weight, args.search_weight, args.positional_weight), -1.0, 1.0)
        state_key = f"{player}|{board_key}|legal:{legal_moves}"
        abstract_key = make_abstract_state_key(player, board_key, legal_moves)
        for target_table, key in ((table, state_key), (abstract_table, abstract_key)):
            stat = target_table[key]
            stat["visits"] += weight
            stat["sum"] += target * weight
        stats["weightedRecords"] += weight
        stats["whiteRecords" if player == "white" else "blackRecords"] += 1

    def materialize(src: dict[str, dict[str, float]]) -> tuple[dict, int]:
        out = {}
        for key, stat in src.items():
            visits = stat["visits"]
            if visits < args.min_visits:
                continue
            out[key] = {
                "visits": visits,
                "avgValue": stat["sum"] / max(1e-9, visits),
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
    print(f"[othello-value-train] records={s['recordsRead']} states={s['statesKept']} abstract={s['abstractStatesKept']} out={args.model_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
