from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Routers ──
from routers.metadata import router as metadata_router
from routers.query import router as query_router
from routers.workspace import router as workspace_router
from routers.scheduler import router as scheduler_router, scheduler

app = FastAPI()

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routers ──
app.include_router(metadata_router)       # /databases, /tables, /columns, /cache/clear
app.include_router(query_router)          # /api/query/execute, /api/query/download
app.include_router(workspace_router)      # /api/workspace/*
app.include_router(scheduler_router)      # /api/scheduler/*


# ── Root health-check ──
@app.get("/")
def root():
    return {"status": "backend running"}


# ── Scheduler Lifecycle ──
@app.on_event("startup")
def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        print("[Scheduler] APScheduler started.")


@app.on_event("shutdown")
def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[Scheduler] APScheduler stopped.")
