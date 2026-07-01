# SAP Bidding Automation — Failure Analysis & Implementation Roadmap

This document explains **why** the automation fails in each environment (local vs server), **what** can be done about it, and a **roadmap** for making it reliable in production.

---

## 1. LOCAL (Windows) — Filter fields not found

### What happens

- Login succeeds; SAP dashboard loads.
- Bidding app URL opens; after ~3s the engine tries to fill **Ship from plant** and **Depot**.
- **TimeoutException**: the element `__xmlview0--ididUtclVCShipFromPlant-inner` is never found within the wait window (25s, then 50s on retry).

### Possible reasons

| Cause | Explanation |
|-------|-------------|
| **UI5 flow** | In SAP Fiori, the bidding app often shows an initial **Go** / **Search** button first. The filter form (plant, depot) appears only **after** that button is clicked. The code was looking for the filter fields immediately, so they were not yet in the DOM. |
| **Different view** | Opening the deep link may land on a shell or empty view; one extra click (e.g. `__button0-BDI-content`) is required to load the search screen with the filter inputs. |
| **Depot "Test1"** | "Test1" is not a real depot; the UI might show an error or a different layout, but the primary issue is that the **filter form** was not present yet. |
| **Dynamic IDs** | SAP UI5 can generate IDs that vary by session or version; the configured IDs might not match every time. |

### Solutions (implemented / recommended)

1. **Click initial search/Go button first**  
   After opening the bidding app, click the button that loads the filter form (e.g. `__button0-BDI-content`), then wait 2–3s before looking for plant/depot.  
   **Implemented**: `_ensure_filter_form_visible()` in `depot_bidding_engine.py`; config key `sap.initial_search_button_id`.

2. **Fallback selectors**  
   If the primary ID is not found, try inputs by placeholder or by partial ID (e.g. "Ship", "Plant", "Depot").  
   **Implemented**: `_find_plant_input()` and `_find_depot_input()` with XPath fallbacks.

3. **More retries and wait**  
   Increase number of attempts and wait after opening the app and after clicking the initial button.  
   **Implemented**: 3 attempts for `_fill_filters`, longer sleep after initial button.

4. **Use a real depot**  
   For end-to-end tests, use a real depot name from your SAP system (e.g. `AYODHYA`) in the request body so the app does not show validation/error states that change the layout.

---

## 2. SERVER (Ubuntu VPS) — 406 Not Acceptable

### What happens

- Chrome (headless) starts; the driver opens the SAP login URL.
- The **response body** is not the SAP login page but a **block page**: `406 - Not Acceptable`, "Request was blocked due to suspicious behavior." (from **AppTran** / `qa-apptrana.com`).
- So the automation never sees the login form; after 3 retries the login service correctly raises "SAP returned 406 block".

### Possible reasons

| Cause | Explanation |
|-------|-------------|
| **WAF / security product** | A Web Application Firewall (e.g. AppTran) in front of SAP is blocking the request. The block page is served instead of the real app. |
| **Datacenter IP** | Traffic from cloud/VPS IP ranges is often treated as suspicious; the WAF may block or restrict it by policy. |
| **Headless / automation signals** | Headless Chrome and automation (e.g. `navigator.webdriver`, missing plugins, different headers) can be detected and blocked. |
| **User-Agent or fingerprint** | Even with a custom User-Agent, other fingerprint signals can still identify automation. |

### Solutions (infrastructure + app)

| Solution | Description |
|----------|-------------|
| **Whitelist VPS IP** | Ask SAP/network/security team to **whitelist the VPS public IP** (e.g. DigitalOcean droplet IP) so the WAF allows requests from that IP. This is the most direct fix if policy allows. |
| **Residential proxy** | Route browser traffic through a **residential proxy** (or VPN) so requests come from a non-datacenter IP. Configure `browser.proxy` in `application.yaml` or via env and set Chrome to use that proxy. |
| **Run from allowed network** | Run the automation from a machine on a network that is already allowed (e.g. office VPN or a server already whitelisted). |
| **Headless and fingerprint** | Keep using undetected_chromedriver, realistic User-Agent, and minimal automation flags; this helps but often is not enough alone if the WAF blocks by IP. |

**Code cannot fix 406** by itself: the server responds with a block page before the app logic runs. Fix is **environment/network**: whitelist IP or use an allowed proxy.

---

## 3. Implementation roadmap

### Phase 1 — Local reliability (done / in progress)

- [x] Config load order so `.env` overrides `credentials.env` (Chrome path, headless).
- [x] Chrome binary fallback when configured path does not exist (e.g. Windows vs Linux).
- [x] After opening bidding app: click **initial search button** if configured; then wait for filter form.
- [x] **Fallback selectors** for Ship from plant and Depot (by ID, then by placeholder/partial ID).
- [x] More retries and waits for filter fill.
- [ ] **Optional**: Capture a screenshot or HTML snippet when filter fill fails, and (if needed) add more selector variants from that snapshot.

### Phase 2 — Server (406) and production

- [ ] **Whitelist or proxy**: Get VPS IP whitelisted by SAP/security, or introduce a residential proxy and set `browser.proxy` in config.
- [ ] **Optional**: Proxy support in `driver_factory` (read proxy from config/env and pass to Chrome options).
- [ ] **Optional**: On 406, log request headers and response snippet to help operations debug with the WAF team.

### Phase 3 — Hardening and observability

- [ ] **DRY_RUN**: Config flag to run the full flow but skip actual bid submit (no Save click) for safe testing.
- [ ] **Health check**: Optional endpoint or script that only checks login (and optionally one navigation step) without bidding.
- [ ] **Structured logs**: Ensure all steps (login, open app, click initial button, fill filters, search, parse, timer, submit) are logged with a correlation id (e.g. `truck_id`) for tracing.

---

## 4. Quick reference

| Environment | Symptom | Primary cause | Fix |
|-------------|---------|----------------|-----|
| **Local (Windows)** | TimeoutException on filter fields | Filter form not yet visible; need to click initial button and/or use fallback selectors | Implemented: initial button click + fallback selectors + more retries. Use real depot (e.g. AYODHYA) for full flow. |
| **Server (VPS)** | 406 Not Acceptable, block page | WAF (e.g. AppTran) blocking datacenter/headless traffic | Whitelist VPS IP or use residential proxy; ensure server `.env` has correct `CHROME_BINARY` and `HEADLESS` for Linux. |

---

## 5. Server `.env` (VPS)

On the server, ensure `.env` contains at least:

```bash
# So .env overrides credentials.env (load order: credentials first, then .env)
CHROME_BINARY=/usr/bin/google-chrome
HEADLESS=true
```

If you introduce a proxy later (to avoid 406 on the server):

```bash
# Optional: proxy URL for Chrome (e.g. residential proxy)
BROWSER_PROXY=http://user:pass@proxy.example.com:8080
```

The app reads `BROWSER_PROXY` from `.env` and passes it to Chrome; no need to edit `application.yaml`.
