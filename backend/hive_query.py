import subprocess

HIVE_URL = (
    "jdbc:hive2://dwhcdpdevmstr1.nseroot.com:2181,"
    "dwhcdpdevmstr2.nseroot.com:2181,"
    "dwhcdpdevutl1.nseroot.com:2181"
)

def run_beeline(sql: str, include_header: bool = False):
    # Determine header setting string
    header_str = "true" if include_header else "false"

    cmd = [
        "/home/cpadmin/hadoop-clients/apache-hive-beeline-3.1.3000.2024.0.17.0-25/bin/beeline",
        "-u", HIVE_URL,
        "--silent=true",
        f"--showHeader={header_str}",
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
        # Ignore empty lines
        if not line:
            continue

        lines.append(line)

    return lines


def execute_query(sql: str, limit: int = 10, include_header: bool = False):
    clean_sql = sql.strip().rstrip(";")

    # 🔒 Add LIMIT only if user didn't specify
    if "limit" not in clean_sql.lower():
        clean_sql = f"{clean_sql} LIMIT {limit}"

    lines = run_beeline(clean_sql, include_header=include_header)

    if not lines:
        return []

    rows = [line.split("\t") for line in lines]
    return rows