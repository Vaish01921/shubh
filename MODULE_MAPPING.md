# Shubh Carrier Script → Module Mapping

Maps code sections from Shubh Carriers depot scripts (e.g. `ayodhya.py`, `gonda.py`) to the unified modules.

---

## Reference Script Structure

Using `ayodhya.py` / `gonda.py` as the canonical depot script. Each depot script follows the same pattern; only depot name, destinations, and `ship_box2.send_keys()` differ.

---

## Mapping Table

| Shubh Carrier Location | Lines (approx) | Target Module | Notes |
|------------------------|----------------|---------------|-------|
| **Imports** (selenium, bs4, etc.) | 1–18 | Various | Selenium imports → `driver_factory`, `depot_bidding_engine`; BeautifulSoup → engine |
| `logging.basicConfig(...)` | 19–26 | **Logging Service** | Centralized in `logging_service.get_logger()` |
| `depot_name = "AYODHYA"` | 30 | **Config Loader** | From `depots.yaml` or CLI |
| `destinations_by_depot = {...}` | 53–63 | **Config Loader** | From `depots.yaml` |
| `collect_quantity_destination_pairs()` | 72–102 | **CLI / main.py** | Input collection; can stay at entry point or move to config |
| `quantity_destination_pairs`, `desired_quantities` | 47–49, 106 | **Depot Bidding Engine** | Passed as parameter |
| `data_set`, `dataSingle`, `data_set_clubid_list` | 124–131 | **Depot Bidding Engine** | Internal state of `process_bids` |
| `add_data()`, `data_set_clubid()` | 134–157 | **Depot Bidding Engine** | Helpers inside bid processing |
| `get_timer_info()` | 163–173 | **Depot Bidding Engine** | Timer polling logic |
| `wait_for_timer_and_click_search2()` | 176–212 | **Depot Bidding Engine** | Timer + search click logic |
| `print_updated_row()` | 214–262 | **Depot Bidding Engine** | Post-save verification |
| `enter_bid_for_single_item()` | 264–307 | **Depot Bidding Engine** | Single bid input (with retries) |
| `enter_bid_amount_and_save()` | 313–395 | **Depot Bidding Engine** | Parallel bid entry + save + dialogs |
| `process_bids()` | 403–567 | **Depot Bidding Engine** | Core business logic: parse, match, exclude |
| `perform_search_and_process()` | 570–653 | **Depot Bidding Engine** | Search → parse → process → timer → enter flow |
| `options = Options()`, `driver = webdriver.Chrome(...)` | 662–668 | **Driver Factory** | Driver creation |
| `driver.get(...)`, login, E-Bidding click | 669–629 | **Depot Bidding Engine** | Session initialization |
| Search form fill (`ship_box`, `ship_box2`) | 681–691 | **Depot Bidding Engine** | Uses config for depot + ship_from_plant |
| Main loop (search until found, session keep-alive) | 694–688 | **Depot Bidding Engine** | Orchestration within engine |
| `ThreadPoolExecutor` for bid entry | 317–327, 343–354 | **Depot Bidding Engine** | Internal parallelism within engine |

---

## main.py (Shubh Carriers Orchestrator)

| Shubh Carrier main.py | Target Module | Notes |
|-----------------------|---------------|-------|
| `depot_options`, `depot_scripts` | **Config Loader** | Depot list from `depots.yaml` |
| `run_depot_script(depot_name)` | **Parallel Execution Manager** | Subprocess → Thread/Process pool |
| `subprocess.Popen`, batch file creation | **Parallel Execution Manager** | Replaced by `ThreadPoolExecutor` / `ProcessPoolExecutor` |
| `stop_depot_script()`, `stop_all_scripts()` | **Parallel Execution Manager** | Graceful shutdown with timeout |
| `display_menu()`, `main()` loop | **CLI** | Menu-driven CLI in `cli.py` |
| Log file per depot | **Logging Service** | `get_logger(depot_name)` with file handler |

---

