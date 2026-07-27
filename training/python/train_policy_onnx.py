#!/usr/bin/env python3
"""Train a small PyTorch policy network and export ONNX (+ optional policy-table fallback)."""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from dataclasses import dataclass
from typing import Any

import torch
from torch import nn
from torch.nn import functional as F

import onnx_trainer_common as trainer_common
import train_policy_table as policy_table


MODEL_SCHEMA_VERSION = "policy_onnx.v1"
BOARD_SIZE = 8
PADDED_BOARD_MIN = -1
PADDED_BOARD_MAX = 8
PADDED_BOARD_SIZE = (PADDED_BOARD_MAX - PADDED_BOARD_MIN) + 1
BOARD_FEATURE_DIM = PADDED_BOARD_SIZE * PADDED_BOARD_SIZE
AUX_FEATURE_DIM = 16
BASE_INPUT_DIM = BOARD_FEATURE_DIM + AUX_FEATURE_DIM
PLACE_OUTPUT_DIM = BOARD_FEATURE_DIM
IGNORE_INDEX = -100
MAX_HAND_SIZE = 5.0
CHARGE_MAX = 99.0
NO_CARD_ACTION_ID = "__no_card__"


def load_card_action_ids() -> list[str]:
    catalog_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "cards", "catalog.json")
    )
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        cards = payload.get("cards") if isinstance(payload, dict) else None
        if not isinstance(cards, list):
            return []

        out: list[str] = []
        seen: set[str] = set()
        for one in cards:
            if not isinstance(one, dict):
                continue
            if one.get("enabled") is False:
                continue
            card_id = one.get("id")
            if not isinstance(card_id, str):
                continue
            card_id = card_id.strip()
            if not card_id or card_id in seen:
                continue
            seen.add(card_id)
            out.append(card_id)
        if len(out) <= 0:
            return []
        return [NO_CARD_ACTION_ID] + out
    except Exception:
        return []


CARD_ACTION_IDS = load_card_action_ids()
CARD_ACTION_INDEX = {card_id: idx for idx, card_id in enumerate(CARD_ACTION_IDS)}
CARD_ACTION_DIM = len(CARD_ACTION_IDS)
NO_CARD_ACTION_INDEX = CARD_ACTION_INDEX.get(NO_CARD_ACTION_ID)
INPUT_DIM = BASE_INPUT_DIM + (CARD_ACTION_DIM * 2)


@dataclass
class DatasetBundle:
    x: torch.Tensor
    y_place: torch.Tensor
    y_card: torch.Tensor
    sample_weight: torch.Tensor
    split_group_keys: list[str | None]
    records_read: int
    train_records: int
    place_records: int
    card_records: int
    winner_records: int
    loser_records: int
    draw_records: int
    tactical_miss_records: int
    board_input_filter: dict[str, Any]


@dataclass
class TrainSummary:
    overall_acc: float
    place_acc: float
    card_acc: float | None
    place_samples: int
    card_samples: int


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train ONNX policy model from self-play NDJSON.")
    trainer_common.add_common_args(
        p,
        onnx_out_default=os.path.join("data", "models", "policy-net.onnx"),
        include_balance_boosts=True,
    )
    # Policy has a wider early-stop monitor set
    for action in p._actions:
        if getattr(action, "dest", None) == "early_stop_monitor":
            action.help = "Metric for early stopping: val_loss/train_loss/val_place_loss/train_place_loss (default: val_loss)."
            break
    # Policy-specific args
    p.add_argument(
        "--policy-table-out",
        default=os.path.join("data", "models", "policy-table.json"),
        help="Optional compatibility policy-table output path. Empty string disables.",
    )
    p.add_argument(
        "--card-loss-weight",
        type=float,
        default=2.0,
        help="Research/compat only. Loss weight for card action head when --include-card-head is set.",
    )
    p.add_argument(
        "--card-no-action-weight",
        type=float,
        default=0.7,
        help="Relative class weight for __no_card__ label in card head (default: 0.7).",
    )
    p.add_argument(
        "--card-class-balance-power",
        type=float,
        default=0.25,
        help="Inverse-frequency balance strength for card classes in [0,1] (default: 0.25).",
    )
    p.add_argument(
        "--include-card-head",
        action="store_true",
        help="Research/compat only. Default production policy training is placement-only.",
    )
    p.add_argument("--min-visits", type=int, default=12, help="Compat policy-table --min-visits.")
    p.add_argument(
        "--shape-immediate",
        type=float,
        default=0.4,
        help="Compat policy-table --shape-immediate in [0,1].",
    )
    return p.parse_args()


def resolve_board_matrix(rec: dict) -> tuple[list[list[str]], int, int]:
    return trainer_common.require_standard_dense_board_record(rec), 0, 0


def padded_board_index(row: int, col: int) -> int | None:
    if row < PADDED_BOARD_MIN or row > PADDED_BOARD_MAX:
        return None
    if col < PADDED_BOARD_MIN or col > PADDED_BOARD_MAX:
        return None
    return ((row - PADDED_BOARD_MIN) * PADDED_BOARD_SIZE) + (col - PADDED_BOARD_MIN)


def board_cell_index_for_record(rec: dict, row: object, col: object) -> int | None:
    if not trainer_common.is_strict_int(row) or not trainer_common.is_strict_int(col):
        return None
    if row < 0 or row >= BOARD_SIZE or col < 0 or col >= BOARD_SIZE:
        return None
    return padded_board_index(row, col)


def cell_value_for_player(ch: str, player: str) -> float:
    own = "B" if player == "black" else "W"
    opp = "W" if own == "B" else "B"
    if ch == own:
        return 1.0
    if ch == opp:
        return -1.0
    return 0.0


def safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def clamp_float(value: float, lower: float, upper: float) -> float:
    return max(float(lower), min(float(upper), float(value)))


def normalized_flag(value: object) -> float:
    return clamp_float(safe_float(value, 0.0), 0.0, 1.0)


def normalized_player(value: object) -> str:
    if isinstance(value, str):
        candidate = value.strip().lower()
        if candidate in ("black", "white"):
            return candidate
    return "white"


def resolve_perspective_charge_values(rec: dict) -> tuple[float, float]:
    player = normalized_player(rec.get("player"))
    charge_black = safe_float(rec.get("chargeBlack", 0), 0.0)
    charge_white = safe_float(rec.get("chargeWhite", 0), 0.0)
    if player == "black":
        return charge_black, charge_white
    return charge_white, charge_black


def normalized_corner_balance(rec: dict) -> float:
    own_corners = safe_float(rec.get("ownCornersBefore", 0), 0.0)
    opp_corners = safe_float(rec.get("oppCornersBefore", 0), 0.0)
    return clamp_float((own_corners - opp_corners) / 4.0, -1.0, 1.0)


def normalized_edge_balance(rec: dict) -> float:
    own_edges = safe_float(rec.get("ownEdgesBefore", 0), 0.0)
    opp_edges = safe_float(rec.get("oppEdgesBefore", 0), 0.0)
    return clamp_float((own_edges - opp_edges) / 24.0, -1.0, 1.0)


