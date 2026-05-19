#!/usr/bin/env python3
"""Quick local diagnostics for PyTorch training environment."""

from __future__ import annotations

import json
import platform
import time

import torch


def benchmark_matmul(device: str, size: int = 2048, rounds: int = 8) -> float:
    x = torch.randn(size, size, device=device)
    y = torch.randn(size, size, device=device)
    # Warm-up
    _ = x @ y
    if device.startswith("cuda"):
        torch.cuda.synchronize()
    start = time.perf_counter()
    for _ in range(rounds):
        _ = x @ y
    if device.startswith("cuda"):
        torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    return elapsed / rounds


def main() -> int:
    payload: dict[str, object] = {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "torch": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "mps_available": bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()),
    }

    if torch.cuda.is_available():
        payload["cuda"] = {
            "device_count": torch.cuda.device_count(),
            "device_name_0": torch.cuda.get_device_name(0),
            "avg_matmul_sec_cuda": benchmark_matmul("cuda"),
        }
    payload["avg_matmul_sec_cpu"] = benchmark_matmul("cpu")

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
