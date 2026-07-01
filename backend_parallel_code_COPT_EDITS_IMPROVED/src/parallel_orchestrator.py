"""
Multiprocess orchestration: ProcessPoolExecutor + optional async background thread.
Does not import FastAPI (safe for worker spawn).
"""

from __future__ import annotations

import multiprocessing as mp
import os
import threading
import time
from concurrent.futures import Future, ProcessPoolExecutor, as_completed
from typing import Any, Callable, Dict, List, Optional

from .config_loader import get_app_config
from .job_store import job_store
from .logging_service import get_logger
from .depot_normalization import normalize_depot_name
from .selenium_worker import run_depot_worker

logger = get_logger("parallel_orchestrator")


def _filter_desired_bids_for_depot(depot: str, desired_bids: List[dict]) -> List[dict]:
    """
    When any bid carries ``depot``, each worker receives matching rows **plus** bids
    with no ``depot`` (those apply to every worker). If no bid has ``depot``, preserve
    legacy behavior (same full list for all workers).
    """
    if not desired_bids:
        return []
    has_explicit = any(
        b.get("depot") is not None and str(b.get("depot")).strip() for b in desired_bids
    )
    if not has_explicit:
        return [dict(b) for b in desired_bids]
    dn = normalize_depot_name(depot)
    out: List[dict] = []
    for b in desired_bids:
        bd = b.get("depot")
        if bd is None or not str(bd).strip():
            out.append(dict(b))
            continue
        if normalize_depot_name(str(bd)) == dn:
            out.append(dict(b))
    return out


def _resolve_login_stagger_seconds(mp_cfg: Dict[str, Any]) -> float:
    """Read login_stagger_seconds from settings (yaml + env via get_multiprocess_settings)."""
    raw = mp_cfg.get("login_stagger_seconds", 210)
    try:
        stagger = float(raw)
    except (TypeError, ValueError):
        stagger = 210.0
    if stagger < 0:
        stagger = 0.0
    return stagger


def _submit_workers_sequential_stagger(
    pool: ProcessPoolExecutor,
    depot_list: List[str],
    truck_id: str,
    desired_bids: List[dict],
    worker_retry_attempts: int,
    login_stagger_seconds: float,
) -> Dict[Future, str]:
    """
    Launch one depot worker at a time. After each launch (except the first), wait
    login_stagger_seconds before starting the next Chrome/login session.
    """
    future_map: Dict[Future, str] = {}
    n = len(depot_list)
    for i, d in enumerate(depot_list):
        if i > 0 and login_stagger_seconds > 0:
            logger.info(
                "[Orchestrator] login_stagger waiting %.1fs before launching depot=%s (%d/%d)",
                login_stagger_seconds,
                d,
                i + 1,
                n,
            )
            time.sleep(login_stagger_seconds)

        payload = {
            "truck_id": truck_id,
            "depot_name": d,
            "desired_bids": _filter_desired_bids_for_depot(d, list(desired_bids or [])),
            "worker_retry_attempts": worker_retry_attempts,
        }
        fut = pool.submit(run_depot_worker, payload)
        future_map[fut] = d
        logger.info(
            "[Orchestrator] Launched depot=%s sequential index=%d/%d (pre-launch wait=%.1fs)",
            d,
            i + 1,
            n,
            login_stagger_seconds if i > 0 else 0.0,
        )
    return future_map


def _resolve_depot_list(
    depot: str | None,
    truck_id: str,
    depots: List[str] | None,
) -> List[str]:
    cfg = get_app_config()
    yaml_depots = (cfg.get("sap", {}) or {}).get("depots") or []
    if depots and len(depots) > 0:
        out = [normalize_depot_name(d) for d in depots if str(d).strip()]
        return [d for d in out if d]
    if yaml_depots:
        out = [normalize_depot_name(d) for d in yaml_depots if str(d).strip()]
        return [d for d in out if d]
    fallback = normalize_depot_name(depot) or normalize_depot_name(truck_id)
    return [fallback] if fallback else []


