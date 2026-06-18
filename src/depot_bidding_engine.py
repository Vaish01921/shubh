"""
Depot Bidding Engine — production-grade SAP bidding workflow.

Modular, config-driven, high-performance. No CLI; no input().
Flow: navigate → filters → search → parse → strategy → timer → batch submit.
"""

from __future__ import annotations

import os
import time
import threading
from datetime import datetime
from dataclasses import dataclass
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple, Literal

from bs4 import BeautifulSoup
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from .config_loader import BASE_DIR, get_app_config
from .depot_normalization import normalize_depot_name
from .logging_service import enter_execution_phase, exit_execution_phase, get_logger


logger = get_logger("depot_bidding_engine")


class _BackgroundScreenRecorder:
    """Non-blocking screen recorder for execution debugging (background thread + join on stop)."""

    _JOIN_TIMEOUT_SEC = 30.0

    def __init__(self, output_path: Path, fps: float = 6.0, log_prefix: str = "") -> None:
        self.output_path = output_path
        self.fps = max(1.0, float(fps or 6.0))
        self._log_prefix = log_prefix
        self._stop_evt = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._started = False

    def start(self) -> bool:
        if self._started:
            return True
        self._stop_evt.clear()
        self._thread = threading.Thread(target=self._capture_loop, daemon=False, name="screen_recorder")
        self._thread.start()
        self._started = True
        return True

    def stop(self) -> None:
        self._stop_evt.set()
        t = self._thread
        if t is not None and t.is_alive():
            t.join(timeout=self._JOIN_TIMEOUT_SEC)
            if t.is_alive():
                logger.warning(
                    "%s [REC][WARN] Recording thread did not exit within %.0fs",
                    self._log_prefix,
                    self._JOIN_TIMEOUT_SEC,
                )

    @staticmethod
    def _bgr_frame_for_writer(frame: Any, width: int, height: int, cv2: Any, np: Any) -> Any:
        """BGR uint8 frame with shape (height, width, 3) for VideoWriter."""
        bgr = np.ascontiguousarray(frame[:, :, :3])
        h, w = int(bgr.shape[0]), int(bgr.shape[1])
        if w != width or h != height:
            return cv2.resize(bgr, (width, height), interpolation=cv2.INTER_AREA)
        return bgr

    def _capture_loop(self) -> None:
        pfx = self._log_prefix
        writer: Any = None
        full_path_str = str(self.output_path.resolve())
        try:
            try:
                import cv2  # type: ignore
                import mss  # type: ignore
                import numpy as np  # type: ignore
            except ImportError:
                logger.exception("%s [REC][ERROR] Recording import failed (cv2 / mss / numpy)", pfx)
                return

            try:
                self.output_path.parent.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                logger.error(
                    "%s [REC][ERROR] Cannot create recording directory: %s path=%s",
                    pfx,
                    e,
                    full_path_str,
                )
                return

            try:
                with mss.mss() as sct:
                    if len(sct.monitors) < 2:
                        logger.error(
                            "%s [REC][ERROR] No primary display for MSS (monitors len=%d)",
                            pfx,
                            len(sct.monitors),
                        )
                        return
                    monitor = sct.monitors[1]
                    width = int(monitor["width"])
                    height = int(monitor["height"])
                    if width <= 0 or height <= 0:
                        logger.error(
                            "%s [REC][ERROR] Invalid monitor dimensions width=%s height=%s",
                            pfx,
                            width,
                            height,
                        )
                        return

                    logger.info("%s [REC][DEBUG] Output path=%s", pfx, full_path_str)
                    logger.info("%s [REC][DEBUG] Resolution=%dx%d", pfx, width, height)
                    logger.info("%s [REC][DEBUG] FPS=%s", pfx, self.fps)

                    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                    writer = cv2.VideoWriter(full_path_str, fourcc, self.fps, (width, height))
                    if writer is None or not writer.isOpened():
                        logger.error(
                            "%s [REC][ERROR] VideoWriter failed to open at path=%s",
                            pfx,
                            full_path_str,
                        )
                        if writer is not None:
                            try:
                                writer.release()
                            except Exception:
                                pass
                        writer = None
                        return

                    try:
                        shot0 = sct.grab(monitor)
                        frame0 = np.array(shot0)
                        bgr0 = self._bgr_frame_for_writer(frame0, width, height, cv2, np)
                        writer.write(bgr0)
                    except Exception:
                        logger.exception("%s [REC][ERROR] Failed to write initial video frame", pfx)
                        return

                    logger.info("%s [REC] Recording started: %s", pfx, full_path_str)

                    frame_interval = 1.0 / self.fps
                    while not self._stop_evt.is_set():
                        t0 = time.perf_counter()
                        try:
                            shot = sct.grab(monitor)
                            frame = np.array(shot)
                            bgr = self._bgr_frame_for_writer(frame, width, height, cv2, np)
                            writer.write(bgr)
                        except Exception:
                            logger.exception("%s [REC][ERROR] Frame capture/write failed", pfx)
                            break
                        elapsed = time.perf_counter() - t0
                        rem = frame_interval - elapsed
                        if rem > 0:
                            time.sleep(rem)
            except Exception:
                logger.exception("%s [REC][ERROR] Recording loop crashed", pfx)
        finally:
            if writer is not None:
                try:
                    writer.release()
                except Exception as e:
                    logger.warning("%s [REC][WARN] VideoWriter.release failed: %s", pfx, e)


@dataclass
class DesiredBid:
    quantity: float
    destination: Optional[str] = None
    depot: Optional[str] = None


@dataclass
class RowSnapshot:
    row_index: int
    club_id: int
    destination: str
    quantity: float
    base_price: float
    company: str
    spi: str = ""


