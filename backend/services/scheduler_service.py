import os
import json
import datetime
import csv

from config import JOB_LOG_FILE


def read_logs() -> list:
    """Read job execution logs from the JSON log file."""
    if not os.path.exists(JOB_LOG_FILE):
        return []
    try:
        with open(JOB_LOG_FILE) as f:
            return json.load(f)
    except Exception:
        return []


def write_log(entry: dict):
    """Append a job execution log entry (keeps last 500)."""
    logs = read_logs()
    logs.insert(0, entry)
    logs = logs[:500]
    try:
        with open(JOB_LOG_FILE, "w") as f:
            json.dump(logs, f)
    except Exception as e:
        print(f"[Scheduler] Failed to write log: {e}")


def run_scheduled_job(
    job_id: str,
    job_name: str,
    sql: str,
    limit: int,
    action: str,
    output_dir: str,
):
    """
    Core scheduled-job function invoked by APScheduler.

    action = "execute"  → runs query, logs row count only.
    action = "download" → runs query AND saves results as a CSV file.
    """
    # Local imports to avoid circular issues and keep APScheduler happy
    from hive_query import execute_query as _execute_query

    started_at = datetime.datetime.utcnow().isoformat()
    saved_file = None

    try:
        all_rows = _execute_query(sql, limit, include_header=True)
        row_count = max(0, len(all_rows) - 1) if all_rows else 0

        if action == "download" and all_rows:
            os.makedirs(output_dir, exist_ok=True)
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = "".join(
                c if c.isalnum() or c in "-_" else "_" for c in job_name
            )
            filename = f"{safe_name}_{timestamp}.csv"
            filepath = os.path.join(output_dir, filename)
            with open(filepath, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerows(all_rows)
            saved_file = filepath

        log_entry = {
            "job_id": job_id,
            "job_name": job_name,
            "started_at": started_at,
            "completed_at": datetime.datetime.utcnow().isoformat(),
            "status": "success",
            "row_count": row_count,
            "action": action,
            "output_file": saved_file,
            "error": None,
        }

    except Exception as e:
        log_entry = {
            "job_id": job_id,
            "job_name": job_name,
            "started_at": started_at,
            "completed_at": datetime.datetime.utcnow().isoformat(),
            "status": "error",
            "row_count": 0,
            "action": action,
            "output_file": None,
            "error": str(e),
        }
        print(f"[Scheduler] Job '{job_name}' failed: {e}")

    write_log(log_entry)
