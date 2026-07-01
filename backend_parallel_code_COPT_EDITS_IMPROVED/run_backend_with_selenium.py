from src import config_loader
import src.driver_factory as driver_factory
from src.login_service import login
from src.depot_execution_engine import DepotExecutionEngine
from src.logging_service import get_logger

logger = get_logger(None)

def main():
    logger.info("Starting backend automation (HEADLESS MODE)")

    try:
        # Load config
        logger.info("Loading config...")
        app_config = config_loader.get_app_config()
        logger.info("Config loaded successfully")

        # Create the driver (HEADLESS)
        logger.info("Creating Selenium driver (headless chrome)")
        driver = driver_factory.create_driver()

        try:
            # Perform login
            logger.info("Running login routine")
            login(driver)

            # Run backend automation
            logger.info("Starting backend automation engine")
            engine = DepotExecutionEngine(depot_name="AYODHYA")
            engine.run()   # correct — no driver argument

            logger.info("Backend automation completed successfully")

        finally:
            logger.info("Closing browser")
            driver.quit()

    except Exception as e:
        logger.exception("Backend automation failed with error:")
        raise e


if __name__ == "__main__":
    main()
