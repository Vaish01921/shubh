# test_chrome_vps.py
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

driver = None

try:
    # Chrome options for VPS / headless
    options = Options()
    options.binary_location = "/usr/bin/google-chrome"  # confirm with `which google-chrome`
    options.add_argument("--headless=new")               # modern headless mode
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--remote-debugging-port=9222")
    
    # Optional flags for stability
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-software-rasterizer")
    
    # Chromedriver service path
    service = Service(executable_path="/usr/local/bin/chromedriver")  # confirm with `which chromedriver`

    # Initialize driver
    driver = webdriver.Chrome(service=service, options=options)
    
    # Open a page
    driver.get("https://www.google.com")
    print("Page title:", driver.title)

except Exception as e:
    print("Error initializing Chrome driver:", e)

finally:
    if driver:
        driver.quit()
