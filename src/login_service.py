import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from .logging_service import get_logger
from .config_loader import get_app_config, get_credentials


logger = get_logger("login_service")

# Retry when SAP returns 406 (e.g. VPS IP / headless blocked)
LOGIN_406_RETRIES = 3
LOGIN_406_RETRY_DELAY_SECONDS = 8


def _timing_log_new(step_name: str, start_time: float) -> None:
    elapsed = time.perf_counter() - start_time
    line = f"[TIMING - NEW] {step_name}: {elapsed:.2f} sec"
    print(line)
    # Avoid synchronous logger I/O; timing is captured via print().


def _is_406_block(driver) -> bool:
    """True if page looks like a 406/Not Acceptable block (not just a mention in HTML)."""
    src = driver.page_source or ""
    # Heuristic: block page often has these together and lacks login form
    has_406 = "406" in src or "Not Acceptable" in src
    has_login_hint = "USERNAME_FIELD" in src or "PASSWORD_FIELD" in src or "password" in src.lower()
    return has_406 and not has_login_hint


def login(driver):
    config = get_app_config()
    creds = get_credentials()
    sap_config = config.get("sap", {})
    base_url = sap_config.get("base_url")
    username = creds.get("username")
    password = creds.get("password")

    if not base_url:
        raise RuntimeError("❌ SAP base_url not found in config")

    logger.info("========================================")
    logger.info("🔐 LOGIN SERVICE STARTED")
    logger.info("🌐 BASE_URL = %s", base_url)
    logger.info("👤 USERNAME = %s", username)
    logger.info("========================================")

    project_root = Path(__file__).resolve().parent.parent
    screenshots_dir = project_root / "screenshots"
    html_debug_dir = project_root / "logs"
    screenshots_dir.mkdir(parents=True, exist_ok=True)
    html_debug_dir.mkdir(parents=True, exist_ok=True)
    debug_png = screenshots_dir / "login_debug.png"
    debug_html = html_debug_dir / "login_debug.html"

    wait = WebDriverWait(driver, 30)

    for attempt in range(1, LOGIN_406_RETRIES + 1):
        try:
            logger.info("🌍 Opening SAP page (attempt %d/%d): %s", attempt, LOGIN_406_RETRIES, base_url)
            step_open_sap_start = time.perf_counter()
            driver.get(base_url)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            _timing_log_new("Step 1 - Opening SAP Portal (login_service)", step_open_sap_start)
            logger.info("✅ SAP page loaded")

            driver.save_screenshot(str(debug_png))
            with open(debug_html, "w", encoding="utf-8") as f:
                f.write(driver.page_source)
            logger.info("📸 Debug files saved: %s, %s", debug_png, debug_html)

            if _is_406_block(driver):
                snippet = (driver.page_source or "")[:500].replace("\n", " ")
                logger.warning(
                    "⚠️ SAP 406/block detected on attempt %d. Page snippet: %s",
                    attempt, snippet,
                )
                if attempt < LOGIN_406_RETRIES:
                    time.sleep(LOGIN_406_RETRY_DELAY_SECONDS)
                    continue
                logger.error("❌ SAP returned 406 block after %d attempts", LOGIN_406_RETRIES)
                raise RuntimeError(
                    "SAP blocked request (406). Possible automation detection or firewall restriction. "
                    "Check server IP whitelist / WAF / headless detection."
                )
            break
        except RuntimeError:
            if attempt < LOGIN_406_RETRIES:
                time.sleep(LOGIN_406_RETRY_DELAY_SECONDS)
                continue
            raise

    logger.info("🔍 Searching for SAP login fields")
    step_login_start = time.perf_counter()

    try:

        # Use the working IDs from Ayodhyaparrallel.py
        username_field = wait.until(
            EC.presence_of_element_located((By.ID, "USERNAME_FIELD-inner"))
        )

        password_field = driver.find_element(By.ID, "PASSWORD_FIELD-inner")

    except Exception:

        logger.info("⚠️ Login fields not found on main page, checking iframes")

        iframes = driver.find_elements(By.TAG_NAME, "iframe")

        found = False

        for iframe in iframes:

            driver.switch_to.frame(iframe)

            try:

                username_field = driver.find_element(By.ID, "USERNAME_FIELD-inner")
                password_field = driver.find_element(By.ID, "PASSWORD_FIELD-inner")

                found = True
                break

            except Exception:
                driver.switch_to.default_content()

        if not found:

            raise RuntimeError(
                f"❌ SAP login fields not found. Check {debug_png}"
            )

    logger.info("✅ Login fields found")

    username_field.send_keys(username)
    password_field.send_keys(password)

    # In the working script, login is triggered by pressing Enter on the password field
    password_field.send_keys(Keys.RETURN)

    logger.info("🚀 Login submitted via Enter key")

    time.sleep(5)
    _timing_log_new("Step 2 - Login Process", step_login_start)
