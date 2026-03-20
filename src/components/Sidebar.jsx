import React from "react";

export default function Sidebar({
  // From useSidebarData hook
  databases,
  tables,
  selectedDb,
  dbLoading,
  tableLoading,
  selectDb,
  refreshAllDbs,
  refreshTables,
  // Search terms (managed in App)
  dbTerm,
  setDbTerm,
  tableTerm,
  setTableTerm,
  // Callback when a table is clicked to add a card
  onTableClick,
  // Sidebar collapse state
  collapsed,
}) {
  const filteredDbs = databases.filter((db) =>
    db.toLowerCase().includes(dbTerm.toLowerCase())
  );
  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(tableTerm.toLowerCase())
  );

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* ──────── DATABASES ──────── */}
      <div className="sidebar-section">
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <h3>Databases</h3>
            <button
              className="icon-btn"
              onClick={refreshAllDbs}
              disabled={dbLoading}
              title="Refresh Databases"
            >
              {dbLoading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" strokeDasharray="30 10" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              )}
            </button>
          </div>
          <input
            type="text"
            className="sidebar-search"
            placeholder="Search DB..."
            value={dbTerm}
            onChange={(e) => setDbTerm(e.target.value)}
          />
        </div>
        <div className="sidebar-list">
          {!dbLoading &&
            filteredDbs.map((db) => (
              <div
                key={db}
                className={db === selectedDb ? "active" : ""}
                onClick={() => selectDb(db)}
              >
                {db}
              </div>
            ))}
        </div>
      </div>

      {/* ──────── TABLES ──────── */}
      <div className="sidebar-section">
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <h3>Tables</h3>
            <button
              className="icon-btn"
              onClick={refreshTables}
              disabled={!selectedDb || tableLoading}
              title="Refresh Tables"
            >
              {tableLoading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" strokeDasharray="30 10" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              )}
            </button>
          </div>
          <input
            type="text"
            className="sidebar-search"
            placeholder="Search Table..."
            value={tableTerm}
            onChange={(e) => setTableTerm(e.target.value)}
            disabled={!selectedDb}
          />
        </div>
        <div className="sidebar-list">
          {!tableLoading &&
            filteredTables.map((t) => (
              <div key={t} onClick={() => onTableClick(t)}>
                {t}
              </div>
            ))}
        </div>
      </div>

      {/* ──────── USER FOOTER ──────── */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">U</div>
          <div>
            <div style={{ fontWeight: "bold" }}>User Name</div>
            <div style={{ opacity: 0.7 }}>user@nseroot.com</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
