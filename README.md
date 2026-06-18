# New Backend Automation

Unified Python backend that merges:

- **Shubh Carriers** — cement e-bidding automation (Selenium, SAP Fiori portal)
- **BackEnd 2** — parallel execution and configuration concepts

---

## Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Directory structure, module definitions, design principles |
| [MODULE_MAPPING.md](MODULE_MAPPING.md) | Shubh Carrier script → module mapping |
| [CONFIG_SPEC.md](CONFIG_SPEC.md) | Externalized configuration values |
| [MIGRATION_ROADMAP.md](MIGRATION_ROADMAP.md) | Step-by-step migration plan |

---

## Directory Structure

```
New Backend Automation/
├── config/           # YAML and env config
├── src/              # Python modules (to be implemented)
├── cli.py            # CLI entry point (to be implemented)
├── main.py           # Programmatic entry point (to be implemented)
└── requirements.txt
```

---

## Modules

1. **Config Loader** — Load and validate configuration
2. **Selenium Driver Factory** — Create WebDriver instances
3. **Depot Bidding Engine** — Single-depot bidding workflow
4. **Parallel Execution Manager** — Run multiple depots in parallel
5. **Logging Service** — Centralized logging

---

## Next Steps

Follow [MIGRATION_ROADMAP.md](MIGRATION_ROADMAP.md) to implement the system phase by phase.
