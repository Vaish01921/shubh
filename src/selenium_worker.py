"""
Multiprocessing worker entry point: one Chrome + one depot per process.

Must remain a top-level function for Windows spawn compatibility.

After a successful depot run, optional POST_EXECUTE keepalive (see
automation.multiprocess.keep_browser_open) keeps the WebDriver and Chrome open
so the SAP session stays visible; no driver.quit() unless disabled or on error.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from .config_loader import get_app_config
from .depot_normalization import normalize_depot_name
from .depot_bidding_engine import DepotBiddingEngine, DesiredBid
from .driver_factory import create_driver
from .login_service import login
from .logging_service import configure_named_logger, get_logging_settings

_ENGINE_LOGGER_NAME = "backend_automation.depot_bidding_engine"


class _EnginePrefixFormatter(logging.Formatter):
    def __init__(self, prefix: str, inner: logging.Formatter | None) -> None:
        super().__init__()
        self._prefix = prefix
        self._inner = inner

    def format(self, record: logging.LogRecord) -> str:
        if self._inner is not None:
            body = self._inner.format(record)
        else:
            body = record.getMessage()
        return f"{self._prefix} {body}"


def _apply_engine_log_prefix(depot_name: str) -> List[Tuple[logging.Handler, logging.Formatter | None]]:
    pid = os.getpid()
    prefix = f"[Worker PID={pid} | Depot {depot_name}]"
    eng = logging.getLogger(_ENGINE_LOGGER_NAME)
    restored: List[Tuple[logging.Handler, logging.Formatter | None]] = []
    for h in eng.handlers:
        restored.append((h, h.formatter))
        h.setFormatter(_EnginePrefixFormatter(prefix, h.formatter))
    return restored


def _restore_engine_log_formatters(
    restored: List[Tuple[logging.Handler, logging.Formatter | None]],
) -> None:
    for h, fmt in restored:
        try:
            h.setFormatter(fmt)
        except Exception:
            pass


def _configure_worker_logging(depot_name: str) -> logging.LoggerAdapter:
    tag = depot_name or "unknown"
    settings = get_logging_settings()
    console = bool(settings.get("general_console_enabled", True))
    base = logging.getLogger(f"selenium_worker.{tag}")
    configure_named_logger(base, tag, level=logging.INFO, console=console)
    return logging.LoggerAdapter(base, {"depot_tag": tag})


def _env_truthy(name: str, default: bool = True) -> bool:
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _session_keepalive_settings(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Multiprocess worker: keep Chrome open after depot run (see application.yaml automation.multiprocess)."""
    mp_cfg = (cfg.get("automation") or {}).get("multiprocess") or {}
    keep = bool(mp_cfg.get("keep_browser_open", True))
    if os.getenv("AUTOMATION_KEEP_BROWSER_OPEN") is not None:
        keep = _env_truthy("AUTOMATION_KEEP_BROWSER_OPEN", default=keep)
    only_after_auto = bool(mp_cfg.get("keep_browser_open_only_after_automation", False))
    mode = str(mp_cfg.get("post_execute_mode", "passive")).strip().lower()
    if mode not in ("passive", "monitor"):
        mode = "passive"
    interval = float(mp_cfg.get("post_execute_interval_seconds", 5) or 5)
    if interval < 1.0:
        interval = 1.0
    max_sec = mp_cfg.get("post_execute_max_seconds")
    max_f: Optional[float] = None
    if max_sec is not None and str(max_sec).strip() != "":
        try:
            max_f = float(max_sec)
        except (TypeError, ValueError):
            max_f = None
    return {
        "keep_browser_open": keep,
        "keep_browser_open_only_after_automation": only_after_auto,
        "post_execute_mode": mode,
        "post_execute_interval_seconds": interval,
        "post_execute_max_seconds": max_f,
    }


def _post_execute_keepalive(
    engine: DepotBiddingEngine,
    log: logging.LoggerAdapter,
    settings: Dict[str, Any],
) -> None:
    """
    POST_EXECUTE / IDLE: keep process alive so Chrome stays open. No bidding actions.
    monitor mode: read-only timer text for observation (does not trigger EXEC).
    """
    mode = settings["post_execute_mode"]
    interval = float(settings["post_execute_interval_seconds"])
    max_f: Optional[float] = settings.get("post_execute_max_seconds")

    deadline: Optional[float] = None
    if max_f is not None and max_f > 0:
        deadline = time.monotonic() + max_f

    log.info(
        "POST_EXECUTE: state=IDLE mode=%s interval=%.1fs max_seconds=%s — SAP session kept open (no driver.quit)",
        mode,
        interval,
        "unlimited" if deadline is None else str(max_f),
    )
    while True:
        if deadline is not None and time.monotonic() >= deadline:
            log.info("POST_EXECUTE: max keepalive elapsed — worker will release WebDriver")
            return
        time.sleep(interval)
        if mode == "monitor":
            try:
                t = engine._read_timer_text()
                log.info("POST_EXECUTE: monitor timer=%r", (t or "")[:160])
            except Exception as e:
                log.warning("POST_EXECUTE: monitor read failed: %s", e)
        else:
            log.info(
                "POST_EXECUTE: session alive — PID=%s (passive)",
                os.getpid(),
            )