def normalized_charge_balance(rec: dict) -> float:
    own_charge, opp_charge = resolve_perspective_charge_values(rec)
    return clamp_float((own_charge - opp_charge) / 12.0, -1.0, 1.0)


def normalized_bonus_access(rec: dict) -> float:
    max_legal_bonus = clamp_float(safe_float(rec.get("maxLegalMoveBonus", 0), 0.0) / 5.0, 0.0, 1.0)
    if normalized_flag(rec.get("highBonusMoveAvailable", 0)) > 0.5:
        return max(max_legal_bonus, 0.6)
    return max_legal_bonus


def normalized_economy_balance(rec: dict) -> float:
    charge_component = normalized_charge_balance(rec)
    bonus_component = normalized_bonus_access(rec)
    return clamp_float((charge_component * 0.8) + (bonus_component * 0.2), -1.0, 1.0)


def corner_sample_intensity(rec: dict) -> float:
    return clamp_float(
        max(
            abs(normalized_corner_balance(rec)),
            normalized_flag(rec.get("hasCornerMoveNow", 0)),
            normalized_flag(rec.get("cornerEmergency", 0)),
        ),
        0.0,
        1.0,
    )


def edge_sample_intensity(rec: dict) -> float:
    return clamp_float(
        max(
            abs(normalized_edge_balance(rec)),
            normalized_flag(rec.get("hasEdgeMoveNow", 0)),
        ),
        0.0,
        1.0,
    )


def economy_sample_intensity(rec: dict) -> float:
    return clamp_float(
        max(
            abs(normalized_charge_balance(rec)),
            normalized_bonus_access(rec),
        ),
        0.0,
        1.0,
    )


def build_card_counts(card_ids: list[str] | None) -> Counter[str]:
    if not isinstance(card_ids, list):
        return Counter()
    out: Counter[str] = Counter()
    for one in card_ids:
        if not isinstance(one, str):
            continue
        card_id = one.strip()
        if not card_id:
            continue
        out[card_id] += 1
    return out


def resolve_card_candidate_ids(rec: dict) -> list[str]:
    action_type = rec.get("actionType")
    if action_type == "destroy_hand_card":
        source = rec.get("handCards")
    else:
        source = rec.get("usableCardIds")

    out: list[str] = []
    seen: set[str] = set()
    if not isinstance(source, list):
        return out
    for one in source:
        if not isinstance(one, str):
            continue
        card_id = one.strip()
        if not card_id or card_id in seen:
            continue
        if card_id not in CARD_ACTION_INDEX:
            continue
        seen.add(card_id)
        out.append(card_id)
    return out


def resolve_card_target_card_id(rec: dict) -> str | None:
    action_type = rec.get("actionType")
    if action_type == "use_card":
        card_id = rec.get("useCardId")
    elif action_type == "destroy_hand_card":
        card_id = rec.get("destroyCardId")
    else:
        return None

    if not isinstance(card_id, str):
        return None
    card_id = card_id.strip()
    if not card_id:
        return None
    return card_id


def feature_vector(rec: dict) -> list[float]:
    board, board_min_row, board_min_col = resolve_board_matrix(rec)
    player = rec.get("player", "white")
    out = [0.0] * INPUT_DIM

    for local_row, row in enumerate(board):
        if not isinstance(row, list):
            continue
        for local_col, ch in enumerate(row):
            idx = padded_board_index(board_min_row + local_row, board_min_col + local_col)
            if idx is None or idx >= BOARD_FEATURE_DIM:
                continue
            out[idx] = cell_value_for_player(ch, player)

    legal_moves = float(rec.get("legalMoves", 0) or 0)
    charge_black = float(rec.get("chargeBlack", 0) or 0)
    charge_white = float(rec.get("chargeWhite", 0) or 0)
    black_before = float(rec.get("blackCountBefore", 0) or 0)
    white_before = float(rec.get("whiteCountBefore", 0) or 0)
    pending_type = rec.get("pendingType")
    pending_flag = 0.0 if pending_type in (None, "", "-", "null") else 1.0
    own_corners = float(rec.get("ownCornersBefore", 0) or 0)
    opp_corners = float(rec.get("oppCornersBefore", 0) or 0)
    own_edges = float(rec.get("ownEdgesBefore", 0) or 0)
    opp_edges = float(rec.get("oppEdgesBefore", 0) or 0)
    has_corner_move = float(rec.get("hasCornerMoveNow", 0) or 0)
    has_edge_move = float(rec.get("hasEdgeMoveNow", 0) or 0)
    corner_emergency = float(rec.get("cornerEmergency", 0) or 0)
    corner_hold_mode = float(rec.get("cornerHoldMode", 0) or 0)
    high_bonus_move = float(rec.get("highBonusMoveAvailable", 0) or 0)
    max_legal_bonus = float(rec.get("maxLegalMoveBonus", 0) or 0)

    own_charge = charge_black if player == "black" else charge_white
    opp_charge = charge_white if player == "black" else charge_black
    disc_diff = (black_before - white_before) if player == "black" else (white_before - black_before)
    deck_count_ratio = trainer_common.resolve_deck_count_ratio(rec)

    out[BOARD_FEATURE_DIM + 0] = legal_moves / 60.0
    out[BOARD_FEATURE_DIM + 1] = disc_diff / 64.0
    out[BOARD_FEATURE_DIM + 2] = own_charge / CHARGE_MAX
    out[BOARD_FEATURE_DIM + 3] = opp_charge / CHARGE_MAX
    out[BOARD_FEATURE_DIM + 4] = deck_count_ratio
    out[BOARD_FEATURE_DIM + 5] = pending_flag
    out[BOARD_FEATURE_DIM + 6] = own_corners / 4.0
    out[BOARD_FEATURE_DIM + 7] = opp_corners / 4.0
    out[BOARD_FEATURE_DIM + 8] = own_edges / 24.0
    out[BOARD_FEATURE_DIM + 9] = opp_edges / 24.0
    out[BOARD_FEATURE_DIM + 10] = max(0.0, min(1.0, has_corner_move))
    out[BOARD_FEATURE_DIM + 11] = max(0.0, min(1.0, has_edge_move))
    out[BOARD_FEATURE_DIM + 12] = max(0.0, min(1.0, corner_emergency))
    out[BOARD_FEATURE_DIM + 13] = max(0.0, min(1.0, corner_hold_mode))
    out[BOARD_FEATURE_DIM + 14] = max(0.0, min(1.0, high_bonus_move))
    out[BOARD_FEATURE_DIM + 15] = max(0.0, min(1.0, max_legal_bonus / 5.0))

    if CARD_ACTION_DIM > 0:
        hand_offset = BASE_INPUT_DIM
        usable_offset = BASE_INPUT_DIM + CARD_ACTION_DIM

        hand_counts = build_card_counts(rec.get("handCards"))
        for card_id, count in hand_counts.items():
            idx = CARD_ACTION_INDEX.get(card_id)
            if idx is None:
                continue
            out[hand_offset + idx] = min(MAX_HAND_SIZE, float(count)) / MAX_HAND_SIZE

        for card_id in resolve_card_candidate_ids(rec):
            idx = CARD_ACTION_INDEX.get(card_id)
            if idx is None:
                continue
            out[usable_offset + idx] = 1.0
    return out


