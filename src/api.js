import axios from "axios";

// CHANGE this to your actual backend IP/Port
const API_BASE = "http://dwhcdpdevapp1.nseroot.com:8000";

/* --- Database & Table Metadata --- */
export const getDatabases = async () => {
  const res = await axios.get(`${API_BASE}/databases`);
  return res.data.databases;
};

export const getTables = async (db) => {
  const res = await axios.get(`${API_BASE}/tables`, { params: { db } });
  return res.data.tables;
};

export const getColumns = async (db, table) => {
  const res = await axios.get(`${API_BASE}/columns`, { params: { db, table } });
  return res.data.columns;
};

/* --- Cache Management --- */
export const clearAllCache = async () => {
  await axios.post(`${API_BASE}/cache/clear`);
};

export const clearDbCache = async (db) => {
  await axios.post(`${API_BASE}/cache/clear`, null, { params: { db } });
};

/* --- Query Execution & Download --- */
export const executeQuery = async (sql, limit = 1000) => {
  const res = await axios.post(`${API_BASE}/api/query/execute`, { sql, limit });
  return res.data;
};

export const downloadQueryResults = async (sql) => {
  const res = await axios.post(
    `${API_BASE}/api/query/download`, 
    { sql, limit: 5000 }, 
    { responseType: 'blob' } // Important: treat response as binary file
  );
  return res.data;
};

/* --- Workspace Management --- */
export const saveWorkspace = async (name, cards, joins = []) => {
  const res = await axios.post(`${API_BASE}/api/workspace/save`, { name, cards, joins });
  return res.data;
};

export const loadWorkspace = async (name) => {
  const res = await axios.get(`${API_BASE}/api/workspace/load/${name}`);
  return res.data;
};

export const listWorkspaces = async () => {
  const res = await axios.get(`${API_BASE}/api/workspace/list`);
  return res.data;
};

export const deleteWorkspace = async (name) => {
  const res = await axios.delete(`${API_BASE}/api/workspace/delete/${name}`);
  return res.data;
};

/* --- Scheduler Management --- */

/**
 * Add a new scheduled job.
 * @param {Object} schedule
 * @param {string} schedule.name           - Human-readable label
 * @param {string} schedule.sql            - SQL query to run
 * @param {number} schedule.limit          - Row limit (default 1000)
 * @param {string} schedule.action         - "execute" | "download"
 * @param {string} schedule.schedule_type  - "once" | "interval" | "cron"
 * @param {string} [schedule.run_at]       - ISO datetime (required for once)
 * @param {number} [schedule.interval_minutes] - Minutes between runs (for interval)
 * @param {string} [schedule.cron]         - 5-part cron expression (for cron)
 * @param {string} [schedule.output_dir]   - Server path to save CSVs (optional)
 */
export const addSchedule = async (schedule) => {
  const res = await axios.post(`${API_BASE}/api/scheduler/add`, schedule);
  return res.data;
};

/**
 * Return all scheduled jobs with status and next run time.
 */
export const listSchedules = async () => {
  const res = await axios.get(`${API_BASE}/api/scheduler/list`);
  return res.data; // { jobs: [...] }
};

/**
 * Permanently delete a scheduled job.
 * @param {string} jobId
 */
export const deleteSchedule = async (jobId) => {
  const res = await axios.delete(`${API_BASE}/api/scheduler/delete/${jobId}`);
  return res.data;
};

/**
 * Pause a scheduled job (stops future runs without deleting it).
 * @param {string} jobId
 */
export const pauseSchedule = async (jobId) => {
  const res = await axios.post(`${API_BASE}/api/scheduler/pause/${jobId}`);
  return res.data;
};

/**
 * Resume a previously paused scheduled job.
 * @param {string} jobId
 */
export const resumeSchedule = async (jobId) => {
  const res = await axios.post(`${API_BASE}/api/scheduler/resume/${jobId}`);
  return res.data;
};

/**
 * Trigger a scheduled job to run immediately (does not change its future schedule).
 * @param {string} jobId
 */
export const runScheduleNow = async (jobId) => {
  const res = await axios.post(`${API_BASE}/api/scheduler/run-now/${jobId}`);
  return res.data;
};

/**
 * Fetch job execution history / logs.
 * @param {string} [jobId] - Optional: filter logs for a specific job
 * @param {number} [limit] - Max number of log entries to return
 */
export const getSchedulerLogs = async (jobId = null, limit = 100) => {
  const params = { limit };
  if (jobId) params.job_id = jobId;
  const res = await axios.get(`${API_BASE}/api/scheduler/logs`, { params });
  return res.data; // { logs: [...] }
};

/**
 * List CSV files produced by scheduled download jobs.
 */
export const listScheduledFiles = async () => {
  const res = await axios.get(`${API_BASE}/api/scheduler/files`);
  return res.data; // { files: [...] }
};