def run_depot_worker(payload: Dict[str, Any]) -> Dict[str, Any]:
    depot = normalize_depot_name(str(payload.get("depot_name", "")).strip())
    truck_id = str(payload.get("truck_id", ""))
    desired_raw: List[dict] = payload.get("desired_bids") or []
    outer_retries = max(1, int(payload.get("worker_retry_attempts", 2)))

    log = _configure_worker_logging(depot or "unknown")

    t0 = time.perf_counter()
    pid = os.getpid()
    log.info(
        "[Depot %s] Worker started (PID=%s) truck_id=%s (no pre-driver delay; batching is orchestrator-only)",
        depot or "?",
        pid,
        truck_id,
    )

    desired: List[DesiredBid] = []
    for b in desired_raw:
        q = float(b.get("quantity", 0))
        if q <= 0:
            continue
        bd = b.get("depot")
        dd = (
            normalize_depot_name(str(bd))
            if bd is not None and str(bd).strip()
            else depot
        )
        desired.append(
            DesiredBid(quantity=q, destination=b.get("destination"), depot=dd)
        )

    cfg_early = get_app_config()
    session_cfg = _session_keepalive_settings(cfg_early)
    log.info(
        "[Depot %s] Session policy: keep_browser_open=%s only_after_automation=%s post_execute_mode=%s",
        depot or "?",
        session_cfg["keep_browser_open"],
        session_cfg.get("keep_browser_open_only_after_automation", False),
        session_cfg["post_execute_mode"],
    )

    last_error: str | None = None
    for attempt in range(1, outer_retries + 1):
        driver = None
        engine = None
        restored: List[Tuple[logging.Handler, logging.Formatter | None]] = []
        skip_driver_quit = False
        try:
            restored = _apply_engine_log_prefix(depot or "?")
            log.info(
                "[Depot %s] Creating driver (outer attempt %d/%d)",
                depot or "?",
                attempt,
                outer_retries,
            )
            driver = create_driver()
            driver.set_page_load_timeout(90)
            driver.implicitly_wait(0)
            log.info("[Depot %s] Driver created (PID=%s)", depot or "?", os.getpid())

            cfg = get_app_config()
            session_cfg = _session_keepalive_settings(cfg)
            base_url = (cfg.get("sap", {}) or {}).get("base_url")
            if not base_url:
                raise RuntimeError("sap.base_url missing")

            driver.get(base_url)
            log.info("Phase: SAP login")
            login(driver)
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            log.info("Login completed; session active in this process")

            engine = DepotBiddingEngine(driver=driver, depot_name=depot, desired_bids=desired)
            log.info("Phase: open E-Bidding app")
            engine._open_bidding_app()
            log.info("E-Bidding app ready; phase: depot processing + live monitoring")
            result = engine.process_single_depot(depot)
            result = dict(result)
            result["worker_pid"] = os.getpid()
            result["worker_duration_sec"] = round(time.perf_counter() - t0, 2)
            result["outer_attempt"] = attempt
            result["browser_session_kept_open"] = bool(session_cfg["keep_browser_open"])
            log.info(
                "[Depot %s] Worker completed status=%s rows=%s (PID=%s)",
                depot or "?",
                result.get("status"),
                result.get("rows"),
                os.getpid(),
            )
            if session_cfg["keep_browser_open"]:
                need_keep = True
                if session_cfg.get("keep_browser_open_only_after_automation") and not result.get(
                    "automation_executed"
                ):
                    need_keep = False
                    log.info(
                        "[Depot %s] keep_browser_open_only_after_automation: no automation — will close WebDriver",
                        depot or "?",
                    )
                if need_keep:
                    skip_driver_quit = True
                    log.info(
                        "[Depot %s] Keeping WebDriver alive after depot run (POST_EXECUTE / IDLE)",
                        depot or "?",
                    )
                    _post_execute_keepalive(engine, log, session_cfg)
                    skip_driver_quit = False
            return result
        except Exception as e:
            last_error = str(e)
            log.exception("Worker attempt %d failed: %s", attempt, e)
        finally:
            quit_drv = engine.driver if engine is not None else driver
            if quit_drv and not skip_driver_quit:
                try:
                    log.info(
                        "[Depot %s] WebDriver quit (lifecycle cleanup, PID=%s)",
                        depot or "?",
                        os.getpid(),
                    )
                    quit_drv.quit()
                except Exception as e:
                    log.warning("WebDriver quit failed: %s", e)
            _restore_engine_log_formatters(restored)
        time.sleep(min(5.0, 1.0 * attempt))

    return {
        "depot": depot,
        "status": "failed",
        "rows": 0,
        "prepared_bids": [],
        "error": last_error or "worker_exhausted",
        "worker_pid": os.getpid(),
        "worker_duration_sec": round(time.perf_counter() - t0, 2),
    }
