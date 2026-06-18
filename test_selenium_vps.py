from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

options = Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--single-process")
options.add_argument("--no-zygote")
options.add_argument("--disable-gpu")
options.add_argument("--remote-debugging-port=9222")

service = Service(executable_path="/usr/local/bin/chromedriver")

driver = webdriver.Chrome(service=service, options=options)
driver.get("https://www.google.com")
print("Page title:", driver.title)
driver.quit()
