import React from "react";
import { COLLAPSED_HEIGHT } from "../constants";

export default function TableCard({
  card,
  activeCardId,
  selectedCardIds,
  pendingConnection,
  joins,
  // Callbacks
  bringToFront,
  startDrag,
  toggleCardCollapse,
  handleRemoveCard,
  setCards,
  startResize,
  handleArrowClick,
  handleDotMouseDown,
  handleDotMouseUp,
}) {
  // Columns involved in joins (float to top)
  const joinedColsForCard = joins.reduce((acc, j) => {
    if (j.leftTableId === card.id && !acc.includes(j.leftCol)) acc.push(j.leftCol);
    if (j.rightTableId === card.id && !acc.includes(j.rightCol)) acc.push(j.rightCol);
    return acc;
  }, []);

  const allFilteredColumns = (card.columns || []).filter((c) =>
    c.toLowerCase().includes((card.searchTerm || "").toLowerCase())
  );

  // Sort: joined → selected (non-joined) → rest
  const selectedSet = new Set(card.selectedColumns || []);
  const joinedSet = new Set(joinedColsForCard);
  const filteredColumns = [
    ...allFilteredColumns.filter((c) => joinedSet.has(c)),
    ...allFilteredColumns.filter((c) => !joinedSet.has(c) && selectedSet.has(c)),
    ...allFilteredColumns.filter((c) => !joinedSet.has(c) && !selectedSet.has(c)),
  ];

  return (
    <div
      className={`table-card ${activeCardId === card.id ? "active" : ""} ${
        selectedCardIds.has(card.id) ? "selected" : ""
      } ${card.selectAll ? "select-all-active" : ""}`}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.isCollapsed ? COLLAPSED_HEIGHT : card.height,
        zIndex: card.zIndex + 10,
        position: "absolute",
      }}
      onMouseDown={() => bringToFront(card.id)}
    >
      {/* ──── HEADER ──── */}
      <div
        className="table-card-header"
        onMouseDown={(e) => startDrag(e, card.id, selectedCardIds)}
      >
        <span className="table-title">
          {card.db}.{card.table}
          {card.selectedColumns && card.selectedColumns.length > 0 && (
            <span className="card-selected-count" title={`${card.selectedColumns.length} column(s) selected`}>
              {" "}({card.selectedColumns.length} selected)
            </span>
          )}
        </span>
        <div className="card-actions">
          <button className="card-toggle-btn" onClick={() => toggleCardCollapse(card.id)}>
            {card.isCollapsed ? "▼" : "▲"}
          </button>
          <button className="card-close-btn" onClick={() => handleRemoveCard(card.id)}>
            ×
          </button>
        </div>
      </div>

      {/* ──── EXPANDED BODY ──── */}
      {!card.isCollapsed && (
        <>
          {/* Search */}
          <div className="card-search-container">
            <input
              type="text"
              className="card-search"
              placeholder="Search columns..."
              value={card.searchTerm || ""}
              onChange={(e) =>
                setCards((prev) =>
                  prev.map((c) =>
                    c.id === card.id ? { ...c, searchTerm: e.target.value } : c
                  )
                )
              }
            />
          </div>

          <div className="table-card-body">
            {/* SELECT ALL */}
            <div className="column-row select-all-row" key="__select_all__">
              <div className="connector-arrow connector-arrow-left" style={{ visibility: "hidden" }}>&#8249;</div>
              <label style={{ padding: "0 8px", fontWeight: "bold", color: "#2c3e50" }}>
                <input
                  type="checkbox"
                  checked={card.selectAll === true}
                  onChange={() =>
                    setCards((prev) =>
                      prev.map((cd) =>
                        cd.id === card.id
                          ? {
                              ...cd,
                              selectAll: !cd.selectAll,
                              selectedColumns: !cd.selectAll ? [] : cd.selectedColumns,
                              columnSelectOrder: !cd.selectAll ? {} : cd.columnSelectOrder,
                            }
                          : cd
                      )
                    )
                  }
                />
                <span style={{ marginLeft: 6 }}>Select All (*)</span>
              </label>
              <div className="connector-arrow connector-arrow-right" style={{ visibility: "hidden" }}>&#8250;</div>
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "#e0e0e0", margin: "2px 0 4px 0" }} />

            {/* Column rows */}
            {filteredColumns.map((c) => (
              <div className="column-row" key={c}>
                {/* LEFT ARROW */}
                <div
                  className={`connector-arrow connector-arrow-left${
                    pendingConnection && pendingConnection.cardId === card.id && pendingConnection.column === c && pendingConnection.side === "left"
                      ? " active"
                      : pendingConnection && pendingConnection.cardId !== card.id
                      ? " joinable"
                      : ""
                  }`}
                  onClick={(e) => handleArrowClick(e, card.id, c, "left")}
                  title={
                    pendingConnection
                      ? pendingConnection.cardId === card.id
                        ? "Click again to cancel"
                        : `Join to ${pendingConnection.column} (click to connect)`
                      : "Click to start a join from this column"
                  }
                >
                  &#8249;
                </div>

                {/* Hidden dot (backwards compat) */}
                <div
                  className="connector-dot"
                  style={{ display: "none" }}
                  onMouseDown={(e) => handleDotMouseDown(e, card.id, c, "left")}
                  onMouseUp={(e) => handleDotMouseUp(e, card.id, c, "left")}
                  title="Drag to connect"
                />

                {/* Checkbox + label */}
                <label style={{ padding: "0 8px" }}>
                  <input
                    type="checkbox"
                    checked={(card.selectedColumns || []).includes(c)}
                    onChange={() =>
                      setCards((prev) =>
                        prev.map((cd) =>
                          cd.id === card.id
                            ? (() => {
                                const isChecked = cd.selectedColumns.includes(c);
                                const newSelectedColumns = isChecked
                                  ? cd.selectedColumns.filter((x) => x !== c)
                                  : [...cd.selectedColumns, c];

                                const newOrder = { ...(cd.columnSelectOrder || {}) };
                                if (isChecked) {
                                  delete newOrder[c];
                                } else if (newOrder[c] === undefined) {
                                  const maxExisting =
                                    Object.values(newOrder).length > 0
                                      ? Math.max(...Object.values(newOrder))
                                      : 900000;
                                  newOrder[c] = maxExisting + 1;
                                }
                                return {
                                  ...cd,
                                  selectAll: false,
                                  selectedColumns: newSelectedColumns,
                                  columnSelectOrder: newOrder,
                                };
                              })()
                            : cd
                        )
                      )
                    }
                  />
                  <span style={{ marginLeft: 6 }}>{c}</span>
                </label>

                {/* RIGHT ARROW */}
                <div
                  className={`connector-arrow connector-arrow-right${
                    pendingConnection && pendingConnection.cardId === card.id && pendingConnection.column === c && pendingConnection.side === "right"
                      ? " active"
                      : pendingConnection && pendingConnection.cardId !== card.id
                      ? " joinable"
                      : ""
                  }`}
                  onClick={(e) => handleArrowClick(e, card.id, c, "right")}
                  title={
                    pendingConnection
                      ? pendingConnection.cardId === card.id
                        ? "Click again to cancel"
                        : `Join to ${pendingConnection.column} (click to connect)`
                      : "Click to start a join from this column"
                  }
                >
                  &#8250;
                </div>

                {/* Hidden dot (backwards compat) */}
                <div
                  className="connector-dot"
                  style={{ display: "none" }}
                  onMouseDown={(e) => handleDotMouseDown(e, card.id, c, "right")}
                  onMouseUp={(e) => handleDotMouseUp(e, card.id, c, "right")}
                  title="Drag to connect"
                />
              </div>
            ))}
          </div>

          {/* RESIZE HANDLE */}
          <div className="card-resize-handle" onMouseDown={(e) => startResize(e, card.id)} />
        </>
      )}
    </div>
  );
}
