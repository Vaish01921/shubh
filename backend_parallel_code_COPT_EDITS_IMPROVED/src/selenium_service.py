import os
import time
from typing import Any

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from .driver_factory import create_driver
from .login_service import login
from .logging_service import get_logger
from .config_loader import get_app_config
from .depot_bidding_engine import DepotBiddingEngine, DesiredBid
from .depot_normalization import normalize_depot_name
from .parallel_orchestrator import (
    get_multiprocess_settings,
    run_multiprocess_job_sync,
    start_multiprocess_job_async,
)


logger = get_logger("selenium_service")


def _env_debug() -> None:
    logger.info("ENV USER=%s", os.getenv("USER"))
    logger.info("ENV HOME=%s", os.getenv("HOME"))
    logger.info("ENV PWD=%s", os.getcwd())


def _execution_mode() -> str:
    cfg = get_app_config()
    auto = cfg.get("automation") or {}
    if not isinstance(auto, dict):
        return "legacy"
    return str(auto.get("execution_mode", "legacy")).strip().lower()


def _mp_results_list_to_api_map(results: list) -> dict[str, Any]:
    """API historically used depot -> result dict; pool returns a list."""
    m: dict[str, Any] = {}
    for r in results:
        if not isinstance(r, dict):
            continue
        k = str(r.get("depot") or "").strip()
        if k:
            m[k] = r
    return m


def _legacy_desired_bid_objects(
    desired_bids: list[dict],
    depot: str | None,
    depots: list[str] | None,
    request_id: str,
) -> list[DesiredBid]:
    """Map API dicts to ``DesiredBid`` with ``depot`` for per-depot planner isolation."""
    depots_norm = [normalize_depot_name(d) for d in (depots or []) if str(d).strip()]
    out: list[DesiredBid] = []
    for b in desired_bids or []:
        q = float(b.get("quantity", 0))
        if q <= 0:
            continue
        raw_dep = b.get("depot")
        if raw_dep is not None and str(raw_dep).strip():
            dd = normalize_depot_name(str(raw_dep))
        elif len(depots_norm) == 1:
            dd = depots_norm[0]
        else:
            dd = normalize_depot_name(depot) if depot else normalize_depot_name(request_id)
        out.append(
            DesiredBid(
                quantity=q,
                destination=b.get("destination"),
                depot=dd,
            )
        )
    return out