def get_multiprocess_settings() -> Dict[str, Any]:
    cfg = get_app_config()
    auto = cfg.get("automation", {}) or {}
    mp_cfg = auto.get("multiprocess", {}) or {}
    parallel = cfg.get("parallel", {}) or {}
    parallel_cap = int(parallel.get("max_workers", 4))
    raw_workers = mp_cfg.get("max_parallel_workers")
    if raw_workers is None:
        requested = parallel_cap
    else:
        requested = int(raw_workers)
    abs_cap = int(mp_cfg.get("max_parallel_workers_absolute_cap", 16))
    abs_cap = max(1, abs_cap)
    max_parallel_workers = max(1, min(requested, abs_cap))
    raw_stagger = mp_cfg.get("login_stagger_seconds", 210)
    try:
        login_stagger_seconds = float(raw_stagger)
    except (TypeError, ValueError):
        login_stagger_seconds = 210.0
    if login_stagger_seconds < 0:
        login_stagger_seconds = 0.0
    env_stagger = os.getenv("AUTOMATION_LOGIN_STAGGER_SECONDS", "").strip()
    if env_stagger:
        try:
            login_stagger_seconds = float(env_stagger)
        except (TypeError, ValueError):
            pass
        if login_stagger_seconds < 0:
            login_stagger_seconds = 0.0
    return {
        "max_parallel_workers": max_parallel_workers,
        "max_parallel_workers_requested": requested,
        "max_parallel_workers_absolute_cap": abs_cap,
        "login_stagger_seconds": login_stagger_seconds,
        "worker_retry_attempts": int(mp_cfg.get("worker_retry_attempts", 2)),
        "depot_timeout_seconds": mp_cfg.get("depot_timeout_seconds"),
        "keep_browser_open": bool(mp_cfg.get("keep_browser_open", True)),
        "keep_browser_open_only_after_automation": bool(
            mp_cfg.get("keep_browser_open_only_after_automation", False)
        ),
        "post_execute_mode": str(mp_cfg.get("post_execute_mode", "passive")).strip().lower(),
        "post_execute_interval_seconds": float(mp_cfg.get("post_execute_interval_seconds", 5)),
        "post_execute_max_seconds": mp_cfg.get("post_execute_max_seconds"),
    }


def run_multiprocess_job_sync(
    truck_id: str,
    depot: str | None,
    depots: List[str] | None,
    desired_bids: List[dict],
) -> Dict[str, Any]:
    depot_list = _resolve_depot_list(depot, truck_id, depots)
    mp_cfg = get_multiprocess_settings()
    login_stagger_seconds = _resolve_login_stagger_seconds(mp_cfg)
    # Each depot keeps its own Chrome + monitor alive; pool must allow all depots concurrently.
    max_workers = max(1, len(depot_list))
    timeout = mp_cfg.get("depot_timeout_seconds")
    timeout_f = float(timeout) if timeout is not None else None

    t0 = time.perf_counter()
    results: List[Dict[str, Any]] = []
    ctx = mp.get_context("spawn")

    logger.info(
        "[Orchestrator] execution_mode=multiprocess backend=ProcessPoolExecutor "
        "parent_pid=%s depots=%d max_workers=%d login_stagger_seconds=%.1f "
        "(sequential launch; each depot independent Chrome+login+monitor)",
        os.getpid(),
        len(depot_list),
        max_workers,
        login_stagger_seconds,
    )
    if mp_cfg["max_parallel_workers_requested"] > mp_cfg["max_parallel_workers_absolute_cap"]:
        logger.warning(
            "max_parallel_workers capped: requested=%s absolute_cap=%s effective=%s",
            mp_cfg["max_parallel_workers_requested"],
            mp_cfg["max_parallel_workers_absolute_cap"],
            mp_cfg["max_parallel_workers"],
        )

    with ProcessPoolExecutor(max_workers=max_workers, mp_context=ctx) as pool:
        future_map = _submit_workers_sequential_stagger(
            pool,
            depot_list,
            truck_id,
            desired_bids,
            mp_cfg["worker_retry_attempts"],
            login_stagger_seconds,
        )

        for fut in as_completed(future_map):
            name = future_map[fut]
            try:
                if timeout_f is not None:
                    r = fut.result(timeout=timeout_f)
                else:
                    r = fut.result()
                results.append(r)
                if isinstance(r, dict) and r.get("worker_pid") is not None:
                    logger.info(
                        "[Orchestrator] Depot=%s finished worker_pid=%s status=%s",
                        name,
                        r.get("worker_pid"),
                        r.get("status"),
                    )
            except Exception as e:
                logger.exception("Depot worker future failed depot=%s", name)
                results.append(
                    {
                        "depot": name,
                        "status": "failed",
                        "rows": 0,
                        "prepared_bids": [],
                        "error": str(e),
                    }
                )

    order = {d: i for i, d in enumerate(depot_list)}
    results.sort(key=lambda r: order.get(str(r.get("depot", "")), 9999))

    elapsed = time.perf_counter() - t0
    overall = "completed"
    if any(r.get("status") == "failed" for r in results):
        overall = "partial_failed" if any(r.get("status") != "failed" for r in results) else "failed"
    rows_found = sum(int(r.get("rows", 0) or 0) for r in results)

    return {
        "status": overall,
        "truck_id": truck_id,
        "depot": depot or truck_id,
        "depots_processed": [r.get("depot") for r in results],
        "results": results,
        "rows_found": rows_found,
        "bids_submitted": 0,
        "execution_time": f"{elapsed:.1f} seconds",
        "message": "Multiprocess run finished; ready for manual bid locking (no automated submit)",
        "execution_mode": "multiprocess",
        "multiprocess_max_workers": max_workers,
        "bidding_result": {
            "status": overall,
            "depots_processed": [r.get("depot") for r in results],
            "rows_found": rows_found,
            "bids_submitted": 0,
            "execution_time": f"{elapsed:.1f} seconds",
            "results": results,
        },
    }


