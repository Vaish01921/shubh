# Migration Roadmap — Step-by-Step Plan

Merges Shubh Carriers and BackEnd 2 into the unified "New Backend Automation" system.

---

## Phase 0: Preparation

### Step 0.1 — Create project scaffold
- Create folder structure per `ARCHITECTURE.md`
- Add `requirements.txt` (selenium, webdriver-manager, beautifulsoup4, pyyaml, python-dotenv)
- Add `.gitignore` (`.env`, `credentials.env`, `logs/`, `__pycache__/`, `*.pyc`)
- Add empty `src/__init__.py`
- Add placeholder `config/` files (`.example` or skeleton)

### Step 0.2 — Consolidate depot data
- Collect all `destinations_by_depot` from Shubh Carriers scripts
- For LUCKNOW, HARDOI, GORAKHPUR, MAU, DEORIA, BASTI: verify if they use destinations or quantity-only
- Create canonical `depots.yaml` with all 9 depots

---

## Phase 1: Config and Logging

### Step 1.1 — Config Loader
- Implement `config_loader.py`
- Load `application.yaml` (create from `CONFIG_SPEC.md`)
- Load `depots.yaml`
- Load credentials from env / `.env`
- Add validation for required keys
- Expose: `get_app_config()`, `get_depot_config(name)`, `get_depot_names()`, `get_credentials()`

### Step 1.2 — Logging Service
- Implement `logging_service.py`
- Support file + console handlers
- Support per-depot log files
- `get_logger(depot_name=None)` returns configured logger
- Wire log level and format from config

### Step 1.3 — Config files
- Create `config/application.yaml` with all values from `CONFIG_SPEC.md`
- Create `config/depots.yaml` with depot destinations
- Create `config/credentials.env.example` (placeholders)
- Copy to `credentials.env` locally (git-ignored)

---

## Phase 2: Driver Factory

### Step 2.1 — Driver Factory module
- Implement `driver_factory.py`
- Extract Chrome/Brave setup from `ayodhya.py` (lines 662–668)
- Add headless mode (BackEnd 2 style)
- Read `browser.binary_path`, `browser.headless`, `browser.window_size` from config
- Return configured WebDriver instance

### Step 2.2 — Smoke test
- Add minimal test: create driver, open `about:blank`, quit
- Verify both headed and headless work

---

## Phase 3: Depot Bidding Engine (Incremental)

### Step 3.1 — Session initialization
- Extract login + E-Bidding + tab switch from `ayodhya.py` (lines 669–623)
- Move to `depot_bidding_engine.py` as `_init_session(driver, config, logger)`
- Use config for URL, credentials, element IDs

### Step 3.2 — Search flow
- Extract search form fill + search click from `ayodhya.py` (lines 681–691)
- Implement `_perform_search(driver, depot_name, config)` 
- Use `ship_from_plant` and `depot_name` from config

### Step 3.3 — Table parsing and bid processing
- Extract `process_bids()` logic from `ayodhya.py` (lines 403–567)
- Move to engine as `_process_bids(rows, quantity_destination_pairs, config)`
- Externalize excluded companies, cell indices, bid formula
- Return list of `{rowid, amount, destination}` to enter

### Step 3.4 — Timer logic
- Extract `get_timer_info()` and `wait_for_timer_and_click_search2()` from `ayodhya.py`
- Implement `_wait_for_timer_and_refresh(driver, config, logger)`
- Use `timer_trigger` from config

### Step 3.5 — Bid entry and save
- Extract `enter_bid_for_single_item()` and `enter_bid_amount_and_save()` from `ayodhya.py`
- Implement `_enter_bids_and_save(driver, bids, logger)`
- Keep retry strategies (WebDriverWait, JS click, ActionChains)
- Keep parallel bid entry with `ThreadPoolExecutor`

### Step 3.6 — Main engine orchestration
- Implement `run_depot(depot_name, quantity_destination_pairs, config)` in engine
- Wire: init session → search → poll until bids found → process → timer → enter → save
- Return success/failure and counts

### Step 3.7 — Single-depot verification
- Run engine for one depot (e.g. AYODHYA) with test quantities
- Compare behavior with original `ayodhya.py`

---

## Phase 4: Parallel Execution Manager

### Step 4.1 — Parallel Execution Manager module
- Implement `parallel_execution_manager.py`
- Use `ThreadPoolExecutor` (or `ProcessPoolExecutor` if isolation needed)
- Read `parallel.max_workers` and `parallel.shutdown_timeout_seconds` from config
- Submit one `run_depot(...)` task per depot
- Collect results; log per-depot success/failure

### Step 4.2 — Graceful shutdown
- Implement timeout-based shutdown (BackEnd 2 style)
- On timeout: attempt graceful stop, then force if needed

### Step 4.3 — Multi-depot verification
- Run 2–3 depots in parallel
- Verify no cross-contamination; each depot uses own driver instance

---

## Phase 5: CLI and Entry Points

### Step 5.1 — CLI interface
- Implement `cli.py` with argparse
- Options: `--depot`, `--depots`, `--quantities`, `--destinations`, `--config`, `--headless`
- Support interactive quantity-destination input when not provided via args

### Step 5.2 — main.py
- Implement `main.py` for programmatic use
- Export: `run_depot()`, `run_depots_parallel()`

### Step 5.3 — Config-based depot list
- Support loading depot list from config (BackEnd 2 style)
- e.g. `depots_to_run: [AYODHYA, GONDA]` in `application.yaml`

---

## Phase 6: Migrate Remaining Depots

### Step 6.1 — Validate depot configs
- Ensure `depots.yaml` has correct destinations for all 9 depots
- Test each depot individually

### Step 6.2 — Handle depot-specific quirks
- Identify any depot-specific logic (e.g. gonda vs ayodhya timer handling)
- Add depot-level config overrides if needed

### Step 6.3 — Deprecate old scripts
- Document that `shubh carriers/Main/*.py` and `main.py` are deprecated
- Keep as reference until new system is fully validated

---

## Phase 7: Polish and Documentation

### Step 7.1 — Error handling
- Add retry logic for transient failures
- Improve error messages with depot context
- Log stack traces to file only (not console)

### Step 7.2 — README
- Document setup, config, and usage
- Document migration from old system

### Step 7.3 — Optional: element ID overrides
- Add `selectors` section to config for UI element IDs
- Allows adaptation to portal changes without code changes

---

## Dependency Order Summary

```
Phase 0 (scaffold)
    → Phase 1 (config, logging)
        → Phase 2 (driver factory)
            → Phase 3 (depot engine, incremental)
                → Phase 4 (parallel manager)
                    → Phase 5 (CLI)
                        → Phase 6 (depot migration)
                            → Phase 7 (polish)
```

---

## Estimated Effort

| Phase | Effort | Notes |
|-------|--------|-------|
| 0 | 0.5 day | Scaffold |
| 1 | 1 day | Config + logging |
| 2 | 0.5 day | Driver factory |
| 3 | 2–3 days | Engine (largest piece) |
| 4 | 1 day | Parallel manager |
| 5 | 0.5 day | CLI |
| 6 | 1 day | Depot validation |
| 7 | 0.5 day | Polish |
| **Total** | **~7–8 days** | |

---

## Rollback Plan

- Keep Shubh Carriers and BackEnd 2 untouched until new system is validated
- Run both systems in parallel for a pilot period
- Switch traffic only after successful side-by-side comparison