def is_placement_policy_record(rec: dict) -> bool:
    if rec.get("placementPolicyEligible") is not None:
        return bool(rec.get("placementPolicyEligible"))
    return (
        rec.get("actionType") == "place"
        and not rec.get("pendingSelection")
        and not rec.get("pendingType")
    )


def place_target_index(rec: dict) -> int | None:
    if not is_placement_policy_record(rec):
        return None
    return board_cell_index_for_record(rec, rec.get("row"), rec.get("col"))


def card_target_index(rec: dict) -> int | None:
    if CARD_ACTION_DIM <= 0:
        return None
    action_type = rec.get("actionType")
    target_card_id = resolve_card_target_card_id(rec)
    if isinstance(target_card_id, str):
        return CARD_ACTION_INDEX.get(target_card_id)

    # Learn "hold card" explicitly when a place move is chosen while cards are usable.
    if action_type == "place" and NO_CARD_ACTION_INDEX is not None:
        if resolve_card_candidate_ids(rec):
            return int(NO_CARD_ACTION_INDEX)
    return None


def sample_weight_for_record(
    rec: dict,
    winner_sample_boost: float,
    loser_sample_weight: float,
    draw_sample_weight: float,
    corner_emergency_sample_boost: float,
    negative_future_disc_sample_boost: float,
    negative_future_disc_threshold: float,
    tactical_miss_sample_boost: float,
    tactical_miss_threshold: float,
    hand_pressure_sample_boost: float,
    pending_target_sample_boost: float,
    corner_balance_sample_boost: float = 0.0,
    edge_balance_sample_boost: float = 0.0,
    economy_balance_sample_boost: float = 0.0,
) -> tuple[float, str]:
    danger_multiplier = 1.0
    try:
        if float(rec.get("cornerEmergency", 0) or 0) > 0.5:
            danger_multiplier += corner_emergency_sample_boost
    except (TypeError, ValueError):
        pass

    try:
        if float(rec.get("futureDiscDelta3Ply", 0) or 0) <= negative_future_disc_threshold:
            danger_multiplier += negative_future_disc_sample_boost
    except (TypeError, ValueError):
        pass

    try:
        tactical_miss_ratio = float(rec.get("tacticalScoreMissRatio", 0) or 0)
        if tactical_miss_ratio >= tactical_miss_threshold:
            danger_multiplier += tactical_miss_sample_boost
    except (TypeError, ValueError):
        pass

    hand_cards = rec.get("handCards")
    if isinstance(hand_cards, list) and len(hand_cards) >= 4:
        danger_multiplier += hand_pressure_sample_boost

    pending_type = rec.get("pendingType")
    if isinstance(pending_type, str) and pending_type.strip():
        danger_multiplier += pending_target_sample_boost

    danger_multiplier += corner_sample_intensity(rec) * max(0.0, float(corner_balance_sample_boost))
    danger_multiplier += edge_sample_intensity(rec) * max(0.0, float(edge_balance_sample_boost))
    danger_multiplier += economy_sample_intensity(rec) * max(0.0, float(economy_balance_sample_boost))

    outcome = rec.get("outcome")
    if isinstance(outcome, (int, float)):
        if float(outcome) > 0:
            return ((1.0 + winner_sample_boost) * danger_multiplier), "winner"
        if float(outcome) < 0:
            return (loser_sample_weight * danger_multiplier), "loser"
        return (draw_sample_weight * danger_multiplier), "draw"

    winner = rec.get("winner")
    player = rec.get("player")
    if isinstance(winner, str):
        winner_norm = winner.strip().lower()
    else:
        winner_norm = ""

    if winner_norm == "draw":
        return (draw_sample_weight * danger_multiplier), "draw"

    if isinstance(player, str):
        player_norm = player.strip().lower()
    else:
        player_norm = ""

    if winner_norm in ("black", "white") and player_norm in ("black", "white"):
        if winner_norm == player_norm:
            return ((1.0 + winner_sample_boost) * danger_multiplier), "winner"
        return (loser_sample_weight * danger_multiplier), "loser"

    return (1.0 * danger_multiplier), "unknown"


def load_dataset(
    path: str,
    winner_sample_boost: float = 0.0,
    loser_sample_weight: float = 1.0,
    draw_sample_weight: float = 1.0,
    corner_emergency_sample_boost: float = 0.0,
    negative_future_disc_sample_boost: float = 0.0,
    negative_future_disc_threshold: float = -1.0,
    tactical_miss_sample_boost: float = 0.0,
    tactical_miss_threshold: float = 0.08,
    hand_pressure_sample_boost: float = 0.0,
    pending_target_sample_boost: float = 0.0,
    corner_balance_sample_boost: float = 0.0,
    edge_balance_sample_boost: float = 0.0,
    economy_balance_sample_boost: float = 0.0,
    include_card_labels: bool = False,
) -> DatasetBundle:
    xs: list[list[float]] = []
    y_place: list[int] = []
    y_card: list[int] = []
    sample_weight: list[float] = []
    split_group_keys: list[str | None] = []
    records_read = 0
    train_records = 0
    place_records = 0
    card_records = 0
    winner_records = 0
    loser_records = 0
    draw_records = 0
    tactical_miss_records = 0
    board_input_diagnostics = trainer_common.BoardInputFilterDiagnostics()

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records_read += 1
            rec = json.loads(line)
            if not board_input_diagnostics.inspect(rec).accepted:
                continue
            place_t = place_target_index(rec)
            card_t = card_target_index(rec) if include_card_labels else None
            if include_card_labels:
                if place_t is None and card_t is None:
                    continue
            elif place_t is None:
                continue

            xs.append(feature_vector(rec))
            y_place.append(place_t if place_t is not None else IGNORE_INDEX)
            y_card.append(card_t if card_t is not None else IGNORE_INDEX)
            split_group_keys.append(trainer_common.build_record_group_key(rec))
            weight_value, weight_label = sample_weight_for_record(
                rec,
                winner_sample_boost=winner_sample_boost,
                loser_sample_weight=loser_sample_weight,
                draw_sample_weight=draw_sample_weight,
                corner_emergency_sample_boost=corner_emergency_sample_boost,
                negative_future_disc_sample_boost=negative_future_disc_sample_boost,
                negative_future_disc_threshold=negative_future_disc_threshold,
                tactical_miss_sample_boost=tactical_miss_sample_boost,
                tactical_miss_threshold=tactical_miss_threshold,
                hand_pressure_sample_boost=hand_pressure_sample_boost,
                pending_target_sample_boost=pending_target_sample_boost,
                corner_balance_sample_boost=corner_balance_sample_boost,
                edge_balance_sample_boost=edge_balance_sample_boost,
                economy_balance_sample_boost=economy_balance_sample_boost,
            )
            sample_weight.append(float(weight_value))
            train_records += 1
            if place_t is not None:
                place_records += 1
            if card_t is not None:
                card_records += 1
            if weight_label == "winner":
                winner_records += 1
            elif weight_label == "loser":
                loser_records += 1
            elif weight_label == "draw":
                draw_records += 1
            try:
                if float(rec.get("tacticalScoreMissRatio", 0) or 0) >= tactical_miss_threshold:
                    tactical_miss_records += 1
            except (TypeError, ValueError):
                pass

    if train_records <= 0:
        trainer_common.raise_no_training_records(
            "no training records were found in input data",
            board_input_diagnostics,
        )

    x = torch.tensor(xs, dtype=torch.float32)
    y_place_tensor = torch.tensor(y_place, dtype=torch.long)
    y_card_tensor = torch.tensor(y_card, dtype=torch.long)
    sample_weight_tensor = torch.tensor(sample_weight, dtype=torch.float32)
    return DatasetBundle(
        x=x,
        y_place=y_place_tensor,
        y_card=y_card_tensor,
        sample_weight=sample_weight_tensor,
        split_group_keys=split_group_keys,
        records_read=records_read,
        train_records=train_records,
        place_records=place_records,
        card_records=card_records,
        winner_records=winner_records,
        loser_records=loser_records,
        draw_records=draw_records,
        tactical_miss_records=tactical_miss_records,
        board_input_filter=board_input_diagnostics.to_meta(),
    )


