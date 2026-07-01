"""
Depot Execution Engine — Runs the automation flow for a single depot.

Production architecture:
One job = one driver = one browser session
"""

from .config_loader import get_app_config
from .driver_manager import get_driver, close_driver
from .logging_service import get_logger


class DepotExecutionEngine:
    """Executes the automation flow for one depot."""

    def __init__(self, depot_name: str) -> None:
        self.depot_name = depot_name
        self.logger = get_logger(depot_name=depot_name)

    def run(self) -> None:
        """
        Run the depot execution flow.
        Flow:
        - Create driver
        - Open base_url (SAP / portal)
        - Log title
        - Close driver
        """
        self.logger.info("🚀 Starting execution for depot: %s", self.depot_name)

        try:
            # ✅ Global production driver
            driver = get_driver()   # no depot_name

            config = get_app_config()
            base_url = config.get("base_url", "")

            self.logger.info("🌍 Opening base URL: %s", base_url)
            driver.get(base_url)

            title = driver.title
            self.logger.info("📄 Page title: %s", title)

        finally:
            # ✅ Clean shutdown
            close_driver()

        self.logger.info("✅ Execution finished for depot: %s", self.depot_name)


if __name__ == "__main__":
    engine = DepotExecutionEngine("TEST_DEPOT")
    engine.run()
