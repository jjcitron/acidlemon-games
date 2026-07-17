# Runs

Per-run evidence directory. Each run gets `loop/runs/<run_id>/` holding verify logs,
triage JSON, and any other artifacts the ledgers point to as `evidence`.

Ledger rows reference these paths; never log an outcome without evidence on disk.
