#!/usr/bin/env python3
"""
Phase 1 verification script.
Tests Config Loader and Logging Service without Selenium.
"""

import sys
from pathlib import Path

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.config_loader import (
    get_app_config,
    get_depot_config,
    get_depot_names,
    get_credentials,
    ConfigError,
)
from src.logging_service import get_logger, get_log_path


def main() -> None:
    print("=== Phase 1 Verification ===\n")

    # 1. Config Loader
    print("1. Config Loader")
    print("-" * 40)
    app_config = get_app_config()
    print(f"   base_url: {app_config['base_url'][:50]}...")
    print(f"   ship_from_plant: {app_config['ship_from_plant']}")
    print(f"   bid_discount_percent: {app_config['bid_discount_percent']}")
    print(f"   parallel.max_workers: {app_config['parallel']['max_workers']}")
    print(f"   excluded_companies: {len(app_config['excluded_companies'])} items")
    print()

    depot_names = get_depot_names()
    print(f"   Depot names: {depot_names}")
    print()

    depot_config = get_depot_config("AYODHYA")
    if depot_config:
        dests = depot_config.get("destinations", [])
        print(f"   AYODHYA destinations: {len(dests)} items")
        print(f"   First 3: {dests[:3]}")
    print()

    depot_config_none = get_depot_config("INVALID")
    print(f"   get_depot_config('INVALID'): {depot_config_none}")
    print()

    try:
        creds = get_credentials()
        print(f"   Credentials: E2S_USERNAME={creds['E2S_USERNAME'][:4]}***")
    except ConfigError as e:
        print(f"   Credentials: {e}")
    print()

    # 2. Logging Service
    print("2. Logging Service")
    print("-" * 40)
    logger = get_logger(depot_name="AYODHYA")
    log_path = get_log_path("AYODHYA")
    print(f"   Log path: {log_path}")
    print(f"   Log path exists: {log_path.exists()}")

    logger.info("Phase 1 verification: Config Loader and Logging Service OK")
    logger.info(f"Depot names: {depot_names}")

    app_logger = get_logger(depot_name=None)
    app_log_path = get_log_path(None)
    print(f"   App log path: {app_log_path}")
    app_logger.info("Application-level log message")

    print()
    print("=== Phase 1 Verification Complete ===")
    print("Check the logs/ directory for output files.")


if __name__ == "__main__":
    main()
