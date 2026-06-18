# backend_server.py

import os
import threading
from fastapi import FastAPI, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from src.logging_service import get_logger
from src.selenium_service import trigger_bid, trigger_bid_legacy
from src.job_store import job_store
from src.depot_normalization import normalize_depot_name
from src.config_loader import get_app_config

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = get_logger("backend_api")

# -----------------------
# API MODELS
# -----------------------

class DesiredBidItem(BaseModel):
    """One desired bid: quantity (and optional destination)."""
    quantity: float
    destination: str | None = None
    depot: str | None = None


class BidRequest(BaseModel):
    depot: str | None = None
    depots: list[str] | None = None  # optional override list for multi-depot
    desired_bids: list[DesiredBidItem] = []  # e.g. [{"quantity": 25}, {"quantity": 50}]


# -----------------------
# STARTUP LOGGING
# -----------------------

@app.on_event("startup")
def startup_event():
    logger.info("🚀 Backend API starting...")
    logger.info(f"USER = {os.getenv('USER')}")
    logger.info(f"PATH = {os.getenv('PATH')}")
    logger.info("API environment initialized")


# -----------------------
# API ENDPOINT
# -----------------------

@app.post("/api/start-bid")
def start_bid(data: BidRequest, sync: bool = False, legacy_blocking: bool = False):
    """
    Start SAP bidding automation.
    Body: optional depot, depots[], desired_bids.

    Query sync:
    - multiprocess: sync=false queues a job (job_id); sync=true blocks until all depot processes finish.

    Query legacy_blocking:
    - When execution_mode is legacy: false (default) runs Selenium in a background thread and returns job_id immediately.
    - Set legacy_blocking=true to block until legacy Selenium finishes (debug / scripts only).
    """
    try:
        raw_depot = data.depot
        raw_depots = list(data.depots) if data.depots else None
        _dn = normalize_depot_name(data.depot)
        depot = _dn if _dn else None
        depots = (
            [normalize_depot_name(d) for d in data.depots if str(d).strip()]
            if data.depots
            else None
        )
        if depots is not None:
            depots = [d for d in depots if d]
            if not depots:
                depots = None
        desired_bids = []
        for b in data.desired_bids:
            if float(b.quantity) <= 0:
                continue
            _bd = normalize_depot_name(b.depot)
            entry = {
                "quantity": float(b.quantity),
                "destination": b.destination,
                "depot": _bd if _bd else None,
            }
            desired_bids.append(entry)
        if not desired_bids:
            raise HTTPException(status_code=400, detail="desired_bids must not be empty")
        logger.info("Received desired_bids=%s", desired_bids)
        logger.info(
            "API depot normalization: depot_raw=%r depots_raw=%r -> depot=%r depots=%r",
            raw_depot,
            raw_depots,
            depot,
            depots,
        )
        logger.info(
            "API: start-bid depot=%s depots=%s desired_bids=%s sync=%s legacy_blocking=%s",
            depot,
            depots,
            desired_bids,
            sync,
            legacy_blocking,
        )

        cfg_mode = str((get_app_config().get("automation") or {}).get("execution_mode", "legacy")).strip().lower()

        if cfg_mode == "multiprocess":
            result = trigger_bid(
                depot=depot,
                depots=depots,
                desired_bids=desired_bids,
                sync=sync,
            )

            if result.get("execution_mode") == "multiprocess" and result.get("job_id"):
                return {
                    "status": result.get("status", "queued"),
                    "job_id": result.get("job_id"),
                    "depots": result.get("depots"),
                    "execution_mode": "multiprocess",
                    "multiprocess_max_workers": result.get("multiprocess_max_workers"),
                    "message": result.get("message", ""),
                    "poll_path": result.get("poll_path"),
                    "sync": sync,
                }

            return {
                "status": result.get("status", "unknown"),
                "depot": result.get("depot"),
                "depots_processed": result.get("depots_processed", []),
                "results": result.get("results", {}),
                "rows_found": result.get("rows_found", 0),
                "bids_submitted": result.get("bids_submitted", 0),
                "execution_time": result.get("execution_time", ""),
                "message": result.get("message", ""),
                "error": result.get("error", None),
                "screenshot": result.get("screenshot", {}),
                "execution_mode": result.get("execution_mode", "multiprocess"),
                "multiprocess_max_workers": result.get("multiprocess_max_workers"),
                "sync": sync,
            }

        if not legacy_blocking:
            truck = str(depot or (depots[0] if depots else "AUTO"))
            depots_list = list(depots) if depots else ([depot] if depot else [])
            job_id = job_store.create_job(truck, depots_list, desired_bids)

            def _legacy_runner() -> None:
                job_store.mark_running(job_id)
                try:
                    r = trigger_bid_legacy(truck, depot, depots, desired_bids)
                    job_store.record_depot_result(job_id, "legacy", r)
                    st = str(r.get("status") or "completed")
                    overall = "failed" if st == "failed" else "completed"
                    job_store.finalize(
                        job_id,
                        overall,
                        summary=str(r.get("message") or r.get("error") or ""),
                    )
                except Exception as e:
                    logger.exception("Legacy async bidding failed")
                    job_store.record_depot_error(job_id, "legacy", str(e))
                    job_store.finalize(job_id, "failed", summary=str(e))

            threading.Thread(
                target=_legacy_runner,
                daemon=True,
                name=f"legacy-{job_id[:8]}",
            ).start()
            return {
                "status": "queued",
                "job_id": job_id,
                "depots": depots_list,
                "execution_mode": "legacy_async",
                "message": "Legacy bidding started in background; poll GET /api/bid-job/{job_id}",
                "poll_path": f"/api/bid-job/{job_id}",
                "sync": sync,
            }

        result = trigger_bid_legacy(
            str(depot or (depots[0] if depots else "AUTO")),
            depot,
            depots,
            desired_bids,
        )
        return {
            "status": result.get("status", "unknown"),
            "depot": result.get("depot"),
            "depots_processed": result.get("depots_processed", []),
            "results": result.get("results", {}),
            "rows_found": result.get("rows_found", 0),
            "bids_submitted": result.get("bids_submitted", 0),
            "execution_time": result.get("execution_time", ""),
            "message": result.get("message", ""),
            "error": result.get("error", None),
            "screenshot": result.get("screenshot", {}),
            "execution_mode": result.get("execution_mode", "legacy"),
            "multiprocess_max_workers": result.get("multiprocess_max_workers"),
            "sync": sync,
        }
    except Exception as e:
        logger.exception("API error")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bid-job/{job_id}")
