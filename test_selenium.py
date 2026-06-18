# test_selenium.py
"""
VPS-ready Selenium Chrome test
Optimized for 1 CPU, 2GB RAM headless Chrome.
"""

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

# -----------------------------
# Chrome options
# -----------------------------
options = Options()
options.binary_location = "/usr/bin/google-chrome"

# VPS / headless stability flags
vps_flags = [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
    "--no-zygote",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-client-side-phishing-detection",
    "--disable-default-apps",
    "--disable-features=site-per-process,VizDisplayCompositor,NetworkService,NetworkServiceInProcess",
    "--disable-hang-monitor",
    "--disable-ipc-flooding-protection",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--safebrowsing-disable-auto-update",
    "--password-store=basic",
    "--use-mock-keychain",
    "--window-size=1920,1080",
    "--remote-debugging-port=9222",
]

for flag in vps_flags:
    options.add_argument(flag)

# Anti-detection
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option("useAutomationExtension", False)

# -----------------------------
# Chromedriver
# -----------------------------
service = Service(executable_path="/usr/local/bin/chromedriver")

# -----------------------------
# Launch browser and test
# -----------------------------
try:
    driver = webdriver.Chrome(service=service, options=options)
    driver.get("https://www.google.com")
    print("Page title:", driver.title)
finally:
    driver.quit()