class PolicyNet(nn.Module):
    def __init__(self, input_dim: int, hidden_size: int, place_output_dim: int, card_output_dim: int):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(input_dim, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
        )
        self.place_head = nn.Linear(hidden_size, place_output_dim)
        self.card_head = nn.Linear(hidden_size, card_output_dim) if card_output_dim > 0 else None

    def forward(self, obs: torch.Tensor):
        features = self.backbone(obs)
        place_logits = self.place_head(features)
        if self.card_head is None:
            return place_logits
        card_logits = self.card_head(features)
        return place_logits, card_logits


def choose_device(raw: str) -> str:
    """Delegate to shared helper.  Kept here for DeepCFR backward compat."""
    return trainer_common.choose_device(raw)


def _split_outputs(outputs):
    if isinstance(outputs, (tuple, list)):
        place_logits = outputs[0]
        card_logits = outputs[1] if len(outputs) > 1 else None
        return place_logits, card_logits
    return outputs, None


def _accuracy_from_logits(logits: torch.Tensor, target: torch.Tensor) -> tuple[int, int]:
    return trainer_common.accuracy_from_logits(logits, target, IGNORE_INDEX)


def _build_card_class_weights(
    y_card_train: torch.Tensor,
    device: str,
    no_action_weight: float,
    balance_power: float,
) -> torch.Tensor | None:
    return trainer_common.build_card_class_weights(
        y_card_train, device, CARD_ACTION_DIM, NO_CARD_ACTION_INDEX,
        no_action_weight, balance_power,
    )


