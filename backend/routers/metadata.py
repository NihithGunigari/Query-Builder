from fastapi import APIRouter
from typing import Optional
from hive import get_databases, get_tables, get_columns

router = APIRouter()

# ── Simple in-memory cache ──
CACHE: dict = {}


@router.get("/databases")
def databases():
    if "databases" not in CACHE:
        CACHE["databases"] = get_databases()
    return {"databases": CACHE["databases"]}


@router.get("/tables")
def tables(db: str):
    key = f"tables::{db}"
    if key not in CACHE:
        CACHE[key] = get_tables(db)
    return {"tables": CACHE[key]}


@router.get("/columns")
def columns(db: str, table: str):
    key = f"columns::{db}.{table}"
    if key not in CACHE:
        CACHE[key] = get_columns(db, table)
    return {"columns": CACHE[key]}


@router.post("/cache/clear")
def clear_cache(db: Optional[str] = None):
    if db:
        CACHE.pop(f"tables::{db}", None)
        for k in [k for k in CACHE if k.startswith(f"columns::{db}.")]:
            CACHE.pop(k, None)
        return {"status": "db cache cleared", "db": db}
    CACHE.clear()
    return {"status": "full cache cleared"}
