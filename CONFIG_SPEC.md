# Configuration Specification — Externalized Values

All values that must be externalized from Shubh Carriers and BackEnd 2 into config files.

---

## 1. application.yaml

Global application settings.

| Key | Type | Default | Source | Description |
|-----|------|---------|--------|-------------|
| `base_url` | string | (see below) | ayodhya.py:669 | Fiori launchpad URL |
| `ship_from_plant` | string | `"TANDA CEMENT WORKS"` | ayodhya.py:680 | Ship-from plant field |
| `bid_discount_percent` | int | `2` | ayodhya.py:458 | Bid = base_price - (base_price * this / 100) |
| `search_retry_interval_seconds` | int | `10` | ayodhya.py:693 | Poll interval when no qualifying bids |
| `timer_trigger` | string | `"Starts in 0:0:4"` | ayodhya.py:189 | Timer text to trigger search click |
| `timer_poll_interval_seconds` | float | `0.1` | ayodhya.py:209 | Timer loop sleep |
| `page_load_timeout_seconds` | int | `30` | BackEnd 2:114 | Page load timeout |
| `element_wait_timeout_seconds` | int | `10` | Various | WebDriverWait default |
| `post_login_wait_seconds` | int | `6` | ayodhya.py:679 | Sleep after login |
| `parallel.max_workers` | int | `4` | BackEnd 2:25 | Max concurrent depot tasks |
| `parallel.shutdown_timeout_seconds` | int | `90` | BackEnd 2:51 | Wait for tasks before force shutdown |
| `browser.headless` | bool | `false` | - | Run Chrome headless |
| `browser.binary_path` | string | (Brave path) | ayodhya.py:663 | Brave/Chrome binary |
| `browser.window_size` | string | `"1920,1080"` | BackEnd 2:141 | Window size for headless |

**base_url:** `https://www.eye2serve.com:9001/sap/bc/ui5_ui5/ui2/ushell/shells/abap/FioriLaunchpad.html`

---

## 2. depots.yaml

Depot definitions and per-depot settings.

| Key | Type | Description |
|-----|------|-------------|
| `depots` | map | Depot name → depot config |
| `depots.<name>.destinations` | list[string] | Available destinations for this depot |
| `depots.<name>.enabled` | bool | (optional) Include in multi-depot run |

**Depot names:** AYODHYA, GONDA, SITAPUR, LUCKNOW, HARDOI, GORAKHPUR, MAU, DEORIA, BASTI

**Example structure:**
```yaml
depots:
  AYODHYA:
    destinations:
      - AYODHYA
      - SALARPUR (FZB)
      - DYORHI BAZAR
      # ... full list
  GONDA:
    destinations:
      - KAISAR GANJ
      - DHANEPUR
      # ...
  SITAPUR:
    destinations:
      - SITAPUR
      - LAKHIMPUR
      # ...
  LUCKNOW:
    destinations: []   # Quantity-only (no destination filtering)
  # ... HARDOI, GORAKHPUR, MAU, DEORIA, BASTI
```

---

## 3. application.yaml (Business Rules Section)

| Key | Type | Default | Source | Description |
|-----|------|---------|--------|-------------|
| `excluded_companies` | list[string] | (see below) | ayodhya.py:388-391 | Skip rows from these companies |
| `quantity_tolerance` | float | `0.01` | ayodhya.py:416 | Match if abs(total - desired) < this |
| `table.cell_indices.club_id` | int | `2` | ayodhya.py:345 | Column index |
| `table.cell_indices.destination` | int | `5` | ayodhya.py:335 | Column index |
| `table.cell_indices.quantity` | int | `11` | ayodhya.py:354 | Column index |
| `table.cell_indices.base_price` | int | `13` | ayodhya.py:359 | Column index |
| `table.cell_indices.company` | int | `20` | ayodhya.py:339 | Column index |

**excluded_companies:**
- BHIM LAL JAISWAL
- RAJU BUILDING MATERIAL
- MAHALASA CONSTRUCTIONS PVT LTD
- ABHILASHA ENTERPRISES
- PAHALWAN TRADERS
- TARIKH BULD. MATERIAL
- PRANJAL ENTERPRISES
- OM SAI TRADERS

---

## 4. credentials.env / Environment

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `E2S_USERNAME` | string | Yes | Portal username |
| `E2S_PASSWORD` | string | Yes | Portal password |

**Note:** `.env` and `credentials.env` must be git-ignored. Provide `credentials.env.example` with placeholder values.

---

## 5. Element IDs (SAP UI5)

These may change with portal updates. Consider externalizing if needed.

| Purpose | Element ID |
|---------|------------|
| Username | `USERNAME_FIELD-inner` |
| Password | `PASSWORD_FIELD-inner` |
| E-Bidding tile | `__content6` |
| Initial search button | `__button0-BDI-content` |
| Ship from plant input | `__xmlview0--ididUtclVCShipFromPlant-inner` |
| Depot input | `__xmlview0--idUtclVCDepot-inner` |
| Search button (results) | `__button3-BDI-content` |
| Timer | `__xmlview0--timer-inner` |
| Table body | `__xmlview0--idUtclVCVendorAssignmentTable-tblBody` |
| Bid amount input | `__xmlview0--idBidAmount-__xmlview0--idUtclVCVendorAssignmentTable-{rowid}-inner` |
| Save button | `__xmlview0--idUtclsaveTxt-inner` |
| Yes dialog button | `__mbox-btn-0` |
| OK dialog button | `__mbox-btn-4` |

**Recommendation:** Add optional `selectors` section in `application.yaml` to override IDs if portal changes.

---

## 6. Input Sources for Quantity-Destination Pairs

| Source | Use Case |
|--------|----------|
| CLI arguments | `--quantities 100,200 --destinations 1,3` |
| Config file | `depots.AYODHYA.default_quantities` (optional) |
| Interactive prompt | `collect_quantity_destination_pairs()` (current behavior) |
| File | `{depot}_quantities.txt` (commented in ayodhya.py) |

---

## 7. Config Load Order

1. Load `application.yaml` (required)
2. Load `depots.yaml` (required)
3. Load `.env` or `credentials.env` (optional; override with env vars)
4. Override with environment variables (e.g. `E2S_USERNAME`)
5. Override with CLI arguments (e.g. `--headless`)
