import subprocess

HIVE_URL = (
    "jdbc:hive2://dwhcdpdevmstr1.nseroot.com:2181,"
    "dwhcdpdevmstr2.nseroot.com:2181,"
    "dwhcdpdevutl1.nseroot.com:2181"
)

def run_beeline(sql: str):
    cmd = [
        "/home/cdpadmin/hadoop-clients/apache-hive-beeline-3.1.3000.2024.0.17.0-25/bin/beeline",
        "-u", HIVE_URL,
        "--silent=true",
        "--showHeader=false",
        "--outputformat=tsv2",
        "-e", sql
    ]

    output = subprocess.check_output(
        cmd,
        stderr=subprocess.STDOUT,
        universal_newlines=True
    )

    lines = []
    for line in output.splitlines():
        line = line.strip()

        # Ignore Hadoop warning
        if line.startswith("HADOOP_HOME not set"):
            continue

        lines.append(line)

    return lines


def get_databases():
    return run_beeline("show databases")


def get_tables(db: str):
    return run_beeline(f"use {db}; show tables")


def get_columns(db: str, table: str):
    output = run_beeline(f"describe {db}.{table}")
    cols = []

    for line in output:
        parts = line.split()
        if parts and not parts[0].startswith("#"):
            cols.append(parts[0])

    return cols