def trigger_bid_legacy(
    truck_id: str | None = None,
    depot: str | None = None,
    depots: list[str] | None = None,
    desired_bids: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Legacy: single WebDriver, cooperative multi-tab depots (process_parallel_tabs).
    """
    request_id = str(truck_id or depot or (depots[0] if depots else "AUTO"))
    depot_name = normalize_depot_name(depot) if depot else normalize_depot_name(request_id)
    desired_bids = desired_bids or []
    desired = _legacy_desired_bid_objects(desired_bids, depot, depots, request_id)

    logger.info(
        "🚀 [legacy] API Trigger request_id=%s depot=%s depots=%s desired_bids=%s",
        request_id,
        depot_name,
        depots,
        desired_bids,
    )

    driver = None
    engine = None
    start_wall = time.perf_counter()

    try:
        _env_debug()
        config = get_app_config()
        sap_config = config.get("sap", {})
        base_url = sap_config.get("base_url")
        if not base_url:
            raise RuntimeError("❌ base_url not defined in application.yaml")

        logger.info("🌍 SAP Base URL: %s", base_url)
        logger.info("🧠 Creating Chrome driver...")
        driver = create_driver()
        driver.set_page_load_timeout(90)
        driver.implicitly_wait(0)

        logger.info("🌐 Opening SAP login page")
        driver.get(base_url)
        if os.getenv("EBIDDING_LOGIN_SCREENSHOTS", "").strip().lower() in ("1", "true", "yes", "on"):
            os.makedirs("screenshots", exist_ok=True)
            pre_login_path = f"screenshots/pre_login_{request_id}.png"
            driver.save_screenshot(pre_login_path)
            logger.info("📸 Screenshot saved: %s", pre_login_path)

        logger.info("🔐 Starting SAP login flow")
        login(driver)
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        title = driver.title
        current_url = driver.current_url
        logger.info("📄 Page title after login: %s", title)
        logger.info("🌐 Current URL after login: %s", current_url)

        dashboard_screenshot = f"screenshots/sap_dashboard_{request_id}.png"
        if os.getenv("EBIDDING_LOGIN_SCREENSHOTS", "").strip().lower() in ("1", "true", "yes", "on"):
            driver.save_screenshot(dashboard_screenshot)
            logger.info("📸 Screenshot saved: %s", dashboard_screenshot)
        logger.info("✅ SAP opened successfully for request %s", request_id)

        engine = DepotBiddingEngine(driver=driver, depot_name=depot_name, desired_bids=desired)

        cfg = get_app_config()
        yaml_depots = (cfg.get("sap", {}) or {}).get("depots") or []
        if depots and len(depots) > 0:
            depot_list = [d for d in (normalize_depot_name(d) for d in depots) if d]
        elif yaml_depots and len(yaml_depots) > 0:
            depot_list = [d for d in (normalize_depot_name(d) for d in yaml_depots) if d]
        else:
            depot_list = [depot_name] if depot_name else []

        logger.info("🤖 [legacy] Parallel tabs run: depots=%s", depot_list)
        bidding_result = engine.process_parallel_tabs(depot_list)
        driver = engine.driver

        elapsed = time.perf_counter() - start_wall
        status = bidding_result.get("status", "unknown")
        rows_found = bidding_result.get("rows_found", 0)
        bids_submitted = bidding_result.get("bids_submitted", 0)
        logger.info("✅ Bidding engine finished: status=%s rows_found=%s bids_submitted=%s", status, rows_found, bids_submitted)

        return {
            "status": status,
            "truck_id": request_id,
            "depot": depot_name,
            "depots_processed": bidding_result.get("depots_processed", []),
            "results": bidding_result.get("results", []),
            "rows_found": rows_found,
            "bids_submitted": bids_submitted,
            "execution_time": f"{elapsed:.1f} seconds",
            "message": "SAP login completed; parallel tab prep complete; ready for manual bid locking (no automated submit)",
            "url": current_url,
            "screenshot": dashboard_screenshot,
            "bidding_result": bidding_result,
            "execution_mode": "legacy",
        }
    except Exception as e:
        logger.exception("❌ Selenium automation failed")
        elapsed = time.perf_counter() - start_wall
        if engine is not None:
            driver = engine.driver
        failure_screenshot = None
        if driver:
            try:
                os.makedirs("screenshots", exist_ok=True)
                failure_screenshot = f"screenshots/failure_{request_id}.png"
                driver.save_screenshot(failure_screenshot)
                logger.info("📸 Failure screenshot saved: %s", failure_screenshot)
            except Exception:
                pass
        return {
            "status": "failed",
            "truck_id": request_id,
            "depot": depot_name or request_id,
            "rows_found": 0,
            "bids_submitted": 0,
            "execution_time": f"{elapsed:.1f} seconds",
            "message": "Selenium failed",
            "error": str(e),
            "screenshot": failure_screenshot,
            "execution_mode": "legacy",
        }
    finally:
        quit_driver = engine.driver if engine is not None else driver
        if quit_driver:
            try:
                quit_driver.quit()
                logger.info("🧹 Driver closed cleanly")
            except Exception:
                logger.warning("⚠️ Driver close failed")


def trigger_bid(
    truck_id: str | None = None,
    depot: str | None = None,
    depots: list[str] | None = None,
    desired_bids: list[dict] | None = None,
    *,
    sync: bool = False,
) -> dict[str, Any]:
    """
    Dispatch: legacy single-driver tabs vs true multiprocess (ProcessPoolExecutor + run_depot_worker).

    ThreadPoolExecutor / DepotThread path has been removed.
    """
    desired_bids = desired_bids or []
    request_id = str(truck_id or depot or (depots[0] if depots else "AUTO"))
    mode = _execution_mode()
    logger.info(
        "Automation dispatch execution_mode=%s sync=%s (multiprocess=OS processes+run_depot_worker, not threads)",
        mode,
        sync,
    )

    if mode == "multiprocess":
        mp_cfg = get_multiprocess_settings()
        logger.info(
            "Multiprocess config: effective_max_workers=%s requested=%s absolute_cap=%s "
            "login_stagger_seconds=%s",
            mp_cfg["max_parallel_workers"],
            mp_cfg["max_parallel_workers_requested"],
            mp_cfg["max_parallel_workers_absolute_cap"],
            mp_cfg.get("login_stagger_seconds"),
        )
        payload = [
            {
                "quantity": b.get("quantity", 0),
                "destination": b.get("destination"),
                "depot": b.get("depot"),
            }
            for b in desired_bids
        ]
        if sync:
            out = run_multiprocess_job_sync(request_id, depot, depots, payload)
            raw_results = out.get("results")
            if isinstance(raw_results, list):
                out["results"] = _mp_results_list_to_api_map(raw_results)
            out.setdefault("screenshot", {})
            return out
        return start_multiprocess_job_async(request_id, depot, depots, payload)

    if sync:
        logger.info("sync=true ignored in legacy mode (always synchronous)")
    return trigger_bid_legacy(request_id, depot, depots, desired_bids)
