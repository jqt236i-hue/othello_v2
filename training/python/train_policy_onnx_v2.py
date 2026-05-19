#!/usr/bin/env python3
"""Train a CNN+ResNet policy/value network from self-play NDJSON and export ONNX.

This script is the v2 successor to ``train_policy_onnx.py``.  Key differences:

* Uses a lightweight CNN+ResNet instead of a flat MLP so that spatial patterns
  (corners, edges, chains) are learned naturally.
* Accepts **two** inputs: a 2-channel 10x10 board tensor and a 16-dim auxiliary
  vector.
* Trains a **value head** jointly with the policy head so the same network can
  be used for MCTS evaluation later.
* The output ONNX model has two inputs named ``board`` and ``aux``.
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Any

import torch
from torch import nn
from torch.nn import functional as F

import onnx_trainer_common as trainer_common
import train_policy_table as policy_table
from models.cnn_resnet_policy_v2 import build_cnn_model_v2
from models.hand_encoder import build_hand_features_for_record


MODEL_SCHEMA_VERSION = "policy_cnn_onnx.v2"
BOARD_SIZE = 8
PADDED_BOARD_MIN = -1
PADDED_BOARD_MAX = 8
PADDED_BOARD_SIZE = (PADDED_BOARD_MAX - PADDED_BOARD_MIN) + 1
BOARD_FEATURE_DIM = PADDED_BOARD_SIZE * PADDED_BOARD_SIZE
AUX_FEATURE_DIM = 16
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


@dataclass
class DatasetBundle:
    x_board: torch.Tensor          # (N, 5, 10, 10)
    x_aux: torch.Tensor            # (N, 16)
    x_hand: torch.Tensor           # (N, 5, 11) [card_id_idx, cost_norm, type_onehot(9)]
    x_history: torch.Tensor | None # (N, T, 5, 10, 10) or None
    y_place: torch.Tensor          # (N,)
    y_card: torch.Tensor           # (N,)
    y_value: torch.Tensor          # (N,)  # WDL labels: 0=loss, 1=draw, 2=win
    sample_weight: torch.Tensor    # (N,)
    split_group_keys: list[str | None]
    records_read: int
    train_records: int
    place_records: int
    card_records: int
    winner_records: int
    loser_records: int
    draw_records: int
    tactical_miss_records: int


@dataclass
class TrainSummary:
    overall_acc: float
    place_acc: float
    card_acc: float | None
    value_mse: float | None
    place_samples: int
    card_samples: int
    value_samples: int


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train CNN+ResNet ONNX policy model from self-play NDJSON.")
    trainer_common.add_common_args(
        p,
        onnx_out_default=os.path.join("data", "models", "policy-net-cnn.onnx"),
        include_balance_boosts=True,
    )
    p.add_argument(
        "--policy-table-out",
        default=os.path.join("data", "models", "policy-table-cnn.json"),
        help="Optional compatibility policy-table output path. Empty string disables.",
    )
    p.add_argument(
        "--card-loss-weight",
        type=float,
        default=2.0,
        help="Loss weight for card action head (default: 2.0).",
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
    p.add_argument("--min-visits", type=int, default=12, help="Compat policy-table --min-visits.")
    p.add_argument(
        "--shape-immediate",
        type=float,
        default=0.4,
        help="Compat policy-table --shape-immediate in [0,1].",
    )
    # CNN-specific hyperparameters
    p.add_argument("--hidden-channels", type=int, default=32, help="CNN base channels (default: 32).")
    p.add_argument("--num-res-blocks", type=int, default=3, help="ResNet blocks (default: 3).")
    p.add_argument("--value-loss-weight", type=float, default=1.0, help="Weight for value MSE loss (default: 1.0).")
    p.add_argument(
        "--nonvalidity-penalty",
        type=float,
        default=0.0,
        help="Penalty weight for illegal move probability mass (default: 0=off).",
    )
    p.add_argument(
        "--early-stop-monitor",
        default="val_loss",
        help="Metric for early stopping: val_loss/train_loss/val_place_loss/train_place_loss (default: val_loss).",
    )
    p.add_argument(
        "--history-length",
        type=int,
        default=1,
        help="Board history length T. Use 1 to disable history input (default: 1).",
    )
    return p.parse_args()


def parse_board(board: str) -> list[list[str]]:
    if not board:
        return []
    return [list(r) for r in board.split("/")]


def safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def clamp_float(value: float, lower: float, upper: float) -> float:
    return max(float(lower), min(float(upper), float(value)))


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
    if safe_float(rec.get("highBonusMoveAvailable", 0), 0.0) > 0.5:
        return max(max_legal_bonus, 0.6)
    return max_legal_bonus


def corner_sample_intensity(rec: dict) -> float:
    return clamp_float(
        max(
            abs(normalized_corner_balance(rec)),
            safe_float(rec.get("hasCornerMoveNow", 0), 0.0),
            safe_float(rec.get("cornerEmergency", 0), 0.0),
        ),
        0.0,
        1.0,
    )


def edge_sample_intensity(rec: dict) -> float:
    return clamp_float(
        max(
            abs(normalized_edge_balance(rec)),
            safe_float(rec.get("hasEdgeMoveNow", 0), 0.0),
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


def build_board_tensor(rec: dict) -> list[list[list[float]]]:
    """Build a 5-channel 10x10 board tensor from the record.

    Channel 0 = own stones (1.0)
    Channel 1 = opponent stones (1.0)
    Channel 2 = corner mask (1.0 at 4 corners)
    Channel 3 = edge mask (1.0 at non-corner edge cells)
    Channel 4 = empty mask (1.0 at empty cells)
    """
    board_envelope = rec.get("boardEnvelope")
    if isinstance(board_envelope, str) and board_envelope.strip():
        rows = parse_board(board_envelope.strip())
        board_min_row = safe_int(rec.get("boardMinRow"), 0)
        board_min_col = safe_int(rec.get("boardMinCol"), 0)
    else:
        rows = parse_board(str(rec.get("board", "")))
        board_min_row = 0
        board_min_col = 0

    player = normalized_player(rec.get("player"))
    own_char = "B" if player == "black" else "W"
    opp_char = "W" if own_char == "B" else "B"

    size = PADDED_BOARD_SIZE
    # Initialise 5 x 10 x 10 with zeros
    tensor: list[list[list[float]]] = [
        [[0.0 for _ in range(size)] for _ in range(size)]
        for _ in range(5)
    ]

    for local_row, row in enumerate(rows):
        if not isinstance(row, list):
            continue
        for local_col, ch in enumerate(row):
            global_row = board_min_row + local_row
            global_col = board_min_col + local_col
            if global_row < PADDED_BOARD_MIN or global_row > PADDED_BOARD_MAX:
                continue
            if global_col < PADDED_BOARD_MIN or global_col > PADDED_BOARD_MAX:
                continue
            r = global_row - PADDED_BOARD_MIN
            c = global_col - PADDED_BOARD_MIN
            if ch == own_char:
                tensor[0][r][c] = 1.0
            elif ch == opp_char:
                tensor[1][r][c] = 1.0
            else:
                tensor[4][r][c] = 1.0

    # Channel 2: corner mask
    corners = [(0, 0), (0, size - 1), (size - 1, 0), (size - 1, size - 1)]
    for r, c in corners:
        tensor[2][r][c] = 1.0

    # Channel 3: edge mask (non-corner edges)
    for i in range(1, size - 1):
        tensor[3][0][i] = 1.0
        tensor[3][size - 1][i] = 1.0
        tensor[3][i][0] = 1.0
        tensor[3][i][size - 1] = 1.0

    return tensor


def build_board_tensor_with_history(rec: dict, history_length: int = 8) -> list[list[list[list[float]]]] | None:
    """Build a T x 5 x 10 x 10 history tensor from the record.

    Looks for 'boardHistory' field in the record.  If missing, returns None.
    Each history entry should be a board string in the same format as 'board'.
    Pads with zeros if history is shorter than history_length.
    """
    history_raw = rec.get("boardHistory")
    if not isinstance(history_raw, list) or len(history_raw) == 0:
        return None

    # Build tensors for available history steps
    history_tensors = []
    for board_str in history_raw[-history_length:]:
        if not isinstance(board_str, str):
            continue
        # Create a mock record with just the board field
        mock_rec = {"board": board_str, "player": rec.get("player", "white")}
        tensor = build_board_tensor(mock_rec)
        history_tensors.append(tensor)

    # Pad with zeros if needed
    empty_tensor = [[[0.0 for _ in range(PADDED_BOARD_SIZE)] for _ in range(PADDED_BOARD_SIZE)] for _ in range(5)]
    while len(history_tensors) < history_length:
        history_tensors.insert(0, empty_tensor)

    return history_tensors


def build_empty_board_history(history_length: int) -> list[list[list[list[float]]]]:
    """Build a zero-filled T x 5 x 10 x 10 history tensor."""
    return [
        [
            [[0.0 for _ in range(PADDED_BOARD_SIZE)] for _ in range(PADDED_BOARD_SIZE)]
            for _ in range(5)
        ]
        for _ in range(history_length)
    ]


def build_aux_vector(rec: dict) -> list[float]:
    """Build the 16-dimensional auxiliary feature vector."""
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

    player = normalized_player(rec.get("player"))
    own_charge = charge_black if player == "black" else charge_white
    opp_charge = charge_white if player == "black" else charge_black
    disc_diff = (black_before - white_before) if player == "black" else (white_before - black_before)
    deck_count_ratio = trainer_common.resolve_deck_count_ratio(rec)

    return [
        legal_moves / 60.0,
        disc_diff / 64.0,
        own_charge / CHARGE_MAX,
        opp_charge / CHARGE_MAX,
        deck_count_ratio,
        pending_flag,
        own_corners / 4.0,
        opp_corners / 4.0,
        own_edges / 24.0,
        opp_edges / 24.0,
        max(0.0, min(1.0, has_corner_move)),
        max(0.0, min(1.0, has_edge_move)),
        max(0.0, min(1.0, corner_emergency)),
        max(0.0, min(1.0, corner_hold_mode)),
        max(0.0, min(1.0, high_bonus_move)),
        max(0.0, min(1.0, max_legal_bonus / 5.0)),
    ]


def build_card_counts(card_ids: list[str] | None) -> dict[str, int]:
    if not isinstance(card_ids, list):
        return {}
    out: dict[str, int] = {}
    for one in card_ids:
        if not isinstance(one, str):
            continue
        card_id = one.strip()
        if not card_id:
            continue
        out[card_id] = out.get(card_id, 0) + 1
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


def place_target_index(rec: dict) -> int | None:
    if rec.get("actionType") != "place":
        return None
    row = rec.get("row")
    col = rec.get("col")
    if not isinstance(row, int) or not isinstance(col, int):
        return None
    if row < 0 or row >= BOARD_SIZE or col < 0 or col >= BOARD_SIZE:
        return None
    # Map 8x8 coordinates to padded 10x10 index
    global_row = row  # boardMinRow is 0 for legacy boards
    global_col = col
    return ((global_row - PADDED_BOARD_MIN) * PADDED_BOARD_SIZE) + (global_col - PADDED_BOARD_MIN)


def card_target_index(rec: dict) -> int | None:
    if CARD_ACTION_DIM <= 0:
        return None
    action_type = rec.get("actionType")
    target_card_id = resolve_card_target_card_id(rec)
    if isinstance(target_card_id, str):
        return CARD_ACTION_INDEX.get(target_card_id)

    if action_type == "place" and NO_CARD_ACTION_INDEX is not None:
        if resolve_card_candidate_ids(rec):
            return int(NO_CARD_ACTION_INDEX)
    return None


def value_target(rec: dict) -> int:
    """Return WDL label: 0=loss, 1=draw, 2=win.

    CrossEntropyLoss expects class indices starting from 0.
    """
    outcome = rec.get("outcome")
    if isinstance(outcome, (int, float)):
        val = clamp_float(float(outcome), -1.0, 1.0)
        if val > 0.5:
            return 2  # win
        if val < -0.5:
            return 0  # loss
        return 1  # draw

    winner = rec.get("winner")
    player = rec.get("player")
    if isinstance(winner, str) and isinstance(player, str):
        winner_norm = winner.strip().lower()
        player_norm = player.strip().lower()
        if winner_norm == "draw":
            return 1
        if winner_norm == player_norm:
            return 2
        return 0
    return 1


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
    history_length: int = 1,
) -> DatasetBundle:
    x_boards: list[list[list[list[float]]]] = []
    x_auxs: list[list[float]] = []
    x_hands: list[list[list[float]]] = []
    x_histories: list[list[list[list[list[float]]]]] | None = [] if history_length > 1 else None
    y_place: list[int] = []
    y_card: list[int] = []
    y_value: list[float] = []
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

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records_read += 1
            rec = json.loads(line)
            place_t = place_target_index(rec)
            card_t = card_target_index(rec)
            if place_t is None and card_t is None:
                continue

            x_boards.append(build_board_tensor(rec))
            x_auxs.append(build_aux_vector(rec))
            x_hands.append(build_hand_features_for_record(rec.get("handCards")))
            if x_histories is not None:
                hist = build_board_tensor_with_history(rec, history_length)
                x_histories.append(hist if hist is not None else build_empty_board_history(history_length))
            y_place.append(place_t if place_t is not None else IGNORE_INDEX)
            y_card.append(card_t if card_t is not None else IGNORE_INDEX)
            y_value.append(value_target(rec))
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
        raise ValueError("no training records were found in input data")

    x_board_tensor = torch.tensor(x_boards, dtype=torch.float32)
    x_aux_tensor = torch.tensor(x_auxs, dtype=torch.float32)
    x_hand_tensor = torch.tensor(x_hands, dtype=torch.float32)
    x_history_tensor = (
        torch.tensor(x_histories, dtype=torch.float32)
        if x_histories is not None
        else None
    )
    y_place_tensor = torch.tensor(y_place, dtype=torch.long)
    y_card_tensor = torch.tensor(y_card, dtype=torch.long)
    y_value_tensor = torch.tensor(y_value, dtype=torch.long)
    sample_weight_tensor = torch.tensor(sample_weight, dtype=torch.float32)

    return DatasetBundle(
        x_board=x_board_tensor,
        x_aux=x_aux_tensor,
        x_hand=x_hand_tensor,
        x_history=x_history_tensor,
        y_place=y_place_tensor,
        y_card=y_card_tensor,
        y_value=y_value_tensor,
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
    )


def train_model(
    data: DatasetBundle,
    epochs: int,
    batch_size: int,
    lr: float,
    hidden_channels: int,
    num_res_blocks: int,
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
    value_loss_weight: float = 1.0,
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
    nonvalidity_penalty: float = 0.0,
    history_length: int = 1,
) -> tuple[nn.Module, torch.optim.Optimizer, TrainSummary, str | None, list[dict], dict[str, Any]]:
    if epochs < 1:
        raise ValueError("--epochs must be >= 1")
    if batch_size < 1:
        raise ValueError("--batch-size must be >= 1")
    if lr <= 0:
        raise ValueError("--lr must be > 0")
    if hidden_channels < 8:
        raise ValueError("--hidden-channels must be >= 8")
    if num_res_blocks < 1:
        raise ValueError("--num-res-blocks must be >= 1")
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
    if value_loss_weight < 0:
        raise ValueError("--value-loss-weight must be >= 0")
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
    if tactical_miss_sample_boost < 0:
        raise ValueError("--tactical-miss-sample-boost must be >= 0")
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
    if nonvalidity_penalty < 0:
        raise ValueError("--nonvalidity-penalty must be >= 0")

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

    model = build_cnn_model_v2(
        board_channels=5,
        aux_dim=AUX_FEATURE_DIM,
        hand_size=5,
        hidden_channels=hidden_channels,
        num_res_blocks=num_res_blocks,
        policy_output_dim=PLACE_OUTPUT_DIM,
        card_output_dim=CARD_ACTION_DIM,
        use_wdl_head=True,
        history_length=history_length,
    ).to(device)

    x_board = data.x_board.to(device)
    x_aux = data.x_aux.to(device)
    x_hand = data.x_hand.to(device)
    x_history = data.x_history.to(device) if data.x_history is not None else None
    y_place = data.y_place.to(device)
    y_card = data.y_card.to(device)
    y_value = data.y_value.to(device)
    sample_weight = data.sample_weight.to(device)

    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_place_fn = nn.CrossEntropyLoss(ignore_index=IGNORE_INDEX)
    loss_wdl_fn = nn.CrossEntropyLoss()

    resumed_from = trainer_common.apply_resume_checkpoint(
        "train_policy_onnx_v2", model, opt, resume_checkpoint, resume_optimizer, device,
    )

    train_idx, val_idx, split_summary = trainer_common.resolve_train_val_split(
        int(x_board.shape[0]),
        val_split,
        device,
        seed=seed,
        split_mode=val_split_mode,
        split_group_keys=data.split_group_keys,
    )

    x_board_train = x_board[train_idx]
    x_aux_train = x_aux[train_idx]
    x_hand_train = x_hand[train_idx]
    x_history_train = x_history[train_idx] if x_history is not None else None
    y_place_train = y_place[train_idx]
    y_card_train = y_card[train_idx]
    y_value_train = y_value[train_idx]
    sample_weight_train = sample_weight[train_idx]

    x_board_val = x_board[val_idx] if val_idx.shape[0] > 0 else None
    x_aux_val = x_aux[val_idx] if val_idx.shape[0] > 0 else None
    x_hand_val = x_hand[val_idx] if val_idx.shape[0] > 0 else None
    x_history_val = x_history[val_idx] if (x_history is not None and val_idx.shape[0] > 0) else None
    y_place_val = y_place[val_idx] if val_idx.shape[0] > 0 else None
    y_card_val = y_card[val_idx] if val_idx.shape[0] > 0 else None
    y_value_val = y_value[val_idx] if val_idx.shape[0] > 0 else None

    train_n = int(x_board_train.shape[0])

    card_class_weights = trainer_common.build_card_class_weights(
        y_card_train=y_card_train,
        device=device,
        card_action_dim=CARD_ACTION_DIM,
        no_card_action_index=NO_CARD_ACTION_INDEX,
        no_action_weight=card_no_action_weight,
        balance_power=card_class_balance_power,
    )
    if card_class_weights is not None and NO_CARD_ACTION_INDEX is not None:
        print(
            f"[train_policy_onnx_v2] card_class_weights enabled no_card_weight={float(card_class_weights[int(NO_CARD_ACTION_INDEX)].item()):.4f} "
            f"balance_power={card_class_balance_power:.3f}",
            flush=True,
        )
    loss_card_fn = (
        nn.CrossEntropyLoss(ignore_index=IGNORE_INDEX, weight=card_class_weights)
        if CARD_ACTION_DIM > 0
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
        x_board_epoch = x_board_train[perm]
        x_aux_epoch = x_aux_train[perm]
        x_hand_epoch = x_hand_train[perm]
        x_history_epoch = x_history_train[perm] if x_history_train is not None else None
        y_place_epoch = y_place_train[perm]
        y_card_epoch = y_card_train[perm]
        y_value_epoch = y_value_train[perm]
        sample_weight_epoch = sample_weight_train[perm]

        epoch_loss_sum = 0.0
        epoch_place_loss_sum = 0.0
        epoch_wdl_loss_sum = 0.0
        epoch_card_loss_sum = 0.0
        epoch_card_loss_batches = 0
        epoch_samples = 0
        epoch_place_correct = 0
        epoch_place_samples = 0
        epoch_card_correct = 0
        epoch_card_samples = 0
        epoch_wdl_correct = 0
        epoch_wdl_samples = 0

        for i in range(0, train_n, batch_size):
            xb_board = x_board_epoch[i : i + batch_size]
            xb_aux = x_aux_epoch[i : i + batch_size]
            xb_hand = x_hand_epoch[i : i + batch_size]
            xb_history = x_history_epoch[i : i + batch_size] if x_history_epoch is not None else None
            yb_place = y_place_epoch[i : i + batch_size]
            yb_card = y_card_epoch[i : i + batch_size]
            yb_value = y_value_epoch[i : i + batch_size]
            wb = sample_weight_epoch[i : i + batch_size]

            if xb_history is not None:
                outputs = model(xb_board, xb_aux, xb_hand, history_boards=xb_history)
            else:
                outputs = model(xb_board, xb_aux, xb_hand)
            if isinstance(outputs, tuple):
                place_logits = outputs[0]
                wdl_logits = outputs[1] if model.use_wdl_head else None
                card_logits = outputs[2] if model.card_output_dim > 0 else None
            else:
                place_logits = outputs
                wdl_logits = None
                card_logits = None

            # Place loss with optional nonvalidity penalty
            place_loss_raw = F.cross_entropy(
                place_logits, yb_place, ignore_index=IGNORE_INDEX, reduction="none"
            )
            place_mask = yb_place != IGNORE_INDEX
            place_weight = wb * place_mask.to(wb.dtype)
            place_weight_sum = torch.clamp(place_weight.sum(), min=1.0)
            place_loss = torch.sum(place_loss_raw * place_weight) / place_weight_sum

            # Nonvalidity penalty: suppress probability mass on illegal moves
            if nonvalidity_penalty > 0:
                # Build legal mask from target indices (simplified)
                legal_mask = torch.zeros_like(place_logits)
                valid_indices = yb_place[place_mask]
                if valid_indices.numel() > 0:
                    batch_indices = torch.nonzero(place_mask, as_tuple=False).squeeze(-1)
                    legal_mask[batch_indices, valid_indices] = 1.0
                illegal_probs = F.softmax(place_logits, dim=-1) * (1.0 - legal_mask)
                nonvalidity_loss = nonvalidity_penalty * illegal_probs.sum(dim=-1).mean()
                place_loss = place_loss + nonvalidity_loss

            loss = place_loss
            total_weight_sum = place_weight_sum

            # WDL loss
            if wdl_logits is not None and value_loss_weight > 0:
                value_mask = yb_place != IGNORE_INDEX  # Only train WDL on place actions
                if value_mask.any():
                    wdl_loss_raw = F.cross_entropy(
                        wdl_logits, yb_value, reduction="none"
                    )
                    value_weight = wb * value_mask.to(wb.dtype)
                    value_weight_sum = torch.clamp(value_weight.sum(), min=1.0)
                    wdl_loss = torch.sum(wdl_loss_raw * value_weight) / value_weight_sum
                    loss = loss + wdl_loss * value_loss_weight
                    total_weight_sum = total_weight_sum + value_weight_sum
                    with torch.no_grad():
                        epoch_wdl_loss_sum += float(wdl_loss.item()) * float(value_weight_sum.item())
                        epoch_wdl_samples += int(value_mask.sum().item())
                        # WDL accuracy
                        wdl_pred = wdl_logits.argmax(dim=-1)
                        epoch_wdl_correct += int((wdl_pred == yb_value)[value_mask].sum().item())

            # Card loss
            if card_logits is not None and loss_card_fn is not None:
                card_loss_raw = F.cross_entropy(
                    card_logits,
                    yb_card,
                    ignore_index=IGNORE_INDEX,
                    weight=card_class_weights,
                    reduction="none",
                )
                card_mask = yb_card != IGNORE_INDEX
                card_weight = wb * card_mask.to(wb.dtype)
                card_weight_sum = torch.clamp(card_weight.sum(), min=1.0)
                card_loss = torch.sum(card_loss_raw * card_weight) / card_weight_sum
                loss = loss + card_loss * card_loss_weight
                with torch.no_grad():
                    epoch_card_loss_sum += float(card_loss.item())
                    epoch_card_loss_batches += 1
                    card_correct, card_samples = trainer_common.accuracy_from_logits(card_logits, yb_card, IGNORE_INDEX)
                    epoch_card_correct += card_correct
                    epoch_card_samples += card_samples

            with torch.no_grad():
                place_correct, place_samples = trainer_common.accuracy_from_logits(place_logits, yb_place, IGNORE_INDEX)
                epoch_place_correct += place_correct
                epoch_place_samples += place_samples
                batch_size_now = int(yb_place.shape[0])
                epoch_samples += batch_size_now
                epoch_loss_sum += float(loss.item()) * batch_size_now
                epoch_place_loss_sum += float(place_loss.item()) * batch_size_now

            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            global_step += 1
            if log_interval_steps > 0 and (global_step % log_interval_steps) == 0:
                print(
                    f"[train_policy_onnx_v2] step={global_step} epoch={epoch_index + 1}/{epochs} loss={float(loss.item()):.6f}",
                    flush=True,
                )

        train_loss = epoch_loss_sum / max(1, epoch_samples)
        train_place_loss = epoch_place_loss_sum / max(1, epoch_samples)
        train_wdl_loss = epoch_wdl_loss_sum / max(1, epoch_wdl_samples) if epoch_wdl_samples > 0 else None
        train_card_loss = epoch_card_loss_sum / max(1, epoch_card_loss_batches) if epoch_card_loss_batches > 0 else None
        train_place_acc = epoch_place_correct / max(1, epoch_place_samples)
        train_card_acc = epoch_card_correct / max(1, epoch_card_samples) if epoch_card_samples > 0 else None
        train_wdl_acc = epoch_wdl_correct / max(1, epoch_wdl_samples) if epoch_wdl_samples > 0 else None
        train_total_samples = epoch_place_samples + epoch_card_samples + epoch_wdl_samples
        train_total_correct = epoch_place_correct + epoch_card_correct + epoch_wdl_correct
        train_acc = train_total_correct / max(1, train_total_samples)

        val_loss = None
        val_place_loss = None
        val_wdl_loss = None
        val_card_loss = None
        val_acc = None
        val_place_acc = None
        val_card_acc = None
        val_wdl_acc = None

        if (
            x_board_val is not None
            and y_place_val is not None
            and int(y_place_val.shape[0]) > 0
        ):
            with torch.no_grad():
                if x_history_val is not None:
                    outputs_val = model(x_board_val, x_aux_val, x_hand_val, history_boards=x_history_val)
                else:
                    outputs_val = model(x_board_val, x_aux_val, x_hand_val)
                if isinstance(outputs_val, tuple):
                    val_place_logits = outputs_val[0]
                    val_wdl_logits = outputs_val[1] if model.use_wdl_head else None
                    val_card_logits = outputs_val[2] if model.card_output_dim > 0 else None
                else:
                    val_place_logits = outputs_val
                    val_wdl_logits = None
                    val_card_logits = None

                val_place_loss_t = loss_place_fn(val_place_logits, y_place_val)
                total_val_loss = val_place_loss_t

                if val_wdl_logits is not None and value_loss_weight > 0 and y_value_val is not None:
                    val_value_mask = y_place_val != IGNORE_INDEX
                    if val_value_mask.any():
                        val_wdl_loss_t = F.cross_entropy(
                            val_wdl_logits[val_value_mask],
                            y_value_val[val_value_mask],
                        )
                        total_val_loss = total_val_loss + val_wdl_loss_t * value_loss_weight
                        val_wdl_loss = float(val_wdl_loss_t.item())
                        val_wdl_pred = val_wdl_logits.argmax(dim=-1)
                        val_wdl_acc = float((val_wdl_pred == y_value_val)[val_value_mask].float().mean().item())

                if val_card_logits is not None and loss_card_fn is not None and y_card_val is not None:
                    val_card_loss_t = loss_card_fn(val_card_logits, y_card_val)
                    total_val_loss = total_val_loss + val_card_loss_t * card_loss_weight
                    val_card_loss = float(val_card_loss_t.item())

                val_place_loss = float(val_place_loss_t.item())
                val_loss = float(total_val_loss.item())

                val_place_correct, val_place_samples = trainer_common.accuracy_from_logits(val_place_logits, y_place_val, IGNORE_INDEX)
                val_card_correct = 0
                val_card_samples = 0
                if val_card_logits is not None and y_card_val is not None:
                    val_card_correct, val_card_samples = trainer_common.accuracy_from_logits(val_card_logits, y_card_val, IGNORE_INDEX)
                val_place_acc = val_place_correct / max(1, val_place_samples)
                if val_card_samples > 0:
                    val_card_acc = val_card_correct / max(1, val_card_samples)
                val_total_samples = val_place_samples + val_card_samples + (val_value_mask.sum().item() if val_wdl_logits is not None else 0)
                val_total_correct = val_place_correct + val_card_correct + (val_wdl_pred == y_value_val)[val_value_mask].sum().item() if val_wdl_logits is not None else val_place_correct + val_card_correct
                if val_total_samples > 0:
                    val_acc = val_total_correct / val_total_samples

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
                f"[train_policy_onnx_v2] lr-reduce epoch={epoch_index + 1} "
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
                "trainValueMse": train_value_mse,
                "trainCardLoss": train_card_loss,
                "trainAcc": train_acc,
                "trainPlaceAcc": train_place_acc,
                "trainCardAcc": train_card_acc,
                "valLoss": val_loss,
                "valPlaceLoss": val_place_loss,
                "valValueMse": val_value_mse,
                "valCardLoss": val_card_loss,
                "valAcc": val_acc,
                "valPlaceAcc": val_place_acc,
                "valCardAcc": val_card_acc,
                "monitor": monitor,
                "monitorRawValue": monitor_raw_value,
                "monitorValue": monitor_value,
                "monitorSmoothingWindow": early_stop_smoothing_window,
                "cardLossWeight": card_loss_weight,
                "valueLossWeight": value_loss_weight,
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
            f"[train_policy_onnx_v2] epoch={epoch_index + 1}/{epochs}",
            f"avg_loss={train_loss:.6f}",
            f"train_place_loss={train_place_loss:.6f}",
            f"train_acc={train_acc:.3f}",
            f"train_place_acc={train_place_acc:.3f}",
        ]
        if train_value_mse is not None:
            parts.append(f"train_value_mse={train_value_mse:.6f}")
        if train_card_loss is not None:
            parts.append(f"train_card_loss={train_card_loss:.6f}")
        if train_card_acc is not None:
            parts.append(f"train_card_acc={train_card_acc:.3f}")
        if val_loss is not None and val_acc is not None:
            parts.append(f"val_loss={val_loss:.6f}")
            if val_place_loss is not None:
                parts.append(f"val_place_loss={val_place_loss:.6f}")
            if val_value_mse is not None:
                parts.append(f"val_value_mse={val_value_mse:.6f}")
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
                f"[train_policy_onnx_v2] early-stop triggered at epoch={early_stop_epoch} "
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
        outputs_all = model(x_board, x_aux)
        if isinstance(outputs_all, tuple):
            place_logits_all = outputs_all[0]
            value_pred_all = outputs_all[1] if model.use_value_head else None
            card_logits_all = outputs_all[2] if model.card_output_dim > 0 else None
        else:
            place_logits_all = outputs_all
            value_pred_all = None
            card_logits_all = None

        place_correct_all, place_samples_all = trainer_common.accuracy_from_logits(place_logits_all, y_place, IGNORE_INDEX)
        card_correct_all = 0
        card_samples_all = 0
        if card_logits_all is not None:
            card_correct_all, card_samples_all = trainer_common.accuracy_from_logits(card_logits_all, y_card, IGNORE_INDEX)

        value_mse_all = None
        value_samples_all = 0
        if value_pred_all is not None:
            value_mask = y_place != IGNORE_INDEX
            if value_mask.any():
                value_mse_all = float(F.mse_loss(value_pred_all.squeeze(-1)[value_mask], y_value[value_mask]).item())
                value_samples_all = int(value_mask.sum().item())

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
        value_mse=value_mse_all,
        place_samples=place_samples_all,
        card_samples=card_samples_all,
        value_samples=value_samples_all,
    )
    return model, opt, summary, resumed_from, epoch_metrics, split_summary


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    """Export the CNN model to ONNX (3 or 4 inputs depending on history)."""
    os.makedirs(os.path.dirname(onnx_out) or ".", exist_ok=True)
    model.eval()
    dummy_board = torch.zeros((1, 5, PADDED_BOARD_SIZE, PADDED_BOARD_SIZE), dtype=torch.float32)
    dummy_aux = torch.zeros((1, AUX_FEATURE_DIM), dtype=torch.float32)
    dummy_hand = torch.zeros((1, 5, 11), dtype=torch.float32)

    inputs = (dummy_board, dummy_aux, dummy_hand)
    input_names = ["board", "aux", "hand"]
    dynamic_axes = {
        "board": {0: "batch"},
        "aux": {0: "batch"},
        "hand": {0: "batch"},
        "place_logits": {0: "batch"},
    }

    # Add history input if model was trained with T > 1
    if hasattr(model, "history_length") and model.history_length > 1:
        dummy_history = torch.zeros((1, model.history_length, 5, PADDED_BOARD_SIZE, PADDED_BOARD_SIZE), dtype=torch.float32)
        inputs = (dummy_board, dummy_aux, dummy_hand, dummy_history)
        input_names.append("history")
        dynamic_axes["history"] = {0: "batch"}

    output_names = ["place_logits"]
    if model.use_wdl_head:
        output_names.append("wdl_logits")
        dynamic_axes["wdl_logits"] = {0: "batch"}
    if model.card_output_dim > 0:
        output_names.append("card_logits")
        dynamic_axes["card_logits"] = {0: "batch"}

    torch.onnx.export(
        model.cpu(),
        inputs,
        onnx_out,
        input_names=input_names,
        output_names=output_names,
        dynamic_axes=dynamic_axes,
        opset_version=17,
    )


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: DatasetBundle,
    train_summary: TrainSummary,
    device: str,
    split_summary: dict[str, Any] | None,
) -> None:
    feature_spec = [
        "board_10x10_5ch",
        "legal_moves_norm",
        "disc_diff_before_norm",
        "own_charge_norm",
        "opp_charge_norm",
        "deck_count_norm",
        "pending_flag",
        "own_corners_norm",
        "opp_corners_norm",
        "own_edges_norm",
        "opp_edges_norm",
        "has_corner_move_now_flag",
        "has_edge_move_now_flag",
        "corner_emergency_flag",
        "corner_hold_mode_flag",
        "high_bonus_move_available_flag",
        "max_legal_move_bonus_norm",
        "hand_card_id_embedding",
        "hand_card_cost",
        "hand_card_type_onehot",
    ]
    if CARD_ACTION_DIM > 0:
        feature_spec += ["hand_card_counts_norm", "usable_card_mask"]

    training = trainer_common.build_common_training_meta(args, device)
    trainer_common.apply_split_summary_meta(training, split_summary)
    training.update({
        "cardLossWeight": args.card_loss_weight,
        "cardNoActionWeight": args.card_no_action_weight,
        "cardClassBalancePower": args.card_class_balance_power,
        "valueLossWeight": args.value_loss_weight,
        "hiddenChannels": args.hidden_channels,
        "numResBlocks": args.num_res_blocks,
    })

    payload = {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "inputName": "board",
        "auxInputName": "aux",
        "handInputName": "hand",
        "outputName": "place_logits",
        "outputNames": ["place_logits"]
            + (["wdl_logits"] if True else [])
            + (["card_logits"] if CARD_ACTION_DIM > 0 else []),
        "placeOutputName": "place_logits",
        "wdlOutputName": "wdl_logits",
        "cardOutputName": "card_logits" if CARD_ACTION_DIM > 0 else None,
        "boardSize": BOARD_SIZE,
        "paddedBoardSize": PADDED_BOARD_SIZE,
        "boardChannels": 5,
        "auxDim": AUX_FEATURE_DIM,
        "handDim": 11,
        "handSize": 5,
        "placeOutputDim": PLACE_OUTPUT_DIM,
        "cardOutputDim": CARD_ACTION_DIM,
        "actionSpace": "place_padded10+card_choice",
        "cardActionIds": CARD_ACTION_IDS,
        "cardDecisionKinds": ["keep", "use", "destroy", "sell"],
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
            "trainAccuracy": train_summary.overall_acc,
            "trainPlaceAccuracy": train_summary.place_acc,
            "trainCardAccuracy": train_summary.card_acc,
            "trainWdlLoss": train_summary.value_mse,
            "trainPlaceSamples": train_summary.place_samples,
            "trainCardSamples": train_summary.card_samples,
            "trainWdlSamples": train_summary.value_samples,
        },
    }
    trainer_common.write_json_payload(path, payload)


def main() -> int:
    args = parse_args()
    trainer_common.validate_sample_weight_args(args)
    device = trainer_common.choose_device(str(args.device).strip().lower())
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
        history_length=max(1, int(args.history_length)),
        nonvalidity_penalty=float(args.nonvalidity_penalty),
    )

    model, optimizer, train_summary, resumed_from, epoch_metrics, split_summary = train_model(
        data=data,
        epochs=int(args.epochs),
        batch_size=int(args.batch_size),
        lr=float(args.lr),
        hidden_channels=int(args.hidden_channels),
        num_res_blocks=int(args.num_res_blocks),
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
        value_loss_weight=float(args.value_loss_weight),
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
        history_length=max(1, int(args.history_length)),
    )

    export_onnx(model, args.onnx_out)
    write_meta(meta_out, args, data, train_summary, device, split_summary)

    if args.metrics_out:
        trainer_common.write_json_payload(args.metrics_out, {"metrics": epoch_metrics})

    if args.checkpoint_out:
        ckpt_training = trainer_common.build_common_checkpoint_training(args, device, resumed_from)
        trainer_common.apply_split_summary_meta(ckpt_training, split_summary)
        ckpt_training.update({
            "cardLossWeight": float(args.card_loss_weight),
            "cardNoActionWeight": float(args.card_no_action_weight),
            "cardClassBalancePower": float(args.card_class_balance_power),
            "valueLossWeight": float(args.value_loss_weight),
            "hiddenChannels": int(args.hidden_channels),
            "numResBlocks": int(args.num_res_blocks),
        })
        payload = trainer_common.build_model_checkpoint_payload(
            MODEL_SCHEMA_VERSION,
            model,
            optimizer,
            {
                "paddedBoardSize": PADDED_BOARD_SIZE,
                "boardChannels": 2,
                "auxDim": AUX_FEATURE_DIM,
                "placeOutputDim": PLACE_OUTPUT_DIM,
                "cardOutputDim": CARD_ACTION_DIM,
                "cardActionIds": CARD_ACTION_IDS,
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
                "trainAccuracy": float(train_summary.overall_acc),
                "trainPlaceAccuracy": float(train_summary.place_acc),
                "trainCardAccuracy": float(train_summary.card_acc) if train_summary.card_acc is not None else None,
                "trainValueMse": float(train_summary.value_mse) if train_summary.value_mse is not None else None,
                "trainPlaceSamples": int(train_summary.place_samples),
                "trainCardSamples": int(train_summary.card_samples),
                "trainValueSamples": int(train_summary.value_samples),
            },
        )
        trainer_common.write_model_checkpoint(args.checkpoint_out, payload)

    if args.policy_table_out:
        policy_table._TRAINING_CONTEXT["shape_immediate"] = float(args.shape_immediate)
        table_model = policy_table.train(policy_table.iter_ndjson(args.input), int(args.min_visits))
        os.makedirs(os.path.dirname(args.policy_table_out) or ".", exist_ok=True)
        with open(args.policy_table_out, "w", encoding="utf-8") as f:
            json.dump(table_model, f, ensure_ascii=False, indent=2)

    print(f"[train_policy_onnx_v2] done. ONNX={args.onnx_out} meta={meta_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
