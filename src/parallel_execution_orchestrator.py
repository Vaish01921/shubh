"""
Parallel Execution Orchestrator — Runs multiple depots concurrently via ThreadPoolExecutor.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed

from .config_loader import get_app_config
from .depot_execution_engine import DepotExecutionEngine
from .logging_service import get_logger


class ParallelExecutionOrchestrator:
    """Orchestrates parallel execution of multiple depot engines."""

    def __init__(self, depot_names: list[str]) -> None:
        self.depot_names = depot_names
        config = get_app_config()
        self.max_workers = config["parallel"]["max_workers"]
        self.logger = get_logger(depot_name=None)

    def run(self) -> None:
        """Run all depot engines in parallel."""
        self.logger.info(
            "Starting parallel execution for %d depots", len(self.depot_names)
        )

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self._run_depot, name): name
                for name in self.depot_names
            }

            for future in as_completed(futures):
                depot_name = futures[future]
                try:
                    future.result()
                except Exception as e:
                    self.logger.warning(
                        "Depot %s raised exception: %s", depot_name, e, exc_info=True
                    )

        self.logger.info("Parallel execution completed")

    def _run_depot(self, depot_name: str) -> None:
        """Create engine for one depot and run it."""
        engine = DepotExecutionEngine(depot_name)
        engine.run()


if __name__ == "__main__":
    depot_list = ["DEPOT_A", "DEPOT_B"]
    orchestrator = ParallelExecutionOrchestrator(depot_list)
    orchestrator.run()