def train_model(
    data: DatasetBundle,
    epochs: int,
    batch_size: int,
    lr: float,
    hidden_size: int,
    device: str,
    seed: int,
    val_split: float = 0.1,
    val_split_mode: str = trainer_common.VAL_SPLIT_MODE_GROUPED_GAME,
    early_stop_patience: int = 0,
    early_stop_min_delta: float = 0.0,
    early_stop_min_epochs: int = 0,
    early_stop_monitor: str = "val_loss",
    early_stop_smoothing_window: int = 1,
    lr_plateau_patience: int = 0,
    lr_plateau_factor: float = 0.6,
    lr_plateau_min_lr: float = 1e-5,
    resume_checkpoint: str = "",
    resume_optimizer: bool = False,
    log_interval_steps: int = 0,
    card_loss_weight: float = 2.0,
    card_no_action_weight: float = 0.7,
    card_class_balance_power: float = 0.25,
    winner_sample_boost: float = 0.35,
    loser_sample_weight: float = 0.8,
    draw_sample_weight: float = 1.0,
    corner_emergency_sample_boost: float = 0.0,
    negative_future_disc_sample_boost: float = 0.0,
    negative_future_disc_threshold: float = -1.0,
    tactical_miss_sample_boost: float = 0.0,
    tactical_miss_threshold: float = 0.08,
    hand_pressure_sample_boost: float = 0.0,
    pending_target_sample_boost: float = 0.0,
    corner_balance_sample_boost: float = 0.0,
    edge_balance_sample_boost: float = 0.0,
    economy_balance_sample_boost: float = 0.0,
    include_card_head: bool = False,
) -> tuple[nn.Module, torch.optim.Optimizer, TrainSummary, str | None, list[dict], dict[str, Any]]:
    if epochs < 1:
        raise ValueError("--epochs must be >= 1")
    if batch_size < 1:
        raise ValueError("--batch-size must be >= 1")
    if lr <= 0:
        raise ValueError("--lr must be > 0")
    if hidden_size < 8:
        raise ValueError("--hidden-size must be >= 8")
    if log_interval_steps < 0:
        raise ValueError("--log-interval-steps must be >= 0")
    if val_split < 0 or val_split >= 0.5:
        raise ValueError("--val-split must be in [0,0.5)")
    if card_loss_weight <= 0:
        raise ValueError("--card-loss-weight must be > 0")
    if card_no_action_weight <= 0:
        raise ValueError("--card-no-action-weight must be > 0")
    if card_class_balance_power < 0 or card_class_balance_power > 1:
        raise ValueError("--card-class-balance-power must be in [0,1]")
    if winner_sample_boost < 0:
        raise ValueError("--winner-sample-boost must be >= 0")
    if loser_sample_weight <= 0:
        raise ValueError("--loser-sample-weight must be > 0")
    if draw_sample_weight <= 0:
        raise ValueError("--draw-sample-weight must be > 0")
    if corner_emergency_sample_boost < 0:
        raise ValueError("--corner-emergency-sample-boost must be >= 0")
    if negative_future_disc_sample_boost < 0:
        raise ValueError("--negative-future-disc-sample-boost must be >= 0")
    if not isinstance(negative_future_disc_threshold, (int, float)):
        raise ValueError("--negative-future-disc-threshold must be a number")
    if tactical_miss_sample_boost < 0:
        raise ValueError("--tactical-miss-sample-boost must be >= 0")
    if not isinstance(tactical_miss_threshold, (int, float)) or tactical_miss_threshold < 0:
        raise ValueError("--tactical-miss-threshold must be >= 0")
    if hand_pressure_sample_boost < 0:
        raise ValueError("--hand-pressure-sample-boost must be >= 0")
    if pending_target_sample_boost < 0:
        raise ValueError("--pending-target-sample-boost must be >= 0")
    if corner_balance_sample_boost < 0:
        raise ValueError("--corner-balance-sample-boost must be >= 0")
    if edge_balance_sample_boost < 0:
        raise ValueError("--edge-balance-sample-boost must be >= 0")
    if economy_balance_sample_boost < 0:
        raise ValueError("--economy-balance-sample-boost must be >= 0")
    trainer_common.validate_lr_plateau_args(
        lr_plateau_patience=lr_plateau_patience,
        lr_plateau_factor=lr_plateau_factor,
        lr_plateau_min_lr=lr_plateau_min_lr,
    )
    monitor = trainer_common.normalize_early_stop_monitor(
        early_stop_monitor,
        early_stop_patience=early_stop_patience,
        early_stop_min_delta=early_stop_min_delta,
        early_stop_min_epochs=early_stop_min_epochs,
        early_stop_smoothing_window=early_stop_smoothing_window,
        allowed_monitors=("val_loss", "train_loss", "val_place_loss", "train_place_loss"),
        allowed_monitors_label="val_loss/train_loss/val_place_loss/train_place_loss",
    )

    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)

    card_output_dim = CARD_ACTION_DIM if include_card_head else 0
    model = PolicyNet(INPUT_DIM, hidden_size, PLACE_OUTPUT_DIM, card_output_dim).to(device)
    x = data.x.to(device)
    y_place = data.y_place.to(device)
    y_card = data.y_card.to(device)
    sample_weight = data.sample_weight.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_place_fn = nn.CrossEntropyLoss(ignore_index=IGNORE_INDEX)
    resumed_from = trainer_common.apply_resume_checkpoint(
        "train_policy_onnx", model, opt, resume_checkpoint, resume_optimizer, device,
        expected_board_input_contract=trainer_common.BOARD_INPUT_CONTRACT_SCHEMA,
    )

    train_idx, val_idx, split_summary = trainer_common.resolve_train_val_split(
        int(x.shape[0]),
        val_split,
        device,
        seed=seed,
        split_mode=val_split_mode,
        split_group_keys=data.split_group_keys,
    )

    x_train = x[train_idx]
    y_place_train = y_place[train_idx]
    y_card_train = y_card[train_idx]
    sample_weight_train = sample_weight[train_idx]
    x_val = x[val_idx] if val_idx.shape[0] > 0 else None
    y_place_val = y_place[val_idx] if val_idx.shape[0] > 0 else None
    y_card_val = y_card[val_idx] if val_idx.shape[0] > 0 else None
    train_n = int(x_train.shape[0])
    card_class_weights = _build_card_class_weights(
        y_card_train=y_card_train,
        device=device,
        no_action_weight=card_no_action_weight,
        balance_power=card_class_balance_power,
    ) if include_card_head else None
    if card_class_weights is not None and NO_CARD_ACTION_INDEX is not None:
        print(
            "[train_policy_onnx] "
            f"card_class_weights enabled no_card_weight={float(card_class_weights[int(NO_CARD_ACTION_INDEX)].item()):.4f} "
            f"balance_power={card_class_balance_power:.3f}",
            flush=True,
        )
    loss_card_fn = (
        nn.CrossEntropyLoss(ignore_index=IGNORE_INDEX, weight=card_class_weights)
        if include_card_head and card_output_dim > 0
        else None
    )

    epoch_metrics: list[dict] = []
    global_step = 0
    control = trainer_common.create_monitor_control_state()
    stopped_early = False
    early_stop_epoch = None
    monitor_window_values: list[float] = []

    for epoch_index in range(epochs):
        perm = torch.randperm(train_n, device=device)
        x_epoch = x_train[perm]
        y_place_epoch = y_place_train[perm]
        y_card_epoch = y_card_train[perm]
        sample_weight_epoch = sample_weight_train[perm]
        epoch_loss_sum = 0.0
        epoch_place_loss_sum = 0.0
        epoch_card_loss_sum = 0.0
        epoch_card_loss_batches = 0
        epoch_samples = 0
        epoch_place_correct = 0
        epoch_place_samples = 0
        epoch_card_correct = 0
        epoch_card_samples = 0
        for i in range(0, train_n, batch_size):
            xb = x_epoch[i:i + batch_size]
            yb_place = y_place_epoch[i:i + batch_size]
            yb_card = y_card_epoch[i:i + batch_size]
            wb = sample_weight_epoch[i:i + batch_size]
            outputs = model(xb)
            place_logits, card_logits = _split_outputs(outputs)

            place_loss_raw = F.cross_entropy(
                place_logits,
                yb_place,
                ignore_index=IGNORE_INDEX,
                reduction="none",
            )
            place_mask = (yb_place != IGNORE_INDEX)
            place_weight = wb * place_mask.to(wb.dtype)
            place_weight_sum = torch.clamp(place_weight.sum(), min=1.0)
            place_loss = torch.sum(place_loss_raw * place_weight) / place_weight_sum

            loss = place_loss
            card_loss = None
            if card_logits is not None and loss_card_fn is not None:
                card_loss_raw = F.cross_entropy(
                    card_logits,
                    yb_card,
                    ignore_index=IGNORE_INDEX,
                    weight=card_class_weights,
                    reduction="none",
                )
                card_mask = (yb_card != IGNORE_INDEX)
                card_weight = wb * card_mask.to(wb.dtype)
                card_weight_sum = torch.clamp(card_weight.sum(), min=1.0)
                card_loss = torch.sum(card_loss_raw * card_weight) / card_weight_sum
                loss = place_loss + (card_loss * card_loss_weight)
            with torch.no_grad():
                place_correct, place_samples = _accuracy_from_logits(place_logits, yb_place)
                epoch_place_correct += place_correct
                epoch_place_samples += place_samples
                if card_logits is not None:
                    card_correct, card_samples = _accuracy_from_logits(card_logits, yb_card)
                    epoch_card_correct += card_correct
                    epoch_card_samples += card_samples
                batch_size_now = int(yb_place.shape[0])
                epoch_samples += batch_size_now
                epoch_loss_sum += float(loss.item()) * batch_size_now
                epoch_place_loss_sum += float(place_loss.item()) * batch_size_now
                if card_loss is not None:
                    epoch_card_loss_sum += float(card_loss.item())
                    epoch_card_loss_batches += 1
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            global_step += 1
            if log_interval_steps > 0 and (global_step % log_interval_steps) == 0:
                print(
                    f"[train_policy_onnx] step={global_step} epoch={epoch_index + 1}/{epochs} loss={float(loss.item()):.6f}",
                    flush=True,
                )

        train_loss = epoch_loss_sum / max(1, epoch_samples)
        train_place_loss = epoch_place_loss_sum / max(1, epoch_samples)
        train_card_loss = None
        if epoch_card_loss_batches > 0:
            train_card_loss = epoch_card_loss_sum / epoch_card_loss_batches
        train_place_acc = epoch_place_correct / max(1, epoch_place_samples)
        train_card_acc = None
        if epoch_card_samples > 0:
            train_card_acc = epoch_card_correct / epoch_card_samples
        train_total_samples = epoch_place_samples + epoch_card_samples
        train_total_correct = epoch_place_correct + epoch_card_correct
        train_acc = train_total_correct / max(1, train_total_samples)
        val_loss = None
        val_place_loss = None
        val_card_loss = None
        val_acc = None
        val_place_acc = None
        val_card_acc = None
        if (
            x_val is not None
            and y_place_val is not None
            and y_card_val is not None
            and int(y_place_val.shape[0]) > 0
        ):
            with torch.no_grad():
                outputs_val = model(x_val)
                val_place_logits, val_card_logits = _split_outputs(outputs_val)
                val_place_loss_t = loss_place_fn(val_place_logits, y_place_val)
                total_val_loss = val_place_loss_t
                if val_card_logits is not None and loss_card_fn is not None:
                    val_card_loss_t = loss_card_fn(val_card_logits, y_card_val)
                    total_val_loss = val_place_loss_t + (val_card_loss_t * card_loss_weight)
                    val_card_loss = float(val_card_loss_t.item())
                val_place_loss = float(val_place_loss_t.item())
                val_loss = float(total_val_loss.item())

                val_place_correct, val_place_samples = _accuracy_from_logits(val_place_logits, y_place_val)
                val_card_correct = 0
                val_card_samples = 0
                if val_card_logits is not None:
                    val_card_correct, val_card_samples = _accuracy_from_logits(val_card_logits, y_card_val)
                val_place_acc = val_place_correct / max(1, val_place_samples)
                if val_card_samples > 0:
                    val_card_acc = val_card_correct / max(1, val_card_samples)
                val_total_samples = val_place_samples + val_card_samples
                val_total_correct = val_place_correct + val_card_correct
                val_acc = val_total_correct / max(1, val_total_samples)

        monitor_raw_value = train_loss
        if monitor == "val_loss" and val_loss is not None:
            monitor_raw_value = val_loss
        elif monitor == "train_place_loss":
            monitor_raw_value = train_place_loss
        elif monitor == "val_place_loss" and val_place_loss is not None:
            monitor_raw_value = val_place_loss

        monitor_window_values.append(float(monitor_raw_value))
        if len(monitor_window_values) > early_stop_smoothing_window:
            monitor_window_values.pop(0)
        monitor_value = float(sum(monitor_window_values) / len(monitor_window_values))

        control_update = trainer_common.advance_monitor_control_state(
            control,
            model=model,
            optimizer=opt,
            epoch_number=epoch_index + 1,
            monitor_value=monitor_value,
            early_stop_min_delta=early_stop_min_delta,
            lr_plateau_patience=lr_plateau_patience,
            lr_plateau_factor=lr_plateau_factor,
            lr_plateau_min_lr=lr_plateau_min_lr,
        )
        if control_update.lr_reduced:
            print(
                f"[train_policy_onnx] lr-reduce epoch={epoch_index + 1} "
                f"old_lr={control_update.old_lr:.8f} new_lr={control_update.current_lr:.8f} drops={control.lr_drop_count}",
                flush=True,
            )
        current_lr = control_update.current_lr

        epoch_metrics.append(
            {
                "epoch": epoch_index + 1,
                "epochs": epochs,
                "globalStep": global_step,
                "avgLoss": train_loss,
                "trainLoss": train_loss,
                "trainPlaceLoss": train_place_loss,
                "trainCardLoss": train_card_loss,
                "trainAcc": train_acc,
                "trainPlaceAcc": train_place_acc,
                "trainCardAcc": train_card_acc,
                "valLoss": val_loss,
                "valPlaceLoss": val_place_loss,
                "valCardLoss": val_card_loss,
                "valAcc": val_acc,
                "valPlaceAcc": val_place_acc,
                "valCardAcc": val_card_acc,
                "monitor": monitor,
                "monitorRawValue": monitor_raw_value,
                "monitorValue": monitor_value,
                "monitorSmoothingWindow": early_stop_smoothing_window,
                "cardLossWeight": card_loss_weight,
                "cardNoActionWeight": card_no_action_weight,
                "cardClassBalancePower": card_class_balance_power,
                "winnerSampleBoost": winner_sample_boost,
                "loserSampleWeight": loser_sample_weight,
                "drawSampleWeight": draw_sample_weight,
                "cornerEmergencySampleBoost": corner_emergency_sample_boost,
                "negativeFutureDiscSampleBoost": negative_future_disc_sample_boost,
                "negativeFutureDiscThreshold": negative_future_disc_threshold,
                "tacticalMissSampleBoost": tactical_miss_sample_boost,
                "tacticalMissThreshold": tactical_miss_threshold,
                "handPressureSampleBoost": hand_pressure_sample_boost,
                "pendingTargetSampleBoost": pending_target_sample_boost,
                **trainer_common.build_monitor_control_metrics(control, current_lr=current_lr),
            }
        )

        parts = [
            f"[train_policy_onnx] epoch={epoch_index + 1}/{epochs}",
            f"avg_loss={train_loss:.6f}",
            f"train_place_loss={train_place_loss:.6f}",
            f"train_acc={train_acc:.3f}",
            f"train_place_acc={train_place_acc:.3f}",
        ]
        if train_card_loss is not None:
            parts.append(f"train_card_loss={train_card_loss:.6f}")
        if train_card_acc is not None:
            parts.append(f"train_card_acc={train_card_acc:.3f}")
        if val_loss is not None and val_acc is not None:
            parts.append(f"val_loss={val_loss:.6f}")
            if val_place_loss is not None:
                parts.append(f"val_place_loss={val_place_loss:.6f}")
            if val_card_loss is not None:
                parts.append(f"val_card_loss={val_card_loss:.6f}")
            parts.append(f"val_acc={val_acc:.3f}")
            if val_place_acc is not None:
                parts.append(f"val_place_acc={val_place_acc:.3f}")
            if val_card_acc is not None:
                parts.append(f"val_card_acc={val_card_acc:.3f}")
        parts.append(f"monitor={monitor}")
        parts.append(f"monitor_value_raw={monitor_raw_value:.6f}")
        if early_stop_smoothing_window > 1:
            parts.append(f"monitor_value_sma={monitor_value:.6f}")
        else:
            parts.append(f"monitor_value={monitor_value:.6f}")
        parts.append(f"lr={current_lr:.8f}")
        print(" ".join(parts), flush=True)

        reached_min_epochs = (epoch_index + 1) >= early_stop_min_epochs
        if early_stop_patience > 0 and reached_min_epochs and control.no_improve_count >= early_stop_patience:
            stopped_early = True
            early_stop_epoch = epoch_index + 1
            print(
                f"[train_policy_onnx] early-stop triggered at epoch={early_stop_epoch} "
                f"best_epoch={control.best_epoch} best_{monitor}={control.best_monitor:.6f} "
                f"smoothing_window={early_stop_smoothing_window}",
                flush=True,
            )
            break

    trainer_common.restore_best_training_state(model, opt, control.best_state, control.best_optimizer_state)
    trainer_common.finalize_monitor_control_metrics(
        epoch_metrics,
        control,
        stopped_early=stopped_early,
        early_stop_epoch=early_stop_epoch,
    )

    with torch.no_grad():
        outputs_all = model(x)
        place_logits_all, card_logits_all = _split_outputs(outputs_all)
        place_correct_all, place_samples_all = _accuracy_from_logits(place_logits_all, y_place)
        card_correct_all = 0
        card_samples_all = 0
        if card_logits_all is not None:
            card_correct_all, card_samples_all = _accuracy_from_logits(card_logits_all, y_card)

    place_acc_all = place_correct_all / max(1, place_samples_all)
    card_acc_all = None
    if card_samples_all > 0:
        card_acc_all = card_correct_all / card_samples_all
    total_samples_all = place_samples_all + card_samples_all
    total_correct_all = place_correct_all + card_correct_all
    overall_acc = total_correct_all / max(1, total_samples_all)

    summary = TrainSummary(
        overall_acc=overall_acc,
        place_acc=place_acc_all,
        card_acc=card_acc_all,
        place_samples=place_samples_all,
        card_samples=card_samples_all,
    )
    return model, opt, summary, resumed_from, epoch_metrics, split_summary


