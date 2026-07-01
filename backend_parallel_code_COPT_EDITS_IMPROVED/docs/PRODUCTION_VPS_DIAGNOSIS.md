# Production VPS Automation Failure — Technical Diagnosis

This document analyses why SAP Fiori automation **succeeds locally** (Windows, headed) and **fails on the VPS** (Ubuntu, headless), and provides code and infrastructure fixes so automation runs reliably on the server.

---

## 1️⃣ LOG DIFFERENCE ANALYSIS

### Where execution diverges (step-by-step)

| Step | Local (Windows) | Server (Ubuntu VPS) |
|------|------------------|----------------------|
| **1. Config** | `Chrome binary: C:\...\chrome.exe`, `Headless: False` | `Chrome binary: /usr/bin/google-chrome`, `Headless: True` |
| **2. Driver** | Chrome starts (takes ~2 min), no version log | Chrome starts quickly; `Detected Chrome version: 145 (major: 145)` |
| **3. Open SAP** | `driver.get(base_url)` → page loads | `driver.get(base_url)` → page loads |
| **4. After load** | Debug files saved; **no 406** in `page_source` | Debug files saved; **406 / Not Acceptable** present in `page_source` |
| **5. Login** | Login fields found → credentials sent → dashboard | **Immediate failure**: `login_service` raises "SAP returned 406 block" |
| **6. Bidding** | (Local) Reaches bidding app, then **TimeoutException** in `_fill_filters()` waiting for `__xmlview0--ididUtclVCShipFromPlant-inner` | Never reached (login fails first) |

### Summary of divergence

- **Browser configuration**: Local uses headed Chrome on Windows; server uses headless Chrome on Linux with a different binary path. Both are correct for their environment.
- **Headless vs non-headless**: On the server, Chrome runs with `headless=True`. Many WAFs and SAP front-ends treat headless user-agents or automation signals differently and may return **HTTP 406 Not Acceptable** or a block page.
- **Network / IP**: Requests from the VPS originate from a **datacenter IP** (DigitalOcean). SAP or an upstream WAF may block or restrict datacenter IP ranges, resulting in a 406 or a minimal “block” HTML page.
- **SAP login flow**: Locally the same URL returns the real login form (with `USERNAME_FIELD-inner` etc.). On the server the same URL returns a body that contains “406” or “Not Acceptable” and does **not** contain the login field IDs, so the 406 check correctly treats it as a block.
- **Selenium driver init**: Both environments create the driver successfully. No divergence at driver creation.
- **Page loading**: Both load a body; the **content** of that body differs (real SAP UI vs block page).
- **Element detection**: Locally, login elements are found; on the server we never get to element detection because the 406 check fails first.

---

## 2️⃣ ROOT CAUSE ANALYSIS

Ranked by probability:

1. **SAP / WAF blocking datacenter or headless traffic (406)**  
   - **Evidence**: Server logs show “SAP returned 406 block” immediately after “SAP page loaded”. The page content contains “406” or “Not Acceptable” and lacks the login form.  
   - **Reasoning**: The server uses a different IP (VPS) and headless Chrome. WAFs often block or downgrade headless/datacenter requests with 406 or a block page.

2. **Headless Chrome detection**  
   - **Evidence**: Same code and URL; only environment differs (headless on server, headed locally).  
   - **Reasoning**: Headless Chrome can be detected via `navigator.webdriver`, missing plugins, or other fingerprint differences. SAP or a front proxy may serve a block page when automation is detected.

3. **User-Agent / browser fingerprint**  
   - **Evidence**: Default Chrome/Chromedriver user-agent in headless may differ from a normal desktop.  
   - **Reasoning**: Some gateways treat non-desktop or automation-like user-agents as invalid and return 406.

4. **Linux Chrome / sandbox / rendering**  
   - **Evidence**: Chrome starts and loads a body on the server.  
   - **Reasoning**: Less likely to cause 406; more likely to cause layout/JS issues. Still worth hardening (see Section 5).

5. **undetected_chromedriver version mismatch**  
   - **Evidence**: Server log shows version detection (145).  
   - **Reasoning**: Mismatch can cause instability; we now pass `version_main` to reduce risk.

6. **SAP UI5 dynamic rendering / iframe**  
   - **Evidence**: Locally, login works; bidding fails later on filter field timeout.  
   - **Reasoning**: Affects local bidding step, not server login. UI5 delays can be mitigated with waits and retries (already added in code).

