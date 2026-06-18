import importlib
import os
import random
import re
import shutil
import ssl
import subprocess
import tempfile
import time
from pathlib import Path

import undetected_chromedriver as uc
from selenium.webdriver.chrome.options import Options

from .logging_service import get_logger
from .config_loader import get_app_config


logger = get_logger("driver_factory")

CHROME_FALLBACK_WIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CHROME_FALLBACK_LINUX = "/usr/bin/google-chrome"

CHROME_UA_LINUX = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def _chromedriver_filename() -> str:
    return "chromedriver.exe" if os.name == "nt" else "chromedriver"


def _detect_chrome_major_version(binary_path: str) -> int | None:
    try:
        out = subprocess.check_output(
            [binary_path, "--version"],
            timeout=5,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        match = re.search(r"(\d+)\.\d+\.\d+", out)
        return int(match.group(1)) if match else None
    except Exception:
        if os.name == "nt":
            try:
                ps_cmd = (
                    "powershell.exe -NoLogo -NoProfile -NonInteractive "
                    "-ExecutionPolicy Bypass "
                    f"-Command \"(Get-Item '{binary_path}').VersionInfo.ProductVersion\""
                )
                out = subprocess.check_output(
                    ps_cmd,
                    timeout=15,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    shell=True,
                )
                match = re.search(r"(\d+)\.\d+\.\d+", out)
                return int(match.group(1)) if match else None
            except Exception:
                return None
        return None


def _is_retryable_uc_bootstrap_error(exc: BaseException) -> bool:
    if isinstance(
        exc,
        (
            ssl.SSLError,
            OSError,
            PermissionError,
            FileExistsError,
            TimeoutError,
            ConnectionError,
            BlockingIOError,
        ),
    ):
        return True
    msg = (str(exc) or "").lower()
    needles = (
        "decryption_failed",
        "bad_record_mac",
        "ssl",
        "file exists",
        "being used by another",
        "cannot access",
        "winerror 32",
        "rename",
        "chromedriver",
        "connection reset",
        "connection aborted",
        "tempfailure",
        "timed out",
    )
    return any(n in msg for n in needles)


def _uc_root_dir() -> Path:
    root = Path(tempfile.gettempdir()) / "ebidding_uc_isolated"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _isolate_uc_data_path_and_create(
    uc_kw: dict,
    *,
    pinned_chromedriver: str | None,
) -> uc.Chrome:
    work = Path(
        tempfile.mkdtemp(
            prefix=f"uc_{os.getpid()}_",
            dir=_uc_root_dir(),
        )
    )
    patcher_mod = importlib.import_module("undetected_chromedriver.patcher")
    previous = patcher_mod.Patcher.data_path
    patcher_mod.Patcher.data_path = str(work)
    try:
        kw = dict(uc_kw)
        kw["user_multi_procs"] = False
        if pinned_chromedriver and os.path.isfile(pinned_chromedriver):
            name = _chromedriver_filename()
            dest = work / name
            shutil.copy2(pinned_chromedriver, dest)
            if os.name != "nt":
                try:
                    dest.chmod(0o755)
                except OSError:
                    pass
            kw["driver_executable_path"] = str(dest)
            logger.info(
                "Using pinned chromedriver copy for UC patch (multiprocess-safe): %s",
                dest,
            )
        return uc.Chrome(**kw)
    finally:
        patcher_mod.Patcher.data_path = previous


def create_driver():
    logger.info("Starting Chrome driver (pid=%s multiprocess-safe bootstrap)", os.getpid())

    config = get_app_config()
    browser_config = config.get("browser", {})

    chrome_binary = browser_config.get("binary_path", "/usr/bin/google-chrome")
    if not os.path.isfile(chrome_binary) and not Path(chrome_binary).is_file():
        fallback = CHROME_FALLBACK_WIN if os.name == "nt" else CHROME_FALLBACK_LINUX
        if os.path.isfile(fallback) or Path(fallback).is_file():
            logger.warning(
                "Configured Chrome path not found (%s), using fallback: %s",
                chrome_binary,
                fallback,
            )
            chrome_binary = fallback
        else:
            logger.warning(
                "Configured Chrome path not found: %s (no fallback available)",
                chrome_binary,
            )

    headless = bool(browser_config.get("headless", False))
    window_size = browser_config.get("window_size", "1920,1080")
    proxy = browser_config.get("proxy")

    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-default-apps")
    options.add_argument("--disable-sync")
    options.add_argument("--metrics-recording-only")
    options.add_argument("--no-first-run")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-infobars")
    options.add_argument("--lang=en-US,en")
    options.add_argument(f"--user-agent={CHROME_UA_LINUX}")
    options.add_argument(f"--window-size={window_size}")
    if headless:
        options.add_argument("--headless=new")
    if proxy:
        logger.info("Using proxy: %s", proxy)
        options.add_argument(f"--proxy-server={proxy}")
    options.binary_location = chrome_binary

    logger.info("Chrome binary: %s", chrome_binary)
    logger.info("Chrome Headless Mode: %s", headless)

    uc_kw: dict = {"options": options, "headless": headless, "use_subprocess": True}
    version_main_env = os.getenv("UC_CHROME_VERSION_MAIN", "").strip()
    env_main = int(version_main_env) if version_main_env.isdigit() else None
    detected_main = _detect_chrome_major_version(chrome_binary)
    # Prefer detected major from the actual Chrome binary so UC_CHROME_VERSION_MAIN cannot
    # pin an older driver (e.g. 146) when installed Chrome is newer (e.g. 148).
    if detected_main is not None:
        version_main = detected_main
        src = "auto-detect"
    elif env_main is not None:
        version_main = env_main
        src = "env UC_CHROME_VERSION_MAIN"
    else:
        version_main = None
        src = ""
    if version_main is not None:
        uc_kw["version_main"] = version_main
        logger.info("Using Chrome major version for UC: %s (%s)", version_main, src)
    else:
        logger.warning(
            "Could not detect Chrome major version. Set UC_CHROME_VERSION_MAIN to avoid driver mismatch."
        )

    pinned = browser_config.get("chromedriver_path")
    if isinstance(pinned, str) and pinned.strip():
        pinned = pinned.strip()
    else:
        pinned = None

    max_attempts = max(1, int(browser_config.get("chromedriver_create_retries", 6)))
    base_delay = float(browser_config.get("chromedriver_retry_base_delay_seconds", 2.0))

    last_exc: BaseException | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            logger.info(
                "UC bootstrap attempt %d/%d isolated_root=%s",
                attempt,
                max_attempts,
                _uc_root_dir(),
            )
            driver = _isolate_uc_data_path_and_create(uc_kw, pinned_chromedriver=pinned)
            driver.execute_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            )
            logger.info("Chrome driver started successfully")
            return driver
        except Exception as e:
            last_exc = e
            logger.warning(
                "Chrome driver bootstrap failed (attempt %d/%d): %s",
                attempt,
                max_attempts,
                e,
            )
            if attempt >= max_attempts or not _is_retryable_uc_bootstrap_error(e):
                logger.exception("Failed to create Chrome driver (giving up)")
                raise RuntimeError(f"Chrome driver failed: {e}") from e
            delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0.25, 1.25)
            logger.info("Retrying UC bootstrap in %.2fs", delay)
            time.sleep(delay)

    raise RuntimeError(f"Chrome driver failed: {last_exc}") from last_exc