def export_onnx(model: nn.Module, onnx_out: str, include_card_head: bool = False) -> None:
    """Delegate to shared helper.  Kept as local name for DeepCFR backward compat."""
    output_names = ["place_logits"]
    dynamic_axes = {
        "obs": {0: "batch"},
        "place_logits": {0: "batch"},
    }
    if include_card_head and CARD_ACTION_DIM > 0:
        output_names.append("card_logits")
        dynamic_axes["card_logits"] = {0: "batch"}
    trainer_common.export_onnx_model(model, onnx_out, INPUT_DIM, output_names, dynamic_axes)


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: DatasetBundle,
    train_summary: TrainSummary,
    device: str,
    split_summary: dict[str, Any] | None,
) -> None:
    include_card_head = bool(getattr(args, "include_card_head", False))
    card_output_dim = CARD_ACTION_DIM if include_card_head else 0
    feature_spec = list(trainer_common.BASE_FEATURE_SPEC)
    if CARD_ACTION_DIM > 0:
        feature_spec += [
            "hand_card_counts_norm",
            "card_candidate_mask",
        ]

    training = trainer_common.build_common_training_meta(args, device)
    trainer_common.apply_split_summary_meta(training, split_summary)
    training.update({
        "includeCardHead": include_card_head,
        "placementPolicyOnly": not include_card_head,
        "cardLossWeight": args.card_loss_weight,
        "cardNoActionWeight": args.card_no_action_weight,
        "cardClassBalancePower": args.card_class_balance_power,
    })

    payload = {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "inputName": "obs",
        "outputName": "place_logits",
        "outputNames": ["place_logits"] + (["card_logits"] if card_output_dim > 0 else []),
        "placeOutputName": "place_logits",
        "cardOutputName": "card_logits" if card_output_dim > 0 else None,
        "inputDim": INPUT_DIM,
        "baseInputDim": BASE_INPUT_DIM,
        "outputDim": PLACE_OUTPUT_DIM,
        "cardOutputDim": card_output_dim,
        "boardSize": BOARD_SIZE,
        "paddedBoardMinCoord": PADDED_BOARD_MIN,
        "paddedBoardMaxCoord": PADDED_BOARD_MAX,
        "paddedBoardSize": PADDED_BOARD_SIZE,
        "boardEnvelopeField": "boardEnvelope",
        "boardMinRowField": "boardMinRow",
        "boardMinColField": "boardMinCol",
        **trainer_common.build_board_input_contract_meta(),
        "actionSpace": "place_padded10" if card_output_dim <= 0 else "place_padded10+card_choice",
        "cardActionIds": CARD_ACTION_IDS if card_output_dim > 0 else [],
        "cardDecisionKinds": ["keep", "use", "destroy", "sell"] if card_output_dim > 0 else [],
        **trainer_common.build_deck_count_feature_meta(),
        "featureSpec": feature_spec,
        "training": training,
        "stats": {
            "recordsRead": data.records_read,
            "trainRecords": data.train_records,
            "placeRecords": data.place_records,
            "cardRecords": data.card_records,
            "winnerRecords": data.winner_records,
            "loserRecords": data.loser_records,
            "drawRecords": data.draw_records,
            "tacticalMissRecords": data.tactical_miss_records,
            "boardInputFilter": data.board_input_filter,
            "trainAccuracy": train_summary.overall_acc,
            "trainPlaceAccuracy": train_summary.place_acc,
            "trainCardAccuracy": train_summary.card_acc,
            "trainPlaceSamples": train_summary.place_samples,
            "trainCardSamples": train_summary.card_samples,
        },
    }
    trainer_common.write_json_payload(path, payload)