## BackEnd 2 Concepts → Modules

| BackEnd 2 | Target Module | Notes |
|-----------|---------------|-------|
| `loadUrlsFromConfig()` | **Config Loader** | Load depot list (or URLs) from config |
| `ExecutorService`, `newFixedThreadPool(MAX_THREADS)` | **Parallel Execution Manager** | `ThreadPoolExecutor(max_workers=config.max_threads)` |
| `executor.submit(new UrlTask(url))` | **Parallel Execution Manager** | `executor.submit(depot_task, depot_config)` |
| `executor.awaitTermination(90, TimeUnit.SECONDS)` | **Parallel Execution Manager** | `executor.shutdown(wait=True)` + timeout |
| `config.properties` | **Config Loader** | `application.yaml`, `depots.yaml` |
| Headless Chrome options | **Driver Factory** | Config-driven `headless: true/false` |

---

## Detailed Code Block Mapping

### → Config Loader
- `depot_name`
- `destinations_by_depot`
- `ship_from_plant` ("TANDA CEMENT WORKS")
- `excluded_companies`
- `bid_discount_percent` (2)
- `search_retry_interval_seconds` (10)
- `timer_trigger` ("Starts in 0:0:4")
- `page_load_timeout`
- Credentials (username, password)

### → Driver Factory
- `ChromeOptions()` setup
- `options.binary_location` (Brave path)
- `options.add_arguments(...)` (headless, no-sandbox, etc.)
- `Service(ChromeDriverManager().install())`
- `webdriver.Chrome(service=..., options=...)`
- `driver.manage().timeouts().pageLoadTimeout(...)`

### → Depot Bidding Engine (Session)
- `driver.get(base_url)`
- Find `USERNAME_FIELD-inner`, `PASSWORD_FIELD-inner`
- `send_keys(username)`, `send_keys(password)`, `send_keys(Keys.RETURN)`
- `time.sleep(6)` (post-login wait)
- Click `__content6` (E-Bidding)
- `WebDriverWait(driver, 10).until(EC.new_window_is_opened)`
- Switch to new tab
- Click `__button0-BDI-content` (initial search)

### → Depot Bidding Engine (Search)
- Find `__xmlview0--ididUtclVCShipFromPlant-inner`, send `ship_from_plant`
- Find `__xmlview0--idUtclVCDepot-inner`, send `depot_name`
- Click `__button3-BDI-content` (search)

### → Depot Bidding Engine (Parse & Match)
- Find `__xmlview0--idUtclVCVendorAssignmentTable-tblBody`
- BeautifulSoup parse, `rows = soup.find_all('tr')`
- Cell indices: club_id=2, destination=5, quantity=11, base_price=13, company=20
- Excluded companies filter
- Bid formula: `base_price - (base_price * 2 // 100)`
- Match priority: club ID group → single row → combination

### → Depot Bidding Engine (Timer)
- Find `__xmlview0--timer-inner`
- Loop: if `Starts in 0:0:4` → click search, break; if `Expires in` → break

### → Depot Bidding Engine (Bid Entry)
- Input ID: `__xmlview0--idBidAmount-__xmlview0--idUtclVCVendorAssignmentTable-{rowid}-inner`
- Save button: `__xmlview0--idUtclsaveTxt-inner`
- Confirmation: Yes (`__mbox-btn-0` or XPath), OK (`__mbox-btn-4` or XPath)
- Retry strategies (WebDriverWait, JS click, ActionChains)

### → Parallel Execution Manager
- `concurrent.futures.ThreadPoolExecutor` or `ProcessPoolExecutor`
- `max_workers` from config (default 4)
- Submit one task per depot
- `executor.shutdown(wait=True)` with timeout
- Collect results, log per-depot success/failure

### → Logging Service
- `logging.basicConfig` replacement
- File handler: `logs/{depot}_bidding_{timestamp}.log`
- Console handler (optional)
- Format: `%(asctime)s - %(levelname)s - [%(depot)s] %(message)s`
