#!/usr/bin/env python3
"""Train a small PyTorch policy network and export ONNX (+ optional policy-table fallback)."""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Iterable

import torch
from torch import nn

import train_policy_table as policy_table


MODEL_SCHEMA_VERSION = "policy_onnx.v1"
BOARD_SIZE = 8
INPUT_DIM = 70
OUTPUT_DIM = BOARD_SIZE * BOARD_SIZE


@dataclass
class DatasetBundle:
    x: torch.Tensor
    y: torch.Tensor
    records_read: int
    place_records: int


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train ONNX policy model from self-play NDJSON.")
    p.add_argument("--input", required=True, help="Path to NDJSON self-play data.")
    p.add_argument(
        "--onnx-out",
        default=os.path.join("data", "models", "policy-net.onnx"),
        help="Output ONNX path.",
    )
    p.add_argument(
        "--meta-out",
        default=None,
        help="Output metadata JSON path (default: <onnx-out>.meta.json).",
    )
    p.add_argument(
        "--policy-table-out",
        default=os.path.join("data", "models", "policy-table.json"),
        help="Optional compatibility policy-table output path. Empty string disables.",
    )
    p.add_argument("--epochs", type=int, default=8, help="Training epochs (default: 8).")
    p.add_argument("--batch-size", type=int, default=2048, help="Batch size (default: 2048).")
    p.add_argument("--lr", type=float, default=1e-3, help="Learning rate (default: 1e-3).")
    p.add_argument("--hidden-size", type=int, default=256, help="MLP hidden size (default: 256).")
    p.add_argument("--seed", type=int, default=7, help="Random seed (default: 7).")
    p.add_argument(
        "--val-split",
        type=float,
        default=0.1,
        help="Validation split ratio in [0,0.5). Default: 0.1",
    )
    p.add_argument(
        "--early-stop-patience",
        type=int,
        default=0,
        help="Stop if monitored metric does not improve for N epochs (default: 0=disabled).",
    )
    p.add_argument(
        "--early-stop-min-delta",
        type=float,
        default=0.0,
        help="Minimum metric improvement to reset early-stop counter (default: 0.0).",
    )
    p.add_argument(
        "--early-stop-monitor",
        default="val_loss",
        help="Metric for early stopping: val_loss or train_loss (default: val_loss).",
    )
    p.add_argument(
        "--log-interval-steps",
        type=int,
        default=0,
        help="If > 0, print batch loss every N steps (default: 0=off).",
    )
    p.add_argument(
        "--metrics-out",
        default="",
        help="Optional JSONL path for per-epoch metrics.",
    )
    p.add_argument(
        "--resume-checkpoint",
        default="",
        help="Optional checkpoint path to resume model/optimizer state from.",
    )
    p.add_argument(
        "--checkpoint-out",
        default="",
        help="Optional checkpoint output path (.pt).",
    )
    p.add_argument(
        "--device",
        default="auto",
        help="Device: auto/cpu/cuda (default: auto).",
    )
    p.add_argument("--min-visits", type=int, default=12, help="Compat policy-table --min-visits.")
    p.add_argument(
        "--shape-immediate",
        type=float,
        default=0.4,
        help="Compat policy-table --shape-immediate in [0,1].",
    )
    return p.parse_args()


def parse_board(board: str) -> list[list[str]]:
    if not board:
        return []
    return [list(r) for r in board.split("/")]


def cell_value_for_player(ch: str, player: str) -> float:
    own = "B" if player == "black" else "W"
    opp = "W" if own == "B" else "B"
    if ch == own:
        return 1.0
    if ch == opp:
        return -1.0
    return 0.0


def feature_vector(rec: dict) -> list[float]:
    board = parse_board(str(rec.get("board", "")))
    player = rec.get("player", "white")
    out = [0.0] * INPUT_DIM

    if len(board) == BOARD_SIZE and all(len(row) == BOARD_SIZE for row in board):
        idx = 0
        for row in board:
            for ch in row:
                out[idx] = cell_value_for_player(ch, player)
                idx += 1

    legal_moves = float(rec.get("legalMoves", 0) or 0)
    charge_black = float(rec.get("chargeBlack", 0) or 0)
    charge_white = float(rec.get("chargeWhite", 0) or 0)
    deck_count = float(rec.get("deckCount", 0) or 0)
    black_before = float(rec.get("blackCountBefore", 0) or 0)
    white_before = float(rec.get("whiteCountBefore", 0) or 0)
    pending_type = rec.get("pendingType")
    pending_flag = 0.0 if pending_type in (None, "", "-", "null") else 1.0

    own_charge = charge_black if player == "black" else charge_white
    opp_charge = charge_white if player == "black" else charge_black
    disc_diff = (black_before - white_before) if player == "black" else (white_before - black_before)

    out[64] = legal_moves / 60.0
    out[65] = disc_diff / 64.0
    out[66] = own_charge / 50.0
    out[67] = opp_charge / 50.0
    out[68] = deck_count / 60.0
    out[69] = pending_flag
    return out


