import os

# Hive JDBC URL (used by hive.py / hive_query.py)
HIVE_URL = (
    "jdbc:hive2://dwhcdpdevmstr1.nseroot.com:2181,"
    "dwhcdpdevmstr2.nseroot.com:2181,"
    "dwhcdpdevutl1.nseroot.com:2181"
)

# Beeline binary path
BEELINE_BIN = (
    "/home/cdpadmin/hadoop-clients/"
    "apache-hive-beeline-3.1.3000.2024.0.17.0-25/bin/beeline"
)

# Workspace file storage
WORKSPACE_DIR = "/mnt/appln/dnd_react/workspace"
os.makedirs(WORKSPACE_DIR, exist_ok=True)

# Scheduler
SCHEDULER_DB_URL = "sqlite:////mnt/appln/dnd_react/scheduler_jobs.db"
JOB_LOG_FILE = "/mnt/appln/dnd_react/scheduler_logs.json"
SCHEDULED_OUTPUT_DIR = "/mnt/appln/dnd_react/scheduled_outputs"
os.makedirs(SCHEDULED_OUTPUT_DIR, exist_ok=True)
