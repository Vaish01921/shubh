"""
SQLite persistence for Rank-1 successful bids.
Isolated from Selenium / bidding engine logic.
"""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config_loader import BASE_DIR
from .depot_normalization import normalize_depot_name

_DB_PATH = BASE_DIR / "data" / "successful_bids.db"
_LOCK = threading.Lock()


def _db_path() -> Path:
    return _DB_PATH


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_db_path()), timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create data directory, enable WAL, and ensure successful_bids table exists."""
    with _LOCK:
        _db_path().parent.mkdir(parents=True, exist_ok=True)
        conn = _connect()
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS successful_bids (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    depot TEXT NOT NULL,
                    destination TEXT,
                    quantity REAL NOT NULL,
                    bid_amount INTEGER NOT NULL,
                    won_timestamp TEXT NOT NULL,
                    rank INTEGER NOT NULL DEFAULT 1 CHECK (rank = 1)
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_successful_bids_won_timestamp
                ON successful_bids (won_timestamp)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_successful_bids_depot
                ON successful_bids (depot)
                """
            )
            conn.commit()
        finally:
            conn.close()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def insert_successful_bid(
    *,
    depot: str,
    destination: Optional[str],
    quantity: float,
    bid_amount: int,
    won_timestamp: Optional[str] = None,
    rank: int = 1,
) -> Optional[int]:
    """
    Insert one Rank-1 win. Every call creates a new row (no deduplication).
    Returns new row id, or None on failure. Never raises.
    """
    if int(rank) != 1:
        return None
    depot_norm = normalize_depot_name(depot) or str(depot or "").strip().upper()
    if not depot_norm:
        return None
    dest_val = (destination or "").strip() or None
    ts = won_timestamp or utc_now_iso()
    try:
        with _LOCK:
            conn = _connect()
            try:
                cur = conn.execute(
                    """
                    INSERT INTO successful_bids
                        (depot, destination, quantity, bid_amount, won_timestamp, rank)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (depot_norm, dest_val, float(quantity), int(bid_amount), ts, 1),
                )
                conn.commit()
                return int(cur.lastrowid)
            finally:
                conn.close()
    except Exception:
        return None


def list_successful_bids(
    *,
    month: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    depot: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Query successful bids with optional filters (applied in SQL).
    month: YYYY-MM
    from_date / to_date: YYYY-MM-DD (inclusive, UTC date part of won_timestamp)
    depot: normalized depot name
    """
    clauses: List[str] = []
    params: List[Any] = []

    if month:
        month = str(month).strip()
        if len(month) == 7 and month[4] == "-":
            clauses.append("substr(won_timestamp, 1, 7) = ?")
            params.append(month)

    if from_date:
        from_date = str(from_date).strip()
        clauses.append("substr(won_timestamp, 1, 10) >= ?")
        params.append(from_date)

    if to_date:
        to_date = str(to_date).strip()
        clauses.append("substr(won_timestamp, 1, 10) <= ?")
        params.append(to_date)

    if depot:
        depot_norm = normalize_depot_name(depot) or str(depot).strip().upper()
        if depot_norm:
            clauses.append("depot = ?")
            params.append(depot_norm)

    where_sql = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = (
        "SELECT id, depot, destination, quantity, bid_amount, won_timestamp, rank "
        f"FROM successful_bids{where_sql} "
        "ORDER BY won_timestamp DESC, id DESC"
    )

    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(sql, params).fetchall()
        finally:
            conn.close()

    items = [
        {
            "id": int(r["id"]),
            "depot": r["depot"],
            "destination": r["destination"],
            "quantity": float(r["quantity"]),
            "bid_amount": int(r["bid_amount"]),
            "won_timestamp": r["won_timestamp"],
            "rank": int(r["rank"]),
        }
        for r in rows
    ]
    return {"items": items, "total": len(items)}
