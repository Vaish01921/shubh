"""
Single canonical depot token for SAP filter, exclusion config keys, and orchestration.

Frontend may send title case (e.g. "Ayodhya"); application.yaml uses UPPER keys.
"""

from __future__ import annotations


def normalize_depot_name(value: str | None) -> str:
    if value is None:
        return ""
    return str(value).strip().upper()