def target_index(rec: dict) -> int | None:
    if rec.get("actionType") != "place":
        return None
    row = rec.get("row")
    col = rec.get("col")
    if not isinstance(row, int) or not isinstance(col, int):
        return None
    if row < 0 or row >= BOARD_SIZE or col < 0 or col >= BOARD_SIZE:
        return None
    return (row * BOARD_SIZE) + col


def load_dataset(path: str) -> DatasetBundle:
    xs: list[list[float]] = []
    ys: list[int] = []
    records_read = 0
    place_records = 0

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records_read += 1
            rec = json.loads(line)
            t = target_index(rec)
            if t is None:
                continue
            xs.append(feature_vector(rec))
            ys.append(t)
            place_records += 1

    if place_records <= 0:
        raise ValueError("no placement records were found in input data")

    x = torch.tensor(xs, dtype=torch.float32)
    y = torch.tensor(ys, dtype=torch.long)
    return DatasetBundle(x=x, y=y, records_read=records_read, place_records=place_records)


class PolicyNet(nn.Module):
    def __init__(self, input_dim: int, hidden_size: int, output_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, output_dim),
        )

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        return self.net(obs)


def choose_device(raw: str) -> str:
    if raw == "cpu":
        return "cpu"
    if raw == "cuda":
        if not torch.cuda.is_available():
            raise ValueError("--device=cuda was requested but CUDA is not available")
        return "cuda"
    return "cuda" if torch.cuda.is_available() else "cpu"


