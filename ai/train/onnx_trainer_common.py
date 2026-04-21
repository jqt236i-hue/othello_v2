#!/usr/bin/env python3
"""Shared helpers for ONNX trainer artifact and checkpoint handling.

Trainers import this module and call ``add_common_args`` to build a CLI
parser with the ~25 flags shared across all trainer families.  Additional
helpers deduplicate device selection, accuracy, class-weight building,
train/val splitting, checkpoint resume, ONNX export, and feature-spec
constants.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import random
from dataclasses import dataclass
from typing import Any

import torch
from torch import nn


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_FEATURE_SPEC: list[str] = [
    "board_padded_10x10_perspective_flat",
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
]

LEGACY_DECK_COUNT_NORMALIZER = 60.0
DECK_COUNT_FEATURE_MODE = "own_deck_ratio_v1"
DECK_COUNT_FIELD = "ownDeckCount"
DECK_COUNT_FALLBACK_FIELD = "deckCount"
DECK_COUNT_NORMALIZER_FIELD = "initialDeckSize"
VAL_SPLIT_MODE_RANDOM = "random"
VAL_SPLIT_MODE_GROUPED_GAME = "grouped-game"
VAL_SPLIT_MODE_CHOICES = (
    VAL_SPLIT_MODE_RANDOM,
    VAL_SPLIT_MODE_GROUPED_GAME,
)
VAL_SPLIT_GROUP_KEY_FIELDS = (
    "dataLane",
    "seedFamily",
    "seed",
    "gameIndex",
)


_STATE_DICT_COMPATIBILITY_MARKERS = (
    "size mismatch for",
    "Missing key(s) in state_dict",
    "Unexpected key(s) in state_dict",
)


def build_deck_count_feature_meta() -> dict[str, Any]:
    return {
        "deckCountFeature": DECK_COUNT_FEATURE_MODE,
        "deckCountField": DECK_COUNT_FIELD,
        "deckCountFallbackField": DECK_COUNT_FALLBACK_FIELD,
        "deckCountNormalizerField": DECK_COUNT_NORMALIZER_FIELD,
        "legacyDeckCountNormalizer": LEGACY_DECK_COUNT_NORMALIZER,
    }


def resolve_deck_count_ratio(record: dict[str, Any]) -> float:
    raw_deck_count = record.get(DECK_COUNT_FIELD, record.get(DECK_COUNT_FALLBACK_FIELD, 0))
    try:
        deck_count = float(raw_deck_count or 0)
    except (TypeError, ValueError):
        deck_count = 0.0
    raw_normalizer = record.get(DECK_COUNT_NORMALIZER_FIELD, 0)
    try:
        normalizer = float(raw_normalizer or 0)
    except (TypeError, ValueError):
        normalizer = 0.0
    if normalizer <= 0:
        normalizer = LEGACY_DECK_COUNT_NORMALIZER
    return deck_count / normalizer


def _normalize_split_group_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_split_group_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return int(value)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def build_record_group_key(record: dict[str, Any]) -> str | None:
    if not isinstance(record, dict):
        return None
    data_lane = _normalize_split_group_text(record.get("dataLane"))
    seed_family = _normalize_split_group_text(record.get("seedFamily"))
    seed = _normalize_split_group_int(record.get("seed"))
    game_index = _normalize_split_group_int(record.get("gameIndex"))
    if seed is None and game_index is None:
        return None
    payload = {
        "dataLane": data_lane,
        "seedFamily": seed_family,
        "seed": seed,
        "gameIndex": game_index,
    }
    return json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def resolve_meta_output_path(meta_out: str | None, onnx_out: str) -> str:
    explicit = (meta_out or "").strip()
    if explicit:
        return explicit
    return onnx_out + ".meta.json"


def ensure_parent_dir(path_value: str | None) -> str:
    normalized = (path_value or "").strip()
    if not normalized:
        return ""
    os.makedirs(os.path.dirname(normalized) or ".", exist_ok=True)
    return normalized


def write_json_payload(path_value: str, payload: dict[str, Any]) -> None:
    out = ensure_parent_dir(path_value)
    if not out:
        return
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def read_resume_checkpoint(
    resume_checkpoint: str | None,
    device: str,
) -> tuple[str | None, Any | None, dict[str, Any] | None]:
    resume_path = (resume_checkpoint or "").strip()
    if not resume_path:
        return None, None, None
    if not os.path.exists(resume_path):
        raise ValueError(f"resume checkpoint not found: {resume_path}")
    checkpoint = torch.load(resume_path, map_location=device)
    state = checkpoint.get("model_state") if isinstance(checkpoint, dict) else None
    if state is None and isinstance(checkpoint, dict):
        state = checkpoint
    if not isinstance(state, dict):
        raise ValueError(f"invalid checkpoint format: {resume_path}")
    return resume_path, checkpoint, state


def is_state_dict_compatibility_error(exc: BaseException) -> bool:
    message = str(exc)
    return any(marker in message for marker in _STATE_DICT_COMPATIBILITY_MARKERS)


def log_ignored_resume_checkpoint(
    trainer_label: str,
    resume_path: str,
    exc: BaseException,
) -> None:
    print(
        f"[{trainer_label}] resume checkpoint incompatible; ignored: {resume_path} ({exc})",
        flush=True,
    )


def load_resume_optimizer_state(
    optimizer: torch.optim.Optimizer,
    checkpoint: Any,
) -> None:
    if not isinstance(checkpoint, dict):
        return
    optimizer_state = checkpoint.get("optimizer_state")
    if not optimizer_state:
        return
    try:
        optimizer.load_state_dict(optimizer_state)
    except Exception:
        pass


def normalize_early_stop_monitor(
    early_stop_monitor: str | None,
    *,
    early_stop_patience: int,
    early_stop_min_delta: float,
    early_stop_min_epochs: int,
    allowed_monitors: tuple[str, ...],
    allowed_monitors_label: str,
    early_stop_smoothing_window: int | None = None,
) -> str:
    if early_stop_patience < 0:
        raise ValueError("--early-stop-patience must be >= 0")
    if early_stop_min_delta < 0:
        raise ValueError("--early-stop-min-delta must be >= 0")
    if early_stop_min_epochs < 0:
        raise ValueError("--early-stop-min-epochs must be >= 0")
    if early_stop_smoothing_window is not None and early_stop_smoothing_window < 1:
        raise ValueError("--early-stop-smoothing-window must be >= 1")
    monitor = str(early_stop_monitor or "").strip().lower()
    if monitor not in allowed_monitors:
        raise ValueError(f"--early-stop-monitor must be {allowed_monitors_label}")
    return monitor


def build_model_checkpoint_payload(
    schema_version: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    model_config: dict[str, Any],
    training: dict[str, Any],
    stats: dict[str, Any],
    *,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "formatVersion": 1,
        "schemaVersion": schema_version,
        "model_state": model.cpu().state_dict(),
        "optimizer_state": optimizer.state_dict(),
        "modelConfig": model_config,
        "training": training,
        "stats": stats,
    }
    if extra:
        payload.update(extra)
    return payload


def write_model_checkpoint(checkpoint_out: str, payload: dict[str, Any]) -> None:
    out = ensure_parent_dir(checkpoint_out)
    if not out:
        return
    torch.save(payload, out)


# ---------------------------------------------------------------------------
# Device selection
# ---------------------------------------------------------------------------

def choose_device(raw: str) -> str:
    """Resolve ``auto``/``cpu``/``cuda`` to an actual device string."""
    if raw == "cpu":
        return "cpu"
    if raw == "cuda":
        if not torch.cuda.is_available():
            raise ValueError("--device=cuda was requested but CUDA is not available")
        return "cuda"
    return "cuda" if torch.cuda.is_available() else "cpu"


# ---------------------------------------------------------------------------
# Accuracy helper
# ---------------------------------------------------------------------------

def accuracy_from_logits(
    logits: torch.Tensor,
    target: torch.Tensor,
    ignore_index: int = -100,
) -> tuple[int, int]:
    """Return ``(correct, samples)`` for classification logits vs labels."""
    mask = target != ignore_index
    samples = int(mask.sum().item())
    if samples <= 0:
        return 0, 0
    pred = torch.argmax(logits, dim=1)
    correct = int((pred[mask] == target[mask]).sum().item())
    return correct, samples


# ---------------------------------------------------------------------------
# Card class weights
# ---------------------------------------------------------------------------

def build_card_class_weights(
    y_card_train: torch.Tensor,
    device: str,
    card_action_dim: int,
    no_card_action_index: int | None,
    no_action_weight: float,
    balance_power: float,
) -> torch.Tensor | None:
    """Build inverse-frequency balanced class weights for card head loss."""
    if card_action_dim <= 0:
        return None

    valid = y_card_train[y_card_train != -100]
    if int(valid.numel()) <= 0:
        return None

    weights = torch.ones((card_action_dim,), dtype=torch.float32)
    if balance_power > 0:
        valid_cpu = valid.detach().to("cpu")
        class_ids, class_counts = torch.unique(valid_cpu, return_counts=True)
        if int(class_counts.numel()) > 0:
            max_count = float(torch.max(class_counts).item())
            for idx_tensor, count_tensor in zip(class_ids, class_counts):
                idx = int(idx_tensor.item())
                count = max(1.0, float(count_tensor.item()))
                inv_freq = max_count / count
                weights[idx] = float(inv_freq ** balance_power)

    if no_card_action_index is not None:
        weights[int(no_card_action_index)] *= float(no_action_weight)

    weights = torch.clamp(weights, min=0.2, max=6.0)
    mean_w = float(torch.mean(weights).item())
    if mean_w > 0:
        weights = weights / mean_w
    return weights.to(device)


# ---------------------------------------------------------------------------
# Train / validation split
# ---------------------------------------------------------------------------

def random_train_val_split(
    n: int,
    val_split: float,
    device: str,
) -> tuple[torch.Tensor, torch.Tensor]:
    """Return ``(train_indices, val_indices)`` on *device* for *n* samples.

    Uses ``device`` for the ``randperm`` call so that CUDA and CPU runs
    produce the same split when given the same seed+device combination.
    """
    perm = torch.randperm(n, device=device)
    val_size = int(n * val_split)
    if val_size > 0:
        val_idx = perm[:val_size]
        train_idx = perm[val_size:]
    else:
        val_idx = torch.empty((0,), dtype=torch.long, device=device)
        train_idx = perm
    if train_idx.shape[0] <= 0:
        raise ValueError("training split became empty; reduce --val-split")
    return train_idx, val_idx


def grouped_train_val_split(
    group_keys: list[str | None],
    val_split: float,
    device: str,
    *,
    seed: int,
) -> tuple[torch.Tensor, torch.Tensor, dict[str, Any]]:
    total_records = len(group_keys)
    missing_group_key_records = sum(1 for key in group_keys if not key)
    if missing_group_key_records > 0:
        raise ValueError(
            "--val-split-mode grouped-game requires seed/gameIndex on every training record"
        )

    grouped_indices: dict[str, list[int]] = {}
    for index, key in enumerate(group_keys):
        grouped_indices.setdefault(str(key), []).append(index)

    shuffled_keys = list(grouped_indices.keys())
    random.Random(int(seed)).shuffle(shuffled_keys)
    val_group_count = int(len(shuffled_keys) * val_split)
    val_keys = set(shuffled_keys[:val_group_count])

    train_indices_list: list[int] = []
    val_indices_list: list[int] = []
    for index, key in enumerate(group_keys):
        if key in val_keys:
            val_indices_list.append(index)
        else:
            train_indices_list.append(index)

    train_idx = torch.tensor(train_indices_list, dtype=torch.long, device=device)
    val_idx = torch.tensor(val_indices_list, dtype=torch.long, device=device)
    if train_idx.shape[0] <= 0:
        raise ValueError("training split became empty; reduce --val-split")
    summary = {
        "mode": VAL_SPLIT_MODE_GROUPED_GAME,
        "groupKeyFields": list(VAL_SPLIT_GROUP_KEY_FIELDS),
        "totalRecords": int(total_records),
        "trainRecords": int(train_idx.shape[0]),
        "valRecords": int(val_idx.shape[0]),
        "totalGroups": int(len(shuffled_keys)),
        "trainGroups": int(len(shuffled_keys) - val_group_count),
        "valGroups": int(val_group_count),
        "missingGroupKeyRecords": int(missing_group_key_records),
    }
    return train_idx, val_idx, summary


def resolve_train_val_split(
    n: int,
    val_split: float,
    device: str,
    *,
    seed: int,
    split_mode: str,
    split_group_keys: list[str | None] | None = None,
) -> tuple[torch.Tensor, torch.Tensor, dict[str, Any]]:
    mode = str(split_mode or VAL_SPLIT_MODE_GROUPED_GAME).strip().lower()
    if mode == VAL_SPLIT_MODE_RANDOM:
        train_idx, val_idx = random_train_val_split(n, val_split, device)
        return train_idx, val_idx, {
            "mode": VAL_SPLIT_MODE_RANDOM,
            "totalRecords": int(n),
            "trainRecords": int(train_idx.shape[0]),
            "valRecords": int(val_idx.shape[0]),
        }
    if mode != VAL_SPLIT_MODE_GROUPED_GAME:
        raise ValueError(
            f"--val-split-mode must be {'/'.join(VAL_SPLIT_MODE_CHOICES)}"
        )
    if split_group_keys is None:
        raise ValueError(
            "--val-split-mode grouped-game requires per-record split group keys"
        )
    if len(split_group_keys) != int(n):
        raise ValueError(
            "split group key count must match training sample count"
        )
    return grouped_train_val_split(split_group_keys, val_split, device, seed=seed)


# ---------------------------------------------------------------------------
# Resume checkpoint (strict)
# ---------------------------------------------------------------------------

def apply_resume_checkpoint(
    trainer_label: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer | None,
    resume_path: str,
    resume_optimizer: bool,
    device: str,
) -> str | None:
    """Load model (and optionally optimizer) state from *resume_path*.

    Returns the *resume_path* on success, ``None`` if the path is empty.

    **Error policy:**
    - State-dict compatibility errors (size mismatch, missing/unexpected
      keys) are logged and ignored — model trains from scratch.
    - All other errors are re-raised as ``ValueError`` so corrupt or
      mistyped paths do *not* silently cause a cold start.
    - Optimizer restore failures are always silently ignored (matching
      the pre-existing lenient behavior).
    """
    path, checkpoint, state = read_resume_checkpoint(resume_path, device)
    if not path or state is None:
        return None

    try:
        model.load_state_dict(state)
    except Exception as exc:
        if is_state_dict_compatibility_error(exc):
            log_ignored_resume_checkpoint(trainer_label, path, exc)
            return None
        raise ValueError(
            f"failed to load model checkpoint: {path}: {exc}"
        ) from exc

    if resume_optimizer and optimizer is not None:
        load_resume_optimizer_state(optimizer, checkpoint)

    return path


def clone_optimizer_state(optimizer: torch.optim.Optimizer | None) -> dict[str, Any] | None:
    if optimizer is None:
        return None
    return copy.deepcopy(optimizer.state_dict())


def restore_best_training_state(
    model: nn.Module,
    optimizer: torch.optim.Optimizer | None,
    best_state: dict[str, Any] | None,
    best_optimizer_state: dict[str, Any] | None,
) -> None:
    if best_state is not None:
        model.load_state_dict(best_state)
    if optimizer is None or best_optimizer_state is None:
        return
    try:
        optimizer.load_state_dict(best_optimizer_state)
    except Exception:
        pass


def validate_lr_plateau_args(
    lr_plateau_patience: int,
    lr_plateau_factor: float,
    lr_plateau_min_lr: float,
) -> None:
    if lr_plateau_patience < 0:
        raise ValueError("--lr-plateau-patience must be >= 0")
    if lr_plateau_patience <= 0:
        return
    if lr_plateau_factor <= 0 or lr_plateau_factor >= 1:
        raise ValueError("--lr-plateau-factor must be in (0,1) when plateau scheduling is enabled")
    if lr_plateau_min_lr <= 0:
        raise ValueError("--lr-plateau-min-lr must be > 0 when plateau scheduling is enabled")


def maybe_reduce_lr_on_plateau(
    optimizer: torch.optim.Optimizer,
    *,
    plateau_no_improve_count: int,
    lr_plateau_patience: int,
    lr_plateau_factor: float,
    lr_plateau_min_lr: float,
) -> tuple[bool, float, float]:
    current_lr = float(optimizer.param_groups[0]["lr"])
    if lr_plateau_patience <= 0 or plateau_no_improve_count < lr_plateau_patience:
        return False, current_lr, current_lr
    next_lr = max(float(lr_plateau_min_lr), current_lr * float(lr_plateau_factor))
    if next_lr + 1e-12 >= current_lr:
        return False, current_lr, current_lr
    for group in optimizer.param_groups:
        group["lr"] = next_lr
    return True, current_lr, next_lr


@dataclass
class MonitorControlState:
    best_monitor: float = float("inf")
    best_epoch: int = 0
    no_improve_count: int = 0
    plateau_no_improve_count: int = 0
    lr_drop_count: int = 0
    best_state: dict[str, Any] | None = None
    best_optimizer_state: dict[str, Any] | None = None


@dataclass
class MonitorControlUpdate:
    current_lr: float
    lr_reduced: bool
    old_lr: float


def create_monitor_control_state() -> MonitorControlState:
    return MonitorControlState()


def advance_monitor_control_state(
    state: MonitorControlState,
    *,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    epoch_number: int,
    monitor_value: float,
    early_stop_min_delta: float,
    lr_plateau_patience: int,
    lr_plateau_factor: float,
    lr_plateau_min_lr: float,
) -> MonitorControlUpdate:
    improved = (state.best_monitor - monitor_value) > early_stop_min_delta
    if improved:
        state.best_monitor = monitor_value
        state.best_epoch = epoch_number
        state.no_improve_count = 0
        state.plateau_no_improve_count = 0
        state.best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
        state.best_optimizer_state = clone_optimizer_state(optimizer)
    else:
        state.no_improve_count += 1
        state.plateau_no_improve_count += 1

    lr_reduced, old_lr, _next_lr = maybe_reduce_lr_on_plateau(
        optimizer,
        plateau_no_improve_count=state.plateau_no_improve_count,
        lr_plateau_patience=lr_plateau_patience,
        lr_plateau_factor=lr_plateau_factor,
        lr_plateau_min_lr=lr_plateau_min_lr,
    )
    if lr_reduced:
        state.lr_drop_count += 1
        state.plateau_no_improve_count = 0
        state.no_improve_count = 0

    return MonitorControlUpdate(
        current_lr=float(optimizer.param_groups[0]["lr"]),
        lr_reduced=lr_reduced,
        old_lr=old_lr,
    )


def build_monitor_control_metrics(
    state: MonitorControlState,
    *,
    current_lr: float,
) -> dict[str, Any]:
    return {
        "bestMonitor": state.best_monitor,
        "bestEpoch": state.best_epoch,
        "noImproveCount": state.no_improve_count,
        "plateauNoImproveCount": state.plateau_no_improve_count,
        "lr": current_lr,
        "lrDropCount": state.lr_drop_count,
    }


def finalize_monitor_control_metrics(
    epoch_metrics: list[dict[str, Any]],
    state: MonitorControlState,
    *,
    stopped_early: bool,
    early_stop_epoch: int | None,
) -> None:
    if not epoch_metrics:
        return
    epoch_metrics[-1]["stoppedEarly"] = stopped_early
    epoch_metrics[-1]["earlyStopEpoch"] = early_stop_epoch
    epoch_metrics[-1]["bestEpoch"] = state.best_epoch
    epoch_metrics[-1]["bestMonitor"] = state.best_monitor
    epoch_metrics[-1]["lrDropCount"] = state.lr_drop_count


# ---------------------------------------------------------------------------
# ONNX export
# ---------------------------------------------------------------------------

def export_onnx_model(
    model: nn.Module,
    onnx_out: str,
    input_dim: int,
    output_names: list[str],
    dynamic_axes: dict[str, dict[int, str]],
) -> None:
    """Export *model* to ONNX at *onnx_out*."""
    os.makedirs(os.path.dirname(onnx_out) or ".", exist_ok=True)
    model.eval()
    dummy = torch.zeros((1, input_dim), dtype=torch.float32)
    torch.onnx.export(
        model.cpu(),
        dummy,
        onnx_out,
        input_names=["obs"],
        output_names=output_names,
        dynamic_axes=dynamic_axes,
        opset_version=17,
    )


# ---------------------------------------------------------------------------
# Sample-weight arg validation
# ---------------------------------------------------------------------------

def validate_sample_weight_args(args: argparse.Namespace) -> None:
    """Range-check the sample-weight CLI flags present on *args*."""
    if args.winner_sample_boost < 0:
        raise ValueError("--winner-sample-boost must be >= 0")
    if args.loser_sample_weight <= 0:
        raise ValueError("--loser-sample-weight must be > 0")
    if args.draw_sample_weight <= 0:
        raise ValueError("--draw-sample-weight must be > 0")
    if args.corner_emergency_sample_boost < 0:
        raise ValueError("--corner-emergency-sample-boost must be >= 0")
    if args.negative_future_disc_sample_boost < 0:
        raise ValueError("--negative-future-disc-sample-boost must be >= 0")
    if not isinstance(args.negative_future_disc_threshold, (int, float)):
        raise ValueError("--negative-future-disc-threshold must be a number")
    if args.tactical_miss_sample_boost < 0:
        raise ValueError("--tactical-miss-sample-boost must be >= 0")
    if not isinstance(args.tactical_miss_threshold, (int, float)) or args.tactical_miss_threshold < 0:
        raise ValueError("--tactical-miss-threshold must be >= 0")
    if args.hand_pressure_sample_boost < 0:
        raise ValueError("--hand-pressure-sample-boost must be >= 0")
    if args.pending_target_sample_boost < 0:
        raise ValueError("--pending-target-sample-boost must be >= 0")
    if getattr(args, "corner_balance_sample_boost", 0.0) < 0:
        raise ValueError("--corner-balance-sample-boost must be >= 0")
    if getattr(args, "edge_balance_sample_boost", 0.0) < 0:
        raise ValueError("--edge-balance-sample-boost must be >= 0")
    if getattr(args, "economy_balance_sample_boost", 0.0) < 0:
        raise ValueError("--economy-balance-sample-boost must be >= 0")


# ---------------------------------------------------------------------------
# Common argparser builder
# ---------------------------------------------------------------------------

def add_common_args(
    parser: argparse.ArgumentParser,
    *,
    onnx_out_default: str = "",
    include_balance_boosts: bool = False,
) -> None:
    """Add the ~25 CLI flags shared by all ONNX trainers.

    Call this **first**, then add trainer-specific flags.

    Parameters
    ----------
    parser
        Pre-created ``ArgumentParser`` to mutate.
    onnx_out_default
        Default value for ``--onnx-out`` (trainer-specific).
    include_balance_boosts
        When ``True``, add ``--corner-balance-sample-boost``,
        ``--edge-balance-sample-boost``, ``--economy-balance-sample-boost``.
    """
    parser.add_argument("--input", required=True, help="Path to NDJSON self-play data.")
    parser.add_argument(
        "--onnx-out",
        default=onnx_out_default,
        help="Output ONNX path.",
    )
    parser.add_argument(
        "--meta-out",
        default=None,
        help="Output metadata JSON path (default: <onnx-out>.meta.json).",
    )
    parser.add_argument("--epochs", type=int, default=8, help="Training epochs (default: 8).")
    parser.add_argument("--batch-size", type=int, default=2048, help="Batch size (default: 2048).")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate (default: 1e-3).")
    parser.add_argument("--hidden-size", type=int, default=256, help="MLP hidden size (default: 256).")
    parser.add_argument("--seed", type=int, default=7, help="Random seed (default: 7).")
    parser.add_argument(
        "--val-split",
        type=float,
        default=0.1,
        help="Validation split ratio in [0,0.5). Default: 0.1",
    )
    parser.add_argument(
        "--val-split-mode",
        choices=VAL_SPLIT_MODE_CHOICES,
        default=VAL_SPLIT_MODE_GROUPED_GAME,
        help=(
            "Validation split strategy: random or grouped-game "
            "(default: grouped-game)."
        ),
    )
    parser.add_argument(
        "--early-stop-patience",
        type=int,
        default=0,
        help="Stop if monitored metric does not improve for N epochs (default: 0=disabled).",
    )
    parser.add_argument(
        "--early-stop-min-delta",
        type=float,
        default=0.0,
        help="Minimum metric improvement to reset early-stop counter (default: 0.0).",
    )
    parser.add_argument(
        "--early-stop-min-epochs",
        type=int,
        default=0,
        help="Do not allow early-stop before this epoch (default: 0).",
    )
    parser.add_argument(
        "--early-stop-monitor",
        default="val_loss",
        help="Metric for early stopping: val_loss/train_loss (default: val_loss).",
    )
    parser.add_argument(
        "--early-stop-smoothing-window",
        type=int,
        default=1,
        help="Moving-average window for early-stop monitor (default: 1=disabled).",
    )
    parser.add_argument(
        "--lr-plateau-patience",
        type=int,
        default=0,
        help="If > 0, reduce LR after N non-improving epochs (default: 0=disabled).",
    )
    parser.add_argument(
        "--lr-plateau-factor",
        type=float,
        default=0.6,
        help="LR multiply factor on plateau in (0,1) (default: 0.6).",
    )
    parser.add_argument(
        "--lr-plateau-min-lr",
        type=float,
        default=1e-5,
        help="Lower bound for LR when plateau scheduling is enabled (default: 1e-5).",
    )
    parser.add_argument(
        "--log-interval-steps",
        type=int,
        default=0,
        help="If > 0, print batch loss every N steps (default: 0=off).",
    )
    parser.add_argument(
        "--metrics-out",
        default="",
        help="Optional JSONL path for per-epoch metrics.",
    )
    parser.add_argument(
        "--resume-checkpoint",
        default="",
        help="Optional checkpoint path to resume model/optimizer state from.",
    )
    parser.add_argument(
        "--resume-optimizer",
        action="store_true",
        help="When set, also restore optimizer state from checkpoint (default: off).",
    )
    parser.add_argument(
        "--checkpoint-out",
        default="",
        help="Optional checkpoint output path (.pt).",
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="Device: auto/cpu/cuda (default: auto).",
    )
    parser.add_argument(
        "--winner-sample-boost",
        type=float,
        default=0.35,
        help="Extra sample weight added to winner-side records (default: 0.35).",
    )
    parser.add_argument(
        "--loser-sample-weight",
        type=float,
        default=0.8,
        help="Sample weight used for loser-side records (default: 0.8).",
    )
    parser.add_argument(
        "--draw-sample-weight",
        type=float,
        default=1.0,
        help="Sample weight used for draw records (default: 1.0).",
    )
    parser.add_argument(
        "--corner-emergency-sample-boost",
        type=float,
        default=0.0,
        help="Extra weight boost when cornerEmergency is active (default: 0.0).",
    )
    parser.add_argument(
        "--negative-future-disc-sample-boost",
        type=float,
        default=0.0,
        help="Extra weight boost when futureDiscDelta3Ply is below threshold (default: 0.0).",
    )
    parser.add_argument(
        "--negative-future-disc-threshold",
        type=float,
        default=-1.0,
        help="Danger threshold for futureDiscDelta3Ply (default: -1.0).",
    )
    parser.add_argument(
        "--tactical-miss-sample-boost",
        type=float,
        default=0.0,
        help="Extra weight boost when tacticalScoreMissRatio exceeds threshold (default: 0.0).",
    )
    parser.add_argument(
        "--tactical-miss-threshold",
        type=float,
        default=0.08,
        help="Threshold for tacticalScoreMissRatio danger boost (default: 0.08).",
    )
    parser.add_argument(
        "--hand-pressure-sample-boost",
        type=float,
        default=0.0,
        help="Extra weight boost when handCards length is >= 4 (default: 0.0).",
    )
    parser.add_argument(
        "--pending-target-sample-boost",
        type=float,
        default=0.0,
        help="Extra weight boost when pendingType is active (default: 0.0).",
    )
    if include_balance_boosts:
        parser.add_argument(
            "--corner-balance-sample-boost",
            type=float,
            default=0.0,
            help="Extra sample boost scaled by corner-control pressure in [0,1] (default: 0.0).",
        )
        parser.add_argument(
            "--edge-balance-sample-boost",
            type=float,
            default=0.0,
            help="Extra sample boost scaled by edge-control pressure in [0,1] (default: 0.0).",
        )
        parser.add_argument(
            "--economy-balance-sample-boost",
            type=float,
            default=0.0,
            help="Extra sample boost scaled by charge/bonus economy pressure in [0,1] (default: 0.0).",
        )


# ---------------------------------------------------------------------------
# Common training metadata builder
# ---------------------------------------------------------------------------

def build_common_training_meta(args: argparse.Namespace, device: str) -> dict[str, Any]:
    """Build the ``training`` dict fragment shared by all trainer meta files."""
    meta: dict[str, Any] = {
        "epochs": args.epochs,
        "batchSize": args.batch_size,
        "lr": args.lr,
        "hiddenSize": args.hidden_size,
        "seed": args.seed,
        "device": device,
        "valSplit": args.val_split,
        "valSplitMode": str(getattr(args, "val_split_mode", VAL_SPLIT_MODE_GROUPED_GAME)),
        "earlyStopPatience": args.early_stop_patience,
        "earlyStopMinDelta": args.early_stop_min_delta,
        "earlyStopMinEpochs": args.early_stop_min_epochs,
        "earlyStopMonitor": args.early_stop_monitor,
        "earlyStopSmoothingWindow": args.early_stop_smoothing_window,
        "lrPlateauPatience": args.lr_plateau_patience,
        "lrPlateauFactor": args.lr_plateau_factor,
        "lrPlateauMinLr": args.lr_plateau_min_lr,
        "winnerSampleBoost": args.winner_sample_boost,
        "loserSampleWeight": args.loser_sample_weight,
        "drawSampleWeight": args.draw_sample_weight,
        "cornerEmergencySampleBoost": args.corner_emergency_sample_boost,
        "negativeFutureDiscSampleBoost": args.negative_future_disc_sample_boost,
        "negativeFutureDiscThreshold": args.negative_future_disc_threshold,
        "tacticalMissSampleBoost": args.tactical_miss_sample_boost,
        "tacticalMissThreshold": args.tactical_miss_threshold,
        "handPressureSampleBoost": args.hand_pressure_sample_boost,
        "pendingTargetSampleBoost": args.pending_target_sample_boost,
        "resumeCheckpoint": (args.resume_checkpoint or "").strip() or None,
        "resumeOptimizer": bool(args.resume_optimizer),
        "checkpointOut": (args.checkpoint_out or "").strip() or None,
    }
    if hasattr(args, "corner_balance_sample_boost"):
        meta["cornerBalanceSampleBoost"] = args.corner_balance_sample_boost
    if hasattr(args, "edge_balance_sample_boost"):
        meta["edgeBalanceSampleBoost"] = args.edge_balance_sample_boost
    if hasattr(args, "economy_balance_sample_boost"):
        meta["economyBalanceSampleBoost"] = args.economy_balance_sample_boost
    return meta


def build_common_checkpoint_training(
    args: argparse.Namespace,
    device: str,
    resumed_from: str | None,
) -> dict[str, Any]:
    """Build the ``training`` dict fragment shared by all checkpoint payloads."""
    meta: dict[str, Any] = {
        "epochs": int(args.epochs),
        "batchSize": int(args.batch_size),
        "lr": float(args.lr),
        "hiddenSize": int(args.hidden_size),
        "seed": int(args.seed),
        "device": device,
        "valSplit": float(args.val_split),
        "valSplitMode": str(getattr(args, "val_split_mode", VAL_SPLIT_MODE_GROUPED_GAME)),
        "earlyStopPatience": int(args.early_stop_patience),
        "earlyStopMinDelta": float(args.early_stop_min_delta),
        "earlyStopMinEpochs": int(args.early_stop_min_epochs),
        "earlyStopMonitor": str(args.early_stop_monitor),
        "earlyStopSmoothingWindow": int(args.early_stop_smoothing_window),
        "lrPlateauPatience": int(args.lr_plateau_patience),
        "lrPlateauFactor": float(args.lr_plateau_factor),
        "lrPlateauMinLr": float(args.lr_plateau_min_lr),
        "winnerSampleBoost": float(args.winner_sample_boost),
        "loserSampleWeight": float(args.loser_sample_weight),
        "drawSampleWeight": float(args.draw_sample_weight),
        "cornerEmergencySampleBoost": float(args.corner_emergency_sample_boost),
        "negativeFutureDiscSampleBoost": float(args.negative_future_disc_sample_boost),
        "negativeFutureDiscThreshold": float(args.negative_future_disc_threshold),
        "tacticalMissSampleBoost": float(args.tactical_miss_sample_boost),
        "tacticalMissThreshold": float(args.tactical_miss_threshold),
        "handPressureSampleBoost": float(args.hand_pressure_sample_boost),
        "pendingTargetSampleBoost": float(args.pending_target_sample_boost),
        "resumedFrom": resumed_from,
        "resumeOptimizer": bool(args.resume_optimizer),
    }
    if hasattr(args, "corner_balance_sample_boost"):
        meta["cornerBalanceSampleBoost"] = float(args.corner_balance_sample_boost)
    if hasattr(args, "edge_balance_sample_boost"):
        meta["edgeBalanceSampleBoost"] = float(args.edge_balance_sample_boost)
    if hasattr(args, "economy_balance_sample_boost"):
        meta["economyBalanceSampleBoost"] = float(args.economy_balance_sample_boost)
    return meta


def apply_split_summary_meta(
    meta: dict[str, Any],
    split_summary: dict[str, Any] | None,
) -> dict[str, Any]:
    if isinstance(split_summary, dict) and split_summary:
        meta["valSplitSummary"] = split_summary
    return meta
