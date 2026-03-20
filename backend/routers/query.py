from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from hive_query import execute_query
import csv
import io

router = APIRouter(prefix="/api/query")


@router.post("/execute")
def execute_query_api(payload: dict):
    sql = payload.get("sql")
    limit = payload.get("limit", 1000)

    if not sql:
        return {"error": "SQL is required", "rows": [], "rowCount": 0, "columns": []}

    try:
        all_rows = execute_query(sql, limit, include_header=True)
        if not all_rows:
            return {"rows": [], "rowCount": 0, "columns": []}

        columns = all_rows[0]
        rows = all_rows[1:]
        return {"rows": rows, "rowCount": len(rows), "columns": columns}
    except Exception as e:
        return {"error": str(e), "rows": [], "rowCount": 0, "columns": []}


@router.post("/download")
def download_query_api(payload: dict):
    sql = payload.get("sql")
    limit = payload.get("limit", 5000)

    if not sql:
        return {"error": "SQL is required"}

    try:
        rows = execute_query(sql, limit, include_header=True)
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerows(rows)
        stream.seek(0)

        response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = "attachment; filename=query_results.csv"
        return response
    except Exception as e:
        return {"error": str(e)}
