#!/usr/bin/env python3
"""Evaluate policy-table hit rate on NDJSON records."""

from __future__ import annotations

import argparse
import json
from typing import Iterable

from train_policy_table import (
    build_abstract_action_key,
    build_abstract_state_key,
    build_action_key,
    build_state_key,
    iter_ndjson,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Evaluate policy table against NDJSON records.")
    p.add_argument("--input", required=True, help="Path to NDJSON data.")
    p.add_argument("--model", required=True, help="Path to policy-table JSON.")
    return p.parse_args()


def evaluate(records: Iterable[dict], model: dict) -> dict:
    states = model.get("states", {})
    abstract_states = model.get("abstractStates", {})
    total = 0
    covered = 0
    covered_abstract = 0
    hit = 0
    covered_outcome_sum = 0.0
    all_outcome_sum = 0.0

    for rec in records:
        total += 1
        outcome = float(rec.get("outcome", 0.0))
        all_outcome_sum += outcome

        state_key, transform_id = build_state_key(rec)
        found = states.get(state_key)
        actual = build_action_key(rec, transform_id)
        if not found and abstract_states:
            abstract_key = build_abstract_state_key(rec)
            found = abstract_states.get(abstract_key)
            if found:
                covered_abstract += 1
                actual = build_abstract_action_key(rec)
        if not found:
            continue

        covered += 1
        covered_outcome_sum += outcome
        predicted = found.get("bestAction")
        if predicted == actual:
            hit += 1

    return {
        "records": total,
        "covered": covered,
        "coveredAbstract": covered_abstract,
        "coverageRate": covered / max(1, total),
        "hit": hit,
        "hitRateOnCovered": hit / max(1, covered),
        "avgOutcomeAll": all_outcome_sum / max(1, total),
        "avgOutcomeCovered": covered_outcome_sum / max(1, covered),
    }


def main() -> int:
    args = parse_args()
    with open(args.model, "r", encoding="utf-8") as f:
        model = json.load(f)

    result = evaluate(iter_ndjson(args.input), model)
    print(
        "[evaluate_policy_table] "
        f"records={result['records']} "
        f"coverage={result['coverageRate']:.3f} "
        f"hit_rate={result['hitRateOnCovered']:.3f} "
        f"avg_outcome_all={result['avgOutcomeAll']:.3f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