def train_model(
    data: DatasetBundle,
    epochs: int,
    batch_size: int,
    lr: float,
    hidden_size: int,
    device: str,
    seed: int,
    val_split: float = 0.1,
    early_stop_patience: int = 0,
    early_stop_min_delta: float = 0.0,
    early_stop_monitor: str = "val_loss",
    resume_checkpoint: str = "",
    log_interval_steps: int = 0,
) -> tuple[nn.Module, torch.optim.Optimizer, float, str | None, list[dict]]:
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
    if early_stop_patience < 0:
        raise ValueError("--early-stop-patience must be >= 0")
    if early_stop_min_delta < 0:
        raise ValueError("--early-stop-min-delta must be >= 0")
    monitor = str(early_stop_monitor or "").strip().lower()
    if monitor not in ("val_loss", "train_loss"):
        raise ValueError("--early-stop-monitor must be val_loss or train_loss")

    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)

    model = PolicyNet(INPUT_DIM, hidden_size, OUTPUT_DIM).to(device)
    x = data.x.to(device)
    y = data.y.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()
    resumed_from: str | None = None

    resume_path = (resume_checkpoint or "").strip()
    if resume_path:
        if not os.path.exists(resume_path):
            raise ValueError(f"resume checkpoint not found: {resume_path}")
        ckpt = torch.load(resume_path, map_location=device)
        state = ckpt.get("model_state") if isinstance(ckpt, dict) else None
        if state is None and isinstance(ckpt, dict):
            state = ckpt
        if not isinstance(state, dict):
            raise ValueError(f"invalid checkpoint format: {resume_path}")
        try:
            model.load_state_dict(state)
        except Exception as exc:
            raise ValueError(f"failed to load model checkpoint: {resume_path}: {exc}") from exc
        if isinstance(ckpt, dict):
            optimizer_state = ckpt.get("optimizer_state")
            if optimizer_state:
                try:
                    opt.load_state_dict(optimizer_state)
                except Exception:
                    # Optimizer mismatch is non-fatal; keep resumed weights.
                    pass
        resumed_from = resume_path

    n = x.shape[0]
    all_perm = torch.randperm(n, device=device)
    val_size = int(n * val_split)
    if val_size > 0:
        val_idx = all_perm[:val_size]
        train_idx = all_perm[val_size:]
    else:
        val_idx = torch.empty((0,), dtype=torch.long, device=device)
        train_idx = all_perm
    if train_idx.shape[0] <= 0:
        raise ValueError("training split became empty; reduce --val-split")

    x_train = x[train_idx]
    y_train = y[train_idx]
    x_val = x[val_idx] if val_idx.shape[0] > 0 else None
    y_val = y[val_idx] if val_idx.shape[0] > 0 else None
    train_n = int(x_train.shape[0])

    epoch_metrics: list[dict] = []
    global_step = 0
    best_monitor = float("inf")
    best_epoch = 0
    no_improve_count = 0
    stopped_early = False
    early_stop_epoch = None
    best_state: dict | None = None

    for epoch_index in range(epochs):
        perm = torch.randperm(train_n, device=device)
        x_epoch = x_train[perm]
        y_epoch = y_train[perm]
        epoch_loss_sum = 0.0
        epoch_correct = 0
        epoch_samples = 0
        for i in range(0, train_n, batch_size):
            xb = x_epoch[i:i + batch_size]
            yb = y_epoch[i:i + batch_size]
            logits = model(xb)
            loss = loss_fn(logits, yb)
            with torch.no_grad():
                pred = torch.argmax(logits, dim=1)
                epoch_correct += int((pred == yb).sum().item())
                batch_size_now = int(yb.shape[0])
                epoch_samples += batch_size_now
                epoch_loss_sum += float(loss.item()) * batch_size_now
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
        train_acc = epoch_correct / max(1, epoch_samples)
        val_loss = None
        val_acc = None
        if x_val is not None and y_val is not None and int(y_val.shape[0]) > 0:
            with torch.no_grad():
                val_logits = model(x_val)
                val_loss = float(loss_fn(val_logits, y_val).item())
                val_pred = torch.argmax(val_logits, dim=1)
                val_acc = float((val_pred == y_val).float().mean().item())

        monitor_value = train_loss
        if monitor == "val_loss" and val_loss is not None:
            monitor_value = val_loss

        improved = (best_monitor - monitor_value) > early_stop_min_delta
        if improved:
            best_monitor = monitor_value
            best_epoch = epoch_index + 1
            no_improve_count = 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            no_improve_count += 1

        epoch_metrics.append(
            {
                "epoch": epoch_index + 1,
                "epochs": epochs,
                "globalStep": global_step,
                "avgLoss": train_loss,
                "trainLoss": train_loss,
                "trainAcc": train_acc,
                "valLoss": val_loss,
                "valAcc": val_acc,
                "monitor": monitor,
                "monitorValue": monitor_value,
                "bestMonitor": best_monitor,
                "bestEpoch": best_epoch,
                "noImproveCount": no_improve_count,
            }
        )
        print(
            f"[train_policy_onnx] epoch={epoch_index + 1}/{epochs} "
            f"avg_loss={train_loss:.6f} train_acc={train_acc:.3f} "
            + (f"val_loss={val_loss:.6f} val_acc={val_acc:.3f} " if val_loss is not None and val_acc is not None else "")
            + f"monitor={monitor} monitor_value={monitor_value:.6f}",
            flush=True,
        )

        if early_stop_patience > 0 and no_improve_count >= early_stop_patience:
            stopped_early = True
            early_stop_epoch = epoch_index + 1
            print(
                f"[train_policy_onnx] early-stop triggered at epoch={early_stop_epoch} "
                f"best_epoch={best_epoch} best_{monitor}={best_monitor:.6f}",
                flush=True,
            )
            break

    if best_state is not None:
        model.load_state_dict(best_state)
    if epoch_metrics:
        epoch_metrics[-1]["stoppedEarly"] = stopped_early
        epoch_metrics[-1]["earlyStopEpoch"] = early_stop_epoch
        epoch_metrics[-1]["bestEpoch"] = best_epoch
        epoch_metrics[-1]["bestMonitor"] = best_monitor

    with torch.no_grad():
        logits = model(x)
        pred = torch.argmax(logits, dim=1)
        acc = float((pred == y).float().mean().item())
    return model, opt, acc, resumed_from, epoch_metrics


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    os.makedirs(os.path.dirname(onnx_out) or ".", exist_ok=True)
    model.eval()
    dummy = torch.zeros((1, INPUT_DIM), dtype=torch.float32)
    torch.onnx.export(
        model.cpu(),
        dummy,
        onnx_out,
        input_names=["obs"],
        output_names=["logits"],
        dynamic_axes={"obs": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )


def write_meta(path: str, args: argparse.Namespace, data: DatasetBundle, train_acc: float, device: str) -> None:
    payload = {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "inputName": "obs",
        "outputName": "logits",
        "inputDim": INPUT_DIM,
        "outputDim": OUTPUT_DIM,
        "boardSize": BOARD_SIZE,
        "actionSpace": "place_8x8",
        "featureSpec": [
            "board_8x8_perspective_flat",
            "legal_moves_norm",
            "disc_diff_before_norm",
            "own_charge_norm",
            "opp_charge_norm",
            "deck_count_norm",
            "pending_flag",
        ],
        "training": {
            "epochs": args.epochs,
            "batchSize": args.batch_size,
            "lr": args.lr,
            "hiddenSize": args.hidden_size,
            "seed": args.seed,
            "device": device,
            "valSplit": args.val_split,
            "earlyStopPatience": args.early_stop_patience,
            "earlyStopMinDelta": args.early_stop_min_delta,
            "earlyStopMonitor": args.early_stop_monitor,
            "resumeCheckpoint": (args.resume_checkpoint or "").strip() or None,
            "checkpointOut": (args.checkpoint_out or "").strip() or None,
        },
        "stats": {
            "recordsRead": data.records_read,
            "placeRecords": data.place_records,
            "trainAccuracy": train_acc,
        },
    }
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def maybe_write_checkpoint(
    checkpoint_out: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    args: argparse.Namespace,
    data: DatasetBundle,
    train_acc: float,
    device: str,
    resumed_from: str | None,
) -> None:
    out = (checkpoint_out or "").strip()
    if not out:
        return
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    payload = {
        "formatVersion": 1,
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "model_state": model.cpu().state_dict(),
        "optimizer_state": optimizer.state_dict(),
        "training": {
            "epochs": int(args.epochs),
            "batchSize": int(args.batch_size),
            "lr": float(args.lr),
            "hiddenSize": int(args.hidden_size),
            "seed": int(args.seed),
            "device": device,
            "valSplit": float(args.val_split),
            "earlyStopPatience": int(args.early_stop_patience),
            "earlyStopMinDelta": float(args.early_stop_min_delta),
            "earlyStopMonitor": str(args.early_stop_monitor),
            "resumedFrom": resumed_from,
        },
        "stats": {
            "recordsRead": int(data.records_read),
            "placeRecords": int(data.place_records),
            "trainAccuracy": float(train_acc),
        },
    }
    torch.save(payload, out)


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
    model = policy_table.train(policy_table.iter_ndjson(args.input), int(args.min_visits))
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)


