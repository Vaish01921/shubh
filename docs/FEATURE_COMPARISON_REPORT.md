# SHBH Carrier vs backend_code — Feature Comparison Report

## SECTION A — Architecture Overview

### SHBH Carrier (Old Automation System)

- **Structure:** Single-file or per-depot scripts (e.g. `ayodhya1(parallel).py`, `sitapur_bidding.py`). Each script is 800–900+ lines.
- **Entry:** Direct Python execution; user input via `input()` for quantities and destinations.
- **Driver:** Selenium + Chrome/ChromeDriver or Brave; `webdriver_manager` for driver binary.
- **Flow:** Login → click E-Bidding tile → new tab → click initial "Go" button (`__button0-BDI-content`) → fill Ship from plant + Depot → loop: search (click `__button3`) → parse table → process_bids (match logic) → wait for timer → click search again at 3s → enter bids → save → Yes/OK dialogs → repeat search every 8s until qualifying bids found.
- **Config:** Hardcoded URLs, credentials, excluded companies, depot/destinations; logging to file.
- **Strengths:** Rich bidding logic (club ID groups, destination filter, multiple dialog fallbacks, timer-triggered search).  
- **Weaknesses:** Monolithic, no API, duplicated code across depot files, no config file, interactive-only.

### backend_code (New Automation System)

- **Structure:** FastAPI app (`backend_server.py`) → `selenium_service` → `driver_factory` + `login_service` + `DepotBiddingEngine`. Config in `application.yaml` and `.env`/`credentials.env`.
- **Entry:** HTTP API `POST /api/start-bid` with `truck_id`, `depot`, `desired_bids`; optional `sync=true`.
- **Driver:** `undetected_chromedriver`, config-driven headless/binary/proxy.
- **Flow:** Create driver → login (with 406 retry, iframe fallback) → open bidding via tile or URL → ensure filter form (click initial button) → fill filters → search with retry → parse table → compute bid plan → wait for timer → batch submit (single JS) → handle save dialogs → return structured result.
- **Config:** YAML for SAP URLs, element IDs, timeouts, excluded companies, table indices; env for credentials and browser.
- **Strengths:** Modular, API-driven, config-driven, single batch JS for bids, better error handling and logging.  
- **Gaps:** No explicit "Show Search" expand step, no club ID group matching, simpler save-dialog handling, no optional search-after-timer refresh.

---

## SECTION B — Feature Comparison Table

| Feature | Present in SHBH Carrier | Present in backend_code | Status |
|--------|--------------------------|--------------------------|--------|
| SAP login (username/password) | Yes | Yes | OK |
| 406 retry / block detection | No | Yes | Backend better |
| Login fields in iframe | Implicit (main page) | Yes (fallback) | Backend better |
| Open E-Bidding via launchpad tile | Yes (`__content8`) | Yes (tile or URL) | OK |
| New tab switch after tile click | Yes | Yes | OK |
| **Initial button / "Show Search" expand** | Yes (`__button0-BDI-content`) | Partial (same ID as "initial search") | **Gap: explicit Show Search step** |
| Fill Ship from plant | Yes | Yes (+ fallback selectors) | OK |
| Fill Depot | Yes | Yes (+ fallback selectors) | OK |
| Click search button (`__button3`) | Yes | Yes | OK |
| Wait for results table | Yes | Yes | OK |
| Parse table (BeautifulSoup, cell indices) | Yes | Yes | OK |
| Excluded companies filter | Yes | Yes | OK |
| Destination filter for desired bid | Yes | Yes | OK |
| Quantity tolerance matching | Yes | Yes | OK |
| **Club ID group matching** (group total = desired qty) | Yes | No | **Missing** |
| 2% bid discount | Yes | Yes (configurable) | OK |
| Timer read (`__xmlview0--timer-inner`) | Yes | Yes | OK |
| Wait for "Starts in 0:0:3" or "Expires in" | Yes | Yes (configurable trigger) | OK |
| **Click search again after timer** (refresh table) | Yes | No | **Missing** |
| Enter bid amounts (by row) | Yes (per input + scrollIntoView) | Yes (batch JS) | Backend more efficient |
| Save button click | Yes | Yes (in batch JS) | OK |
| **Yes/OK confirmation dialogs** (multiple fallbacks) | Yes (6+ methods per dialog) | Yes (single generic click) | **Weaker in backend** |
| Retry on StaleElementReferenceException | Yes | Partial (filter/search retries) | OK |
| Screenshot on failure | No | Yes | Backend better |
| Continuous search until qualifying bids | Yes (every 8s) | No (fixed 3 attempts) | Optional improvement |
| API / headless / config-driven | No | Yes | Backend only |
| Structured result (status, rows_found, bids_submitted) | No | Yes | Backend only |

---