---

## 3️⃣ SERVER EXECUTION STRATEGY

To run automation successfully on the VPS:

1. **Anti-detection Chrome configuration**  
   - Use a **realistic, stable user-agent** (e.g. Linux Chrome 120).  
   - Keep `--disable-blink-features=AutomationControlled`.  
   - Ensure `navigator.webdriver` is hidden after load (script injection).  
   - Pass Chrome **version_main** to `undetected_chromedriver` to avoid version mismatch.

2. **undetected_chromedriver usage**  
   - Prefer `uc.Chrome(..., version_main=detected_major)` so the patched driver matches installed Chrome.  
   - Reuse one driver per run; avoid unnecessary restarts.

3. **Retry login on 406**  
   - If the first load returns a 406-like page, **retry** `driver.get(base_url)` a few times with a short delay.  
   - Only treat as failure if login form is still absent after retries.

4. **Environment-based config**  
   - On the server, set `HEADLESS=true` and `CHROME_BINARY=/usr/bin/google-chrome` (or the real path) via `.env`.  
   - Do not rely on Windows paths or `headless: false` in YAML on the server.

5. **Bidding engine robustness**  
   - After opening the bidding app, add a short **fixed delay** for UI5 to render.  
   - Use **retries with increased timeout** when locating filter fields (Ship from plant, Depot).

6. **If 406 persists**  
   - **Infrastructure**: Whitelist the VPS IP at SAP/firewall, or route browser traffic through a **residential proxy** or VPN that is allowed.  
   - **Application**: Keep retries and realistic UA; avoid running from obviously “bot” IPs if the gateway is strict.

---

## 4️⃣ CODE CHANGES REQUIRED

The following changes have been applied in the repository.

### 4.1 Config loader — env overrides for VPS

**File: `src/config_loader.py`**

- In `get_app_config()`, after loading YAML, override `browser` from environment:
  - `HEADLESS` → `browser["headless"]`
  - `CHROME_BINARY` → `browser["binary_path"]`
- This lets the server use `.env` only (e.g. `HEADLESS=true`, `CHROME_BINARY=/usr/bin/google-chrome`) without editing `application.yaml`.

### 4.2 Chrome driver — Linux- and headless-friendly

**File: `src/driver_factory.py`**

- **Realistic user-agent**: Set `--user-agent=` to a fixed Linux Chrome 120 string so headless requests look like a normal Linux browser.
- **Extra Chrome flags** for headless/Linux:  
  `--disable-software-rasterizer`, `--disable-extensions`, `--disable-background-networking`, `--disable-default-apps`, `--disable-sync`, `--metrics-recording-only`, `--no-first-run`, `--disable-infobars`, `--lang=en-US,en`.
- **Chrome version**: Detect major version from `chrome_binary --version` and pass `version_main` into `uc.Chrome(...)` to avoid driver/browser mismatch.
- **Anti-detection**: Keep `execute_script` to set `navigator.webdriver` to `undefined` after driver creation.

### 4.3 Login service — 406 retry and smarter detection

**File: `src/login_service.py`**

- **Retry loop**: Up to 3 attempts to load the SAP page. If the page is considered a “406 block”, wait 8 seconds and reload; only raise after all retries fail.
- **406 detection**: Treat as block only when the body contains “406” or “Not Acceptable” **and** does **not** contain login hints (`USERNAME_FIELD`, `PASSWORD_FIELD`, or “password”). This avoids false positives if 406 appears in a comment or secondary content.
- **Logging**: On 406, log a short snippet of `page_source` to simplify debugging.

### 4.4 Depot bidding engine — UI5 waits and retries

**File: `src/depot_bidding_engine.py`**

- **After opening bidding app**: Add `time.sleep(3)` after the body is present so SAP UI5 can render the filter section.
- **_fill_filters**: Two attempts to find and fill Ship from plant and Depot. First attempt uses `element_wait_seconds`; second attempt uses double that timeout and a 2 s pause before retry. This reduces TimeoutException on slow or busy UI5.

### 4.5 Server `.env` (recommended)

On the VPS, ensure `.env` (or `config/credentials.env` if you load it there) includes:

```bash
HEADLESS=true
CHROME_BINARY=/usr/bin/google-chrome
```

Use the actual Chrome path if different (e.g. `/usr/bin/chromium-browser`).

---

## 5️⃣ SERVER ENVIRONMENT DIAGNOSTICS

