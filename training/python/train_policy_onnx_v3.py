#!/usr/bin/env python3
"""Compatibility CLI for the v3 CNN policy trainer profile."""

from policy_trainer_cnn import V3_COMPATIBILITY_PROFILE, run_cli


def main() -> int:
    return run_cli(V3_COMPATIBILITY_PROFILE)


if __name__ == "__main__":
    raise SystemExit(main())
