import React from "react";
import ResultTable from "./ResultTable";
import BarChart, { canShowBarChart } from "./BarChart";
import { MIN_RESULT_HEIGHT } from "../constants";

export default function QueryPanel({
  // Layout
  bottomCollapsed,
  setBottomCollapsed,
  resultHeight,
  setResultHeight,
  maxResultHeight,
  // Query state
  displayQuery,
  customQuery,
  setCustomQuery,
  isEditingQuery,
  queryResult,
  queryLoading,
  queryError,
  isResultsCleared,
  showGraph,
  setShowGraph,
  // Callbacks
  handleClearResults,
  handleDownloadResults,
  handleEditSaveToggle,
  runQuery,
  handleCreateQuery,
  resolveColumnName,
  applyQueryToDesign,
  liveEditDebounceRef,
}) {
  const canShowGraph = canShowBarChart(queryResult);

  return (
    <div
      className={`result-container ${bottomCollapsed ? "collapsed" : ""}`}
      style={{
        height: bottomCollapsed ? 36 : resultHeight,
        borderTop: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fff",
        zIndex: 20,
      }}
    >
      {/* ── Resize handle ── */}
      <div
        className="result-resize-handle"
        style={{ cursor: "ns-resize", height: "4px", background: "#ddd" }}
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = resultHeight;
          const onMove = (ev) => setResultHeight(Math.min(maxResultHeight, Math.max(MIN_RESULT_HEIGHT, startH - (ev.clientY - startY))));
          const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />

      {/* ── Toolbar ── */}
      <div className="result-header">
        <span>Results</span>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Clear */}
          <button className="icon-btn" onClick={handleClearResults}
            disabled={isResultsCleared || (!queryResult && !displayQuery && !queryError)}
            title="Clear Results"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </button>

          {/* Download */}
          <button className="icon-btn icon-btn-green" onClick={handleDownloadResults}
            disabled={!queryResult || queryLoading || isResultsCleared}
            title="Download CSV"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Graph toggle */}
          <button
            className={`icon-btn ${showGraph ? "icon-btn-orange" : ""}`}
            onClick={() => setShowGraph((prev) => !prev)}
            disabled={!canShowGraph || isResultsCleared}
            title={!canShowGraph ? "Graph requires exactly 2 columns (1 numeric)" : showGraph ? "Hide Graph" : "Show Bar Graph"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
            </svg>
          </button>

          {/* Edit / Save toggle */}
          <button
            className={`icon-btn ${isEditingQuery ? "icon-btn-orange" : ""}`}
            onClick={handleEditSaveToggle}
            title={isEditingQuery ? "Save Query" : "Edit Query"}
          >
            {isEditingQuery ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            )}
          </button>

          {/* Run */}
          <button className="icon-btn icon-btn-primary" onClick={runQuery}
            disabled={!displayQuery || queryLoading}
            title={queryLoading ? "Running..." : "Run Query"}
          >
            {queryLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" strokeDasharray="30 10" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          {/* Create Query */}
          <button className="icon-btn" onClick={handleCreateQuery} title="Create Query">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
          </button>

          {/* Collapse / Expand */}
          <button className="icon-btn" onClick={() => setBottomCollapsed(!bottomCollapsed)}
            title={bottomCollapsed ? "Expand Results" : "Collapse Results"}
          >
            {bottomCollapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {!bottomCollapsed && (
        <div className="result-body" style={{ flex: 1, overflow: "auto" }}>
          {isResultsCleared ? (
            <div style={{ padding: "20px", color: "#999", textAlign: "center", fontStyle: "italic" }}>
              Results panel cleared. Create or Run a query to see data.
            </div>
          ) : (
            <>
              {isEditingQuery ? (
                <textarea
                  className="query-editor"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  onKeyUp={(e) => {
                    if (e.key === "," || e.key === ";") {
                      const currentSql = e.target.value;
                      if (liveEditDebounceRef.current) clearTimeout(liveEditDebounceRef.current);
                      liveEditDebounceRef.current = setTimeout(() => {
                        applyQueryToDesign(currentSql, false);
                      }, 300);
                    }
                  }}
                  placeholder="Paste or type your SQL query here. Design updates automatically when you type a comma or semicolon."
                />
              ) : (
                !queryLoading && !queryResult && (
                  <pre className="query-output">
                    {displayQuery || "-- Click 'Create Query' to generate SQL"}
                  </pre>
                )
              )}

              {queryError && <div className="error" style={{ color: "red", padding: "10px" }}>{queryError}</div>}
              {queryLoading && <div className="loading" style={{ padding: "10px" }}>Running query...</div>}

              {!queryLoading && queryResult && !isEditingQuery ? (
                showGraph && canShowGraph ? (
                  <BarChart queryResult={queryResult} resolveColumnName={resolveColumnName} />
                ) : (
                  <ResultTable queryResult={queryResult} resolveColumnName={resolveColumnName} />
                )
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
