"""
Logging Service — Centralized logging with optional dual-file routing.

Legacy mode (default off): logs/<name>_<timestamp>.log

Dual-file mode (logging.execution_phase_file_enabled):
  - logs/execution_phase/<name>_<timestamp>.log  — valid-bid → post-exec window
  - logs/general/<name>_<timestamp>.log          — all other lines (if general_log_file_enabled)
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

# ---------------------------------------------------
# Project Root
# ---------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_LOGS_DIR = _PROJECT_ROOT / "logs"
_APP_CONFIG_FILE = _PROJECT_ROOT / "config" / "application.yaml"

# ---------------------------------------------------
# Logging Format
# ---------------------------------------------------

_DEFAULT_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"
_DEFAULT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_ROOT_LOGGER_NAME = "backend_automation"

# Track created loggers
_loggers: dict[str, logging.Logger] = {}

# Track log paths (execution + optional general)
_logger_paths: dict[str, Path] = {}
_logger_general_paths: dict[str, Path] = {}

# Cached logging config from application.yaml
_logging_settings_cache: dict[str, Any] | None = None

# Thread-local execution window (valid combination found → post-exec)
_phase_local = threading.local()

# Substrings that identify mandatory execution-phase log lines
_EXECUTION_MARKERS: tuple[str, ...] = (
    "Valid combination found",
    "[EXEC_PHASE]",
    "[TIMER]",
    "Current timer:",
    "[EXEC]",
    "EXECUTE_END",
    "total_execution_ms",
    "[POST_EXEC]",
    "POST_EXEC:",
    "Session maintained",
    "[REC][PLAN]",
    "[REC][EXEC]",
    "[REC][CLEANUP]",
    "[SYNC]",
    "Save button clicked",
    "Entered bid amount:",
    "EXEC:",
    "confirmation dialog",
    "Execution dialog sequence completed",
    "SHUBH_MODE_TRIGGER",
    "SEARCH_CLICK_BEFORE_EXEC",
    "DIRECT_EXECUTION_START",
    "FLOW: Fill",
)


# ---------------------------------------------------
# Execution phase context (minimal engine hooks)
# ---------------------------------------------------

def enter_execution_phase() -> None:
    """Mark current thread as inside valid-bid → post-exec logging window."""
    _phase_local.active = True


def exit_execution_phase() -> None:
    """Leave execution-phase window (e.g. resume live monitor loop)."""
    _phase_local.active = False


def is_execution_phase_active() -> bool:
    return bool(getattr(_phase_local, "active", False))


def _message_is_execution_phase(message: str) -> bool:
    return any(marker in message for marker in _EXECUTION_MARKERS)


class ExecutionPhaseFilter(logging.Filter):
    """Allow only execution-window log records into the execution-phase file."""

    def filter(self, record: logging.LogRecord) -> bool:
        if is_execution_phase_active():
            return True
        return _message_is_execution_phase(record.getMessage())


class GeneralLogFilter(logging.Filter):
    """Allow only non-execution log records into the general file."""

    def filter(self, record: logging.LogRecord) -> bool:
        if is_execution_phase_active():
            return False
        return not _message_is_execution_phase(record.getMessage())


# ---------------------------------------------------
# Config
# ---------------------------------------------------

def _default_logging_settings() -> dict[str, Any]:
    return {
        "execution_phase_file_enabled": True,
        "execution_phase_dir": "logs/execution_phase",
        "general_log_file_enabled": False,
        "general_log_dir": "logs/general",
        "general_console_enabled": True,
    }


def get_logging_settings() -> dict[str, Any]:
    global _logging_settings_cache
    if _logging_settings_cache is not None:
        return _logging_settings_cache

    settings = _default_logging_settings()
    try:
        import yaml

        if _APP_CONFIG_FILE.exists():
            with open(_APP_CONFIG_FILE, "r", encoding="utf-8") as f:
                raw = yaml.safe_load(f) or {}
            section = raw.get("logging")
            if isinstance(section, dict):
                settings.update(section)
    except Exception:
        pass

    _logging_settings_cache = settings
    return settings


def _resolve_log_dir(relative: str) -> Path:
    p = Path(relative)
    if p.is_absolute():
        out = p
    else:
        out = _PROJECT_ROOT / p
    out.mkdir(parents=True, exist_ok=True)
    return out


# ---------------------------------------------------
# Ensure logs directory
# ---------------------------------------------------

def _ensure_logs_dir() -> Path:
    _LOGS_DIR.mkdir(parents=True, exist_ok=True)
    return _LOGS_DIR


# ---------------------------------------------------
# Generate log filename
# ---------------------------------------------------

def _make_log_filename(depot_name: str | None) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prefix = depot_name.lower() if depot_name else "app"
    return f"{prefix}_{timestamp}.log"


def _attach_handlers(
    logger: logging.Logger,
    logger_key: str,
    depot_name: str | None,
    level: int,
    console: bool,
) -> None:
    settings = get_logging_settings()
    dual_mode = bool(settings.get("execution_phase_file_enabled", False))
    formatter = logging.Formatter(_DEFAULT_FORMAT, datefmt=_DEFAULT_DATE_FORMAT)

    if not dual_mode:
        logs_dir = _ensure_logs_dir()
        log_path = logs_dir / _make_log_filename(depot_name)
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        _logger_paths[logger_key.upper()] = log_path
    else:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        prefix = (depot_name or "app").lower()
        filename = f"{prefix}_{stamp}.log"

        exec_dir = _resolve_log_dir(str(settings.get("execution_phase_dir", "logs/execution_phase")))
        exec_path = exec_dir / filename
        exec_handler = logging.FileHandler(exec_path, encoding="utf-8")
        exec_handler.setLevel(level)
        exec_handler.setFormatter(formatter)
        exec_handler.addFilter(ExecutionPhaseFilter())
        logger.addHandler(exec_handler)
        _logger_paths[logger_key.upper()] = exec_path

        if bool(settings.get("general_log_file_enabled", False)):
            gen_dir = _resolve_log_dir(str(settings.get("general_log_dir", "logs/general")))
            gen_path = gen_dir / filename
            gen_handler = logging.FileHandler(gen_path, encoding="utf-8")
            gen_handler.setLevel(level)
            gen_handler.setFormatter(formatter)
            gen_handler.addFilter(GeneralLogFilter())
            logger.addHandler(gen_handler)
            _logger_general_paths[logger_key.upper()] = gen_path

    show_console = console
    if dual_mode and not bool(settings.get("general_console_enabled", True)):
        show_console = False

    if show_console:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)


# ---------------------------------------------------
# Main Logger Factory
# ---------------------------------------------------

def get_logger(
    depot_name: str | None = None,
    level: int = logging.INFO,
    console: bool = True,
) -> logging.Logger:

    logger_key = (depot_name or "app").lower()

    if logger_key in _loggers:
        return _loggers[logger_key]

    logger_name = f"{_ROOT_LOGGER_NAME}.{logger_key}"
    logger = logging.getLogger(logger_name)

    logger.setLevel(level)
    logger.propagate = False

    _attach_handlers(logger, logger_key, depot_name, level, console)

    _loggers[logger_key] = logger

    return logger


def configure_named_logger(
    logger: logging.Logger,
    name: str,
    level: int = logging.INFO,
    console: bool = True,
) -> Path | None:
    """
    Attach dual-file (or legacy) handlers to an existing logger — used by selenium_worker.
    Returns primary log file path when available.
    """
    logger.setLevel(level)
    logger.propagate = False
    logger.handlers.clear()

    key = name.lower()
    _attach_handlers(logger, key, name, level, console)

    return _logger_paths.get(key.upper())


# ---------------------------------------------------
# Get Log File Path
# ---------------------------------------------------

def get_log_path(depot_name: str | None = None) -> Path:

    depot_key = (depot_name or "app").upper()

    if depot_key in _logger_paths:
        return _logger_paths[depot_key]

    logs_dir = _ensure_logs_dir()
    return logs_dir / _make_log_filename(depot_name)


def get_general_log_path(depot_name: str | None = None) -> Path | None:
    depot_key = (depot_name or "app").upper()
    return _logger_general_paths.get(depot_key)
