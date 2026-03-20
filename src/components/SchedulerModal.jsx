import React, { useState, useEffect } from "react";
import {
  addSchedule,
  listSchedules,
  deleteSchedule,
  pauseSchedule,
  resumeSchedule,
  runScheduleNow,
  getSchedulerLogs,
  listScheduledFiles,
} from "../api";

/* ── constants ── */
const SCHEDULE_TYPES = [
  { value: "interval", label: "Interval (repeat every N minutes)" },
  { value: "cron",     label: "Cron Expression (advanced)" },
  { value: "once",     label: "One-Time (run at a specific date/time)" },
];

const ACTION_TYPES = [
  { value: "execute",  label: "Execute Only (log result)" },
  { value: "download", label: "Execute & Save CSV to Server" },
];

const CRON_PRESETS = [
  { label: "Every hour",              value: "0 * * * *" },
  { label: "Every day at 8 AM (UTC)", value: "0 8 * * *" },
  { label: "Every weekday at 9 AM",   value: "0 9 * * 1-5" },
  { label: "Every Monday at 7 AM",    value: "0 7 * * 1" },
  { label: "Every 30 minutes",        value: "*/30 * * * *" },
];

/* ── formatters ── */
const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const fmtBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

/* =================================================================== */
export default function SchedulerModal({
  isOpen,
  onClose,
  currentQuery,
  workspaces = [],
  onLoadWorkspaceQuery,
}) {
  const [activeTab, setActiveTab] = useState("create");

  /* ── Create-form state ── */
  const [form, setForm] = useState({
    name: "", sql: "", limit: 1000, action: "execute",
    scheduleType: "interval", runAt: "", intervalMinutes: 60, cron: "0 8 * * *",
  });

  /* ── SQL Source state ── */
  const [sqlSource, setSqlSource] = useState("current");
  const [selectedWsName, setSelectedWsName] = useState("");
  const [wsLoading, setWsLoading] = useState(false);
  const [wsLoadedName, setWsLoadedName] = useState("");

  /* ── Data state ── */
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  /* ── Effects ── */
  useEffect(() => {
    if (isOpen) {
      loadJobs(); loadLogs(); loadFiles();
      if (currentQuery) {
        setSqlSource("current");
        setForm((prev) => ({ ...prev, sql: currentQuery }));
      } else {
        setSqlSource(workspaces.length > 0 ? "workspace" : "manual");
      }
      setSelectedWsName(""); setWsLoadedName("");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sqlSource === "current") setForm((prev) => ({ ...prev, sql: currentQuery || "" }));
  }, [sqlSource, currentQuery]);

  /* ── Data loaders ── */
  const loadJobs  = async () => { try { const r = await listSchedules(); setJobs(r.jobs || []); } catch (e) { console.error(e); } };
  const loadLogs  = async () => { try { const r = await getSchedulerLogs(null, 200); setLogs(r.logs || []); } catch (e) { console.error(e); } };
  const loadFiles = async () => { try { const r = await listScheduledFiles(); setFiles(r.files || []); } catch (e) { console.error(e); } };

  const showMsg = (text, type = "ok") => { setMsg({ text, type }); setTimeout(() => setMsg({ text: "", type: "" }), 4000); };

  /* ── Workspace SQL loader ── */
  const handleLoadFromWorkspace = async () => {
    if (!selectedWsName) { showMsg("Please select a workspace first.", "err"); return; }
    if (!onLoadWorkspaceQuery) { showMsg("Workspace query loader is not available.", "err"); return; }
    setWsLoading(true);
    try {
      const sql = await onLoadWorkspaceQuery(selectedWsName);
      if (!sql || !sql.trim()) {
        showMsg(`Workspace "${selectedWsName}" has no saved query. Build and save a query first.`, "err");
      } else {
        setForm((prev) => ({ ...prev, sql: sql.trim() }));
        setWsLoadedName(selectedWsName);
        showMsg(`✓ SQL loaded from workspace "${selectedWsName}".`, "ok");
      }
    } catch (e) { showMsg(`Failed to load workspace: ${e.message}`, "err"); }
    finally { setWsLoading(false); }
  };

  /* ── CRUD handlers ── */
  const handleCreate = async () => {
    if (!form.name.trim())  { showMsg("Please enter a job name.", "err"); return; }
    if (!form.sql.trim())   { showMsg("SQL query is required.", "err"); return; }
    if (form.scheduleType === "once" && !form.runAt) { showMsg("Please select a date/time for the one-time run.", "err"); return; }
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(), sql: form.sql.trim(), limit: Number(form.limit),
        action: form.action, schedule_type: form.scheduleType,
        run_at: form.scheduleType === "once" ? form.runAt : undefined,
        interval_minutes: form.scheduleType === "interval" ? Number(form.intervalMinutes) : undefined,
        cron: form.scheduleType === "cron" ? form.cron : undefined,
      };
      const res = await addSchedule(payload);
      if (res.error) { showMsg(res.error, "err"); return; }
      showMsg(`✓ Job "${form.name}" scheduled (ID: ${res.job_id?.slice(0, 8)}…)`, "ok");
      setForm((prev) => ({ ...prev, name: "" }));
      await loadJobs(); setActiveTab("jobs");
    } catch (e) { showMsg(e.message || "Failed to create schedule.", "err"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (jobId, jobName) => {
    if (!window.confirm(`Delete schedule "${jobName}"?`)) return;
    try { await deleteSchedule(jobId); showMsg(`Deleted "${jobName}".`); await loadJobs(); } catch (e) { showMsg(e.message, "err"); }
  };
  const handlePause  = async (jobId) => { try { await pauseSchedule(jobId); showMsg("Job paused."); await loadJobs(); } catch (e) { showMsg(e.message, "err"); } };
  const handleResume = async (jobId) => { try { await resumeSchedule(jobId); showMsg("Job resumed."); await loadJobs(); } catch (e) { showMsg(e.message, "err"); } };
  const handleRunNow = async (jobId, jobName) => {
    try { await runScheduleNow(jobId); showMsg(`✓ "${jobName}" triggered.`); setTimeout(() => { loadLogs(); loadFiles(); }, 3000); } catch (e) { showMsg(e.message, "err"); }
  };

  if (!isOpen) return null;

  /* ================= RENDER ================= */
  return (
    <div className="sched-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sched-modal">

        {/* HEADER */}
        <div className="sched-header">
          <span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: "middle" }}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Query Scheduler
          </span>
          <button className="sched-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* TABS */}
        <div className="sched-tabs">
          {[
            { id: "create", label: "＋ New Schedule" },
            { id: "jobs", label: `Jobs (${jobs.length})` },
            { id: "logs", label: `Logs (${logs.length})` },
            { id: "files", label: `Output Files (${files.length})` },
          ].map((t) => (
            <button key={t.id}
              className={`sched-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => { setActiveTab(t.id); if (t.id === "jobs") loadJobs(); if (t.id === "logs") loadLogs(); if (t.id === "files") loadFiles(); }}
            >{t.label}</button>
          ))}
        </div>

        {/* MESSAGE BAR */}
        {msg.text && (
          <div className={`sched-msg ${msg.type === "err" ? "sched-msg--err" : "sched-msg--ok"}`}>{msg.text}</div>
        )}

        {/* TAB: CREATE */}
        {activeTab === "create" && (
          <div className="sched-body">
            <div className="sched-form-grid">
              <label className="sched-label">Job Name <span className="sched-req">*</span></label>
              <input className="sched-input" placeholder="e.g. Daily_Sales_Report" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />

              <label className="sched-label">SQL Source <span className="sched-req">*</span></label>
              <div className="sched-sql-source-box">
                <div className="sched-source-toggle">
                  {[
                    { id: "current", icon: "▶", label: "Current Query" },
                    { id: "workspace", icon: "📂", label: "From Workspace" },
                    { id: "manual", icon: "✏", label: "Type Manually" },
                  ].map((s) => (
                    <button key={s.id} type="button"
                      className={`sched-source-pill ${sqlSource === s.id ? "active" : ""}`}
                      onClick={() => setSqlSource(s.id)}
                    >
                      <span className="sched-source-pill-icon">{s.icon}</span> {s.label}
                    </button>
                  ))}
                </div>

                {sqlSource === "current" && (
                  <div className="sched-source-section">
                    {currentQuery ? (
                      <>
                        <div className="sched-ws-info sched-ws-info--ok">✓ Using the query currently open in the editor</div>
                        <pre className="sched-sql-preview">{currentQuery}</pre>
                      </>
                    ) : (
                      <div className="sched-ws-info sched-ws-info--warn">⚠ No query is currently open. Build a query on the canvas first, or choose another source.</div>
                    )}
                  </div>
                )}

                {sqlSource === "workspace" && (
                  <div className="sched-source-section">
                    {workspaces.length === 0 ? (
                      <div className="sched-ws-info sched-ws-info--warn">⚠ No saved workspaces found.</div>
                    ) : (
                      <>
                        <div className="sched-ws-row">
                          <select className="sched-select sched-ws-select" value={selectedWsName}
                            onChange={(e) => { setSelectedWsName(e.target.value); setWsLoadedName(""); }}
                          >
                            <option value="">— Select a workspace —</option>
                            {workspaces.map((w) => <option key={w} value={w}>{w}</option>)}
                          </select>
                          <button type="button" className="sched-ws-load-btn" onClick={handleLoadFromWorkspace} disabled={!selectedWsName || wsLoading}>
                            {wsLoading ? <span className="sched-spinner">⟳</span> : <>📥 Load Query</>}
                          </button>
                        </div>
                        {wsLoadedName && <div className="sched-ws-info sched-ws-info--ok">✓ SQL loaded from workspace <strong>"{wsLoadedName}"</strong></div>}
                        {!wsLoadedName && selectedWsName && <div className="sched-ws-info sched-ws-info--hint">Click "Load Query" to fetch the saved SQL.</div>}
                        {wsLoadedName && form.sql && <pre className="sched-sql-preview">{form.sql}</pre>}
                      </>
                    )}
                  </div>
                )}

                {sqlSource === "manual" && (
                  <div className="sched-source-section">
                    <textarea className="sched-textarea" rows={6} placeholder="Paste or type your SQL query here…"
                      value={form.sql} onChange={(e) => setForm((p) => ({ ...p, sql: e.target.value }))} />
                  </div>
                )}
              </div>

              <label className="sched-label">Row Limit</label>
              <input className="sched-input" type="number" min={1} max={100000} value={form.limit}
                onChange={(e) => setForm((p) => ({ ...p, limit: e.target.value }))} />

              <label className="sched-label">Action</label>
              <select className="sched-select" value={form.action}
                onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))}>
                {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>

              <label className="sched-label">Schedule Type</label>
              <select className="sched-select" value={form.scheduleType}
                onChange={(e) => setForm((p) => ({ ...p, scheduleType: e.target.value }))}>
                {SCHEDULE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              {form.scheduleType === "once" && (<>
                <label className="sched-label">Run At (UTC)</label>
                <input className="sched-input" type="datetime-local" value={form.runAt}
                  onChange={(e) => setForm((p) => ({ ...p, runAt: e.target.value }))} />
              </>)}

              {form.scheduleType === "interval" && (<>
                <label className="sched-label">Every (minutes)</label>
                <input className="sched-input" type="number" min={1} value={form.intervalMinutes}
                  onChange={(e) => setForm((p) => ({ ...p, intervalMinutes: e.target.value }))} />
              </>)}

              {form.scheduleType === "cron" && (<>
                <label className="sched-label">Cron Expression</label>
                <div>
                  <input className="sched-input" placeholder="minute hour day month weekday" value={form.cron}
                    onChange={(e) => setForm((p) => ({ ...p, cron: e.target.value }))} style={{ marginBottom: 6 }} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CRON_PRESETS.map((p) => (
                      <button key={p.value} className="sched-preset-btn"
                        onClick={() => setForm((prev) => ({ ...prev, cron: p.value }))} title={p.value}
                      >{p.label}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                    Format: minute hour day month weekday (all times in UTC)
                  </div>
                </div>
              </>)}
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <button className="sched-create-btn" onClick={handleCreate} disabled={loading}>
                {loading ? "Scheduling…" : "Create Schedule"}
              </button>
              <button className="sched-cancel-btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {/* TAB: JOBS */}
        {activeTab === "jobs" && (
          <div className="sched-body">
            {jobs.length === 0 ? (
              <div className="sched-empty">No scheduled jobs yet.</div>
            ) : (
              <div className="sched-table-wrap">
                <table className="sched-table">
                  <thead><tr><th>Name</th><th>Action</th><th>Trigger</th><th>Next Run (UTC)</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className={job.status === "paused" ? "sched-row-paused" : ""}>
                        <td title={job.id}>
                          <div style={{ fontWeight: 600 }}>{job.name}</div>
                          <div style={{ fontSize: 10, color: "#999" }}>{job.id.slice(0, 8)}…</div>
                        </td>
                        <td>
                          <span className={`sched-badge ${job.action === "download" ? "sched-badge--download" : "sched-badge--execute"}`}>
                            {job.action === "download" ? "⬇ Download" : "▶ Execute"}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, maxWidth: 180, wordBreak: "break-all" }}>{job.trigger}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(job.next_run)}</td>
                        <td>
                          <span className={`sched-badge ${job.status === "paused" ? "sched-badge--paused" : "sched-badge--active"}`}>
                            {job.status === "paused" ? "⏸ Paused" : "● Active"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <button className="sched-action-btn sched-action-btn--run" onClick={() => handleRunNow(job.id, job.name)} title="Run now">▶ Now</button>
                            {job.status === "paused" ? (
                              <button className="sched-action-btn sched-action-btn--resume" onClick={() => handleResume(job.id)}>⏵ Resume</button>
                            ) : (
                              <button className="sched-action-btn sched-action-btn--pause" onClick={() => handlePause(job.id)}>⏸ Pause</button>
                            )}
                            <button className="sched-action-btn sched-action-btn--del" onClick={() => handleDelete(job.id, job.name)}>🗑 Delete</button>
                          </div>
                          {job.sql && (
                            <div style={{ fontSize: 10, color: "#aaa", marginTop: 4, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={job.sql}>
                              {job.sql.substring(0, 60)}{job.sql.length > 60 ? "…" : ""}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className="sched-refresh-btn" onClick={loadJobs}>↻ Refresh</button>
          </div>
        )}

        {/* TAB: LOGS */}
        {activeTab === "logs" && (
          <div className="sched-body">
            {logs.length === 0 ? (
              <div className="sched-empty">No execution logs yet.</div>
            ) : (
              <div className="sched-table-wrap">
                <table className="sched-table">
                  <thead><tr><th>Job Name</th><th>Started At</th><th>Duration</th><th>Status</th><th>Rows</th><th>Action</th><th>Output File</th></tr></thead>
                  <tbody>
                    {logs.map((log, idx) => {
                      const duration = log.started_at && log.completed_at
                        ? `${((new Date(log.completed_at) - new Date(log.started_at)) / 1000).toFixed(1)}s` : "—";
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{log.job_name}</td>
                          <td style={{ fontSize: 12 }}>{fmtDate(log.started_at)}</td>
                          <td style={{ fontSize: 12 }}>{duration}</td>
                          <td>
                            <span className={`sched-badge ${log.status === "success" ? "sched-badge--active" : "sched-badge--error"}`}>
                              {log.status === "success" ? "✓ Success" : "✗ Error"}
                            </span>
                          </td>
                          <td>{log.row_count ?? "—"}</td>
                          <td>
                            <span className={`sched-badge ${log.action === "download" ? "sched-badge--download" : "sched-badge--execute"}`}>
                              {log.action === "download" ? "⬇ Download" : "▶ Execute"}
                            </span>
                          </td>
                          <td style={{ fontSize: 11 }}>
                            {log.output_file
                              ? <span title={log.output_file} style={{ color: "#2980b9" }}>{log.output_file.split("/").pop()}</span>
                              : log.error
                              ? <span style={{ color: "#e74c3c" }} title={log.error}>{log.error.substring(0, 60)}{log.error.length > 60 ? "…" : ""}</span>
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button className="sched-refresh-btn" onClick={loadLogs}>↻ Refresh</button>
          </div>
        )}

        {/* TAB: FILES */}
        {activeTab === "files" && (
          <div className="sched-body">
            {files.length === 0 ? (
              <div className="sched-empty">No output CSV files yet.</div>
            ) : (
              <div className="sched-table-wrap">
                <table className="sched-table">
                  <thead><tr><th>Filename</th><th>Size</th><th>Created</th></tr></thead>
                  <tbody>
                    {files.map((f, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{f.filename}</td>
                        <td style={{ fontSize: 12 }}>{fmtBytes(f.size_bytes)}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(f.modified)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className="sched-refresh-btn" onClick={loadFiles}>↻ Refresh</button>
          </div>
        )}
      </div>
    </div>
  );
}
