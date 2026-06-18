"""
ROLLBACK BACKUP (tile-based navigation)

This file preserves the previous tile-based E-Bidding open logic exactly as it
existed before switching _open_bidding_app() to direct URL navigation.

If direct URL navigation breaks functionality, restore these methods back into
DepotBiddingEngine in src/depot_bidding_engine.py.
"""

# NOTE: This is a backup only. Do not import/execute directly.

# Imports referenced by the backup methods (kept here so restoring is copy/paste).
import time
from typing import Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# When restoring into depot_bidding_engine.py, these symbols already exist there:
# - logger

# ---- BEGIN BACKUP ----

def _open_bidding_app(self) -> None:
    """
    Navigate to the SAME E-Bidding app/view as Shubh Carrier.

    Preferred flow (open_via_tile=True):
    - Click tile (__content8)
    - Wait for new window
    - Switch to new handle
    - Confirm URL contains vendor app (e.g. zvc_vendor_app/index.html#/ebidding)
    Fallback: direct navigation to sap.bidding_url (which should be set to the
    vendor app URL, not the generic FioriLaunchpad shell URL).
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
            logger.info("🌍 Opening bidding app via launchpad tile (attempt %d/%d, id=%s)", attempt, max_attempts, tile_id)
            original_handles = set(self.driver.window_handles)
            tile = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, tile_id))
            )
            tile.click()
            logger.info("🔘 Clicked E-Bidding tile")
            # Wait for a new window/tab
            WebDriverWait(self.driver, 10).until(
                lambda d: len(d.window_handles) > len(original_handles)
            )
            handles = self.driver.window_handles
            logger.info("📑 Window handles after tile click: %s", handles)
            for handle in handles:
                if handle not in original_handles:
                    self.driver.switch_to.window(handle)
                    logger.info("📑 Switched to E-Bidding tab handle=%s", handle)
                    break
            # Log URL, title, iframes for debug
            self._debug_dom_context(stage="after_tile_switch")
            # Do not proceed until this tab is actually ready.
            self._wait_for_ebidding_view_ready()
            return
        except Exception as e:
            last_error = e
            logger.warning("Opening via tile attempt %d failed: %s", attempt, e)
            # Rely on retry attempt rather than unconditional sleep.

    logger.warning("Opening via tile failed after %d attempts (%s), falling back to direct URL", max_attempts, last_error)
    self._open_bidding_app_via_url()

# ---- END BACKUP ----
