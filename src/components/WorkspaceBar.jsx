import React from "react";

export default function WorkspaceBar({
  workspaceName,
  setWorkspaceName,
  workspaces,
  onSave,
  onNew,
  onDelete,
  onLoad,
  onFitAll,
  cardsExist,
  onOpenScheduler,
}) {
  return (
    <div className="workspace-bar">
      <input
        className="workspace-input"
        placeholder="Workspace name"
        value={workspaceName}
        onChange={(e) => setWorkspaceName(e.target.value)}
      />

      {/* Save */}
      <button
        type="button"
        className="icon-btn icon-btn-primary"
        onClick={onSave}
        title="Save Workspace"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      </button>

      {/* New */}
      <button
        type="button"
        className="icon-btn"
        onClick={onNew}
        title="New Workspace"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </button>

      {/* Delete */}
      <button
        type="button"
        className="icon-btn icon-btn-danger"
        onClick={onDelete}
        disabled={!workspaceName}
        title="Delete Workspace"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>

      {/* Open saved */}
      <select
        onChange={(e) => { if (e.target.value) onLoad(e.target.value); }}
        value=""
      >
        <option value="">Open saved</option>
        {workspaces.map((w) => (
          <option key={w} value={w}>{w}</option>
        ))}
      </select>

      {/* Fit All */}
      <button
        type="button"
        className="icon-btn"
        onClick={onFitAll}
        disabled={!cardsExist}
        title="Reposition all tables to fit in the visible canvas"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>

      {/* Scheduler */}
      <button
        type="button"
        className="icon-btn"
        onClick={onOpenScheduler}
        title="Open Scheduler"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>
    </div>
  );
}
