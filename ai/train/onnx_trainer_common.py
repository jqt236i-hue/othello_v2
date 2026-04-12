#!/usr/bin/env python3
"""Shared helpers for ONNX trainer artifact and checkpoint handling."""

from __future__ import annotations

import json
import os
from typing import Any

import torch
from torch import nn


_STATE_DICT_COMPATIBILITY_MARKERS = (
    "size mismatch for",
    "Missing key(s) in state_dict",
    "Unexpected key(s) in state_dict",
)


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