def maybe_write_checkpoint(
    checkpoint_out: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    args: argparse.Namespace,
    data: DatasetBundle,
    train_summary: TrainSummary,
    device: str,
    resumed_from: str | None,
    split_summary: dict[str, Any] | None,
) -> None:
    include_card_head = bool(getattr(args, "include_card_head", False))
    card_output_dim = CARD_ACTION_DIM if include_card_head else 0
    ckpt_training = trainer_common.build_common_checkpoint_training(args, device, resumed_from)
    trainer_common.apply_split_summary_meta(ckpt_training, split_summary)
    ckpt_training.update({
        "includeCardHead": include_card_head,
        "placementPolicyOnly": not include_card_head,
        "cardLossWeight": float(args.card_loss_weight),
        "cardNoActionWeight": float(args.card_no_action_weight),
        "cardClassBalancePower": float(args.card_class_balance_power),
    })
    payload = trainer_common.build_model_checkpoint_payload(
        MODEL_SCHEMA_VERSION,
        model,
        optimizer,
        {
            "inputDim": INPUT_DIM,
            "baseInputDim": BASE_INPUT_DIM,
            "placeOutputDim": PLACE_OUTPUT_DIM,
            "cardOutputDim": card_output_dim,
            "boardSize": BOARD_SIZE,
            "paddedBoardMinCoord": PADDED_BOARD_MIN,
            "paddedBoardMaxCoord": PADDED_BOARD_MAX,
            "paddedBoardSize": PADDED_BOARD_SIZE,
            "cardActionIds": CARD_ACTION_IDS if card_output_dim > 0 else [],
            **trainer_common.build_board_input_contract_meta(),
            **trainer_common.build_deck_count_feature_meta(),
        },
        ckpt_training,
        {
            "recordsRead": int(data.records_read),
            "trainRecords": int(data.train_records),
            "placeRecords": int(data.place_records),
            "cardRecords": int(data.card_records),
            "winnerRecords": int(data.winner_records),
            "loserRecords": int(data.loser_records),
            "drawRecords": int(data.draw_records),
            "tacticalMissRecords": int(data.tactical_miss_records),
            "boardInputFilter": data.board_input_filter,
            "trainAccuracy": float(train_summary.overall_acc),
            "trainPlaceAccuracy": float(train_summary.place_acc),
            "trainCardAccuracy": (
                float(train_summary.card_acc)
                if train_summary.card_acc is not None
                else None
            ),
            "trainPlaceSamples": int(train_summary.place_samples),
            "trainCardSamples": int(train_summary.card_samples),
        },
    )
    trainer_common.write_model_checkpoint(checkpoint_out, payload)