def main() -> int:
    args = parse_args()
    device = choose_device(str(args.device).strip().lower())
    meta_out = args.meta_out or (args.onnx_out + ".meta.json")

    data = load_dataset(args.input)
    model, optimizer, train_acc, resumed_from, epoch_metrics = train_model(
        data=data,
        epochs=int(args.epochs),
        batch_size=int(args.batch_size),
        lr=float(args.lr),
        hidden_size=int(args.hidden_size),
        device=device,
        seed=int(args.seed),
        val_split=float(args.val_split),
        early_stop_patience=int(args.early_stop_patience),
        early_stop_min_delta=float(args.early_stop_min_delta),
        early_stop_monitor=str(args.early_stop_monitor or ""),
        resume_checkpoint=str(args.resume_checkpoint or ""),
        log_interval_steps=int(args.log_interval_steps),
    )
    export_onnx(model, args.onnx_out)
    write_meta(meta_out, args, data, train_acc, device)
    maybe_write_metrics(str(args.metrics_out or ""), epoch_metrics)
    maybe_write_checkpoint(
        checkpoint_out=str(args.checkpoint_out or ""),
        model=model,
        optimizer=optimizer,
        args=args,
        data=data,
        train_acc=train_acc,
        device=device,
        resumed_from=resumed_from,
    )
    maybe_write_policy_table(args)

    print(
        "[train_policy_onnx] "
        f"records={data.records_read} "
        f"place_records={data.place_records} "
        f"train_acc={train_acc:.3f} "
        f"onnx={args.onnx_out}"
    )
    if (args.policy_table_out or "").strip():
        print(f"[train_policy_onnx] policy_table={args.policy_table_out}")
    print(f"[train_policy_onnx] meta={meta_out}")
    if (args.checkpoint_out or "").strip():
        print(f"[train_policy_onnx] checkpoint={args.checkpoint_out}")
    if (args.metrics_out or "").strip():
        print(f"[train_policy_onnx] metrics={args.metrics_out}")
    if resumed_from:
        print(f"[train_policy_onnx] resumed_from={resumed_from}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