## SECTION C — Missing Features to Implement

1. **Show Search section expand**  
   - **What:** Before filling filters, ensure the search/filter section is expanded. In SAP Fiori this can be a "Show Search" control; clicking it reveals Ship from plant / Depot.  
   - **Current backend:** Clicks `__button0-BDI-content` (initial search/Go). Adding an explicit step that tries to find and click a "Show Search" element (by text or config ID), then waits for filter fields; if not found, continue. Makes behavior robust for both collapsed and expanded UI.

2. **Club ID group matching**  
   - **What:** Rows can share a `club_id` (cell index 2). Match a desired quantity to the **sum** of quantities of all rows in a club group; if matched, plan bids for all rows in that group. Single-row match only when `club_id == 0` or no group matches.  
   - **Why:** SHBH Carrier does this; backend currently matches only single rows. Implementing it makes bid strategy feature-complete and consistent with the old system.

3. **Robust save dialog handling (Yes then OK)**  
   - **What:** After Save, SAP shows first a "Yes" dialog (`__mbox-btn-0` or text "Yes"), then an "OK" dialog (`__mbox-btn-4` or text "OK"). Use multiple strategies (ID, XPath by text, JS) so at least one succeeds.  
   - **Why:** Backend uses one generic click; old system uses several fallbacks. Stronger handling avoids stuck dialogs.

4. **Optional: Click search after timer**  
   - **What:** When timer reaches "Starts in 0:0:3" or "Expires in", old code clicks the search button again to refresh the table, then enters bids. Backend can do the same optionally (config flag) so table is up-to-date before batch submit.

5. **Optional: Continuous search until rows found**  
   - **What:** Old code searches every 8s until qualifying bids exist. Backend can support a configurable "search until rows or timeout" for parity (optional, not required for minimal parity).

---

## Implementation Plan

1. **Show Search**  
   - In `DepotBiddingEngine`, add `_expand_show_search_if_needed()`: try click by config ID `show_search_button_id` or by XPath/text "Show Search"; then wait for plant or depot field; if not found, no-op. Call it before or as part of `_ensure_filter_form_visible()`.

2. **Club ID group matching**  
   - In `_compute_bid_plan()`: group `RowSnapshot` by `club_id`; for each desired bid, first try to find a club group whose total quantity matches (within tolerance); if found, add all rows in that group to the plan; else fall back to current single-row match. Track `used_rows` and `used_club_ids` to avoid reusing.

3. **Robust save dialogs**  
   - In `_handle_save_dialogs()`: try multiple strategies for "Yes" (e.g. `__mbox-btn-0`, XPath `//bdi[text()='Yes']/ancestor::button`, JS click), then short sleep, then multiple strategies for "OK" (e.g. `__mbox-btn-4`, XPath for "OK", JS). Log which method succeeded.

4. **Click search after timer**  
   - Add config `click_search_after_timer: true`. In `_wait_for_timer()`, after timer is ready, if config set, click `search_button_id` and wait for table again before returning.

5. **Logging and helpers**  
   - Add clear log lines for Show Search expand, club match, and dialog steps. Keep helper logic inside `depot_bidding_engine` (e.g. `_safe_click_by_id`, `_wait_for_clickable`) to avoid breaking the existing module layout.

---

## Final Improved Architecture (After Implementation)

- **config/application.yaml**  
  - New optional keys: `show_search_button_id`, `click_search_after_timer`, and any dialog button IDs if needed.

- **src/depot_bidding_engine.py**  
  - `_expand_show_search_if_needed()`  
  - `_ensure_filter_form_visible()` unchanged or calls expand first.  
  - `_compute_bid_plan()` extended with club ID group matching.  
  - `_wait_for_timer()` optionally clicks search and waits for table.  
  - `_handle_save_dialogs()` with Yes/OK multi-strategy.

- **No new top-level services**  
  - All new behavior stays inside `DepotBiddingEngine` and config so the existing FastAPI → selenium_service → engine flow is unchanged.

---

## Implementation Status (Done)

- **Show Search:** `_expand_show_search_if_needed()` added; tries config ID, then text "Show Search", then checks if filter section already visible. Called from `_ensure_filter_form_visible()`.
- **Club ID group matching:** `_compute_bid_plan()` now groups by `club_id`, matches desired quantity to group total first, then single-row match; uses `used_rows` and `used_club_ids`.
- **Robust save dialogs:** `_handle_save_dialogs()` uses `_click_dialog_button()` with multiple strategies (ID, XPath by text, JS) for Yes then OK.
- **Click search after timer:** Config `click_search_after_timer`; when true, `_wait_for_timer()` calls `_click_search_and_wait_table()` after timer is ready.
- **Config:** `application.yaml` has `show_search_button_id`, `click_search_after_timer`.
