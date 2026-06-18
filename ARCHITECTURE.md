# Unified Backend Automation — Architecture

Merges **Shubh Carriers** (cement e-bidding automation) with **BackEnd 2** (parallel execution and configuration concepts).

---

## 1. Final Directory Structure

```
New Backend Automation/
├── config/
│   ├── application.yaml          # Global settings (URLs, timeouts, intervals)
│   ├── depots.yaml               # Depot definitions and destinations
│   └── credentials.env.example   # Template for credentials (git-ignored)
│
├── src/
│   ├── __init__.py
│   │
│   ├── config_loader.py          # Config Loader module
│   ├── driver_factory.py         # Selenium Driver Factory module
│   ├── depot_bidding_engine.py   # Depot Bidding Engine module
│   ├── parallel_execution_manager.py  # Parallel Execution Manager module
│   └── logging_service.py        # Logging Service module
│
├── cli.py                        # Entry point (CLI interface)
├── main.py                       # Programmatic entry point
├── requirements.txt
├── .env.example
├── .gitignore
│
├── ARCHITECTURE.md               # This file
├── MODULE_MAPPING.md             # Shubh Carrier → Module mapping
├── CONFIG_SPEC.md                # Externalized config values
└── MIGRATION_ROADMAP.md          # Step-by-step migration plan
```

---

## 2. Module Definitions

### 2.1 Config Loader (`config_loader.py`)

**Purpose:** Load and validate all external configuration. Single source of truth.

**Responsibilities:**
- Load `application.yaml` (global settings)
- Load `depots.yaml` (depot definitions, destinations)
- Load credentials from environment or `.env`
- Validate required keys and types
- Provide typed accessors (e.g. `get_depot_names()`, `get_search_retry_interval()`)
- Merge config overrides (e.g. CLI args or env vars)

**Inspired by:** BackEnd 2 `config.properties` + Shubh Carriers hardcoded values

---

### 2.2 Selenium Driver Factory (`driver_factory.py`)

**Purpose:** Create and configure WebDriver instances consistently.

**Responsibilities:**
- Create Chrome/Brave WebDriver
- Support headless vs headed mode (config-driven)
- Set browser binary path (Brave) when configured
- Apply standard options: `--no-sandbox`, `--disable-dev-shm-usage`, etc.
- Set page load timeouts
- Return a ready-to-use driver instance

**Inspired by:** Shubh Carriers driver setup + BackEnd 2 headless options

---

### 2.3 Depot Bidding Engine (`depot_bidding_engine.py`)

**Purpose:** Execute the full bidding workflow for a single depot.

**Responsibilities:**
- Accept: depot name, quantity-destination pairs, config, logger
- **Session:** Navigate to URL, login, click E-Bidding, switch to new tab
- **Search:** Fill Ship From Plant + Depot, click search
- **Poll:** Loop search until qualifying bids found (configurable interval)
- **Parse:** Extract table rows, apply business rules (bid formula, exclusions)
- **Match:** Find rows matching desired quantities (club ID, single, combination)
- **Timer:** Poll timer until `Starts in 0:0:4` or `Expires in`
- **Enter bids:** Fill bid amounts in table inputs (parallel entry)
- **Save:** Click save, handle Yes/OK dialogs
- **Verify:** Optionally print/log updated row data
- Return result (success/failure, counts)

**Inspired by:** Shubh Carriers depot scripts (ayodhya.py, gonda.py, etc.)

---

### 2.4 Parallel Execution Manager (`parallel_execution_manager.py`)

**Purpose:** Run multiple depot bidding tasks in parallel (BackEnd 2 style).

**Responsibilities:**
- Accept: list of depot configs (or depot names + quantity-destination pairs)
- Create thread pool (size from config, default 4)
- Submit each depot as a `DepotTask` (runnable/callable)
- Execute tasks in parallel
- Collect results and errors per depot
- Shutdown with configurable timeout
- Graceful handling of failures (one depot failing does not stop others)

**Inspired by:** BackEnd 2 `ExecutorService` + Shubh Carriers `main.py` subprocess spawning

---

### 2.5 Logging Service (`logging_service.py`)

**Purpose:** Centralized, configurable logging for all modules.

**Responsibilities:**
- Initialize logging from config (level, format, handlers)
- Support file + console output
- Per-depot log files (e.g. `logs/ayodhya_20250213_143022.log`)
- Structured log format (timestamp, level, depot, message)
- Provide `get_logger(depot_name=None)` for module use

**Inspired by:** Shubh Carriers `logging.basicConfig` + BackEnd 2 logging patterns

---

## 3. Module Dependencies

```
                    ┌─────────────────────┐
                    │   config_loader     │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌────────────────────┐    ┌─────────────────────┐
│ driver_factory│    │ depot_bidding_engine│    │parallel_execution_  │
│               │    │                    │    │      manager        │
└───────┬───────┘    │  uses:             │    │                     │
        │            │  - driver_factory  │    │  uses:              │
        │            │  - config_loader   │◄───┤  - depot_bidding_   │
        │            │  - logging_service │    │    engine           │
        │            └────────────────────┘    │  - config_loader    │
        │                      ▲               │  - logging_service  │
        │                      │               └─────────────────────┘
        │            ┌─────────┴─────────┐
        └───────────►│  logging_service  │
                     └──────────────────┘
```

---

## 4. Execution Modes

| Mode | Description | Entry Point |
|------|-------------|-------------|
| **Single depot** | Run one depot (CLI: `--depot AYODHYA`) | `cli.py` |
| **Multi-depot** | Run multiple depots in parallel (CLI: `--depots AYODHYA,GONDA,SITAPUR`) | `cli.py` |
| **Config-based** | Load depot list from config (BackEnd 2 style) | `cli.py` |
| **Programmatic** | `from src import run_depot, run_depots_parallel` | `main.py` |

---

## 5. Design Principles

1. **Config over code** — All variable values in YAML/env, not in source.
2. **Single depot abstraction** — One engine handles any depot; depot = config.
3. **Fail-safe parallelism** — One depot failure does not stop others; errors logged.
4. **No hardcoded secrets** — Credentials only in `.env` or environment.
5. **BackEnd 2 alignment** — Thread pool, config-driven depot list, timeout-based shutdown.