def _async_job_thread(
    job_id: str,
    truck_id: str,
    depot_list: List[str],
    desired_bids: List[dict],
    mp_cfg: Dict[str, Any],
    on_complete: Optional[Callable[[str, Dict[str, Any]], None]] = None,
) -> None:
    job_store.mark_running(job_id)
    login_stagger_seconds = _resolve_login_stagger_seconds(mp_cfg)
    max_workers = max(1, len(depot_list))
    timeout = mp_cfg.get("depot_timeout_seconds")
    timeout_f = float(timeout) if timeout is not None else None
    ctx = mp.get_context("spawn")

    try:
        logger.info(
            "[Orchestrator] Async job_id=%s depots=%d max_workers=%d login_stagger_seconds=%.1f",
            job_id,
            len(depot_list),
            max_workers,
            login_stagger_seconds,
        )
        with ProcessPoolExecutor(max_workers=max_workers, mp_context=ctx) as pool:
            future_map = _submit_workers_sequential_stagger(
                pool,
                depot_list,
                truck_id,
                desired_bids,
                int(mp_cfg["worker_retry_attempts"]),
                login_stagger_seconds,
            )

            for fut in as_completed(future_map):
                name = future_map[fut]
                try:
                    if timeout_f is not None:
                        r = fut.result(timeout=timeout_f)
                    else:
                        r = fut.result()
                    job_store.record_depot_result(job_id, name, r)
                except Exception as e:
                    logger.exception("Async job depot failed depot=%s", name)
                    job_store.record_depot_error(job_id, name, str(e))

        snap = job_store.get_job(job_id)
        results = (snap or {}).get("results") or {}
        values = list(results.values()) if isinstance(results, dict) else []
        overall = "completed"
        if any(isinstance(v, dict) and v.get("status") == "failed" for v in values):
            overall = (
                "partial_failed"
                if any(isinstance(v, dict) and v.get("status") != "failed" for v in values)
                else "failed"
            )
        job_store.finalize(job_id, overall, summary=f"depots={len(depot_list)}")
        if on_complete:
            on_complete(job_id, job_store.get_job(job_id) or {})
    except Exception as e:
        logger.exception("Async job crashed job_id=%s", job_id)
        job_store.finalize(job_id, "failed", summary=str(e))


def start_multiprocess_job_async(
    truck_id: str,
    depot: str | None,
    depots: List[str] | None,
    desired_bids: List[dict],
    on_complete: Optional[Callable[[str, Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    depot_list = _resolve_depot_list(depot, truck_id, depots)
    job_id = job_store.create_job(truck_id, depot_list, desired_bids)
    mp_cfg = get_multiprocess_settings()

    thread = threading.Thread(
        target=_async_job_thread,
        args=(job_id, truck_id, depot_list, desired_bids, mp_cfg, on_complete),
        daemon=True,
        name=f"mp-orchestrator-{job_id[:8]}",
    )
    thread.start()

    return {
        "status": "queued",
        "job_id": job_id,
        "truck_id": truck_id,
        "depots": depot_list,
        "execution_mode": "multiprocess",
        "multiprocess_max_workers": mp_cfg["max_parallel_workers"],
        "message": "Job queued; poll GET /api/bid-job/{job_id}",
        "poll_path": f"/api/bid-job/{job_id}",
    }
