# Final Directory Structure

```
New Backend Automation/
│
├── config/
│   ├── application.yaml.example   # Copy to application.yaml
│   ├── depots.yaml.example        # Copy to depots.yaml
│   └── credentials.env.example    # Copy to credentials.env
│
├── src/
│   ├── __init__.py
│   ├── config_loader.py           # Config Loader module
│   ├── driver_factory.py          # Selenium Driver Factory module
│   ├── depot_bidding_engine.py    # Depot Bidding Engine module
│   ├── parallel_execution_manager.py  # Parallel Execution Manager module
│   └── logging_service.py         # Logging Service module
│
├── cli.py                         # CLI entry point
├── main.py                        # Programmatic entry point
├── requirements.txt
├── .gitignore
├── .env.example                   # Optional; for python-dotenv
│
├── ARCHITECTURE.md                # Module definitions, design
├── MODULE_MAPPING.md              # Shubh Carrier → Module mapping
├── CONFIG_SPEC.md                 # Externalized config values
├── MIGRATION_ROADMAP.md           # Step-by-step migration plan
├── DIRECTORY_STRUCTURE.md         # This file
└── README.md
```

## Generated at Runtime

- `logs/` — Per-depot log files (created by Logging Service)
- `config/application.yaml` — From example (git-ignored if contains secrets)
- `config/depots.yaml` — From example
- `config/credentials.env` — From example (git-ignored)