class DepotBiddingEngine:
    """
    Full bidding pipeline: open app → filters → search → parse → strategy
    → Shubh Carrier timer loop (0.1s poll, WDWait 10s timer) → Search (WDWait 5s)
    → first input WDWait 10s → send_keys per row + ThreadPoolExecutor → Save native
    → sleep 0.2 → Yes/OK (same method order as ayodhya_parallel).
    """

    def __init__(
        self,
        driver: WebDriver,
        depot_name: str,
        desired_bids: List[DesiredBid],
    ) -> None:
        self.driver = driver
        self.depot_name_raw = str(depot_name or "").strip()
        self.depot_name = normalize_depot_name(depot_name)
        self._all_desired_bids: List[DesiredBid] = list(desired_bids)
        self._scoped_by_depot: Dict[str, List[DesiredBid]] = {}
        self._unscoped_bids: List[DesiredBid] = []
        self._bids_have_depot = False
        for b in self._all_desired_bids:
            raw = getattr(b, "depot", None)
            if raw is not None and str(raw).strip():
                self._bids_have_depot = True
                k = normalize_depot_name(str(raw))
                if k:
                    self._scoped_by_depot.setdefault(k, []).append(b)
            else:
                self._unscoped_bids.append(b)
        if self._bids_have_depot:
            scoped = list(self._scoped_by_depot.get(self.depot_name, []))
            self.desired_bids = scoped + list(self._unscoped_bids)
        else:
            self.desired_bids = list(self._all_desired_bids)
        logger.info(
            "Engine start | Raw depot received: %r | Normalized depot used: %r | scoped_depot_keys=%s | unscoped_count=%d | active_bid_count=%d",
            self.depot_name_raw,
            self.depot_name,
            list(self._scoped_by_depot.keys()),
            len(self._unscoped_bids),
            len(self.desired_bids),
        )
        self.config = get_app_config()
        self.sap_cfg = self.config.get("sap", {})
        self.table_cfg = self.config.get("table", {}).get("cell_indices", {})
        self.element_wait = int(self.config.get("element_wait_timeout_seconds", 25))
        self.search_retry_interval = int(self.config.get("search_retry_interval_seconds", 10))
        self.timer_element_id = str(self.config.get("timer_element_id", "__xmlview0--timer-inner"))
        self.quantity_tolerance = float(self.config.get("quantity_tolerance", 0.01))
        self._screenshots_dir: Optional[Path] = None
        self._exec_recorder: Optional[_BackgroundScreenRecorder] = None
        # One screen-recording session per bid execution attempt (_run_fill_after_search).
        self._exec_recording_attempt_key: Optional[object] = None
    def _set_depot_context(self, depot: str) -> None:
        self.depot_name_raw = str(depot or "").strip()
        self.depot_name = normalize_depot_name(depot)
        if not self._bids_have_depot:
            self.desired_bids = list(self._all_desired_bids)
            return
        scoped = list(self._scoped_by_depot.get(self.depot_name, []))
        self.desired_bids = scoped + list(self._unscoped_bids)

    @staticmethod
    def _tonnage_config_key(desired_quantity: float) -> Optional[int]:
        if desired_quantity <= 0:
            return None
        rounded = round(desired_quantity)
        if abs(desired_quantity - rounded) >= 0.01:
            return None
        return int(rounded)

    def _excluded_spi_for_tonnage(self, desired_quantity: float) -> Optional[str]:
        """SPI to exclude for this leg; exact string from config; None if tonnage not in map."""
        ton_key = self._tonnage_config_key(desired_quantity)
        if ton_key is None:
            return None
        by_tonnage = self.config.get("excluded_spi_by_tonnage") or {}
        spi = by_tonnage.get(ton_key)
        if spi is None:
            return None
        return spi

    def _screenshots_dir_path(self) -> Path:
        if self._screenshots_dir is None:
            self._screenshots_dir = Path(__file__).resolve().parent.parent / "screenshots"
            self._screenshots_dir.mkdir(parents=True, exist_ok=True)
        return self._screenshots_dir

    def _timing_log_new(self, step_name: str, start_time: float) -> None:
        elapsed = time.perf_counter() - start_time
        line = f"[TIMING - NEW] {step_name}: {elapsed:.2f} sec"
        print(line)
        # Keep timing prints (needed for analysis) but avoid synchronous logger I/O overhead.

    def _screenshot_on_failure(self, label: str) -> None:
        try:
            path = self._screenshots_dir_path() / f"bidding_{label}_{self.depot_name}.png"
            self.driver.save_screenshot(str(path))
            logger.info("📸 Screenshot on failure: %s", path)
        except Exception as e:
            logger.warning("Could not save failure screenshot: %s", e)

    def _screenshot_stage(self, stage: str) -> None:
        """Save a screenshot for a given stage (e.g. after_show_search) to verify automation."""
        # Stage screenshots are expensive; keep them only when explicitly requested.
        if os.getenv("EBIDDING_STAGE_SCREENSHOTS", "").strip().lower() not in ("1", "true", "yes", "on"):
            return
        try:
            path = self._screenshots_dir_path() / f"stage_{stage}_{self.depot_name}.png"
            self.driver.save_screenshot(str(path))
            logger.info("📸 Stage screenshot: %s", path)
        except Exception as e:
            logger.warning("Could not save stage screenshot: %s", e)

    def _debug_dom_context(self, stage: str) -> None:
        """
        Log information about the current DOM context to verify we are in the same
        E-Bidding app/view as Shubh Carrier.
        """
        # DOM debug is also expensive; keep it only when explicitly requested.
        if os.getenv("EBIDDING_DOM_DEBUG", "").strip().lower() not in ("1", "true", "yes", "on"):
            return
        try:
            url = self.driver.current_url
            title = self.driver.title
            handles = self.driver.window_handles
            iframes = self.driver.find_elements(By.TAG_NAME, "iframe")
            logger.info("🔎 DOM Debug (%s): url=%s title=%s handles=%s iframes=%d",
                        stage, url, title, handles, len(iframes))
            # Lightweight assertion: does Ship From Plant ID exist at all?
            ship_id = self.sap_cfg.get("ship_from_plant_field_id", "__xmlview0--ididUtclVCShipFromPlant-inner")
            try:
                self.driver.find_element(By.ID, ship_id)
                logger.info("🔎 DOM Debug (%s): Ship From Plant ID %s FOUND in current DOM", stage, ship_id)
            except Exception:
                logger.warning("❌ DOM Debug (%s): Ship From Plant ID %s NOT found — likely not in correct E-Bidding app DOM", stage, ship_id)
        except Exception as e:
            logger.warning("DOM debug (%s) failed: %s", stage, e)

    def _wait_for_ebidding_view_ready(self) -> None:
        """
        Strong readiness gate for E-Bidding.
        Avoid proceeding on generic "body present" checks; instead require view-specific anchors.
        """
        ship_id = self.sap_cfg.get(
            "ship_from_plant_field_id",
            "__xmlview0--ididUtclVCShipFromPlant-inner",
        )
        header_toggle_id = self.sap_cfg.get("header_show_search_button_id")
        bidding_url_hint = str(self.sap_cfg.get("bidding_url") or "")

        logger.info(
            "⏳ Waiting for E-Bidding view readiness (ship_id=%s, header_toggle_id=%s)",
            ship_id,
            header_toggle_id,
        )

        def _ready(d) -> bool:
            try:
                # Primary anchor: Ship From Plant field exists in this view.
                if ship_id:
                    d.find_element(By.ID, ship_id)
                    return True
            except Exception:
                pass

            # Secondary anchors: header toggle exists OR URL indicates the vendor app.
            try:
                if header_toggle_id:
                    d.find_element(By.ID, header_toggle_id)
                    return True
            except Exception:
                pass

            try:
                cur = (d.current_url or "")
                if bidding_url_hint and bidding_url_hint in cur:
                    return True
            except Exception:
                pass

            try:
                hide_btns = d.find_elements(By.XPATH, "//*[contains(.,'Hide Search')]")
                if any(b.is_displayed() for b in hide_btns):
                    return True
            except Exception:
                pass

            return False

        timeout = min(15, self.element_wait)
        WebDriverWait(self.driver, timeout).until(_ready)
        logger.info("✅ E-Bidding view readiness reached | current URL=%s", self.driver.current_url)

    def run(self) -> Dict[str, Any]:
        """
        Single-depot compatibility wrapper (uses process_all_depots → process_single_depot).

        When a bid plan is found and the auction timer reaches EXEC phase, bids are
        submitted via Save / Yes / OK (same as Shubh Carrier scripts).
        """
        result = self.process_all_depots([self.depot_name])
        # For backward compatibility, return first depot result summary
        first = (result.get("results") or [{}])[0]
        return {
            "status": first.get("status", result.get("status", "unknown")),
            "rows_found": first.get("rows", 0),
            "bids_submitted": int(first.get("bids_submitted", 0) or 0),
            "automation_executed": bool(first.get("automation_executed", False)),
            "execution_time": result.get("execution_time", ""),
            "depot": first.get("depot", self.depot_name),
            "prepared_bids": first.get("prepared_bids", []),
            "error": first.get("error"),
        }

    # ==========================================================
    # EXPERIMENTAL PARALLEL TABS (Option B) — single driver/session
    # ==========================================================

    def process_parallel_tabs(self, depot_list: List[str]) -> Dict[str, Any]:
        """
        Parallel multi-depot execution using ONE driver + ONE login session.
        Strategy:
        - Open vendor app once (same as Shubh Carrier)
        - Open one tab per depot (window.open + navigate)
        - Cooperative scheduler loop: iterate tabs, advance per-tab state
        - No threading/multiprocessing; parallelism simulated via tabs.
        """
        start = time.perf_counter()
        depots = [str(d).strip() for d in depot_list if str(d).strip()]
        results: List[Dict[str, Any]] = []
        depots_processed: List[str] = []

        try:
            # Step 1: Ensure vendor app is open once
            self.open_vendor_app()
            # Step 2: Open one tab per depot
            tab_map, tab_index = self.open_tabs_for_depots(depots)
            # Step 3: Cooperative processing across tabs
            results = self.process_all_tabs(tab_map=tab_map, tab_index=tab_index)
            depots_processed = [r.get("depot") for r in results if r.get("depot")]

            elapsed = time.perf_counter() - start
            status = "completed"
            if any(r.get("status") == "failed" for r in results):
                status = "partial_failed"
            return {
                "status": status,
                "depots_processed": depots_processed,
                "rows_found": int(sum(int(r.get("rows", 0) or 0) for r in results)),
                "bids_submitted": 0,
                "execution_time": f"{elapsed:.1f} seconds",
                "results": results,
            }
        except Exception as e:
            self._screenshot_on_failure("parallel_tabs_error")
            elapsed = time.perf_counter() - start
            logger.exception("Parallel tabs run failed: %s", e)
            return {
                "status": "failed",
                "depots_processed": depots_processed,
                "rows_found": 0,
                "bids_submitted": 0,
                "execution_time": f"{elapsed:.1f} seconds",
                "error": str(e),
                "results": results,
            }

    # -----------------------
    # Required function names
    # -----------------------

    def open_vendor_app(self) -> None:
        """Open E-Bidding vendor app once (tile/new-tab or direct URL)."""
        self._open_bidding_app()

    def open_tabs_for_depots(self, depots: List[str]) -> Tuple[Dict[str, str], Dict[str, int]]:
        """
        Create a new tab for each depot, navigate to vendor app URL, and return:
        - tab_map: { depot: window_handle }
        - tab_index: { depot: 1-based tab number } for logging
        """
        base_handle = self.driver.current_window_handle
        url = self.sap_cfg.get("bidding_url")
        if not url:
            raise RuntimeError("❌ sap.bidding_url missing in application.yaml")

        tab_map: Dict[str, str] = {}
        tab_index: Dict[str, int] = {}

        for i, depot in enumerate(depots, start=1):
            # Open a new blank tab (more reliable than window.open in automated contexts)
            self.driver.switch_to.window(base_handle)
            try:
                self.driver.switch_to.new_window("tab")
            except Exception as e:
                raise RuntimeError(f"Could not open new tab for depot {depot}: {e}") from e

            new_handle = self.driver.current_window_handle
            self.driver.get(url)
            WebDriverWait(self.driver, self.element_wait).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            tab_map[depot] = new_handle
            tab_index[depot] = i
            logger.info("[Tab %d | Depot %s] Tab opened, url=%s", i, depot, self.driver.current_url)

        # Switch back to base handle after opening tabs
        self.driver.switch_to.window(base_handle)
        return tab_map, tab_index

    def switch_to_tab(self, tab_handle: str) -> None:
        self.driver.switch_to.window(tab_handle)

    def ensure_filter_panel_open(self, depot: str, tab_no: int) -> None:
        prefix = f"[Tab {tab_no} | Depot {depot}]"
        logger.info("%s Opening filter panel...", prefix)
        self._ensure_filter_form_visible()

    def set_filters(self, depot: str, plant: str, tab_no: int) -> None:
        prefix = f"[Tab {tab_no} | Depot {depot}]"
        logger.info("%s Setting filters...", prefix)
        self._set_depot_context(depot)
        self._fill_filters()

    def click_search(self, depot: str, tab_no: int) -> None:
        prefix = f"[Tab {tab_no} | Depot {depot}]"
        logger.info("%s Clicking search...", prefix)
        # _run_search_once both clicks search and waits for table; we call it in wait_for_results

    def wait_for_results(self, depot: str, tab_no: int) -> Optional[str]:
        prefix = f"[Tab {tab_no} | Depot {depot}]"
        logger.info("%s Waiting for results...", prefix)
        return self._run_search_once()

    def process_results(self, depot: str, tab_no: int, tbody_html: str) -> Dict[str, Any]:
        prefix = f"[Tab {tab_no} | Depot {depot}]"
        snapshots = self._parse_table(tbody_html, depot=depot)
        rows = len(snapshots)
        logger.info("%s Results loaded: rows=%d", prefix, rows)
        prepared = self._compute_bid_plan(snapshots, depot=depot)
        logger.info("%s Processing bids... prepared=%d", prefix, len(prepared))
        logger.info("%s Ready for manual bid locking", prefix)
        return {"depot": depot, "status": "success", "rows": rows, "prepared_bids": prepared}

    def process_single_tab(self, tab_handle: str, depot: str, tab_no: int, attempt: int) -> Dict[str, Any]:
        prefix = f"[Tab {tab_no} | Depot {depot}]"
        self.switch_to_tab(tab_handle)

        # Session timeout detection (no auto re-login)
        if self._is_session_expired():
            logger.error("%s ERROR: Session expired — requires re-login", prefix)
            return {"depot": depot, "status": "failed", "error": "session_timeout", "rows": 0}

        try:
            self.ensure_filter_panel_open(depot, tab_no)
            self.set_filters(depot=depot, plant=str(self.sap_cfg.get("ship_from_plant", "TANDA CEMENT WORKS")), tab_no=tab_no)
            self.click_search(depot, tab_no)
            tbody_html = self.wait_for_results(depot, tab_no)
            if not tbody_html:
                logger.info("%s Results loaded: rows=0", prefix)
                logger.info("%s Completed", prefix)
                return {"depot": depot, "status": "success", "rows": 0, "prepared_bids": []}
            result = self.process_results(depot, tab_no, tbody_html)
            logger.info("%s Completed", prefix)
            return result
        except Exception as e:
            logger.error("%s ERROR (attempt %d/3): %s", prefix, attempt, e)
            self._screenshot_on_failure(f"tab_{tab_no}_depot_{depot}_attempt_{attempt}")
            raise

    def process_all_tabs(self, tab_map: Dict[str, str], tab_index: Dict[str, int]) -> List[Dict[str, Any]]:
        """
        Cooperative scheduler: TRUE interleaved multi-tab execution.
        Each loop iteration processes ALL tabs once, executing exactly ONE step
        for each tab based on its current state.
        """
        TabState = Literal[
            "INIT",
            "FILTER_OPENED",
            "FILTER_SET",
            "SEARCH_CLICKED",
            "WAITING_RESULTS",
            "COMPLETED",
            "FAILED",
        ]

        # Per-tab state machine storage
        tab_state_map: Dict[str, Dict[str, Any]] = {}
        per_depot_timeout = float(self.config.get("live_monitor_total_seconds", 20))

        for depot, handle in tab_map.items():
            tab_state_map[depot] = {
                "handle": handle,
                "tab_no": int(tab_index.get(depot, 0) or 0),
                "state": "INIT",  # type: TabState
                "retries": 0,
                "rows": 0,
                "prepared_bids": [],
                "error": None,
                "search_started_at": None,
                "started_at": time.monotonic(),
                "state_entered_at": time.monotonic(),
            }

        def _log(depot: str, msg: str) -> None:
            st = tab_state_map[depot]
            logger.info("[Tab %s | Depot %s | State %s] %s", st["tab_no"], depot, st["state"], msg)

        def _fail(depot: str, error: str) -> None:
            st = tab_state_map[depot]
            st["state"] = "FAILED"
            st["error"] = error
            _log(depot, f"ERROR: {error}")
            self._screenshot_on_failure(f"tab_{st['tab_no']}_depot_{depot}_failed")

        def _set_state(depot: str, new_state: str) -> None:
            st = tab_state_map[depot]
            st["state"] = new_state
            st["state_entered_at"] = time.monotonic()

        def _session_safety_check_all() -> bool:
            # If session expired in ANY tab, stop all (no auto relogin).
            for depot, st in tab_state_map.items():
                if st["state"] in ("COMPLETED", "FAILED"):
                    continue
                try:
                    self.switch_to_tab(st["handle"])
                    if self._is_session_expired():
                        logger.error("Session expired — stopping all tabs")
                        for d2 in tab_state_map.keys():
                            if tab_state_map[d2]["state"] not in ("COMPLETED", "FAILED"):
                                _fail(d2, "session_timeout")
                        return False
                except Exception:
                    continue
            return True

        def _try_open_filter_panel_once(depot: str) -> bool:
            # Non-blocking: max ~1-2 seconds work; no long waits.
            st = tab_state_map[depot]
            self.switch_to_tab(st["handle"])
            # If already open (Hide Search visible), done
            try:
                els = self.driver.find_elements(By.XPATH, "//*[contains(.,'Hide Search')]")
                if any(e.is_displayed() for e in els):
                    return True
            except Exception:
                pass
            # Use the existing robust helper (text/XPath/JS fallbacks)
            try:
                self._click_header_show_search()
            except Exception:
                pass
            # Confirm panel by short wait for ship-from-plant field presence
            ship_id = self.sap_cfg.get("ship_from_plant_field_id", "__xmlview0--ididUtclVCShipFromPlant-inner")
            try:
                WebDriverWait(self.driver, 2).until(EC.presence_of_element_located((By.ID, ship_id)))
                return True
            except Exception:
                return False

        def _try_set_filters_once(depot: str) -> bool:
            st = tab_state_map[depot]
            self.switch_to_tab(st["handle"])
            self._set_depot_context(depot)
            plant = str(self.sap_cfg.get("ship_from_plant", "TANDA CEMENT WORKS"))
            ship_id = self.sap_cfg.get("ship_from_plant_field_id", "__xmlview0--ididUtclVCShipFromPlant-inner")
            depot_id = self.sap_cfg.get("depot_field_id", "__xmlview0--idUtclVCDepot-inner")

            # Use existing finders but with short timeouts
            plant_el = self._find_plant_input(2, ship_id)
            depot_el = self._find_depot_input(2, depot_id)
            if not plant_el or not depot_el:
                return False
            self._fill_input_element(plant_el, plant, "Ship from plant")
            self._fill_input_element(depot_el, depot, "Depot")
            return True

        def _click_search_once(depot: str) -> bool:
            st = tab_state_map[depot]
            self.switch_to_tab(st["handle"])
            search_btn_id = self.sap_cfg.get("search_button_id", "__button3-BDI-content")
            try:
                btn = WebDriverWait(self.driver, 2).until(EC.element_to_be_clickable((By.ID, search_btn_id)))
                btn.click()
                return True
            except Exception:
                try:
                    ok = self.driver.execute_script(
                        "var b=document.getElementById(arguments[0]); if(b){b.click(); return true;} return false;",
                        search_btn_id,
                    )
                    return bool(ok)
                except Exception:
                    return False

        def _poll_results_once(depot: str) -> Tuple[bool, int, Optional[str]]:
            st = tab_state_map[depot]
            self.switch_to_tab(st["handle"])
            self._set_depot_context(depot)
            tbl_id = self.sap_cfg.get("results_table_id", "__xmlview0--idUtclVCVendorAssignmentTable-tblBody")
            try:
                tbody = WebDriverWait(self.driver, 2).until(EC.presence_of_element_located((By.ID, tbl_id)))
            except Exception:
                return False, 0, None
            html = tbody.get_attribute("outerHTML")
            soup = BeautifulSoup(html, "html.parser")
            rows = soup.find_all("tr")
            if not rows:
                return False, 0, html
            first_cells = [c.get_text(strip=True) for c in rows[0].find_all("td")]
            if any("No data" in c for c in first_cells):
                return False, 0, html
            return True, len(rows), html

        pending = True
        while pending:
            if not _session_safety_check_all():
                break

            pending = False
            for depot, st in tab_state_map.items():
                state: TabState = st["state"]
                if state in ("COMPLETED", "FAILED"):
                    continue
                pending = True

                tab_no = st["tab_no"]
                now = time.monotonic()

                # Retry exhaustion
                if st["retries"] >= 3 and state != "FAILED":
                    _fail(depot, "retry_exhausted")
                    continue

                try:
                    if state == "INIT":
                        _log(depot, "Opening filter panel")
                        if _try_open_filter_panel_once(depot):
                            _set_state(depot, "FILTER_OPENED")
                        else:
                            # Non-blocking poll: do NOT burn retries here.
                            _log(depot, "Filter panel not yet visible, will retry")

                    elif state == "FILTER_OPENED":
                        _log(depot, "Setting plant + depot filters")
                        if _try_set_filters_once(depot):
                            _set_state(depot, "FILTER_SET")
                        else:
                            _log(depot, "Filters not set yet, will retry")
                            # If stuck too long in this state, count as a retry and reset
                            if (now - float(st.get("state_entered_at") or now)) > 10:
                                st["retries"] += 1
                                _set_state(depot, "INIT")
                                _log(depot, "Stuck setting filters; retrying from INIT")

                    elif state == "FILTER_SET":
                        _log(depot, "Clicking search")
                        if _click_search_once(depot):
                            _set_state(depot, "SEARCH_CLICKED")
                            st["search_started_at"] = now
                        else:
                            st["retries"] += 1
                            _set_state(depot, "FILTER_SET")
                            _log(depot, "Search click failed, will retry")

                    elif state == "SEARCH_CLICKED":
                        _log(depot, "Polling results")
                        found, row_count, html = _poll_results_once(depot)
                        if found and html:
                            st["rows"] = row_count
                            st["prepared_bids"] = self._compute_bid_plan(
                                self._parse_table(html, depot=depot),
                                depot=depot,
                            )
                            _set_state(depot, "COMPLETED")
                            _log(depot, f"Completed (rows={row_count})")
                        else:
                            _set_state(depot, "WAITING_RESULTS")

                    elif state == "WAITING_RESULTS":
                        _log(depot, "Polling results...")
                        found, row_count, html = _poll_results_once(depot)
                        if found and html:
                            st["rows"] = row_count
                            st["prepared_bids"] = self._compute_bid_plan(
                                self._parse_table(html, depot=depot),
                                depot=depot,
                            )
                            _set_state(depot, "COMPLETED")
                            _log(depot, f"Completed (rows={row_count})")
                        else:
                            started = st.get("search_started_at") or st.get("started_at") or now
                            if (now - float(started)) > per_depot_timeout:
                                st["retries"] += 1
                                _set_state(depot, "FILTER_OPENED")
                                st["search_started_at"] = None
                                _log(depot, "Timeout waiting results; retrying from FILTER_OPENED")

                except Exception as e:
                    st["retries"] += 1
                    _log(depot, f"ERROR: {e}")
                    if st["retries"] >= 3:
                        _fail(depot, "retry_exhausted")

            # Short yield between full cycles (non-blocking)
            WebDriverWait(self.driver, 1).until(lambda d: True)

        ordered_depots = sorted(tab_state_map.keys(), key=lambda d: tab_state_map[d]["tab_no"])
        out: List[Dict[str, Any]] = []
        for depot in ordered_depots:
            st = tab_state_map[depot]
            status = "completed" if st["state"] == "COMPLETED" else "failed"
            r: Dict[str, Any] = {"depot": depot, "status": status, "rows": int(st.get("rows", 0) or 0)}
            if st["state"] == "FAILED":
                r["error"] = st.get("error") or "failed"
            out.append(r)
        return out

    def _is_session_expired(self) -> bool:
        """
        Detect obvious session expiry/log-out without auto re-login.
        Heuristics:
        - login fields appear
        - URL no longer vendor app and contains launchpad shell
        - page title indicates login
        """
        try:
            url = self.driver.current_url or ""
            title = (self.driver.title or "").lower()
            if "login" in title:
                return True
            # SAP login fields
            src = self.driver.page_source or ""
            if "USERNAME_FIELD" in src and "PASSWORD_FIELD" in src:
                return True
            if "FioriLaunchpad" in url and "zvc_vendor_app" not in url:
                return True
        except Exception:
            return False
        return False

    def process_all_depots(self, depot_list: List[str]) -> Dict[str, Any]:
        """
        Sequential multi-depot processing (single driver + single vendor-app tab).
        For each depot:
        - ensure filter panel open
        - set filters (plant fixed, depot dynamic)
        - click search and wait for results refresh
        - parse bids + compute plan
        - STOP before any lock/submit step (human-controlled)
        """
        start = time.perf_counter()
        results: List[Dict[str, Any]] = []
        depots_processed: List[str] = []
        total_rows = 0

        try:
            self._open_bidding_app()
            self._debug_dom_context(stage="after_open_bidding_app")

            for depot in depot_list:
                depot = str(depot).strip()
                if not depot:
                    continue
                r = self.process_single_depot(depot)
                results.append(r)
                depots_processed.append(depot)
                total_rows += int(r.get("rows", 0) or 0)

            elapsed = time.perf_counter() - start
            overall_status = "completed"
            if any(r.get("status") == "failed" for r in results):
                overall_status = "partial_failed"
            return {
                "status": overall_status,
                "depots_processed": depots_processed,
                "rows_found": total_rows,
                "bids_submitted": 0,
                "execution_time": f"{elapsed:.1f} seconds",
                "results": results,
            }
        except Exception as e:
            self._screenshot_on_failure("multi_depot_error")
            elapsed = time.perf_counter() - start
            logger.exception("Multi-depot run failed: %s", e)
            return {
                "status": "failed",
                "depots_processed": depots_processed,
                "rows_found": total_rows,
                "bids_submitted": 0,
                "execution_time": f"{elapsed:.1f} seconds",
                "error": str(e),
                "results": results,
            }

    def process_single_depot(self, depot: str) -> Dict[str, Any]:
        """
        Process a single depot with retries (up to 3).
        When a plan is found, runs timer PREP/EXEC and automated Save / Yes / OK (Shubh IDs).
        """
        max_retries = 3
        plant = str(self.sap_cfg.get("ship_from_plant", "TANDA CEMENT WORKS"))

        for attempt in range(1, max_retries + 1):
            prefix = f"[Depot {depot}]"
            try:
                logger.info("%s Opening filter panel...", prefix)
                self._ensure_filter_form_visible()

                logger.info("%s Clearing and setting plant...", prefix)
                logger.info("%s Clearing and setting depot...", prefix)
                self._set_filters(depot=depot, plant=plant)

                logger.info("%s Clicking search / live monitor...", prefix)
                rows_html, automation_executed, bids_submitted = self._live_monitor_search(prefix=prefix)

                if not rows_html:
                    logger.info("%s Results loaded: rows=0 (no data)", prefix)
                    logger.error("[%s][RESULT] NO_ROWS (monitor/search produced no usable table rows)", depot)
                    return {
                        "depot": depot,
                        "status": "no_rows",
                        "rows": 0,
                        "prepared_bids": [],
                        "automation_executed": False,
                        "bids_submitted": 0,
                    }

                snapshots = self._parse_table(rows_html, depot=depot)
                logger.info("%s Results loaded: rows=%d", prefix, len(snapshots))

                prepared = self._compute_bid_plan(snapshots, depot=depot)
                logger.info("%s Processing bids... prepared=%d", prefix, len(prepared))

                if automation_executed:
                    status = "automation_completed"
                    logger.info("[%s][RESULT] SUCCESS status=automation_completed bids_submitted=%d", depot, int(bids_submitted))
                elif prepared:
                    status = "timer_stopped_before_execute"
                    logger.error(
                        "[%s][EXEC][FAIL] Plan exists but execution did not complete; timer/trigger/action gate blocked",
                        depot,
                    )
                    logger.error("[%s][RESULT] TIMER_NOT_TRIGGERED", depot)
                else:
                    status = "no_valid_plan"
                    logger.error("[%s][RESULT] NO_VALID_PLAN", depot)

                return {
                    "depot": depot,
                    "status": status,
                    "rows": len(snapshots),
                    "prepared_bids": prepared,
                    "automation_executed": automation_executed,
                    "bids_submitted": int(bids_submitted),
                }
            except Exception as e:
                logger.warning("%s ERROR (attempt %d/%d): %s", prefix, attempt, max_retries, e)
                logger.error("[%s][RESULT][ATTEMPT_FAIL] attempt=%d reason=%s", depot, attempt, e)
                self._screenshot_on_failure(f"depot_{depot}_attempt_{attempt}")
                time.sleep(2)
                continue

        logger.error("[%s][RESULT] EXECUTION_FAILED retry_exhausted", depot)
        return {
            "depot": depot,
            "status": "failed",
            "rows": 0,
            "prepared_bids": [],
            "error": "retry_exhausted",
            "automation_executed": False,
            "bids_submitted": 0,
        }

    def _set_filters(self, depot: str, plant: str) -> None:
        """Clear previous values and set Ship From Plant (fixed) and Depot (loop value)."""
        self._set_depot_context(depot)
        self._fill_filters()

    # --- Verified Shubh Carrier element IDs only (no alternate selectors) ---
    _SHUBH_SAVE_ID = "__xmlview0--idUtclsaveTxt-inner"
    _SHUBH_YES_ID = "__mbox-btn-0"
    _SHUBH_OK_ID = "__mbox-btn-4"
    _SHUBH_EXEC_TIMER_EXACT = frozenset(
        ("Starts in 0:0:3", "Starts in 0:0:2", "Starts in 0:0:1", "Starts in 0:0:0")
    )

    @staticmethod
    def _shubh_bid_input_id(row_index: int) -> str:
        return (
            f"__xmlview0--idBidAmount-__xmlview0--idUtclVCVendorAssignmentTable-{row_index}-inner"
        )

    def _shubh_spi_inner_element_id(self, row_index: int) -> Optional[str]:
        """
        SPI inner control id for the same table row as _shubh_bid_input_id (same row_index).
        Config: sap.spi_inner_element_id_template with {row_index}, or
        sap.spi_inner_id_replace_bid_control_token to substitute for idBidAmount in the bid id string.
        """
        try:
            ri = int(row_index)
        except (TypeError, ValueError):
            return None
        tmpl = self.sap_cfg.get("spi_inner_element_id_template")
        if tmpl is not None and str(tmpl).strip():
            try:
                return str(tmpl).format(row_index=ri)
            except (KeyError, ValueError, IndexError):
                return None
        rep = self.sap_cfg.get("spi_inner_id_replace_bid_control_token")
        if rep is not None and str(rep).strip():
            return self._shubh_bid_input_id(ri).replace("idBidAmount", str(rep).strip(), 1)
        return None

    def _read_row_spi_display(self, row_index: int) -> str:
        """SPI cell text for logs only; never raises; returns display text or 'unknown'."""
        try:
            spi_id = self._shubh_spi_inner_element_id(row_index)
            if not spi_id:
                return "unknown"
            script = (
                "var e=document.getElementById(arguments[0]);"
                "if(!e)return null;"
                "var t=(e.textContent!=null&&e.textContent!=='')?e.textContent:"
                "(e.value!=null?String(e.value):'');"
                "return (t||'').trim();"
            )
            raw = self.driver.execute_script(script, spi_id)
            if raw is None:
                return "unknown"
            s = str(raw).strip()
            if not s:
                return "unknown"
            return " ".join(s.split())
        except Exception:
            return "unknown"

    @staticmethod
    def _shubh_integer_discount_bid(value: int, discount_percent: int) -> int:
        """
        Shubh Carrier (ayodhya_parallel): deduction = (value * d) // 100; return value - deduction.
        Integer math only; no float factor.
        """
        v = int(value)
        d = int(discount_percent)
        return v - (v * d) // 100

    def _validated_shubh_discount_percent(self) -> int:
        discount_raw = self.sap_cfg.get("bid_discount_percent", 2)
        try:
            x = float(discount_raw)
        except (TypeError, ValueError) as e:
            raise ValueError(
                "bid_discount_percent must be a number for Shubh logic"
            ) from e
        if not x.is_integer():
            raise ValueError(
                "bid_discount_percent must be an integer for Shubh logic"
            )
        return int(x)

    def _is_execute_timer_text(self, text: str) -> bool:
        """
        Shubh Carrier parity: EXEC when timer is exactly one of Starts in 0:0:3|2|1|0,
        or when text contains "Expires in" (substring, same as reference script).
        """
        logger.debug("Timer trigger eval: raw_text=%r", text)
        if not text:
            logger.debug("Timer trigger eval: empty text -> decision=False")
            return False
        t = text.strip()
        match_exact = t in self._SHUBH_EXEC_TIMER_EXACT
        contains_expires = "Expires in" in t
        decision = match_exact or contains_expires
        logger.debug("Timer trigger eval: normalized=%r", t)
        logger.debug("Timer trigger eval: match_exact_countdown=%s", match_exact)
        logger.debug("Timer trigger eval: contains_expires_in=%s", contains_expires)
        logger.debug("Timer trigger eval: final_decision=%s", decision)
        if not decision:
            logger.info(
                "[%s][TIMER][SKIP] timer_text=%r not matching execution condition",
                self.depot_name or "UNKNOWN",
                t[:120],
            )
        return decision

    def _read_timer_text(self) -> str:
        """Observe-only timer label (post_execute monitor); uses same element id as exec loop."""
        el = self.driver.find_element(By.ID, self.timer_element_id)
        return (el.text or "").strip()

    def _shubh_click_search_carrier(self, prefix: str) -> None:
        """ayodhya_parallel wait_for_timer_and_click_search2: Search click (5s wait, native)."""
        search_btn_id = self.sap_cfg.get("search_button_id", "__button3-BDI-content")
        search_box = WebDriverWait(self.driver, 5).until(
            EC.element_to_be_clickable((By.ID, search_btn_id))
        )
        search_box.click()
        logger.info("%s [EXEC] Shubh Search clicked id=%s", prefix, search_btn_id)

    def _wait_first_planned_bid_input_clickable(
        self, planned: List[Dict[str, Any]], prefix: str
    ) -> None:
        """After Search: WebDriverWait first bid inner field clickable (up to 10s)."""
        for p in planned:
            rid = p.get("row_index")
            if rid is None:
                continue
            bid_id = self._shubh_bid_input_id(int(rid))
            WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, bid_id))
            )
            return
        logger.warning("%s [EXEC] No row_index in plan; skip first-input wait", prefix)

    @staticmethod
    def _planned_rows_to_shubh_data_single(planned: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for p in planned:
            rid = p.get("row_index")
            price = p.get("bid_price")
            if rid is None or price is None:
                continue
            out.append(
                {
                    "rowid": int(rid),
                    "amount": int(price),
                    "destination": p.get("destination"),
                }
            )
        return out

    def _shubh_session_maintained_loop(self, prefix: str) -> None:
        """Outer ayodhya_parallel loop after successful bid: sleep(60) forever, keep SAP session open."""
        logger.info(
            "%s POST_EXEC: session maintained (60s interval). Press Ctrl+C to exit.",
            prefix,
        )
        while True:
            time.sleep(60)
            logger.info("%s Session maintained. Press Ctrl+C to exit.", prefix)

    def _log_post_execute_rank_result(self, prefix: str) -> None:
        """
        Best-effort read of post-bid rank from SAP UI for logging only.
        Uses sap.post_execute_rank_element_id or sap.post_execute_rank_css_selector from config;
        if unset or unreadable, logs rank=unknown. Never raises.
        """
        rank_disp = "unknown"
        try:
            el_id = self.sap_cfg.get("post_execute_rank_element_id")
            css_sel = self.sap_cfg.get("post_execute_rank_css_selector")
            id_s = str(el_id).strip() if el_id is not None else ""
            css_s = str(css_sel).strip() if css_sel is not None else ""
            if not id_s and not css_s:
                logger.info("%s [EXEC] RESULT rank=unknown", prefix)
                return
            if id_s:
                script = (
                    "var e=document.getElementById(arguments[0]);"
                    "if(!e)return null;"
                    "var t=(e.textContent!=null&&e.textContent!=='')?e.textContent:"
                    "(e.value!=null?String(e.value):'');"
                    "return (t||'').trim();"
                )
                raw = self.driver.execute_script(script, id_s)
            else:
                script = (
                    "var e=document.querySelector(arguments[0]);"
                    "if(!e)return null;"
                    "var t=(e.textContent!=null&&e.textContent!=='')?e.textContent:"
                    "(e.value!=null?String(e.value):'');"
                    "return (t||'').trim();"
                )
                raw = self.driver.execute_script(script, css_s)
            if raw is not None:
                s = str(raw).strip()
                if s:
                    rank_disp = " ".join(s.split())
        except Exception:
            rank_disp = "unknown"
        logger.info("%s [EXEC] RESULT rank=%s", prefix, rank_disp)

    def _start_exec_recording_if_needed(self, prefix: str, planned: List[Dict[str, Any]]) -> None:
        if not planned:
            return
        if self._exec_recorder is not None:
            return
        if self._exec_recording_attempt_key is None:
            return
        try:
            safe_depot = "".join(
                c if (c.isalnum() or c in ("-", "_")) else "_" for c in (self.depot_name or "UNKNOWN")
            )
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = f"{safe_depot}_{stamp}.mp4"
            rec_dir = BASE_DIR / "logs" / "screenrecording" / safe_depot
            output_path = rec_dir / file_name
            recorder = _BackgroundScreenRecorder(output_path, fps=6.0, log_prefix=prefix)
            recorder.start()
            self._exec_recorder = recorder
        except Exception as e:
            logger.warning("%s [REC] Recording start failed: %s", prefix, e)

    def _stop_exec_recording(self, prefix: str) -> None:
        recorder = self._exec_recorder
        self._exec_recorder = None
        if recorder is None:
            return
        try:
            recorder.stop()
            logger.info("%s [REC] Recording stopped", prefix)
        except Exception as e:
            logger.warning("%s [REC] Recording stop failed: %s", prefix, e)

    def _stop_exec_recording_for_attempt(self, prefix: str, attempt_key: object) -> None:
        """End recording only for the matching bid execution attempt (guards wrong/nested stops)."""
        if self._exec_recording_attempt_key is not attempt_key:
            if self._exec_recorder is None:
                logger.warning("%s [REC][WARN] Duplicate stop prevented", prefix)
            else:
                logger.warning(
                    "%s [REC][WARN] Recording stop skipped (attempt mismatch; avoids nested stop)",
                    prefix,
                )
            return
        self._exec_recording_attempt_key = None
        self._stop_exec_recording(prefix)

    def _recording_begin_for_valid_plan(
        self, prefix: str, planned: List[Dict[str, Any]], cycle_key: object
    ) -> None:
        """Start at most one recorder for this execution cycle (plan found → timer → execute)."""
        if not planned:
            return
        if self._exec_recording_attempt_key is not cycle_key:
            logger.warning("%s [REC][WARN] Duplicate start prevented", prefix)
            return
        if self._exec_recorder is not None:
            logger.info(
                "%s [REC][PLAN] Recording already active for current execution cycle",
                prefix,
            )
            return
        logger.info("%s [REC][PLAN] Valid bids detected -> recording starting", prefix)
        self._start_exec_recording_if_needed(prefix, planned)

    def _recording_finish_execution_cycle(self, prefix: str, cycle_key: object) -> None:
        logger.info("%s [REC][EXEC] Execution completed -> stopping recording", prefix)
        self._stop_exec_recording_for_attempt(prefix, cycle_key)
        logger.info("%s [REC][CLEANUP] Recording cleanup completed", prefix)

    def _execute_fast_bidding(self, planned: List[Dict[str, Any]], prefix: str) -> Dict[str, Any]:
        """
        ayodhya_parallel enter_bid_amount_and_save: send_keys per row, ThreadPoolExecutor,
        Save native click, sleep 0.2, Yes/OK method lists (WebDriverWait 8s + JS fallbacks).
        """
        discount_int = self._validated_shubh_discount_percent()
        logger.info(
            "%s EXEC: pricing Shubh integer model bid=value-(value*%d)//100 (integer discount only)",
            prefix,
            discount_int,
        )
        for p in planned:
            rid = p.get("row_index")
            price = p.get("bid_price")
            sap_base = p.get("sap_base_price")
            if rid is None or price is None:
                continue
            bid_id = self._shubh_bid_input_id(int(rid))
            spi_disp = self._read_row_spi_display(int(rid))
            logger.info(
                "%s [EXEC] Row %s → SPI=%s → id=%s SAP_price=%s → computed_bid=%s → sending=%s",
                prefix,
                rid,
                spi_disp,
                bid_id,
                sap_base if sap_base is not None else "?",
                price,
                price,
            )

        data_single = self._planned_rows_to_shubh_data_single(planned)
        single_count = len(data_single)
        if single_count <= 0:
            logger.warning("%s EXEC: no bid rows to enter", prefix)
            return {
                "status": "failed",
                "verified_count": 0,
                "failed_count": 0,
                "shubh_enter_idle": False,
                "details": {"verified": [], "failed": [], "mismatch": []},
                "updated_rows": [],
            }

        t0 = time.perf_counter()
        processed_rows: set[int] = set()

        def enter_bid_for_single_item(item: Dict[str, Any]) -> bool:
            if item["rowid"] in processed_rows:
                logger.info("%s Row %s already processed, skipping", prefix, item["rowid"])
                return True
            input_id = self._shubh_bid_input_id(int(item["rowid"]))
            bid_amt = int(item["amount"])
            try:
                bid_input = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.ID, input_id))
                )
                self.driver.execute_script("arguments[0].scrollIntoView(true);", bid_input)
                bid_input.clear()
                bid_input.send_keys(str(bid_amt))
                processed_rows.add(item["rowid"])
                spi_disp = self._read_row_spi_display(int(item["rowid"]))
                logger.info(
                    "%s Entered bid amount: %s for row %s (SPI=%s)",
                    prefix,
                    bid_amt,
                    item["rowid"],
                    spi_disp,
                )
                return True
            except Exception as e:
                logger.error("%s Error entering bid for row %s: %s", prefix, item["rowid"], e)
                return False

        unique_data_single: List[Dict[str, Any]] = []
        seen_rowids: set[int] = set()
        for item in data_single:
            if item["rowid"] not in seen_rowids:
                unique_data_single.append(item)
                seen_rowids.add(item["rowid"])

        for item in unique_data_single:
            enter_bid_for_single_item(item)

        with ThreadPoolExecutor(max_workers=min(10, single_count)) as executor:
            futures = [executor.submit(enter_bid_for_single_item, item) for item in data_single]
            for future in as_completed(futures):
                try:
                    result = future.result()
                    if not result:
                        logger.warning("%s A bid entry task failed", prefix)
                except Exception as exc:
                    logger.error("%s Task generated an exception: %s", prefix, exc)

        applied = len(processed_rows)
        save_ms = 0.0
        ok_s = False
        yes_ms = 0.0
        ok_y = False
        ok_ms = 0.0
        ok_o = False
        max_retries = 3
        for attempt in range(max_retries):
            try:
                t_save0 = time.perf_counter()
                save_button = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.ID, self._SHUBH_SAVE_ID))
                )
                self.driver.execute_script("arguments[0].scrollIntoView(true);", save_button)
                save_button.click()
                save_ms = (time.perf_counter() - t_save0) * 1000.0
                ok_s = True
                logger.info("%s Save button clicked.", prefix)

                time.sleep(0.2)

                confirmation_methods = [
                    lambda: WebDriverWait(self.driver, 8).until(
                        EC.element_to_be_clickable(
                            (By.XPATH, "//bdi[text()='Yes']/ancestor::button")
                        )
                    ).click(),
                    lambda: self.driver.execute_script(
                        "document.getElementById('__mbox-btn-0').click();"
                    ),
                    lambda: self.driver.execute_script(
                        "document.querySelector('#__mbox-btn-0').click();"
                    ),
                ]
                t_yes0 = time.perf_counter()
                for i, method in enumerate(confirmation_methods):
                    try:
                        method()
                        logger.info(
                            "%s First confirmation dialog (Yes) handled successfully with method %s",
                            prefix,
                            i + 1,
                        )
                        ok_y = True
                        break
                    except Exception as e:
                        logger.warning("%s Method %s failed for Yes button: %s", prefix, i + 1, e)
                        if i == len(confirmation_methods) - 1:
                            logger.error("%s All confirmation methods failed for Yes button", prefix)
                yes_ms = (time.perf_counter() - t_yes0) * 1000.0

                time.sleep(0.2)

                ok_dialog_methods = [
                    lambda: WebDriverWait(self.driver, 8).until(
                        EC.element_to_be_clickable(
                            (By.XPATH, "//bdi[text()='OK']/ancestor::button")
                        )
                    ).click(),
                    lambda: self.driver.execute_script(
                        "document.getElementById('__mbox-btn-4').click();"
                    ),
                    lambda: self.driver.execute_script(
                        "document.querySelector('#__mbox-btn-4').click();"
                    ),
                    lambda: WebDriverWait(self.driver, 8).until(
                        EC.element_to_be_clickable((By.ID, "__mbox-btn-4"))
                    ).click(),
                ]
                t_ok0 = time.perf_counter()
                for i, method in enumerate(ok_dialog_methods):
                    try:
                        method()
                        logger.info(
                            "%s Second confirmation dialog (OK) handled successfully with method %s",
                            prefix,
                            i + 1,
                        )
                        ok_o = True
                        break
                    except Exception as e:
                        logger.warning("%s Method %s failed for OK button: %s", prefix, i + 1, e)
                        if i == len(ok_dialog_methods) - 1:
                            logger.error("%s All confirmation methods failed for OK button", prefix)
                ok_ms = (time.perf_counter() - t_ok0) * 1000.0
                logger.info("%s Execution dialog sequence completed.", prefix)
                break
            except StaleElementReferenceException:
                if attempt < max_retries - 1:
                    logger.warning(
                        "%s Stale element on save button attempt %s, retrying...",
                        prefix,
                        attempt + 1,
                    )
                    time.sleep(1)
                else:
                    raise
            except Exception as e:
                logger.error("%s [EXEC][FAIL] Save/confirmation sequence failed on attempt %d: %s", prefix, attempt + 1, e)
                raise

        total_ms = (time.perf_counter() - t0) * 1000.0
        ok_status = applied > 0 and ok_s and ok_y and ok_o
        logger.info(
            "%s EXECUTE_END save_click_ms=%.2f yes_click_ms=%.2f ok_click_ms=%.2f "
            "total_execution_ms=%.2f bids_applied=%d planned_rows=%d click_ok=%s/%s/%s",
            prefix,
            save_ms,
            yes_ms,
            ok_ms,
            total_ms,
            applied,
            len(planned),
            ok_s,
            ok_y,
            ok_o,
        )
        self._log_post_execute_rank_result(prefix)
        return {
            "status": "success" if ok_status else "failed",
            "verified_count": int(applied),
            "failed_count": max(0, int(single_count) - int(applied)),
            "updated_rows": [],
            "shubh_enter_idle": ok_status,
            "details": {
                "verified": sorted(processed_rows),
                "failed": [],
                "mismatch": [],
            },
        }

    def _timer_prep_and_execute(
        self,
        prefix: str,
        depot: Optional[str],
        initial_html: Optional[str] = None,
        initial_plan: Optional[List[Dict[str, Any]]] = None,
    ) -> Tuple[bool, int, bool]:
        """
        ayodhya_parallel wait_for_timer_and_click_search2 + enter_bid_amount_and_save.
        Single infinite loop; WebDriverWait 10s for timer element; sleep 0.1s between iterations.
        initial_html is ignored (Shubh parity).
        Returns (executed, bids_submitted, enter_shubh_idle). Third is True when execution
        succeeded (bids applied + dialogs); caller must not resume monitoring.
        """
        _ = initial_html
        cached_plan = list(initial_plan or [])
        timer_id = self.timer_element_id
        raw_poll = self.config.get("timer_poll_interval_seconds", 0.1)
        try:
            poll_interval = float(raw_poll)
        except (TypeError, ValueError):
            poll_interval = 0.1
        if poll_interval <= 0:
            poll_interval = 0.1
        depot_label = depot or self.depot_name or "UNKNOWN"
        logger.info(
            "[%s][TIMER] poll_start timer_id=%s poll_interval=%.2fs has_plan=%s plan_rows=%d",
            depot_label,
            timer_id,
            poll_interval,
            bool(cached_plan),
            len(cached_plan),
        )

        def _run_fill_after_search(trigger_text: str) -> Tuple[bool, int, bool]:
            if not cached_plan:
                logger.warning("%s [EXEC] no plan; cannot execute", prefix)
                return (False, 0, False)
            logger.info("%s [EXEC] SHUBH_MODE_TRIGGER text=%r", prefix, trigger_text[:120])
            logger.info("%s [EXEC] SEARCH_CLICK_BEFORE_EXEC", prefix)
            self._shubh_click_search_carrier(prefix)
            t_sync_search = time.perf_counter()
            logger.info("%s [SYNC] Search clicked at %.6f", prefix, t_sync_search)
            t_sync_wait_start = time.perf_counter()
            logger.info("%s [SYNC] Bid wait start at %.6f", prefix, t_sync_wait_start)
            self._wait_first_planned_bid_input_clickable(cached_plan, prefix)
            t_sync_ready = time.perf_counter()
            logger.info(
                "%s [SYNC] Bid ready at %.6f (delta = %.1f ms)",
                prefix,
                t_sync_ready,
                (t_sync_ready - t_sync_wait_start) * 1000.0,
            )
            t_sync_enter = time.perf_counter()
            logger.info("%s [SYNC] Entering execution at %.6f", prefix, t_sync_enter)
            logger.info("%s [EXEC] DIRECT_EXECUTION_START planned_rows=%d", prefix, len(cached_plan))
            logger.info("%s [EXEC] FLOW: Fill → Save → Yes → OK", prefix)
            exec_result = self._execute_fast_bidding(cached_plan, prefix)
            n = int(exec_result.get("verified_count", 0))
            enter_idle = bool(exec_result.get("shubh_enter_idle"))
            logger.info(
                "%s [EXEC] finished bids_applied=%d planned=%d verify_status=%s failed=%d shubh_idle=%s",
                prefix,
                n,
                len(cached_plan),
                exec_result.get("status"),
                int(exec_result.get("failed_count", 0)),
                enter_idle,
            )
            return (True, n, enter_idle)

        while True:
            try:
                timer2_element = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, timer_id))
                )
                current_time = (timer2_element.text or "").strip()
                logger.info("%s Current timer: %s", prefix, current_time)
                if self._is_execute_timer_text(current_time):
                    return _run_fill_after_search(current_time)
            except StaleElementReferenceException:
                logger.warning("%s StaleElementReferenceException on timer; retrying...", prefix)
                continue
            except Exception as e:
                logger.info("%s Timer poll error (continuing): %s", prefix, e)
            time.sleep(poll_interval)

    def _live_monitor_search(self, prefix: str) -> Tuple[Optional[str], bool, int]:
        """
        Poll search until a valid bid plan exists, then run Shubh-style timer → Search → bid/save flow.
        After a **successful** execution (bids applied + Save/Yes/OK), does **not** resume monitoring:
        enters the Shubh outer ``sleep(60)`` session-maintained loop (same as ayodhya_parallel).
        Returns (last_table_html, automation_executed, bids_submitted_field_count) only if the
        monitor loop ever returns (typically it does not — blocks until success then idles forever).
        """
        raw_poll = self.config.get("live_monitor_poll_seconds", 4)
        try:
            monitor_poll = float(raw_poll)
        except (TypeError, ValueError):
            monitor_poll = 4.0
        if monitor_poll < 1:
            monitor_poll = 1.0

        attempt = 0
        last_html: Optional[str] = None
        any_executed = False
        total_submitted = 0

        while True:
            attempt += 1
            cycle_start = time.monotonic()
            logger.info("%s [LOOP] Monitoring cycle running...", prefix)
            logger.info("%s Monitoring bids... attempt=%d", prefix, attempt)

            html: Optional[str] = None
            try:
                html = self._run_search_once()
            except Exception as e:
                logger.warning("%s Search refresh failed: %s", prefix, e)

            if html:
                last_html = html
                snapshots = self._parse_table(html, depot=self.depot_name)
                planned = self._compute_bid_plan(snapshots, depot=self.depot_name)
                if planned:
                    logger.info(
                        "%s Valid combination found: rows=%d — entering Shubh timer loop → search → bid/save",
                        prefix,
                        len(planned),
                    )
                    enter_execution_phase()
                    exec_cycle_key = object()
                    self._exec_recording_attempt_key = exec_cycle_key
                    self._recording_begin_for_valid_plan(prefix, planned, exec_cycle_key)
                    executed = False
                    submitted = 0
                    enter_shubh_idle = False
                    try:
                        executed, submitted, enter_shubh_idle = self._timer_prep_and_execute(
                            prefix,
                            self.depot_name,
                            initial_html=html,
                            initial_plan=planned,
                        )
                    finally:
                        self._recording_finish_execution_cycle(prefix, exec_cycle_key)
                    any_executed = any_executed or bool(executed)
                    total_submitted += int(submitted or 0)
                    if enter_shubh_idle:
                        logger.info(
                            "%s [POST_EXEC] Shubh parity: successful bid — no further monitoring; session maintained",
                            prefix,
                        )
                        exit_execution_phase()
                        self._shubh_session_maintained_loop(prefix)
                    else:
                        exit_execution_phase()
                        logger.info(
                            "%s [LOOP] Restarting monitoring after non-success execution: executed=%s submitted=%d total_submitted=%d",
                            prefix,
                            executed,
                            int(submitted or 0),
                            total_submitted,
                        )
                    continue
                logger.info("%s No valid combination found...", prefix)
            else:
                logger.info("%s No valid combination found...", prefix)
            logger.info("%s [LOOP] Restarting monitoring cycle...", prefix)

            elapsed_cycle = time.monotonic() - cycle_start
            sleep_for = monitor_poll - elapsed_cycle
            if sleep_for > 0:
                time.sleep(sleep_for)

    def _open_bidding_app(self) -> None:
        """
        Navigate to the SAME E-Bidding app/view as Shubh Carrier.

        Preferred flow (open_via_tile=True):
        - Click tile (__content8)
        - Wait for new window
        - Switch to new handle
        - Confirm URL contains vendor app (e.g. zvc_vendor_app/index.html#/ebidding)
        Fallback: direct navigation to sap.bidding_url (which should be set to the
        vendor app URL, not the generic Fiori shell URL).
        """
        step_open_bidding_start = time.perf_counter()
        open_via_tile = self.sap_cfg.get("open_via_tile", True)

        if open_via_tile:
            self._open_bidding_app_via_tile_with_retry()
        else:
            self._open_bidding_app_via_url()

        # Strong readiness gate: do NOT proceed based on <body> only.
        self._wait_for_ebidding_view_ready()
        self._ensure_filter_form_visible()
        self._timing_log_new("Step 4 - Open E-Bidding App", step_open_bidding_start)

    def _open_bidding_app_via_tile_with_retry(self) -> None:
        tile_id = self.sap_cfg.get("e_bidding_tile_id", "__content8")
        max_attempts = 2
        last_error: Optional[Exception] = None

        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(
                    "🌍 Opening bidding app via launchpad tile (attempt %d/%d, id=%s)",
                    attempt,
                    max_attempts,
                    tile_id,
                )
                original_handles = set(self.driver.window_handles)
                tile = WebDriverWait(self.driver, 10).until(EC.element_to_be_clickable((By.ID, tile_id)))
                tile.click()
                logger.info("🔘 Clicked E-Bidding tile")
                WebDriverWait(self.driver, 10).until(lambda d: len(d.window_handles) > len(original_handles))
                handles = self.driver.window_handles
                logger.info("📑 Window handles after tile click: %s", handles)
                for handle in handles:
                    if handle not in original_handles:
                        self.driver.switch_to.window(handle)
                        logger.info("📑 Switched to E-Bidding tab handle=%s", handle)
                        break
                self._debug_dom_context(stage="after_tile_switch")
                self._wait_for_ebidding_view_ready()
                return
            except Exception as e:
                last_error = e
                logger.warning("Opening via tile attempt %d failed: %s", attempt, e)

        logger.warning(
            "Opening via tile failed after %d attempts (%s), falling back to direct URL",
            max_attempts,
            last_error,
        )
        self._open_bidding_app_via_url()

    def _open_bidding_app_via_url(self) -> None:
        """
        Directly open the vendor E-Bidding app URL.

        IMPORTANT: sap.bidding_url should be set to the actual vendor app, e.g.:
        .../zvc_vendor_app/index.html#/ebidding
        not the generic FioriLaunchpad shell URL.
        """
        url = self.sap_cfg.get("bidding_url")
        if not url:
            raise RuntimeError("❌ sap.bidding_url missing in application.yaml")
        logger.info("🌍 Opening bidding application via URL: %s", url)
        self.driver.get(url)
        self._debug_dom_context(stage="after_direct_url")
        self._wait_for_ebidding_view_ready()

    def _ensure_filter_form_visible(self) -> None:
        """
        Click the header "Show Search" button (upper-right) to expand the filter section,
        then wait for Ship from plant and Depot fields. Fallback: click __button0 if needed.
        """
        step_show_search_start = time.perf_counter()
        ship_id = self.sap_cfg.get("ship_from_plant_field_id", "__xmlview0--ididUtclVCShipFromPlant-inner")

        # If the filter field is already visible, skip the click to avoid an unnecessary extra transition.
        try:
            if ship_id:
                WebDriverWait(self.driver, 2).until(EC.visibility_of_element_located((By.ID, ship_id)))
                self._timing_log_new("Step 5 - Show Search Panel", step_show_search_start)
                return
        except Exception:
            pass

        # 1) Click the "Show Search" button in the upper-right of the E-Bidding header
        self._click_header_show_search()
        # 2) Wait for the filter section (Ship from plant / Depot) to become visible
        ship_id = self.sap_cfg.get("ship_from_plant_field_id", "__xmlview0--ididUtclVCShipFromPlant-inner")
        try:
            WebDriverWait(self.driver, 10).until(EC.visibility_of_element_located((By.ID, ship_id)))
            logger.info("🔍 Search filter section is visible")
            self._screenshot_stage("after_show_search")
        except Exception as e:
            logger.warning("Filter section not visible after Show Search, trying initial button: %s", e)
            # 3) Fallback: click __button0 (Go) in case this build uses it to expand
            initial_btn_id = self.sap_cfg.get("initial_search_button_id", "__button0-BDI-content")
            try:
                btn = WebDriverWait(self.driver, 8).until(
                    EC.element_to_be_clickable((By.ID, initial_btn_id))
                )
                btn.click()
                logger.info("🔘 Clicked initial/Go button (fallback)")
                WebDriverWait(self.driver, 10).until(EC.visibility_of_element_located((By.ID, ship_id)))
            except Exception as e2:
                logger.warning("Fallback button or filter section failed: %s", e2)
        self._timing_log_new("Step 5 - Show Search Panel", step_show_search_start)

    def _click_header_show_search(self) -> None:
        """
        Same as Shubh Carrier: click the header 'Show Search' (upper-right) to expand
        the filter panel. If the button already says 'Hide Search', the panel is
        expanded — do not click (would collapse it).
        """
        # If panel is already expanded (Hide Search visible), skip
        try:
            hide_btn = self.driver.find_element(By.XPATH, "//*[contains(.,'Hide Search')]")
            if hide_btn and hide_btn.is_displayed():
                logger.info("🔍 Filter panel already expanded (Hide Search visible), skipping click")
                return
        except Exception:
            pass
        # Config ID first
        show_search_id = self.sap_cfg.get("header_show_search_button_id")
        if show_search_id:
            try:
                btn = WebDriverWait(self.driver, 6).until(
                    EC.element_to_be_clickable((By.ID, show_search_id))
                )
                if "Show Search" in (btn.text or ""):
                    self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
                    btn.click()
                    logger.info("🔘 Clicked header 'Show Search' (config id)")
                    return
            except Exception:
                pass
        # Click only elements that contain "Show Search" (not "Hide Search")
        strategies = [
            "//button[contains(.,'Show Search') and not(contains(.,'Hide'))]",
            "//*[@role='button' and contains(.,'Show Search')]",
            "//*[contains(@class,'sapMBtn') and contains(.,'Show Search')]",
            "//*[contains(.,'Show Search') and (self::button or contains(@class,'Btn') or @role='button')]",
        ]
        for xpath in strategies:
            try:
                btn = WebDriverWait(self.driver, 8).until(
                    EC.element_to_be_clickable((By.XPATH, xpath))
                )
                self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
                btn.click()
                logger.info("🔘 Clicked header 'Show Search' (upper-right) — filter panel expanding")
                return
            except Exception:
                continue
        # JS: click only node with "Show Search" (not "Hide Search")
        try:
            clicked = self.driver.execute_script("""
                var nodes = document.querySelectorAll('button, a, [role="button"], .sapMBtn, [class*="Button"]');
                for (var i = 0; i < nodes.length; i++) {
                    var t = (nodes[i].textContent || '').trim();
                    if (t.indexOf('Show Search') >= 0 && t.indexOf('Hide Search') < 0) {
                        nodes[i].click();
                        return true;
                    }
                }
                return false;
            """)
            if clicked:
                logger.info("🔘 Clicked 'Show Search' via JavaScript")
        except Exception as e:
            logger.warning("Could not click Show Search: %s", e)

    def _fill_filters(self) -> None:
        ship_from_plant = self.sap_cfg.get("ship_from_plant")
        if not ship_from_plant:
            raise RuntimeError("❌ sap.ship_from_plant missing in configuration")
        logger.info("🧾 Setting search filters: plant=%s depot=%s", ship_from_plant, self.depot_name)
        ship_id = self.sap_cfg.get("ship_from_plant_field_id", "__xmlview0--ididUtclVCShipFromPlant-inner")
        depot_id = self.sap_cfg.get("depot_field_id", "__xmlview0--idUtclVCDepot-inner")
        # Deterministic fill: wait for visibility of the actual inputs, then fill once.
        # This prevents expensive locator cascades + fixed sleeps from running on the normal path.
        timeout = min(12, self.element_wait)

        step_fill_plant_start = time.perf_counter()
        plant = WebDriverWait(self.driver, timeout).until(
            EC.visibility_of_element_located((By.ID, ship_id))
        )
        self._fill_input_element(plant, ship_from_plant, "Ship from plant")
        self._timing_log_new("Step 6 - Fill Plant Field", step_fill_plant_start)

        step_fill_depot_start = time.perf_counter()
        depot = WebDriverWait(self.driver, timeout).until(
            EC.visibility_of_element_located((By.ID, depot_id))
        )
        self._fill_input_element(depot, self.depot_name, "Depot")
        self._timing_log_new("Step 7 - Fill Depot Field", step_fill_depot_start)

        logger.info("✅ Filters filled: plant=%s depot=%s", ship_from_plant, self.depot_name)
        self._screenshot_stage("filters_filled")

    def _fill_input_element(self, el, value: str, label: str) -> None:
        """Fill an input (or SAP -inner div) with value; scroll into view, clear, send_keys or JS fallback."""
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
            time.sleep(0.5)
            # SAP UI5: the located element may be a wrapper; try to use inner input if present
            try:
                inner_input = el.find_element(By.TAG_NAME, "input")
                el = inner_input
            except Exception:
                pass
            el.click()
            time.sleep(0.3)
            try:
                el.clear()
            except Exception:
                pass
            el.send_keys(value)
            logger.info("✅ Filled %s: %s", label, value)
        except Exception as e:
            try:
                self.driver.execute_script(
                    "var el = arguments[0]; var v = arguments[1]; "
                    "if (el.tagName === 'INPUT') { el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); } "
                    "else { var inp = el.querySelector('input'); if (inp) { inp.value = v; inp.dispatchEvent(new Event('input', {bubbles: true})); } }",
                    el, value
                )
                logger.info("✅ Filled %s (via JS): %s", label, value)
            except Exception as e2:
                logger.warning("Fill %s failed: %s; JS fallback: %s", label, e, e2)

    def _find_plant_input(self, timeout: int, primary_id: str):
        # By ID (SAP UI5 -inner)
        try:
            el = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.ID, primary_id))
            )
            time.sleep(1)
            return el
        except Exception:
            pass
        try:
            return WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, primary_id))
            )
        except Exception:
            pass
        # By id contains (dynamic IDs)
        try:
            return WebDriverWait(self.driver, 8).until(
                EC.presence_of_element_located((By.XPATH, "//input[contains(@id,'Ship') or contains(@id,'Plant')]"))
            )
        except Exception:
            pass
        # By label "Ship From Plant" (E-Bidding filter section)
        try:
            return WebDriverWait(self.driver, 5).until(
                EC.presence_of_element_located((By.XPATH, "(//*[contains(.,'Ship From Plant')]/following::input)[1]"))
            )
        except Exception:
            pass
        return None

    def _find_depot_input(self, timeout: int, primary_id: str):
        try:
            el = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.ID, primary_id))
            )
            time.sleep(1)
            return el
        except Exception:
            pass
        try:
            return WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, primary_id))
            )
        except Exception:
            pass
        try:
            return WebDriverWait(self.driver, 8).until(
                EC.presence_of_element_located((By.XPATH, "//input[contains(@id,'Depot')]"))
            )
        except Exception:
            pass
        # By label "Depot" in filter section (avoid "Destination State" etc. by requiring "Depot :")
        try:
            return WebDriverWait(self.driver, 5).until(
                EC.presence_of_element_located((By.XPATH, "(//*[contains(.,'Depot :')]/following::input)[1]"))
            )
        except Exception:
            pass
        try:
            return WebDriverWait(self.driver, 3).until(
                EC.presence_of_element_located((By.XPATH, "(//*[contains(.,'Depot')]/following::input)[1]"))
            )
        except Exception:
            pass
        return None

    def _run_search_once(self) -> Optional[str]:
        """Click the Search button (magnifying glass) in the filter section — same as Shubh Carrier."""
        search_btn_id = self.sap_cfg.get("search_button_id", "__button3-BDI-content")
        tbl_id = self.sap_cfg.get("results_table_id", "__xmlview0--idUtclVCVendorAssignmentTable-tblBody")
        logger.info("🔎 Clicking Search button to run filtered search (plant + depot)")
        clicked = False
        step_click_search_start = time.perf_counter()
        try:
            search_btn = WebDriverWait(self.driver, self.element_wait).until(
                EC.element_to_be_clickable((By.ID, search_btn_id))
            )
            search_btn.click()
            clicked = True
        except Exception:
            try:
                self.driver.execute_script(
                    "var b = document.getElementById(arguments[0]); if(b) { b.click(); return true; } return false;", search_btn_id
                )
                clicked = True
            except Exception:
                pass
        if not clicked:
            # Fallback: click button with text "Search" (filter section magnifying-glass button)
            try:
                search_btn = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(.,'Search') and not(contains(.,'Show')) and not(contains(.,'Hide'))]"))
                )
                search_btn.click()
                clicked = True
                logger.info("🔎 Search button clicked (by text)")
            except Exception:
                pass
        if clicked:
            self._timing_log_new("Step 8 - Click Search", step_click_search_start)
            logger.info("🔎 Search clicked — waiting for Order List table")
        step_table_load_start = time.perf_counter()
        time.sleep(1)
        WebDriverWait(self.driver, self.element_wait).until(
            EC.presence_of_element_located((By.ID, tbl_id))
        )
        self._timing_log_new("Step 9 - Results Table Load", step_table_load_start)
        tbody = self.driver.find_element(By.ID, tbl_id)
        html = tbody.get_attribute("outerHTML")
        soup = BeautifulSoup(html, "html.parser")
        rows = soup.find_all("tr")
        if not rows:
            return None
        first_cells = [c.get_text(strip=True) for c in rows[0].find_all("td")]
        if any("No data" in c for c in first_cells):
            return None
        return html

    def _run_search_with_retry(self) -> Optional[str]:
        logger.info("🔎 Searching available bids")
        for attempt in range(3):
            try:
                html = self._run_search_once()
                if html:
                    return html
            except Exception as e:
                logger.warning("Search attempt %d failed: %s", attempt + 1, e)
            if attempt < 2:
                time.sleep(self.search_retry_interval)
        return None

    def _parse_table(self, tbody_html: str, depot: Optional[str] = None) -> List[RowSnapshot]:
        soup = BeautifulSoup(tbody_html, "html.parser")
        rows = soup.find_all("tr")
        idx = self.table_cfg
        club_idx = int(idx.get("club_id", 2))
        dest_idx = int(idx.get("destination", 5))
        qty_idx = int(idx.get("quantity", 11))
        base_idx = int(idx.get("base_price", 13))
        spi_idx = int(idx.get("spi", 12))
        company_idx = int(idx.get("company", 20))
        snapshots: List[RowSnapshot] = []
        depot_label = depot or self.depot_name or "UNKNOWN"
        qty_parse_anomaly = 0

        for row_idx, row in enumerate(rows):
            cells = row.find_all("td")
            txt = [c.get_text(strip=True) for c in cells]
            # Ayodhya parallel process_bids first pass: skip only short rows
            if len(txt) <= 12:
                continue
            # Shubh only appends all_rows when base price column parses (len > 13 and digit)
            base_cell = txt[base_idx] if len(txt) > base_idx else ""
            if not (len(txt) > base_idx and base_cell.replace(".", "", 1).isdigit()):
                continue
            try:
                club_identifier = (
                    txt[club_idx].replace("Object Identifier", "").strip()
                    if len(txt) > club_idx
                    else ""
                )
                current_clubid = int(club_identifier) if club_identifier else 0
            except (ValueError, IndexError):
                current_clubid = 0
            try:
                qty_cell = txt[qty_idx] if len(txt) > qty_idx else ""
                quantity = (
                    float(qty_cell)
                    if len(txt) > qty_idx and qty_cell.replace(".", "", 1).isdigit()
                    else 0.0
                )
            except (ValueError, IndexError):
                quantity = 0.0
            destination = txt[dest_idx] if len(txt) > dest_idx else ""
            spi = txt[spi_idx] if len(txt) > spi_idx else ""
            company = txt[company_idx] if len(txt) > company_idx else ""
            logger.info(
                "[%s][PARSE][SPI] row=%d spi=%s",
                depot_label,
                row_idx,
                spi,
            )
            qty_raw = txt[qty_idx] if len(txt) > qty_idx else ""
            if len(txt) > qty_idx and qty_raw.strip() and quantity == 0.0 and any(
                ch.isdigit() for ch in qty_raw
            ):
                qty_parse_anomaly += 1
                logger.warning(
                    "[%s][PARSE][WARNING] Quantity raw=%r parsed=0.0 (row_index=%d)",
                    depot_label,
                    qty_raw,
                    row_idx,
                )
            value_to_calculate = int(float(str(base_cell).replace(",", "")))
            snapshots.append(
                RowSnapshot(
                    row_index=row_idx,
                    club_id=current_clubid,
                    destination=destination,
                    quantity=quantity,
                    base_price=float(value_to_calculate),
                    company=company,
                    spi=spi,
                )
            )
        logger.info(
            "[%s][PARSE] html_rows=%d parsed_rows=%d qty_parse_anomaly=%d",
            depot_label,
            len(rows),
            len(snapshots),
            qty_parse_anomaly,
        )
        empty_spi_count = sum(1 for s in snapshots if not s.spi)
        logger.info(
            "[%s][SPI][SUMMARY] parse_complete parsed_rows=%d rows_with_empty_spi=%d",
            depot_label,
            len(snapshots),
            empty_spi_count,
        )
        if len(rows) > 0 and len(snapshots) == 0:
            logger.error("[%s][PARSE][FAIL] Parsed rows=0 but HTML rows present=%d", depot_label, len(rows))
        return snapshots

    def _compute_bid_plan(
        self,
        snapshots: List[RowSnapshot],
        depot: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Shubh Carrier ``process_bids`` planning (Ayodhya parallel), with partial plans:
        - Per desired leg: tonnage-wise excluded SPI (exact ``==``) after ``desired_quantity`` is known.
        - Per desired leg: destination filter like Shubh (``==`` when destination set).
        - STEP 1: club_id > 0 groups, first club in dict iteration order whose summed qty
          satisfies ``abs(total - desired) < 0.01`` → select entire group; mark ``used_rows``,
          ``used_club_ids``.
        - STEP 2: else single-row among club_id == 0 with ``abs(qty - desired) < 0.01``;
          take first in table order (no price sort).
        - If a leg fails, continue; return [] only when no leg matched.
        """
        discount_int = self._validated_shubh_discount_percent()
        planned: List[Dict[str, Any]] = []
        used_rows: set[int] = set()
        used_club_ids: set[int] = set()
        depot_label = depot or self.depot_name or "UNKNOWN"
        required_tonnage_list = [float(d.quantity) for d in self.desired_bids if float(d.quantity) > 0]
        logger.info(
            "Planner using tonnage=%s",
            required_tonnage_list,
        )
        if not required_tonnage_list:
            logger.error("[%s][PLAN][FAIL] No valid desired quantity after validation", depot_label)
            return []

        by_tonnage_spi = self.config.get("excluded_spi_by_tonnage") or {}
        logger.info(
            "[%s][SPI][RULE] tonnage_spi_map_keys=%s",
            depot_label,
            sorted(by_tonnage_spi.keys()),
        )

        candidates: List[RowSnapshot] = list(snapshots)

        for desired in self.desired_bids:
            desired_quantity = float(desired.quantity)
            desired_destination = desired.destination

            if desired_quantity <= 0:
                continue

            excluded_spi = self._excluded_spi_for_tonnage(desired_quantity)
            tonnage_key = self._tonnage_config_key(desired_quantity)
            logger.info(
                "[%s][SPI][RULE] qty=%.2f tonnage_key=%s excluded_spi=%r",
                depot_label,
                desired_quantity,
                tonnage_key,
                excluded_spi,
            )

            # Shubh: ``filtered_rows = all_rows`` then ``if desired_destination:`` filter by ``==``.
            filtered_rows: List[RowSnapshot] = list(candidates)
            if desired_destination:
                filtered_rows = [
                    r for r in filtered_rows if r.destination == desired_destination
                ]
            rows_before_spi_filter = filtered_rows
            if excluded_spi is not None:
                for r in rows_before_spi_filter:
                    spi_decision = "exclude" if r.spi == excluded_spi else "allow"
                    logger.info(
                        "[%s][SPI][CHECK] qty=%.2f row=%d spi=%r excluded_spi=%r decision=%s",
                        depot_label,
                        desired_quantity,
                        r.row_index,
                        r.spi,
                        excluded_spi,
                        spi_decision,
                    )
                filtered_rows = [r for r in rows_before_spi_filter if r.spi != excluded_spi]
            removed_by_spi = len(rows_before_spi_filter) - len(filtered_rows)
            logger.info(
                "[%s][SPI][SUMMARY] qty=%.2f excluded_spi=%r rows_before_spi=%d rows_after_spi=%d removed_by_spi=%d",
                depot_label,
                desired_quantity,
                excluded_spi,
                len(rows_before_spi_filter),
                len(filtered_rows),
                removed_by_spi,
            )

            # Shubh: drop used rowids and rows whose club_id was already consumed as a club bundle.
            filtered_rows = [
                r
                for r in filtered_rows
                if r.row_index not in used_rows and r.club_id not in used_club_ids
            ]

            unconsumed_rows = [r for r in candidates if r.row_index not in used_rows]
            blocked_destination = [
                r
                for r in unconsumed_rows
                if (desired_destination and r.destination != desired_destination)
            ]
            blocked_spi = [
                r
                for r in unconsumed_rows
                if excluded_spi is not None and r.spi == excluded_spi
            ]
            blocked_club_used = [r for r in unconsumed_rows if r.club_id in used_club_ids]
            logger.info(
                "[%s][PLAN] qty=%.2f dest=%r excluded_spi=%r filtered=%d unconsumed=%d blocked(dest=%d spi=%d club_used=%d)",
                depot_label,
                desired_quantity,
                desired_destination,
                excluded_spi,
                len(filtered_rows),
                len(unconsumed_rows),
                len(blocked_destination),
                len(blocked_spi),
                len(blocked_club_used),
            )
            if unconsumed_rows and not filtered_rows:
                logger.error(
                    "[%s][FILTER][FAIL] All rows filtered out before planning for qty=%.2f",
                    depot_label,
                    desired_quantity,
                )
                if desired_destination and len(blocked_destination) == len(unconsumed_rows):
                    logger.warning(
                        "[%s][FILTER][WARNING] Destination mismatch filtered all rows for dest=%r",
                        depot_label,
                        desired_destination,
                    )

            rows_by_clubid: Dict[int, List[RowSnapshot]] = {}
            rows_without_clubid: List[RowSnapshot] = []
            for row in filtered_rows:
                if row.club_id > 0:
                    if row.club_id not in rows_by_clubid:
                        rows_by_clubid[row.club_id] = []
                    rows_by_clubid[row.club_id].append(row)
                else:
                    rows_without_clubid.append(row)

            match_found = False

            # CASE 1 (Shubh process_bids): club groups first, dict iteration order.
            for clubid, group in rows_by_clubid.items():
                total_quantity = sum(row.quantity for row in group)
                club_qty_match = abs(total_quantity - desired_quantity) < 0.01
                logger.info(
                    "[%s][SPI][CLUB] qty=%.2f club_id=%d row_count=%d total_qty=%.2f row_spis=%s qty_match=%s",
                    depot_label,
                    desired_quantity,
                    clubid,
                    len(group),
                    total_quantity,
                    [r.spi for r in group],
                    club_qty_match,
                )
                if club_qty_match:
                    logger.info(
                        "[%s][PLAN][CLUB_MATCH] qty=%.2f club_id=%d rows=%d",
                        depot_label,
                        desired_quantity,
                        clubid,
                        len(group),
                    )
                    for row in group:
                        value = int(row.base_price)
                        computed_bid = self._shubh_integer_discount_bid(value, discount_int)
                        deduction = value - computed_bid
                        planned.append(
                            {
                                "row_index": row.row_index,
                                "bid_price": computed_bid,
                                "sap_base_price": value,
                                "bid_discount_percent": discount_int,
                                "destination": str(row.destination or ""),
                            }
                        )
                        logger.info(
                            "[PLAN] row=%d SAP_base_price=%d discount_int=%d deduction=%d computed_bid=%d "
                            "(club_group club_id=%s)",
                            row.row_index,
                            value,
                            discount_int,
                            deduction,
                            computed_bid,
                            clubid,
                        )
                        used_rows.add(row.row_index)
                    used_club_ids.add(clubid)
                    match_found = True
                    break

            # CASE 2 (Shubh process_bids): club_id == 0 only, first row in table order.
            if not match_found:
                exact_matches = [
                    r
                    for r in rows_without_clubid
                    if abs(r.quantity - desired_quantity) < 0.01 and r.club_id == 0
                ]
                if exact_matches:
                    row = exact_matches[0]
                    logger.info(
                        "[%s][PLAN][SINGLE_MATCH] qty=%.2f row_index=%d",
                        depot_label,
                        desired_quantity,
                        row.row_index,
                    )
                    value = int(row.base_price)
                    computed_bid = self._shubh_integer_discount_bid(value, discount_int)
                    deduction = value - computed_bid
                    planned.append(
                        {
                            "row_index": row.row_index,
                            "bid_price": computed_bid,
                            "sap_base_price": value,
                            "bid_discount_percent": discount_int,
                            "destination": str(row.destination or ""),
                        }
                    )
                    logger.info(
                        "[PLAN] row=%d SAP_base_price=%d discount_int=%d deduction=%d computed_bid=%d "
                        "(_shubh_integer_discount_bid)",
                        row.row_index,
                        value,
                        discount_int,
                        deduction,
                        computed_bid,
                    )
                    used_rows.add(row.row_index)
                    match_found = True

            if not match_found:
                logger.info(
                    "[%s][PLAN][SKIP] qty=%.2f no match",
                    depot_label,
                    desired_quantity,
                )
                continue

        if not planned:
            logger.info(
                "[%s][PLAN] No legs satisfied; returning empty plan",
                depot_label,
            )
            return []
        logger.info(
            "[%s][PLAN] Multi-bid plan created: count=%d total=%.2f (partial plans allowed)",
            depot_label,
            len(planned),
            sum(float(s.quantity) for s in snapshots if s.row_index in used_rows),
        )
        return planned

    def _click_search_and_wait_table(self) -> None:
        """Click search button and wait for table (e.g. after timer to refresh)."""
        try:
            search_btn_id = self.sap_cfg.get("search_button_id", "__button3-BDI-content")
            tbl_id = "__xmlview0--idUtclVCVendorAssignmentTable-tblBody"
            btn = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, search_btn_id))
            )
            btn.click()
            logger.info("🔎 Clicked search after timer to refresh table")
            WebDriverWait(self.driver, self.element_wait).until(
                EC.presence_of_element_located((By.ID, tbl_id))
            )
            time.sleep(1)
        except Exception as e:
            logger.warning("Search-after-timer click failed: %s", e)
