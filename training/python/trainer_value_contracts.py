#!/usr/bin/env python3
"""Dependency-free scalar contracts shared by training pipelines."""

from __future__ import annotations


def is_strict_int(value: object) -> bool:
    """Accept JSON integers without treating booleans as coordinates."""
    return type(value) is int