def maybe_write_metrics(metrics_out: str, metrics: list[dict]) -> None:
    out = (metrics_out or "").strip()
    if not out:
        return
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for entry in metrics:
            f.write(json.dumps(entry, ensure_ascii=False))
            f.write("\n")


def maybe_write_policy_table(args: argparse.Namespace) -> None:
    out = (args.policy_table_out or "").strip()
    if not out:
        return
    if args.min_visits < 1:
        raise ValueError("--min-visits must be >= 1")
    if args.shape_immediate < 0 or args.shape_immediate > 1:
        raise ValueError("--shape-immediate must be in [0,1]")

    policy_table._TRAINING_CONTEXT["shape_immediate"] = float(args.shape_immediate)
    model = policy_table.train(
        trainer_common.iter_standard_dense_board_records(policy_table.iter_ndjson(args.input)),
        int(args.min_visits),
    )
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)


def main() -> int:
    args = parse_args()
    trainer_common.validate_sample_weight_args(args)
    device = choose_device(str(args.device).strip().lower())
    meta_out = trainer_common.resolve_meta_output_path(args.meta_out, args.onnx_out)

    data = load_dataset(
        args.input,
        winner_sample_boost=float(args.winner_sample_boost),
        loser_sample_weight=float(args.loser_sample_weight),
        draw_sample_weight=float(args.draw_sample_weight),
        corner_emergency_sample_boost=float(args.corner_emergency_sample_boost),
        negative_future_disc_sample_boost=float(args.negative_future_disc_sample_boost),
        negative_future_disc_threshold=float(args.negative_future_disc_threshold),
        tactical_miss_sample_boost=float(args.tactical_miss_sample_boost),
        tactical_miss_threshold=float(args.tactical_miss_threshold),
        hand_pressure_sample_boost=float(args.hand_pressure_sample_boost),
        pending_target_sample_boost=float(args.pending_target_sample_boost),
        corner_balance_sample_boost=float(args.corner_balance_sample_boost),
        edge_balance_sample_boost=float(args.edge_balance_sample_boost),
        economy_balance_sample_boost=float(args.economy_balance_sample_boost),
        include_card_labels=bool(args.include_card_head),
    )
    model, optimizer, train_summary, resumed_from, epoch_metrics, split_summary = train_model(
        data=data,
        epochs=int(args.epochs),
        batch_size=int(args.batch_size),
        lr=float(args.lr),
        hidden_size=int(args.hidden_size),
        device=device,
        seed=int(args.seed),
        val_split=float(args.val_split),
        val_split_mode=str(args.val_split_mode or ""),
        early_stop_patience=int(args.early_stop_patience),
        early_stop_min_delta=float(args.early_stop_min_delta),
        early_stop_min_epochs=int(args.early_stop_min_epochs),
        early_stop_monitor=str(args.early_stop_monitor or ""),
        early_stop_smoothing_window=int(args.early_stop_smoothing_window),
        lr_plateau_patience=int(args.lr_plateau_patience),
        lr_plateau_factor=float(args.lr_plateau_factor),
        lr_plateau_min_lr=float(args.lr_plateau_min_lr),
        resume_checkpoint=str(args.resume_checkpoint or ""),
        resume_optimizer=bool(args.resume_optimizer),
        log_interval_steps=int(args.log_interval_steps),
        card_loss_weight=float(args.card_loss_weight),
        card_no_action_weight=float(args.card_no_action_weight),
        card_class_balance_power=float(args.card_class_balance_power),
        winner_sample_boost=float(args.winner_sample_boost),
        loser_sample_weight=float(args.loser_sample_weight),
        draw_sample_weight=float(args.draw_sample_weight),
        corner_emergency_sample_boost=float(args.corner_emergency_sample_boost),
        negative_future_disc_sample_boost=float(args.negative_future_disc_sample_boost),
        negative_future_disc_threshold=float(args.negative_future_disc_threshold),
        tactical_miss_sample_boost=float(args.tactical_miss_sample_boost),
        tactical_miss_threshold=float(args.tactical_miss_threshold),
        hand_pressure_sample_boost=float(args.hand_pressure_sample_boost),
        pending_target_sample_boost=float(args.pending_target_sample_boost),
        corner_balance_sample_boost=float(args.corner_balance_sample_boost),
        edge_balance_sample_boost=float(args.edge_balance_sample_boost),
        economy_balance_sample_boost=float(args.economy_balance_sample_boost),
        include_card_head=bool(args.include_card_head),
    )
    export_onnx(model, args.onnx_out, include_card_head=bool(args.include_card_head))
    write_meta(meta_out, args, data, train_summary, device, split_summary)
    maybe_write_metrics(str(args.metrics_out or ""), epoch_metrics)
    maybe_write_checkpoint(
        checkpoint_out=str(args.checkpoint_out or ""),
        model=model,
        optimizer=optimizer,
        args=args,
        data=data,
        train_summary=train_summary,
        device=device,
        resumed_from=resumed_from,
        split_summary=split_summary,
    )
    maybe_write_policy_table(args)

    card_acc_text = (
        f" train_card_acc={train_summary.card_acc:.3f}"
        if train_summary.card_acc is not None
        else ""
    )
    print(
        "[train_policy_onnx] "
        f"records={data.records_read} "
        f"train_records={data.train_records} "
        f"place_records={data.place_records} "
        f"card_records={data.card_records} "
        f"winner_records={data.winner_records} "
        f"loser_records={data.loser_records} "
        f"draw_records={data.draw_records} "
        f"tactical_miss_records={data.tactical_miss_records} "
        f"board_rejected_records={data.board_input_filter['rejectedRecords']} "
        f"train_acc={train_summary.overall_acc:.3f} "
        f"train_place_acc={train_summary.place_acc:.3f}"
        f"{card_acc_text} "
        f"onnx={args.onnx_out}"
    )
    if (args.policy_table_out or "").strip():
        print(f"[train_policy_onnx] policy_table={args.policy_table_out}")
    trainer_common.log_trainer_artifact_paths(
        "train_policy_onnx",
        meta_out=meta_out,
        checkpoint_out=args.checkpoint_out,
        metrics_out=args.metrics_out,
        resumed_from=resumed_from,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
