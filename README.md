# Visual Query Builder — Refactored Modular Structure

## Why This Refactoring?

| Before | After |
|--------|-------|
| `app.js` — 4,021 lines (everything in one file) | `app.js` — 416 lines (slim coordinator) |
| `app.py` — 530 lines (all routes in one file) | `app.py` — 54 lines (mounts 4 routers) |
| `app.css` — 1,506 lines (one massive stylesheet) | `app.css` — 19 lines (imports 10 partials) |

Every bug now lives in a **named, focused file** you can find immediately.

---

## Frontend Structure (`frontend/src/`)

### Entry Point
- **`app.js`** — Slim coordinator. Imports hooks + components, wires them together. No inline JSX logic.
- **`app.css`** — Master stylesheet, imports all CSS partials.
- **`constants.js`** — All layout magic numbers (card dimensions, row heights, etc.).
- **`api.js`** — Axios API client (unchanged).
- **`index.js`** — React DOM mount point (unchanged).

### Components (`components/`)
Each file = one visual piece of the UI.

| File | Purpose | Lines |
|------|---------|-------|
| `SearchableSelect.jsx` | Reusable filterable dropdown | 46 |
| `Sidebar.jsx` | Left panel: DB + table lists, search, user footer | 137 |
| `WorkspaceBar.jsx` | Toolbar: save/load/delete workspace, fit-all, scheduler | 116 |
| `JoinsLayer.jsx` | SVG join lines + marker definitions | 198 |
| `TableCard.jsx` | Draggable card with column checkboxes + join arrows | 248 |
| `ConditionPanel.jsx` | Right panel: WHERE, Aggregates, Group By, Having, Order By | 551 |
| `QueryPanel.jsx` | Bottom panel: query display, editor, run, results | 218 |
| `ResultTable.jsx` | HTML table for query results | 49 |
| `BarChart.jsx` | SVG bar chart + `canShowBarChart()` utility | 137 |
| `SchedulerModal.jsx` | Full scheduler modal with 4 tabs | 450 |

### Hooks (`hooks/`)
Each file = one piece of state logic.

| File | What It Manages | Status |
|------|----------------|--------|
| `useSidebarData.js` | DB/table fetching, refresh | Unchanged |
| `useCards.js` | Card drag, resize, add, remove | Unchanged |
| `useQueryBuilder.js` | SQL generation + parsing | Unchanged |
| `useJoins.js` | Join state, drag/click connections, cycle types | **NEW** |
| `useWorkspace.js` | Workspace CRUD, card sanitization on load | **NEW** |
| `useQueryExecution.js` | Run query, CSV download, clear results | **NEW** |
| `useSelection.js` | Drag-to-select rectangle, multi-select resize | **NEW** |

### Styles (`styles/`)
Each file = styles for one area of the UI.

| File | Styles For |
|------|-----------|
| `base.css` | Reset, body, typography |
| `header.css` | App header bar |
| `sidebar.css` | Left panel |
| `workspace.css` | Workspace toolbar |
| `icon-buttons.css` | Icon buttons + tooltips + color variants |
| `canvas.css` | Canvas grid, joins layer, selection rectangle |
| `cards.css` | Table cards, column rows, connector arrows |
| `query-panel.css` | Bottom panel, result table, bar chart, editor |
| `condition-panel.css` | Right panel sections (WHERE/Agg/Group/Having/Order) |
| `scheduler.css` | Scheduler modal, tabs, forms, tables, badges |

---

## Backend Structure (`backend/`)

### Entry Point
- **`app.py`** — FastAPI app setup, CORS, mounts all routers, scheduler lifecycle.
- **`config.py`** — Centralized paths (workspace dir, scheduler DB, output dir).

### Routers (`routers/`)
Each file = one group of API endpoints.

| File | Endpoints |
|------|-----------|
| `metadata.py` | `GET /databases`, `GET /tables`, `GET /columns`, `POST /cache/clear` |
| `query.py` | `POST /api/query/execute`, `POST /api/query/download` |
| `workspace.py` | `POST /api/workspace/save`, `GET /load/{name}`, `GET /list`, `DELETE /delete/{name}` |
| `scheduler.py` | `POST /api/scheduler/add`, `GET /list`, `DELETE /delete/{id}`, `POST /pause/{id}`, `POST /resume/{id}`, `POST /run-now/{id}`, `GET /logs`, `GET /files` |

### Services (`services/`)
- **`scheduler_service.py`** — `run_scheduled_job()` function + `read_logs()` / `write_log()` helpers. Must stay at module level for APScheduler pickling.

### Unchanged
- **`hive.py`** — Beeline wrapper for metadata queries.
- **`hive_query.py`** — Beeline wrapper for user SQL execution.

---

## Migration Guide

### Frontend
1. Copy the entire `frontend/src/` structure into your React project's `src/` folder.
2. The existing `hooks/useSidebarData.js`, `hooks/useCards.js`, and `hooks/useQueryBuilder.js` are unchanged — they already use the correct import paths.
3. If your bundler doesn't support CSS `@import`, concatenate the CSS partials in the order listed in `app.css`, or use a PostCSS plugin.

### Backend
1. Copy the `backend/` contents to your server.
2. Ensure `hive.py` and `hive_query.py` are in the same directory as `app.py`.
3. Run: `uvicorn app:app --host 0.0.0.0 --port 8000 --reload`

### No API Changes
All API endpoints remain identical. The frontend `api.js` is unchanged. This is a **pure structural refactor** — no functionality was added or removed.