def get_bid_job(job_id: str):
    """Poll multiprocess job status (queued | running | completed | failed)."""
    rec = job_store.get_job(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="job not found")
    return rec


# ============================================================
# ================== SELENIUM UI SECTION ======================
# ============================================================

# -----------------------
# LOGIN PAGE (HTML)
# -----------------------

@app.get("/login", response_class=HTMLResponse)
def login_page():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Selenium Login</title>
        <style>
            body {
                font-family: Arial;
                background: #f2f2f2;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            .box {
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                width: 300px;
            }
            input, button {
                width: 100%;
                padding: 10px;
                margin-top: 10px;
            }
            button {
                background: #4CAF50;
                color: white;
                border: none;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="box">
            <h3>Login</h3>
            <form method="post" action="/do-login">
                <input id="username" name="username" placeholder="Username" required />
                <input id="password" name="password" type="password" placeholder="Password" required />
                <button id="loginBtn" type="submit">Login</button>
            </form>
        </div>
    </body>
    </html>
    """


# -----------------------
# LOGIN HANDLER
# -----------------------

@app.post("/do-login")
def do_login(username: str = Form(...), password: str = Form(...)):
    logger.info(f"Login attempt: {username}")

    # Dummy auth (replace later with real logic)
    if username == "admin" and password == "admin":
        return RedirectResponse(url="/dashboard", status_code=302)
    else:
        return HTMLResponse("""
            <h3>Login Failed</h3>
            <a href="/login">Try again</a>
        """)


# -----------------------
# DASHBOARD PAGE
# -----------------------

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    return """
    <html>
    <body>
        <h2>Login Successful ✅</h2>
        <p>Welcome to Selenium Automation Dashboard</p>
    </body>
    </html>
    """
# -----------------------
# RUN SERVER
# -----------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend_server:app",
        host="127.0.0.1",
        port=8000,
        reload=False
    )