These can affect Selenium and Chrome on Ubuntu.

### 5.1 Chrome and dependencies

```bash
# Chrome/Chromium installed and version
which google-chrome || which chromium-browser
google-chrome --version

# Common headless dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
  fonts-liberation
```

### 5.2 Sandbox and shared memory

Chrome is started with `--no-sandbox` and `--disable-dev-shm-usage` in code. If you still see crashes:

```bash
# Check /dev/shm size (Chrome uses it in headless)
df -h /dev/shm
# If very small, consider remount or run Chrome with --disable-dev-shm-usage (already set)
```

### 5.3 Memory (e.g. 1 GB VPS)

```bash
free -h
```

If RAM is low, ensure no other heavy processes run during the job. Chrome headless can use ~300–500 MB.

### 5.4 Display / virtual framebuffer (optional)

Not required when using headless Chrome; only if you ever run headed on the server:

```bash
sudo apt-get install -y xvfb
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
```

### 5.5 Write and executable paths

Ensure the app can write to `screenshots/` and `logs/` and that `CHROME_BINARY` is executable:

```bash
cd /root/newmerge/server\ backend\ 1.2/
mkdir -p screenshots logs
ls -la screenshots logs
test -x "$(grep CHROME_BINARY .env 2>/dev/null | cut -d= -f2)" && echo "Chrome executable" || echo "Chrome path missing or not executable"
```

---

## 6️⃣ AUTOMATION HARDENING

Recommendations for production reliability:

- **Self-healing selectors**: Prefer a small set of fallback locators (e.g. by ID, then by placeholder/aria-label) for login and key bidding fields; already partially done in login and can be extended in the bidding engine.
- **Adaptive waits for SAP UI5**: Use explicit waits (e.g. `WebDriverWait` for `element_to_be_clickable`) with configurable timeouts; add short fixed delays after navigation where UI5 is known to render slowly; already added in bidding engine.
- **Retry logic**: Login retries on 406; bidding filter fill retries with longer timeout. Consider retrying the whole `trigger_bid` once on failure (e.g. network blip).
- **Screenshot on failure**: Already saving `login_debug.png` and `login_debug.html`; ensure the same (or similar) is saved on bidding failures (e.g. in `selenium_service` except path).
- **Health check for driver**: Before starting the flow, optionally check that the driver is alive (e.g. get current_url or title); recreate driver if needed.
- **Network**: If 406 persists, treat as infrastructure (IP/proxy/WAF) and combine app-side retries with IP whitelisting or proxy.

---

## 7️⃣ FINAL DIAGNOSIS

### Primary root cause

**SAP or an upstream WAF returns HTTP 406 (or a block page containing “406”/“Not Acceptable”) when the request comes from the VPS.**  
This is triggered by one or more of: **datacenter IP**, **headless Chrome**, or **automation-related fingerprint**. The page body does not contain the SAP login form, so the automation correctly reports “SAP returned 406 block”.

### Secondary contributing issues

- **Local**: After login, the bidding app opens but **filter fields are not found in time** (TimeoutException on `__xmlview0--ididUtclVCShipFromPlant-inner`), likely due to UI5 render delay or a different DOM state. Addressed with post-load delay and retries in `_fill_filters`.
- **Server**: Headless and binary path must be set via env; config loader now applies `HEADLESS` and `CHROME_BINARY` from the environment so the server does not use Windows/headed defaults.

### Best production-ready approach

1. **Code (done)**  
   - Env-based browser config (headless + Chrome path).  
   - Realistic user-agent, Chrome version detection, and anti-detection flags in `driver_factory`.  
   - 406 retries and smarter block detection in `login_service`.  
   - UI5 wait and filter-field retries in `depot_bidding_engine`.

2. **Server environment**  
   - Install Chrome and dependencies (Section 5).  
   - Set `HEADLESS=true` and `CHROME_BINARY=/usr/bin/google-chrome` (or correct path) in `.env`.  
   - Ensure enough memory and write permissions for `screenshots/` and `logs/`.

3. **If 406 continues on VPS**  
   - Ask SAP/network team to **whitelist the VPS IP** or allow headless traffic.  
   - Or route browser traffic through an **allowed proxy/VPN** (set `browser.proxy` in config or env) so requests come from an accepted IP range.

With these changes, the automation is in a position to run successfully on the VPS; remaining 406 issues are best solved at the network/WAF/SAP side while keeping the application-side retries and fingerprint improvements in place.
