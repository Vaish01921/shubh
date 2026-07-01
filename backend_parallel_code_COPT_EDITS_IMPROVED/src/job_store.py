"""
In-memory job status store for multiprocess bid runs.
Thread-safe; optional JSON snapshot on completion under logs/jobs/.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional


_MAX_JOBS = 200


@dataclass
class JobRecord:
    job_id: str
    truck_id: str
    depots: List[str]
    status: str  # queued | running | completed | failed
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    desired_bids_count: int = 0
    results: Dict[str, Any] = field(default_factory=dict)
    errors: Dict[str, str] = field(default_factory=dict)
    summary: Optional[str] = None


class JobStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: Dict[str, JobRecord] = {}

    def create_job(
        self,
        truck_id: str,
        depots: List[str],
        desired_bids: List[dict],
    ) -> str:
        job_id = str(uuid.uuid4())
        rec = JobRecord(
            job_id=job_id,
            truck_id=truck_id,
            depots=list(depots),
            status="queued",
            created_at=time.time(),
            desired_bids_count=len(desired_bids or []),
        )
        with self._lock:
            self._prune_locked()
            self._jobs[job_id] = rec
        return job_id

    def mark_running(self, job_id: str) -> None:
        with self._lock:
            r = self._jobs.get(job_id)
            if r:
                r.status = "running"
                r.started_at = time.time()

    def record_depot_result(self, job_id: str, depot: str, result: Dict[str, Any]) -> None:
        with self._lock:
            r = self._jobs.get(job_id)
            if r:
                r.results[depot] = result

    def record_depot_error(self, job_id: str, depot: str, message: str) -> None:
        with self._lock:
            r = self._jobs.get(job_id)
            if r:
                r.errors[depot] = message
                r.results[depot] = {"depot": depot, "status": "failed", "error": message}

    def finalize(
        self,
        job_id: str,
        overall_status: str,
        summary: str | None = None,
    ) -> None:
        with self._lock:
            r = self._jobs.get(job_id)
            if r:
                r.status = overall_status
                r.completed_at = time.time()
                r.summary = summary
        self._write_snapshot(job_id)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            r = self._jobs.get(job_id)
            if not r:
                return None
            return self._serialize(r)

    def _serialize(self, r: JobRecord) -> Dict[str, Any]:
        d = asdict(r)
        d["created_at_iso"] = _iso(r.created_at)
        if r.started_at:
            d["started_at_iso"] = _iso(r.started_at)
        if r.completed_at:
            d["completed_at_iso"] = _iso(r.completed_at)
        return d

    def _prune_locked(self) -> None:
        if len(self._jobs) <= _MAX_JOBS:
            return
        items = sorted(
            self._jobs.items(),
            key=lambda kv: (kv[1].completed_at or kv[1].created_at, kv[0]),
        )
        for jid, rec in items:
            if len(self._jobs) <= _MAX_JOBS:
                break
            if rec.status in ("completed", "failed"):
                del self._jobs[jid]

    def _write_snapshot(self, job_id: str) -> None:
        try:
            base = Path(__file__).resolve().parent.parent / "logs" / "jobs"
            base.mkdir(parents=True, exist_ok=True)
            data = self.get_job(job_id)
            if data:
                path = base / f"{job_id}.json"
                path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        except Exception:
            pass


def _iso(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


job_store = JobStore()
