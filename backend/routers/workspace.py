from fastapi import APIRouter
from config import WORKSPACE_DIR
import os
import json

router = APIRouter(prefix="/api/workspace")


@router.post("/save")
def save_workspace(payload: dict):
    name = payload.get("name")
    cards = payload.get("cards")
    joins = payload.get("joins", [])

    if not name or cards is None:
        return {"error": "name and cards required"}

    path = os.path.join(WORKSPACE_DIR, f"{name}.json")
    with open(path, "w") as f:
        json.dump({"cards": cards, "joins": joins}, f)
    return {"saved": True}


@router.get("/load/{name}")
def load_workspace(name: str):
    path = os.path.join(WORKSPACE_DIR, f"{name}.json")
    if not os.path.exists(path):
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading workspace {name}: {e}")
        return {}


@router.get("/list")
def list_workspaces():
    try:
        files = [
            f.replace(".json", "")
            for f in os.listdir(WORKSPACE_DIR)
            if f.endswith(".json")
        ]
        return {"workspaces": files}
    except Exception as e:
        print(f"Error listing workspaces: {e}")
        return {"workspaces": []}


@router.delete("/delete/{name}")
def delete_workspace(name: str):
    path = os.path.join(WORKSPACE_DIR, f"{name}.json")
    if os.path.exists(path):
        os.remove(path)
        return {"deleted": True}
    return {"error": "Workspace not found"}
