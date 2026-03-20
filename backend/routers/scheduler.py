import os
import uuid
import datetime
from typing import Optional

from fastapi import APIRouter
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger

from config import SCHEDULER_DB_URL, SCHEDULED_OUTPUT_DIR
from services.scheduler_service import run_scheduled_job, read_logs

router = APIRouter(prefix="/api/scheduler")

# ── APScheduler instance (imported by main app.py for lifecycle control) ──
jobstores = {"default": SQLAlchemyJobStore(url=SCHEDULER_DB_URL)}
scheduler = BackgroundScheduler(jobstores=jobstores, timezone="UTC")


# ─────────────────────────────────────────────
# ADD JOB
# ─────────────────────────────────────────────
@router.post("/add")
def add_scheduled_job(payload: dict):
    """
    Create a new scheduled job.
    Required: name, sql, schedule_type (once | interval | cron).
    Optional: limit (default 1000), action (execute | download),
              run_at, interval_minutes, cron, output_dir.
    """
    job_name      = payload.get("name", "unnamed_job")
    sql           = payload.get("sql", "").strip()
    limit         = int(payload.get("limit", 1000))
    action        = payload.get("action", "execute")
    schedule_type = payload.get("schedule_type", "")
    output_dir    = payload.get("output_dir", SCHEDULED_OUTPUT_DIR)

    if not sql:
        return {"error": "sql is required"}
    if not schedule_type:
        return {"error": "schedule_type is required (once | interval | cron)"}
    if action not in ("execute", "download"):
        return {"error": "action must be 'execute' or 'download'"}

    job_id = str(uuid.uuid4())

    try:
        if schedule_type == "once":
            run_at_str = payload.get("run_at", "")
            if not run_at_str:
                return {"error": "run_at (ISO datetime) is required for schedule_type=once"}
            trigger = DateTrigger(
                run_date=datetime.datetime.fromisoformat(run_at_str),
                timezone="UTC",
            )

        elif schedule_type == "interval":
            minutes = int(payload.get("interval_minutes", 60))
            if minutes < 1:
                return {"error": "interval_minutes must be >= 1"}
            trigger = IntervalTrigger(minutes=minutes)

        elif schedule_type == "cron":
            cron_expr = payload.get("cron", "0 8 * * *").strip()
            parts = cron_expr.split()
            if len(parts) != 5:
                return {"error": "cron must have exactly 5 fields: minute hour day month day_of_week"}
            trigger = CronTrigger(
                minute=parts[0], hour=parts[1], day=parts[2],
                month=parts[3], day_of_week=parts[4], timezone="UTC",
            )

        else:
            return {"error": f"Unknown schedule_type '{schedule_type}'. Use: once | interval | cron"}

        scheduler.add_job(
            run_scheduled_job,
            trigger=trigger,
            id=job_id,
            name=job_name,
            args=[job_id, job_name, sql, limit, action, output_dir],
            replace_existing=True,
            misfire_grace_time=3600,
        )

        return {
            "created": True,
            "job_id": job_id,
            "job_name": job_name,
            "schedule_type": schedule_type,
            "action": action,
        }

    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# LIST JOBS
# ─────────────────────────────────────────────
@router.get("/list")
def list_scheduled_jobs():
    """Return all scheduled jobs with next run time and status."""
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time.isoformat() if job.next_run_time else None
        status   = "paused" if job.next_run_time is None else "active"
        args = job.args or []
        jobs.append({
            "id":         job.id,
            "name":       job.name,
            "next_run":   next_run,
            "trigger":    str(job.trigger),
            "status":     status,
            "sql":        args[2] if len(args) > 2 else "",
            "limit":      args[3] if len(args) > 3 else 1000,
            "action":     args[4] if len(args) > 4 else "execute",
            "output_dir": args[5] if len(args) > 5 else SCHEDULED_OUTPUT_DIR,
        })
    return {"jobs": jobs}


# ─────────────────────────────────────────────
# DELETE JOB
# ─────────────────────────────────────────────
@router.delete("/delete/{job_id}")
def delete_scheduled_job(job_id: str):
    try:
        scheduler.remove_job(job_id)
        return {"deleted": True}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# PAUSE JOB
# ─────────────────────────────────────────────
@router.post("/pause/{job_id}")
def pause_scheduled_job(job_id: str):
    try:
        scheduler.pause_job(job_id)
        return {"paused": True}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# RESUME JOB
# ─────────────────────────────────────────────
@router.post("/resume/{job_id}")
def resume_scheduled_job(job_id: str):
    try:
        scheduler.resume_job(job_id)
        return {"resumed": True}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# RUN NOW
# ─────────────────────────────────────────────
@router.post("/run-now/{job_id}")
def run_job_now(job_id: str):
    """Immediately trigger a scheduled job (without changing its schedule)."""
    try:
        job = scheduler.get_job(job_id)
        if not job:
            return {"error": "Job not found"}
        scheduler.modify_job(
            job_id,
            next_run_time=datetime.datetime.now(datetime.timezone.utc),
        )
        return {"triggered": True}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# EXECUTION LOGS
# ─────────────────────────────────────────────
@router.get("/logs")
def get_scheduler_logs(job_id: Optional[str] = None, limit: int = 100):
    """Return execution history. Optionally filter by job_id."""
    logs = read_logs()
    if job_id:
        logs = [l for l in logs if l.get("job_id") == job_id]
    return {"logs": logs[:limit]}


# ─────────────────────────────────────────────
# LIST OUTPUT FILES
# ─────────────────────────────────────────────
@router.get("/files")
def list_scheduled_output_files():
    """Return CSV files produced by scheduled download jobs."""
    try:
        files = []
        for fname in sorted(os.listdir(SCHEDULED_OUTPUT_DIR), reverse=True):
            if fname.endswith(".csv"):
                fpath = os.path.join(SCHEDULED_OUTPUT_DIR, fname)
                size  = os.path.getsize(fpath)
                mtime = datetime.datetime.fromtimestamp(
                    os.path.getmtime(fpath)
                ).isoformat()
                files.append({
                    "filename": fname,
                    "size_bytes": size,
                    "modified": mtime,
                })
        return {"files": files}
    except Exception as e:
        return {"files": [], "error": str(e)}
